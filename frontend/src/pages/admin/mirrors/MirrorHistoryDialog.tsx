import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import ErrorIcon from '@mui/icons-material/Error'
import api from '../../../services/api'
import { formatDate } from '../../../utils'
import type { MirrorConfiguration, MirrorSyncHistory } from '../../../types/mirror'
import { SyncRunStatusChip } from './StatusChips'

/** Everything the sync-history browser needs; produced by `useMirrorHistoryFlow`. */
export interface MirrorHistoryFlow {
  open: boolean
  /** Name of the mirror being browsed; kept after close so the title survives the exit transition. */
  name: string
  history: MirrorSyncHistory[]
  loading: boolean
  /** Opens the browser and loads that mirror's recent sync runs. */
  openDialog: (mirror: MirrorConfiguration) => void
  close: () => void
}

/**
 * Owns the sync-history browser: which mirror's recent runs are on screen and
 * the request that fetched them.
 *
 * The runs come from the mirror *status* endpoint's `recent_syncs`, not a
 * dedicated history endpoint — the sibling Terraform binary mirror has its own
 * `getTerraformMirrorHistory`, this one does not. As with View Details, the
 * fetch is imperative and a failure shows an empty history with no banner.
 */
export function useMirrorHistoryFlow(): MirrorHistoryFlow {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [history, setHistory] = useState<MirrorSyncHistory[]>([])
  const [loading, setLoading] = useState(false)

  const openDialog = async (mirror: MirrorConfiguration) => {
    setName(mirror.name)
    setOpen(true)
    setLoading(true)
    try {
      const syncStatus = await api.getMirrorStatus(mirror.id)
      setHistory(syncStatus.recent_syncs ?? [])
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  return {
    open,
    name,
    history,
    loading,
    openDialog,
    close: () => {
      setOpen(false)
      setHistory([])
    },
  }
}

/** The read-only table of a mirror's recent sync runs. */
const MirrorHistoryDialog: React.FC<{ flow: MirrorHistoryFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const { history, loading } = flow

  return (
    <Dialog open={flow.open} onClose={flow.close} maxWidth="lg" fullWidth>
      <DialogTitle>{t('admin.mirrors.syncHistoryTitle', { name: flow.name })}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <CircularProgress />
          </Box>
        ) : history.length === 0 ? (
          <Typography color="textSecondary" sx={{ py: 2 }}>
            {t('admin.mirrors.noSyncHistory')}
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.mirrors.thStarted')}</TableCell>
                  <TableCell>{t('admin.mirrors.thCompleted')}</TableCell>
                  <TableCell>{t('admin.mirrors.thStatus')}</TableCell>
                  <TableCell align="right">{t('admin.mirrors.thProvidersSynced')}</TableCell>
                  <TableCell align="right">{t('admin.mirrors.thFailures')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>{formatDate(sync.started_at)}</TableCell>
                    <TableCell>{sync.completed_at ? formatDate(sync.completed_at) : '—'}</TableCell>
                    <TableCell>
                      <SyncRunStatusChip status={sync.status} />
                      {sync.error_message && (
                        <Tooltip title={sync.error_message}>
                          <ErrorIcon
                            color="error"
                            fontSize="small"
                            sx={{ ml: 0.5, verticalAlign: 'middle' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">{sync.providers_synced}</TableCell>
                    <TableCell align="right">{sync.providers_failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.mirrors.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default MirrorHistoryDialog
