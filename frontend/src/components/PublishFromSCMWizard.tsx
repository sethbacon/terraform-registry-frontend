import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Chip,
} from '@mui/material';
import { apiClient } from '../services/api';
import RepositoryBrowser from './RepositoryBrowser';
import type { SCMProvider, SCMRepository, SCMTag } from '../types/scm';

interface PublishFromSCMWizardProps {
  moduleId: string;
  moduleSystem?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const steps = ['Select Provider', 'Choose Repository', 'Configure Settings'];

const PublishFromSCMWizard: React.FC<PublishFromSCMWizardProps> = ({
  moduleId,
  moduleSystem,
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [providers, setProviders] = useState<SCMProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<SCMProvider | null>(null);
  const [selectedRepository, setSelectedRepository] = useState<SCMRepository | null>(null);
  const [selectedTag, setSelectedTag] = useState<SCMTag | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    repository_path: '',
    default_branch: 'main',
    auto_publish_enabled: true,
    tag_pattern: 'v*',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await apiClient.listSCMProviders();
      setProviders(Array.isArray(data) ? data.filter((p: SCMProvider) => p.is_active) : []);
    } catch (err: any) {
      setError('Failed to load SCM providers');
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleComplete = async () => {
    if (!selectedProvider || !selectedRepository) {
      setError('Please select a provider and repository');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiClient.linkModuleToSCM(moduleId, {
        provider_id: selectedProvider.id,
        repository_owner: selectedRepository.owner,
        repository_name: selectedRepository.name,
        repository_path: settings.repository_path || undefined,
        default_branch: settings.default_branch,
        auto_publish_enabled: settings.auto_publish_enabled,
        tag_pattern: settings.tag_pattern,
      });

      // If the user selected a specific tag to publish, trigger an immediate sync
      // so that version is imported without requiring a manual "Sync Now" step.
      // Sync runs in the background (202); failures are non-fatal.
      if (selectedTag) {
        try {
          await apiClient.triggerManualSync(moduleId);
        } catch {
          // non-fatal — user can always trigger sync manually from the module page
        }
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to link module to SCM');
    } finally {
      setLoading(false);
    }
  };

  const canProceedToNext = () => {
    switch (activeStep) {
      case 0:
        return selectedProvider !== null;
      case 1:
        return selectedRepository !== null;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const repoNameFilter: RegExp | undefined = moduleSystem
    ? new RegExp(
        '^terraform-' +
          moduleSystem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '-[a-z0-9][a-z0-9-]*$',
        'i'
      )
    : undefined;

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select SCM Provider
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Choose the SCM provider where your module source code is hosted.
            </Typography>

            {providers.length === 0 ? (
              <Alert severity="warning">
                No active SCM providers found. Please configure an SCM provider first.
              </Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={selectedProvider?.id || ''}
                  onChange={(e) => {
                    const provider = providers.find((p) => p.id === e.target.value);
                    setSelectedProvider(provider || null);
                  }}
                  label="Provider"
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.provider_type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Repository
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Select the repository that contains your Terraform module code.
            </Typography>

            {selectedProvider ? (
              <>
                {selectedRepository && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Selected: {selectedRepository.full_name}
                  </Alert>
                )}
                <RepositoryBrowser
                  providerId={selectedProvider.id}
                  selectedRepository={selectedRepository}
                  selectedTag={selectedTag}
                  nameFilter={repoNameFilter}
                  onRepositorySelect={(repo) => {
                    setSelectedRepository(repo);
                    setSelectedTag(null);
                  }}
                  onTagSelect={(repo, tag) => {
                    setSelectedRepository(repo);
                    setSelectedTag(tag);
                  }}
                />

                {selectedRepository && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Publishing Options
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body2" color="textSecondary">
                          Version to publish:
                        </Typography>
                        {selectedTag ? (
                          <Chip
                            label={selectedTag.tag_name}
                            color="primary"
                            size="small"
                            onDelete={() => setSelectedTag(null)}
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary" fontStyle="italic">
                            None selected — expand the repository above and click a tag, or enable auto-publish below.
                          </Typography>
                        )}
                      </Box>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.auto_publish_enabled}
                            onChange={(e) =>
                              setSettings({ ...settings, auto_publish_enabled: e.target.checked })
                            }
                          />
                        }
                        label="Enable automatic publishing on tag push"
                      />
                      {settings.auto_publish_enabled && (
                        <Alert severity="info" sx={{ mt: 0 }}>
                          New versions will be published automatically when matching tags are pushed. Additional settings like tag pattern and branch can be configured in the next step.
                        </Alert>
                      )}
                    </Box>
                  </Paper>
                )}
              </>
            ) : (
              <Alert severity="warning">Please select a provider first</Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure how the module will be published from your SCM repository.
            </Typography>

            {selectedRepository && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Repository
                </Typography>
                <Typography variant="body2">{selectedRepository.full_name}</Typography>
                {selectedTag && (
                  <Box mt={1}>
                    <Chip label={`Tag: ${selectedTag.tag_name}`} size="small" color="primary" />
                    <Chip
                      label={`Commit: ${selectedTag.target_commit.substring(0, 7)}`}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                )}
              </Paper>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Repository Path (optional)"
                fullWidth
                value={settings.repository_path}
                onChange={(e) => setSettings({ ...settings, repository_path: e.target.value })}
                helperText="Subdirectory path if module is not at repository root"
                placeholder="modules/example"
              />

              <TextField
                label="Default Branch"
                fullWidth
                value={settings.default_branch}
                onChange={(e) => setSettings({ ...settings, default_branch: e.target.value })}
                helperText="The main branch for the repository"
              />

              <TextField
                label="Tag Pattern"
                fullWidth
                value={settings.tag_pattern}
                onChange={(e) => setSettings({ ...settings, tag_pattern: e.target.value })}
                helperText="Pattern to match version tags (e.g., v*, release/*)"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.auto_publish_enabled}
                    onChange={(e) =>
                      setSettings({ ...settings, auto_publish_enabled: e.target.checked })
                    }
                  />
                }
                label="Enable automatic publishing on tag push"
              />

              <Alert severity="info">
                When enabled, new versions will be automatically published when matching tags are
                pushed to the repository. Webhooks will be configured automatically.
              </Alert>
            </Box>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
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

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ minHeight: 300 }}>{getStepContent(activeStep)}</Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Box>
              <Button disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleComplete}
                  disabled={loading || !canProceedToNext()}
                >
                  Link Module
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!canProceedToNext()}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default PublishFromSCMWizard;
