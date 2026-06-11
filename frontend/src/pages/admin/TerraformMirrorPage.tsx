import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../services/queryKeys'
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

/** Known Terraform binary platform combinations (os/arch). */
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'

import api from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import ReleasesGPGKeyStatus from '../../components/ReleasesGPGKeyStatus'
import {
  type TerraformMirrorConfig,
  type TerraformMirrorStatusResponse,
  type TerraformVersion,
  type TerraformVersionPlatform,
  type TerraformSyncHistory,
  type CreateTerraformMirrorConfigRequest,
  type UpdateTerraformMirrorConfigRequest,
  syncStatusColor,
  parsePlatformFilter,
} from '../../types/terraform_mirror'

// ---------------------------------------------------------------------------
// Helper chip components
// ---------------------------------------------------------------------------

const SyncStatusChip: React.FC<{ status: string; size?: 'small' | 'medium' }> = ({
  status,
  size = 'small',
}) => (
  <Chip
    label={status}
    color={syncStatusColor(status)}
    size={size}
    icon={
      status === 'synced' || status === 'success' ? (
        <CheckCircleIcon />
      ) : status === 'failed' ? (
        <ErrorIcon />
      ) : undefined
    }
  />
)

const ToolChip: React.FC<{ tool: string }> = ({ tool }) => {
  const color = tool === 'terraform' ? 'primary' : tool === 'opentofu' ? 'secondary' : 'default'
  return <Chip label={tool} size="small" color={color} variant="outlined" />
}

// ---------------------------------------------------------------------------
// Version row with expandable platform list
// ---------------------------------------------------------------------------

