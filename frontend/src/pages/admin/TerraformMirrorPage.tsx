import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../services/queryKeys'
import PageHeader from '../../components/PageHeader'
import StatusAlerts from '../../components/StatusAlerts'
import PageTitleIcon from '@mui/icons-material/GetApp'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'

import api from '../../services/api'
import { useStatusMessage } from '../../hooks/useStatusMessage'
import { getErrorMessage } from '../../utils/errors'
import { useAuth } from '../../contexts/AuthContext'
import ReleasesGPGKeyStatus from '../../components/ReleasesGPGKeyStatus'
import {
  type TerraformMirrorConfig,
  type TerraformMirrorStatusResponse,
  type TerraformVersion,
  type TerraformSyncHistory,
} from '../../types/terraform_mirror'
import { SyncStatusChip, ToolChip } from './terraformMirror/StatusChips'
import MirrorConfigCard from './terraformMirror/MirrorConfigCard'
import MirrorVersionRow from './terraformMirror/MirrorVersionRow'
import CreateMirrorDialog, { useCreateMirrorFlow } from './terraformMirror/CreateMirrorDialog'
import EditMirrorDialog, { useEditMirrorFlow } from './terraformMirror/EditMirrorDialog'

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TerraformMirrorPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  // The route itself is gated at mirrors:read (view-only) so auditors/viewers
  // can browse mirror configurations (routeScopes.ts). Add/Edit/Delete config
  // and Delete-version, plus Trigger-Sync, mutate mirror state though, so
  // canManage additionally gates those controls on mirrors:manage/admin — a
  // mirrors:read-only viewer would otherwise see fully actionable controls
  // that only fail once clicked (#609).
  const canManage = allowedScopes.includes('admin') || allowedScopes.includes('mirrors:manage')
  const status = useStatusMessage()

  const create = useCreateMirrorFlow(status)

  const edit = useEditMirrorFlow(status)
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

  if (queryError && !status.error) {
    status.setError(getErrorMessage(queryError, t('admin.terraformMirror.errLoad')))
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
  // Delete
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteConfig) throw new Error('No config to delete')
      await api.deleteTerraformMirrorConfig(deleteConfig.id)
    },
    onSuccess: () => {
      status.setSuccess(t('admin.terraformMirror.msgDeleted', { name: deleteConfig?.name }))
      setDeleteConfig(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.terraformMirrors._def })
    },
    onError: (err: unknown) => {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errDelete')))
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
      status.setSuccess(t('admin.terraformMirror.syncTriggered', { name: config.name }))
    } catch (err: unknown) {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errTriggerSync')))
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
      status.setSuccess(
        t('admin.terraformMirror.versionDeleted', { version: deleteVersion.version }),
      )
      setDeleteVersion(null)
      openVersions(versionsConfig)
    } catch (err: unknown) {
      status.setError(getErrorMessage(err, t('admin.terraformMirror.errDeleteVersion')))
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
          <PageHeader
            icon={<PageTitleIcon />}
            title={t('admin.terraformMirror.pageTitle')}
            actions={
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
                {canManage && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={create.openDialog}>
                    {t('admin.terraformMirror.addMirror')}
                  </Button>
                )}
              </Box>
            }
          />

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

          <StatusAlerts status={status} mb={2} />

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
                    <MirrorConfigCard
                      config={cfg}
                      status={status}
                      onEdit={edit.openDialog}
                      onDelete={setDeleteConfig}
                      onSync={handleSync}
                      onViewVersions={openVersions}
                      onViewHistory={openHistory}
                      syncing={syncingIds.has(cfg.id)}
                      canManage={canManage}
                    />
                  </Grid>
                )
              })}
            </Grid>
          )}

          <CreateMirrorDialog flow={create} />

          <EditMirrorDialog flow={edit} />

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
                          <MirrorVersionRow
                            key={v.id}
                            version={v}
                            configId={versionsConfig.id}
                            onDelete={setDeleteVersion}
                            canManage={canManage}
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
