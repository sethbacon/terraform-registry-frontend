import React, { useState } from 'react';
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
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { getErrorMessage } from '../utils/errors';
import type { StorageConfigResponse, MigrationPlan, StorageMigration } from '../types';

interface StorageMigrationWizardProps {
  open: boolean;
  onClose: () => void;
  configs: StorageConfigResponse[];
}

const steps = ['Select Source & Target', 'Review Plan', 'Execute & Monitor', 'Complete'];

const getBackendLabel = (type: string): string => {
  switch (type) {
    case 'local':
      return 'Local File System';
    case 'azure':
      return 'Azure Blob Storage';
    case 's3':
      return 'Amazon S3';
    case 'gcs':
      return 'Google Cloud Storage';
    default:
      return type;
  }
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const StorageMigrationWizard: React.FC<StorageMigrationWizardProps> = ({
  open,
  onClose,
  configs,
}) => {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [sourceConfigId, setSourceConfigId] = useState('');
  const [targetConfigId, setTargetConfigId] = useState('');
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default source to the active config
  React.useEffect(() => {
    if (open && !sourceConfigId) {
      const active = configs.find((c) => c.is_active);
      if (active) setSourceConfigId(active.id);
    }
  }, [open, configs, sourceConfigId]);

  // Poll the running migration for progress updates
  const { data: migration } = useQuery<StorageMigration>({
    queryKey: queryKeys.storageMigrations.detail(migrationId ?? ''),
    queryFn: () => api.getStorageMigration(migrationId!),
    enabled: !!migrationId && activeStep === 2,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'running' || status === 'pending') return 2000;
      return false;
    },
  });

  // When migration completes or fails, advance to step 3
  React.useEffect(() => {
    if (migration && activeStep === 2) {
      if (migration.status === 'completed' || migration.status === 'failed') {
        setActiveStep(3);
      }
    }
  }, [migration, activeStep]);

  const planMutation = useMutation({
    mutationFn: () =>
      api.planStorageMigration(sourceConfigId, targetConfigId),
    onSuccess: (data) => {
      setPlan(data);
      setError(null);
      setActiveStep(1);
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Failed to create migration plan'));
    },
  });

  const startMutation = useMutation({
    mutationFn: () =>
      api.startStorageMigration(sourceConfigId, targetConfigId),
    onSuccess: (data) => {
      setMigrationId(data.id);
      setError(null);
      setActiveStep(2);
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Failed to start migration'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelStorageMigration(migrationId!),
    onSuccess: () => {
      setError(null);
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Failed to cancel migration'));
    },
  });

  const handleClose = () => {
    if (migration?.status === 'running') return; // Don't allow closing during migration
    // Invalidate queries so the history and configs refresh
    queryClient.invalidateQueries({ queryKey: queryKeys.storageMigrations._def });
    queryClient.invalidateQueries({ queryKey: queryKeys.storageConfigs._def });
    // Reset state
    setActiveStep(0);
    setSourceConfigId('');
    setTargetConfigId('');
    setPlan(null);
    setMigrationId(null);
    setError(null);
    onClose();
  };

  const handleNext = () => {
    if (activeStep === 0) {
      planMutation.mutate();
    } else if (activeStep === 1) {
      startMutation.mutate();
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const canAdvance = (): boolean => {
    if (activeStep === 0) {
      return !!sourceConfigId && !!targetConfigId && sourceConfigId !== targetConfigId;
    }
    if (activeStep === 1) {
      return !!plan;
    }
    return false;
  };

  const sourceConfig = configs.find((c) => c.id === sourceConfigId);
  const targetConfig = configs.find((c) => c.id === targetConfigId);

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="source-config-label">Source Configuration</InputLabel>
              <Select
                labelId="source-config-label"
                value={sourceConfigId}
                label="Source Configuration"
                onChange={(e) => setSourceConfigId(e.target.value)}
              >
                {configs.map((config) => (
                  <MenuItem key={config.id} value={config.id} disabled={config.id === targetConfigId}>
                    {getBackendLabel(config.backend_type)}
                    {config.is_active ? ' (Active)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="target-config-label">Target Configuration</InputLabel>
              <Select
                labelId="target-config-label"
                value={targetConfigId}
                label="Target Configuration"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__create_new__') {
                    // Open the storage admin page so the user can create a new config,
                    // then return to complete migration.
                    window.open('/admin/storage', '_blank', 'noopener');
                    return;
                  }
                  setTargetConfigId(val);
                }}
              >
                {configs.map((config) => (
                  <MenuItem key={config.id} value={config.id} disabled={config.id === sourceConfigId}>
                    {getBackendLabel(config.backend_type)}
                    {config.is_active ? ' (Active)' : ''}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem value="__create_new__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                  + Create new configuration…
                </MenuItem>
              </Select>
            </FormControl>

            {sourceConfigId && targetConfigId && sourceConfigId === targetConfigId && (
              <Alert severity="warning">Source and target configurations must be different.</Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            {plan && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Migration Plan
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Source</Typography>
                    <Typography variant="body1">
                      {sourceConfig ? getBackendLabel(sourceConfig.backend_type) : plan.source_config_id}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Target</Typography>
                    <Typography variant="body1">
                      {targetConfig ? getBackendLabel(targetConfig.backend_type) : plan.target_config_id}
                    </Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">Total Artifacts</Typography>
                    <Typography variant="h6">{plan.total_artifacts}</Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">Modules</Typography>
                    <Typography variant="h6">{plan.total_modules}</Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">Providers</Typography>
                    <Typography variant="h6">{plan.total_providers}</Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="body2" color="text.secondary">Estimated Size</Typography>
                    <Typography variant="h6">{formatBytes(plan.estimated_size_bytes)}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              Starting this migration will copy all artifacts from the source to the target storage.
              This may take a while depending on the number and size of artifacts.
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={48} />
            <Typography variant="h6">Migration in Progress</Typography>

            {migration && (
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {migration.migrated_artifacts} / {migration.total_artifacts} artifacts
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {migration.total_artifacts > 0
                      ? Math.round((migration.migrated_artifacts / migration.total_artifacts) * 100)
                      : 0}%
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
                    {migration.failed_artifacts} artifact(s) failed
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
              Cancel Migration
            </Button>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {migration?.status === 'completed' ? (
              <>
                <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
                <Typography variant="h6">Migration Complete</Typography>
                <Typography variant="body2" color="text.secondary">
                  Successfully migrated {migration.migrated_artifacts} of {migration.total_artifacts} artifacts.
                </Typography>
                {migration.failed_artifacts > 0 && (
                  <Alert severity="warning" sx={{ width: '100%' }}>
                    {migration.failed_artifacts} artifact(s) failed to migrate.
                    {migration.error_message && ` Error: ${migration.error_message}`}
                  </Alert>
                )}
              </>
            ) : (
              <>
                <ErrorIcon color="error" sx={{ fontSize: 64 }} />
                <Typography variant="h6">Migration Failed</Typography>
                {migration?.error_message && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    {migration.error_message}
                  </Alert>
                )}
                <Typography variant="body2" color="text.secondary">
                  Migrated {migration?.migrated_artifacts ?? 0} of {migration?.total_artifacts ?? 0} artifacts before failure.
                </Typography>
              </>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="migration-wizard-title"
    >
      <DialogTitle id="migration-wizard-title">Storage Migration Wizard</DialogTitle>
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
            Done
          </Button>
        ) : activeStep === 2 ? null : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={planMutation.isPending || startMutation.isPending}>
                Back
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canAdvance() || planMutation.isPending || startMutation.isPending}
              startIcon={
                (planMutation.isPending || startMutation.isPending) ? (
                  <CircularProgress size={20} />
                ) : undefined
              }
            >
              {activeStep === 0 ? 'Review Plan' : 'Start Migration'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default StorageMigrationWizard;
