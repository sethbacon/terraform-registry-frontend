import React from 'react'
import { useTranslation } from 'react-i18next'
import { Paper, Typography, Divider, Alert, Button, Stack } from '@mui/material'
import Delete from '@mui/icons-material/Delete'
import Warning from '@mui/icons-material/Warning'
import Restore from '@mui/icons-material/Restore'
import { ModuleVersion } from '../types'

interface VersionDetailsPanelProps {
  selectedVersion: ModuleVersion | null
  canManage: boolean
  deprecating: boolean
  onUndeprecate: () => void
  onOpenDeprecateDialog: () => void
  onOpenDeleteVersionDialog: (version: string) => void
}

const VersionDetailsPanel: React.FC<VersionDetailsPanelProps> = ({
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
        {t('versionDetailsPanel.title', { version: selectedVersion.version })}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="body2" sx={{ mb: 2 }}>
        <strong>{t('versionDetailsPanel.published')}</strong>{' '}
        {selectedVersion.published_at || selectedVersion.created_at
          ? new Date(
              selectedVersion.published_at || selectedVersion.created_at!,
            ).toLocaleDateString()
          : t('versionDetailsPanel.na')}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        <strong>{t('versionDetailsPanel.downloads')}</strong> {selectedVersion.download_count ?? 0}
      </Typography>
      {selectedVersion.published_by_name && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>{t('versionDetailsPanel.publishedBy')}</strong>{' '}
          {selectedVersion.published_by_name}
        </Typography>
      )}

      {/* Deprecation Status */}
      {selectedVersion.deprecated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{t('versionDetailsPanel.deprecated')}</strong>
            {selectedVersion.deprecated_at && (
              <>
                {' '}
                {t('versionDetailsPanel.deprecatedOn', {
                  date: new Date(selectedVersion.deprecated_at).toLocaleDateString(),
                })}
              </>
            )}
          </Typography>
          {(selectedVersion.deprecation_message || selectedVersion.deprecation?.reason) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {selectedVersion.deprecation?.reason ?? selectedVersion.deprecation_message}
            </Typography>
          )}
          {(selectedVersion.replacement_source || selectedVersion.deprecation?.link) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>{t('versionDetailsPanel.replacement')}</strong>{' '}
              {selectedVersion.deprecation?.link ?? selectedVersion.replacement_source}
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
                ? t('versionDetailsPanel.removingDeprecation')
                : t('versionDetailsPanel.removeDeprecation')}
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
              {t('versionDetailsPanel.deprecateVersion')}
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
            {t('versionDetailsPanel.deleteThisVersion')}
          </Button>
        </Stack>
      )}
    </Paper>
  )
}

export default VersionDetailsPanel
