import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Grid,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { queryKeys } from '../services/queryKeys'
import { getErrorMessage } from '../utils/errors'
import type { StorageConfigResponse, MigrationPlan, StorageMigration } from '../types'

interface StorageMigrationWizardProps {
  open: boolean
  onClose: () => void
  configs: StorageConfigResponse[]
}

const getBackendLabel = (t: TFunction, type: string): string => {
  switch (type) {
    case 'local':
      return t('storageMigration.backendLocal')
    case 'azure':
      return t('storageMigration.backendAzure')
    case 's3':
      return t('storageMigration.backendS3')
    case 'gcs':
      return t('storageMigration.backendGcs')
    default:
      return type
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const StorageMigrationWizard: React.FC<StorageMigrationWizardProps> = ({
  open,
  onClose,
  configs,
}) => {
  const { t } = useTranslation()
  const steps = [
    t('storageMigration.stepSelect'),
    t('storageMigration.stepReview'),
    t('storageMigration.stepExecute'),
    t('storageMigration.stepComplete'),
  ]
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState(0)
  const [sourceConfigId, setSourceConfigId] = useState('')
  const [targetConfigId, setTargetConfigId] = useState('')
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [migrationId, setMigrationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default source to the active config
  React.useEffect(() => {
    if (open && !sourceConfigId) {
      const active = configs.find((c) => c.is_active)
      if (active) setSourceConfigId(active.id)
    }
  }, [open, configs, sourceConfigId])

  // Poll the running migration for progress updates
  const { data: migration } = useQuery<StorageMigration>({
    queryKey: queryKeys.storageMigrations.detail(migrationId ?? ''),
    queryFn: () => api.getStorageMigration(migrationId!),
    enabled: !!migrationId && activeStep === 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'running' || status === 'pending') return 2000
      return false
    },
  })

  // When migration completes or fails, advance to step 3
  React.useEffect(() => {
    if (migration && activeStep === 2) {
      if (migration.status === 'completed' || migration.status === 'failed') {
        setActiveStep(3)
      }
    }
  }, [migration, activeStep])

  const planMutation = useMutation({
    mutationFn: () => api.planStorageMigration(sourceConfigId, targetConfigId),
    onSuccess: (data) => {
      setPlan(data)
      setError(null)
      setActiveStep(1)
    },
    onError: (err) => {
      setError(getErrorMessage(err, t('storageMigration.planError')))
    },
  })

  const startMutation = useMutation({
    mutationFn: () => api.startStorageMigration(sourceConfigId, targetConfigId),
    onSuccess: (data) => {
      setMigrationId(data.id)
      setError(null)
      setActiveStep(2)
    },
    onError: (err) => {
      setError(getErrorMessage(err, t('storageMigration.startError')))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelStorageMigration(migrationId!),
    onSuccess: () => {
      setError(null)
    },
    onError: (err) => {
      setError(getErrorMessage(err, t('storageMigration.cancelError')))
    },
  })

  const handleClose = () => {
    if (migration?.status === 'running') return // Don't allow closing during migration
    // Invalidate queries so the history and configs refresh
    queryClient.invalidateQueries({ queryKey: queryKeys.storageMigrations._def })
    queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def })
    // Reset state
    setActiveStep(0)
    setSourceConfigId('')
    setTargetConfigId('')
    setPlan(null)
    setMigrationId(null)
    setError(null)
    onClose()
  }

  const handleNext = () => {
    if (activeStep === 0) {
      planMutation.mutate()
    } else if (activeStep === 1) {
      startMutation.mutate()
    }
  }

  const handleBack = () => {
    setError(null)
    setActiveStep((prev) => prev - 1)
  }

  const canAdvance = (): boolean => {
    if (activeStep === 0) {
      return !!sourceConfigId && !!targetConfigId && sourceConfigId !== targetConfigId
    }
    if (activeStep === 1) {
      return !!plan
    }
    return false
  }

  const sourceConfig = configs.find((c) => c.id === sourceConfigId)
  const targetConfig = configs.find((c) => c.id === targetConfigId)

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="source-config-label">
                {t('storageMigration.sourceConfiguration')}
              </InputLabel>
              <Select
                labelId="source-config-label"
                value={sourceConfigId}
                label={t('storageMigration.sourceConfiguration')}
                onChange={(e) => setSourceConfigId(e.target.value)}
              >
                {configs.map((config) => (
                  <MenuItem
                    key={config.id}
                    value={config.id}
                    disabled={config.id === targetConfigId}
                  >
                    {getBackendLabel(t, config.backend_type)}
                    {config.is_active ? t('storageMigration.activeSuffix') : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="target-config-label">
                {t('storageMigration.targetConfiguration')}
              </InputLabel>
              <Select
                labelId="target-config-label"
                value={targetConfigId}
                label={t('storageMigration.targetConfiguration')}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__create_new__') {
                    // Open the storage admin page so the user can create a new config,
                    // then return to complete migration.
                    window.open('/admin/storage', '_blank', 'noopener')
                    return
                  }
                  setTargetConfigId(val)
                }}
              >
                {configs.map((config) => (
                  <MenuItem
                    key={config.id}
                    value={config.id}
                    disabled={config.id === sourceConfigId}
                  >
                    {getBackendLabel(t, config.backend_type)}
                    {config.is_active ? t('storageMigration.activeSuffix') : ''}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem
                  value="__create_new__"
                  sx={{ fontStyle: 'italic', color: 'primary.main' }}
                >
                  {t('storageMigration.createNew')}
                </MenuItem>
              </Select>
            </FormControl>

            {sourceConfigId && targetConfigId && sourceConfigId === targetConfigId && (
              <Alert severity="warning">{t('storageMigration.mustBeDifferent')}</Alert>
            )}
          </Box>
        )

      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            {plan && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {t('storageMigration.migrationPlan')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.source')}
                    </Typography>
                    <Typography variant="body1">
                      {sourceConfig
                        ? getBackendLabel(t, sourceConfig.backend_type)
                        : plan.source_config_id}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.target')}
                    </Typography>
                    <Typography variant="body1">
                      {targetConfig
                        ? getBackendLabel(t, targetConfig.backend_type)
                        : plan.target_config_id}
                    </Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.totalArtifacts')}
                    </Typography>
                    <Typography variant="h6">{plan.total_artifacts}</Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.modules')}
                    </Typography>
                    <Typography variant="h6">{plan.total_modules}</Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.providers')}
                    </Typography>
                    <Typography variant="h6">{plan.total_providers}</Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      {t('storageMigration.estimatedSize')}
                    </Typography>
                    <Typography variant="h6">{formatBytes(plan.estimated_size_bytes)}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('storageMigration.startWarning')}
            </Alert>
          </Box>
        )

      case 2:
        return (
          <Box
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          >
            <CircularProgress size={48} />
            <Typography variant="h6">{t('storageMigration.inProgress')}</Typography>
            {migration && (
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('storageMigration.artifactsProgress', {
                      migrated: migration.migrated_artifacts,
                      total: migration.total_artifacts,
                    })}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {migration.total_artifacts > 0
                      ? Math.round((migration.migrated_artifacts / migration.total_artifacts) * 100)
                      : 0}
                    %
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={
                    migration.total_artifacts > 0
                      ? (migration.migrated_artifacts / migration.total_artifacts) * 100
                      : 0
                  }
                  sx={{ height: 10, borderRadius: 5 }}
                />
                {migration.failed_artifacts > 0 && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {t('storageMigration.failedCount', { count: migration.failed_artifacts })}
                  </Typography>
                )}
              </Box>
            )}
            <Button
              variant="outlined"
              color="warning"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {t('storageMigration.cancelMigration')}
            </Button>
          </Box>
        )

      case 3:
        return (
          <Box
            sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          >
            {migration?.status === 'completed' ? (
              <>
                <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
                <Typography variant="h6">{t('storageMigration.complete')}</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('storageMigration.successDetail', {
                    migrated: migration.migrated_artifacts,
                    total: migration.total_artifacts,
                  })}
                </Typography>
                {migration.failed_artifacts > 0 && (
                  <Alert severity="warning" sx={{ width: '100%' }}>
                    {t('storageMigration.failedToMigrate', { count: migration.failed_artifacts })}
                    {migration.error_message &&
                      t('storageMigration.errorSuffix', { error: migration.error_message })}
                  </Alert>
                )}
              </>
            ) : (
              <>
                <ErrorIcon color="error" sx={{ fontSize: 64 }} />
                <Typography variant="h6">{t('storageMigration.failed')}</Typography>
                {migration?.error_message && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    {migration.error_message}
                  </Alert>
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {t('storageMigration.migratedBeforeFailure', {
                    migrated: migration?.migrated_artifacts ?? 0,
                    total: migration?.total_artifacts ?? 0,
                  })}
                </Typography>
              </>
            )}
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="migration-wizard-title"
    >
      <DialogTitle id="migration-wizard-title">{t('storageMigration.wizardTitle')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>
      <DialogActions>
        {activeStep === 3 ? (
          <Button onClick={handleClose} variant="contained">
            {t('storageMigration.done')}
          </Button>
        ) : activeStep === 2 ? null : (
          <>
            <Button onClick={handleClose}>{t('storageMigration.cancel')}</Button>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                disabled={planMutation.isPending || startMutation.isPending}
              >
                {t('storageMigration.back')}
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canAdvance() || planMutation.isPending || startMutation.isPending}
              startIcon={
                planMutation.isPending || startMutation.isPending ? (
                  <CircularProgress size={20} />
                ) : undefined
              }
            >
              {activeStep === 0
                ? t('storageMigration.reviewPlanBtn')
                : t('storageMigration.startMigrationBtn')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default StorageMigrationWizard
