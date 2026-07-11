import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Chip,
  Alert,
  Button,
  Stack,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Add from '@mui/icons-material/Add'
import Warning from '@mui/icons-material/Warning'
import EditIcon from '@mui/icons-material/Edit'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import VersionSelector from './VersionSelector'
import ModuleActionsMenu from './ModuleActionsMenu'
import { Module, ModuleVersion } from '../types'

interface ModuleDetailHeaderProps {
  module: Module
  namespace?: string
  name?: string
  system?: string
  canManage: boolean
  versions: ModuleVersion[]
  selectedVersion: ModuleVersion | null
  onSelectVersion: (version: ModuleVersion) => void
  onPublishNewVersion: () => void
  onUpdateDescription: (description: string) => void
  onOpenDeprecateModuleDialog: () => void
  onOpenUndeprecateModuleDialog: () => void
  onOpenDeleteModuleDialog: () => void
}

/**
 * Top-of-page block for ModuleDetailPage: breadcrumbs, module deprecation
 * banner, title row with the publish action, the inline-editable description,
 * and the chips row (namespace/system, version selector, downloads, actions).
 */
const ModuleDetailHeader: React.FC<ModuleDetailHeaderProps> = ({
  module,
  namespace,
  name,
  system,
  canManage,
  versions,
  selectedVersion,
  onSelectVersion,
  onPublishNewVersion,
  onUpdateDescription,
  onOpenDeprecateModuleDialog,
  onOpenUndeprecateModuleDialog,
  onOpenDeleteModuleDialog,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editingDescription, setEditingDescription] = React.useState(false)
  const [editDescription, setEditDescription] = React.useState('')

  return (
    <>
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
            <Button variant="contained" startIcon={<Add />} onClick={onPublishNewVersion}>
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
                    onUpdateDescription(editDescription)
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
                    onUpdateDescription(editDescription)
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
            onSelectVersion={onSelectVersion}
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
            onDeprecateModule={onOpenDeprecateModuleDialog}
            onUndeprecateModule={onOpenUndeprecateModuleDialog}
            onDeleteModule={onOpenDeleteModuleDialog}
          />
        </Stack>
      </Box>
    </>
  )
}

export default ModuleDetailHeader
