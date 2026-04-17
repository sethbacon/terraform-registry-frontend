import React from 'react';
import { Box, Typography, Divider, Stack, Chip, Alert, AlertTitle, Button, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonIcon from '@mui/icons-material/Person';
import { useSetupWizard } from '../../../contexts/SetupWizardContext';

const ReviewStep: React.FC = () => {
  const {
    oidcForm, oidcSaved,
    storageForm, storageSaved,
    scanningForm, scanningSaved, scanningTestResult,
    adminEmail, adminSaved,
    completing, completeSetup, goToStep,
  } = useSetupWizard();

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" component="h2" gutterBottom>
          Ready to Complete Setup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review your configuration below and finalize the setup.
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body1">
            <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            OIDC Provider
          </Typography>
          {oidcSaved ? (
            <Chip label="Configured" color="success" size="small" icon={<CheckCircleIcon />} />
          ) : (
            <Chip label="Not configured" color="error" size="small" icon={<ErrorIcon />} />
          )}
        </Box>
        {oidcSaved && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
            {oidcForm.provider_type === 'azuread' ? 'Azure AD' : 'Generic OIDC'} — {oidcForm.issuer_url}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body1">
            <StorageIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Storage Backend
          </Typography>
          {storageSaved ? (
            <Chip label="Configured" color="success" size="small" icon={<CheckCircleIcon />} />
          ) : (
            <Chip label="Not configured" color="error" size="small" icon={<ErrorIcon />} />
          )}
        </Box>
        {storageSaved && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
            {storageForm.backend_type.toUpperCase()}
            {storageForm.backend_type === 'local' && ` — ${storageForm.local_base_path}`}
            {storageForm.backend_type === 's3' && ` — ${storageForm.s3_bucket}`}
            {storageForm.backend_type === 'azure' && ` — ${storageForm.azure_container_name}`}
            {storageForm.backend_type === 'gcs' && ` — ${storageForm.gcs_bucket}`}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body1">
            <ShieldIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Security Scanning
          </Typography>
          {scanningSaved ? (
            <Chip
              label={scanningForm.enabled ? 'Configured' : 'Disabled'}
              color={scanningForm.enabled ? 'success' : 'default'}
              size="small"
              icon={scanningForm.enabled ? <CheckCircleIcon /> : undefined}
            />
          ) : (
            <Chip label="Not configured" color="error" size="small" icon={<ErrorIcon />} />
          )}
        </Box>
        {scanningSaved && scanningForm.enabled && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
            {scanningForm.tool}{scanningTestResult?.version ? ` v${scanningTestResult.version}` : ''}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body1">
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
            Admin User
          </Typography>
          {adminSaved ? (
            <Chip label="Configured" color="success" size="small" icon={<CheckCircleIcon />} />
          ) : (
            <Chip label="Not configured" color="error" size="small" icon={<ErrorIcon />} />
          )}
        </Box>
        {adminSaved && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
            {adminEmail}
          </Typography>
        )}
      </Stack>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>This action is permanent</AlertTitle>
        After completing setup, the setup token will be invalidated and these endpoints
        will be permanently disabled. All future configuration changes must be made through
        the authenticated admin interface.
      </Alert>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="text" onClick={() => goToStep(4)}>← Back</Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={completeSetup}
          disabled={completing || !oidcSaved || !storageSaved || !adminSaved}
        >
          {completing ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          Complete Setup & Finalize
        </Button>
      </Stack>
    </Box>
  );
};

export default ReviewStep;
