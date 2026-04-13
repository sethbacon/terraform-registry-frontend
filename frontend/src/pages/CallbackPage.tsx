import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  CircularProgress,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Check URL param first (backward compat / dev mode)
      let token = searchParams.get('token');

      // If no URL param, exchange the HttpOnly cookie for a token.
      // The backend sets a tfr_auth_token cookie during the OIDC callback redirect;
      // this endpoint reads it, validates the JWT, returns it in the response body,
      // and clears the cookie.
      if (!token) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/exchange-token`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            token = data.token;
          }
        } catch {
          // fall through to error below
        }
      }

      if (!token) {
        setError('No authentication token received.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Store the JWT via AuthContext (writes to localStorage).
      // Use a full-page navigation so AuthProvider's mount effect re-runs,
      // picks up the stored token, and fetches the current user before rendering.
      setToken(token);
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      sessionStorage.removeItem('returnUrl');
      window.location.replace(returnUrl);
    };

    handleCallback();
  }, [searchParams, setToken, navigate]);

  return (
    <Container maxWidth="sm" sx={{ mx: 'auto' }} aria-busy={!error} aria-live="polite">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Authentication Error
            </Typography>
            <Typography variant="body2">{error}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Redirecting to login page...
            </Typography>
          </Alert>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Completing authentication...
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default CallbackPage;
