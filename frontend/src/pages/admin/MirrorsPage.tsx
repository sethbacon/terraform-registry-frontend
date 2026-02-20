import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InfoIcon from '@mui/icons-material/Info';
import { apiClient } from '../../services/api';
import {
  type MirrorConfiguration,
  type MirrorSyncStatus,
  type CreateMirrorConfigRequest,
  parseMirrorConfig,
} from '../../types/mirror';

const MirrorsPage: React.FC = () => {
  const [mirrors, setMirrors] = useState<MirrorConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingMirror, setEditingMirror] = useState<MirrorConfiguration | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorConfiguration | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<MirrorSyncStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusMirrorId, setStatusMirrorId] = useState<string | null>(null);

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

  useEffect(() => {
    loadMirrors();
  }, []);

  // Auto-open the Add Mirror dialog when navigated here with ?action=add
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setCreateDialogOpen(true);
    }
  }, [searchParams]);

  // Poll for status updates when dialog is open and sync is running
  useEffect(() => {
    if (!statusDialogOpen || !statusMirrorId || !mirrorStatus?.current_sync) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const status = await apiClient.getMirrorStatus(statusMirrorId);
        setMirrorStatus(status);
        
        // Stop polling if sync completed
        if (!status.current_sync) {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling mirror status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [statusDialogOpen, statusMirrorId, mirrorStatus?.current_sync]);

  const loadMirrors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.listMirrors();
      setMirrors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load mirrors');
      console.error('Error loading mirrors:', err);
    } finally {
      setLoading(false);
    }
  };

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
      await apiClient.createMirror(data as CreateMirrorConfigRequest);
      setCreateDialogOpen(false);
      resetForm();
      setSuccess('Mirror configuration created successfully');
      await loadMirrors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create mirror');
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
      await apiClient.updateMirror(editingMirror.id, data);
      setEditingMirror(null);
      resetForm();
      setSuccess('Mirror configuration updated successfully');
      await loadMirrors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update mirror');
    }
  };

  const handleDelete = async () => {
    if (!mirrorToDelete) return;
    try {
      setError(null);
      await apiClient.deleteMirror(mirrorToDelete.id);
      setDeleteConfirmOpen(false);
      setMirrorToDelete(null);
      setSuccess('Mirror configuration deleted successfully');
      await loadMirrors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete mirror');
    }
  };

  const handleTriggerSync = async (mirror: MirrorConfiguration) => {
    try {
      setError(null);
      await apiClient.triggerMirrorSync(mirror.id);
      setSuccess(`Sync triggered for "${mirror.name}"`);
      await loadMirrors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger sync');
    }
  };

  const handleViewStatus = async (mirror: MirrorConfiguration) => {
    try {
      setStatusLoading(true);
      setStatusDialogOpen(true);
      setStatusMirrorId(mirror.id);
      const status = await apiClient.getMirrorStatus(mirror.id);
      setMirrorStatus(status);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load mirror status');
      setStatusDialogOpen(false);
      setStatusMirrorId(null);
    } finally {
      setStatusLoading(false);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Provider Mirrors</Typography>
          <Typography variant="body2" color="textSecondary">
            Configure upstream registry mirroring for providers
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadMirrors}
            sx={{ mr: 1 }}
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
        {mirrors.map((mirror) => {
          const parsed = parseMirrorConfig(mirror);
          return (
            <Grid item xs={12} md={6} key={mirror.id}>
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
                    Last sync: {formatDate(mirror.last_sync_at)}
                  </Typography>

                  {mirror.last_sync_error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <Typography variant="caption">{mirror.last_sync_error}</Typography>
                    </Alert>
                  )}
                </CardContent>

                <CardActions>
                  <Tooltip title="Trigger Sync">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleTriggerSync(mirror)}
                      disabled={mirror.last_sync_status === 'in_progress'}
                    >
                      <SyncIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Status">
                    <IconButton
                      size="small"
                      onClick={() => handleViewStatus(mirror)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(mirror)}
                    >
                      <EditIcon />
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
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          );
        })}

        {mirrors.length === 0 && !loading && (
          <Grid item xs={12}>
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

      {/* Status Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setMirrorStatus(null);
          setStatusMirrorId(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <span>Mirror Status</span>
            {statusMirrorId && (
              <Tooltip title="Refresh status">
                <IconButton
                  size="small"
                  onClick={async () => {
                    if (statusMirrorId) {
                      try {
                        const status = await apiClient.getMirrorStatus(statusMirrorId);
                        setMirrorStatus(status);
                      } catch (err) {
                        console.error('Error refreshing status:', err);
                      }
                    }
                  }}
                  disabled={statusLoading}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {statusLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : mirrorStatus ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                {mirrorStatus.mirror_config.name}
              </Typography>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Current Status
                </Typography>
                {mirrorStatus.current_sync ? (
                  <Box>
                    <LinearProgress sx={{ mb: 1 }} />
                    <Typography variant="body2">
                      Sync in progress since {formatDate(mirrorStatus.current_sync.started_at)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2">No sync currently running</Typography>
                )}
              </Box>

              {mirrorStatus.next_scheduled && (
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Next scheduled sync: {formatDate(mirrorStatus.next_scheduled)}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Recent Sync History
              </Typography>
              <List dense>
                {mirrorStatus.recent_syncs.length > 0 ? (
                  mirrorStatus.recent_syncs.map((sync) => (
                    <ListItem key={sync.id}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {sync.status === 'success' && <CheckCircleIcon color="success" fontSize="small" />}
                            {sync.status === 'failed' && <ErrorIcon color="error" fontSize="small" />}
                            {sync.status === 'running' && <SyncIcon color="info" fontSize="small" />}
                            <Typography variant="body2">
                              {sync.status.charAt(0).toUpperCase() + sync.status.slice(1)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            {formatDate(sync.started_at)}
                            {sync.status === 'success' && ` - ${sync.providers_synced} providers synced`}
                            {sync.status === 'failed' && sync.error_message && ` - ${sync.error_message}`}
                          </>
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No sync history available" />
                  </ListItem>
                )}
              </List>
            </Box>
          ) : (
            <Typography>No status available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setStatusDialogOpen(false);
              setMirrorStatus(null);
              setStatusMirrorId(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MirrorsPage;
