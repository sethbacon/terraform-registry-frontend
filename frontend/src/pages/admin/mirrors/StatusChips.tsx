import React from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SyncIcon from '@mui/icons-material/Sync'
import type { MirrorConfiguration, MirrorSyncHistory } from '../../../types/mirror'

/**
 * The two sync-status chips this page shows, kept side by side so their
 * difference is visible rather than surprising.
 *
 * They are NOT one component: a mirror configuration's `last_sync_status` and
 * a sync-history row's `status` are different vocabularies from different
 * endpoints. A configuration reports `in_progress` and has a "never synced"
 * resting state, and its chip is translated; a history row reports `running`,
 * always has a status, and its chip shows the raw server string untranslated.
 * Both behaviours are pre-existing and preserved (#783); parameterising one
 * component over both would only reintroduce every difference as a prop.
 */

/** The mirror card's chip: translated labels, plus a "never synced" resting state. */
export const MirrorSyncStatusChip: React.FC<{
  status: MirrorConfiguration['last_sync_status']
}> = ({ status }) => {
  const { t } = useTranslation()

  if (!status) {
    return <Chip label={t('admin.mirrors.statusNeverSynced')} size="small" color="default" />
  }
  switch (status) {
    case 'success':
      return (
        <Chip
          label={t('admin.mirrors.statusSuccess')}
          size="small"
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    case 'failed':
      return (
        <Chip
          label={t('admin.mirrors.statusFailed')}
          size="small"
          color="error"
          icon={<ErrorIcon />}
        />
      )
    case 'in_progress':
      return (
        <Chip
          label={t('admin.mirrors.statusSyncing')}
          size="small"
          color="info"
          icon={<SyncIcon />}
        />
      )
    default:
      // A status the client does not know about is shown verbatim rather than
      // hidden, so an unrecognised server state is still visible to an admin.
      return <Chip label={status} size="small" />
  }
}

/** The history table's chip: the raw server status string, untranslated. */
export const SyncRunStatusChip: React.FC<{ status: MirrorSyncHistory['status'] }> = ({
  status,
}) => (
  <Chip
    label={status}
    size="small"
    color={
      status === 'success'
        ? 'success'
        : status === 'failed'
          ? 'error'
          : status === 'running'
            ? 'info'
            : 'default'
    }
    icon={
      status === 'success' ? <CheckCircleIcon /> : status === 'failed' ? <ErrorIcon /> : undefined
    }
  />
)
