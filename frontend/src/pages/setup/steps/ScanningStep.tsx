import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Stack,
  FormControlLabel,
  Switch,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import ShieldIcon from '@mui/icons-material/Shield'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'

const INSTALLABLE_TOOLS = ['trivy', 'checkov', 'terrascan']

const ScanningStep: React.FC = () => {
  const { t } = useTranslation()
  const {
    setupStatus,
    scanningForm,
    setScanningForm,
    scanningTesting,
    scanningTestResult,
    setScanningTestResult,
    scanningSaving,
    scanningSaved,
    setScanningSaved,
    testScanning,
    saveScanning,
    goToStep,
    scanningInstalling,
    scanningInstallResult,
    installScanner,
  } = useSetupWizard()

  const [pinnedVersion, setPinnedVersion] = useState('')

  const isPending = setupStatus?.pending_feature_setup ?? false
  const backStep = isPending ? 0 : 2
  const nextStep = isPending ? 6 : 4
  const nextLabel = isPending ? t('setup.scanning.nextReview') : t('setup.scanning.nextBranding')

  const canAutoInstall = INSTALLABLE_TOOLS.includes(scanningForm.tool)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ShieldIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          {t('setup.scanning.title')}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('setup.scanning.description')}
      </Typography>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={scanningForm.enabled}
              onChange={(e) => {
                setScanningForm({ ...scanningForm, enabled: e.target.checked })
                setScanningTestResult(null)
                setScanningSaved(false)
              }}
            />
          }
          label={t('setup.scanning.enableLabel')}
        />

        <Collapse in={scanningForm.enabled}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>{t('setup.scanning.toolLabel')}</InputLabel>
              <Select
                value={scanningForm.tool}
                label={t('setup.scanning.toolLabel')}
                onChange={(e) => {
                  setScanningForm({ ...scanningForm, tool: e.target.value })
                  setScanningTestResult(null)
                  setScanningSaved(false)
                }}
              >
                <MenuItem value="trivy">Trivy</MenuItem>
                <MenuItem value="checkov">Checkov</MenuItem>
                <MenuItem value="terrascan">Terrascan</MenuItem>
                <MenuItem value="snyk">Snyk</MenuItem>
                <MenuItem value="custom">{t('setup.scanning.toolCustom')}</MenuItem>
              </Select>
            </FormControl>

            {canAutoInstall && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <DownloadIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  {t('setup.scanning.autoInstall')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mb: 1.5,
                  }}
                >
                  {t('setup.scanning.autoInstallDesc')}
                </Typography>

                <Accordion
                  variant="outlined"
                  disableGutters
                  sx={{ mb: 1.5, '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">{t('setup.scanning.advancedPin')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('setup.scanning.versionOptional')}
                      value={pinnedVersion}
                      onChange={(e) => setPinnedVersion(e.target.value)}
                      placeholder={t('setup.scanning.versionPlaceholder')}
                      helperText={t('setup.scanning.versionHelp')}
                    />
                  </AccordionDetails>
                </Accordion>

                <Button
                  variant="outlined"
                  startIcon={scanningInstalling ? <CircularProgress size={18} /> : <DownloadIcon />}
                  onClick={() => installScanner(pinnedVersion || undefined)}
                  disabled={scanningInstalling}
                >
                  {scanningInstalling
                    ? t('setup.scanning.installing')
                    : t('setup.scanning.installButton', { tool: scanningForm.tool })}
                </Button>

                {scanningInstallResult && (
                  <Alert
                    severity={scanningInstallResult.success ? 'success' : 'error'}
                    sx={{ mt: 1.5 }}
                  >
                    {scanningInstallResult.success ? (
                      <>
                        {t('setup.scanning.installed')}{' '}
                        <strong>
                          {scanningInstallResult.tool} {scanningInstallResult.version}
                        </strong>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {t('setup.scanning.pathLabel')}{' '}
                          <code>{scanningInstallResult.binary_path}</code>
                        </Typography>
                        <Typography variant="body2">
                          SHA256: <code>{scanningInstallResult.sha256?.slice(0, 16)}…</code>
                        </Typography>
                      </>
                    ) : (
                      scanningInstallResult.error || t('setup.scanning.installFailed')
                    )}
                  </Alert>
                )}
              </Box>
            )}

            <TextField
              fullWidth
              label={t('setup.scanning.binaryPath')}
              value={scanningForm.binary_path || ''}
              onChange={(e) => setScanningForm({ ...scanningForm, binary_path: e.target.value })}
              placeholder={`/usr/local/bin/${scanningForm.tool}`}
              helperText={t('setup.scanning.binaryPathHelp')}
            />

            <TextField
              fullWidth
              label={t('setup.scanning.severityThreshold')}
              value={scanningForm.severity_threshold || ''}
              onChange={(e) =>
                setScanningForm({ ...scanningForm, severity_threshold: e.target.value })
              }
              placeholder="HIGH"
              helperText={t('setup.scanning.severityHelp')}
            />

            {scanningTestResult && (
              <Alert severity={scanningTestResult.success ? 'success' : 'error'}>
                {scanningTestResult.message}
                {scanningTestResult.success && scanningTestResult.version && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {t('setup.scanning.detectedVersion', { version: scanningTestResult.version })}
                  </Typography>
                )}
              </Alert>
            )}

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={testScanning}
                disabled={scanningTesting || !scanningForm.tool}
              >
                {scanningTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                {t('setup.scanning.testConfig')}
              </Button>
              <Button
                variant="contained"
                onClick={saveScanning}
                disabled={scanningSaving || !scanningTestResult?.success}
              >
                {scanningSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                {t('setup.scanning.saveConfig')}
              </Button>
            </Stack>
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => goToStep(backStep)}>
            {t('setup.scanning.back')}
          </Button>
          {!scanningForm.enabled && (
            <Button
              variant="outlined"
              onClick={() => {
                setScanningSaved(true)
                goToStep(nextStep)
              }}
            >
              {t('setup.scanning.skip')}
            </Button>
          )}
        </Stack>

        {scanningSaved && scanningForm.enabled && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button variant="contained" color="primary" onClick={() => goToStep(nextStep)}>
              {nextLabel} &#8594;
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default ScanningStep
