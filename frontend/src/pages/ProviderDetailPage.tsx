import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import Warning from '@mui/icons-material/Warning';
import Restore from '@mui/icons-material/Restore';
import Add from '@mui/icons-material/Add';
import api from '../services/api';
import { Provider, ProviderVersion } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { REGISTRY_HOST } from '../config';

const ProviderDetailPage: React.FC = () => {
  const { namespace, type } = useParams<{
    namespace: string;
    type: string;
  }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // Use 'type' as the name for display
  const name = type;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [versions, setVersions] = useState<ProviderVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ProviderVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false);
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false);
  const [deprecationMessage, setDeprecationMessage] = useState('');
  const [deprecating, setDeprecating] = useState(false);

  useEffect(() => {
    loadProviderDetails();
  }, [namespace, type]);

  const loadProviderDetails = async () => {
    if (!namespace || !type) return;

    try {
      setLoading(true);
      setError(null);

      // Use searchProviders with namespace filter and then find by type
      const [providerData, versionsData] = await Promise.all([
        api.searchProviders({ query: type, limit: 100 }), // Search with type as query
        api.getProviderVersions(namespace, type),
      ]);

      // Filter results to find exact match for namespace/type
      const matchingProvider = providerData.providers.find(
        (p: Provider) => p.namespace === namespace && p.type === type
      );

      if (!matchingProvider) {
        setError('Provider not found');
        return;
      }

      setProvider(matchingProvider);
      
      // Backend returns { versions: [...] } directly
      const versions = versionsData.versions || [];
      setVersions(versions);
      
      if (versions.length > 0) {
        setSelectedVersion(versions[0]);
      }
    } catch (err) {
      console.error('Failed to load provider details:', err);
      setError('Failed to load provider details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySource = () => {
    if (!provider || !selectedVersion) return;
    
    const source = `${namespace}/${name}`;
    navigator.clipboard.writeText(source);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2000);
  };

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    setTimeout(() => setCopiedChecksum(null), 2000);
  };

  const handleDeleteProvider = async () => {
    if (!namespace || !type) return;

    try {
      setDeleting(true);
      await api.deleteProvider(namespace, type);
      navigate('/providers');
    } catch (err: any) {
      console.error('Failed to delete provider:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to delete provider. Please try again.';
      setError(message);
    } finally {
      setDeleting(false);
      setDeleteProviderDialogOpen(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!namespace || !type || !versionToDelete) return;

    try {
      setDeleting(true);
      await api.deleteProviderVersion(namespace, type, versionToDelete);
      // Reload the provider details
      await loadProviderDetails();
      setVersionToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete version:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to delete version. Please try again.';
      setError(message);
    } finally {
      setDeleting(false);
      setDeleteVersionDialogOpen(false);
    }
  };

  const openDeleteVersionDialog = (version: string) => {
    setVersionToDelete(version);
    setDeleteVersionDialogOpen(true);
  };

  const handleDeprecateVersion = async () => {
    if (!namespace || !type || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.deprecateProviderVersion(namespace, type, selectedVersion.version, deprecationMessage || undefined);
      // Reload the provider details
      await loadProviderDetails();
      setDeprecationMessage('');
    } catch (err: any) {
      console.error('Failed to deprecate version:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to deprecate version. Please try again.';
      setError(message);
    } finally {
      setDeprecating(false);
      setDeprecateDialogOpen(false);
    }
  };

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/provider', {
      state: {
        providerData: { namespace, type },
        method: 'upload' as const,
      },
    });
  };

  const handleUndeprecateVersion = async () => {
    if (!namespace || !type || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.undeprecateProviderVersion(namespace, type, selectedVersion.version);
      // Reload the provider details
      await loadProviderDetails();
    } catch (err: any) {
      console.error('Failed to remove deprecation:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to remove deprecation. Please try again.';
      setError(message);
    } finally {
      setDeprecating(false);
    }
  };

  const getTerraformExample = () => {
    if (!provider || !selectedVersion) return '';

    return `terraform {
  required_providers {
    ${name} = {
      source  = "${REGISTRY_HOST}/${namespace}/${name}"
      version = "${selectedVersion.version}"
    }
  }
}

provider "${name}" {
  # Configure provider settings here
}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !provider) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Provider not found'}</Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/providers')}
          sx={{ mt: 2 }}
        >
          Back to Providers
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/providers')}
          sx={{ cursor: 'pointer' }}
        >
          Providers
        </Link>
        <Typography color="text.primary">{namespace}</Typography>
        <Typography color="text.primary">{name}</Typography>
        {selectedVersion && (
          <Typography color="text.primary">v{selectedVersion.version}</Typography>
        )}
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton onClick={() => navigate('/providers')}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h4" component="h1">
                {name}
              </Typography>
            </Stack>
            {isAuthenticated && !provider.source && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handlePublishNewVersion}
              >
                Publish New Version
              </Button>
            )}
          </Stack>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {provider.description || 'No description available'}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Chip label={namespace} />
          {provider.source && (
            <Chip
              label="Network Mirrored"
              color="info"
              size="small"
              variant="outlined"
            />
          )}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              value={selectedVersion?.version || ''}
              onChange={(e) => {
                const version = versions.find(v => v.version === e.target.value);
                if (version) setSelectedVersion(version);
              }}
              displayEmpty
            >
              {versions.map((v) => (
                <MenuItem
                  key={v.id}
                  value={v.version}
                  sx={{ color: v.deprecated ? 'text.disabled' : 'inherit' }}
                >
                  v{v.version}
                  {versions.find(ver => !ver.deprecated)?.id === v.id ? ' (latest)' : ''}
                  {v.deprecated ? ' [DEPRECATED]' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedVersion?.deprecated && (
            <Chip
              label="Deprecated"
              color="warning"
              size="small"
              icon={<Warning />}
            />
          )}
          <Chip label={`${provider.download_count ?? 0} downloads`} />
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Delete />}
            onClick={() => setDeleteProviderDialogOpen(true)}
          >
            Delete Provider
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Main Content */}
        <Box sx={{ flex: 1 }}>
          {/* Usage Example */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Usage Example</Typography>
              <Tooltip title={copiedSource ? 'Copied!' : 'Copy source'}>
                <IconButton onClick={handleCopySource} size="small">
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Stack>
            <Box
              component="pre"
              sx={{
                p: 2,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                color: (theme) => theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              <code>{getTerraformExample()}</code>
            </Box>
          </Paper>

          {/* Platforms Table */}
          {selectedVersion && selectedVersion.platforms && selectedVersion.platforms.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Available Platforms
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>OS</TableCell>
                      <TableCell>Architecture</TableCell>
                      <TableCell>SHA256 Sum</TableCell>
                      <TableCell width="50px"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedVersion.platforms.map((platform) => (
                      <TableRow key={platform.id}>
                        <TableCell>{platform.os}</TableCell>
                        <TableCell>{platform.arch}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                          {platform.shasum || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {platform.shasum && (
                            <Tooltip title={copiedChecksum === platform.shasum ? "Copied!" : "Copy checksum"}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopyChecksum(platform.shasum)}
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>

        {/* Sidebar - Provider Information and Version Details */}
        <Box sx={{ width: { xs: '100%', md: 350 } }}>
          {/* Provider Information */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Provider Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ '& > *': { mb: 1 } }}>
              <Typography variant="body2">
                <strong>Namespace:</strong> {namespace}
              </Typography>
              <Typography variant="body2">
                <strong>Name:</strong> {name}
              </Typography>
              <Typography variant="body2">
                <strong>Latest Version:</strong> {versions.length > 0 ? (versions.find(v => !v.deprecated) ?? versions[0]).version : 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Total Downloads:</strong> {provider.download_count ?? 0}
              </Typography>
              <Typography variant="body2">
                <strong>Organization:</strong> {provider.organization_name || 'N/A'}
              </Typography>
              {provider.created_by_name && (
                <Typography variant="body2">
                  <strong>Created By:</strong> {provider.created_by_name}
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Selected Version Details */}
          {selectedVersion && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Version {selectedVersion.version} Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Published:</strong>{' '}
                {new Date(selectedVersion.published_at).toISOString().split('T')[0]}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Downloads:</strong> {selectedVersion.download_count ?? 0}
              </Typography>
              {selectedVersion.published_by_name && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Published By:</strong> {selectedVersion.published_by_name}
                </Typography>
              )}

              {/* Deprecation Status */}
              {selectedVersion.deprecated && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Deprecated</strong>
                    {selectedVersion.deprecated_at && (
                      <> on {new Date(selectedVersion.deprecated_at).toISOString().split('T')[0]}</>
                    )}
                  </Typography>
                  {selectedVersion.deprecation_message && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {selectedVersion.deprecation_message}
                    </Typography>
                  )}
                </Alert>
              )}

              <Stack spacing={1}>
                {selectedVersion.deprecated ? (
                  <Button
                    variant="outlined"
                    color="success"
                    size="small"
                    startIcon={<Restore />}
                    onClick={handleUndeprecateVersion}
                    disabled={deprecating}
                    fullWidth
                  >
                    {deprecating ? 'Removing Deprecation...' : 'Remove Deprecation'}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    startIcon={<Warning />}
                    onClick={() => setDeprecateDialogOpen(true)}
                    fullWidth
                  >
                    Deprecate Version
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Delete />}
                  onClick={() => openDeleteVersionDialog(selectedVersion.version)}
                  fullWidth
                >
                  Delete This Version
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Delete Provider Confirmation Dialog */}
      <Dialog
        open={deleteProviderDialogOpen}
        onClose={() => setDeleteProviderDialogOpen(false)}
      >
        <DialogTitle>Delete Provider</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the provider <strong>{namespace}/{name}</strong>?
            This will permanently delete all versions, platforms, and associated files.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProviderDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteProvider} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Provider'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Version Confirmation Dialog */}
      <Dialog
        open={deleteVersionDialogOpen}
        onClose={() => setDeleteVersionDialogOpen(false)}
      >
        <DialogTitle>Delete Version</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete version <strong>{versionToDelete}</strong> of{' '}
            <strong>{namespace}/{name}</strong>?
            This will permanently delete all platforms and associated files for this version.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteVersionDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteVersion} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Version'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deprecate Version Dialog */}
      <Dialog
        open={deprecateDialogOpen}
        onClose={() => setDeprecateDialogOpen(false)}
      >
        <DialogTitle>Deprecate Version</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to deprecate version <strong>{selectedVersion?.version}</strong> of{' '}
            <strong>{namespace}/{name}</strong>?
            This will mark the version as deprecated, warning users not to use it.
          </DialogContentText>
          <TextField
            autoFocus
            label="Deprecation Message (optional)"
            placeholder="e.g., Use version 5.0.0 instead - this version has a critical bug"
            fullWidth
            multiline
            rows={3}
            value={deprecationMessage}
            onChange={(e) => setDeprecationMessage(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeprecateDialogOpen(false);
              setDeprecationMessage('');
            }}
            disabled={deprecating}
          >
            Cancel
          </Button>
          <Button onClick={handleDeprecateVersion} color="warning" disabled={deprecating}>
            {deprecating ? 'Deprecating...' : 'Deprecate Version'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProviderDetailPage;
