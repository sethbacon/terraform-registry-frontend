import React, { useState, useEffect } from 'react'
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
  Radio,
  RadioGroup,
  FormLabel,
} from '@mui/material'
import api from '../services/api'
import { getErrorMessage } from '../utils/errors'
import RepositoryBrowser from './RepositoryBrowser'
import type { SCMProvider, SCMRepository, SCMTag } from '../types/scm'

interface PublishFromSCMWizardProps {
  moduleId: string
  moduleSystem?: string
  onComplete?: () => void
  onCancel?: () => void
}

const steps = ['Select Provider', 'Choose Repository', 'Configure Settings']

type PublishMode = 'sync_all' | 'specific_tag'

const PublishFromSCMWizard: React.FC<PublishFromSCMWizardProps> = ({
  moduleId,
  moduleSystem,
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0)
  const [providers, setProviders] = useState<SCMProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<SCMProvider | null>(null)
  const [selectedRepository, setSelectedRepository] = useState<SCMRepository | null>(null)
  const [selectedTag, setSelectedTag] = useState<SCMTag | null>(null)
  const [publishMode, setPublishMode] = useState<PublishMode>('sync_all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState({
    repository_path: '',
    default_branch: 'main',
    auto_publish_enabled: true,
    tag_pattern: 'v*',
  })

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const data = await api.listSCMProviders()
      setProviders(Array.isArray(data) ? data.filter((p: SCMProvider) => p.is_active) : [])
    } catch (err: unknown) {
      setError('Failed to load SCM providers')
      console.error('Error loading providers:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    // When moving from Step 2 → Step 3, default the publish mode based on
    // whether the user selected a specific tag in the repository browser.
    if (activeStep === 1) {
      setPublishMode(selectedTag ? 'specific_tag' : 'sync_all')
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleComplete = async () => {
    if (!selectedProvider || !selectedRepository) {
      setError('Please select a provider and repository')
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (publishMode === 'specific_tag') {
        if (!selectedTag) {
          setError('Please select a specific tag in Step 2')
          return
        }
        // Link with the exact tag as the pattern and auto-publish disabled.
        // Then trigger an immediate sync so that single version is imported.
        await api.linkModuleToSCM(moduleId, {
          provider_id: selectedProvider.id,
          repository_owner: selectedRepository.owner,
          repository_name: selectedRepository.name,
          repository_path: settings.repository_path || undefined,
          default_branch: settings.default_branch,
          auto_publish_enabled: false,
          tag_pattern: selectedTag.tag_name,
        })
        try {
          await api.triggerManualSync(moduleId)
        } catch {
          // non-fatal — user can trigger sync manually from the module page
        }
      } else {
        await api.linkModuleToSCM(moduleId, {
          provider_id: selectedProvider.id,
          repository_owner: selectedRepository.owner,
          repository_name: selectedRepository.name,
          repository_path: settings.repository_path || undefined,
          default_branch: settings.default_branch,
          auto_publish_enabled: settings.auto_publish_enabled,
          tag_pattern: settings.tag_pattern,
        })
      }

      if (onComplete) {
        onComplete()
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to link module to SCM'))
    } finally {
      setLoading(false)
    }
  }

  const canProceedToNext = () => {
    switch (activeStep) {
      case 0:
        return selectedProvider !== null
      case 1:
        return selectedRepository !== null
      case 2:
        return publishMode === 'sync_all' || selectedTag !== null
      default:
        return false
    }
  }

  const repoNameFilter: RegExp | undefined = moduleSystem
    ? new RegExp(
        '^terraform-' +
          moduleSystem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '-[a-z0-9][a-z0-9-]*$',
        'i',
      )
    : undefined

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
                    const provider = providers.find((p) => p.id === e.target.value)
                    setSelectedProvider(provider || null)
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
        )

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Repository
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Select the repository that contains your Terraform module code. Optionally select a
              specific tag if you only want to publish one version.
            </Typography>

            {selectedProvider ? (
              <RepositoryBrowser
                providerId={selectedProvider.id}
                selectedRepository={selectedRepository}
                selectedTag={selectedTag}
                nameFilter={repoNameFilter}
                onRepositorySelect={(repo) => {
                  setSelectedRepository(repo)
                  setSelectedTag(null)
                }}
                onTagSelect={(repo, tag) => {
                  setSelectedRepository(repo)
                  setSelectedTag(tag)
                }}
              />
            ) : (
              <Alert severity="warning">Please select a provider first</Alert>
            )}
          </Box>
        )

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Choose how versions will be published from this repository.
            </Typography>

            {/* Repository summary */}
            {selectedRepository && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Repository
                </Typography>
                <Typography variant="body2">{selectedRepository.full_name}</Typography>
              </Paper>
            )}

            {/* Publishing mode selection */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                Publishing Mode
              </FormLabel>
              <RadioGroup
                value={publishMode}
                onChange={(e) => setPublishMode(e.target.value as PublishMode)}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 1.5,
                    cursor: 'pointer',
                    borderColor: publishMode === 'sync_all' ? 'primary.main' : 'divider',
                    bgcolor: publishMode === 'sync_all' ? 'action.selected' : 'background.paper',
                  }}
                  onClick={() => setPublishMode('sync_all')}
                >
                  <FormControlLabel
                    value="sync_all"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2">Sync all matching tags</Typography>
                        <Typography variant="body2" color="textSecondary">
                          All existing tags matching the pattern will be imported, and new matching
                          tags can trigger automatic publishing via webhooks.
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    borderColor: publishMode === 'specific_tag' ? 'primary.main' : 'divider',
                    bgcolor:
                      publishMode === 'specific_tag' ? 'action.selected' : 'background.paper',
                  }}
                  onClick={() => setPublishMode('specific_tag')}
                >
                  <FormControlLabel
                    value="specific_tag"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2">Publish specific tag</Typography>
                        <Typography variant="body2" color="textSecondary">
                          Publishes only the single tag you selected. Auto-publish is disabled —
                          future versions must be published manually or via a new sync.
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            {/* Mode-specific settings */}
            {publishMode === 'sync_all' ? (
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

                {settings.auto_publish_enabled && (
                  <Alert severity="info">
                    When enabled, new versions will be automatically published when matching tags
                    are pushed to the repository. Webhooks will be configured automatically.
                  </Alert>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedTag ? (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tag to publish
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Chip label={selectedTag.tag_name} color="primary" size="small" />
                      <Chip
                        label={`Commit: ${selectedTag.target_commit.substring(0, 7)}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1.5 }}>
                      To change the tag, go back to Step 2 and select a different one.
                    </Typography>
                  </Paper>
                ) : (
                  <Alert severity="warning">
                    No tag selected. Go back to Step 2 and select a specific tag from the repository
                    browser.
                  </Alert>
                )}

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

                <Alert severity="info">
                  Only this tag will be published. Auto-publish and tag pattern are not applicable
                  for single-tag publishing.
                </Alert>
              </Box>
            )}
          </Box>
        )

      default:
        return 'Unknown step'
    }
  }

  return (
    <Box aria-busy={loading} aria-live="polite">
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
                <Button variant="contained" onClick={handleNext} disabled={!canProceedToNext()}>
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}

export default PublishFromSCMWizard
