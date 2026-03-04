import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';

import api from '../../services/api';
import {
  type TerraformMirrorConfig,
  type TerraformMirrorStatusResponse,
  type TerraformVersion,
  type TerraformVersionPlatform,
  type TerraformSyncHistory,
  type CreateTerraformMirrorConfigRequest,
  type UpdateTerraformMirrorConfigRequest,
  syncStatusColor,
  parsePlatformFilter,
} from '../../types/terraform_mirror';

// ---------------------------------------------------------------------------
// Helper chip components
// ---------------------------------------------------------------------------

const SyncStatusChip: React.FC<{ status: string; size?: 'small' | 'medium' }> = ({
  status,
  size = 'small',
}) => (
  <Chip
    label={status}
    color={syncStatusColor(status)}
    size={size}
    icon={
      status === 'synced' || status === 'success' ? (
        <CheckCircleIcon />
      ) : status === 'failed' ? (
        <ErrorIcon />
      ) : undefined
    }
  />
);

const ToolChip: React.FC<{ tool: string }> = ({ tool }) => {
  const color = tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default';
  return <Chip label={tool} size="small" color={color} variant="outlined" />;
};

// ---------------------------------------------------------------------------
// Version row with expandable platform list
// ---------------------------------------------------------------------------

const VersionRow: React.FC<{
  version: TerraformVersion;
  configId: string;
  onDelete: (v: TerraformVersion) => void;
}> = ({ version, configId, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [platforms, setPlatforms] = useState<TerraformVersionPlatform[] | null>(null);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);

  const handleExpand = async () => {
    if (!open && platforms === null) {
      setLoadingPlatforms(true);
      try {
        const data = await api.listTerraformVersionPlatforms(configId, version.version);
        setPlatforms(data);
      } catch {
        setPlatforms([]);
      } finally {
        setLoadingPlatforms(false);
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={handleExpand}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontFamily="monospace">
              {version.version}
            </Typography>
            {version.is_latest && <Chip label="latest" color="primary" size="small" />}
            {version.is_deprecated && <Chip label="deprecated" color="warning" size="small" />}
          </Box>
        </TableCell>
        <TableCell>
          <SyncStatusChip status={version.sync_status} />
        </TableCell>
        <TableCell>
          {version.synced_at ? new Date(version.synced_at).toLocaleString() : '—'}
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Delete version and its binaries from storage">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(version)}
                disabled={version.sync_status === 'syncing'}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={5} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ m: 1, mb: 2 }}>
              {loadingPlatforms ? (
                <CircularProgress size={20} />
              ) : platforms && platforms.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>OS</TableCell>
                      <TableCell>Arch</TableCell>
                      <TableCell>Filename</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>SHA256</TableCell>
                      <TableCell>GPG</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {platforms.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.os}</TableCell>
                        <TableCell>{p.arch}</TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                            {p.filename}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <SyncStatusChip status={p.sync_status} />
                        </TableCell>
                        <TableCell>
                          {p.sha256_verified ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="disabled" fontSize="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {p.gpg_verified ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="disabled" fontSize="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No platforms synced yet.
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ---------------------------------------------------------------------------
// Config card
// ---------------------------------------------------------------------------

const ConfigCard: React.FC<{
  config: TerraformMirrorConfig;
  status?: TerraformMirrorStatusResponse;
  onEdit: (c: TerraformMirrorConfig) => void;
  onDelete: (c: TerraformMirrorConfig) => void;
  onSync: (c: TerraformMirrorConfig) => void;
  onViewVersions: (c: TerraformMirrorConfig) => void;
  onViewHistory: (c: TerraformMirrorConfig) => void;
  syncing: boolean;
}> = ({ config, status, onEdit, onDelete, onSync, onViewVersions, onViewHistory, syncing }) => (
  <Card variant="outlined">
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
          {config.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
          <ToolChip tool={config.tool} />
          <Chip
            label={config.enabled ? 'enabled' : 'disabled'}
            color={config.enabled ? 'success' : 'default'}
            size="small"
          />
        </Box>
      </Box>

      {config.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {config.description}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" noWrap>
        {config.upstream_url}
      </Typography>

      {status && (
        <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip size="small" label={`${status.version_count} versions`} variant="outlined" />
          <Chip size="small" label={`${status.platform_count} platforms`} variant="outlined" />
          {status.pending_count > 0 && (
            <Chip size="small" label={`${status.pending_count} pending`} variant="outlined" color="warning" />
          )}
        </Box>
      )}

      <Box sx={{ mt: 1.5 }}>
        {config.last_sync_status ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SyncStatusChip status={config.last_sync_status} />
            {config.last_sync_at && (
              <Typography variant="caption" color="text.secondary">
                {new Date(config.last_sync_at).toLocaleString()}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Never synced
          </Typography>
        )}
      </Box>
    </CardContent>

    <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
      <Box>
        <Tooltip title="View details">
          <Button size="small" onClick={() => onViewVersions(config)}>
            View Details
          </Button>
        </Tooltip>
        <Tooltip title="View sync history">
          <IconButton size="small" onClick={() => onViewHistory(config)}>
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box>
        <Tooltip title="Trigger sync">
          <span>
            <IconButton size="small" onClick={() => onSync(config)} disabled={syncing || !config.enabled}>
              <SyncIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit configuration">
          <IconButton size="small" onClick={() => onEdit(config)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete mirror">
          <IconButton size="small" color="error" onClick={() => onDelete(config)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </CardActions>
  </Card>
);

// ---------------------------------------------------------------------------
// Tool defaults
// ---------------------------------------------------------------------------

const TOOL_DEFAULT_URLS: Record<string, string> = {
  terraform: 'https://releases.hashicorp.com',
  opentofu: 'https://releases.opentofu.org',
};

/** Returns the canonical upstream URL for a known tool, or '' for custom. */
function toolDefaultUrl(tool: string): string {
  return TOOL_DEFAULT_URLS[tool] ?? '';
}

// ---------------------------------------------------------------------------
// Empty config form helpers
// ---------------------------------------------------------------------------

const emptyCreate = (): CreateTerraformMirrorConfigRequest => ({
  name: '',
  description: '',
  tool: 'terraform',
  upstream_url: toolDefaultUrl('terraform'),
  gpg_verify: true,
  stable_only: false,
  enabled: true,
  sync_interval_hours: 24,
});

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TerraformMirrorPage: React.FC = () => {
  const [configs, setConfigs] = useState<TerraformMirrorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---- create dialog ----
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTerraformMirrorConfigRequest>(emptyCreate());
  const [createVersionFilter, setCreateVersionFilter] = useState('');
  const [createPlatformFilter, setCreatePlatformFilter] = useState('');
  const [creating, setCreating] = useState(false);

  // ---- edit dialog ----
  const [editConfig, setEditConfig] = useState<TerraformMirrorConfig | null>(null);
  const [editForm, setEditForm] = useState<UpdateTerraformMirrorConfigRequest>({});
  const [editVersionFilter, setEditVersionFilter] = useState('');
  const [editPlatformFilter, setEditPlatformFilter] = useState('');
  const [editing, setEditing] = useState(false);

  // ---- delete dialog ----
  const [deleteConfig, setDeleteConfig] = useState<TerraformMirrorConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- versions dialog ----
  const [versionsConfig, setVersionsConfig] = useState<TerraformMirrorConfig | null>(null);
  const [versions, setVersions] = useState<TerraformVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [deleteVersion, setDeleteVersion] = useState<TerraformVersion | null>(null);
  const [deletingVersion, setDeletingVersion] = useState(false);

  // ---- status overlay (per-card) ----
  const [statusMap, setStatusMap] = useState<Record<string, TerraformMirrorStatusResponse>>({});

  // ---- history dialog ----
  const [historyConfig, setHistoryConfig] = useState<TerraformMirrorConfig | null>(null);
  const [history, setHistory] = useState<TerraformSyncHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---- sync in-progress ----
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listTerraformMirrorConfigs();
      setConfigs(data.configs ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load Terraform mirror configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Lazy-load status for each card
  const loadStatus = useCallback(async (configId: string) => {
    try {
      const s = await api.getTerraformMirrorStatus(configId);
      setStatusMap((prev) => ({ ...prev, [configId]: s }));
    } catch {
      // ignore status load failures
    }
  }, []);

  useEffect(() => {
    configs.forEach((c) => loadStatus(c.id));
  }, [configs, loadStatus]);

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  const handleCreate = async () => {
    setCreating(true);
    try {
      const platformFilter = createPlatformFilter
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createTerraformMirrorConfig({
        ...createForm,
        platform_filter: platformFilter.length > 0 ? platformFilter : undefined,
        version_filter: createVersionFilter.trim() || undefined,
      });
      setSuccess(`Mirror "${createForm.name}" created`);
      setCreateOpen(false);
      setCreateForm(emptyCreate());
      setCreateVersionFilter('');
      setCreatePlatformFilter('');
      loadConfigs();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create mirror config');
    } finally {
      setCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------
  const openEdit = (config: TerraformMirrorConfig) => {
    setEditConfig(config);
    setEditVersionFilter(config.version_filter ?? '');
    setEditPlatformFilter(parsePlatformFilter(config.platform_filter).join(', '));
    setEditForm({
      name: config.name,
      description: config.description ?? '',
      tool: config.tool,
      enabled: config.enabled,
      upstream_url: config.upstream_url,
      gpg_verify: config.gpg_verify,
      stable_only: config.stable_only,
      sync_interval_hours: config.sync_interval_hours,
    });
  };

  const handleEdit = async () => {
    if (!editConfig) return;
    setEditing(true);
    try {
      const platformFilter = editPlatformFilter
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.updateTerraformMirrorConfig(editConfig.id, {
        ...editForm,
        platform_filter: platformFilter.length > 0 ? platformFilter : [],
        version_filter: editVersionFilter.trim() || '',
      });
      setSuccess(`Mirror "${editConfig.name}" updated`);
      setEditConfig(null);
      loadConfigs();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update mirror config');
    } finally {
      setEditing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteConfig) return;
    setDeleting(true);
    try {
      await api.deleteTerraformMirrorConfig(deleteConfig.id);
      setSuccess(`Mirror "${deleteConfig.name}" deleted`);
      setDeleteConfig(null);
      loadConfigs();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to delete mirror config');
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  const handleSync = async (config: TerraformMirrorConfig) => {
    setSyncingIds((prev) => new Set([...prev, config.id]));
    try {
      await api.triggerTerraformMirrorSync(config.id);
      setSuccess(`Sync triggered for "${config.name}"`);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to trigger sync');
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(config.id);
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Versions dialog
  // ---------------------------------------------------------------------------
  const openVersions = async (config: TerraformMirrorConfig) => {
    setVersionsConfig(config);
    setVersionsLoading(true);
    setVersions([]);
    try {
      const data = await api.listTerraformVersions(config.id, { synced: false });
      const rows = data.versions ?? [];
      // Sort: latest first, then by version descending
      const sorted = [...rows].sort((a, b) => {
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1;
        return b.version.localeCompare(a.version, undefined, { numeric: true });
      });
      setVersions(sorted);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deleteVersion || !versionsConfig) return;
    setDeletingVersion(true);
    try {
      await api.deleteTerraformVersion(versionsConfig.id, deleteVersion.version);
      setSuccess(`Version ${deleteVersion.version} deleted`);
      setDeleteVersion(null);
      openVersions(versionsConfig);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to delete version');
      setDeleteVersion(null);
    } finally {
      setDeletingVersion(false);
    }
  };

  // ---------------------------------------------------------------------------
  // History dialog
  // ---------------------------------------------------------------------------
  const openHistory = async (config: TerraformMirrorConfig) => {
    setHistoryConfig(config);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const data = await api.getTerraformMirrorHistory(config.id, 20);
      setHistory(data.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Mirroring — Binaries Config</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadConfigs}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setCreateForm(emptyCreate()); setCreateVersionFilter(''); setCreatePlatformFilter(''); setCreateOpen(true); }}
          >
            Add Mirror
          </Button>
        </Box>
      </Box>

      {/* Help / info banner */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Clients download binaries at{' '}
          <code>/terraform/binaries/&#123;name&#125;/versions/&#123;version&#125;/&#123;os&#125;/&#123;arch&#125;</code>.
          This endpoint is unauthenticated — configure your CI or developer machines to point at
          your registry host.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Config cards */}
      {configs.length === 0 ? (
        <Alert severity="info">
          No Terraform binary mirror configurations exist yet. Create one to start mirroring
          Terraform or OpenTofu binaries.
        </Alert>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {configs.map((cfg) => {
            const status = statusMap[cfg.id];
            return (
              <Grid item xs={12} md={6} key={cfg.id}>
                <ConfigCard
                  config={cfg}
                  status={status}
                  onEdit={openEdit}
                  onDelete={setDeleteConfig}
                  onSync={handleSync}
                  onViewVersions={openVersions}
                  onViewHistory={openHistory}
                  syncing={syncingIds.has(cfg.id)}
                />
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ==================================================================
          Create Dialog
      ================================================================== */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Terraform Binary Mirror</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              helperText="Unique slug used in API paths (e.g. hashicorp-terraform)"
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={createForm.description ?? ''}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Tool"
              value={createForm.tool}
              onChange={(e) => {
                const newTool = e.target.value;
                setCreateForm((prev) => {
                  // Auto-update upstream URL only if it still matches the previous tool's default
                  const prevDefault = toolDefaultUrl(prev.tool);
                  const shouldUpdate = prev.upstream_url === prevDefault || prev.upstream_url === '';
                  return {
                    ...prev,
                    tool: newTool,
                    upstream_url: shouldUpdate ? toolDefaultUrl(newTool) : prev.upstream_url,
                  };
                });
              }}
              fullWidth
            >
              <MenuItem value="terraform">Terraform (HashiCorp)</MenuItem>
              <MenuItem value="opentofu">OpenTofu</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>
            <TextField
              label="Upstream URL"
              value={createForm.upstream_url}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, upstream_url: e.target.value }))}
              helperText={
                createForm.tool === 'opentofu'
                  ? 'OpenTofu releases server (releases.opentofu.org) or a GitHub repo URL (e.g. https://github.com/opentofu/opentofu).'
                  : createForm.tool === 'terraform'
                    ? 'Terraform releases are sourced from releases.hashicorp.com.'
                    : 'URL of the upstream source. Use a releases server URL or a GitHub repository URL.'
              }
              required
              fullWidth
            />
            <TextField
              label="Sync Interval (hours)"
              type="number"
              value={createForm.sync_interval_hours ?? 24}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  sync_interval_hours: parseInt(e.target.value, 10),
                }))
              }
              inputProps={{ min: 1 }}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.enabled ?? true}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                  />
                }
                label="Enabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.gpg_verify ?? true}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, gpg_verify: e.target.checked }))
                    }
                  />
                }
                label="GPG Verify"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.stable_only ?? false}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, stable_only: e.target.checked }))
                    }
                  />
                }
                label="Stable Only"
              />
            </Box>
            <TextField
              label="Version Filter"
              value={createVersionFilter}
              onChange={(e) => setCreateVersionFilter(e.target.value)}
              helperText='Limit versions to sync: "1.9." (prefix), "latest:5", ">=1.5.0" (semver), "1.5.0,1.6.0" (list). Leave blank for all.'
              fullWidth
            />
            <TextField
              label="Platform Filter"
              value={createPlatformFilter}
              onChange={(e) => setCreatePlatformFilter(e.target.value)}
              helperText='Comma-separated os/arch pairs, e.g. "linux/amd64, darwin/arm64, windows/amd64". Leave blank for all platforms.'
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={creating || !createForm.name || !createForm.upstream_url}
          >
            {creating ? <CircularProgress size={18} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================================
          Edit Dialog
      ================================================================== */}
      <Dialog open={!!editConfig} onClose={() => setEditConfig(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Mirror — {editConfig?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={editForm.name ?? ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={editForm.description ?? ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Tool"
              value={editForm.tool ?? 'terraform'}
              onChange={(e) => {
                const newTool = e.target.value;
                setEditForm((prev) => {
                  const prevDefault = toolDefaultUrl(prev.tool ?? 'terraform');
                  const shouldUpdate = (prev.upstream_url ?? '') === prevDefault || (prev.upstream_url ?? '') === '';
                  return {
                    ...prev,
                    tool: newTool,
                    upstream_url: shouldUpdate ? toolDefaultUrl(newTool) : prev.upstream_url,
                  };
                });
              }}
              fullWidth
            >
              <MenuItem value="terraform">Terraform (HashiCorp)</MenuItem>
              <MenuItem value="opentofu">OpenTofu</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>
            <TextField
              label="Upstream URL"
              value={editForm.upstream_url ?? ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, upstream_url: e.target.value }))}
              helperText={
                editForm.tool === 'opentofu'
                  ? 'OpenTofu releases server (releases.opentofu.org) or a GitHub repo URL (e.g. https://github.com/opentofu/opentofu).'
                  : editForm.tool === 'terraform'
                    ? 'Terraform releases are sourced from releases.hashicorp.com.'
                    : 'URL of the upstream source. Use a releases server URL or a GitHub repository URL.'
              }
              fullWidth
            />
            <TextField
              label="Sync Interval (hours)"
              type="number"
              value={editForm.sync_interval_hours ?? 24}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  sync_interval_hours: parseInt(e.target.value, 10),
                }))
              }
              inputProps={{ min: 1 }}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.enabled ?? true}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                  />
                }
                label="Enabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.gpg_verify ?? true}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, gpg_verify: e.target.checked }))
                    }
                  />
                }
                label="GPG Verify"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.stable_only ?? false}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, stable_only: e.target.checked }))
                    }
                  />
                }
                label="Stable Only"
              />
            </Box>
            <TextField
              label="Version Filter"
              value={editVersionFilter}
              onChange={(e) => setEditVersionFilter(e.target.value)}
              helperText='Limit versions to sync: "1.9." (prefix), "latest:5", ">=1.5.0" (semver), "1.5.0,1.6.0" (list). Leave blank for all.'
              fullWidth
            />
            <TextField
              label="Platform Filter"
              value={editPlatformFilter}
              onChange={(e) => setEditPlatformFilter(e.target.value)}
              helperText='Comma-separated os/arch pairs, e.g. "linux/amd64, darwin/arm64, windows/amd64". Leave blank for all platforms.'
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditConfig(null)}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={editing}>
            {editing ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================================
          Delete Config Dialog
      ================================================================== */}
      <Dialog open={!!deleteConfig} onClose={() => setDeleteConfig(null)}>
        <DialogTitle>Delete Mirror Configuration</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete mirror <strong>{deleteConfig?.name}</strong>? This
            will delete all synced version records and cannot be undone. Binaries in storage
            will NOT be removed automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfig(null)}>Cancel</Button>
          <Button color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================================
          Versions Dialog
      ================================================================== */}
      {versionsConfig && (
        <Dialog
          open
          onClose={() => setVersionsConfig(null)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Versions — {versionsConfig.name}
            <Box component="span" sx={{ ml: 1 }}>
              <ToolChip tool={versionsConfig.tool} />
            </Box>
          </DialogTitle>
          <DialogContent>
            {versionsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : versions.length === 0 ? (
              <Alert severity="info">No versions have been synced yet.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={48} />
                      <TableCell>Version</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Synced At</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((v) => (
                      <VersionRow
                        key={v.id}
                        version={v}
                        configId={versionsConfig.id}
                        onDelete={setDeleteVersion}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVersionsConfig(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ---- Delete Version Confirmation ---- */}
      <Dialog open={!!deleteVersion} onClose={() => setDeleteVersion(null)}>
        <DialogTitle>Delete Terraform Version</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete version{' '}
            <strong>{deleteVersion?.version}</strong>? This will remove the version record
            and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteVersion(null)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteVersion} disabled={deletingVersion}>
            {deletingVersion ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================================================================
          History Dialog
      ================================================================== */}
      <Dialog
        open={!!historyConfig}
        onClose={() => setHistoryConfig(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Sync History — {historyConfig?.name}</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : history.length === 0 ? (
            <Alert severity="info">No sync history yet.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Started</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Triggered By</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Versions</TableCell>
                    <TableCell>Platforms</TableCell>
                    <TableCell>Failures</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id} hover>
                      <TableCell>{new Date(h.started_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {h.completed_at ? new Date(h.completed_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>{h.triggered_by}</TableCell>
                      <TableCell>
                        <SyncStatusChip status={h.status} />
                      </TableCell>
                      <TableCell>{h.versions_synced}</TableCell>
                      <TableCell>{h.platforms_synced}</TableCell>
                      <TableCell>
                        {h.versions_failed > 0 ? (
                          <Chip label={h.versions_failed} color="error" size="small" />
                        ) : (
                          '0'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryConfig(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TerraformMirrorPage;