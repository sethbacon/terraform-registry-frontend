import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import RestoreIcon from '@mui/icons-material/Restore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import api from '../services/api';
import { getErrorMessage } from '../utils/errors';
import {
  type TerraformVersion,
  type TerraformVersionPlatform,
  syncStatusColor,
} from '../types/terraform_mirror';
import { useAuth } from '../contexts/AuthContext';

// Minimal config shape returned by the public endpoint
interface PublicMirrorSummary {
  name: string;
  description?: string | null;
  tool: string;
}

// ---------------------------------------------------------------------------
// Platform sub-row (expandable)
// ---------------------------------------------------------------------------

// Uses the public /terraform/binaries/:name/versions/:version endpoint which
// returns platform data without requiring authentication.
const PlatformRows: React.FC<{ mirrorName: string; version: string }> = ({
  mirrorName,
  version,
}) => {
  const [platforms, setPlatforms] = useState<TerraformVersionPlatform[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getPublicTerraformVersion(mirrorName, version)
      .then((data) => {
        if (!cancelled) setPlatforms(data.platforms ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlatforms([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mirrorName, version]);

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 1 }}>
          <CircularProgress size={16} />
        </TableCell>
      </TableRow>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            No platforms synced yet.
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {platforms.map((p) => (
        <TableRow key={p.id} sx={{ bgcolor: 'action.hover' }}>
          <TableCell sx={{ pl: 6 }} colSpan={2}>
            <Typography variant="caption" fontFamily="monospace">
              {p.os} / {p.arch}
            </Typography>
          </TableCell>
          <TableCell>
            <Chip label={p.sync_status} color={syncStatusColor(p.sync_status)} size="small" />
          </TableCell>
          <TableCell>
            <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
              {p.filename}
            </Typography>
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
    </>
  );
};

// ---------------------------------------------------------------------------
// Version row
// ---------------------------------------------------------------------------

interface VersionRowProps {
  version: TerraformVersion;
  mirrorName: string;
  canManage: boolean;
  onDeprecate: (v: TerraformVersion) => void;
  onUndeprecate: (v: TerraformVersion) => void;
  onDelete: (v: TerraformVersion) => void;
}

const VersionRow: React.FC<VersionRowProps> = ({
  version,
  mirrorName,
  canManage,
  onDeprecate,
  onUndeprecate,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: 'unset' },
          opacity: version.is_deprecated ? 0.6 : 1,
        }}
      >
        <TableCell width={48}>
          <IconButton size="small" aria-label="Toggle version details" onClick={() => setOpen((p) => !p)}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontFamily="monospace">
              {version.version}
            </Typography>
            {version.is_latest && <Chip label="latest" color="primary" size="small" />}
            {version.is_deprecated && (
              <Chip label="deprecated" color="warning" size="small" icon={<WarningIcon />} />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            label={version.sync_status}
            color={syncStatusColor(version.sync_status)}
            size="small"
          />
        </TableCell>
        <TableCell>
          {version.synced_at ? new Date(version.synced_at).toLocaleString() : '—'}
        </TableCell>
        {canManage && (
          <TableCell align="right">
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
              {version.is_deprecated ? (
                <Tooltip title="Remove deprecation (re-enable syncing)">
                  <IconButton size="small" aria-label="Undeprecate version" onClick={() => onUndeprecate(version)}>
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Mark as deprecated (prevents re-sync)">
                  <IconButton
                    size="small"
                    aria-label="Deprecate version"
                    color="warning"
                    onClick={() => onDeprecate(version)}
                    disabled={version.sync_status === 'syncing'}
                  >
                    <WarningIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete version and its binaries">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Delete version"
                    color="error"
                    onClick={() => onDelete(version)}
                    disabled={version.sync_status === 'syncing'}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </TableCell>
        )}
      </TableRow>

      {/* Expandable platform detail */}
      <TableRow>
        <TableCell
          colSpan={canManage ? 5 : 4}
          sx={{ pb: 0, pt: 0, borderBottom: open ? undefined : 'none' }}
        >
          <Collapse in={open} unmountOnExit>
            <Box sx={{ mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={2} sx={{ pl: 6, fontWeight: 600 }}>
                      Platform
                    </TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell>SHA256</TableCell>
                    <TableCell>GPG</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <PlatformRows mirrorName={mirrorName} version={version.version} />
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
// Main page
// ---------------------------------------------------------------------------

const TerraformBinaryDetailPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, allowedScopes } = useAuth();
  const canManage = isAuthenticated && (allowedScopes.includes('admin') || allowedScopes.includes('mirrors:manage'));

  const [config, setConfig] = useState<PublicMirrorSummary | null>(null);
  // configId is the UUID needed for admin actions (deprecate/delete)
  const [configId, setConfigId] = useState<string | null>(null);
  const [versions, setVersions] = useState<TerraformVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Deprecate dialog
  const [deprecateTarget, setDeprecateTarget] = useState<TerraformVersion | null>(null);
  const [deprecateMessage, setDeprecateMessage] = useState('');
  const [deprecating, setDeprecating] = useState(false);

  // Undeprecate
  const [undeprecating, setUndeprecating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<TerraformVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      // Both endpoints are public — no auth required.
      // The versions response includes config_id (UUID) which we need for admin actions.
      const [publicConfigs, versionsData] = await Promise.all([
        api.listPublicTerraformMirrorConfigs(),
        api.listPublicTerraformVersions(name),
      ]);
      const found = publicConfigs.find((c) => c.name === name);
      if (!found) {
        setError(`Mirror config "${name}" not found.`);
        return;
      }
      setConfig(found);
      // Extract the config UUID from the first version record so we can call
      // admin actions (deprecate / delete / platforms) without hitting admin list.
      const versionRows = versionsData.versions ?? [];
      if (versionRows.length > 0) {
        setConfigId(versionRows[0].config_id);
      }
      // Sort: latest first, then by version desc
      const sorted = [...versionRows].sort((a, b) => {
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1;
        return b.version.localeCompare(a.version, undefined, { numeric: true });
      });
      setVersions(sorted);
    } catch {
      setError(`Failed to load details for "${name}".`);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Deprecate
  // ---------------------------------------------------------------------------

  const handleDeprecate = async () => {
    if (!configId || !deprecateTarget) return;
    setDeprecating(true);
    try {
      await api.deprecateTerraformVersion(configId, deprecateTarget.version);
      setActionSuccess(`Version ${deprecateTarget.version} marked as deprecated. It will not be re-synced.`);
      setDeprecateTarget(null);
      setDeprecateMessage('');
      loadData();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to deprecate version'));
    } finally {
      setDeprecating(false);
    }
  };

  const handleUndeprecate = async (version: TerraformVersion) => {
    if (!configId) return;
    setUndeprecating(true);
    try {
      await api.undeprecateTerraformVersion(configId, version.version);
      setActionSuccess(`Deprecation removed from version ${version.version}.`);
      loadData();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to remove deprecation'));
    } finally {
      setUndeprecating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = async () => {
    if (!configId || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTerraformVersion(configId, deleteTarget.version);
      setActionSuccess(`Version ${deleteTarget.version} deleted.`);
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'Failed to delete version'));
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const toolLabel =
    config?.tool === 'terraform'
      ? 'Terraform (HashiCorp)'
      : config?.tool === 'opentofu'
      ? 'OpenTofu'
      : config?.tool ?? '';

  const toolColor =
    config?.tool === 'terraform' ? 'primary' : config?.tool === 'opentofu' ? 'secondary' : 'default';

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        </Container>
      ) : error ? (
        <Container sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button sx={{ mt: 2 }} startIcon={<ArrowBack />} onClick={() => navigate('/terraform-binaries')}>
            Back to Mirrors
          </Button>
        </Container>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/terraform-binaries" underline="hover" color="inherit">
          Terraform Binaries
        </Link>
        <Typography color="text.primary" fontFamily="monospace">
          {name}
        </Typography>
      </Breadcrumbs>

      {/* Back button + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Tooltip title="Back to mirrors">
          <IconButton size="small" aria-label="Back to binaries" onClick={() => navigate('/terraform-binaries')}>
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography variant="h4" fontFamily="monospace">
          {name}
        </Typography>
        <Chip label={toolLabel} color={toolColor as 'primary' | 'secondary' | 'default'} size="small" variant="outlined" />
        {/* Public endpoint only returns enabled configs; no disabled chip needed */}
      </Box>

      {config?.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {config.description}
        </Typography>
      )}

      {/* Download URL hint */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Mirror download URL: </strong>
          <code>{window.location.origin}/terraform/binaries/{name}/versions/&#123;version&#125;/&#123;os&#125;/&#123;arch&#125;</code>
        </Typography>
      </Alert>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert severity="success" onClose={() => setActionSuccess(null)} sx={{ mb: 2 }}>
          {actionSuccess}
        </Alert>
      )}

      {/* Versions table */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Versions
      </Typography>

      {versions.length === 0 ? (
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
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((v) => (
                <VersionRow
                  key={v.id}
                  version={v}
                  mirrorName={name ?? ''}
                  canManage={canManage}
                  onDeprecate={setDeprecateTarget}
                  onUndeprecate={handleUndeprecate}
                  onDelete={setDeleteTarget}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Deprecate Dialog ---- */}
      <Dialog
        open={!!deprecateTarget}
        onClose={() => { setDeprecateTarget(null); setDeprecateMessage(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Deprecate Version {deprecateTarget?.version}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Marking this version as deprecated prevents it from being re-synced in future sync
            runs. It will remain available for download but will be flagged as deprecated.
          </Typography>
          <TextField
            label="Reason (optional)"
            value={deprecateMessage}
            onChange={(e) => setDeprecateMessage(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText="Explain why this version is deprecated, e.g. security vulnerability."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeprecateTarget(null); setDeprecateMessage(''); }}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={handleDeprecate}
            disabled={deprecating || undeprecating}
          >
            {deprecating ? <CircularProgress size={18} /> : 'Deprecate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Delete Dialog ---- */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Version {deleteTarget?.version}</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete version{' '}
            <strong>{deleteTarget?.version}</strong>? This removes the version record and cannot
            be undone. Any synced binaries in storage will also be removed.
          </Typography>
          {deleteTarget?.is_deprecated === false && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Consider deprecating instead of deleting — deprecated versions are retained for
              download but will not be re-synced.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
      )}
    </Box>
  );
};

export default TerraformBinaryDetailPage;
