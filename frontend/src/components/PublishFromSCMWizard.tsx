import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

type PublishMode = 'sync_all' | 'specific_tag'

const PublishFromSCMWizard: React.FC<PublishFromSCMWizardProps> = ({
  moduleId,
  moduleSystem,
  onComplete,
  onCancel,
}) => {
  const { t } = useTranslation()
  const steps = [
    t('scmWizard.stepSelectProvider'),
    t('scmWizard.stepChooseRepository'),
    t('scmWizard.stepConfigureSettings'),
  ]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const data = await api.listSCMProviders()
      setProviders(Array.isArray(data) ? data.filter((p: SCMProvider) => p.is_active) : [])
    } catch (err: unknown) {
      setError(t('scmWizard.loadProvidersError'))
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
      setError(t('scmWizard.selectProviderRepoError'))
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (publishMode === 'specific_tag') {
        if (!selectedTag) {
          setError(t('scmWizard.selectTagError'))
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
          tag_pattern: selectedTag.name,
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
      setError(getErrorMessage(err, t('scmWizard.linkError')))
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
              {t('scmWizard.step0Title')}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                marginBottom: '16px',
              }}
            >
              {t('scmWizard.step0Desc')}
            </Typography>
            {providers.length === 0 ? (
              <Alert severity="warning">{t('scmWizard.noProviders')}</Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>{t('scmWizard.providerLabel')}</InputLabel>
                <Select
                  value={selectedProvider?.id || ''}
                  onChange={(e) => {
                    const provider = providers.find((p) => p.id === e.target.value)
                    setSelectedProvider(provider || null)
                  }}
                  label={t('scmWizard.providerLabel')}
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
              {t('scmWizard.step1Title')}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                marginBottom: '16px',
              }}
            >
              {t('scmWizard.step1Desc')}
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
              <Alert severity="warning">{t('scmWizard.selectProviderFirst')}</Alert>
            )}
          </Box>
        )

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('scmWizard.step2Title')}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                marginBottom: '16px',
              }}
            >
              {t('scmWizard.step2Desc')}
            </Typography>
            {/* Repository summary */}
            {selectedRepository && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('scmWizard.selectedRepository')}
                </Typography>
                <Typography variant="body2">{selectedRepository.full_name}</Typography>
              </Paper>
            )}
            {/* Publishing mode selection */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
                {t('scmWizard.publishingMode')}
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
                        <Typography variant="subtitle2">{t('scmWizard.syncAll')}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {t('scmWizard.syncAllDesc')}
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
                        <Typography variant="subtitle2">
                          {t('scmWizard.publishSpecific')}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {t('scmWizard.publishSpecificDesc')}
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
                  label={t('scmWizard.repositoryPath')}
                  fullWidth
                  value={settings.repository_path}
                  onChange={(e) => setSettings({ ...settings, repository_path: e.target.value })}
                  helperText={t('scmWizard.repositoryPathHelp')}
                  placeholder="modules/example"
                />

                <TextField
                  label={t('scmWizard.defaultBranch')}
                  fullWidth
                  value={settings.default_branch}
                  onChange={(e) => setSettings({ ...settings, default_branch: e.target.value })}
                  helperText={t('scmWizard.defaultBranchHelp')}
                />

                <TextField
                  label={t('scmWizard.tagPattern')}
                  fullWidth
                  value={settings.tag_pattern}
                  onChange={(e) => setSettings({ ...settings, tag_pattern: e.target.value })}
                  helperText={t('scmWizard.tagPatternHelp')}
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
                  label={t('scmWizard.autoPublishLabel')}
                />

                {settings.auto_publish_enabled && (
                  <Alert severity="info">{t('scmWizard.autoPublishInfo')}</Alert>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedTag ? (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('scmWizard.tagToPublish')}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Chip label={selectedTag.name} color="primary" size="small" />
                      <Chip
                        label={t('scmWizard.commitLabel', {
                          commit: selectedTag.commit_sha.substring(0, 7),
                        })}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1.5 }}>
                      {t('scmWizard.changeTagHint')}
                    </Typography>
                  </Paper>
                ) : (
                  <Alert severity="warning">{t('scmWizard.noTagSelected')}</Alert>
                )}

                <TextField
                  label={t('scmWizard.repositoryPath')}
                  fullWidth
                  value={settings.repository_path}
                  onChange={(e) => setSettings({ ...settings, repository_path: e.target.value })}
                  helperText={t('scmWizard.repositoryPathHelp')}
                  placeholder="modules/example"
                />

                <TextField
                  label={t('scmWizard.defaultBranch')}
                  fullWidth
                  value={settings.default_branch}
                  onChange={(e) => setSettings({ ...settings, default_branch: e.target.value })}
                  helperText={t('scmWizard.defaultBranchHelp')}
                />

                <Alert severity="info">{t('scmWizard.singleTagInfo')}</Alert>
              </Box>
            )}
          </Box>
        )

      default:
        return t('scmWizard.unknownStep')
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 4,
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ minHeight: 300 }}>{getStepContent(activeStep)}</Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onCancel}>{t('scmWizard.cancel')}</Button>
            <Box>
              <Button disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>
                {t('scmWizard.back')}
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button variant="contained" onClick={handleComplete} disabled={!canProceedToNext()}>
                  {t('scmWizard.linkModule')}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} disabled={!canProceedToNext()}>
                  {t('scmWizard.next')}
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
