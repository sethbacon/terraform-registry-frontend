import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import { Typography, Box, Breadcrumbs, Link, Chip, Alert, Tooltip, IconButton } from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import type { PublicMirrorSummary } from '../hooks/useTerraformBinaryDetail'

interface TerraformBinaryDetailHeaderProps {
  name?: string
  config: PublicMirrorSummary | null
  onBack: () => void
}

/**
 * Breadcrumbs, title, tool chip, description and mirror-URL hint for
 * TerraformBinaryDetailPage.
 */
const TerraformBinaryDetailHeader: React.FC<TerraformBinaryDetailHeaderProps> = ({
  name,
  config,
  onBack,
}) => {
  const { t } = useTranslation()

  const toolLabel =
    config?.tool === 'terraform'
      ? 'Terraform (HashiCorp)'
      : config?.tool === 'opentofu'
        ? 'OpenTofu'
        : (config?.tool ?? '')

  const toolColor =
    config?.tool === 'terraform' ? 'primary' : config?.tool === 'opentofu' ? 'secondary' : 'default'

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/terraform-binaries" underline="hover" color="inherit">
          Terraform Binaries
        </Link>
        <Typography
          sx={{
            color: 'text.primary',
            fontFamily: 'monospace',
          }}
        >
          {name}
        </Typography>
      </Breadcrumbs>

      {/* Back button + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Tooltip title={t('terraformBinaries.detail.tooltipBackToMirrors')}>
          <IconButton
            size="small"
            aria-label={t('terraformBinaries.detail.ariaBackToBinaries')}
            onClick={onBack}
          >
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Typography
          variant="h4"
          sx={{
            fontFamily: 'monospace',
          }}
        >
          {name}
        </Typography>
        <Chip
          label={toolLabel}
          color={toolColor as 'primary' | 'secondary' | 'default'}
          size="small"
          variant="outlined"
        />
        {/* Public endpoint only returns enabled configs; no disabled chip needed */}
      </Box>

      {config?.description && (
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          {config.description}
        </Typography>
      )}

      {/* Download URL hint */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>{t('terraformBinaries.detail.mirrorUrlLabel')}</strong>
          <code>
            {window.location.origin}/terraform/binaries/{name}
            /versions/&#123;version&#125;/&#123;os&#125;/&#123;arch&#125;
          </code>
        </Typography>
      </Alert>
    </>
  )
}

export default TerraformBinaryDetailHeader
