import React, { useState } from 'react';
import {
  Box, Typography, Stack, FormControl, InputLabel, Select, MenuItem, TextField,
  InputAdornment, IconButton, Alert, Button, CircularProgress,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSetupWizard } from '../../../contexts/SetupWizardContext';

const OIDCStep: React.FC = () => {
  const {
    oidcForm, setOidcForm, oidcTesting, oidcTestResult, oidcSaving, oidcSaved,
    testOIDC, saveOIDC, goToStep,
  } = useSetupWizard();
  const [showClientSecret, setShowClientSecret] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">OIDC Provider Configuration</Typography>
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
                <IconButton onClick={() => setShowClientSecret(!showClientSecret)} edge="end" aria-label="Toggle password visibility">
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

        {oidcTestResult && (
          <Alert severity={oidcTestResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
            {oidcTestResult.message}
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={testOIDC}
            disabled={oidcTesting || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret}
          >
            {oidcTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Test Connection
          </Button>
          <Button
            variant="contained"
            onClick={saveOIDC}
            disabled={oidcSaving || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret || !oidcForm.redirect_url}
          >
            {oidcSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Save OIDC Configuration
          </Button>
        </Stack>

        {oidcSaved && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button variant="contained" color="primary" onClick={() => goToStep(2)}>
              Next: Configure Storage →
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default OIDCStep;
