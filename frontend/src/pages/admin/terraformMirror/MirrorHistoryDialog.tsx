import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Chip,
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
} from '@mui/material'
import api from '../../../services/api'
import type { TerraformMirrorConfig, TerraformSyncHistory } from '../../../types/terraform_mirror'
import { SyncStatusChip } from './StatusChips'

/** Everything the sync-history browser needs; produced by `useMirrorHistoryFlow`. */
export interface MirrorHistoryFlow {
  /** The config whose history is being browsed, or null when the dialog is closed. */
  config: TerraformMirrorConfig | null
  history: TerraformSyncHistory[]
  loading: boolean
  /** Opens the browser and loads that config's 20 most recent sync runs. */
  openDialog: (config: TerraformMirrorConfig) => void
  close: () => void
}

/**
 * Owns the sync-history browser: which config is open and its last 20 runs.
 *
 * Fetched imperatively rather than through react-query, and a failed load is
 * shown as an empty history with no banner, exactly as before.
 */
export function useMirrorHistoryFlow(): MirrorHistoryFlow {
  const [config, setConfig] = useState<TerraformMirrorConfig | null>(null)
  const [history, setHistory] = useState<TerraformSyncHistory[]>([])
  const [loading, setLoading] = useState(false)

  const openDialog = async (next: TerraformMirrorConfig) => {
    setConfig(next)
    setLoading(true)
    setHistory([])
    try {
      const data = await api.getTerraformMirrorHistory(next.id, 20)
      setHistory(data.history ?? [])
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  return { config, history, loading, openDialog, close: () => setConfig(null) }
}

/** The read-only table of a mirror's recent sync runs. */
const MirrorHistoryDialog: React.FC<{ flow: MirrorHistoryFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const { config, history, loading } = flow

  return (
    <Dialog open={!!config} onClose={flow.close} maxWidth="lg" fullWidth>
      <DialogTitle>{t('admin.terraformMirror.historyTitle', { name: config?.name })}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : history.length === 0 ? (
          <Alert severity="info">{t('admin.terraformMirror.noHistory')}</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.terraformMirror.thStarted')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thCompleted')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thTriggeredBy')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thStatus')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thVersions')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thPlatforms')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thFailures')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell>{new Date(h.started_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {h.completed_at ? new Date(h.completed_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>{h.triggered_by}</TableCell>
                    <TableCell>
                      <SyncStatusChip status={h.status} />
                    </TableCell>
                    <TableCell>{h.versions_synced}</TableCell>
                    <TableCell>{h.platforms_synced}</TableCell>
                    <TableCell>
                      {h.versions_failed > 0 ? (
                        <Chip label={h.versions_failed} color="error" size="small" />
                      ) : (
                        '0'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.close}>{t('admin.terraformMirror.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default MirrorHistoryDialog
