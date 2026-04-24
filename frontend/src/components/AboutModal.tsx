import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useThemeMode } from '../contexts/ThemeContext';
import i18n from '../i18n';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

const AboutModal = ({ open, onClose }: AboutModalProps) => {
  const { t } = useTranslation();
  const [backendVersion, setBackendVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { productName } = useThemeMode();

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
      <DialogTitle>{t('about.title', { productName })}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('about.description')}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          {t('about.versions')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={t('about.frontendVersion', { version: __APP_VERSION__ })}
            size="small"
            color="primary"
            variant="outlined"
          />
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                {t('about.loadingBackendVersion')}
              </Typography>
            </Box>
          ) : backendVersion ? (
            <Chip
              label={t('about.backendVersion', { version: backendVersion.version })}
              size="small"
              color="secondary"
              variant="outlined"
            />
          ) : (
            <Chip
              label={t('about.backendUnavailable')}
              size="small"
              variant="outlined"
              color="default"
            />
          )}
        </Box>

        {backendVersion && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('about.apiVersion', { version: backendVersion.api_version })}
            </Typography>
            {backendVersion.build_date && backendVersion.build_date !== 'unknown' && (
              <Typography variant="body2" color="text.secondary">
                {t('about.built', {
                  date: new Intl.DateTimeFormat(i18n.language).format(
                    new Date(backendVersion.build_date),
                  ),
                })}
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          {t('about.license')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('about.licenseIntro')}{' '}
          <Link
            href="https://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('about.apacheLicense')}
          </Link>
          .
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          {t('about.source')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Link
            href="https://github.com/sethbacon/terraform-registry-backend"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
          >
            {t('about.githubBackend')}
          </Link>
          <Link
            href="https://github.com/sethbacon/terraform-registry-frontend"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
          >
            {t('about.githubFrontend')}
          </Link>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('about.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutModal;
