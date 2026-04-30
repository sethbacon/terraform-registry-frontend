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
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DownloadIcon from '@mui/icons-material/Download'
import type { FindingRow, ModuleScan } from '../types'
import { parseScanFindings } from '../utils/scanParsers'
import ScanDiagnostics from './ScanDiagnostics'

/** Escape a single CSV field value (RFC 4180). */
function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Convert an array of FindingRow records to a CSV string. */
function findingsToCsv(findings: FindingRow[]): string {
  const header = ['Severity', 'Rule ID', 'Title', 'Resource', 'File', 'Resolution']
  const rows = findings.map((f) =>
    [f.severity, f.ruleId, f.title, f.resource, f.file, f.resolution].map(csvEscape).join(','),
  )
  return [header.join(','), ...rows].join('\r\n')
}

/** Trigger a CSV download in the browser. */
function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

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

  const handleDownloadCsv = () => {
    if (findings.length === 0) return
    const date = new Date().toISOString().slice(0, 10)
    const slug = moduleLabel
      ? moduleLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      : 'scan'
    downloadCsv(findingsToCsv(findings), `scan-findings-${slug}-${date}.csv`)
  }

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
              {findings.length > 0 && (
                <Tooltip title="Download findings as CSV">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadCsv}
                    data-testid="findings-csv-download"
                  >
                    Export CSV
                  </Button>
                </Tooltip>
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
