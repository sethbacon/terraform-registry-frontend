import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  Button,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Switch,
  Collapse,
  Divider,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'

// === OIDC sub-form ===
const OIDCFields: React.FC = () => {
  const { t } = useTranslation()
  const {
    oidcForm,
    setOidcForm,
    oidcTesting,
    oidcTestResult,
    oidcSaving,
    oidcSaved,
    testOIDC,
    saveOIDC,
  } = useSetupWizard()
  const [showClientSecret, setShowClientSecret] = useState(false)

  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel>{t('setup.oidc.labelProviderType')}</InputLabel>
        <Select
          value={oidcForm.provider_type}
          label={t('setup.oidc.labelProviderType')}
          onChange={(e) =>
            setOidcForm({
              ...oidcForm,
              provider_type: e.target.value as 'generic_oidc' | 'azuread',
            })
          }
        >
          <MenuItem value="generic_oidc">{t('setup.oidc.menuGenericOidc')}</MenuItem>
          <MenuItem value="azuread">Azure AD / Entra ID</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        label={t('setup.oidc.labelIssuerUrl')}
        value={oidcForm.issuer_url}
        onChange={(e) => setOidcForm({ ...oidcForm, issuer_url: e.target.value })}
        placeholder="https://accounts.google.com"
        helperText={t('setup.oidc.helpIssuerUrl')}
        required
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelClientId')}
        value={oidcForm.client_id}
        onChange={(e) => setOidcForm({ ...oidcForm, client_id: e.target.value })}
        required
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelClientSecret')}
        value={oidcForm.client_secret}
        onChange={(e) => setOidcForm({ ...oidcForm, client_secret: e.target.value })}
        type={showClientSecret ? 'text' : 'password'}
        required
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  edge="end"
                  aria-label={t('setup.oidc.ariaTogglePassword')}
                >
                  {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelRedirectUrl')}
        value={oidcForm.redirect_url}
        onChange={(e) => setOidcForm({ ...oidcForm, redirect_url: e.target.value })}
        helperText={t('setup.oidc.helpRedirectUrl')}
        required
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelScopes')}
        value={(oidcForm.scopes || []).join(' ')}
        onChange={(e) =>
          setOidcForm({ ...oidcForm, scopes: e.target.value.split(/\s+/).filter(Boolean) })
        }
        helperText={t('setup.oidc.helpScopes')}
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
          disabled={
            oidcTesting || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret
          }
        >
          {oidcTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {t('setup.oidc.testConnection')}
        </Button>
        <Button
          variant="contained"
          onClick={saveOIDC}
          disabled={
            oidcSaving ||
            !oidcForm.issuer_url ||
            !oidcForm.client_id ||
            !oidcForm.client_secret ||
            !oidcForm.redirect_url
          }
        >
          {oidcSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {t('setup.oidc.saveOidc')}
        </Button>
      </Stack>
      {oidcSaved && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {t('setup.oidc.oidcConfigured')}
        </Alert>
      )}
    </Stack>
  )
}

// === LDAP sub-form ===
const LDAPFields: React.FC = () => {
  const { t } = useTranslation()
  const {
    ldapForm,
    setLdapForm,
    ldapTesting,
    ldapTestResult,
    ldapSaving,
    ldapSaved,
    testLDAP,
    saveLDAP,
  } = useSetupWizard()
  const [showBindPassword, setShowBindPassword] = useState(false)

  return (
    <Stack spacing={2}>
      <Typography
        variant="subtitle2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('setup.oidc.sectionConnection')}
      </Typography>
      <Stack direction="row" spacing={2}>
        <TextField
          sx={{ flex: 3 }}
          label={t('setup.oidc.labelLdapHost')}
          value={ldapForm.host}
          onChange={(e) => setLdapForm({ ...ldapForm, host: e.target.value })}
          placeholder="ldap.example.com"
          required
        />
        <TextField
          sx={{ flex: 1 }}
          label={t('setup.oidc.labelPort')}
          type="number"
          value={ldapForm.port || ''}
          onChange={(e) => setLdapForm({ ...ldapForm, port: parseInt(e.target.value) || 0 })}
          helperText={t('setup.oidc.helpPort')}
        />
      </Stack>
      <Stack direction="row" spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={ldapForm.use_tls}
              onChange={(e) => setLdapForm({ ...ldapForm, use_tls: e.target.checked })}
            />
          }
          label={t('setup.oidc.labelUseTls')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={ldapForm.start_tls}
              onChange={(e) => setLdapForm({ ...ldapForm, start_tls: e.target.checked })}
            />
          }
          label={t('setup.oidc.labelStartTls')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={ldapForm.insecure_skip_verify}
              onChange={(e) => setLdapForm({ ...ldapForm, insecure_skip_verify: e.target.checked })}
            />
          }
          label={t('setup.oidc.labelSkipTlsVerify')}
        />
      </Stack>
      <Divider />
      <Typography
        variant="subtitle2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('setup.oidc.sectionServiceAccount')}
      </Typography>
      <TextField
        fullWidth
        label={t('setup.oidc.labelBindDn')}
        value={ldapForm.bind_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, bind_dn: e.target.value })}
        placeholder="cn=svc-registry,ou=service-accounts,dc=example,dc=com"
        required
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelBindPassword')}
        value={ldapForm.bind_password}
        onChange={(e) => setLdapForm({ ...ldapForm, bind_password: e.target.value })}
        type={showBindPassword ? 'text' : 'password'}
        required
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowBindPassword(!showBindPassword)}
                  edge="end"
                  aria-label={t('setup.oidc.ariaTogglePassword')}
                >
                  {showBindPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Divider />
      <Typography
        variant="subtitle2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('setup.oidc.sectionUserSearch')}
      </Typography>
      <TextField
        fullWidth
        label={t('setup.oidc.labelBaseDn')}
        value={ldapForm.base_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, base_dn: e.target.value })}
        placeholder="dc=example,dc=com"
        required
      />
      <TextField
        fullWidth
        label={t('setup.oidc.labelUserFilter')}
        value={ldapForm.user_filter}
        onChange={(e) => setLdapForm({ ...ldapForm, user_filter: e.target.value })}
        placeholder="(sAMAccountName=%s)"
        helperText={t('setup.oidc.helpUserFilter')}
        required
      />
      <Stack direction="row" spacing={2}>
        <TextField
          sx={{ flex: 1 }}
          label={t('setup.oidc.labelEmailAttr')}
          value={ldapForm.user_attr_email}
          onChange={(e) => setLdapForm({ ...ldapForm, user_attr_email: e.target.value })}
          placeholder="mail"
        />
        <TextField
          sx={{ flex: 1 }}
          label={t('setup.oidc.labelNameAttr')}
          value={ldapForm.user_attr_name}
          onChange={(e) => setLdapForm({ ...ldapForm, user_attr_name: e.target.value })}
          placeholder="displayName"
        />
      </Stack>
      <Divider />
      <Typography
        variant="subtitle2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {t('setup.oidc.sectionGroupLookup')}
      </Typography>
      <TextField
        fullWidth
        label={t('setup.oidc.labelGroupBaseDn')}
        value={ldapForm.group_base_dn}
        onChange={(e) => setLdapForm({ ...ldapForm, group_base_dn: e.target.value })}
        placeholder="ou=groups,dc=example,dc=com"
      />
      <Stack direction="row" spacing={2}>
        <TextField
          sx={{ flex: 1 }}
          label={t('setup.oidc.labelGroupFilter')}
          value={ldapForm.group_filter}
          onChange={(e) => setLdapForm({ ...ldapForm, group_filter: e.target.value })}
        />
        <TextField
          sx={{ flex: 1 }}
          label={t('setup.oidc.labelGroupMemberAttr')}
          value={ldapForm.group_member_attr}
          onChange={(e) => setLdapForm({ ...ldapForm, group_member_attr: e.target.value })}
          placeholder="member"
        />
      </Stack>
      {ldapTestResult && (
        <Alert severity={ldapTestResult.success ? 'success' : 'error'} sx={{ mt: 1 }}>
          {ldapTestResult.message}
        </Alert>
      )}
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          onClick={testLDAP}
          disabled={
            ldapTesting ||
            !ldapForm.host ||
            !ldapForm.bind_dn ||
            !ldapForm.bind_password ||
            !ldapForm.base_dn ||
            !ldapForm.user_filter
          }
        >
          {ldapTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {t('setup.oidc.testConnection')}
        </Button>
        <Button
          variant="contained"
          onClick={saveLDAP}
          disabled={
            ldapSaving ||
            !ldapForm.host ||
            !ldapForm.bind_dn ||
            !ldapForm.bind_password ||
            !ldapForm.base_dn ||
            !ldapForm.user_filter
          }
        >
          {ldapSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {t('setup.oidc.saveLdap')}
        </Button>
      </Stack>
      {ldapSaved && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {t('setup.oidc.ldapConfigured')}
        </Alert>
      )}
    </Stack>
  )
}

