import React from 'react';
import { Box, Typography, Alert, Stack, TextField, Button, CircularProgress } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useSetupWizard } from '../../../contexts/SetupWizardContext';

const AdminUserStep: React.FC = () => {
  const { adminEmail, setAdminEmail, adminSaving, adminSaved, saveAdmin, goToStep } = useSetupWizard();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">Initial Admin User</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Specify the email address of the first admin user. This must match the email
        in your OIDC provider. When this user logs in via OIDC for the first time,
        they will automatically receive admin privileges.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        The admin user will be added to the default organization with the &quot;admin&quot;
        role template, granting full access to all registry features.
      </Alert>

      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Admin Email"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@example.com"
          helperText="This email must match your OIDC provider identity"
          required
        />

        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => goToStep(4)}>← Back</Button>
          <Button
            variant="contained"
            onClick={saveAdmin}
            disabled={adminSaving || !adminEmail.trim() || !adminEmail.includes('@')}
          >
            {adminSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Configure Admin User
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
  );
};

export default AdminUserStep;
