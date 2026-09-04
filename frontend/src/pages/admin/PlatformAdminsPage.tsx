import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/PersonAdd'
import RefreshIcon from '@mui/icons-material/Refresh'
import PageTitleIcon from '@mui/icons-material/AdminPanelSettings'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import StatusAlerts from '../../components/StatusAlerts'
import api from '../../services/api'
import { PLATFORM_ADMIN_NOTE_MAX_LENGTH } from '../../services/api/platformAdminsApi'
import { useAuth } from '../../contexts/AuthContext'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { getErrorMessage, getErrorStatus } from '../../utils/errors'
import { formatDate } from '../../utils'
import { queryKeys } from '../../services/queryKeys'
import type { PlatformAdmin } from '../../types/rbac'
import type { User } from '../../types'

/**
 * How a grant is named in prose (banners, confirmations, aria labels). The
 * address is the unambiguous handle; an orphaned grant has none, so it is named
 * by the user id that is all the carrier still knows about it.
 */
function subjectOf(admin: PlatformAdmin): string {
  return admin.email || admin.name || admin.user_id
}

/**
 * Platform-admin management (issue #778, backend #766).
 *
 * Platform-admin authority is a grant in its own table, not a role template, so
 * this page is the provenance record for the highest privilege in the product:
 * who holds it, who granted it, when, and why.
 */
const PlatformAdminsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const status = useStatusMessage()
  const { user } = useAuth()

  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [note, setNote] = useState('')

  const [revokeTarget, setRevokeTarget] = useState<PlatformAdmin | null>(null)
  // Set when the BACKEND refuses a revoke with 409. The client-side check below
  // reads the same rule from the same data, but the two can disagree when a
  // user is deleted between the list and the revoke — which is precisely when
  // the refusal matters.
  const [serverRefusedLastAdmin, setServerRefusedLastAdmin] = useState(false)

  const {
    data: admins = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<PlatformAdmin[]>({
    queryKey: queryKeys.platformAdmins.list(),
    queryFn: () => api.listPlatformAdmins(),
  })

  // In an effect, not during render. Calling setError() in the render body is a
  // setState-during-render, and the `!status.error` guard made the banner
  // UNDISMISSABLE: dismissing set it to null, the next render saw the query still
  // errored, and put it straight back. Keyed on queryError so a dismissal sticks
  // until the query's outcome actually changes.
  useEffect(() => {
    if (queryError) {
      status.setError(getErrorMessage(queryError, t('admin.platformAdmins.errLoad')))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryError])

  // Only needed to populate the grant dialog's picker.
  const { data: userPage } = useQuery({
    queryKey: queryKeys.users.list({ page: 1, perPage: 100 }),
    queryFn: () => api.listUsers(1, 100),
    enabled: grantDialogOpen,
  })
  const grantableUsers = (userPage?.users ?? []).filter(
    (candidate) => !admins.some((admin) => admin.user_id === candidate.id),
  )

  const orphanCount = admins.filter((admin) => !admin.user_resolved).length
  const trimmedNote = note.trim()
  const noteTooLong = trimmedNote.length > PLATFORM_ADMIN_NOTE_MAX_LENGTH

  /**
   * Mirrors the backend's last-standing guard: a revoke is refused unless some
   * OTHER grant resolves to a live user. An orphaned grant is skipped rather
   * than counted, because it cannot be exercised — so a table full of orphans
   * still leaves the one real administrator as the last one.
   */
  const wouldStrandDeployment = (target: PlatformAdmin): boolean =>
    !admins.some((admin) => admin.user_id !== target.user_id && admin.user_resolved)

  const isSelf = (admin: PlatformAdmin): boolean => Boolean(user?.id) && admin.user_id === user?.id

  function closeGrantDialog() {
    setGrantDialogOpen(false)
    setSelectedUser(null)
    setNote('')
  }

  function closeRevokeDialog() {
    setRevokeTarget(null)
    setServerRefusedLastAdmin(false)
  }

  const grantMutation = useMutation({
    mutationFn: (payload: { user_id: string; note?: string }) => api.grantPlatformAdmin(payload),
    onSuccess: (granted) => {
      status.showSuccess(t('admin.platformAdmins.msgGranted', { subject: subjectOf(granted) }))
      closeGrantDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.platformAdmins._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.platformAdmins.errGrant')))
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (target: PlatformAdmin) => api.revokePlatformAdmin(target.user_id),
    onSuccess: (_result, target) => {
      status.showSuccess(t('admin.platformAdmins.msgRevoked', { subject: subjectOf(target) }))
      closeRevokeDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.platformAdmins._def })
    },
    onError: (err: unknown) => {
      // 409 is the never-zero invariant refusing to strand the deployment
      // (backend #866), not a mistake the operator made. It is explained in
      // place rather than reported as a failure, and the listing is refreshed
      // because the client's picture of who still resolves was evidently stale.
      if (getErrorStatus(err) === 409) {
        setServerRefusedLastAdmin(true)
        queryClient.invalidateQueries({ queryKey: queryKeys.platformAdmins._def })
        return
      }
      // A grant that is already gone means somebody else got there first. Without
      // this the row the server says no longer exists stays in the table and stays
      // clickable, so the operator's next click repeats the same 404.
      if (getErrorStatus(err) === 404) {
        queryClient.invalidateQueries({ queryKey: queryKeys.platformAdmins._def })
      }
      status.setError(getErrorMessage(err, t('admin.platformAdmins.errRevoke')))
      closeRevokeDialog()
    },
  })

  const lastAdministrator =
    revokeTarget !== null && (serverRefusedLastAdmin || wouldStrandDeployment(revokeTarget))
  const revokingSelf = revokeTarget !== null && isSelf(revokeTarget)

  const renderGrantedBy = (admin: PlatformAdmin) => {
    if (admin.granted_by === null) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('admin.platformAdmins.grantedByBackfill')}
        </Typography>
      )
    }
    if (!admin.granted_by_email) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('admin.platformAdmins.grantedByUnresolved', { id: admin.granted_by })}
        </Typography>
      )
    }
    return <Typography variant="body2">{admin.granted_by_email}</Typography>
  }

  return (
    <Page maxWidth="lg" aria-busy={isLoading} aria-live="polite">
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          <PageHeader
            icon={<PageTitleIcon />}
            title={t('admin.platformAdmins.pageTitle')}
            description={t('admin.platformAdmins.pageSubtitle')}
            actions={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    refetch()
                  }}
                >
                  {t('admin.platformAdmins.refresh')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setGrantDialogOpen(true)}
                >
                  {t('admin.platformAdmins.grantButton')}
                </Button>
              </Box>
            }
          />

          <StatusAlerts status={status} mb={2} order="error-first" dismissible />

          {orphanCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('admin.platformAdmins.orphanSummary', { count: orphanCount })}
            </Alert>
          )}

          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.platformAdmins.thAdministrator')}</TableCell>
                    <TableCell>{t('admin.platformAdmins.thGrantedBy')}</TableCell>
                    <TableCell>{t('admin.platformAdmins.thGrantedAt')}</TableCell>
                    <TableCell>{t('admin.platformAdmins.thNote')}</TableCell>
                    <TableCell align="right">{t('admin.platformAdmins.thActions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.user_id}>
                      <TableCell>
                        {admin.user_resolved ? (
                          <>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {admin.name || admin.email || admin.user_id}
                              </Typography>
                              {isSelf(admin) && (
                                <Chip label={t('admin.platformAdmins.chipYou')} size="small" />
                              )}
                            </Stack>
                            {admin.email && admin.name && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {admin.email}
                              </Typography>
                            )}
                          </>
                        ) : (
                          <>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <PersonOffIcon fontSize="small" color="warning" />
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {t('admin.platformAdmins.unresolvedUser')}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                fontFamily: 'monospace',
                                display: 'block',
                              }}
                            >
                              {admin.user_id}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', display: 'block' }}
                            >
                              {t('admin.platformAdmins.unresolvedHint')}
                            </Typography>
                          </>
                        )}
                      </TableCell>
                      <TableCell>{renderGrantedBy(admin)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(admin.granted_at)}</Typography>
                      </TableCell>
                      <TableCell>
                        {admin.note ? (
                          <Typography variant="body2">{admin.note}</Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                            {t('admin.platformAdmins.noNote')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          aria-label={t('admin.platformAdmins.ariaRevoke', {
                            subject: subjectOf(admin),
                          })}
                          onClick={() => {
                            setServerRefusedLastAdmin(false)
                            setRevokeTarget(admin)
                          }}
                        >
                          {t('admin.platformAdmins.revoke')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {admins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          variant="body2"
                          align="center"
                          sx={{ color: 'text.secondary', py: 3 }}
                        >
                          {t('admin.platformAdmins.emptyState')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Grant dialog */}
          <Dialog open={grantDialogOpen} onClose={closeGrantDialog} maxWidth="sm" fullWidth>
            <DialogTitle>{t('admin.platformAdmins.grantDialogTitle')}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t('admin.platformAdmins.grantDialogIntro')}
                </Typography>
                <Autocomplete
                  options={grantableUsers}
                  value={selectedUser}
                  onChange={(_event, value) => setSelectedUser(value)}
                  getOptionLabel={(option) => `${option.name} (${option.email})`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  noOptionsText={t('admin.platformAdmins.noUserOptions')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('admin.platformAdmins.labelUser')}
                      placeholder={t('admin.platformAdmins.placeholderUser')}
                      required
                    />
                  )}
                  fullWidth
                />
                <TextField
                  label={t('admin.platformAdmins.labelNote')}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  error={noteTooLong}
                  helperText={
                    noteTooLong
                      ? t('admin.platformAdmins.errNoteTooLong', {
                          max: PLATFORM_ADMIN_NOTE_MAX_LENGTH,
                        })
                      : t('admin.platformAdmins.helpNote', {
                          used: trimmedNote.length,
                          max: PLATFORM_ADMIN_NOTE_MAX_LENGTH,
                        })
                  }
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeGrantDialog} disabled={grantMutation.isPending}>
                {t('admin.platformAdmins.cancel')}
              </Button>
              <Button
                variant="contained"
                disabled={!selectedUser || noteTooLong || grantMutation.isPending}
                onClick={() => {
                  if (!selectedUser) return
                  status.setError(null)
                  grantMutation.mutate({
                    user_id: selectedUser.id,
                    ...(trimmedNote ? { note: trimmedNote } : {}),
                  })
                }}
              >
                {grantMutation.isPending
                  ? t('admin.platformAdmins.granting')
                  : t('admin.platformAdmins.confirmGrant')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Revoke confirmation — or, when the deployment would be stranded,
              the explanation of why there is nothing to confirm. */}
          <Dialog open={revokeTarget !== null} onClose={closeRevokeDialog} maxWidth="sm" fullWidth>
            <DialogTitle>{t('admin.platformAdmins.revokeDialogTitle')}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {lastAdministrator ? (
                  <Alert severity="info">
                    <AlertTitle>{t('admin.platformAdmins.lastAdminTitle')}</AlertTitle>
                    {t('admin.platformAdmins.lastAdminBody')}
                  </Alert>
                ) : (
                  <>
                    <Typography>
                      {t('admin.platformAdmins.revokeConfirm', {
                        subject: revokeTarget ? subjectOf(revokeTarget) : '',
                      })}
                    </Typography>
                    {revokingSelf && (
                      <Alert severity="warning">
                        <AlertTitle>{t('admin.platformAdmins.selfRevokeTitle')}</AlertTitle>
                        {t('admin.platformAdmins.selfRevokeBody')}
                      </Alert>
                    )}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t('admin.platformAdmins.revokeAudit')}
                    </Typography>
                  </>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeRevokeDialog} disabled={revokeMutation.isPending}>
                {lastAdministrator
                  ? t('admin.platformAdmins.close')
                  : t('admin.platformAdmins.cancel')}
              </Button>
              {!lastAdministrator && (
                <Button
                  variant="contained"
                  color="error"
                  disabled={revokeMutation.isPending}
                  onClick={() => {
                    if (!revokeTarget) return
                    status.setError(null)
                    revokeMutation.mutate(revokeTarget)
                  }}
                >
                  {revokeMutation.isPending
                    ? t('admin.platformAdmins.revoking')
                    : revokingSelf
                      ? t('admin.platformAdmins.confirmRevokeSelf')
                      : t('admin.platformAdmins.confirmRevoke')}
                </Button>
              )}
            </DialogActions>
          </Dialog>
        </>
      )}
    </Page>
  )
}

export default PlatformAdminsPage
