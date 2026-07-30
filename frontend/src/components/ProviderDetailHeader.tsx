import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Chip,
  Button,
  Stack,
  IconButton,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Delete from '@mui/icons-material/Delete'
import Warning from '@mui/icons-material/Warning'
import Add from '@mui/icons-material/Add'
import { Provider, ProviderVersion } from '../types'

interface ProviderDetailHeaderProps {
  provider: Provider
  namespace?: string
  name?: string
  versions: ProviderVersion[]
  selectedVersion: ProviderVersion | null
  canManage: boolean
  onBack: () => void
  onSelectVersion: (version: ProviderVersion) => void
  onPublishNewVersion: () => void
  onOpenDeleteProviderDialog: () => void
}

/**
 * Breadcrumbs + title block for ProviderDetailPage: provider name, description,
 * namespace/mirror chips, version selector, download count and the manage
 * actions (publish new version, delete provider).
 */
const ProviderDetailHeader: React.FC<ProviderDetailHeaderProps> = ({
  provider,
  namespace,
  name,
  versions,
  selectedVersion,
  canManage,
  onBack,
  onSelectVersion,
  onPublishNewVersion,
  onOpenDeleteProviderDialog,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component="button" variant="body1" onClick={onBack} sx={{ cursor: 'pointer' }}>
          Providers
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

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          spacing={2}
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
            <IconButton aria-label={t('providers.detail.ariaBack')} onClick={onBack}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1">
              {name}
            </Typography>
          </Stack>
          {canManage && !provider.source && (
            <Button variant="contained" startIcon={<Add />} onClick={onPublishNewVersion}>
              {t('providers.detail.publishNewVersion')}
            </Button>
          )}
        </Stack>
        <Typography
          variant="body1"
          gutterBottom
          sx={{
            color: 'text.secondary',
          }}
        >
          {provider.description || 'No description available'}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            mt: 2,
          }}
        >
          <Chip label={namespace} />
          {provider.source && (
            <Chip
              label={t('providers.networkMirroredBadge')}
              color="info"
              size="small"
              variant="outlined"
            />
          )}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              value={selectedVersion?.version || ''}
              onChange={(e) => {
                const version = versions.find((v) => v.version === e.target.value)
                if (version) onSelectVersion(version)
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
                  {versions.find((ver) => !ver.deprecated)?.id === v.id ? ' (latest)' : ''}
                  {v.deprecated ? ' [DEPRECATED]' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedVersion?.deprecated && (
            <Chip
              label={t('providers.detail.chipDeprecated')}
              color="warning"
              size="small"
              icon={<Warning />}
            />
          )}
          <Chip label={`${provider.download_count ?? 0} downloads`} />
          {canManage && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<Delete />}
              onClick={onOpenDeleteProviderDialog}
            >
              {t('providers.detail.deleteProvider')}
            </Button>
          )}
        </Stack>
      </Box>
    </>
  )
}

export default ProviderDetailHeader
