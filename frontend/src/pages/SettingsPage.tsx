import { Box, Container, FormControlLabel, Paper, Switch, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useConsent } from '../contexts/ConsentContext'

/**
 * User-facing settings page where telemetry and consent preferences can be
 * reviewed and updated at any time (GDPR Art 7(3) — right to withdraw consent).
 */
export default function SettingsPage() {
  const { t } = useTranslation()
  const { preferences, updatePreferences } = useConsent()

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('settingsPage.title')}
      </Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('settingsPage.telemetryPrivacy')}
        </Typography>
        <Typography
          variant="body2"
          gutterBottom
          sx={{
            color: 'text.secondary',
          }}
        >
          {t('settingsPage.description')}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch checked disabled />}
            label={t('settingsPage.essentialRequired')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.errorReporting}
                onChange={(_, checked) => updatePreferences({ errorReporting: checked })}
              />
            }
            label={t('settingsPage.errorReporting')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.performanceReporting}
                onChange={(_, checked) => updatePreferences({ performanceReporting: checked })}
              />
            }
            label={t('settingsPage.performanceMonitoring')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.analytics}
                onChange={(_, checked) => updatePreferences({ analytics: checked })}
              />
            }
            label={t('settingsPage.analytics')}
          />
        </Box>
      </Paper>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        For more information, see our{' '}
        <a href="/privacy" style={{ color: 'inherit' }}>
          Privacy Policy
        </a>
        .
      </Typography>
    </Container>
  )
}
