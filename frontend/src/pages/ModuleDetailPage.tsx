import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';
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
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Warning from '@mui/icons-material/Warning';
import EditIcon from '@mui/icons-material/Edit';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import PublishFromSCMWizard from '../components/PublishFromSCMWizard';
import ModuleDocumentation from '../components/ModuleDocumentation';
import SecurityScanPanel from '../components/SecurityScanPanel';
import SCMRepositoryPanel from '../components/SCMRepositoryPanel';
import WebhookEventsPanel from '../components/WebhookEventsPanel';
import VersionDetailsPanel from '../components/VersionDetailsPanel';
import { useModuleDetail } from '../hooks/useModuleDetail';

const ModuleDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [editingDescription, setEditingDescription] = React.useState(false);
  const [editDescription, setEditDescription] = React.useState('');
  const [docTab, setDocTab] = React.useState(0);
  const {
    namespace,
    name,
    system,
    isAuthenticated,
    canManage,
    module,
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    error,
    copiedSource,
    deleteModuleDialogOpen,
    setDeleteModuleDialogOpen,
    deleting,
    deleteVersionDialogOpen,
    setDeleteVersionDialogOpen,
    versionToDelete,
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    deprecationMessage,
    setDeprecationMessage,
    deprecating,
    deprecateModuleDialogOpen,
    setDeprecateModuleDialogOpen,
    moduleDeprecationMessage,
    setModuleDeprecationMessage,
    successorModuleId,
    setSuccessorModuleId,
    undeprecateModuleDialogOpen,
    setUndeprecateModuleDialogOpen,
    deprecatingModule,
    scmLink,
    scmLinkLoaded,
    scmWizardOpen,
    setScmWizardOpen,
    scmSyncing,
    scmUnlinking,
    webhookEvents,
    webhookEventsLoaded,
    webhookEventsLoading,
    webhookEventsExpanded,
    setWebhookEventsExpanded,
    moduleScan,
    scanLoading,
    scanNotFound,
    moduleDocs,
    docsLoading,
    loadSCMLink,
    loadWebhookEvents,
    pollForVersions,
    handleSCMSync,
    handleSCMUnlink,
    handleCopySource,
    handlePublishNewVersion,
    handleDeleteModule,
    handleDeleteVersion,
    openDeleteVersionDialog,
    handleDeprecateVersion,
    handleUndeprecateVersion,
    handleDeprecateModule,
    handleUndeprecateModule,
    handleUpdateDescription,
    getTerraformExample,
  } = useModuleDetail();

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error || !module ? (
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
      ) : (
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

          {/* Module Deprecation Banner */}
          {module.deprecated && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This module is deprecated. {module.deprecation_message}
              {module.successor_module && (
                <> Consider using <Link
                  component={RouterLink}
                  to={`/modules/${module.successor_module.namespace}/${module.successor_module.name}/${module.successor_module.system}`}
                >
                  {module.successor_module.namespace}/{module.successor_module.name}/{module.successor_module.system}
                </Link> instead.</>
              )}
            </Alert>
          )}

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <IconButton aria-label="Back to modules" onClick={() => navigate('/modules')}>
                  <ArrowBack />
                </IconButton>
                <Typography variant="h4" component="h1">
                  {name}
                </Typography>
              </Stack>
              {canManage && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handlePublishNewVersion}
                >
                  Publish New Version
                </Button>
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0 }}>
              {editingDescription ? (
                <>
                  <TextField
                    size="small"
                    fullWidth
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Module description"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateDescription(editDescription);
                        setEditingDescription(false);
                      } else if (e.key === 'Escape') {
                        setEditingDescription(false);
                      }
                    }}
                  />
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => {
                      handleUpdateDescription(editDescription);
                      setEditingDescription(false);
                    }}
                    aria-label="Save description"
                  >
                    <Check fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setEditingDescription(false)}
                    aria-label="Cancel editing"
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <>
                  <Typography variant="body1" color="text.secondary">
                    {module.description || 'No description available'}
                  </Typography>
                  {canManage && (
                    <Tooltip title="Edit description">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditDescription(module.description || '');
                          setEditingDescription(true);
                        }}
                        aria-label="Edit description"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
            </Stack>
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
              {canManage && (
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
              {canManage && !module.deprecated && (
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  startIcon={<Warning />}
                  onClick={() => setDeprecateModuleDialogOpen(true)}
                >
                  Deprecate Module
                </Button>
              )}
              {canManage && module.deprecated && (
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => setUndeprecateModuleDialogOpen(true)}
                >
                  Undeprecate Module
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
                    <IconButton aria-label="Copy source URL" onClick={handleCopySource} size="small">
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

              {/* Documentation Tabs */}
              <Paper sx={{ p: 3 }}>
                <Tabs
                  value={docTab}
                  onChange={(_, newValue) => setDocTab(newValue)}
                  sx={{ mb: 2 }}
                >
                  <Tab label="README" />
                  <Tab label="Inputs / Outputs" />
                </Tabs>
                <Divider sx={{ mb: 2 }} />
                {docTab === 0 && (
                  selectedVersion && selectedVersion.readme ? (
                    <MarkdownRenderer>{selectedVersion.readme}</MarkdownRenderer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No README provided for this module version.
                    </Typography>
                  )
                )}
                {docTab === 1 && (
                  <ModuleDocumentation moduleDocs={moduleDocs} docsLoading={docsLoading} />
                )}
              </Paper>
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

              <SCMRepositoryPanel
                isAuthenticated={isAuthenticated}
                scmLinkLoaded={scmLinkLoaded}
                scmLink={scmLink}
                scmSyncing={scmSyncing}
                scmUnlinking={scmUnlinking}
                onSync={handleSCMSync}
                onUnlink={handleSCMUnlink}
                onOpenWizard={() => setScmWizardOpen(true)}
              />

              <WebhookEventsPanel
                isAuthenticated={isAuthenticated}
                scmLink={scmLink}
                moduleId={module?.id}
                webhookEvents={webhookEvents}
                webhookEventsLoaded={webhookEventsLoaded}
                webhookEventsLoading={webhookEventsLoading}
                webhookEventsExpanded={webhookEventsExpanded}
                onToggleExpanded={() => setWebhookEventsExpanded(!webhookEventsExpanded)}
                onLoadEvents={loadWebhookEvents}
              />

              <VersionDetailsPanel
                selectedVersion={selectedVersion}
                canManage={canManage}
                deprecating={deprecating}
                onUndeprecate={handleUndeprecateVersion}
                onOpenDeprecateDialog={() => setDeprecateDialogOpen(true)}
                onOpenDeleteVersionDialog={openDeleteVersionDialog}
              />

              <SecurityScanPanel
                canManage={canManage}
                selectedVersion={selectedVersion}
                moduleScan={moduleScan}
                scanLoading={scanLoading}
                scanNotFound={scanNotFound}
              />
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

          {/* Deprecate Module Dialog */}
          <Dialog
            open={deprecateModuleDialogOpen}
            onClose={() => setDeprecateModuleDialogOpen(false)}
          >
            <DialogTitle>Deprecate Module</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                Are you sure you want to deprecate the module <strong>{namespace}/{name}/{system}</strong>?
                This will mark the entire module as deprecated, warning users not to use it.
              </DialogContentText>
              <TextField
                autoFocus
                label="Deprecation Message"
                placeholder="e.g., This module has been replaced by namespace/new-module/system"
                fullWidth
                multiline
                rows={3}
                value={moduleDeprecationMessage}
                onChange={(e) => setModuleDeprecationMessage(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Successor Module ID (optional)"
                placeholder="e.g., namespace/name/system"
                fullWidth
                value={successorModuleId}
                onChange={(e) => setSuccessorModuleId(e.target.value)}
                helperText="If this module has a replacement, enter its ID to help users migrate."
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setDeprecateModuleDialogOpen(false);
                  setModuleDeprecationMessage('');
                  setSuccessorModuleId('');
                }}
                disabled={deprecatingModule}
              >
                Cancel
              </Button>
              <Button onClick={handleDeprecateModule} color="warning" disabled={deprecatingModule}>
                {deprecatingModule ? 'Deprecating...' : 'Deprecate Module'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Undeprecate Module Confirmation Dialog */}
          <Dialog
            open={undeprecateModuleDialogOpen}
            onClose={() => setUndeprecateModuleDialogOpen(false)}
          >
            <DialogTitle>Undeprecate Module</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to remove the deprecation from <strong>{namespace}/{name}/{system}</strong>?
                This will make the module available for normal use again.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUndeprecateModuleDialogOpen(false)} disabled={deprecatingModule}>
                Cancel
              </Button>
              <Button onClick={handleUndeprecateModule} color="success" disabled={deprecatingModule}>
                {deprecatingModule ? 'Processing...' : 'Undeprecate Module'}
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      )}
    </Box>
  );
};

export default ModuleDetailPage;
