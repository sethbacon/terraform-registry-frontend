import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Page from '../components/Page'
import TerraformBinaryDetailHeader from '../components/TerraformBinaryDetailHeader'
import TerraformBinaryVersionsTable from '../components/TerraformBinaryVersionsTable'
import { useTerraformBinaryDetail } from '../hooks/useTerraformBinaryDetail'

const TerraformBinaryDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    name,
    canManage,
    config,
    versions,
    loading,
    error,
    actionError,
    setActionError,
    actionSuccess,
    setActionSuccess,
    deprecateTarget,
    setDeprecateTarget,
    deprecateMessage,
    setDeprecateMessage,
    deprecating,
    undeprecating,
    closeDeprecateDialog,
    deleteTarget,
    setDeleteTarget,
    deleting,
    handleDeprecate,
    handleUndeprecate,
    handleDelete,
  } = useTerraformBinaryDetail()

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Page>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        </Page>
      ) : error ? (
        <Page>
          <Alert severity="error">{error}</Alert>
          <Button
            sx={{ mt: 2 }}
            startIcon={<ArrowBack />}
            onClick={() => navigate('/terraform-binaries')}
          >
            Back to Mirrors
          </Button>
        </Page>
      ) : (
        <Page maxWidth="lg">
          <TerraformBinaryDetailHeader
            name={name}
            config={config}
            onBack={() => navigate('/terraform-binaries')}
          />

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

          <TerraformBinaryVersionsTable
            versions={versions}
            mirrorName={name ?? ''}
            tool={config?.tool ?? ''}
            canManage={canManage}
            onDeprecate={setDeprecateTarget}
            onUndeprecate={handleUndeprecate}
            onDelete={setDeleteTarget}
          />

          {/* ---- Deprecate Dialog ---- */}
          <Dialog open={!!deprecateTarget} onClose={closeDeprecateDialog} maxWidth="sm" fullWidth>
            <DialogTitle>
              {t('terraformBinaries.detail.deprecateDialogTitleBefore')}
              {deprecateTarget?.version}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('terraformBinaries.detail.deprecateDialogBody')}
              </Typography>
              <TextField
                label={t('terraformBinaries.detail.labelReasonOptional')}
                value={deprecateMessage}
                onChange={(e) => setDeprecateMessage(e.target.value)}
                fullWidth
                multiline
                rows={2}
                helperText={t('terraformBinaries.detail.helpReason')}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDeprecateDialog}>{t('terraformBinaries.detail.cancel')}</Button>
              <Button
                color="warning"
                variant="contained"
                onClick={handleDeprecate}
                disabled={deprecating || undeprecating}
              >
                {deprecating ? (
                  <CircularProgress size={18} />
                ) : (
                  t('terraformBinaries.detail.deprecate')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ---- Delete Dialog ---- */}
          <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
            <DialogTitle>
              {t('terraformBinaries.detail.deleteDialogTitleBefore')}
              {deleteTarget?.version}
            </DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete version <strong>{deleteTarget?.version}</strong>?
                This removes the version record and cannot be undone. Any synced binaries in storage
                will also be removed.
              </Typography>
              {deleteTarget?.is_deprecated === false && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Consider deprecating instead of deleting — deprecated versions are retained for
                  download but will not be re-synced.
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteTarget(null)}>
                {t('terraformBinaries.detail.cancel')}
              </Button>
              <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
                {deleting ? <CircularProgress size={18} /> : t('terraformBinaries.detail.delete')}
              </Button>
            </DialogActions>
          </Dialog>
        </Page>
      )}
    </Box>
  )
}

export default TerraformBinaryDetailPage
