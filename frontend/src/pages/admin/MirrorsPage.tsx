import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Collapse,
  Tooltip,
} from '@mui/material'

/** Known Terraform provider platform combinations (os/arch). */
const KNOWN_PLATFORMS = [
  'linux/amd64',
  'linux/arm64',
  'linux/386',
  'linux/arm',
  'darwin/amd64',
  'darwin/arm64',
  'windows/amd64',
  'windows/386',
  'windows/arm64',
  'freebsd/amd64',
  'freebsd/386',
  'freebsd/arm',
] as const
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import SyncIcon from '@mui/icons-material/Sync'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ScheduleIcon from '@mui/icons-material/Schedule'
import Page from '../../components/Page'
import api from '../../services/api'
import {
  type MirrorConfiguration,
  type MirrorSyncHistory,
  type MirroredProvider,
  type MirroredProviderVersion,
  type MirroredProviderPlatform,
  type CreateMirrorConfigRequest,
  parseMirrorConfig,
} from '../../types/mirror'
import { formatDate } from '../../utils'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'

// ---------------------------------------------------------------------------
// Version sub-row with expandable platform list
// ---------------------------------------------------------------------------
const VersionPlatformRow: React.FC<{ version: MirroredProviderVersion }> = ({ version }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const platforms: MirroredProviderPlatform[] = version.platforms ?? []

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ pl: 1 }}>
          <IconButton
            size="small"
            aria-label={t('admin.mirrors.ariaTogglePlatforms')}
            onClick={() => setOpen((p) => !p)}
            disabled={platforms.length === 0}
          >
            {open ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
            }}
          >
            {version.upstream_version}
          </Typography>
        </TableCell>
        <TableCell>
          {version.approval_status && (
            <Chip
              label={t(`admin.versionApprovals.status.${version.approval_status}`)}
              size="small"
              color={
                version.approval_status === 'approved'
                  ? 'success'
                  : version.approval_status === 'rejected'
                    ? 'error'
                    : 'warning'
              }
            />
          )}
        </TableCell>
        <TableCell>{new Date(version.synced_at).toLocaleString()}</TableCell>
        <TableCell>
          {version.shasum_verified ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <ErrorIcon color="disabled" fontSize="small" />
          )}
        </TableCell>
        <TableCell>
          {version.gpg_verified ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <ErrorIcon color="disabled" fontSize="small" />
          )}
        </TableCell>
        <TableCell>{platforms.length}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ ml: 4, mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OS</TableCell>
                    <TableCell>{t('admin.mirrors.thArch')}</TableCell>
                    <TableCell>{t('admin.mirrors.thFilename')}</TableCell>
                    <TableCell>SHA256</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {platforms.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.os}</TableCell>
                      <TableCell>{p.arch}</TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                          }}
                        >
                          {p.filename}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                          }}
                        >
                          {p.shasum ? p.shasum.slice(0, 12) + '…' : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ---------------------------------------------------------------------------
// Expandable provider row — shows synced versions when expanded
// ---------------------------------------------------------------------------
const ProviderRow: React.FC<{ provider: MirroredProvider }> = ({ provider }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const versions: MirroredProviderVersion[] = provider.versions ?? []

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            size="small"
            aria-label={t('admin.mirrors.ariaToggleVersions')}
            onClick={() => setOpen((p) => !p)}
            disabled={versions.length === 0}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{provider.upstream_namespace}</TableCell>
        <TableCell>{provider.upstream_type}</TableCell>
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
            }}
          >
            {provider.last_sync_version ?? '—'}
          </Typography>
        </TableCell>
        <TableCell>{versions.length}</TableCell>
        <TableCell>
          {provider.last_synced_at ? new Date(provider.last_synced_at).toLocaleString() : '—'}
        </TableCell>
        <TableCell>
          <Chip
            label={
              provider.sync_enabled
                ? t('admin.mirrors.chipSyncEnabled')
                : t('admin.mirrors.chipSyncDisabled')
            }
            size="small"
            color={provider.sync_enabled ? 'success' : 'default'}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ mx: 2, mb: 2 }}>
              {versions.length === 0 ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('admin.mirrors.noVersionsSynced')}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={40} />
                      <TableCell>{t('admin.mirrors.thVersion')}</TableCell>
                      <TableCell>{t('admin.mirrors.thStatus')}</TableCell>
                      <TableCell>{t('admin.mirrors.thSyncedAt')}</TableCell>
                      <TableCell>{t('admin.mirrors.thShasum')}</TableCell>
                      <TableCell>GPG</TableCell>
                      <TableCell>{t('admin.mirrors.thPlatforms')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((v) => (
                      <VersionPlatformRow key={v.id} version={v} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

const MirrorsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingMirror, setEditingMirror] = useState<MirrorConfiguration | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorConfiguration | null>(null)
  const [providersDialogOpen, setProvidersDialogOpen] = useState(false)
  const [providersDialogName, setProvidersDialogName] = useState('')
  const [mirrorProviders, setMirrorProviders] = useState<MirroredProvider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [mirrorHistory, setMirrorHistory] = useState<MirrorSyncHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMirrorName, setHistoryMirrorName] = useState('')

  // Client-side pagination
  const [mirrorsPage, setMirrorsPage] = useState(0)
  const [mirrorsRowsPerPage, setMirrorsRowsPerPage] = useState(10)

  const [formData, setFormData] = useState<Partial<CreateMirrorConfigRequest>>({
    name: '',
    description: '',
    upstream_registry_url: 'https://registry.terraform.io',
    namespace_filter: [],
    provider_filter: [],
    version_filter: '',
    enabled: true,
    sync_interval_hours: 24,
    requires_approval: false,
  })

  // For the filters input
  const [namespaceFilterInput, setNamespaceFilterInput] = useState('')
  const [providerFilterInput, setProviderFilterInput] = useState('')
  const [versionFilterInput, setVersionFilterInput] = useState('')
  const [platformFilterInput, setPlatformFilterInput] = useState<string[]>([])

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

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.mirrors.errLoadMirrors')))
  }

  // Auto-open the Add Mirror dialog when navigated here with ?action=add
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setCreateDialogOpen(true)
    }
  }, [searchParams])

  const createMutation = useMutation({
    mutationFn: (data: CreateMirrorConfigRequest) => api.createMirror(data),
    onSuccess: () => {
      setCreateDialogOpen(false)
      resetForm()
      setSuccess(t('admin.mirrors.msgCreated'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.mirrors.errCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateMirror>[1] }) =>
      api.updateMirror(id, data),
    onSuccess: () => {
      setEditingMirror(null)
      resetForm()
      setSuccess(t('admin.mirrors.msgUpdated'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.mirrors.errUpdate')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMirror(id),
    onSuccess: () => {
      setDeleteConfirmOpen(false)
      setMirrorToDelete(null)
      setSuccess(t('admin.mirrors.msgDeleted'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.mirrors.errDelete')))
    },
  })

  const handleCreate = () => {
    setError(null)
    const data = {
      ...formData,
      namespace_filter: namespaceFilterInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      provider_filter: providerFilterInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      version_filter: versionFilterInput.trim() || undefined,
      platform_filter: platformFilterInput.length > 0 ? platformFilterInput : undefined,
    }
    createMutation.mutate(data as CreateMirrorConfigRequest)
  }

  const handleUpdate = () => {
    if (!editingMirror) return
    setError(null)
    const data = {
      name: formData.name,
      description: formData.description,
      upstream_registry_url: formData.upstream_registry_url,
      namespace_filter: namespaceFilterInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      provider_filter: providerFilterInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      version_filter: versionFilterInput.trim() || undefined,
      platform_filter: platformFilterInput.length > 0 ? platformFilterInput : undefined,
      enabled: formData.enabled,
      sync_interval_hours: formData.sync_interval_hours,
      requires_approval: formData.requires_approval,
    }
    updateMutation.mutate({ id: editingMirror.id, data })
  }

  const handleDelete = () => {
    if (!mirrorToDelete) return
    setError(null)
    deleteMutation.mutate(mirrorToDelete.id)
  }

  const handleTriggerSync = async (mirror: MirrorConfiguration) => {
    try {
      setError(null)
      await api.triggerMirrorSync(mirror.id)
      setSuccess(t('admin.mirrors.syncTriggered', { name: mirror.name }))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.mirrors.errTriggerSync')))
    }
  }

  const handleViewStatus = async (mirror: MirrorConfiguration) => {
    setProvidersDialogName(mirror.name)
    setProvidersDialogOpen(true)
    setProvidersLoading(true)
    try {
      const providers = await api.getMirrorProviders(mirror.id)
      setMirrorProviders(Array.isArray(providers) ? providers : [])
    } catch {
      setMirrorProviders([])
    } finally {
      setProvidersLoading(false)
    }
  }

  const handleViewHistory = async (mirror: MirrorConfiguration) => {
    setHistoryMirrorName(mirror.name)
    setHistoryDialogOpen(true)
    setHistoryLoading(true)
    try {
      const status = await api.getMirrorStatus(mirror.id)
      setMirrorHistory(status.recent_syncs ?? [])
    } catch {
      setMirrorHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      upstream_registry_url: 'https://registry.terraform.io',
      namespace_filter: [],
      provider_filter: [],
      version_filter: '',
      enabled: true,
      sync_interval_hours: 24,
      requires_approval: false,
    })
    setNamespaceFilterInput('')
    setProviderFilterInput('')
    setVersionFilterInput('')
    setPlatformFilterInput([])
  }

  const openEditDialog = (mirror: MirrorConfiguration) => {
    setEditingMirror(mirror)
    const parsed = parseMirrorConfig(mirror)
    setFormData({
      name: mirror.name,
      description: mirror.description,
      upstream_registry_url: mirror.upstream_registry_url,
      enabled: mirror.enabled,
      sync_interval_hours: mirror.sync_interval_hours,
      requires_approval: mirror.requires_approval ?? false,
    })
    setNamespaceFilterInput(parsed.namespaceFilters.join(', '))
    setProviderFilterInput(parsed.providerFilters.join(', '))
    setVersionFilterInput(mirror.version_filter || '')
    setPlatformFilterInput(parsed.platformFilters)
  }

  const getStatusChip = (mirror: MirrorConfiguration) => {
    if (!mirror.last_sync_status) {
      return <Chip label={t('admin.mirrors.statusNeverSynced')} size="small" color="default" />
    }
    switch (mirror.last_sync_status) {
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
        return <Chip label={mirror.last_sync_status} size="small" />
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
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h4">{t('admin.mirrors.pageTitle')}</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.mirrors.pageSubtitle')}
              </Typography>
            </Box>
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  resetForm()
                  setCreateDialogOpen(true)
                }}
              >
                {t('admin.mirrors.addMirror')}
              </Button>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

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
                            {getStatusChip(mirror)}
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
                            <Button size="small" onClick={() => handleViewStatus(mirror)}>
                              {t('admin.mirrors.viewDetails')}
                            </Button>
                          </Tooltip>
                          <Tooltip title={t('admin.mirrors.tooltipViewHistory')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.mirrors.ariaViewHistory')}
                              onClick={() => handleViewHistory(mirror)}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
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
                              onClick={() => openEditDialog(mirror)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('admin.mirrors.tooltipDelete')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.mirrors.ariaDeleteMirror')}
                              color="error"
                              onClick={() => {
                                setMirrorToDelete(mirror)
                                setDeleteConfirmOpen(true)
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
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
              onPageChange={(_e, newPage) => setMirrorsPage(newPage)}
              rowsPerPage={mirrorsRowsPerPage}
              onRowsPerPageChange={(e) => {
                setMirrorsRowsPerPage(parseInt(e.target.value, 10))
                setMirrorsPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ mt: 2 }}
            />
          )}

          {/* Create/Edit Dialog */}
          <Dialog
            open={createDialogOpen || !!editingMirror}
            onClose={() => {
              setCreateDialogOpen(false)
              setEditingMirror(null)
              resetForm()
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingMirror
                ? t('admin.mirrors.dialogTitleEdit')
                : t('admin.mirrors.dialogTitleAdd')}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={t('admin.mirrors.labelName')}
                  fullWidth
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  helperText={t('admin.mirrors.helpName')}
                />

                <TextField
                  label={t('admin.mirrors.labelDescription')}
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <TextField
                  label={t('admin.mirrors.labelUpstreamUrl')}
                  fullWidth
                  value={formData.upstream_registry_url}
                  onChange={(e) =>
                    setFormData({ ...formData, upstream_registry_url: e.target.value })
                  }
                  required
                  helperText={t('admin.mirrors.helpUpstreamUrl')}
                />

                <TextField
                  label={t('admin.mirrors.labelNamespaceFilter')}
                  fullWidth
                  value={namespaceFilterInput}
                  onChange={(e) => setNamespaceFilterInput(e.target.value)}
                  helperText={t('admin.mirrors.helpNamespaceFilter')}
                />

                <TextField
                  label={t('admin.mirrors.labelProviderFilter')}
                  fullWidth
                  value={providerFilterInput}
                  onChange={(e) => setProviderFilterInput(e.target.value)}
                  helperText={t('admin.mirrors.helpProviderFilter')}
                />

                <TextField
                  label={t('admin.mirrors.labelVersionFilter')}
                  fullWidth
                  value={versionFilterInput}
                  onChange={(e) => setVersionFilterInput(e.target.value)}
                  helperText={t('admin.mirrors.helpVersionFilter')}
                  placeholder={t('admin.mirrors.placeholderVersionFilter')}
                />

                <Autocomplete
                  multiple
                  options={KNOWN_PLATFORMS}
                  value={platformFilterInput}
                  onChange={(_event, newValue) => setPlatformFilterInput(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('admin.mirrors.labelPlatformFilter')}
                      placeholder={
                        platformFilterInput.length === 0
                          ? t('admin.mirrors.placeholderAllPlatforms')
                          : ''
                      }
                      helperText={t('admin.mirrors.helpPlatformFilter')}
                    />
                  )}
                  renderValue={(value, getItemProps) =>
                    value.map((option, index) => (
                      <Chip label={option} size="small" {...getItemProps({ index })} key={option} />
                    ))
                  }
                />

                <TextField
                  label={t('admin.mirrors.labelSyncInterval')}
                  type="number"
                  fullWidth
                  value={formData.sync_interval_hours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sync_interval_hours: parseInt(e.target.value) || 24,
                    })
                  }
                  helperText={t('admin.mirrors.helpSyncInterval')}
                  slotProps={{
                    htmlInput: { min: 1 },
                  }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                  }
                  label={t('admin.mirrors.enabled')}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.requires_approval ?? false}
                      onChange={(e) =>
                        setFormData({ ...formData, requires_approval: e.target.checked })
                      }
                    />
                  }
                  label={t('admin.mirrors.requiresApproval')}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setCreateDialogOpen(false)
                  setEditingMirror(null)
                  resetForm()
                }}
              >
                {t('admin.mirrors.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={editingMirror ? handleUpdate : handleCreate}
                disabled={!formData.name || !formData.upstream_registry_url}
              >
                {editingMirror ? t('admin.mirrors.update') : t('admin.mirrors.create')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
            <DialogTitle>{t('admin.mirrors.confirmDeleteTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.mirrors.confirmDeleteText', { name: mirrorToDelete?.name })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteConfirmOpen(false)}>
                {t('admin.mirrors.cancel')}
              </Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                {t('admin.mirrors.delete')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* History Dialog */}
          <Dialog
            open={historyDialogOpen}
            onClose={() => {
              setHistoryDialogOpen(false)
              setMirrorHistory([])
            }}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              {t('admin.mirrors.syncHistoryTitle', { name: historyMirrorName })}
            </DialogTitle>
            <DialogContent>
              {historyLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    p: 4,
                  }}
                >
                  <CircularProgress />
                </Box>
              ) : mirrorHistory.length === 0 ? (
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
                      {mirrorHistory.map((sync) => (
                        <TableRow key={sync.id}>
                          <TableCell>{formatDate(sync.started_at)}</TableCell>
                          <TableCell>
                            {sync.completed_at ? formatDate(sync.completed_at) : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={sync.status}
                              size="small"
                              color={
                                sync.status === 'success'
                                  ? 'success'
                                  : sync.status === 'failed'
                                    ? 'error'
                                    : sync.status === 'running'
                                      ? 'info'
                                      : 'default'
                              }
                              icon={
                                sync.status === 'success' ? (
                                  <CheckCircleIcon />
                                ) : sync.status === 'failed' ? (
                                  <ErrorIcon />
                                ) : undefined
                              }
                            />
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
              <Button
                onClick={() => {
                  setHistoryDialogOpen(false)
                  setMirrorHistory([])
                }}
              >
                {t('admin.mirrors.close')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* View Details — Synced Providers Dialog */}
          <Dialog
            open={providersDialogOpen}
            onClose={() => {
              setProvidersDialogOpen(false)
              setMirrorProviders([])
            }}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              {t('admin.mirrors.providersTitle', { name: providersDialogName })}
            </DialogTitle>
            <DialogContent>
              {providersLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 4,
                  }}
                >
                  <CircularProgress />
                </Box>
              ) : mirrorProviders.length === 0 ? (
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
                      {mirrorProviders.map((p) => (
                        <ProviderRow key={p.id} provider={p} />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setProvidersDialogOpen(false)
                  setMirrorProviders([])
                }}
              >
                {t('admin.mirrors.close')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Page>
  )
}

export default MirrorsPage
