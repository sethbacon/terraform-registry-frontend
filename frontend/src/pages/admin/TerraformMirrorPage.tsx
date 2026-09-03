import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../services/queryKeys'
import PageHeader from '../../components/PageHeader'
import StatusAlerts from '../../components/StatusAlerts'
import PageTitleIcon from '@mui/icons-material/GetApp'
import { Alert, Box, Button, CircularProgress, Container, Grid, Typography } from '@mui/material'
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
} from '../../types/terraform_mirror'
import MirrorConfigCard from './terraformMirror/MirrorConfigCard'
import CreateMirrorDialog, { useCreateMirrorFlow } from './terraformMirror/CreateMirrorDialog'
import EditMirrorDialog, { useEditMirrorFlow } from './terraformMirror/EditMirrorDialog'
import DeleteMirrorDialog, { useDeleteMirrorFlow } from './terraformMirror/DeleteMirrorDialog'
import {
  DeleteVersionDialog,
  MirrorVersionsDialog,
  useMirrorVersionsFlow,
} from './terraformMirror/MirrorVersionsDialog'
import MirrorHistoryDialog, { useMirrorHistoryFlow } from './terraformMirror/MirrorHistoryDialog'

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

  // The five dialog flows. Each hook owns its own dialog's state and requests;
  // the page only holds the flow object so a card's button can open it and the
  // matching dialog can render against it. The versions flow also owns the
  // delete-version confirmation nested inside it, because confirming a delete
  // reloads the version list behind it.
  const create = useCreateMirrorFlow(status)
  const edit = useEditMirrorFlow(status)
  const deleteMirror = useDeleteMirrorFlow(status)
  const versions = useMirrorVersionsFlow(status)
  const history = useMirrorHistoryFlow()

  // ---- status overlay (per-card) ----
  const [statusMap, setStatusMap] = useState<Record<string, TerraformMirrorStatusResponse>>({})

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

          <StatusAlerts status={status} mb={2} order="error-first" dismissible />

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
                      onDelete={deleteMirror.openDialog}
                      onSync={handleSync}
                      onViewVersions={versions.openDialog}
                      onViewHistory={history.openDialog}
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

          <DeleteMirrorDialog flow={deleteMirror} />

          <MirrorVersionsDialog flow={versions} canManage={canManage} />

          <DeleteVersionDialog flow={versions} />

          <MirrorHistoryDialog flow={history} />
        </Container>
      )}
    </Box>
  )
}

export default TerraformMirrorPage
