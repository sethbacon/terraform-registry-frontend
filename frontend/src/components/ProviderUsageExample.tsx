import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ContentCopy from '@mui/icons-material/ContentCopy'

interface ProviderUsageExampleProps {
  /** Rendered HCL snippet for the selected provider version. */
  example: string
  /** True while the "Copied!" tooltip is showing. */
  copied: boolean
  onCopySource: () => void
}

/**
 * "Usage Example" card for ProviderDetailPage: the `required_providers` block a
 * consumer pastes into their configuration, with a copy-source action.
 */
const ProviderUsageExample: React.FC<ProviderUsageExampleProps> = ({
  example,
  copied,
  onCopySource,
}) => {
  const { t } = useTranslation()

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6">{t('providers.detail.usageExample')}</Typography>
        <Tooltip title={copied ? 'Copied!' : t('providers.detail.copySourceUrl')}>
          <IconButton
            aria-label={t('providers.detail.copySourceUrl')}
            onClick={onCopySource}
            size="small"
          >
            <ContentCopy />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        component="pre"
        sx={{
          p: 2,
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5'),
          color: (theme) => (theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e'),
          borderRadius: 1,
          overflow: 'auto',
          fontSize: '0.875rem',
        }}
      >
        <code>{example}</code>
      </Box>
    </Paper>
  )
}

export default ProviderUsageExample
