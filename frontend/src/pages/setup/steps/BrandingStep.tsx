import React, { useState } from 'react'
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
  const { goToStep, setError, setSuccess } = useSetupWizard()

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
      await api.updateAdminUITheme(payload)
      setSuccess('Branding saved successfully')
      goToStep(5)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save branding'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <BrushIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          White-Label Branding
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize the registry's appearance for your organization. All fields are optional — leave
        any blank to keep the built-in defaults. You can change these settings later from the admin
        panel.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Branding changes take effect immediately. Logo and hero images must be publicly accessible
        URLs (HTTPS recommended).
      </Alert>

      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Product Name"
          value={form.product_name}
          onChange={handleChange('product_name')}
          placeholder="Terraform Registry"
          helperText="Displayed in the browser title, sidebar, and login page"
        />

        <TextField
          fullWidth
          label="Primary Color"
          value={form.primary_color}
          onChange={handleChange('primary_color')}
          placeholder="#5C4EE5"
          helperText="Hex color code for buttons, links, and accent elements"
          InputProps={{
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
          }}
        />

        <TextField
          fullWidth
          label="Logo URL"
          value={form.logo_url}
          onChange={handleChange('logo_url')}
          placeholder="https://example.com/logo.png"
          helperText="Displayed in the sidebar header and on the login page (PNG or SVG, recommended height 40px)"
        />

        <TextField
          fullWidth
          label="Login Page Hero Image URL"
          value={form.login_hero_url}
          onChange={handleChange('login_hero_url')}
          placeholder="https://example.com/hero.jpg"
          helperText="Background image on the login page (wide format, min 1200px wide)"
        />

        <TextField
          fullWidth
          label="Favicon URL"
          value={form.favicon_url}
          onChange={handleChange('favicon_url')}
          placeholder="https://example.com/favicon.ico"
          helperText="Browser tab icon (.ico or .png, 32×32 or 64×64)"
        />

        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="text" onClick={() => goToStep(3)}>
            ← Back
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => goToStep(5)}>
              Skip
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : undefined}
            >
              Save & Continue
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}

export default BrandingStep
