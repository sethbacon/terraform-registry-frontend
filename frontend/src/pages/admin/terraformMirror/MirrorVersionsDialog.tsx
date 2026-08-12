import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
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
  Typography,
} from '@mui/material'
import api from '../../../services/api'
import { getErrorMessage } from '../../../utils/errors'
import type { StatusMessage } from '../../../hooks/useStatusMessage'
import type { TerraformMirrorConfig, TerraformVersion } from '../../../types/terraform_mirror'
import { ToolChip } from './StatusChips'
import MirrorVersionRow from './MirrorVersionRow'

/**
 * Everything the versions browser and its delete confirmation need; produced by
 * `useMirrorVersionsFlow`.
 */
export interface MirrorVersionsFlow {
  /** The config whose versions are being browsed, or null when closed. */
  config: TerraformMirrorConfig | null
  versions: TerraformVersion[]
  loading: boolean
  /** Opens the browser and loads that config's versions. */
  openDialog: (config: TerraformMirrorConfig) => void
  close: () => void
  /** The version awaiting delete confirmation, or null when that dialog is closed. */
  pendingDelete: TerraformVersion | null
  requestDelete: (version: TerraformVersion) => void
  cancelDelete: () => void
  confirmDelete: () => void
  deleting: boolean
}

/**
 * Owns the versions browser and the delete-version confirmation nested inside
 * it — one hook rather than two because confirming a delete reloads the list
 * behind it, so the two dialogs cannot own their state independently.
 *
 * The list is fetched imperatively rather than through react-query, and a
 * failed load is shown as an empty list with no banner, exactly as before.
 */
export function useMirrorVersionsFlow(status: StatusMessage): MirrorVersionsFlow {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TerraformMirrorConfig | null>(null)
  const [versions, setVersions] = useState<TerraformVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TerraformVersion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openDialog = async (next: TerraformMirrorConfig) => {
    setConfig(next)
    setLoading(true)
    setVersions([])
    try {
      const data = await api.listTerraformVersions(next.id, { synced: false })
      const rows = data.versions ?? []
      // Sort: latest first, then by version descending
      const sorted = [...rows].sort((a, b) => {
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1
        return b.version.localeCompare(a.version, undefined, { numeric: true })
      })
      setVersions(sorted)
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || !config) return
    setDeleting(true)
    try {
      await api.deleteTerraformVersion(config.id, pendingDelete.version)
      status.setSuccess(t('admin.terraformMirror.versionDeleted', { version: pendingDelete.version }))
      setPendingDelete(null)
      openDialog(config)
    } catch (err: unknown) {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errDeleteVersion')))
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return {
    config,
    versions,
    loading,
    openDialog,
    close: () => setConfig(null),
    pendingDelete,
    requestDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
    deleting,
  }
}

/**
 * The versions browser. Mounted only while a config is selected (unlike the
 * other dialogs on this page, which stay mounted and toggle `open`).
 */
export const MirrorVersionsDialog: React.FC<{
  flow: MirrorVersionsFlow
  canManage: boolean
}> = ({ flow, canManage }) => {
  const { t } = useTranslation()
  const { config, versions, loading } = flow
  if (!config) return null

  return (
    <Dialog open onClose={flow.close} maxWidth="lg" fullWidth>
      <DialogTitle>
        {t('admin.terraformMirror.versionsTitle', { name: config.name })}
        <Box component="span" sx={{ ml: 1 }}>
          <ToolChip tool={config.tool} />
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : versions.length === 0 ? (
          <Alert severity="info">{t('admin.terraformMirror.noVersionsSynced')}</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>{t('admin.terraformMirror.thVersion')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thStatus')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thApproval')}</TableCell>
                  <TableCell>{t('admin.terraformMirror.thSyncedAt')}</TableCell>
                  <TableCell align="right">{t('admin.terraformMirror.thActions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((v) => (
                  <MirrorVersionRow
                    key={v.id}
                    version={v}
                    configId={config.id}
                    onDelete={flow.requestDelete}
                    canManage={canManage}
                  />
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

/** The "delete this version?" confirmation raised from a row of the browser. */
export const DeleteVersionDialog: React.FC<{ flow: MirrorVersionsFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  return (
    <Dialog open={!!flow.pendingDelete} onClose={flow.cancelDelete}>
      <DialogTitle>{t('admin.terraformMirror.deleteVersionTitle')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('admin.terraformMirror.deleteVersionTextBefore')}
          <strong>{flow.pendingDelete?.version}</strong>
          {t('admin.terraformMirror.deleteVersionTextAfter')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={flow.cancelDelete}>{t('admin.terraformMirror.cancel')}</Button>
        <Button color="error" onClick={flow.confirmDelete} disabled={flow.deleting}>
          {flow.deleting ? <CircularProgress size={18} /> : t('admin.terraformMirror.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