const VersionRow: React.FC<{
  version: TerraformVersion
  configId: string
  onDelete: (v: TerraformVersion) => void
}> = ({ version, configId, onDelete }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState<TerraformVersionPlatform[] | null>(null)
  const [loadingPlatforms, setLoadingPlatforms] = useState(false)

  const handleExpand = async () => {
    if (!open && platforms === null) {
      setLoadingPlatforms(true)
      try {
        const data = await api.listTerraformVersionPlatforms(configId, version.version)
        setPlatforms(data)
      } catch {
        setPlatforms([])
      } finally {
        setLoadingPlatforms(false)
      }
    }
    setOpen((prev) => !prev)
  }

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            size="small"
            aria-label={t('admin.terraformMirror.ariaToggleVersionDetails')}
            onClick={handleExpand}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {version.version}
            </Typography>
            {version.is_latest && (
              <Chip label={t('admin.terraformMirror.chipLatest')} color="primary" size="small" />
            )}
            {version.is_deprecated && (
              <Chip
                label={t('admin.terraformMirror.chipDeprecated')}
                color="warning"
                size="small"
              />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <SyncStatusChip status={version.sync_status} />
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
        <TableCell>
          {version.synced_at ? new Date(version.synced_at).toLocaleString() : '—'}
        </TableCell>
        <TableCell align="right">
          <Tooltip title={t('admin.terraformMirror.tooltipDeleteVersion')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('admin.terraformMirror.ariaDeleteVersion')}
                color="error"
                onClick={() => onDelete(version)}
                disabled={version.sync_status === 'syncing'}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ pb: 0, pt: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ m: 1, mb: 2 }}>
              {loadingPlatforms ? (
                <CircularProgress size={20} />
              ) : platforms && platforms.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>OS</TableCell>
                      <TableCell>{t('admin.terraformMirror.thArch')}</TableCell>
                      <TableCell>{t('admin.terraformMirror.thFilename')}</TableCell>
                      <TableCell>{t('admin.terraformMirror.thStatus')}</TableCell>
                      <TableCell>SHA256</TableCell>
                      <TableCell>GPG</TableCell>
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
                          <SyncStatusChip status={p.sync_status} />
                        </TableCell>
                        <TableCell>
                          {p.sha256_verified ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="disabled" fontSize="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {p.gpg_verified ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="disabled" fontSize="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('admin.terraformMirror.noPlatformsSynced')}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ---------------------------------------------------------------------------
// Config card
// ---------------------------------------------------------------------------

const ConfigCard: React.FC<{
  config: TerraformMirrorConfig
  status?: TerraformMirrorStatusResponse
  onEdit: (c: TerraformMirrorConfig) => void
  onDelete: (c: TerraformMirrorConfig) => void
  onSync: (c: TerraformMirrorConfig) => void
  onViewVersions: (c: TerraformMirrorConfig) => void
  onViewHistory: (c: TerraformMirrorConfig) => void
  syncing: boolean
}> = ({ config, status, onEdit, onDelete, onSync, onViewVersions, onViewHistory, syncing }) => {
  const { t } = useTranslation()
  return (
    <Card variant="outlined">
      <CardContent>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
            {config.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
            <ToolChip tool={config.tool} />
            <Chip
              label={
                config.enabled
                  ? t('admin.terraformMirror.chipEnabled')
                  : t('admin.terraformMirror.chipDisabled')
              }
              color={config.enabled ? 'success' : 'default'}
              size="small"
            />
          </Box>
        </Box>

        {config.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 1,
            }}
          >
            {config.description}
          </Typography>
        )}

        <Typography
          variant="body2"
          noWrap
          sx={{
            color: 'text.secondary',
          }}
        >
          {config.upstream_url}
        </Typography>

        {status && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              mt: 1,
            }}
          >
            <Chip
              size="small"
              label={t('admin.terraformMirror.chipVersionCount', { count: status.version_count })}
              variant="outlined"
            />
            <Chip
              size="small"
              label={t('admin.terraformMirror.chipPlatformCount', { count: status.platform_count })}
              variant="outlined"
            />
            {status.pending_count > 0 && (
              <Chip
                size="small"
                label={t('admin.terraformMirror.chipPendingCount', { count: status.pending_count })}
                variant="outlined"
                color="warning"
              />
            )}
          </Box>
        )}

        <Box sx={{ mt: 1.5 }}>
          {config.last_sync_status ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SyncStatusChip status={config.last_sync_status} />
              {config.last_sync_at && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {new Date(config.last_sync_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.terraformMirror.neverSynced')}
            </Typography>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Box>
          <Tooltip title={t('admin.terraformMirror.tooltipViewDetails')}>
            <Button size="small" onClick={() => onViewVersions(config)}>
              {t('admin.terraformMirror.viewDetails')}
            </Button>
          </Tooltip>
          <Tooltip title={t('admin.terraformMirror.tooltipViewHistory')}>
            <IconButton
              size="small"
              aria-label={t('admin.terraformMirror.ariaViewHistory')}
              onClick={() => onViewHistory(config)}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box>
          <Tooltip title={t('admin.terraformMirror.tooltipTriggerSync')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('admin.terraformMirror.ariaSyncMirror')}
                onClick={() => onSync(config)}
                disabled={syncing || !config.enabled}
              >
                <SyncIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('admin.terraformMirror.tooltipEditConfig')}>
            <IconButton
              size="small"
              aria-label={t('admin.terraformMirror.ariaEditMirror')}
              onClick={() => onEdit(config)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('admin.terraformMirror.tooltipDeleteMirror')}>
            <IconButton
              size="small"
              aria-label={t('admin.terraformMirror.ariaDeleteMirror')}
              color="error"
              onClick={() => onDelete(config)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardActions>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tool defaults
// ---------------------------------------------------------------------------

const TOOL_DEFAULT_URLS: Record<string, string> = {
  terraform: 'https://releases.hashicorp.com',
  opentofu: 'https://github.com/opentofu/opentofu',
  packer: 'https://releases.hashicorp.com',
  sentinel: 'https://releases.hashicorp.com',
  opa: 'https://github.com/open-policy-agent/opa',
}

/** Returns the canonical upstream URL for a known tool, or '' for custom. */
function toolDefaultUrl(tool: string): string {
  return TOOL_DEFAULT_URLS[tool] ?? ''
}

// ---------------------------------------------------------------------------
// Empty config form helpers
// ---------------------------------------------------------------------------

const emptyCreate = (): CreateTerraformMirrorConfigRequest => ({
  name: '',
  description: '',
  tool: 'terraform',
  upstream_url: toolDefaultUrl('terraform'),
  gpg_verify: true,
  stable_only: false,
  enabled: true,
  sync_interval_hours: 24,
  requires_approval: false,
})

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TerraformMirrorPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ---- create dialog ----
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateTerraformMirrorConfigRequest>(emptyCreate())
  const [createVersionFilter, setCreateVersionFilter] = useState('')
  const [createPlatformFilter, setCreatePlatformFilter] = useState<string[]>([])

  // ---- edit dialog ----
  const [editConfig, setEditConfig] = useState<TerraformMirrorConfig | null>(null)
  const [editForm, setEditForm] = useState<UpdateTerraformMirrorConfigRequest>({})
  const [editVersionFilter, setEditVersionFilter] = useState('')
  const [editPlatformFilter, setEditPlatformFilter] = useState<string[]>([])

  // ---- delete dialog ----
  const [deleteConfig, setDeleteConfig] = useState<TerraformMirrorConfig | null>(null)

  // ---- versions dialog ----
  const [versionsConfig, setVersionsConfig] = useState<TerraformMirrorConfig | null>(null)
  const [versions, setVersions] = useState<TerraformVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [deleteVersion, setDeleteVersion] = useState<TerraformVersion | null>(null)
  const [deletingVersion, setDeletingVersion] = useState(false)

  // ---- status overlay (per-card) ----
  const [statusMap, setStatusMap] = useState<Record<string, TerraformMirrorStatusResponse>>({})

  // ---- history dialog ----
  const [historyConfig, setHistoryConfig] = useState<TerraformMirrorConfig | null>(null)
  const [history, setHistory] = useState<TerraformSyncHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ---- sync in-progress ----
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Load configs via React Query
  // ---------------------------------------------------------------------------
  const {
    data: configs = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<TerraformMirrorConfig[]>({
    queryKey: queryKeys.terraformMirrors.list(),
    queryFn: async () => {
      const data = await api.listTerraformMirrorConfigs()
      return data.configs ?? []
    },
  })

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.terraformMirror.errLoad')))
  }

  // Lazy-load status for each card when configs change
  useEffect(() => {
    configs.forEach(async (c) => {
      try {
        const s = await api.getTerraformMirrorStatus(c.id)
        setStatusMap((prev) => ({ ...prev, [c.id]: s }))
      } catch {
        // ignore status load failures
      }
    })
  }, [configs])

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.createTerraformMirrorConfig({
        ...createForm,
        platform_filter: createPlatformFilter.length > 0 ? createPlatformFilter : undefined,
        version_filter: createVersionFilter.trim() || undefined,
      })
    },
    onSuccess: () => {
      setSuccess(t('admin.terraformMirror.msgCreated', { name: createForm.name }))
      setCreateOpen(false)
      setCreateForm(emptyCreate())
      setCreateVersionFilter('')
      setCreatePlatformFilter([])
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.terraformMirror.errCreate')))
    },
  })

  const handleCreate = () => {
    createMutation.mutate()
  }

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------
  const openEdit = (config: TerraformMirrorConfig) => {
    setEditConfig(config)
    setEditVersionFilter(config.version_filter ?? '')
    setEditPlatformFilter(parsePlatformFilter(config.platform_filter))
    setEditForm({
      name: config.name,
      description: config.description ?? '',
      tool: config.tool,
      enabled: config.enabled,
      upstream_url: config.upstream_url,
      gpg_verify: config.gpg_verify,
      stable_only: config.stable_only,
      sync_interval_hours: config.sync_interval_hours,
      requires_approval: config.requires_approval ?? false,
    })
  }

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editConfig) throw new Error('No config to edit')
      await api.updateTerraformMirrorConfig(editConfig.id, {
        ...editForm,
        platform_filter: editPlatformFilter.length > 0 ? editPlatformFilter : [],
        version_filter: editVersionFilter.trim() || '',
      })
    },
    onSuccess: () => {
      setSuccess(t('admin.terraformMirror.msgUpdated', { name: editConfig?.name }))
      setEditConfig(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.terraformMirror.errUpdate')))
    },
  })

  const handleEdit = () => {
    if (!editConfig) return
    editMutation.mutate()
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteConfig) throw new Error('No config to delete')
      await api.deleteTerraformMirrorConfig(deleteConfig.id)
    },
    onSuccess: () => {
      setSuccess(t('admin.terraformMirror.msgDeleted', { name: deleteConfig?.name }))
      setDeleteConfig(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.terraformMirror.errDelete')))
    },
  })

  const handleDelete = () => {
    if (!deleteConfig) return
    deleteMutation.mutate()
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  const handleSync = async (config: TerraformMirrorConfig) => {
    setSyncingIds((prev) => new Set([...prev, config.id]))
    try {
      await api.triggerTerraformMirrorSync(config.id)
      setSuccess(t('admin.terraformMirror.syncTriggered', { name: config.name }))
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.terraformMirror.errTriggerSync')))
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(config.id)
        return next
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Versions dialog
  // ---------------------------------------------------------------------------
  const openVersions = async (config: TerraformMirrorConfig) => {
    setVersionsConfig(config)
    setVersionsLoading(true)
    setVersions([])
    try {
      const data = await api.listTerraformVersions(config.id, { synced: false })
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
      setVersionsLoading(false)
    }
  }

  const handleDeleteVersion = async () => {
    if (!deleteVersion || !versionsConfig) return
    setDeletingVersion(true)
    try {
      await api.deleteTerraformVersion(versionsConfig.id, deleteVersion.version)
      setSuccess(t('admin.terraformMirror.versionDeleted', { version: deleteVersion.version }))
      setDeleteVersion(null)
      openVersions(versionsConfig)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.terraformMirror.errDeleteVersion')))
      setDeleteVersion(null)
    } finally {
      setDeletingVersion(false)
    }
  }

  // ---------------------------------------------------------------------------
  // History dialog
  // ---------------------------------------------------------------------------
  const openHistory = async (config: TerraformMirrorConfig) => {
    setHistoryConfig(config)
    setHistoryLoading(true)
    setHistory([])
    try {
      const data = await api.getTerraformMirrorHistory(config.id, 20)
      setHistory(data.history ?? [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box aria-busy={loading} aria-live="polite">
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
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Header */}
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h4">{t('admin.terraformMirror.pageTitle')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
                }
                disabled={loading}
              >
                {t('admin.terraformMirror.refresh')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setCreateForm(emptyCreate())
                  setCreateVersionFilter('')
                  setCreatePlatformFilter([])
                  setCreateOpen(true)
                }}
              >
                {t('admin.terraformMirror.addMirror')}
              </Button>
            </Box>
          </Box>

          {/* Help / info banner */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t('admin.terraformMirror.infoBannerBefore')}
              <code>
                /terraform/binaries/&#123;name&#125;/versions/&#123;version&#125;/&#123;os&#125;/&#123;arch&#125;
              </code>
              {t('admin.terraformMirror.infoBannerAfter')}
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* Release signing key status panel */}
          <ReleasesGPGKeyStatus />

          {/* Config cards */}
          {configs.length === 0 ? (
            <Alert severity="info">{t('admin.terraformMirror.emptyState')}</Alert>
          ) : (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {configs.map((cfg) => {
                const status = statusMap[cfg.id]
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={cfg.id}>
                    <ConfigCard
                      config={cfg}
                      status={status}
                      onEdit={openEdit}
                      onDelete={setDeleteConfig}
                      onSync={handleSync}
                      onViewVersions={openVersions}
                      onViewHistory={openHistory}
                      syncing={syncingIds.has(cfg.id)}
                    />
                  </Grid>
                )
              })}
            </Grid>
          )}

          {/* ==================================================================
          Create Dialog
      ================================================================== */}
          <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{t('admin.terraformMirror.dialogTitleCreate')}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={t('admin.terraformMirror.labelName')}
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  helperText={t('admin.terraformMirror.helpName')}
                  required
                  fullWidth
                />
                <TextField
                  label={t('admin.terraformMirror.labelDescription')}
                  value={createForm.description ?? ''}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  select
                  label={t('admin.terraformMirror.labelTool')}
                  value={createForm.tool}
                  onChange={(e) => {
                    const newTool = e.target.value
                    setCreateForm((prev) => {
                      // Auto-update upstream URL only if it still matches the previous tool's default
                      const prevDefault = toolDefaultUrl(prev.tool)
                      const shouldUpdate =
                        prev.upstream_url === prevDefault || prev.upstream_url === ''
                      return {
                        ...prev,
                        tool: newTool,
                        upstream_url: shouldUpdate ? toolDefaultUrl(newTool) : prev.upstream_url,
                      }
                    })
                  }}
                  fullWidth
                >
                  <MenuItem value="terraform">Terraform (HashiCorp)</MenuItem>
                  <MenuItem value="opentofu">OpenTofu</MenuItem>
                  <MenuItem value="packer">Packer (HashiCorp)</MenuItem>
                  <MenuItem value="sentinel">Sentinel (HashiCorp)</MenuItem>
                  <MenuItem value="opa">OPA (Open Policy Agent)</MenuItem>
                  <MenuItem value="custom">{t('admin.terraformMirror.menuCustom')}</MenuItem>
                </TextField>
                <TextField
                  label={t('admin.terraformMirror.labelUpstreamUrl')}
                  value={createForm.upstream_url}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, upstream_url: e.target.value }))
                  }
                  helperText={
                    createForm.tool === 'opentofu'
                      ? t('admin.terraformMirror.helpUrlOpentofu')
                      : createForm.tool === 'terraform'
                        ? t('admin.terraformMirror.helpUrlTerraform')
                        : t('admin.terraformMirror.helpUrlCustom')
                  }
                  required
                  fullWidth
                />
                <TextField
                  label={t('admin.terraformMirror.labelSyncInterval')}
                  type="number"
                  value={createForm.sync_interval_hours ?? 24}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      sync_interval_hours: parseInt(e.target.value, 10),
                    }))
                  }
                  fullWidth
                  slotProps={{
                    htmlInput: { min: 1 },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={createForm.enabled ?? true}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelEnabled')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={createForm.gpg_verify ?? true}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, gpg_verify: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelGpgVerify')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={createForm.stable_only ?? false}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, stable_only: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelStableOnly')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={createForm.requires_approval ?? false}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            requires_approval: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelRequiresApproval')}
                  />
                </Box>
                <TextField
                  label={t('admin.terraformMirror.labelVersionFilter')}
                  value={createVersionFilter}
                  onChange={(e) => setCreateVersionFilter(e.target.value)}
                  helperText={t('admin.terraformMirror.helpVersionFilter')}
                  fullWidth
                />
                <Autocomplete
                  multiple
                  options={KNOWN_PLATFORMS}
                  value={createPlatformFilter}
                  onChange={(_event, newValue) => setCreatePlatformFilter(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('admin.terraformMirror.labelPlatformFilter')}
                      placeholder={
                        createPlatformFilter.length === 0
                          ? t('admin.terraformMirror.placeholderAllPlatforms')
                          : ''
                      }
                      helperText={t('admin.terraformMirror.helpPlatformFilter')}
                      fullWidth
                    />
                  )}
                  renderValue={(value, getItemProps) =>
                    value.map((option, index) => (
                      <Chip label={option} size="small" {...getItemProps({ index })} key={option} />
                    ))
                  }
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateOpen(false)}>
                {t('admin.terraformMirror.cancel')}
              </Button>
              <Button
                onClick={handleCreate}
                variant="contained"
                disabled={createMutation.isPending || !createForm.name || !createForm.upstream_url}
              >
                {createMutation.isPending ? (
                  <CircularProgress size={18} />
                ) : (
                  t('admin.terraformMirror.create')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ==================================================================
          Edit Dialog
      ================================================================== */}
          <Dialog open={!!editConfig} onClose={() => setEditConfig(null)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {t('admin.terraformMirror.dialogTitleEdit', { name: editConfig?.name })}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={t('admin.terraformMirror.labelName')}
                  value={editForm.name ?? ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label={t('admin.terraformMirror.labelDescription')}
                  value={editForm.description ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  select
                  label={t('admin.terraformMirror.labelTool')}
                  value={editForm.tool ?? 'terraform'}
                  onChange={(e) => {
                    const newTool = e.target.value
                    setEditForm((prev) => {
                      const prevDefault = toolDefaultUrl(prev.tool ?? 'terraform')
                      const shouldUpdate =
                        (prev.upstream_url ?? '') === prevDefault ||
                        (prev.upstream_url ?? '') === ''
                      return {
                        ...prev,
                        tool: newTool,
                        upstream_url: shouldUpdate ? toolDefaultUrl(newTool) : prev.upstream_url,
                      }
                    })
                  }}
                  fullWidth
                >
                  <MenuItem value="terraform">Terraform (HashiCorp)</MenuItem>
                  <MenuItem value="opentofu">OpenTofu</MenuItem>
                  <MenuItem value="packer">Packer (HashiCorp)</MenuItem>
                  <MenuItem value="sentinel">Sentinel (HashiCorp)</MenuItem>
                  <MenuItem value="opa">OPA (Open Policy Agent)</MenuItem>
                  <MenuItem value="custom">{t('admin.terraformMirror.menuCustom')}</MenuItem>
                </TextField>
                <TextField
                  label={t('admin.terraformMirror.labelUpstreamUrl')}
                  value={editForm.upstream_url ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, upstream_url: e.target.value }))
                  }
                  helperText={
                    editForm.tool === 'opentofu'
                      ? t('admin.terraformMirror.helpUrlOpentofu')
                      : editForm.tool === 'terraform'
                        ? t('admin.terraformMirror.helpUrlTerraform')
                        : t('admin.terraformMirror.helpUrlCustom')
                  }
                  fullWidth
                />
                <TextField
                  label={t('admin.terraformMirror.labelSyncInterval')}
                  type="number"
                  value={editForm.sync_interval_hours ?? 24}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      sync_interval_hours: parseInt(e.target.value, 10),
                    }))
                  }
                  fullWidth
                  slotProps={{
                    htmlInput: { min: 1 },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.enabled ?? true}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelEnabled')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.gpg_verify ?? true}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, gpg_verify: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelGpgVerify')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.stable_only ?? false}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, stable_only: e.target.checked }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelStableOnly')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.requires_approval ?? false}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            requires_approval: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={t('admin.terraformMirror.labelRequiresApproval')}
                  />
                </Box>
                <TextField
                  label={t('admin.terraformMirror.labelVersionFilter')}
                  value={editVersionFilter}
                  onChange={(e) => setEditVersionFilter(e.target.value)}
                  helperText={t('admin.terraformMirror.helpVersionFilter')}
                  fullWidth
                />
                <Autocomplete
                  multiple
                  options={KNOWN_PLATFORMS}
                  value={editPlatformFilter}
                  onChange={(_event, newValue) => setEditPlatformFilter(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('admin.terraformMirror.labelPlatformFilter')}
                      placeholder={
                        editPlatformFilter.length === 0
                          ? t('admin.terraformMirror.placeholderAllPlatforms')
                          : ''
                      }
                      helperText={t('admin.terraformMirror.helpPlatformFilter')}
                      fullWidth
                    />
                  )}
                  renderValue={(value, getItemProps) =>
                    value.map((option, index) => (
                      <Chip label={option} size="small" {...getItemProps({ index })} key={option} />
                    ))
                  }
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditConfig(null)}>
                {t('admin.terraformMirror.cancel')}
              </Button>
              <Button onClick={handleEdit} variant="contained" disabled={editMutation.isPending}>
                {editMutation.isPending ? (
                  <CircularProgress size={18} />
                ) : (
                  t('admin.terraformMirror.save')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ==================================================================
          Delete Config Dialog
      ================================================================== */}
          <Dialog open={!!deleteConfig} onClose={() => setDeleteConfig(null)}>
            <DialogTitle>{t('admin.terraformMirror.deleteConfigTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.terraformMirror.deleteConfigTextBefore')}
                <strong>{deleteConfig?.name}</strong>
                {t('admin.terraformMirror.deleteConfigTextAfter')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteConfig(null)}>
                {t('admin.terraformMirror.cancel')}
              </Button>
              <Button color="error" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? (
                  <CircularProgress size={18} />
                ) : (
                  t('admin.terraformMirror.delete')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ==================================================================
          Versions Dialog
      ================================================================== */}
          {versionsConfig && (
            <Dialog open onClose={() => setVersionsConfig(null)} maxWidth="lg" fullWidth>
              <DialogTitle>
                {t('admin.terraformMirror.versionsTitle', { name: versionsConfig.name })}
                <Box component="span" sx={{ ml: 1 }}>
                  <ToolChip tool={versionsConfig.tool} />
                </Box>
              </DialogTitle>
              <DialogContent>
                {versionsLoading ? (
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
                          <TableCell align="right">
                            {t('admin.terraformMirror.thActions')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versions.map((v) => (
                          <VersionRow
                            key={v.id}
                            version={v}
                            configId={versionsConfig.id}
                            onDelete={setDeleteVersion}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setVersionsConfig(null)}>
                  {t('admin.terraformMirror.close')}
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {/* ---- Delete Version Confirmation ---- */}
          <Dialog open={!!deleteVersion} onClose={() => setDeleteVersion(null)}>
            <DialogTitle>{t('admin.terraformMirror.deleteVersionTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.terraformMirror.deleteVersionTextBefore')}
                <strong>{deleteVersion?.version}</strong>
                {t('admin.terraformMirror.deleteVersionTextAfter')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteVersion(null)}>
                {t('admin.terraformMirror.cancel')}
              </Button>
              <Button color="error" onClick={handleDeleteVersion} disabled={deletingVersion}>
                {deletingVersion ? (
                  <CircularProgress size={18} />
                ) : (
                  t('admin.terraformMirror.delete')
                )}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ==================================================================
          History Dialog
      ================================================================== */}
          <Dialog
            open={!!historyConfig}
            onClose={() => setHistoryConfig(null)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              {t('admin.terraformMirror.historyTitle', { name: historyConfig?.name })}
            </DialogTitle>
            <DialogContent>
              {historyLoading ? (
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
              <Button onClick={() => setHistoryConfig(null)}>
                {t('admin.terraformMirror.close')}
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      )}
    </Box>
  )
}

export default TerraformMirrorPage
