import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  AlertTitle,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Divider,
  Chip,
  FormControlLabel,
  Switch,
  Collapse,
  IconButton,
  InputAdornment,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import type {
  SetupStatus,
  OIDCConfigInput,
  StorageConfigInput,
  StorageBackendType,
  SetupTestResult,
} from '../types';

const steps = ['Authenticate', 'OIDC Provider', 'Storage Backend', 'Admin User', 'Complete'];

const SetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Step 0: Token
  const [setupToken, setSetupToken] = useState('');
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  // Step 1: OIDC
  const [oidcForm, setOidcForm] = useState<OIDCConfigInput>({
    name: 'default',
    provider_type: 'generic_oidc',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_url: '',
    scopes: ['openid', 'email', 'profile'],
  });
  const [oidcTesting, setOidcTesting] = useState(false);
  const [oidcTestResult, setOidcTestResult] = useState<SetupTestResult | null>(null);
  const [oidcSaving, setOidcSaving] = useState(false);
  const [oidcSaved, setOidcSaved] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Step 2: Storage
  const [storageForm, setStorageForm] = useState<StorageConfigInput>({
    backend_type: 'local',
    local_base_path: './data/storage',
    local_serve_directly: true,
  });
  const [storageTesting, setStorageTesting] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<SetupTestResult | null>(null);
  const [storageSaving, setStorageSaving] = useState(false);
  const [storageSaved, setStorageSaved] = useState(false);

  // Step 3: Admin
  const [adminEmail, setAdminEmail] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);

  // Step 4: Complete
  const [completing, setCompleting] = useState(false);

  // Check setup status on mount
  const checkSetupStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await apiClient.getSetupStatus();
      setSetupStatus(status);

      if (status.setup_completed) {
        navigate('/', { replace: true });
        return;
      }

      // Pre-fill redirect URL
      if (!oidcForm.redirect_url) {
        const baseUrl = window.location.origin;
        setOidcForm(prev => ({
          ...prev,
          redirect_url: `${baseUrl}/api/v1/auth/callback`,
        }));
      }
    } catch {
      setError('Failed to check setup status');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  // Step 0: Validate token
  const handleValidateToken = async () => {
    try {
      setTokenValidating(true);
      setError(null);
      const result = await apiClient.validateSetupToken(setupToken.trim());
      if (result.valid) {
        setTokenValid(true);
        setSuccess('Setup token verified successfully');
        setActiveStep(1);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid setup token';
      setError(msg);
      setTokenValid(false);
    } finally {
      setTokenValidating(false);
    }
  };

  // Step 1: Test OIDC
  const handleTestOIDC = async () => {
    try {
      setOidcTesting(true);
      setError(null);
      setOidcTestResult(null);
      const result = await apiClient.testOIDCConfig(setupToken, oidcForm);
      setOidcTestResult(result);
      if (!result.success) {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'OIDC test failed');
    } finally {
      setOidcTesting(false);
    }
  };

  // Step 1: Save OIDC
  const handleSaveOIDC = async () => {
    try {
      setOidcSaving(true);
      setError(null);
      await apiClient.saveOIDCConfig(setupToken, oidcForm);
      setOidcSaved(true);
      setSuccess('OIDC provider configured successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save OIDC configuration');
    } finally {
      setOidcSaving(false);
    }
  };

  // Step 2: Test Storage
  const handleTestStorage = async () => {
    try {
      setStorageTesting(true);
      setError(null);
      setStorageTestResult(null);
      const result = await apiClient.testSetupStorageConfig(setupToken, storageForm);
      setStorageTestResult(result);
      if (!result.success) {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Storage test failed');
    } finally {
      setStorageTesting(false);
    }
  };

  // Step 2: Save Storage
  const handleSaveStorage = async () => {
    try {
      setStorageSaving(true);
      setError(null);
      await apiClient.saveSetupStorageConfig(setupToken, storageForm);
      setStorageSaved(true);
      setSuccess('Storage backend configured successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save storage configuration');
    } finally {
      setStorageSaving(false);
    }
  };

  // Step 3: Save Admin
  const handleSaveAdmin = async () => {
    try {
      setAdminSaving(true);
      setError(null);
      await apiClient.configureAdmin(setupToken, { email: adminEmail.trim().toLowerCase() });
      setAdminSaved(true);
      setSuccess('Admin user configured successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to configure admin user');
    } finally {
      setAdminSaving(false);
    }
  };

  // Step 4: Complete
  const handleCompleteSetup = async () => {
    try {
      setCompleting(true);
      setError(null);
      const result = await apiClient.completeSetup(setupToken);
      setSuccess(result.message);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.error || 'Failed to complete setup');
    } finally {
      setCompleting(false);
    }
  };

  const handleBackendChange = (type: StorageBackendType) => {
    const newForm: StorageConfigInput = { backend_type: type };
    switch (type) {
      case 'local':
        newForm.local_base_path = './data/storage';
        newForm.local_serve_directly = true;
        break;
      case 'azure':
        newForm.azure_account_name = '';
        newForm.azure_account_key = '';
        newForm.azure_container_name = '';
        break;
      case 's3':
        newForm.s3_region = '';
        newForm.s3_bucket = '';
        newForm.s3_auth_method = 'access_key';
        newForm.s3_access_key_id = '';
        newForm.s3_secret_access_key = '';
        break;
      case 'gcs':
        newForm.gcs_bucket = '';
        newForm.gcs_project_id = '';
        newForm.gcs_auth_method = 'credentials_file';
        break;
    }
    setStorageForm(newForm);
    setStorageTestResult(null);
    setStorageSaved(false);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (setupStatus?.setup_completed) {
    return null; // Will redirect
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <SettingsIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" gutterBottom>
            Terraform Registry Setup
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure your registry for first-time use. This wizard will guide you through
            setting up OIDC authentication, storage backend, and the initial admin user.
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Alerts */}
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Collapse>
        <Collapse in={!!success}>
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        </Collapse>

        {/* Step 0: Token Authentication */}
        {activeStep === 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Setup Token</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the setup token that was printed to the server logs when the registry started.
              Look for a line containing <code>tfr_setup_</code> in your server output.
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>Finding your setup token</AlertTitle>
              The token is printed once at startup in a framed box. It looks like:{' '}
              <Box component="code" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                tfr_setup_aBcDeFgHiJkLmNoPqRsTuVwXyZ...
              </Box>
              If <code>SETUP_TOKEN_FILE</code> is set, it&apos;s also written to that file.
            </Alert>

            <TextField
              fullWidth
              label="Setup Token"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="tfr_setup_..."
              type="password"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {tokenValid && <CheckCircleIcon color="success" />}
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              onClick={handleValidateToken}
              disabled={!setupToken.trim() || tokenValidating}
              fullWidth
              size="large"
            >
              {tokenValidating ? <CircularProgress size={24} /> : 'Verify Token'}
            </Button>
          </Box>
        )}

        {/* Step 1: OIDC Configuration */}
        {activeStep === 1 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">OIDC Provider Configuration</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure your OpenID Connect provider for user authentication.
              You can use any OIDC-compliant provider (Keycloak, Auth0, Azure AD, Okta, etc.).
            </Typography>

            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Provider Type</InputLabel>
                <Select
                  value={oidcForm.provider_type}
                  label="Provider Type"
                  onChange={(e) => setOidcForm({ ...oidcForm, provider_type: e.target.value as 'generic_oidc' | 'azuread' })}
                >
                  <MenuItem value="generic_oidc">Generic OIDC (Keycloak, Auth0, Okta, etc.)</MenuItem>
                  <MenuItem value="azuread">Azure AD / Entra ID</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Issuer URL"
                value={oidcForm.issuer_url}
                onChange={(e) => setOidcForm({ ...oidcForm, issuer_url: e.target.value })}
                placeholder="https://accounts.google.com"
                helperText="The OIDC issuer URL. Must serve a .well-known/openid-configuration document."
                required
              />

              <TextField
                fullWidth
                label="Client ID"
                value={oidcForm.client_id}
                onChange={(e) => setOidcForm({ ...oidcForm, client_id: e.target.value })}
                required
              />

              <TextField
                fullWidth
                label="Client Secret"
                value={oidcForm.client_secret}
                onChange={(e) => setOidcForm({ ...oidcForm, client_secret: e.target.value })}
                type={showClientSecret ? 'text' : 'password'}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowClientSecret(!showClientSecret)} edge="end">
                        {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Redirect URL"
                value={oidcForm.redirect_url}
                onChange={(e) => setOidcForm({ ...oidcForm, redirect_url: e.target.value })}
                helperText="The OAuth callback URL. Typically: https://your-registry/api/v1/auth/callback"
                required
              />

              <TextField
                fullWidth
                label="Scopes"
                value={(oidcForm.scopes || []).join(' ')}
                onChange={(e) => setOidcForm({ ...oidcForm, scopes: e.target.value.split(/\s+/).filter(Boolean) })}
                helperText="Space-separated OIDC scopes. Must include 'openid'. Defaults: openid email profile"
              />

              {/* Test result */}
              {oidcTestResult && (
                <Alert severity={oidcTestResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
                  {oidcTestResult.message}
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  onClick={handleTestOIDC}
                  disabled={oidcTesting || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret}
                >
                  {oidcTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Test Connection
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveOIDC}
                  disabled={oidcSaving || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret || !oidcForm.redirect_url}
                >
                  {oidcSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Save OIDC Configuration
                </Button>
              </Stack>

              {oidcSaved && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button variant="contained" color="primary" onClick={() => { setActiveStep(2); setError(null); setSuccess(null); }}>
                    Next: Configure Storage →
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 2: Storage Configuration */}
        {activeStep === 2 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Storage Backend Configuration</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure where Terraform modules and providers will be stored.
            </Typography>

            <Stack spacing={2}>
              {/* Backend Type Selection */}
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {(['local', 'azure', 's3', 'gcs'] as StorageBackendType[]).map((type) => (
                  <Chip
                    key={type}
                    label={type === 'local' ? 'Local' : type === 'azure' ? 'Azure Blob' : type === 's3' ? 'AWS S3' : 'Google Cloud'}
                    onClick={() => handleBackendChange(type)}
                    color={storageForm.backend_type === type ? 'primary' : 'default'}
                    variant={storageForm.backend_type === type ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>

              {/* Local Storage Fields */}
              {storageForm.backend_type === 'local' && (
                <>
                  <TextField
                    fullWidth
                    label="Base Path"
                    value={storageForm.local_base_path || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, local_base_path: e.target.value })}
                    helperText="Directory path where files will be stored"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={storageForm.local_serve_directly ?? true}
                        onChange={(e) => setStorageForm({ ...storageForm, local_serve_directly: e.target.checked })}
                      />
                    }
                    label="Serve files directly (recommended for local development)"
                  />
                </>
              )}

              {/* Azure Storage Fields */}
              {storageForm.backend_type === 'azure' && (
                <>
                  <TextField
                    fullWidth
                    label="Account Name"
                    value={storageForm.azure_account_name || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, azure_account_name: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Account Key"
                    type="password"
                    value={storageForm.azure_account_key || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, azure_account_key: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Container Name"
                    value={storageForm.azure_container_name || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, azure_container_name: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="CDN URL (optional)"
                    value={storageForm.azure_cdn_url || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, azure_cdn_url: e.target.value })}
                  />
                </>
              )}

              {/* S3 Storage Fields */}
              {storageForm.backend_type === 's3' && (
                <>
                  <TextField
                    fullWidth
                    label="Region"
                    value={storageForm.s3_region || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, s3_region: e.target.value })}
                    placeholder="us-east-1"
                    required
                  />
                  <TextField
                    fullWidth
                    label="Bucket"
                    value={storageForm.s3_bucket || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, s3_bucket: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Endpoint (optional, for S3-compatible services)"
                    value={storageForm.s3_endpoint || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, s3_endpoint: e.target.value })}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Auth Method</InputLabel>
                    <Select
                      value={storageForm.s3_auth_method || 'access_key'}
                      label="Auth Method"
                      onChange={(e) => setStorageForm({ ...storageForm, s3_auth_method: e.target.value })}
                    >
                      <MenuItem value="access_key">Access Key</MenuItem>
                      <MenuItem value="iam_role">IAM Role</MenuItem>
                      <MenuItem value="assume_role">Assume Role</MenuItem>
                      <MenuItem value="web_identity">Web Identity</MenuItem>
                    </Select>
                  </FormControl>
                  {(storageForm.s3_auth_method === 'access_key' || !storageForm.s3_auth_method) && (
                    <>
                      <TextField
                        fullWidth
                        label="Access Key ID"
                        value={storageForm.s3_access_key_id || ''}
                        onChange={(e) => setStorageForm({ ...storageForm, s3_access_key_id: e.target.value })}
                      />
                      <TextField
                        fullWidth
                        label="Secret Access Key"
                        type="password"
                        value={storageForm.s3_secret_access_key || ''}
                        onChange={(e) => setStorageForm({ ...storageForm, s3_secret_access_key: e.target.value })}
                      />
                    </>
                  )}
                  {storageForm.s3_auth_method === 'assume_role' && (
                    <>
                      <TextField
                        fullWidth
                        label="Role ARN"
                        value={storageForm.s3_role_arn || ''}
                        onChange={(e) => setStorageForm({ ...storageForm, s3_role_arn: e.target.value })}
                      />
                      <TextField
                        fullWidth
                        label="Role Session Name"
                        value={storageForm.s3_role_session_name || ''}
                        onChange={(e) => setStorageForm({ ...storageForm, s3_role_session_name: e.target.value })}
                      />
                    </>
                  )}
                </>
              )}

              {/* GCS Storage Fields */}
              {storageForm.backend_type === 'gcs' && (
                <>
                  <TextField
                    fullWidth
                    label="Bucket"
                    value={storageForm.gcs_bucket || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, gcs_bucket: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Project ID"
                    value={storageForm.gcs_project_id || ''}
                    onChange={(e) => setStorageForm({ ...storageForm, gcs_project_id: e.target.value })}
                    required
                  />
                  <FormControl fullWidth>
                    <InputLabel>Auth Method</InputLabel>
                    <Select
                      value={storageForm.gcs_auth_method || 'credentials_file'}
                      label="Auth Method"
                      onChange={(e) => setStorageForm({ ...storageForm, gcs_auth_method: e.target.value })}
                    >
                      <MenuItem value="credentials_file">Credentials File</MenuItem>
                      <MenuItem value="credentials_json">Credentials JSON</MenuItem>
                      <MenuItem value="default">Application Default Credentials</MenuItem>
                    </Select>
                  </FormControl>
                  {storageForm.gcs_auth_method === 'credentials_file' && (
                    <TextField
                      fullWidth
                      label="Credentials File Path"
                      value={storageForm.gcs_credentials_file || ''}
                      onChange={(e) => setStorageForm({ ...storageForm, gcs_credentials_file: e.target.value })}
                    />
                  )}
                  {storageForm.gcs_auth_method === 'credentials_json' && (
                    <TextField
                      fullWidth
                      label="Credentials JSON"
                      value={storageForm.gcs_credentials_json || ''}
                      onChange={(e) => setStorageForm({ ...storageForm, gcs_credentials_json: e.target.value })}
                      multiline
                      rows={4}
                    />
                  )}
                </>
              )}

              {/* Test result */}
              {storageTestResult && (
                <Alert severity={storageTestResult.success ? 'success' : 'error'}>
                  {storageTestResult.message}
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="text"
                  onClick={() => { setActiveStep(1); setError(null); setSuccess(null); }}
                >
                  ← Back
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleTestStorage}
                  disabled={storageTesting}
                >
                  {storageTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Test Connection
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveStorage}
                  disabled={storageSaving}
                >
                  {storageSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Save Storage Configuration
                </Button>
              </Stack>

              {storageSaved && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button variant="contained" color="primary" onClick={() => { setActiveStep(3); setError(null); setSuccess(null); }}>
                    Next: Configure Admin →
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 3: Admin User */}
        {activeStep === 3 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Initial Admin User</Typography>
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
                <Button
                  variant="text"
                  onClick={() => { setActiveStep(2); setError(null); setSuccess(null); }}
                >
                  ← Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveAdmin}
                  disabled={adminSaving || !adminEmail.trim() || !adminEmail.includes('@')}
                >
                  {adminSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                  Configure Admin User
                </Button>
              </Stack>

              {adminSaved && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button variant="contained" color="primary" onClick={() => { setActiveStep(4); setError(null); setSuccess(null); }}>
                    Next: Complete Setup →
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 4: Complete */}
        {activeStep === 4 && (
          <Box>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Ready to Complete Setup
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Review your configuration below and finalize the setup.
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Summary */}
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
              <Button
                variant="text"
                onClick={() => { setActiveStep(3); setError(null); setSuccess(null); }}
              >
                ← Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleCompleteSetup}
                disabled={completing || !oidcSaved || !storageSaved || !adminSaved}
              >
                {completing ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
                Complete Setup & Finalize
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Headless / cURL instructions */}
      <Paper elevation={1} sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Prefer using the command line?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All setup steps can also be performed via curl or any HTTP client. See the{' '}
          <a href="/api-docs/" target="_blank" rel="noopener noreferrer">
            API documentation
          </a>{' '}
          for details. Use the <code>Authorization: SetupToken YOUR_TOKEN</code> header
          for authentication.
        </Typography>
      </Paper>
    </Container>
  );
};

export default SetupWizardPage;
