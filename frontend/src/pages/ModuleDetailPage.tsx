import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import MarkdownRenderer from '../components/MarkdownRenderer'
import {
  Typography,
  Box,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
  Divider,
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
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Add from '@mui/icons-material/Add'
import Warning from '@mui/icons-material/Warning'
import EditIcon from '@mui/icons-material/Edit'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import Page from '../components/Page'
import PublishFromSCMWizard from '../components/PublishFromSCMWizard'
import ModuleDocumentation from '../components/ModuleDocumentation'
import SecurityScanPanel from '../components/SecurityScanPanel'
import ConsumedByPanel from '../components/ConsumedByPanel'
import SCMRepositoryPanel from '../components/SCMRepositoryPanel'
import WebhookEventsPanel from '../components/WebhookEventsPanel'
import VersionDetailsPanel from '../components/VersionDetailsPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import VersionSelector from '../components/VersionSelector'
import ModuleActionsMenu from '../components/ModuleActionsMenu'
import DetailPageSkeleton from '../components/skeletons/DetailPageSkeleton'
import UsageExample from '../components/UsageExample'
import { REGISTRY_HOST } from '../config'
import { useModuleDetail } from '../hooks/useModuleDetail'

const ModuleDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editingDescription, setEditingDescription] = React.useState(false)
  const [editDescription, setEditDescription] = React.useState('')
  const [docTab, setDocTab] = React.useState(0)
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
    deprecationReplacementSource,
    setDeprecationReplacementSource,
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
    scanNotConfigured,
    rescanPending,
    handleRescan,
    moduleDocs,
    docsLoading,
    invalidateSCMLink,
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
    handleUpdateNamespace,
    ociEnabled,
    moduleConsumers,
    suiteActive,
    suiteSiblingUrl,
  } = useModuleDetail()

  const [editingNamespace, setEditingNamespace] = React.useState(false)
  const [editNamespace, setEditNamespace] = React.useState('')

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <DetailPageSkeleton />
      ) : error || !module ? (
        <Page maxWidth="xl">
          <Alert severity="error">{error || 'Module not found'}</Alert>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/modules')} sx={{ mt: 2 }}>
            Back to Modules
          </Button>
        </Page>
      ) : (
        <Page maxWidth="xl">
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
            <Typography
              sx={{
                color: 'text.primary',
              }}
            >
              {namespace}
            </Typography>
            <Typography
              sx={{
                color: 'text.primary',
              }}
            >
              {name}
            </Typography>
            <Typography
              sx={{
                color: 'text.primary',
              }}
            >
              {system}
            </Typography>
            {selectedVersion && (
              <Typography
                sx={{
                  color: 'text.primary',
                }}
              >
                v{selectedVersion.version}
              </Typography>
            )}
          </Breadcrumbs>

          {/* Module Deprecation Banner */}
          {module.deprecated && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This module is deprecated. {module.deprecation_message}
              {module.successor_module && (
                <>
                  {' '}
                  Consider using{' '}
                  <Link
                    component={RouterLink}
                    to={`/modules/${module.successor_module.namespace}/${module.successor_module.name}/${module.successor_module.system}`}
                  >
                    {module.successor_module.namespace}/{module.successor_module.name}/
                    {module.successor_module.system}
                  </Link>{' '}
                  instead.
                </>
              )}
            </Alert>
          )}

          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: 'center',
                }}
              >
                <IconButton
                  aria-label={t('modules.detail.ariaBack')}
                  onClick={() => navigate('/modules')}
                >
                  <ArrowBack />
                </IconButton>
                <Typography variant="h4" component="h1">
                  {name}
                </Typography>
              </Stack>
              {canManage && (
                <Button variant="contained" startIcon={<Add />} onClick={handlePublishNewVersion}>
                  {t('modules.detail.publishNewVersion')}
                </Button>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                mb: 0,
              }}
            >
              {editingDescription ? (
                <>
                  <TextField
                    size="small"
                    fullWidth
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t('modules.detail.placeholderDescription')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateDescription(editDescription)
                        setEditingDescription(false)
                      } else if (e.key === 'Escape') {
                        setEditingDescription(false)
                      }
                    }}
                  />
                  <Tooltip title={t('modules.detail.tooltipSaveDescription')}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        handleUpdateDescription(editDescription)
                        setEditingDescription(false)
                      }}
                      aria-label={t('modules.detail.ariaSaveDescription')}
                    >
                      <Check fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('modules.detail.tooltipCancelEditing')}>
                    <IconButton
                      size="small"
                      onClick={() => setEditingDescription(false)}
                      aria-label={t('modules.detail.ariaCancelEditing')}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {module.description || 'No description available'}
                  </Typography>
                  {canManage && (
                    <Tooltip title={t('modules.detail.tooltipEditDescription')}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditDescription(module.description || '')
                          setEditingDescription(true)
                        }}
                        aria-label={t('modules.detail.ariaEditDescription')}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                mt: 2,
              }}
            >
              <Chip label={`${namespace}/${system}`} />
              <VersionSelector
                versions={versions}
                selectedVersion={selectedVersion}
                onSelectVersion={setSelectedVersion}
                data-testid="module-version-selector"
              />
              {selectedVersion?.deprecated && (
                <Chip
                  label={t('modules.detail.chipDeprecated')}
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
                  setEditDescription(module.description || '')
                  setEditingDescription(true)
                }}
                onDeprecateModule={() => setDeprecateModuleDialogOpen(true)}
                onUndeprecateModule={() => setUndeprecateModuleDialogOpen(true)}
                onDeleteModule={() => setDeleteModuleDialogOpen(true)}
              />
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Main Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Usage Example */}
              <UsageExample
                registryHost={REGISTRY_HOST}
                namespace={namespace || ''}
                name={name || ''}
                system={system || ''}
                version={selectedVersion?.version || ''}
                inputs={moduleDocs?.inputs ?? null}
                onCopied={handleCopySource}
                ociEnabled={ociEnabled}
              />

              {/* Documentation Tabs */}
              <Paper sx={{ p: 3 }}>
                <Tabs value={docTab} onChange={(_, newValue) => setDocTab(newValue)} sx={{ mb: 2 }}>
                  <Tab label="README" />
                  <Tab label={t('modules.detail.tabInputsOutputs')} />
                </Tabs>
                <Divider sx={{ mb: 2 }} />
                {docTab === 0 &&
                  (selectedVersion && selectedVersion.readme ? (
                    <MarkdownRenderer>{selectedVersion.readme}</MarkdownRenderer>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      No README provided for this module version.
                    </Typography>
                  ))}
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
                  {t('modules.detail.sidebarTitle')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ '& > *': { mb: 1 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2">
                      <strong>Namespace:</strong>
                    </Typography>
                    {editingNamespace ? (
                      <>
                        <TextField
                          size="small"
                          value={editNamespace}
                          onChange={(e) => setEditNamespace(e.target.value)}
                          placeholder={t('modules.detail.placeholderNamespace')}
                          autoFocus
                          sx={{ ml: 0.5, flex: 1 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editNamespace.trim()) {
                              handleUpdateNamespace(editNamespace.trim())
                              setEditingNamespace(false)
                            } else if (e.key === 'Escape') {
                              setEditingNamespace(false)
                            }
                          }}
                        />
                        <Tooltip title={t('modules.detail.tooltipSaveNamespace')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              if (editNamespace.trim()) {
                                handleUpdateNamespace(editNamespace.trim())
                                setEditingNamespace(false)
                              }
                            }}
                            aria-label={t('modules.detail.ariaSaveNamespace')}
                          >
                            <Check fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('modules.detail.tooltipCancelNamespace')}>
                          <IconButton
                            size="small"
                            onClick={() => setEditingNamespace(false)}
                            aria-label={t('modules.detail.ariaCancelNamespace')}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2">{namespace}</Typography>
                        {canManage && (
                          <Tooltip title={t('modules.detail.tooltipEditNamespace')}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditNamespace(namespace || '')
                                setEditingNamespace(true)
                              }}
                              aria-label={t('modules.detail.ariaEditNamespace')}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </Box>
                  <Typography variant="body2">
                    <strong>Name:</strong> {name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Provider:</strong> {system}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('modules.detail.labelLatestVersion')}</strong>{' '}
                    {versions.length > 0
                      ? (versions.find((v) => !v.deprecated) ?? versions[0]).version
                      : 'N/A'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>{t('modules.detail.labelTotalDownloads')}</strong>{' '}
                    {module.download_count ?? 0}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Organization:</strong> {module.organization_name || namespace}
                  </Typography>
                  {module.created_by_name && (
                    <Typography variant="body2">
                      <strong>{t('modules.detail.labelCreatedBy')}</strong> {module.created_by_name}
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
                scanNotConfigured={scanNotConfigured}
                onRescan={handleRescan}
                rescanPending={rescanPending}
              />

              <ConsumedByPanel
                active={suiteActive}
                siblingUrl={suiteSiblingUrl}
                consumers={moduleConsumers}
              />
            </Box>
          </Box>

          {/* Delete Module Confirmation Dialog */}
          <ConfirmDialog
            open={deleteModuleDialogOpen}
            onClose={() => setDeleteModuleDialogOpen(false)}
            onConfirm={handleDeleteModule}
            title={t('modules.detail.deleteModuleTitle')}
            description={
              <>
                Are you sure you want to delete the module{' '}
                <strong>
                  {namespace}/{name}/{system}
                </strong>
                ? This will permanently delete all versions and associated files. This action cannot
                be undone.
              </>
            }
            confirmLabel={
              deleting ? t('modules.detail.deletingLabel') : t('modules.detail.deleteModuleTitle')
            }
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
            title={t('modules.detail.deleteVersionTitle')}
            description={
              <>
                Are you sure you want to delete version <strong>{versionToDelete}</strong> of{' '}
                <strong>
                  {namespace}/{name}/{system}
                </strong>
                ? This will permanently delete the version and its associated files. This action
                cannot be undone.
              </>
            }
            confirmLabel={
              deleting ? t('modules.detail.deletingLabel') : t('modules.detail.deleteVersionTitle')
            }
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
            <DialogTitle>{t('modules.detail.dialogLinkRepository')}</DialogTitle>
            <DialogContent>
              {module?.id && (
                <PublishFromSCMWizard
                  moduleId={module.id}
                  moduleSystem={system}
                  onComplete={() => {
                    setScmWizardOpen(false)
                    // Reload SCM link immediately, then poll for versions the
                    // background sync will create over the next several seconds.
                    if (module?.id) invalidateSCMLink(module.id)
                    pollForVersions()
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
              setDeprecateDialogOpen(false)
              setDeprecationMessage('')
              setDeprecationReplacementSource('')
            }}
            onSubmit={async (values) => {
              setDeprecationMessage(values.message ?? '')
              setDeprecationReplacementSource(values.replacement_source ?? '')
              // Defer one tick so the message state is applied before the handler reads it.
              await Promise.resolve()
              handleDeprecateVersion()
            }}
            title={t('modules.detail.deprecateVersionTitle')}
            description={
              <>
                Are you sure you want to deprecate version{' '}
                <strong>{selectedVersion?.version}</strong> of{' '}
                <strong>
                  {namespace}/{name}/{system}
                </strong>
                ? This will mark the version as deprecated, warning users not to use it.
              </>
            }
            severity="warning"
            confirmLabel={
              deprecating
                ? t('modules.detail.deprecatingLabel')
                : t('modules.detail.deprecateVersionConfirm')
            }
            loading={deprecating}
            fields={[
              {
                id: 'message',
                label: t('modules.detail.deprecateVersionMsgLabel'),
                placeholder: 'e.g., Use version 2.0.0 instead - this version has a critical bug',
                multiline: true,
                rows: 3,
                initialValue: deprecationMessage,
              },
              {
                id: 'replacement_source',
                label: t('modules.detail.deprecateVersionReplacementLabel'),
                placeholder: 'e.g., registry.example.com/namespace/module/provider',
                helperText: 'Full registry address of the replacement module (Terraform CLI ≥1.10)',
                initialValue: deprecationReplacementSource,
              },
            ]}
            data-testid="deprecate-version-dialog"
          />

          {/* Deprecate Module Dialog */}
          <ConfirmDialog
            open={deprecateModuleDialogOpen}
            onClose={() => {
              setDeprecateModuleDialogOpen(false)
              setModuleDeprecationMessage('')
              setSuccessorModuleId('')
            }}
            onSubmit={async (values) => {
              setModuleDeprecationMessage(values.message ?? '')
              setSuccessorModuleId(values.successor ?? '')
              await Promise.resolve()
              handleDeprecateModule()
            }}
            title={t('modules.detail.deprecateModuleTitle')}
            description={
              <>
                Are you sure you want to deprecate the module{' '}
                <strong>
                  {namespace}/{name}/{system}
                </strong>
                ? This will mark the entire module as deprecated, warning users not to use it.
              </>
            }
            severity="warning"
            confirmLabel={
              deprecatingModule
                ? t('modules.detail.deprecatingLabel')
                : t('modules.detail.deprecateModuleConfirm')
            }
            loading={deprecatingModule}
            fields={[
              {
                id: 'message',
                label: t('modules.detail.deprecateModuleMsgLabel'),
                placeholder: 'e.g., This module has been replaced by namespace/new-module/system',
                multiline: true,
                rows: 3,
                required: true,
                initialValue: moduleDeprecationMessage,
              },
              {
                id: 'successor',
                label: t('modules.detail.deprecateModuleSuccessorLabel'),
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
            title={t('modules.detail.undeprecateModuleTitle')}
            description={
              <>
                Are you sure you want to remove the deprecation from{' '}
                <strong>
                  {namespace}/{name}/{system}
                </strong>
                ? This will make the module available for normal use again.
              </>
            }
            severity="info"
            confirmLabel={
              deprecatingModule
                ? t('modules.detail.processingLabel')
                : t('modules.detail.undeprecateModuleConfirm')
            }
            loading={deprecatingModule}
            data-testid="undeprecate-module-dialog"
          />
        </Page>
      )}
    </Box>
  )
}

export default ModuleDetailPage
