import React from 'react';
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
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { User } from '../types';

type ProviderId = 'oidc' | 'azuread';

interface ProviderDef {
  id: ProviderId;
  label: string;
  sx?: Record<string, unknown>;
}

const PROVIDERS: ProviderDef[] = [
  { id: 'oidc', label: 'Sign in with SSO' },
  {
    id: 'azuread',
    label: 'Sign in with Azure AD',
    sx: {
      backgroundColor: '#0078d4',
      '&:hover': { backgroundColor: '#106ebe' },
    },
  },
];

async function probeProvider(id: ProviderId): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/auth/login?provider=${id}`, {
      method: 'GET',
      redirect: 'manual',
    });
    // 429 means rate-limited — the provider may still be configured, so treat
    // it as available to avoid hiding login buttons after a burst of requests.
    if (res.status === 429) return true;
    return res.type === 'opaqueredirect' || res.status === 0;
  } catch {
    return false;
  }
}

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const isDev = import.meta.env.MODE === 'development';
  const [providerAvailable, setProviderAvailable] = React.useState<Record<ProviderId, boolean>>({
    oidc: false,
    azuread: false,
  });
  const [probingProviders, setProbingProviders] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all(PROVIDERS.map(p => probeProvider(p.id).then(ok => [p.id, ok] as const))).then(results => {
      if (cancelled) return;
      const map = { oidc: false, azuread: false } as Record<ProviderId, boolean>;
      for (const [id, ok] of results) map[id] = ok;
      setProviderAvailable(map);
      setProbingProviders(false);
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
      const message = err instanceof Error ? err.message : 'Dev login failed. Check server logs.';
      setLoginError(message);
    }
  };

  const handleProviderLogin = (provider: ProviderId) => {
    setLoginError(null);
    // Provider availability was already confirmed by probeProvider() — go
    // straight to the redirect to avoid consuming an extra rate-limit token.
    api.login(provider);
  };

  const availableCount = Object.values(providerAvailable).filter(Boolean).length;
  const showNoProvidersAlert = !probingProviders && availableCount === 0 && !isDev;

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
              Terraform Registry
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to continue
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
                No SSO providers configured. Contact your administrator.
              </Alert>
            )}

            {isDev && (
              <>
                <Alert severity="info">
                  Development mode - Click below to login without OAuth
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleDevLogin}
                  color="success"
                  sx={{ py: 1.5 }}
                >
                  Dev Login (Admin)
                </Button>
                {(probingProviders || availableCount > 0) && (
                  <Divider>
                    <Typography variant="body2" color="text.secondary">
                      OR USE PRODUCTION AUTH
                    </Typography>
                  </Divider>
                )}
              </>
            )}

            {probingProviders ? (
              <Stack spacing={1} data-testid="provider-probing">
                <Skeleton variant="rounded" height={48} />
                <Skeleton variant="rounded" height={48} />
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                  <CircularProgress size={18} aria-label="Checking available sign-in providers" />
                </Box>
              </Stack>
            ) : (
              PROVIDERS.filter(p => providerAvailable[p.id]).map((p, idx, visible) => (
                <React.Fragment key={p.id}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => handleProviderLogin(p.id)}
                    sx={{ py: 1.5, ...(p.sx ?? {}) }}
                  >
                    {p.label}
                  </Button>
                  {idx < visible.length - 1 && (
                    <Divider>
                      <Typography variant="body2" color="text.secondary">
                        OR
                      </Typography>
                    </Divider>
                  )}
                </React.Fragment>
              ))
            )}
          </Stack>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              This application uses single sign-on for authentication.
              <br />
              Contact your administrator if you need access.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
