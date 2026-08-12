import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, Alert, Stack, Button } from '@mui/material'
import BrushIcon from '@mui/icons-material/Brush'
import { BrandingSettingsCard, type UIThemeConfig } from '@4cloudguru/cloud-suite-ui'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'
import api from '../../../services/api'
import { getErrorMessage } from '../../../utils/errors'
import { isSafeExternalUrl } from '../../../utils/externalUrl'
import { isValidBrandingColor } from '../../../utils/brandingValidators'

const BrandingStep: React.FC = () => {
  const { t } = useTranslation()
  const { goToStep, setError, setSuccess, setupToken } = useSetupWizard()

  // Advancing on success keeps the wizard's original one-click "save and move
  // on" flow, and means the card's post-save "reload the page" hint never
  // renders here — reloading mid-setup would drop the user out of the wizard.
  const handleSave = async (config: UIThemeConfig) => {
    try {
      setError(null)
      await api.saveSetupUITheme(setupToken, config)
      setSuccess(t('setup.branding.savedSuccess'))
      goToStep(5)
    } catch (err: unknown) {
      // Rethrown as an Error so the card reports the backend's detail rather
      // than an AxiosError's bare "Request failed with status code 400".
      const message = getErrorMessage(err, t('setup.branding.saveError'))
      setError(message)
      throw new Error(message)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BrushIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          {t('setup.branding.title')}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('setup.branding.description')}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        {t('setup.branding.infoAlert')}
      </Alert>

      <BrandingSettingsCard
        value={{}}
        allowReset={false}
        validators={{ isValidColor: isValidBrandingColor, isValidUrl: isSafeExternalUrl }}
        strings={{
          fields: {
            product_name: {
              label: t('setup.branding.productName'),
              helperText: t('setup.branding.productNameHelp'),
            },
            primary_color: {
              label: t('setup.branding.primaryColor'),
              helperText: t('setup.branding.primaryColorHelp'),
            },
            secondary_color_light: {
              label: t('setup.branding.secondaryColorLight'),
              helperText: t('setup.branding.secondaryColorLightHelp'),
            },
            secondary_color_dark: {
              label: t('setup.branding.secondaryColorDark'),
              helperText: t('setup.branding.secondaryColorDarkHelp'),
            },
            logo_url: {
              label: t('setup.branding.logoUrl'),
              helperText: t('setup.branding.logoUrlHelp'),
            },
            login_hero_url: {
              label: t('setup.branding.heroUrl'),
              helperText: t('setup.branding.heroUrlHelp'),
            },
            favicon_url: {
              label: t('setup.branding.faviconUrl'),
              helperText: t('setup.branding.faviconUrlHelp'),
            },
          },
        }}
        onSave={handleSave}
      />

      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          mt: 3,
        }}
      >
        <Button variant="text" onClick={() => goToStep(3)}>
          {t('setup.branding.back')}
        </Button>
        <Button variant="outlined" onClick={() => goToStep(5)}>
          {t('setup.branding.skip')}
        </Button>
      </Stack>
    </Box>
  )
}

export default BrandingStep
