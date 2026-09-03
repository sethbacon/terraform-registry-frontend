import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Chip,
  TablePagination,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import SyncIcon from '@mui/icons-material/Sync'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import ScheduleIcon from '@mui/icons-material/Schedule'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import StatusAlerts from '../../components/StatusAlerts'
import PageTitleIcon from '@mui/icons-material/CloudDownload'
import api from '../../services/api'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { useAuth } from '../../contexts/AuthContext'
import { type MirrorConfiguration, parseMirrorConfig } from '../../types/mirror'
import { formatDate } from '../../utils'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'
import { usePagination } from '../../hooks/usePagination'
import { MirrorSyncStatusChip } from './mirrors/StatusChips'
import MirrorProvidersDialog, { useMirrorProvidersFlow } from './mirrors/MirrorProvidersDialog'
import MirrorHistoryDialog, { useMirrorHistoryFlow } from './mirrors/MirrorHistoryDialog'
import DeleteMirrorDialog, { useDeleteMirrorFlow } from './mirrors/DeleteMirrorDialog'
import MirrorFormDialog, { useMirrorFormFlow } from './mirrors/MirrorFormDialog'

const MirrorsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  // The route itself is gated at mirrors:read (view-only) so auditors/viewers
  // can browse mirror configurations (routeScopes.ts). Add/Edit/Delete/
  // Trigger-Sync mutate mirror config or kick off syncs against the upstream
  // registry though, so canManage additionally gates those controls on
  // mirrors:manage/admin — a mirrors:read-only viewer would otherwise see
  // fully actionable controls that only fail once clicked (#609).
  const canManage = allowedScopes.includes('admin') || allowedScopes.includes('mirrors:manage')
  const status = useStatusMessage()
  const mirrorForm = useMirrorFormFlow(status)
  const deleteMirror = useDeleteMirrorFlow(status)
  const providers = useMirrorProvidersFlow()

  const history = useMirrorHistoryFlow()

  // Client-side pagination
  const {
    page: mirrorsPage,
    rowsPerPage: mirrorsRowsPerPage,
    handleChangePage: handleMirrorsPageChange,
    handleChangeRowsPerPage: handleMirrorsRowsPerPageChange,
  } = usePagination(10)

  const [searchParams] = useSearchParams()

  const {
    data: mirrors = [],
    isLoading: loading,
    error: queryError,
    refetch: loadMirrors,
  } = useQuery<MirrorConfiguration[]>({
    queryKey: queryKeys.mirrors.list(),
    queryFn: async () => {
      const data = await api.listMirrors()
      return Array.isArray(data) ? data : []
    },
  })

  if (queryError && !status.error) {
    status.setError(getErrorMessage(queryError, t('admin.mirrors.errLoadMirrors')))
  }

  // Auto-open the Add Mirror dialog when navigated here with ?action=add.
  // Gated on canManage too, so a mirrors:read-only viewer can't reach the
  // create form via a deep link that bypasses the (also gated) Add Mirror
  // button (#609).
  useEffect(() => {
    if (canManage && searchParams.get('action') === 'add') {
      mirrorForm.openCreateFromDeepLink()
    }
    // mirrorForm is rebuilt on every render, so it is deliberately not a
    // dependency: adding it would re-run this effect on every keystroke in the
    // form and re-open a dialog the admin had just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManage])

  const handleTriggerSync = async (mirror: MirrorConfiguration) => {
    try {
      status.setError(null)
      await api.triggerMirrorSync(mirror.id)
      status.setSuccess(t('admin.mirrors.syncTriggered', { name: mirror.name }))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    } catch (err: unknown) {
      status.setError(getErrorMessage(err, t('admin.mirrors.errTriggerSync')))
    }
  }

  return (
    <Page maxWidth="lg" aria-busy={loading} aria-live="polite">
      {loading ? (
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
            title={t('admin.mirrors.pageTitle')}
            description={t('admin.mirrors.pageSubtitle')}
            actions={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    loadMirrors()
                  }}
                >
                  {t('admin.mirrors.refresh')}
                </Button>
                {canManage && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={mirrorForm.openCreate}
                  >
                    {t('admin.mirrors.addMirror')}
                  </Button>
                )}
              </Box>
            }
          />

          <StatusAlerts status={status} mb={2} />

          <Grid container spacing={3}>
            {mirrors
              .slice(
                mirrorsPage * mirrorsRowsPerPage,
                mirrorsPage * mirrorsRowsPerPage + mirrorsRowsPerPage,
              )
              .map((mirror) => {
                const parsed = parseMirrorConfig(mirror)
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={mirror.id}>
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
                              label={
                                mirror.enabled
                                  ? t('admin.mirrors.enabled')
                                  : t('admin.mirrors.disabled')
                              }
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

                      <CardActions
                        sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}
                      >
                        <Box>
                          <Tooltip title={t('admin.mirrors.tooltipViewStatus')}>
                            <Button size="small" onClick={() => providers.openDialog(mirror)}>
                              {t('admin.mirrors.viewDetails')}
                            </Button>
                          </Tooltip>
                          <Tooltip title={t('admin.mirrors.tooltipViewHistory')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.mirrors.ariaViewHistory')}
                              onClick={() => history.openDialog(mirror)}
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
                                  onClick={() => handleTriggerSync(mirror)}
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
                                onClick={() => mirrorForm.openEdit(mirror)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('admin.mirrors.tooltipDelete')}>
                              <IconButton
                                size="small"
                                aria-label={t('admin.mirrors.ariaDeleteMirror')}
                                color="error"
                                onClick={() => deleteMirror.openDialog(mirror)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                )
              })}

            {mirrors.length === 0 && !loading && (
              <Grid size={12}>
                <Card>
                  <CardContent>
                    <Typography variant="body1" color="textSecondary" align="center">
                      {t('admin.mirrors.emptyState')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {mirrors.length > mirrorsRowsPerPage && (
            <TablePagination
              component="div"
              count={mirrors.length}
              page={mirrorsPage}
              onPageChange={handleMirrorsPageChange}
              rowsPerPage={mirrorsRowsPerPage}
              onRowsPerPageChange={handleMirrorsRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ mt: 2 }}
            />
          )}

          <MirrorFormDialog flow={mirrorForm} />

          <DeleteMirrorDialog flow={deleteMirror} />

          <MirrorHistoryDialog flow={history} />

          <MirrorProvidersDialog flow={providers} />
        </>
      )}
    </Page>
  )
}

export default MirrorsPage
