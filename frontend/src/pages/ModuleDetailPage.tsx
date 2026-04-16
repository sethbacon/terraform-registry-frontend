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
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Add from '@mui/icons-material/Add';
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
import ConfirmDialog from '../components/ConfirmDialog';
import VersionSelector from '../components/VersionSelector';
import ModuleActionsMenu from '../components/ModuleActionsMenu';
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
              <VersionSelector
                versions={versions}
                selectedVersion={selectedVersion}
                onSelectVersion={setSelectedVersion}
                data-testid="module-version-selector"
              />
              {selectedVersion?.deprecated && (
                <Chip
                  label="Deprecated"
                  color="warning"
                  size="small"
                  icon={<Warning />}
                />
              )}
              <Chip label={`${module.download_count ?? 0} downloads`} />
              <ModuleActionsMenu
                canManage={canManage}
                deprecated={!!module.deprecated}
                onEditDescription={() => {
                  setEditDescription(module.description || '');
                  setEditingDescription(true);
                }}
                onDeprecateModule={() => setDeprecateModuleDialogOpen(true)}
                onUndeprecateModule={() => setUndeprecateModuleDialogOpen(true)}
                onDeleteModule={() => setDeleteModuleDialogOpen(true)}
              />
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
          <ConfirmDialog
            open={deleteModuleDialogOpen}
            onClose={() => setDeleteModuleDialogOpen(false)}
            onConfirm={handleDeleteModule}
            title="Delete Module"
            description={
              <>
                Are you sure you want to delete the module <strong>{namespace}/{name}/{system}</strong>?
                This will permanently delete all versions and associated files.
                This action cannot be undone.
              </>
            }
            confirmLabel={deleting ? 'Deleting...' : 'Delete Module'}
            severity="error"
            typeToConfirmText={`${namespace}/${name}/${system}`}
            loading={deleting}
            data-testid="delete-module-dialog"
          />

          {/* Delete Version Confirmation Dialog */}
          <ConfirmDialog
            open={deleteVersionDialogOpen}
            onClose={() => setDeleteVersionDialogOpen(false)}
            onConfirm={handleDeleteVersion}
            title="Delete Version"
            description={
              <>
                Are you sure you want to delete version <strong>{versionToDelete}</strong> of{' '}
                <strong>{namespace}/{name}/{system}</strong>?
                This will permanently delete the version and its associated files.
                This action cannot be undone.
              </>
            }
            confirmLabel={deleting ? 'Deleting...' : 'Delete Version'}
            severity="error"
            typeToConfirmText={versionToDelete || undefined}
            loading={deleting}
            data-testid="delete-version-dialog"
          />

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
          <ConfirmDialog
            open={deprecateDialogOpen}
            onClose={() => {
              setDeprecateDialogOpen(false);
              setDeprecationMessage('');
            }}
            onSubmit={async (values) => {
              setDeprecationMessage(values.message ?? '');
              // Defer one tick so the message state is applied before the handler reads it.
              await Promise.resolve();
              handleDeprecateVersion();
            }}
            title="Deprecate Version"
            description={
              <>
                Are you sure you want to deprecate version <strong>{selectedVersion?.version}</strong> of{' '}
                <strong>{namespace}/{name}/{system}</strong>?
                This will mark the version as deprecated, warning users not to use it.
              </>
            }
            severity="warning"
            confirmLabel={deprecating ? 'Deprecating...' : 'Deprecate Version'}
            loading={deprecating}
            fields={[
              {
                id: 'message',
                label: 'Deprecation Message (optional)',
                placeholder: 'e.g., Use version 2.0.0 instead - this version has a critical bug',
                multiline: true,
                rows: 3,
                initialValue: deprecationMessage,
              },
            ]}
            data-testid="deprecate-version-dialog"
          />

          {/* Deprecate Module Dialog */}
          <ConfirmDialog
            open={deprecateModuleDialogOpen}
            onClose={() => {
              setDeprecateModuleDialogOpen(false);
              setModuleDeprecationMessage('');
              setSuccessorModuleId('');
            }}
            onSubmit={async (values) => {
              setModuleDeprecationMessage(values.message ?? '');
              setSuccessorModuleId(values.successor ?? '');
              await Promise.resolve();
              handleDeprecateModule();
            }}
            title="Deprecate Module"
            description={
              <>
                Are you sure you want to deprecate the module <strong>{namespace}/{name}/{system}</strong>?
                This will mark the entire module as deprecated, warning users not to use it.
              </>
            }
            severity="warning"
            confirmLabel={deprecatingModule ? 'Deprecating...' : 'Deprecate Module'}
            loading={deprecatingModule}
            fields={[
              {
                id: 'message',
                label: 'Deprecation Message',
                placeholder: 'e.g., This module has been replaced by namespace/new-module/system',
                multiline: true,
                rows: 3,
                required: true,
                initialValue: moduleDeprecationMessage,
              },
              {
                id: 'successor',
                label: 'Successor Module ID (optional)',
                placeholder: 'e.g., namespace/name/system',
                helperText: 'If this module has a replacement, enter its ID to help users migrate.',
                initialValue: successorModuleId,
              },
            ]}
            data-testid="deprecate-module-dialog"
          />

          {/* Undeprecate Module Confirmation Dialog */}
          <ConfirmDialog
            open={undeprecateModuleDialogOpen}
            onClose={() => setUndeprecateModuleDialogOpen(false)}
            onConfirm={handleUndeprecateModule}
            title="Undeprecate Module"
            description={
              <>
                Are you sure you want to remove the deprecation from <strong>{namespace}/{name}/{system}</strong>?
                This will make the module available for normal use again.
              </>
            }
            severity="info"
            confirmLabel={deprecatingModule ? 'Processing...' : 'Undeprecate Module'}
            loading={deprecatingModule}
            data-testid="undeprecate-module-dialog"
          />
        </Container>
      )}
    </Box>
  );
};

export default ModuleDetailPage;
