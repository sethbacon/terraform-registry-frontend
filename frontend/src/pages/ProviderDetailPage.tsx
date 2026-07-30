import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tabs,
  Tab,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Page from '../components/Page'
import ProviderDocsSidebar from '../components/ProviderDocsSidebar'
import ProviderDocContent from '../components/ProviderDocContent'
import ProviderDetailHeader from '../components/ProviderDetailHeader'
import ProviderUsageExample from '../components/ProviderUsageExample'
import ProviderPlatformsTable from '../components/ProviderPlatformsTable'
import ProviderInfoPanel from '../components/ProviderInfoPanel'
import ProviderVersionDetailsPanel from '../components/ProviderVersionDetailsPanel'
import { useProviderDetail } from '../hooks/useProviderDetail'

const ProviderDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    namespace,
    type,
    name,
    canManage,
    provider,
    versions,
    selectedVersion,
    setSelectedVersion,
    loading,
    error,
    copiedSource,
    copiedChecksum,
    deleteProviderDialogOpen,
    setDeleteProviderDialogOpen,
    deleting,
    deleteVersionDialogOpen,
    setDeleteVersionDialogOpen,
    versionToDelete,
    openDeleteVersionDialog,
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    deprecationMessage,
    setDeprecationMessage,
    deprecating,
    activeTab,
    hasDocs,
    docs,
    docsLoading,
    selectedDocCategory,
    selectedDocSlug,
    handleTabChange,
    handleDocSelect,
    githubUrl,
    changelogUrl,
    getTerraformExample,
    handleCopySource,
    handleCopyChecksum,
    handleDeleteProvider,
    handleDeleteVersion,
    handleDeprecateVersion,
    handleUndeprecateVersion,
    handlePublishNewVersion,
  } = useProviderDetail()

  // Sidebar cards are identical on the Overview and Documentation tabs.
  const sidebarCards = provider && (
    <>
      <ProviderInfoPanel
        provider={provider}
        namespace={namespace}
        name={name}
        versions={versions}
        selectedVersion={selectedVersion}
        githubUrl={githubUrl}
        changelogUrl={changelogUrl}
      />
      <ProviderVersionDetailsPanel
        selectedVersion={selectedVersion}
        canManage={canManage}
        deprecating={deprecating}
        onUndeprecate={handleUndeprecateVersion}
        onOpenDeprecateDialog={() => setDeprecateDialogOpen(true)}
        onOpenDeleteVersionDialog={openDeleteVersionDialog}
      />
    </>
  )

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error || !provider ? (
        <Page maxWidth="xl">
          <Alert severity="error">{error || 'Provider not found'}</Alert>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/providers')} sx={{ mt: 2 }}>
            Back to Providers
          </Button>
        </Page>
      ) : (
        <Page maxWidth="xl">
          <ProviderDetailHeader
            provider={provider}
            namespace={namespace}
            name={name}
            versions={versions}
            selectedVersion={selectedVersion}
            canManage={canManage}
            onBack={() => navigate('/providers')}
            onSelectVersion={setSelectedVersion}
            onPublishNewVersion={handlePublishNewVersion}
            onOpenDeleteProviderDialog={() => setDeleteProviderDialogOpen(true)}
          />

          {/* Tabs */}
          {hasDocs && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label={t('providers.detail.tabOverview')} />
                <Tab label={t('providers.detail.tabDocumentation')} />
              </Tabs>
            </Box>
          )}

          {/* Overview Tab */}
          {activeTab === 0 && (
            <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
              {/* Main Content */}
              <Box sx={{ flex: 1 }}>
                <ProviderUsageExample
                  example={getTerraformExample()}
                  copied={copiedSource}
                  onCopySource={handleCopySource}
                />

                <ProviderPlatformsTable
                  platforms={selectedVersion?.platforms ?? []}
                  copiedChecksum={copiedChecksum}
                  onCopyChecksum={handleCopyChecksum}
                />
              </Box>

              {/* Sidebar - Provider Information and Version Details */}
              <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>{sidebarCards}</Box>
            </Box>
          )}

          {/* Documentation Tab */}
          {activeTab === 1 && hasDocs && (
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
              {/* Doc panel */}
              <Paper
                sx={{ display: 'flex', flex: 1, height: '75vh', overflow: 'hidden', minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 300,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <ProviderDocsSidebar
                    providerName={name ?? ''}
                    docs={docs}
                    selectedCategory={selectedDocCategory ?? undefined}
                    selectedSlug={selectedDocSlug ?? undefined}
                    onSelect={handleDocSelect}
                    loading={docsLoading}
                  />
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {selectedDocCategory &&
                  selectedDocSlug &&
                  selectedVersion &&
                  namespace &&
                  type ? (
                    <ProviderDocContent
                      namespace={namespace}
                      type={type}
                      version={selectedVersion.version}
                      category={selectedDocCategory}
                      slug={selectedDocSlug}
                    />
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Select a document from the sidebar.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {/* Info cards — same as overview tab */}
              <Box sx={{ width: 320, flexShrink: 0 }}>{sidebarCards}</Box>
            </Box>
          )}

          {/* Delete Provider Confirmation Dialog */}
          <Dialog
            open={deleteProviderDialogOpen}
            onClose={() => setDeleteProviderDialogOpen(false)}
          >
            <DialogTitle>{t('providers.detail.deleteProviderTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete the provider{' '}
                <strong>
                  {namespace}/{name}
                </strong>
                ? This will permanently delete all versions, platforms, and associated files. This
                action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteProviderDialogOpen(false)} disabled={deleting}>
                {t('providers.detail.cancel')}
              </Button>
              <Button onClick={handleDeleteProvider} color="error" disabled={deleting}>
                {deleting
                  ? t('providers.detail.deleting')
                  : t('providers.detail.deleteProviderTitle')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Version Confirmation Dialog */}
          <Dialog open={deleteVersionDialogOpen} onClose={() => setDeleteVersionDialogOpen(false)}>
            <DialogTitle>{t('providers.detail.deleteVersionTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete version <strong>{versionToDelete}</strong> of{' '}
                <strong>
                  {namespace}/{name}
                </strong>
                ? This will permanently delete all platforms and associated files for this version.
                This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteVersionDialogOpen(false)} disabled={deleting}>
                {t('providers.detail.cancel')}
              </Button>
              <Button onClick={handleDeleteVersion} color="error" disabled={deleting}>
                {deleting
                  ? t('providers.detail.deleting')
                  : t('providers.detail.deleteVersionTitle')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Deprecate Version Dialog */}
          <Dialog open={deprecateDialogOpen} onClose={() => setDeprecateDialogOpen(false)}>
            <DialogTitle>{t('providers.detail.deprecateVersionTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                Are you sure you want to deprecate version{' '}
                <strong>{selectedVersion?.version}</strong> of{' '}
                <strong>
                  {namespace}/{name}
                </strong>
                ? This will mark the version as deprecated, warning users not to use it.
              </DialogContentText>
              <TextField
                autoFocus
                label={t('providers.detail.labelDeprecationMsg')}
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
                  setDeprecateDialogOpen(false)
                  setDeprecationMessage('')
                }}
                disabled={deprecating}
              >
                {t('providers.detail.cancel')}
              </Button>
              <Button onClick={handleDeprecateVersion} color="warning" disabled={deprecating}>
                {deprecating
                  ? t('providers.detail.deprecating')
                  : t('providers.detail.deprecateVersionTitle')}
              </Button>
            </DialogActions>
          </Dialog>
        </Page>
      )}
    </Box>
  )
}

export default ProviderDetailPage
