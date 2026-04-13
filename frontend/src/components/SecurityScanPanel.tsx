import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { ModuleVersion, ModuleScan } from '../types';

interface SecurityScanPanelProps {
  canManage: boolean;
  selectedVersion: ModuleVersion | null;
  moduleScan: ModuleScan | null;
  scanLoading: boolean;
  scanNotFound: boolean;
}

const SecurityScanPanel: React.FC<SecurityScanPanelProps> = ({
  canManage,
  selectedVersion,
  moduleScan,
  scanLoading,
  scanNotFound,
}) => {
  if (!canManage || !selectedVersion) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <SecurityIcon fontSize="small" color="action" />
        <Typography variant="h6">Security Scan</Typography>
        {(moduleScan?.status === 'pending' || moduleScan?.status === 'scanning') && (
          <CircularProgress size={16} sx={{ ml: 'auto' }} />
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />
      {scanLoading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
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
                moduleScan.status === 'clean' ? 'success' :
                  moduleScan.status === 'findings' ? 'warning' :
                    moduleScan.status === 'error' ? 'error' : 'info'
              }
            />
          </Box>
          {moduleScan.status === 'error' && moduleScan.error_message && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
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
              {moduleScan.critical_count === 0 && moduleScan.high_count === 0 &&
                moduleScan.medium_count === 0 && moduleScan.low_count === 0 && (
                  <Typography variant="body2" color="success.main">No findings</Typography>
                )}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" display="block">
            Scanner: {moduleScan.scanner}{moduleScan.scanner_version ? ` ${moduleScan.scanner_version}` : ''}
          </Typography>
          {moduleScan.scanned_at && (
            <Typography variant="caption" color="text.secondary" display="block">
              Scanned: {new Date(moduleScan.scanned_at).toLocaleString()}
            </Typography>
          )}
        </Box>
      ) : null}
    </Paper>
  );
};

export default SecurityScanPanel;
