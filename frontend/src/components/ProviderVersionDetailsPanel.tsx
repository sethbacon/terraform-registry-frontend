import React from 'react'
import { useTranslation } from 'react-i18next'
import { Paper, Typography, Divider, Alert, Button, Stack } from '@mui/material'
import Delete from '@mui/icons-material/Delete'
import Warning from '@mui/icons-material/Warning'
import Restore from '@mui/icons-material/Restore'
import { ProviderVersion } from '../types'

interface ProviderVersionDetailsPanelProps {
  selectedVersion: ProviderVersion | null
  canManage: boolean
  deprecating: boolean
  onUndeprecate: () => void
  onOpenDeprecateDialog: () => void
  onOpenDeleteVersionDialog: (version: string) => void
}

/**
 * Sidebar "Version <x> Details" panel for ProviderDetailPage: publish metadata,
 * deprecation status and the per-version manage actions. Rendered on both the
 * Overview and Documentation tabs, so it lives in one place.
 */
const ProviderVersionDetailsPanel: React.FC<ProviderVersionDetailsPanelProps> = ({
  selectedVersion,
  canManage,
  deprecating,
  onUndeprecate,
  onOpenDeprecateDialog,
  onOpenDeleteVersionDialog,
}) => {
  const { t } = useTranslation()
  if (!selectedVersion) return null

  return (
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
          <strong>{t('providers.detail.labelPublishedBy')}</strong>{' '}
          {selectedVersion.published_by_name}
        </Typography>
      )}

      {/* Deprecation Status */}
      {selectedVersion.deprecated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{t('providers.detail.chipDeprecated')}</strong>
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

      {canManage && (
        <Stack spacing={1}>
          {selectedVersion.deprecated ? (
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<Restore />}
              onClick={onUndeprecate}
              disabled={deprecating}
              fullWidth
            >
              {deprecating
                ? t('providers.detail.removing')
                : t('providers.detail.removeDeprecation')}
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<Warning />}
              onClick={onOpenDeprecateDialog}
              fullWidth
            >
              {t('providers.detail.deprecateVersion')}
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Delete />}
            onClick={() => onOpenDeleteVersionDialog(selectedVersion.version)}
            fullWidth
          >
            {t('providers.detail.deleteThisVersion')}
          </Button>
        </Stack>
      )}
    </Paper>
  )
}

export default ProviderVersionDetailsPanel