// === Main step component ===
const OIDCStep: React.FC = () => {
  const { t } = useTranslation()
  const { authMethod, setAuthMethod, oidcSaved, ldapSaved, goToStep } = useSetupWizard()
  const saved = authMethod === 'oidc' ? oidcSaved : ldapSaved

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          {t('setup.oidc.title')}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t('setup.oidc.subtitle')}
      </Typography>
      <ToggleButtonGroup
        value={authMethod}
        exclusive
        onChange={(_, v) => {
          if (v) setAuthMethod(v as 'oidc' | 'ldap')
        }}
        sx={{ mb: 3 }}
        fullWidth
      >
        <ToggleButton value="oidc">OpenID Connect (OIDC)</ToggleButton>
        <ToggleButton value="ldap">LDAP / Active Directory</ToggleButton>
        {/* Protocol/product names left untranslated intentionally */}
      </ToggleButtonGroup>
      <Collapse in={authMethod === 'oidc'}>
        <OIDCFields />
      </Collapse>
      <Collapse in={authMethod === 'ldap'}>
        <LDAPFields />
      </Collapse>
      <Box sx={{ mt: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
          }}
        >
          <Button variant="text" onClick={() => goToStep(0)}>
            {t('setup.oidc.back')}
          </Button>
          {saved && (
            <Button variant="contained" color="primary" onClick={() => goToStep(2)}>
              {t('setup.oidc.next')}
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  )
}

export default OIDCStep
