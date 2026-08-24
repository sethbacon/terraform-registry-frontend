import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, Alert, Stack, TextField, Button, CircularProgress } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'

const AdminUserStep: React.FC = () => {
  const { t } = useTranslation()
  const { adminEmail, setAdminEmail, adminSaving, adminSaved, saveAdmin, goToStep } =
    useSetupWizard()

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          {t('adminUserStep.title')}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('adminUserStep.description')}
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('adminUserStep.platformAdminNote')}
      </Alert>
      <Stack spacing={2}>
        <TextField
          fullWidth
          label={t('adminUserStep.adminEmail')}
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@example.com"
          helperText={t('adminUserStep.emailMustMatch')}
          required
        />

        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => goToStep(4)}>
            {t('adminUserStep.back')}
          </Button>
          <Button
            variant="contained"
            onClick={saveAdmin}
            disabled={adminSaving || !adminEmail.trim() || !adminEmail.includes('@')}
          >
            {adminSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            {t('adminUserStep.configureButton')}
          </Button>
        </Stack>

        {adminSaved && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button variant="contained" color="primary" onClick={() => goToStep(6)}>
              Next: Complete Setup →
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default AdminUserStep
