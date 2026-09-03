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
} from '@mui/material'
import api from '../../../services/api'
import type { MirrorConfiguration, MirroredProvider } from '../../../types/mirror'
import ProviderRow from './ProviderRow'

/** Everything the "View Details" providers browser needs; produced by `useMirrorProvidersFlow`. */
export interface MirrorProvidersFlow {
  open: boolean
  /** Name of the mirror being browsed; kept after close so the title survives the exit transition. */
  name: string
  providers: MirroredProvider[]
  loading: boolean
  /** Opens the browser and loads that mirror's synced providers. */
  openDialog: (mirror: MirrorConfiguration) => void
  close: () => void
}

/**
 * Owns the "View Details" browser: which mirror's synced providers are on
 * screen and the request that fetched them.
 *
 * Fetched imperatively rather than through react-query, and a failed load is
 * shown as an empty list with no error banner, exactly as before — the details
 * view is a read-only drill-down, so a failure there must not overwrite a
 * banner describing something the admin actually did.
 *
 * `open` is a flag separate from `name` on purpose: closing clears the rows but
 * leaves the name, so the dialog title stays put while MUI plays the exit
 * transition instead of blanking mid-fade.
 */
export function useMirrorProvidersFlow(): MirrorProvidersFlow {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [providers, setProviders] = useState<MirroredProvider[]>([])
  const [loading, setLoading] = useState(false)

  const openDialog = async (mirror: MirrorConfiguration) => {
    setName(mirror.name)
    setOpen(true)
    setLoading(true)
    try {
      const rows = await api.getMirrorProviders(mirror.id)
      setProviders(Array.isArray(rows) ? rows : [])
    } catch {
      setProviders([])
    } finally {
      setLoading(false)
    }
  }

  return {
    open,
    name,
    providers,
    loading,
    openDialog,
    close: () => {
      setOpen(false)
      setProviders([])
    },
  }
}

/** The read-only table of providers a mirror has synced, expandable to versions and platforms. */
const MirrorProvidersDialog: React.FC<{ flow: MirrorProvidersFlow }> = ({ flow }) => {
  const { t } = useTranslation()
  const { providers, loading } = flow

  return (
    <Dialog open={flow.open} onClose={flow.close} maxWidth="lg" fullWidth>
      <DialogTitle>{t('admin.mirrors.providersTitle', { name: flow.name })}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 4,
            }}
          >
            <CircularProgress />
          </Box>
        ) : providers.length === 0 ? (
          <Alert severity="info">{t('admin.mirrors.noProvidersSynced')}</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>{t('admin.mirrors.thNamespace')}</TableCell>
                  <TableCell>{t('admin.mirrors.thType')}</TableCell>
                  <TableCell>{t('admin.mirrors.thLatestVersion')}</TableCell>
                  <TableCell>{t('admin.mirrors.thVersions')}</TableCell>
                  <TableCell>{t('admin.mirrors.thLastSynced')}</TableCell>
                  <TableCell>{t('admin.mirrors.enabled')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((p) => (
                  <ProviderRow key={p.id} provider={p} />
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

export default MirrorProvidersDialog
