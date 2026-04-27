import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Box, CircularProgress, Typography, Alert } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const CallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const exchangedRef = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Guard against duplicate calls (e.g. React StrictMode double-mount in dev)
      if (exchangedRef.current) return
      exchangedRef.current = true
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (errorParam) {
        setError(errorDescription || errorParam)
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      // Check URL param first (backward compat / dev mode)
      const token = searchParams.get('token')

      if (token) {
        // Legacy flow: token was passed as a URL parameter.
        // Store the JWT via AuthContext (writes to localStorage).
        setToken(token)
      }

      // New flow: The backend set an HttpOnly cookie during the OIDC callback
      // redirect. AuthContext will detect the session via /auth/me on mount.
      // Navigate to the return URL; AuthContext handles the rest.
      const returnUrl = sessionStorage.getItem('returnUrl') || '/'
      sessionStorage.removeItem('returnUrl')
      window.location.replace(returnUrl)
    }

    handleCallback()
  }, [searchParams, setToken, navigate])

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
  )
}

export default CallbackPage
