import React from 'react';
import {
  Paper,
  Typography,
  Divider,
  Alert,
  Button,
  Stack,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Warning from '@mui/icons-material/Warning';
import Restore from '@mui/icons-material/Restore';
import { ModuleVersion } from '../types';

interface VersionDetailsPanelProps {
  selectedVersion: ModuleVersion | null;
  canManage: boolean;
  deprecating: boolean;
  onUndeprecate: () => void;
  onOpenDeprecateDialog: () => void;
  onOpenDeleteVersionDialog: (version: string) => void;
}

const VersionDetailsPanel: React.FC<VersionDetailsPanelProps> = ({
  selectedVersion,
  canManage,
  deprecating,
  onUndeprecate,
  onOpenDeprecateDialog,
  onOpenDeleteVersionDialog,
}) => {
  if (!selectedVersion) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Version {selectedVersion.version} Details
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="body2" sx={{ mb: 2 }}>
        <strong>Published:</strong>{' '}
        {(selectedVersion.published_at || selectedVersion.created_at)
          ? new Date(selectedVersion.published_at || selectedVersion.created_at!).toLocaleDateString()
          : 'N/A'}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        <strong>Downloads:</strong> {selectedVersion.download_count ?? 0}
      </Typography>
      {selectedVersion.published_by_name && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>Published By:</strong> {selectedVersion.published_by_name}
        </Typography>
      )}

      {/* Deprecation Status */}
      {selectedVersion.deprecated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Deprecated</strong>
            {selectedVersion.deprecated_at && (
              <> on {new Date(selectedVersion.deprecated_at).toLocaleDateString()}</>
            )}
          </Typography>
          {(selectedVersion.deprecation_message || selectedVersion.deprecation?.reason) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {selectedVersion.deprecation?.reason ?? selectedVersion.deprecation_message}
            </Typography>
          )}
          {(selectedVersion.replacement_source || selectedVersion.deprecation?.link) && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Replacement:</strong>{' '}
              {selectedVersion.deprecation?.link ?? selectedVersion.replacement_source}
            </Typography>
          )}
        </Alert>
      )}

      {canManage && (
        <Stack spacing={1}>
          {selectedVersion.deprecated ? (
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<Restore />}
              onClick={onUndeprecate}
              disabled={deprecating}
              fullWidth
            >
              {deprecating ? 'Removing Deprecation...' : 'Remove Deprecation'}
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<Warning />}
              onClick={onOpenDeprecateDialog}
              fullWidth
            >
              Deprecate Version
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Delete />}
            onClick={() => onOpenDeleteVersionDialog(selectedVersion.version)}
            fullWidth
          >
            Delete This Version
          </Button>
        </Stack>
      )}
    </Paper>
  );
};

export default VersionDetailsPanel;
