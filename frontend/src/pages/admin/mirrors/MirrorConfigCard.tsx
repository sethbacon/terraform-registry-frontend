import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
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
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SyncIcon from '@mui/icons-material/Sync'
import { formatDate } from '../../../utils'
import { type MirrorConfiguration, parseMirrorConfig } from '../../../types/mirror'
import { MirrorSyncStatusChip } from './StatusChips'

/**
 * One provider mirror's summary tile — its filters, schedule, last sync and any
 * sync error — plus the buttons that open each of the page's dialog flows.
 *
 * `canManage` hides the mutating half of the actions (sync, edit, delete) so a
 * mirrors:read viewer is not shown controls that only fail once clicked (#609);
 * View Details and History stay visible to everyone the route admits.
 */
const MirrorConfigCard: React.FC<{
  mirror: MirrorConfiguration
  canManage: boolean
  onViewDetails: (m: MirrorConfiguration) => void
  onViewHistory: (m: MirrorConfiguration) => void
  onTriggerSync: (m: MirrorConfiguration) => void
  onEdit: (m: MirrorConfiguration) => void
  onDelete: (m: MirrorConfiguration) => void
}> = ({ mirror, canManage, onViewDetails, onViewHistory, onTriggerSync, onEdit, onDelete }) => {
  const { t } = useTranslation()
  const parsed = parseMirrorConfig(mirror)

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <CloudDownloadIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Box
            sx={{
              flexGrow: 1,
            }}
          >
            <Typography variant="h6">{mirror.name}</Typography>
            <Typography variant="body2" color="textSecondary" noWrap>
              {mirror.upstream_registry_url}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0.5,
            }}
          >
            <Chip
              label={mirror.enabled ? t('admin.mirrors.enabled') : t('admin.mirrors.disabled')}
              color={mirror.enabled ? 'success' : 'default'}
              size="small"
            />
            <MirrorSyncStatusChip status={mirror.last_sync_status} />
          </Box>
        </Box>

        {mirror.description && (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{
              marginBottom: '16px',
            }}
          >
            {mirror.description}
          </Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            mb: 1,
          }}
        >
          {parsed.namespaceFilters.length > 0 && (
            <Tooltip title={t('admin.mirrors.tooltipNamespaceFilters')}>
              <Chip
                size="small"
                label={t('admin.mirrors.chipNamespaces', {
                  list: parsed.namespaceFilters.join(', '),
                })}
                variant="outlined"
              />
            </Tooltip>
          )}
          {parsed.providerFilters.length > 0 && (
            <Tooltip title={t('admin.mirrors.tooltipProviderFilters')}>
              <Chip
                size="small"
                label={t('admin.mirrors.chipProviders', {
                  list: parsed.providerFilters.join(', '),
                })}
                variant="outlined"
              />
            </Tooltip>
          )}
          {mirror.version_filter && (
            <Tooltip title={t('admin.mirrors.tooltipVersionFilter')}>
              <Chip
                size="small"
                label={t('admin.mirrors.chipVersions', {
                  value: mirror.version_filter,
                })}
                variant="outlined"
                color="primary"
              />
            </Tooltip>
          )}
          {parsed.platformFilters.length > 0 && (
            <Tooltip title={t('admin.mirrors.tooltipPlatformFilters')}>
              <Chip
                size="small"
                label={t('admin.mirrors.chipPlatforms', {
                  list: parsed.platformFilters.join(', '),
                })}
                variant="outlined"
                color="secondary"
              />
            </Tooltip>
          )}
        </Box>

        <Typography
          variant="caption"
          color="textSecondary"
          sx={{
            display: 'block',
          }}
        >
          <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
          {t('admin.mirrors.syncInterval', { hours: mirror.sync_interval_hours })}
        </Typography>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{
            display: 'block',
          }}
        >
          {t('admin.mirrors.lastSync', {
            date: formatDate(mirror.last_sync_at, t('admin.mirrors.never')),
          })}
        </Typography>

        {mirror.last_sync_error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="caption">{mirror.last_sync_error}</Typography>
          </Alert>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Box>
          <Tooltip title={t('admin.mirrors.tooltipViewStatus')}>
            <Button size="small" onClick={() => onViewDetails(mirror)}>
              {t('admin.mirrors.viewDetails')}
            </Button>
          </Tooltip>
          <Tooltip title={t('admin.mirrors.tooltipViewHistory')}>
            <IconButton
              size="small"
              aria-label={t('admin.mirrors.ariaViewHistory')}
              onClick={() => onViewHistory(mirror)}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {canManage && (
          <Box>
            <Tooltip title={t('admin.mirrors.tooltipTriggerSync')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('admin.mirrors.ariaSyncMirror')}
                  color="primary"
                  onClick={() => onTriggerSync(mirror)}
                  disabled={mirror.last_sync_status === 'in_progress'}
                >
                  <SyncIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('admin.mirrors.tooltipEdit')}>
              <IconButton
                size="small"
                aria-label={t('admin.mirrors.ariaEditMirror')}
                onClick={() => onEdit(mirror)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('admin.mirrors.tooltipDelete')}>
              <IconButton
                size="small"
                aria-label={t('admin.mirrors.ariaDeleteMirror')}
                color="error"
                onClick={() => onDelete(mirror)}
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
