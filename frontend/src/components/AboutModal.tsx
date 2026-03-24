import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Link,
  CircularProgress,
} from '@mui/material';
import { VersionInfo } from '../types';
import apiClient from '../services/api';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

const AboutModal = ({ open, onClose }: AboutModalProps) => {
  const [backendVersion, setBackendVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.getVersionInfo()
      .then(setBackendVersion)
      .catch(() => setBackendVersion(null))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>About Terraform Registry</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A self-hosted Terraform module and provider registry with support for SCM
          integration, provider mirroring, Terraform binary distribution, and
          multi-tenancy.
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Versions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={`Frontend v${__APP_VERSION__}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Loading backend version…
              </Typography>
            </Box>
          ) : backendVersion ? (
            <Chip
              label={`Backend v${backendVersion.version}`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          ) : (
            <Chip
              label="Backend unavailable"
              size="small"
              variant="outlined"
              color="default"
            />
          )}
        </Box>

        {backendVersion && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              API version: {backendVersion.api_version}
            </Typography>
            {backendVersion.build_date && backendVersion.build_date !== 'unknown' && (
              <Typography variant="body2" color="text.secondary">
                Built: {new Date(backendVersion.build_date).toLocaleString()}
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          License
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Released under the{' '}
          <Link
            href="https://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apache License 2.0
          </Link>
          .
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Source
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Link
            href="https://github.com/sethbacon/terraform-registry-backend"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
          >
            GitHub — Backend
          </Link>
          <Link
            href="https://github.com/sethbacon/terraform-registry-frontend"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
          >
            GitHub — Frontend
          </Link>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutModal;
