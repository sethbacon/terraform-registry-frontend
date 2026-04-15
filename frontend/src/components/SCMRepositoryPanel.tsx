import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Stack,
} from '@mui/material';
import SCMIcon from '@mui/icons-material/AccountTree';
import UnlinkIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import type { ModuleSCMLink } from '../types/scm';

interface SCMRepositoryPanelProps {
  isAuthenticated: boolean;
  scmLinkLoaded: boolean;
  scmLink: ModuleSCMLink | null;
  scmSyncing: boolean;
  scmUnlinking: boolean;
  onSync: () => void;
  onUnlink: () => void;
  onOpenWizard: () => void;
}

const SCMRepositoryPanel: React.FC<SCMRepositoryPanelProps> = ({
  isAuthenticated,
  scmLinkLoaded,
  scmLink,
  scmSyncing,
  scmUnlinking,
  onSync,
  onUnlink,
  onOpenWizard,
}) => {
  if (!isAuthenticated || !scmLinkLoaded) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <SCMIcon fontSize="small" color="action" />
        <Typography variant="h6">Source Repository</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {scmLink ? (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{scmLink.repository_owner}/{scmLink.repository_name}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Branch: {scmLink.default_branch}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Tag pattern: <code>{scmLink.tag_pattern || 'v*'}</code>
          </Typography>
          <Chip
            label={scmLink.auto_publish_enabled ? 'Auto-publish on' : 'Auto-publish off'}
            size="small"
            color={scmLink.auto_publish_enabled ? 'success' : 'default'}
            variant="outlined"
            sx={{ mb: 1.5, fontSize: '0.7rem' }}
          />
          {scmLink.last_sync_at && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              Last synced: {new Date(scmLink.last_sync_at).toLocaleString()}
            </Typography>
          )}
          <Stack spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={scmSyncing ? <CircularProgress size={14} /> : <SyncIcon />}
              onClick={onSync}
              disabled={scmSyncing}
              fullWidth
            >
              {scmSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={scmUnlinking ? <CircularProgress size={14} /> : <UnlinkIcon />}
              onClick={onUnlink}
              disabled={scmUnlinking}
              fullWidth
            >
              {scmUnlinking ? 'Unlinking...' : 'Unlink Repository'}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Not linked to a repository. Link one to enable automatic version publishing.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SCMIcon />}
            onClick={onOpenWizard}
            fullWidth
          >
            Link Repository
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default SCMRepositoryPanel;
