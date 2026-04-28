import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Stack,
  Button,
  Collapse,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { ModuleScan } from '../types'
import { parseScanFindings } from '../utils/scanParsers'
import ScanDiagnostics from './ScanDiagnostics'

interface ScanFindingsModalProps {
  open: boolean
  onClose: () => void
  scan: ModuleScan | null
  loading?: boolean
  moduleLabel?: string
}

function severityColor(severity: string): 'error' | 'warning' | 'default' | 'info' {
  switch (severity) {
    case 'CRITICAL':
      return 'error'
    case 'HIGH':
      return 'warning'
    case 'MEDIUM':
      return 'default'
    case 'LOW':
      return 'info'
    default:
      return 'default'
  }
}

const ScanFindingsModal: React.FC<ScanFindingsModalProps> = ({
  open,
  onClose,
  scan,
  loading = false,
  moduleLabel,
}) => {
  const [rawOpen, setRawOpen] = useState(false)

  const findings = scan ? parseScanFindings(scan.scanner, scan.raw_results) : []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <Typography variant="h6" component="span">
          Scan Findings
        </Typography>
        {moduleLabel && (
          <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
            {moduleLabel}
          </Typography>
        )}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="close"
          data-testid="findings-modal-close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress data-testid="findings-loading" />
          </Box>
        ) : !scan ? (
          <Typography color="text.secondary">No scan data available.</Typography>
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                {scan.scanner}
                {scan.scanner_version ? ` ${scan.scanner_version}` : ''}
              </Typography>
              {scan.scanned_at && (
                <Typography variant="body2" color="text.secondary">
                  {new Date(scan.scanned_at).toLocaleString()}
                </Typography>
              )}
              <Box sx={{ flexGrow: 1 }} />
              {scan.critical_count > 0 && (
                <Chip label={`Critical: ${scan.critical_count}`} size="small" color="error" />
              )}
              {scan.high_count > 0 && (
                <Chip label={`High: ${scan.high_count}`} size="small" color="warning" />
              )}
              {scan.medium_count > 0 && (
                <Chip label={`Medium: ${scan.medium_count}`} size="small" />
              )}
              {scan.low_count > 0 && (
                <Chip label={`Low: ${scan.low_count}`} size="small" color="info" />
              )}
            </Stack>

            {findings.length > 0 ? (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Severity</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 160 }}>Rule ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Resource</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 120 }}>File</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Resolution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {findings.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip
                            label={row.severity}
                            size="small"
                            color={severityColor(row.severity)}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {row.ruleId}
                        </TableCell>
                        <TableCell>{row.title}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {row.resource}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {row.file}
                        </TableCell>
                        <TableCell>{row.resolution}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Could not parse individual findings from scanner output.
              </Typography>
            )}

            {scan.raw_results && Object.keys(scan.raw_results).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setRawOpen((prev) => !prev)}
                  startIcon={rawOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ textTransform: 'none' }}
                  data-testid="findings-raw-toggle"
                >
                  {rawOpen ? 'Hide' : 'Show'} raw JSON
                </Button>
                <Collapse in={rawOpen} unmountOnExit>
                  <ScanDiagnostics rawResults={scan.raw_results} maxBlockHeight={300} />
                </Collapse>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ScanFindingsModal
