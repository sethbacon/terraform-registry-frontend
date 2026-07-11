import React from 'react'
import { useTranslation } from 'react-i18next'
import { Paper, Typography, Divider, Box, IconButton, Tooltip, TextField } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { Module, ModuleVersion } from '../types'

interface ModuleInfoPanelProps {
  module: Module
  namespace?: string
  name?: string
  system?: string
  versions: ModuleVersion[]
  canManage: boolean
  onUpdateNamespace: (namespace: string) => void
}

/**
 * Sidebar "Module Information" panel for ModuleDetailPage: namespace (inline
 * editable for managers), name, provider, latest version, downloads, and
 * ownership metadata.
 */
const ModuleInfoPanel: React.FC<ModuleInfoPanelProps> = ({
  module,
  namespace,
  name,
  system,
  versions,
  canManage,
  onUpdateNamespace,
}) => {
  const { t } = useTranslation()
  const [editingNamespace, setEditingNamespace] = React.useState(false)
  const [editNamespace, setEditNamespace] = React.useState('')

  return (
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
                    onUpdateNamespace(editNamespace.trim())
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
                      onUpdateNamespace(editNamespace.trim())
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
          <strong>{t('modules.detail.labelTotalDownloads')}</strong> {module.download_count ?? 0}
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
  )
}

export default ModuleInfoPanel
