import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Skeleton,
  TextField,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { User } from '../types';

interface AuthProvider {
  type: string;
  name: string;
  id?: string;
}

// Simple t type avoids excessively-deep instantiation from the large i18next key union
type SimpleTFunc = (key: string, options?: Record<string, unknown>) => string

function providerLabel(p: AuthProvider, t: SimpleTFunc): string {
  switch (p.type) {
    case 'oidc':
      return t('auth.signInWithSSO');
    case 'azuread':
      return t('auth.signInWithAzureAD');
    case 'saml':
      return t('auth.signInWith', { name: p.name });
    default:
      return t('auth.signInWith', { name: p.name });
  }
}

function providerSx(p: AuthProvider): Record<string, unknown> | undefined {
  if (p.type === 'azuread') {
    return { backgroundColor: '#0078d4', '&:hover': { backgroundColor: '#106ebe' } };
  }
  return undefined;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { productName } = useThemeMode();
  const navigate = useNavigate();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const isDev = import.meta.env.MODE === 'development';
  const [providers, setProviders] = React.useState<AuthProvider[]>([]);
  const [loading, setLoading] = React.useState(true);

  // LDAP form state
  const [ldapUsername, setLdapUsername] = React.useState('');
  const [ldapPassword, setLdapPassword] = React.useState('');
  const [ldapLoading, setLdapLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api
      .getAuthProviders()
      .then((res) => {
        if (!cancelled) setProviders(res.providers || []);
      })
      .catch(() => {
        // Silently ignore — providers will be empty
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDevLogin = async () => {
    setLoginError(null);
    try {
      const response = await api.devLogin();
      localStorage.setItem('auth_token', response.token);
      localStorage.removeItem('user');
      localStorage.removeItem('role_template');
      localStorage.removeItem('allowed_scopes');
      await login({} as User);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.devLoginFailed');
      setLoginError(message);
    }
  };

  const handleProviderLogin = (provider: AuthProvider) => {
    setLoginError(null);
    const providerParam = provider.id || provider.type;
    api.login(providerParam);
  };

  const handleLdapLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLdapLoading(true);
    try {
      const response = await api.ldapLogin(ldapUsername, ldapPassword);
      localStorage.setItem('auth_token', response.token);
      localStorage.removeItem('user');
      localStorage.removeItem('role_template');
      localStorage.removeItem('allowed_scopes');
      await login({} as User);
      navigate('/');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.ldapLoginFailed');
      setLoginError(message);
    } finally {
      setLdapLoading(false);
    }
  };

  const ssoProviders = providers.filter((p) => p.type !== 'ldap');
  const hasLdap = providers.some((p) => p.type === 'ldap');
  const showNoProvidersAlert = !loading && providers.length === 0 && !isDev;

  return (
    <Container maxWidth="sm" sx={{ mx: 'auto' }}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <LoginIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              {productName}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('auth.signInToContinue')}
            </Typography>
          </Box>

          <Stack spacing={2}>
            {loginError && (
              <Alert severity="error" onClose={() => setLoginError(null)}>
                {loginError}
              </Alert>
            )}

            {showNoProvidersAlert && (
              <Alert severity="info" data-testid="no-providers-alert">
                {t('auth.noProviders')}
              </Alert>
            )}

            {isDev && (
              <>
                <Alert severity="info">
                  {t('auth.devModeNotice')}
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleDevLogin}
                  color="success"
                  sx={{ py: 1.5 }}
                >
                  {t('auth.devLogin')}
                </Button>
                {(loading || providers.length > 0) && (
                  <Divider>
                    <Typography variant="body2" color="text.secondary">
                      {t('auth.orUseProductionAuth')}
                    </Typography>
                  </Divider>
                )}
              </>
            )}

            {loading ? (
              <Stack spacing={1} data-testid="provider-loading">
                <Skeleton variant="rounded" height={48} />
                <Skeleton variant="rounded" height={48} />
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                  <CircularProgress size={18} aria-label="Loading sign-in providers" />
                </Box>
              </Stack>
            ) : (
              <>
                {ssoProviders.map((p, idx, visible) => (
                  <React.Fragment key={p.id || p.type}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={() => handleProviderLogin(p)}
                      sx={{ py: 1.5, ...(providerSx(p) ?? {}) }}
                    >
                      {providerLabel(p, t)}
                    </Button>
                    {idx < visible.length - 1 && (
                      <Divider>
                        <Typography variant="body2" color="text.secondary">
                          {t('auth.or')}
                        </Typography>
                      </Divider>
                    )}
                  </React.Fragment>
                ))}

                {hasLdap && ssoProviders.length > 0 && (
                  <Divider>
                    <Typography variant="body2" color="text.secondary">
                      {t('auth.orSignInWithLdap')}
                    </Typography>
                  </Divider>
                )}

                {hasLdap && (
                  <Box component="form" onSubmit={handleLdapLogin}>
                    <Stack spacing={2}>
                      {ssoProviders.length === 0 && (
                        <Typography variant="subtitle2" color="text.secondary" textAlign="center">
                          {t('auth.signInWithLdap')}
                        </Typography>
                      )}
                      <TextField
                        label={t('auth.username')}
                        value={ldapUsername}
                        onChange={(e) => setLdapUsername(e.target.value)}
                        required
                        fullWidth
                        autoComplete="username"
                        size="small"
                      />
                      <TextField
                        label={t('auth.password')}
                        type="password"
                        value={ldapPassword}
                        onChange={(e) => setLdapPassword(e.target.value)}
                        required
                        fullWidth
                        autoComplete="current-password"
                        size="small"
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={ldapLoading || !ldapUsername || !ldapPassword}
                        sx={{ py: 1.5 }}
                      >
                        {ldapLoading ? <CircularProgress size={24} /> : t('auth.signIn')}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('auth.ssoInfo')}
              <br />
              {t('auth.ssoContact')}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
