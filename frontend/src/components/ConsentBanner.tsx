import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Paper,
  Slide,
  Stack,
  Switch,
  Typography,
  FormControlLabel,
} from '@mui/material'
import { useConsent } from '../contexts/ConsentContext'

/**
 * GDPR / ePrivacy consent banner. Shown as a bottom sheet when the user
 * has not yet recorded their cookie/telemetry preferences.
 *
 * Users can accept all, reject all (essential only), or customize.
 */
export default function ConsentBanner() {
  const { t } = useTranslation()
  const { hasConsented, preferences, updatePreferences, acceptAll, rejectAll } = useConsent()
  const [showDetails, setShowDetails] = useState(false)

  if (hasConsented) return null

  return (
    <Slide direction="up" in={!hasConsented} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        role="dialog"
        aria-label={t('consentBanner.ariaLabel')}
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
          {t('consentBanner.title')}
        </Typography>
        <Typography
          id="consent-description"
          variant="body2"
          gutterBottom
          sx={{
            color: 'text.secondary',
          }}
        >
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
              label={t('consentBanner.essential')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.errorReporting}
                  onChange={(_, checked) => updatePreferences({ errorReporting: checked })}
                />
              }
              label={t('consentBanner.errorReporting')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.performanceReporting}
                  onChange={(_, checked) => updatePreferences({ performanceReporting: checked })}
                />
              }
              label={t('consentBanner.performanceMonitoring')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.analytics}
                  onChange={(_, checked) => updatePreferences({ analytics: checked })}
                />
              }
              label={t('consentBanner.analytics')}
            />
          </Box>
        )}

        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'flex-end',
            mt: 2,
          }}
        >
          <Button variant="text" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? t('consentBanner.hideDetails') : t('consentBanner.customize')}
          </Button>
          <Button variant="outlined" onClick={rejectAll}>
            {t('consentBanner.rejectAll')}
          </Button>
          <Button variant="contained" onClick={acceptAll}>
            {t('consentBanner.acceptAll')}
          </Button>
        </Stack>
      </Paper>
    </Slide>
  )
}
