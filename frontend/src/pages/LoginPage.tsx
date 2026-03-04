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
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  // import.meta.env.DEV is tied to NODE_ENV, which Vite forces to 'production'
  // during any `vite build` regardless of --mode. Check MODE instead, which
  // correctly reflects the --mode argument (e.g. 'development').
  const isDev = import.meta.env.MODE === 'development';

  const handleDevLogin = async () => {
    // Call the dev login endpoint to get a JWT (no hardcoded keys)
    // This endpoint is gated by DevModeMiddleware and returns 403 in production
    const response = await apiClient.devLogin();
    localStorage.setItem('auth_token', response.token);

    // Clear any cached user data to force fresh fetch from API
    localStorage.removeItem('user');
    localStorage.removeItem('role_template');
    localStorage.removeItem('allowed_scopes');

    // login() will call fetchCurrentUser() which validates the JWT via /auth/me
    await login({} as any);
    navigate('/');
  };

  // Validates that the provider login endpoint is reachable before redirecting.
  // If the backend returns a non-redirect error (e.g. provider not configured),
  // this displays a user-friendly alert on the login page instead of showing
  // raw JSON in the browser.
  const handleProviderLogin = async (provider: 'oidc' | 'azuread') => {
    setLoginError(null);
    try {
      const res = await fetch(`/api/v1/auth/login?provider=${provider}`, {
        method: 'GET',
        redirect: 'manual',
      });
      // A 'manual' redirect fetch returns opaqueredirect (type='opaqueredirect') or
      // status 0 for actual redirects. Any non-redirect response means the backend
      // returned an error (e.g. 400 provider not configured).
      if (res.type === 'opaqueredirect' || res.status === 0) {
        // Normal redirect — let the browser follow it
        apiClient.login(provider);
        return;
      }
      // The backend returned a non-redirect response — extract the error message
      let message = `${provider === 'oidc' ? 'OIDC' : 'Azure AD'} provider is not configured. Contact your administrator.`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // ignore parse errors
      }
      setLoginError(message);
    } catch {
      // Network error or CORS issue — fall back to direct redirect
      apiClient.login(provider);
    }
  };

  const handleOIDCLogin = () => handleProviderLogin('oidc');
  const handleAzureADLogin = () => handleProviderLogin('azuread');

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
                <Divider>
                  <Typography variant="body2" color="text.secondary">
                    OR USE PRODUCTION AUTH
                  </Typography>
                </Divider>
              </>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleOIDCLogin}
              sx={{ py: 1.5 }}
            >
              Sign in with OIDC
            </Button>

            <Divider>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleAzureADLogin}
              sx={{ 
                py: 1.5,
                backgroundColor: '#0078d4',
                '&:hover': {
                  backgroundColor: '#106ebe',
                },
              }}
            >
              Sign in with Azure AD
            </Button>
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
