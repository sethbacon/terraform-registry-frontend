import React from 'react'
import { useTranslation } from 'react-i18next'
import { Paper, Typography, Divider, Box, Button } from '@mui/material'
import GitHub from '@mui/icons-material/GitHub'
import { Provider, ProviderVersion } from '../types'

interface ProviderInfoPanelProps {
  provider: Provider
  namespace?: string
  name?: string
  versions: ProviderVersion[]
  selectedVersion: ProviderVersion | null
  /** Upstream repository link, or null for providers published directly. */
  githubUrl: string | null
  /** Release notes link for the selected version, or null when unavailable. */
  changelogUrl: string | null
}

/**
 * Sidebar "Provider Information" panel for ProviderDetailPage. Rendered on both
 * the Overview and Documentation tabs, so it lives in one place.
 */
const ProviderInfoPanel: React.FC<ProviderInfoPanelProps> = ({
  provider,
  namespace,
  name,
  versions,
  selectedVersion,
  githubUrl,
  changelogUrl,
}) => {
  const { t } = useTranslation()

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('providers.detail.sidebarProviderInfo')}
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
          <strong>{t('providers.detail.labelLatestVersion')}</strong>{' '}
          {versions.length > 0
            ? (versions.find((v) => !v.deprecated) ?? versions[0]).version
            : 'N/A'}
        </Typography>
        <Typography variant="body2">
          <strong>{t('providers.detail.labelTotalDownloads')}</strong>{' '}
          {provider.download_count ?? 0}
        </Typography>
        {githubUrl && (
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GitHub fontSize="small" />}
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
            >
              GitHub Repository
            </Button>
          </Box>
        )}
        {changelogUrl && (
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              href={changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
            >
              Changelog v{selectedVersion?.version}
            </Button>
          </Box>
        )}
        {provider.created_by_name && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>{t('providers.detail.labelCreatedBy')}</strong> {provider.created_by_name}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

export default ProviderInfoPanel
