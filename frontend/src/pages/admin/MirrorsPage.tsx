import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Typography,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Collapse,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import SyncIcon from '@mui/icons-material/Sync';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import api from '../../services/api';
import {
  type MirrorConfiguration,
  type MirrorSyncHistory,
  type MirroredProvider,
  type MirroredProviderVersion,
  type MirroredProviderPlatform,
  type CreateMirrorConfigRequest,
  parseMirrorConfig,
} from '../../types/mirror';
import { formatDate } from '../../utils';
import { getErrorMessage } from '../../utils/errors';

// ---------------------------------------------------------------------------
// Version sub-row with expandable platform list
// ---------------------------------------------------------------------------
const VersionPlatformRow: React.FC<{ version: MirroredProviderVersion }> = ({ version }) => {
  const [open, setOpen] = useState(false);
  const platforms: MirroredProviderPlatform[] = version.platforms ?? [];

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ pl: 1 }}>
          <IconButton size="small" onClick={() => setOpen((p) => !p)} disabled={platforms.length === 0}>
            {open ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="caption" fontFamily="monospace">{version.upstream_version}</Typography>
        </TableCell>
        <TableCell>{new Date(version.synced_at).toLocaleString()}</TableCell>
        <TableCell>
          {version.shasum_verified
            ? <CheckCircleIcon color="success" fontSize="small" />
            : <ErrorIcon color="disabled" fontSize="small" />}
        </TableCell>
        <TableCell>
          {version.gpg_verified
            ? <CheckCircleIcon color="success" fontSize="small" />
            : <ErrorIcon color="disabled" fontSize="small" />}
        </TableCell>
        <TableCell>{platforms.length}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ ml: 4, mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OS</TableCell>
                    <TableCell>Arch</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell>SHA256</TableCell>
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
                        <Typography variant="caption" fontFamily="monospace">
                          {p.shasum ? p.shasum.slice(0, 12) + '…' : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ---------------------------------------------------------------------------
// Expandable provider row — shows synced versions when expanded
// ---------------------------------------------------------------------------
const ProviderRow: React.FC<{ provider: MirroredProvider }> = ({ provider }) => {
  const [open, setOpen] = useState(false);
  const versions: MirroredProviderVersion[] = provider.versions ?? [];

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((p) => !p)} disabled={versions.length === 0}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{provider.upstream_namespace}</TableCell>
        <TableCell>{provider.upstream_type}</TableCell>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace">
            {provider.last_sync_version ?? '—'}
          </Typography>
        </TableCell>
        <TableCell>{versions.length}</TableCell>
        <TableCell>{provider.last_synced_at ? new Date(provider.last_synced_at).toLocaleString() : '—'}</TableCell>
        <TableCell>
          <Chip
            label={provider.sync_enabled ? 'enabled' : 'disabled'}
            size="small"
            color={provider.sync_enabled ? 'success' : 'default'}
          />
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ mx: 2, mb: 2 }}>
              {versions.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No versions synced.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={40} />
                      <TableCell>Version</TableCell>
                      <TableCell>Synced At</TableCell>
                      <TableCell>Shasum</TableCell>
                      <TableCell>GPG</TableCell>
                      <TableCell>Platforms</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((v) => (
                      <VersionPlatformRow key={v.id} version={v} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const MirrorsPage: React.FC = () => {
  const [mirrors, setMirrors] = useState<MirrorConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingMirror, setEditingMirror] = useState<MirrorConfiguration | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorConfiguration | null>(null);
  const [providersDialogOpen, setProvidersDialogOpen] = useState(false);
  const [providersDialogName, setProvidersDialogName] = useState('');
  const [mirrorProviders, setMirrorProviders] = useState<MirroredProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [mirrorHistory, setMirrorHistory] = useState<MirrorSyncHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMirrorName, setHistoryMirrorName] = useState('');

  // Client-side pagination
  const [mirrorsPage, setMirrorsPage] = useState(0);
  const [mirrorsRowsPerPage, setMirrorsRowsPerPage] = useState(10);

  const [formData, setFormData] = useState<Partial<CreateMirrorConfigRequest>>({
    name: '',
    description: '',
    upstream_registry_url: 'https://registry.terraform.io',
    namespace_filter: [],
    provider_filter: [],
    version_filter: '',
    enabled: true,
    sync_interval_hours: 24,
  });

  // For the filters input
  const [namespaceFilterInput, setNamespaceFilterInput] = useState('');
  const [providerFilterInput, setProviderFilterInput] = useState('');
  const [versionFilterInput, setVersionFilterInput] = useState('');
  const [platformFilterInput, setPlatformFilterInput] = useState('');

  const [searchParams] = useSearchParams();

  const loadMirrors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listMirrors();
      setMirrors(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load mirrors'));
      console.error('Error loading mirrors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMirrors();
  }, [loadMirrors]);

  // Auto-open the Add Mirror dialog when navigated here with ?action=add
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setCreateDialogOpen(true);
    }
  }, [searchParams]);

  const handleCreate = async () => {
    try {
      setError(null);
      const data = {
        ...formData,
        namespace_filter: namespaceFilterInput.split(',').map(s => s.trim()).filter(Boolean),
        provider_filter: providerFilterInput.split(',').map(s => s.trim()).filter(Boolean),
        version_filter: versionFilterInput.trim() || undefined,
        platform_filter: platformFilterInput.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.createMirror(data as CreateMirrorConfigRequest);
      setCreateDialogOpen(false);
      resetForm();
      setSuccess('Mirror configuration created successfully');
      await loadMirrors();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create mirror'));
    }
  };

  const handleUpdate = async () => {
    if (!editingMirror) return;
    try {
      setError(null);
      const data = {
        name: formData.name,
        description: formData.description,
        upstream_registry_url: formData.upstream_registry_url,
        namespace_filter: namespaceFilterInput.split(',').map(s => s.trim()).filter(Boolean),
        provider_filter: providerFilterInput.split(',').map(s => s.trim()).filter(Boolean),
        version_filter: versionFilterInput.trim() || undefined,
        platform_filter: platformFilterInput.split(',').map(s => s.trim()).filter(Boolean),
        enabled: formData.enabled,
        sync_interval_hours: formData.sync_interval_hours,
      };
      await api.updateMirror(editingMirror.id, data);
      setEditingMirror(null);
      resetForm();
      setSuccess('Mirror configuration updated successfully');
      await loadMirrors();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update mirror'));
    }
  };

  const handleDelete = async () => {
    if (!mirrorToDelete) return;
    try {
      setError(null);
      await api.deleteMirror(mirrorToDelete.id);
      setDeleteConfirmOpen(false);
      setMirrorToDelete(null);
      setSuccess('Mirror configuration deleted successfully');
      await loadMirrors();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete mirror'));
    }
  };

  const handleTriggerSync = async (mirror: MirrorConfiguration) => {
    try {
      setError(null);
      await api.triggerMirrorSync(mirror.id);
      setSuccess(`Sync triggered for "${mirror.name}"`);
      await loadMirrors();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to trigger sync'));
    }
  };

  const handleViewStatus = async (mirror: MirrorConfiguration) => {
    setProvidersDialogName(mirror.name);
    setProvidersDialogOpen(true);
    setProvidersLoading(true);
    try {
      const providers = await api.getMirrorProviders(mirror.id);
      setMirrorProviders(Array.isArray(providers) ? providers : []);
    } catch {
      setMirrorProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  };

  const handleViewHistory = async (mirror: MirrorConfiguration) => {
    setHistoryMirrorName(mirror.name);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    try {
      const status = await api.getMirrorStatus(mirror.id);
      setMirrorHistory(status.recent_syncs ?? []);
    } catch {
      setMirrorHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      upstream_registry_url: 'https://registry.terraform.io',
      namespace_filter: [],
      provider_filter: [],
      version_filter: '',
      enabled: true,
      sync_interval_hours: 24,
    });
    setNamespaceFilterInput('');
    setProviderFilterInput('');
    setVersionFilterInput('');
    setPlatformFilterInput('');
  };

  const openEditDialog = (mirror: MirrorConfiguration) => {
    setEditingMirror(mirror);
    const parsed = parseMirrorConfig(mirror);
    setFormData({
      name: mirror.name,
      description: mirror.description,
      upstream_registry_url: mirror.upstream_registry_url,
      enabled: mirror.enabled,
      sync_interval_hours: mirror.sync_interval_hours,
    });
    setNamespaceFilterInput(parsed.namespaceFilters.join(', '));
    setProviderFilterInput(parsed.providerFilters.join(', '));
    setVersionFilterInput(mirror.version_filter || '');
    setPlatformFilterInput(parsed.platformFilters.join(', '));
  };

  const getStatusChip = (mirror: MirrorConfiguration) => {
    if (!mirror.last_sync_status) {
      return <Chip label="Never synced" size="small" color="default" />;
    }
    switch (mirror.last_sync_status) {
      case 'success':
        return <Chip label="Success" size="small" color="success" icon={<CheckCircleIcon />} />;
      case 'failed':
        return <Chip label="Failed" size="small" color="error" icon={<ErrorIcon />} />;
      case 'in_progress':
        return <Chip label="Syncing..." size="small" color="info" icon={<SyncIcon />} />;
      default:
        return <Chip label={mirror.last_sync_status} size="small" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Mirroring — Provider Config</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure upstream registry mirroring for providers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadMirrors}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            Add Mirror
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {mirrors
          .slice(mirrorsPage * mirrorsRowsPerPage, mirrorsPage * mirrorsRowsPerPage + mirrorsRowsPerPage)
          .map((mirror) => {
          const parsed = parseMirrorConfig(mirror);
          return (
            <Grid size={{ xs: 12, md: 6 }} key={mirror.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <CloudDownloadIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Box flexGrow={1}>
                      <Typography variant="h6">{mirror.name}</Typography>
                      <Typography variant="body2" color="textSecondary" noWrap>
                        {mirror.upstream_registry_url}
                      </Typography>
                    </Box>
                    <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                      <Chip
                        label={mirror.enabled ? 'Enabled' : 'Disabled'}
                        color={mirror.enabled ? 'success' : 'default'}
                        size="small"
                      />
                      {getStatusChip(mirror)}
                    </Box>
                  </Box>

                  {mirror.description && (
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {mirror.description}
                    </Typography>
                  )}

                  <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
                    {parsed.namespaceFilters.length > 0 && (
                      <Tooltip title="Namespace filters">
                        <Chip
                          size="small"
                          label={`Namespaces: ${parsed.namespaceFilters.join(', ')}`}
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                    {parsed.providerFilters.length > 0 && (
                      <Tooltip title="Provider filters">
                        <Chip
                          size="small"
                          label={`Providers: ${parsed.providerFilters.join(', ')}`}
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                    {mirror.version_filter && (
                      <Tooltip title="Version filter">
                        <Chip
                          size="small"
                          label={`Versions: ${mirror.version_filter}`}
                          variant="outlined"
                          color="primary"
                        />
                      </Tooltip>
                    )}
                    {parsed.platformFilters.length > 0 && (
                      <Tooltip title="Platform filters">
                        <Chip
                          size="small"
                          label={`Platforms: ${parsed.platformFilters.join(', ')}`}
                          variant="outlined"
                          color="secondary"
                        />
                      </Tooltip>
                    )}
                  </Box>

                  <Typography variant="caption" color="textSecondary" display="block">
                    <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                    Sync interval: {mirror.sync_interval_hours} hours
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Last sync: {formatDate(mirror.last_sync_at, 'Never')}
                  </Typography>

                  {mirror.last_sync_error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <Typography variant="caption">{mirror.last_sync_error}</Typography>
                    </Alert>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
                  <Box>
                    <Tooltip title="View status and current sync">
                      <Button size="small" onClick={() => handleViewStatus(mirror)}>
                        View Details
                      </Button>
                    </Tooltip>
                    <Tooltip title="View sync history">
                      <IconButton size="small" onClick={() => handleViewHistory(mirror)}>
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box>
                    <Tooltip title="Trigger sync">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleTriggerSync(mirror)}
                          disabled={mirror.last_sync_status === 'in_progress'}
                        >
                          <SyncIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(mirror)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setMirrorToDelete(mirror);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          );
        })}

        {mirrors.length === 0 && !loading && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No mirror configurations found. Add one to start mirroring providers from upstream registries.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {mirrors.length > mirrorsRowsPerPage && (
        <TablePagination
          component="div"
          count={mirrors.length}
          page={mirrorsPage}
          onPageChange={(_e, newPage) => setMirrorsPage(newPage)}
          rowsPerPage={mirrorsRowsPerPage}
          onRowsPerPageChange={(e) => {
            setMirrorsRowsPerPage(parseInt(e.target.value, 10));
            setMirrorsPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          sx={{ mt: 2 }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || !!editingMirror}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingMirror(null);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingMirror ? 'Edit Mirror' : 'Add Provider Mirror'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              helperText="A unique name for this mirror configuration"
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <TextField
              label="Upstream Registry URL"
              fullWidth
              value={formData.upstream_registry_url}
              onChange={(e) => setFormData({ ...formData, upstream_registry_url: e.target.value })}
              required
              helperText="e.g., https://registry.terraform.io"
            />

            <TextField
              label="Namespace Filter"
              fullWidth
              value={namespaceFilterInput}
              onChange={(e) => setNamespaceFilterInput(e.target.value)}
              helperText="Comma-separated list of namespaces to mirror (e.g., hashicorp, aws)"
            />

            <TextField
              label="Provider Filter"
              fullWidth
              value={providerFilterInput}
              onChange={(e) => setProviderFilterInput(e.target.value)}
              helperText="Comma-separated list of provider names to mirror (e.g., aws, google, azurerm)"
            />

            <TextField
              label="Version Filter"
              fullWidth
              value={versionFilterInput}
              onChange={(e) => setVersionFilterInput(e.target.value)}
              helperText="Filter versions to sync: '3.' (prefix), 'latest:5' (latest N), '>=3.0.0' (semver), or comma-separated list"
              placeholder="e.g., 3. or latest:5 or >=3.0.0"
            />

            <TextField
              label="Platform Filter"
              fullWidth
              value={platformFilterInput}
              onChange={(e) => setPlatformFilterInput(e.target.value)}
              helperText="Comma-separated list of platforms to sync in 'os/arch' format. Leave empty for all platforms."
              placeholder="e.g., linux/amd64, windows/amd64, darwin/arm64"
            />

            <TextField
              label="Sync Interval (hours)"
              type="number"
              fullWidth
              value={formData.sync_interval_hours}
              onChange={(e) => setFormData({ ...formData, sync_interval_hours: parseInt(e.target.value) || 24 })}
              inputProps={{ min: 1 }}
              helperText="How often to check for updates"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setEditingMirror(null);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingMirror ? handleUpdate : handleCreate}
            disabled={!formData.name || !formData.upstream_registry_url}
          >
            {editingMirror ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the mirror "{mirrorToDelete?.name}"? This action
            cannot be undone. Mirrored providers will remain in your registry.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setMirrorHistory([]);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Sync History — {historyMirrorName}</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : mirrorHistory.length === 0 ? (
            <Typography color="textSecondary" sx={{ py: 2 }}>
              No sync history available.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Started</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Providers Synced</TableCell>
                    <TableCell align="right">Failures</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mirrorHistory.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell>{formatDate(sync.started_at)}</TableCell>
                      <TableCell>{sync.completed_at ? formatDate(sync.completed_at) : '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={sync.status}
                          size="small"
                          color={
                            sync.status === 'success' ? 'success'
                              : sync.status === 'failed' ? 'error'
                                : sync.status === 'running' ? 'info'
                                  : 'default'
                          }
                          icon={
                            sync.status === 'success' ? <CheckCircleIcon />
                              : sync.status === 'failed' ? <ErrorIcon />
                                : undefined
                          }
                        />
                        {sync.error_message && (
                          <Tooltip title={sync.error_message}>
                            <ErrorIcon color="error" fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">{sync.providers_synced}</TableCell>
                      <TableCell align="right">{sync.providers_failed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setHistoryDialogOpen(false); setMirrorHistory([]); }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details — Synced Providers Dialog */}
      <Dialog
        open={providersDialogOpen}
        onClose={() => { setProvidersDialogOpen(false); setMirrorProviders([]); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Providers — {providersDialogName}</DialogTitle>
        <DialogContent>
          {providersLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : mirrorProviders.length === 0 ? (
            <Alert severity="info">No providers have been synced yet.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={48} />
                    <TableCell>Namespace</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Latest Version</TableCell>
                    <TableCell>Versions</TableCell>
                    <TableCell>Last Synced</TableCell>
                    <TableCell>Enabled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mirrorProviders.map((p) => (
                    <ProviderRow key={p.id} provider={p} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setProvidersDialogOpen(false); setMirrorProviders([]); }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MirrorsPage;
