import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Warning from '@mui/icons-material/Warning';
import Restore from '@mui/icons-material/Restore';
import SCMIcon from '@mui/icons-material/AccountTree';
import UnlinkIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import api, { apiClient } from '../services/api';
import { Module, ModuleVersion } from '../types';
import type { ModuleSCMLink } from '../types/scm';
import { useAuth } from '../contexts/AuthContext';
import { REGISTRY_HOST } from '../config';
import PublishFromSCMWizard from '../components/PublishFromSCMWizard';

const ModuleDetailPage: React.FC = () => {
  const { namespace, name, system } = useParams<{
    namespace: string;
    name: string;
    system: string;
  }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [module, setModule] = useState<Module | null>(null);
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModuleVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSource, setCopiedSource] = useState(false);
  const [deleteModuleDialogOpen, setDeleteModuleDialogOpen] = useState(false);
  const [deleteVersionDialogOpen, setDeleteVersionDialogOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false);
  const [deprecationMessage, setDeprecationMessage] = useState('');
  const [deprecating, setDeprecating] = useState(false);

  // SCM linking state
  const [scmLink, setScmLink] = useState<ModuleSCMLink | null>(null);
  const [scmLinkLoaded, setScmLinkLoaded] = useState(false);
  const [scmWizardOpen, setScmWizardOpen] = useState(false);
  const [scmSyncing, setScmSyncing] = useState(false);
  const [scmUnlinking, setScmUnlinking] = useState(false);

  useEffect(() => {
    loadModuleDetails();
  }, [namespace, name, system]);

  const loadModuleDetails = async () => {
    if (!namespace || !name || !system) return;

    try {
      setLoading(true);
      setError(null);

      // Use getModule API which returns module with embedded versions
      // Also fetch versions from the Terraform protocol endpoint for readme/published_at
      const [moduleData, versionsData] = await Promise.all([
        api.getModule(namespace, name, system),
        api.getModuleVersions(namespace, name, system),
      ]);

      if (!moduleData) {
        setError('Module not found');
        return;
      }

      setModule(moduleData);
      if (moduleData?.id && isAuthenticated) {
        loadSCMLink(moduleData.id);
      }

      // Merge version data - getModule has basic version info, getModuleVersions has readme/published_at
      const protocolVersions = versionsData.modules?.[0]?.versions || [];
      const moduleVersions = moduleData.versions || [];

      // Use protocol versions as they have more complete data (readme, published_at)
      // Fall back to module versions if protocol versions not available
      const rawVersions: ModuleVersion[] = protocolVersions.length > 0 ? protocolVersions : moduleVersions;

      // Sort by semver descending so latest is always first
      const mergedVersions = [...rawVersions].sort((a, b) => {
        const parseParts = (v: string): [number, number, number] => {
          const clean = v.replace(/^v/, '').split('-')[0];
          const [maj = 0, min = 0, pat = 0] = clean.split('.').map(Number);
          return [maj, min, pat];
        };
        const [aMaj, aMin, aPat] = parseParts(a.version);
        const [bMaj, bMin, bPat] = parseParts(b.version);
        return bMaj !== aMaj ? bMaj - aMaj : bMin !== aMin ? bMin - aMin : bPat - aPat;
      });
      setVersions(mergedVersions);

      // Select latest version by default (preserve current selection if reloading)
      if (mergedVersions.length > 0) {
        const currentVersion = selectedVersion?.version;
        const matchingVersion = currentVersion
          ? mergedVersions.find((v: ModuleVersion) => v.version === currentVersion)
          : null;
        setSelectedVersion(matchingVersion || mergedVersions[0]);
      }
    } catch (err: any) {
      console.error('Failed to load module details:', err);
      if (err?.response?.status === 404) {
        setError('Module not found');
      } else {
        setError('Failed to load module details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSCMLink = async (moduleId: string) => {
    try {
      const link = await apiClient.getModuleSCMInfo(moduleId);
      setScmLink(link);
    } catch {
      setScmLink(null); // 404 = not linked, which is fine
    } finally {
      setScmLinkLoaded(true);
    }
  };

  const handleSCMUnlink = async () => {
    if (!module?.id) return;
    try {
      setScmUnlinking(true);
      await apiClient.unlinkModuleFromSCM(module.id);
      setScmLink(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to unlink repository');
    } finally {
      setScmUnlinking(false);
    }
  };

  // Poll for updated versions after an async sync by reloading at 2 s, 5 s, and 12 s.
  // The sync runs in the background (202) so a single immediate reload is not enough.
  const pollForVersions = () => {
    [2000, 5000, 12000].forEach(delay => {
      setTimeout(() => loadModuleDetails(), delay);
    });
  };

  const handleSCMSync = async () => {
    if (!module?.id) {
      console.error('Cannot sync: module.id is not available');
      return;
    }
    console.log('Triggering manual sync for module:', module.id);
    try {
      setScmSyncing(true);
      await apiClient.triggerManualSync(module.id);
      setError(null);
      // Start polling so newly imported versions appear without manual refresh.
      pollForVersions();
    } catch (err: any) {
      console.error('Sync failed:', err);
      setError(err?.response?.data?.error || 'Failed to trigger sync');
    } finally {
      setScmSyncing(false);
    }
  };

  const handleCopySource = () => {
    if (!module || !selectedVersion) return;

    const source = `${namespace}/${name}/${system}`;
    navigator.clipboard.writeText(source);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2000);
  };

  const handlePublishNewVersion = () => {
    navigate('/admin/upload/module', {
      state: {
        moduleData: {
          namespace,
          name,
          provider: system,
        },
      },
    });
  };

  const handleDeleteModule = async () => {
    if (!namespace || !name || !system) return;

    try {
      setDeleting(true);
      await api.deleteModule(namespace, name, system);
      navigate('/modules');
    } catch (err: any) {
      console.error('Failed to delete module:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to delete module. Please try again.';
      setError(message);
    } finally {
      setDeleting(false);
      setDeleteModuleDialogOpen(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!namespace || !name || !system || !versionToDelete) return;

    try {
      setDeleting(true);
      await api.deleteModuleVersion(namespace, name, system, versionToDelete);
      // Reload the module details
      await loadModuleDetails();
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
    if (!namespace || !name || !system || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.deprecateModuleVersion(namespace, name, system, selectedVersion.version, deprecationMessage || undefined);
      // Reload the module details
      await loadModuleDetails();
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

  const handleUndeprecateVersion = async () => {
    if (!namespace || !name || !system || !selectedVersion) return;

    try {
      setDeprecating(true);
      await api.undeprecateModuleVersion(namespace, name, system, selectedVersion.version);
      // Reload the module details
      await loadModuleDetails();
    } catch (err: any) {
      console.error('Failed to remove deprecation:', err);
      const message = err?.response?.data?.error || err?.message || 'Failed to remove deprecation. Please try again.';
      setError(message);
    } finally {
      setDeprecating(false);
    }
  };

  const getTerraformExample = () => {
    if (!module || !selectedVersion) return '';

    return `module "${name}" {
  source  = "${REGISTRY_HOST}/${namespace}/${name}/${system}"
  version = "${selectedVersion.version}"

  # Add your module variables here
}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !module) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Module not found'}</Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/modules')}
          sx={{ mt: 2 }}
        >
          Back to Modules
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
          onClick={() => navigate('/modules')}
          sx={{ cursor: 'pointer' }}
        >
          Modules
        </Link>
        <Typography color="text.primary">{namespace}</Typography>
        <Typography color="text.primary">{name}</Typography>
        <Typography color="text.primary">{system}</Typography>
        {selectedVersion && (
          <Typography color="text.primary">v{selectedVersion.version}</Typography>
        )}
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={() => navigate('/modules')}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1">
            {name}
          </Typography>
          </Stack>
          {isAuthenticated && (
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
          {module.description || 'No description available'}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap">
          <Chip label={`${namespace}/${system}`} />
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
          <Chip label={`${module.download_count ?? 0} downloads`} />
          {isAuthenticated && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Delete />}
              onClick={() => setDeleteModuleDialogOpen(true)}
            >
              Delete Module
            </Button>
          )}
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

          {/* README */}
          {selectedVersion && selectedVersion.readme && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                README
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box
                sx={(theme) => ({
                  '& h1': { fontSize: '2rem', fontWeight: 600, mt: 2, mb: 1 },
                  '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 2, mb: 1 },
                  '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
                  '& p': { mb: 2 },
                  '& code': {
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    color: theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                  '& pre': {
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    color: theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
                    padding: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                  },
                  '& pre code': {
                    backgroundColor: 'transparent',
                    padding: 0,
                  },
                  '& ul, & ol': { pl: 3, mb: 2 },
                  '& li': { mb: 1 },
                  '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
                  '& th, & td': {
                    border: theme.palette.mode === 'dark' ? '1px solid #444' : '1px solid #ddd',
                    padding: '8px 12px',
                    textAlign: 'left',
                  },
                  '& th': {
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    fontWeight: 600
                  },
                })}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedVersion.readme}</ReactMarkdown>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Sidebar - Module Information and Version Details */}
        <Box sx={{ width: { xs: '100%', md: 350 } }}>
          {/* Module Information */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Module Information
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
                <strong>Provider:</strong> {system}
              </Typography>
              <Typography variant="body2">
                <strong>Latest Version:</strong> {versions.length > 0 ? (versions.find(v => !v.deprecated) ?? versions[0]).version : 'N/A'}
              </Typography>
              <Typography variant="body2">
                <strong>Total Downloads:</strong> {module.download_count ?? 0}
              </Typography>
              <Typography variant="body2">
                <strong>Organization:</strong> {module.organization_name || namespace}
              </Typography>
              {module.created_by_name && (
                <Typography variant="body2">
                  <strong>Created By:</strong> {module.created_by_name}
                </Typography>
              )}
            </Box>
          </Paper>

          {/* SCM Repository Panel */}
          {isAuthenticated && scmLinkLoaded && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <SCMIcon fontSize="small" color="action" />
                <Typography variant="h6">Source Repository</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {scmLink ? (
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>{scmLink.repository_owner}/{scmLink.repository_name}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Branch: {scmLink.default_branch}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Tag pattern: <code>{scmLink.tag_pattern || 'v*'}</code>
                  </Typography>
                  <Chip
                    label={scmLink.auto_publish_enabled ? 'Auto-publish on' : 'Auto-publish off'}
                    size="small"
                    color={scmLink.auto_publish_enabled ? 'success' : 'default'}
                    variant="outlined"
                    sx={{ mb: 1.5, fontSize: '0.7rem' }}
                  />
                  {scmLink.last_sync_at && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                      Last synced: {new Date(scmLink.last_sync_at).toLocaleString()}
                    </Typography>
                  )}
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={scmSyncing ? <CircularProgress size={14} /> : <SyncIcon />}
                      onClick={handleSCMSync}
                      disabled={scmSyncing}
                      fullWidth
                    >
                      {scmSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={scmUnlinking ? <CircularProgress size={14} /> : <UnlinkIcon />}
                      onClick={handleSCMUnlink}
                      disabled={scmUnlinking}
                      fullWidth
                    >
                      {scmUnlinking ? 'Unlinking...' : 'Unlink Repository'}
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Not linked to a repository. Link one to enable automatic version publishing.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SCMIcon />}
                    onClick={() => setScmWizardOpen(true)}
                    fullWidth
                  >
                    Link Repository
                  </Button>
                </Box>
              )}
            </Paper>
          )}

          {/* Selected Version Details */}
          {selectedVersion && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Version {selectedVersion.version} Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Published:</strong>{' '}
                {(selectedVersion.published_at || selectedVersion.created_at)
                  ? new Date(selectedVersion.published_at || selectedVersion.created_at!).toLocaleDateString()
                  : 'N/A'}
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
                      <> on {new Date(selectedVersion.deprecated_at).toLocaleDateString()}</>
                    )}
                  </Typography>
                  {selectedVersion.deprecation_message && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {selectedVersion.deprecation_message}
                    </Typography>
                  )}
                </Alert>
              )}

              {isAuthenticated && (
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
              )}
            </Paper>
          )}
        </Box>
      </Box>

      {/* Delete Module Confirmation Dialog */}
      <Dialog
        open={deleteModuleDialogOpen}
        onClose={() => setDeleteModuleDialogOpen(false)}
      >
        <DialogTitle>Delete Module</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the module <strong>{namespace}/{name}/{system}</strong>?
            This will permanently delete all versions and associated files.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteModuleDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteModule} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Module'}
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
            <strong>{namespace}/{name}/{system}</strong>?
            This will permanently delete the version and its associated files.
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

      {/* SCM Link Wizard Dialog */}
      <Dialog
        open={scmWizardOpen}
        onClose={() => setScmWizardOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Link Repository</DialogTitle>
        <DialogContent>
          {module?.id && (
            <PublishFromSCMWizard
              moduleId={module.id}
              moduleSystem={system}
              onComplete={() => {
                setScmWizardOpen(false);
                // Reload SCM link immediately, then poll for versions the
                // background sync will create over the next several seconds.
                if (module?.id) loadSCMLink(module.id);
                pollForVersions();
              }}
              onCancel={() => setScmWizardOpen(false)}
            />
          )}
        </DialogContent>
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
            <strong>{namespace}/{name}/{system}</strong>?
            This will mark the version as deprecated, warning users not to use it.
          </DialogContentText>
          <TextField
            autoFocus
            label="Deprecation Message (optional)"
            placeholder="e.g., Use version 2.0.0 instead - this version has a critical bug"
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

export default ModuleDetailPage;
