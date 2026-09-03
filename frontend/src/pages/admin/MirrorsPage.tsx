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
  TablePagination,
  TextField,
  Switch,
  FormControlLabel,
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
import {
  type MirrorConfiguration,
  type CreateMirrorConfigRequest,
  parseMirrorConfig,
} from '../../types/mirror'
import { formatDate } from '../../utils'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'
import { usePagination } from '../../hooks/usePagination'
import { KNOWN_PLATFORMS, emptyMirrorForm } from './mirrors/constants'
import { MirrorSyncStatusChip } from './mirrors/StatusChips'
import MirrorProvidersDialog, { useMirrorProvidersFlow } from './mirrors/MirrorProvidersDialog'
import MirrorHistoryDialog, { useMirrorHistoryFlow } from './mirrors/MirrorHistoryDialog'

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingMirror, setEditingMirror] = useState<MirrorConfiguration | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorConfiguration | null>(null)
  const providers = useMirrorProvidersFlow()

  const history = useMirrorHistoryFlow()

  // Client-side pagination
  const {
    page: mirrorsPage,
    rowsPerPage: mirrorsRowsPerPage,
    handleChangePage: handleMirrorsPageChange,
    handleChangeRowsPerPage: handleMirrorsRowsPerPageChange,
  } = usePagination(10)

  const [formData, setFormData] = useState<Partial<CreateMirrorConfigRequest>>(emptyMirrorForm)

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

  if (queryError && !status.error) {
    status.setError(getErrorMessage(queryError, t('admin.mirrors.errLoadMirrors')))
  }

  // Auto-open the Add Mirror dialog when navigated here with ?action=add.
  // Gated on canManage too, so a mirrors:read-only viewer can't reach the
  // create form via a deep link that bypasses the (also gated) Add Mirror
  // button (#609).
  useEffect(() => {
    if (canManage && searchParams.get('action') === 'add') {
      setCreateDialogOpen(true)
    }
  }, [searchParams, canManage])

  const createMutation = useMutation({
    mutationFn: (data: CreateMirrorConfigRequest) => api.createMirror(data),
    onSuccess: () => {
      setCreateDialogOpen(false)
      resetForm()
      status.showSuccess(t('admin.mirrors.msgCreated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateMirror>[1] }) =>
      api.updateMirror(id, data),
    onSuccess: () => {
      setEditingMirror(null)
      resetForm()
      status.showSuccess(t('admin.mirrors.msgUpdated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errUpdate')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMirror(id),
    onSuccess: () => {
      setDeleteConfirmOpen(false)
      setMirrorToDelete(null)
      status.showSuccess(t('admin.mirrors.msgDeleted'))
      queryClient.invalidateQueries({ queryKey: queryKeys.mirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.mirrors.errDelete')))
    },
  })

  // auto_approve_rules is a JSON string ({ rules: [...], mode: "any" | "all" }).
  // It is only meaningful — and only editable — when approval is required, so it
  // is "active" only when requires_approval is on and the field is non-empty.
  // Gating on that keeps a hidden field from ever blocking submit or leaking a
  // stale value into the payload. Validate it parses while active so an invalid
  // blob can't be saved and then fail silently at sync time.
  const autoApproveTrimmed = (formData.auto_approve_rules ?? '').trim()
  const autoApproveActive = (formData.requires_approval ?? false) && autoApproveTrimmed !== ''
  let autoApproveInvalid = false
  if (autoApproveActive) {
    try {
      JSON.parse(autoApproveTrimmed)
    } catch {
      autoApproveInvalid = true
    }
  }

  const handleCreate = () => {
    status.setError(null)
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
      auto_approve_rules: autoApproveActive ? autoApproveTrimmed : undefined,
    }
    createMutation.mutate(data as CreateMirrorConfigRequest)
  }

  const handleUpdate = () => {
    if (!editingMirror) return
    status.setError(null)
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
      auto_approve_rules: autoApproveActive ? autoApproveTrimmed : undefined,
      pull_through_enabled: formData.pull_through_enabled,
      pull_through_cache_ttl_hours: formData.pull_through_cache_ttl_hours,
    }
    updateMutation.mutate({ id: editingMirror.id, data })
  }

  const handleDelete = () => {
    if (!mirrorToDelete) return
    status.setError(null)
    deleteMutation.mutate(mirrorToDelete.id)
  }

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

  const resetForm = () => {
    setFormData(emptyMirrorForm())
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
      auto_approve_rules: mirror.auto_approve_rules ?? '',
      pull_through_enabled: mirror.pull_through_enabled ?? false,
      pull_through_cache_ttl_hours: mirror.pull_through_cache_ttl_hours ?? 24,
    })
    setNamespaceFilterInput(parsed.namespaceFilters.join(', '))
    setProviderFilterInput(parsed.providerFilters.join(', '))
    setVersionFilterInput(mirror.version_filter || '')
    setPlatformFilterInput(parsed.platformFilters)
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
                    onClick={() => {
                      resetForm()
                      setCreateDialogOpen(true)
                    }}
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

                {formData.requires_approval && (
                  <TextField
                    label={t('admin.mirrors.labelAutoApproveRules')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={formData.auto_approve_rules ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, auto_approve_rules: e.target.value })
                    }
                    error={autoApproveInvalid}
                    helperText={
                      autoApproveInvalid
                        ? t('admin.mirrors.errAutoApproveRules')
                        : t('admin.mirrors.helpAutoApproveRules')
                    }
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.pull_through_enabled ?? false}
                      onChange={(e) =>
                        setFormData({ ...formData, pull_through_enabled: e.target.checked })
                      }
                    />
                  }
                  label={t('admin.mirrors.pullThroughEnabled')}
                />

                {formData.pull_through_enabled && (
                  <TextField
                    label={t('admin.mirrors.labelPullThroughTtl')}
                    type="number"
                    fullWidth
                    value={formData.pull_through_cache_ttl_hours ?? 24}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pull_through_cache_ttl_hours: parseInt(e.target.value) || 24,
                      })
                    }
                    helperText={t('admin.mirrors.helpPullThroughTtl')}
                    slotProps={{
                      htmlInput: { min: 1 },
                    }}
                  />
                )}
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
                disabled={!formData.name || !formData.upstream_registry_url || autoApproveInvalid}
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

          <MirrorHistoryDialog flow={history} />

          <MirrorProvidersDialog flow={providers} />
        </>
      )}
    </Page>
  )
}

export default MirrorsPage
