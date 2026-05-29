import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Alert,
  Stack,
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
} from '@mui/material'
import BrushIcon from '@mui/icons-material/Brush'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'
import api from '../../../services/api'
import { getErrorMessage } from '../../../utils/errors'

const BrandingStep: React.FC = () => {
  const { t } = useTranslation()
  const { goToStep, setError, setSuccess, setupToken } = useSetupWizard()

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    product_name: '',
    logo_url: '',
    primary_color: '',
    login_hero_url: '',
    favicon_url: '',
  })

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''))
      await api.saveSetupUITheme(setupToken, payload)
      setSuccess(t('setup.branding.savedSuccess'))
      goToStep(5)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('setup.branding.saveError')))
    } finally {
      setSaving(false)
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
      <Stack spacing={2}>
        <TextField
          fullWidth
          label={t('setup.branding.productName')}
          value={form.product_name}
          onChange={handleChange('product_name')}
          placeholder="Terraform Registry"
          helperText={t('setup.branding.productNameHelp')}
        />

        <TextField
          fullWidth
          label={t('setup.branding.primaryColor')}
          value={form.primary_color}
          onChange={handleChange('primary_color')}
          placeholder="#5C4EE5"
          helperText={t('setup.branding.primaryColorHelp')}
          slotProps={{
            input: {
              startAdornment: form.primary_color?.match(/^#[0-9A-Fa-f]{6}$/) ? (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: form.primary_color,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                </InputAdornment>
              ) : undefined,
            },
          }}
        />

        <TextField
          fullWidth
          label={t('setup.branding.logoUrl')}
          value={form.logo_url}
          onChange={handleChange('logo_url')}
          placeholder="https://example.com/logo.png"
          helperText={t('setup.branding.logoUrlHelp')}
        />

        <TextField
          fullWidth
          label={t('setup.branding.heroUrl')}
          value={form.login_hero_url}
          onChange={handleChange('login_hero_url')}
          placeholder="https://example.com/hero.jpg"
          helperText={t('setup.branding.heroUrlHelp')}
        />

        <TextField
          fullWidth
          label={t('setup.branding.faviconUrl')}
          value={form.favicon_url}
          onChange={handleChange('favicon_url')}
          placeholder="https://example.com/favicon.ico"
          helperText={t('setup.branding.faviconUrlHelp')}
        />

        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
          }}
        >
          <Button variant="text" onClick={() => goToStep(3)}>
            {t('setup.branding.back')}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => goToStep(5)}>
              {t('setup.branding.skip')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : undefined}
            >
              {t('setup.branding.saveContinue')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}

export default BrandingStep
