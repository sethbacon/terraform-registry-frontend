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

const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = () => {
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        setTimeout(() => navigate('/login'), 3000);
        return;
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
    <Container maxWidth="sm" sx={{ mx: 'auto' }}>
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
