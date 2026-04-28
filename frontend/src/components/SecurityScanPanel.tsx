import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Button,
  Collapse,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ScanDiagnostics from './ScanDiagnostics'
import ScanFindingsModal from './ScanFindingsModal'
import { ModuleVersion, ModuleScan } from '../types'

interface SecurityScanPanelProps {
  canManage: boolean
  selectedVersion: ModuleVersion | null
  moduleScan: ModuleScan | null
  scanLoading: boolean
  scanNotFound: boolean
  scanNotConfigured?: boolean
  onRescan?: () => void
  rescanPending?: boolean
}

const SecurityScanPanel: React.FC<SecurityScanPanelProps> = ({
  canManage,
  selectedVersion,
  moduleScan,
  scanLoading,
  scanNotFound,
  scanNotConfigured = false,
  onRescan,
  rescanPending = false,
}) => {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [findingsOpen, setFindingsOpen] = useState(false)

  if (!canManage || !selectedVersion) return null

  const scanInProgress =
    moduleScan?.status === 'pending' || moduleScan?.status === 'scanning' || rescanPending

  const hasDiagnostics = Boolean(
    moduleScan?.execution_log ||
    (moduleScan?.raw_results && Object.keys(moduleScan.raw_results).length > 0),
  )

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <SecurityIcon fontSize="small" color="action" />
        <Typography variant="h6">Security Scan</Typography>
        {scanInProgress && <CircularProgress size={16} sx={{ ml: 'auto' }} />}
        {onRescan && !scanInProgress && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRescan}
            sx={{ ml: 'auto' }}
            data-testid="rescan-button"
          >
            Re-scan
          </Button>
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />
      {scanLoading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
      ) : scanNotConfigured ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Security scanning is not configured on this registry. Set up a scanner binary path in the
          backend configuration to enable scanning.
        </Alert>
      ) : scanNotFound ? (
        <Typography variant="body2" color="text.secondary">
          No scan available for this version.
        </Typography>
      ) : moduleScan ? (
        <Box>
          <Box mb={1.5}>
            <Chip
              label={moduleScan.status}
              size="small"
              color={
                moduleScan.status === 'clean'
                  ? 'success'
                  : moduleScan.status === 'findings'
                    ? 'warning'
                    : moduleScan.status === 'error'
                      ? 'error'
                      : 'info'
              }
              onClick={moduleScan.status === 'findings' ? () => setFindingsOpen(true) : undefined}
              sx={moduleScan.status === 'findings' ? { cursor: 'pointer' } : {}}
              data-testid="scan-status-chip"
            />
          </Box>
          {moduleScan.status === 'error' && moduleScan.error_message && (
            <Alert severity="error" sx={{ mb: 1.5 }} data-testid="scan-error-alert">
              {moduleScan.error_message}
            </Alert>
          )}
          {(moduleScan.status === 'findings' || moduleScan.status === 'clean') && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
              {moduleScan.critical_count > 0 && (
                <Chip label={`Critical: ${moduleScan.critical_count}`} size="small" color="error" />
              )}
              {moduleScan.high_count > 0 && (
                <Chip label={`High: ${moduleScan.high_count}`} size="small" color="warning" />
              )}
              {moduleScan.medium_count > 0 && (
                <Chip label={`Medium: ${moduleScan.medium_count}`} size="small" />
              )}
              {moduleScan.low_count > 0 && (
                <Chip label={`Low: ${moduleScan.low_count}`} size="small" />
              )}
              {moduleScan.critical_count === 0 &&
                moduleScan.high_count === 0 &&
                moduleScan.medium_count === 0 &&
                moduleScan.low_count === 0 && (
                  <Typography variant="body2" color="success.main">
                    No findings
                  </Typography>
                )}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" display="block">
            Scanner: {moduleScan.scanner}
            {moduleScan.scanner_version ? ` ${moduleScan.scanner_version}` : ''}
          </Typography>
          {moduleScan.scanned_at && (
            <Typography variant="caption" color="text.secondary" display="block">
              Scanned: {new Date(moduleScan.scanned_at).toLocaleString()}
            </Typography>
          )}
          {hasDiagnostics && (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setDiagnosticsOpen((prev) => !prev)}
                startIcon={diagnosticsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                data-testid="scan-diagnostics-toggle"
                sx={{ textTransform: 'none', mb: 1 }}
              >
                {diagnosticsOpen ? 'Hide' : 'Show'} scanner output
              </Button>
              <Collapse in={diagnosticsOpen} unmountOnExit>
                <ScanDiagnostics
                  errorMessage={null}
                  executionLog={moduleScan.execution_log}
                  rawResults={moduleScan.raw_results}
                />
              </Collapse>
            </Box>
          )}
        </Box>
      ) : null}
      <ScanFindingsModal
        open={findingsOpen}
        onClose={() => setFindingsOpen(false)}
        scan={moduleScan}
      />
    </Paper>
  )
}

export default SecurityScanPanel
