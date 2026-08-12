import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import SyncIcon from '@mui/icons-material/Sync'
import type {
  TerraformMirrorConfig,
  TerraformMirrorStatusResponse,
} from '../../../types/terraform_mirror'
import { SyncStatusChip, ToolChip } from './StatusChips'

/**
 * One mirror configuration's summary tile plus the buttons that open each of the
 * page's dialog flows; `canManage` hides the mutating controls (#609).
 */
const MirrorConfigCard: React.FC<{
  config: TerraformMirrorConfig
  status?: TerraformMirrorStatusResponse
  onEdit: (c: TerraformMirrorConfig) => void
  onDelete: (c: TerraformMirrorConfig) => void
  onSync: (c: TerraformMirrorConfig) => void
  onViewVersions: (c: TerraformMirrorConfig) => void
  onViewHistory: (c: TerraformMirrorConfig) => void
  syncing: boolean
  canManage: boolean
}> = ({
  config,
  status,
  onEdit,
  onDelete,
  onSync,
  onViewVersions,
  onViewHistory,
  syncing,
  canManage,
}) => {
  const { t } = useTranslation()
  return (
    <Card variant="outlined">
      <CardContent>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
            {config.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
            <ToolChip tool={config.tool} />
            <Chip
              label={
                config.enabled
                  ? t('admin.terraformMirror.chipEnabled')
                  : t('admin.terraformMirror.chipDisabled')
              }
              color={config.enabled ? 'success' : 'default'}
              size="small"
            />
          </Box>
        </Box>

        {config.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 1,
            }}
          >
            {config.description}
          </Typography>
        )}

        <Typography
          variant="body2"
          noWrap
          sx={{
            color: 'text.secondary',
          }}
        >
          {config.upstream_url}
        </Typography>

        {status && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              mt: 1,
            }}
          >
            <Chip
              size="small"
              label={t('admin.terraformMirror.chipVersionCount', { count: status.version_count })}
              variant="outlined"
            />
            <Chip
              size="small"
              label={t('admin.terraformMirror.chipPlatformCount', { count: status.platform_count })}
              variant="outlined"
            />
            {status.pending_count > 0 && (
              <Chip
                size="small"
                label={t('admin.terraformMirror.chipPendingCount', { count: status.pending_count })}
                variant="outlined"
                color="warning"
              />
            )}
          </Box>
        )}

        <Box sx={{ mt: 1.5 }}>
          {config.last_sync_status ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SyncStatusChip status={config.last_sync_status} />
              {config.last_sync_at && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {new Date(config.last_sync_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.terraformMirror.neverSynced')}
            </Typography>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Box>
          <Tooltip title={t('admin.terraformMirror.tooltipViewDetails')}>
            <Button size="small" onClick={() => onViewVersions(config)}>
              {t('admin.terraformMirror.viewDetails')}
            </Button>
          </Tooltip>
          <Tooltip title={t('admin.terraformMirror.tooltipViewHistory')}>
            <IconButton
              size="small"
              aria-label={t('admin.terraformMirror.ariaViewHistory')}
              onClick={() => onViewHistory(config)}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {canManage && (
          <Box>
            <Tooltip title={t('admin.terraformMirror.tooltipTriggerSync')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('admin.terraformMirror.ariaSyncMirror')}
                  onClick={() => onSync(config)}
                  disabled={syncing || !config.enabled}
                >
                  <SyncIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('admin.terraformMirror.tooltipEditConfig')}>
              <IconButton
                size="small"
                aria-label={t('admin.terraformMirror.ariaEditMirror')}
                onClick={() => onEdit(config)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('admin.terraformMirror.tooltipDeleteMirror')}>
              <IconButton
                size="small"
                aria-label={t('admin.terraformMirror.ariaDeleteMirror')}
                color="error"
                onClick={() => onDelete(config)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardActions>
    </Card>
  )
}

export default MirrorConfigCard
