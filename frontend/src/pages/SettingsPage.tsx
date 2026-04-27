import { Box, Container, FormControlLabel, Paper, Switch, Typography } from '@mui/material'
import { useConsent } from '../contexts/ConsentContext'

/**
 * User-facing settings page where telemetry and consent preferences can be
 * reviewed and updated at any time (GDPR Art 7(3) — right to withdraw consent).
 */
export default function SettingsPage() {
  const { preferences, updatePreferences } = useConsent()

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Telemetry &amp; Privacy
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Control which data you share. Essential cookies required for the site to function cannot
          be disabled. Changes take effect immediately.
        </Typography>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch checked disabled />}
            label="Essential cookies (required)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.errorReporting}
                onChange={(_, checked) => updatePreferences({ errorReporting: checked })}
              />
            }
            label="Error reporting — helps us fix bugs faster"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.performanceReporting}
                onChange={(_, checked) => updatePreferences({ performanceReporting: checked })}
              />
            }
            label="Performance monitoring — Web Vitals and page load metrics"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.analytics}
                onChange={(_, checked) => updatePreferences({ analytics: checked })}
              />
            }
            label="Analytics — usage patterns to improve the product"
          />
        </Box>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        For more information, see our{' '}
        <a href="/privacy" style={{ color: 'inherit' }}>
          Privacy Policy
        </a>
        .
      </Typography>
    </Container>
  )
}
