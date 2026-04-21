import React from 'react';
import { Box, Container, Paper, Typography, Alert, Stepper, Step, StepLabel, Collapse, CircularProgress } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { SetupWizardProvider, useSetupWizard } from '../contexts/SetupWizardContext';
import AuthenticateStep from './setup/steps/AuthenticateStep';
import OIDCStep from './setup/steps/OIDCStep';
import StorageStep from './setup/steps/StorageStep';
import ScanningStep from './setup/steps/ScanningStep';
import AdminUserStep from './setup/steps/AdminUserStep';
import ReviewStep from './setup/steps/ReviewStep';

const steps = ['Authenticate', 'Identity Provider', 'Storage Backend', 'Security Scanning', 'Admin User', 'Complete'];

const stepComponents: Record<number, React.FC> = {
  0: AuthenticateStep,
  1: OIDCStep,
  2: StorageStep,
  3: ScanningStep,
  4: AdminUserStep,
  5: ReviewStep,
};

const SetupWizardShell: React.FC = () => {
  const { loading, setupStatus, activeStep, error, setError, success, setSuccess } = useSetupWizard();

  if (!loading && setupStatus?.setup_completed && !setupStatus?.pending_feature_setup) return null;

  const isPending = setupStatus?.pending_feature_setup ?? false;
  const StepComponent = stepComponents[activeStep];

  // In pending-feature mode, show only Token + the unconfigured steps + Complete
  const pendingSteps = isPending
    ? [
      { label: 'Authenticate', index: 0 },
      ...(!setupStatus?.scanning_configured ? [{ label: 'Security Scanning', index: 3 }] : []),
      { label: 'Complete', index: 5 },
    ]
    : steps.map((label, index) => ({ label, index }));

  // Map the activeStep to the stepper's visual position
  const visualActiveStep = pendingSteps.findIndex((s) => s.index === activeStep);

  return (
    <Box aria-busy={loading} aria-live="polite">
      {loading ? (
        <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Container>
      ) : (
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <SettingsIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                {isPending ? 'Configure New Features' : 'Terraform Registry Setup'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {isPending
                  ? 'New features have been added that require configuration. Your existing OIDC, storage, and admin settings are preserved.'
                  : 'Configure your registry for first-time use. This wizard will guide you through setting up OIDC authentication, storage backend, and the initial admin user.'}
              </Typography>
            </Box>

            <Stepper activeStep={visualActiveStep} sx={{ mb: 4 }} alternativeLabel aria-label="Setup progress">
              {pendingSteps.map(({ label }) => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
              ))}
            </Stepper>

            <Collapse in={!!error}>
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
            </Collapse>
            <Collapse in={!!success}>
              <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>
            </Collapse>

            {StepComponent && <StepComponent />}
          </Paper>

          <Paper elevation={1} sx={{ p: 3, mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Prefer using the command line?</Typography>
            <Typography variant="body2" color="text.secondary">
              All setup steps can also be performed via curl or any HTTP client. See the{' '}
              <a href="/api-docs/" target="_blank" rel="noopener noreferrer">API documentation</a>{' '}
              for details. Use the <code>Authorization: SetupToken YOUR_TOKEN</code> header
              for authentication.
            </Typography>
          </Paper>
        </Container>
      )}
    </Box>
  );
};

const SetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <SetupWizardProvider
      onSetupCompleted={() => navigate('/', { replace: true })}
      onSetupFinalized={() => navigate('/login', { replace: true })}
    >
      <SetupWizardShell />
    </SetupWizardProvider>
  );
};

export default SetupWizardPage;
