import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Grid,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Error from '@mui/icons-material/Error';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import WarningAmber from '@mui/icons-material/WarningAmber';
import api from '../../services/api';

function statusChip(status: string) {
  switch (status) {
    case 'clean': return <Chip label="Clean" size="small" color="success" variant="outlined" />;
    case 'findings': return <Chip label="Findings" size="small" color="warning" variant="outlined" />;
    case 'error': return <Chip label="Error" size="small" color="error" variant="outlined" />;
    case 'pending': return <Chip label="Pending" size="small" variant="outlined" />;
    case 'scanning': return <Chip label="Scanning" size="small" color="info" variant="outlined" />;
    default: return <Chip label={status} size="small" variant="outlined" />;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SecurityScanningPage: React.FC = () => {
  const { data: config, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ['scanning', 'config'],
    queryFn: () => api.getScanningConfig(),
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['scanning', 'stats'],
    queryFn: () => api.getScanningStats(),
  });

  const loading = configLoading || statsLoading;
  const error = configError || statsError;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Security Scanning
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Module security scanning configuration and status
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">Failed to load scanning data.</Alert>
      ) : (
        <>
          {/* Configuration */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Configuration</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    icon={config?.enabled ? <CheckCircle /> : <Error />}
                    label={config?.enabled ? 'Enabled' : 'Disabled'}
                    color={config?.enabled ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Scanner Tool</Typography>
                <Typography variant="body1" fontFamily="monospace">{config?.tool || '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Expected Version</Typography>
                <Typography variant="body1" fontFamily="monospace">{config?.expected_version || 'Not pinned'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Severity Threshold</Typography>
                <Typography variant="body1" fontFamily="monospace">{config?.severity_threshold || '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Timeout</Typography>
                <Typography variant="body1" fontFamily="monospace">{config?.timeout || '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Workers / Interval</Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {config?.worker_count ?? '—'} workers, every {config?.scan_interval_mins ?? '—'}m
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Binary Path</Typography>
                {config?.binary_path ? (
                  <Typography variant="body1" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                    {config.binary_path}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    Not reported by backend
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">Detected Version</Typography>
                {config?.detected_version ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Typography variant="body1" fontFamily="monospace">{config.detected_version}</Typography>
                    {config.expected_version && config.detected_version !== config.expected_version && (
                      <Tooltip title={`Expected ${config.expected_version}`}>
                        <WarningAmber fontSize="small" color="warning" />
                      </Tooltip>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    Not reported by backend
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>

          {/* Summary Stats */}
          {stats && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              {[
                { label: 'Total Scans', value: stats.total, icon: <CheckCircle fontSize="small" /> },
                { label: 'Pending', value: stats.pending, icon: <HourglassEmpty fontSize="small" /> },
                { label: 'Clean', value: stats.clean, color: 'success.main' },
                { label: 'Findings', value: stats.findings, color: 'warning.main' },
                { label: 'Errors', value: stats.error, color: 'error.main' },
              ].map((item) => (
                <Paper key={item.label} sx={{ px: 2, py: 1.5, flex: 1, minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: item.color }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}

          {/* Recent Scans */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Recent Scans</Typography>
            <Divider sx={{ mb: 2 }} />
            {!stats?.recent_scans?.length ? (
              <Typography variant="body2" color="text.secondary">
                No scans recorded yet.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Module</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Scanner</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Critical</TableCell>
                      <TableCell align="right">High</TableCell>
                      <TableCell align="right">Medium</TableCell>
                      <TableCell align="right">Low</TableCell>
                      <TableCell align="right">When</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.recent_scans.map((scan) => (
                      <TableRow key={scan.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" noWrap>
                            {scan.namespace}/{scan.module_name}/{scan.system}
                          </Typography>
                        </TableCell>
                        <TableCell>{scan.module_version}</TableCell>
                        <TableCell>{scan.scanner}</TableCell>
                        <TableCell>{statusChip(scan.status)}</TableCell>
                        <TableCell align="right">{scan.critical_count}</TableCell>
                        <TableCell align="right">{scan.high_count}</TableCell>
                        <TableCell align="right">{scan.medium_count}</TableCell>
                        <TableCell align="right">{scan.low_count}</TableCell>
                        <TableCell align="right">
                          <Tooltip title={scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : 'Not scanned yet'}>
                            <Typography variant="caption" color="text.secondary">
                              {scan.scanned_at ? timeAgo(scan.scanned_at) : '—'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Container>
  );
};

export default SecurityScanningPage;
