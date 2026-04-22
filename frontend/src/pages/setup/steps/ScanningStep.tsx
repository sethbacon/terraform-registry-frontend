import React, { useState } from 'react'
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
  const nextStep = isPending ? 5 : 4
  const nextLabel = isPending ? 'Next: Review & Complete' : 'Next: Configure Admin'

  const canAutoInstall = INSTALLABLE_TOOLS.includes(scanningForm.tool)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ShieldIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          Security Scanning
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Optionally configure a security scanning tool to automatically scan Terraform modules and
        providers for vulnerabilities when they are published.
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
          label="Enable security scanning"
        />

        <Collapse in={scanningForm.enabled}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Scanning Tool</InputLabel>
              <Select
                value={scanningForm.tool}
                label="Scanning Tool"
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
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            {canAutoInstall && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <DownloadIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                  Auto-Install
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Download the official release, verify the SHA256 checksum, and install the binary
                  on the server.
                </Typography>

                <Accordion
                  variant="outlined"
                  disableGutters
                  sx={{ mb: 1.5, '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">Advanced: pin a specific version</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      size="small"
                      label="Version (optional)"
                      value={pinnedVersion}
                      onChange={(e) => setPinnedVersion(e.target.value)}
                      placeholder="e.g. 0.58.0"
                      helperText="Leave blank to install the latest release."
                    />
                  </AccordionDetails>
                </Accordion>

                <Button
                  variant="outlined"
                  startIcon={scanningInstalling ? <CircularProgress size={18} /> : <DownloadIcon />}
                  onClick={() => installScanner(pinnedVersion || undefined)}
                  disabled={scanningInstalling}
                >
                  {scanningInstalling ? 'Installing…' : `Install ${scanningForm.tool}`}
                </Button>

                {scanningInstallResult && (
                  <Alert
                    severity={scanningInstallResult.success ? 'success' : 'error'}
                    sx={{ mt: 1.5 }}
                  >
                    {scanningInstallResult.success ? (
                      <>
                        Installed{' '}
                        <strong>
                          {scanningInstallResult.tool} {scanningInstallResult.version}
                        </strong>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          Path: <code>{scanningInstallResult.binary_path}</code>
                        </Typography>
                        <Typography variant="body2">
                          SHA256: <code>{scanningInstallResult.sha256?.slice(0, 16)}…</code>
                        </Typography>
                      </>
                    ) : (
                      scanningInstallResult.error || 'Installation failed'
                    )}
                  </Alert>
                )}
              </Box>
            )}

            <TextField
              fullWidth
              label="Binary Path"
              value={scanningForm.binary_path || ''}
              onChange={(e) => setScanningForm({ ...scanningForm, binary_path: e.target.value })}
              placeholder={`/usr/local/bin/${scanningForm.tool}`}
              helperText="Path to the scanning tool binary. Leave empty to use the tool from PATH."
            />

            <TextField
              fullWidth
              label="Severity Threshold (optional)"
              value={scanningForm.severity_threshold || ''}
              onChange={(e) =>
                setScanningForm({ ...scanningForm, severity_threshold: e.target.value })
              }
              placeholder="HIGH"
              helperText="Minimum severity to report (e.g. LOW, MEDIUM, HIGH, CRITICAL)"
            />

            {scanningTestResult && (
              <Alert severity={scanningTestResult.success ? 'success' : 'error'}>
                {scanningTestResult.message}
                {scanningTestResult.success && scanningTestResult.version && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Detected version: {scanningTestResult.version}
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
                Test Configuration
              </Button>
              <Button
                variant="contained"
                onClick={saveScanning}
                disabled={scanningSaving || !scanningTestResult?.success}
              >
                {scanningSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                Save Scanning Configuration
              </Button>
            </Stack>
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => goToStep(backStep)}>
            &#8592; Back
          </Button>
          {!scanningForm.enabled && (
            <Button
              variant="outlined"
              onClick={() => {
                setScanningSaved(true)
                goToStep(nextStep)
              }}
            >
              Skip
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
