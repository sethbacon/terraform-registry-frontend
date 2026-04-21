import React, { useState } from 'react';
import {
  Box, Typography, Stack, FormControl, InputLabel, Select, MenuItem, TextField,
  InputAdornment, IconButton, Alert, Button, CircularProgress, ToggleButtonGroup,
  ToggleButton, FormControlLabel, Switch, Collapse, Divider,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSetupWizard } from '../../../contexts/SetupWizardContext';

// === OIDC sub-form ===
const OIDCFields: React.FC = () => {
  const {
    oidcForm, setOidcForm, oidcTesting, oidcTestResult, oidcSaving, oidcSaved,
    testOIDC, saveOIDC,
  } = useSetupWizard();
  const [showClientSecret, setShowClientSecret] = useState(false);

  return (
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

      <TextField fullWidth label="Issuer URL" value={oidcForm.issuer_url}
        onChange={(e) => setOidcForm({ ...oidcForm, issuer_url: e.target.value })}
        placeholder="https://accounts.google.com"
        helperText="The OIDC issuer URL. Must serve a .well-known/openid-configuration document."
        required />

      <TextField fullWidth label="Client ID" value={oidcForm.client_id}
        onChange={(e) => setOidcForm({ ...oidcForm, client_id: e.target.value })} required />

      <TextField fullWidth label="Client Secret" value={oidcForm.client_secret}
        onChange={(e) => setOidcForm({ ...oidcForm, client_secret: e.target.value })}
        type={showClientSecret ? 'text' : 'password'} required
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowClientSecret(!showClientSecret)} edge="end"
                aria-label="Toggle password visibility">
                {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }} />

      <TextField fullWidth label="Redirect URL" value={oidcForm.redirect_url}
        onChange={(e) => setOidcForm({ ...oidcForm, redirect_url: e.target.value })}
        helperText="The OAuth callback URL. Typically: https://your-registry/api/v1/auth/callback"
        required />

      <TextField fullWidth label="Scopes"
        value={(oidcForm.scopes || []).join(' ')}
        onChange={(e) => setOidcForm({ ...oidcForm, scopes: e.target.value.split(/\s+/).filter(Boolean) })}
        helperText="Space-separated OIDC scopes. Must include 'openid'. Defaults: openid email profile" />

      {oidcTestResult && (
        <Alert severity={oidcTestResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
          {oidcTestResult.message}
        </Alert>
      )}

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={testOIDC}
          disabled={oidcTesting || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret}>
          {oidcTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Test Connection
        </Button>
        <Button variant="contained" onClick={saveOIDC}
          disabled={oidcSaving || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret || !oidcForm.redirect_url}>
          {oidcSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Save OIDC Configuration
        </Button>
      </Stack>

      {oidcSaved && (
        <Alert severity="success" sx={{ mt: 1 }}>OIDC provider configured successfully.</Alert>
      )}
    </Stack>
  );
};

// === LDAP sub-form ===
const LDAPFields: React.FC = () => {
  const {
    ldapForm, setLdapForm, ldapTesting, ldapTestResult, ldapSaving, ldapSaved,
    testLDAP, saveLDAP,
  } = useSetupWizard();
  const [showBindPassword, setShowBindPassword] = useState(false);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">Connection</Typography>
      <Stack direction="row" spacing={2}>
        <TextField sx={{ flex: 3 }} label="LDAP Host" value={ldapForm.host}
          onChange={(e) => setLdapForm({ ...ldapForm, host: e.target.value })}
          placeholder="ldap.example.com" required />
        <TextField sx={{ flex: 1 }} label="Port" type="number" value={ldapForm.port || ''}
          onChange={(e) => setLdapForm({ ...ldapForm, port: parseInt(e.target.value) || 0 })}
          helperText="389 or 636" />
      </Stack>

      <Stack direction="row" spacing={2}>
        <FormControlLabel control={<Switch checked={ldapForm.use_tls}
          onChange={(e) => setLdapForm({ ...ldapForm, use_tls: e.target.checked })} />}
          label="Use TLS (LDAPS)" />
        <FormControlLabel control={<Switch checked={ldapForm.start_tls}
          onChange={(e) => setLdapForm({ ...ldapForm, start_tls: e.target.checked })} />}
          label="StartTLS" />
        <FormControlLabel control={<Switch checked={ldapForm.insecure_skip_verify}
          onChange={(e) => setLdapForm({ ...ldapForm, insecure_skip_verify: e.target.checked })} />}
          label="Skip TLS Verify" />
      </Stack>

      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Service Account</Typography>

      <TextField fullWidth label="Bind DN" value={ldapForm.bind_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, bind_dn: e.target.value })}
        placeholder="cn=svc-registry,ou=service-accounts,dc=example,dc=com" required />

      <TextField fullWidth label="Bind Password" value={ldapForm.bind_password}
        onChange={(e) => setLdapForm({ ...ldapForm, bind_password: e.target.value })}
        type={showBindPassword ? 'text' : 'password'} required
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowBindPassword(!showBindPassword)} edge="end"
                aria-label="Toggle password visibility">
                {showBindPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }} />

      <Divider />
      <Typography variant="subtitle2" color="text.secondary">User Search</Typography>

      <TextField fullWidth label="Base DN" value={ldapForm.base_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, base_dn: e.target.value })}
        placeholder="dc=example,dc=com" required />

      <TextField fullWidth label="User Filter" value={ldapForm.user_filter}
        onChange={(e) => setLdapForm({ ...ldapForm, user_filter: e.target.value })}
        placeholder="(sAMAccountName=%s)"
        helperText="LDAP search filter. %s is replaced with the username." required />

      <Stack direction="row" spacing={2}>
        <TextField sx={{ flex: 1 }} label="Email Attribute" value={ldapForm.user_attr_email}
          onChange={(e) => setLdapForm({ ...ldapForm, user_attr_email: e.target.value })}
          placeholder="mail" />
        <TextField sx={{ flex: 1 }} label="Name Attribute" value={ldapForm.user_attr_name}
          onChange={(e) => setLdapForm({ ...ldapForm, user_attr_name: e.target.value })}
          placeholder="displayName" />
      </Stack>

      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Group Lookup (Optional)</Typography>

      <TextField fullWidth label="Group Base DN" value={ldapForm.group_base_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, group_base_dn: e.target.value })}
        placeholder="ou=groups,dc=example,dc=com" />

      <Stack direction="row" spacing={2}>
        <TextField sx={{ flex: 1 }} label="Group Filter" value={ldapForm.group_filter}
          onChange={(e) => setLdapForm({ ...ldapForm, group_filter: e.target.value })} />
        <TextField sx={{ flex: 1 }} label="Group Member Attr" value={ldapForm.group_member_attr}
          onChange={(e) => setLdapForm({ ...ldapForm, group_member_attr: e.target.value })}
          placeholder="member" />
      </Stack>

      {ldapTestResult && (
        <Alert severity={ldapTestResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
          {ldapTestResult.message}
        </Alert>
      )}

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={testLDAP}
          disabled={ldapTesting || !ldapForm.host || !ldapForm.bind_dn || !ldapForm.bind_password || !ldapForm.base_dn || !ldapForm.user_filter}>
          {ldapTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Test Connection
        </Button>
        <Button variant="contained" onClick={saveLDAP}
          disabled={ldapSaving || !ldapForm.host || !ldapForm.bind_dn || !ldapForm.bind_password || !ldapForm.base_dn || !ldapForm.user_filter}>
          {ldapSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Save LDAP Configuration
        </Button>
      </Stack>

      {ldapSaved && (
        <Alert severity="success" sx={{ mt: 1 }}>LDAP configuration saved successfully.</Alert>
      )}
    </Stack>
  );
};

// === Main step component ===
const OIDCStep: React.FC = () => {
  const { authMethod, setAuthMethod, oidcSaved, ldapSaved, goToStep } = useSetupWizard();
  const saved = authMethod === 'oidc' ? oidcSaved : ldapSaved;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">Identity Provider</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose how users will authenticate to the registry. Select one method below.
      </Typography>

      <ToggleButtonGroup
        value={authMethod}
        exclusive
        onChange={(_, v) => { if (v) setAuthMethod(v as 'oidc' | 'ldap'); }}
        sx={{ mb: 3 }}
        fullWidth
      >
        <ToggleButton value="oidc">OpenID Connect (OIDC)</ToggleButton>
        <ToggleButton value="ldap">LDAP / Active Directory</ToggleButton>
      </ToggleButtonGroup>

      <Collapse in={authMethod === 'oidc'}><OIDCFields /></Collapse>
      <Collapse in={authMethod === 'ldap'}><LDAPFields /></Collapse>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="text" onClick={() => goToStep(0)}>← Back</Button>
          {saved && (
            <Button variant="contained" color="primary" onClick={() => goToStep(2)}>
              Next: Configure Storage →
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default OIDCStep;
