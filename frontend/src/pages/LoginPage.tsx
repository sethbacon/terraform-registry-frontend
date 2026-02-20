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
  const isDev = import.meta.env.DEV;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await login({} as any);
    navigate('/');
  };

  const handleOIDCLogin = () => {
    window.location.href = '/api/auth/login/oidc';
  };

  const handleAzureADLogin = () => {
    window.location.href = '/api/auth/login/azuread';
  };

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
