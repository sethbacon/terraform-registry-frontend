import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Slide,
  Stack,
  Switch,
  Typography,
  FormControlLabel,
} from '@mui/material';
import { useConsent } from '../contexts/ConsentContext';

/**
 * GDPR / ePrivacy consent banner. Shown as a bottom sheet when the user
 * has not yet recorded their cookie/telemetry preferences.
 *
 * Users can accept all, reject all (essential only), or customize.
 */
export default function ConsentBanner() {
  const { hasConsented, preferences, updatePreferences, acceptAll, rejectAll } = useConsent();
  const [showDetails, setShowDetails] = useState(false);

  if (hasConsented) return null;

  return (
    <Slide direction="up" in={!hasConsented} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        role="dialog"
        aria-label="Cookie consent"
        aria-describedby="consent-description"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1500,
          p: 3,
          borderRadius: '12px 12px 0 0',
        }}
      >
        <Typography variant="h6" gutterBottom>
          We value your privacy
        </Typography>
        <Typography id="consent-description" variant="body2" color="text.secondary" gutterBottom>
          We use cookies and similar technologies. Essential cookies are always active. You may
          choose to enable additional categories below. See our{' '}
          <a href="/privacy" style={{ color: 'inherit' }}>
            Privacy Policy
          </a>{' '}
          for details.
        </Typography>

        {showDetails && (
          <Box sx={{ my: 2 }}>
            <FormControlLabel
              control={<Switch checked disabled />}
              label="Essential (always on)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.errorReporting}
                  onChange={(_, checked) => updatePreferences({ errorReporting: checked })}
                />
              }
              label="Error Reporting"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.performanceReporting}
                  onChange={(_, checked) => updatePreferences({ performanceReporting: checked })}
                />
              }
              label="Performance Monitoring"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.analytics}
                  onChange={(_, checked) => updatePreferences({ analytics: checked })}
                />
              }
              label="Analytics"
            />
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
          <Button variant="text" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? 'Hide details' : 'Customize'}
          </Button>
          <Button variant="outlined" onClick={rejectAll}>
            Reject all
          </Button>
          <Button variant="contained" onClick={acceptAll}>
            Accept all
          </Button>
        </Stack>
      </Paper>
    </Slide>
  );
}
