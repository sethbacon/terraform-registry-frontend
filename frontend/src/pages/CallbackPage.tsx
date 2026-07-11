import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Box, CircularProgress, Typography, Alert } from '@mui/material'

const CallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

      // Cookie-only flow: the backend set an HttpOnly cookie during the OIDC
      // callback redirect (no token ever transits the URL). AuthContext will
      // detect the session via /auth/me on mount. Navigate to the return URL;
      // AuthContext handles the rest.
      const raw = sessionStorage.getItem('returnUrl') || '/'
      sessionStorage.removeItem('returnUrl')
      // Reject absolute and protocol-relative URLs to prevent open redirect.
      // Use URL parsing to catch backslash normalisation bypasses (/\\ → //).
      let safeReturnUrl = '/'
      try {
        const resolved = new URL(raw, window.location.origin)
        if (resolved.origin === window.location.origin) {
          safeReturnUrl = resolved.pathname + resolved.search + resolved.hash
        }
      } catch {
        // malformed URL — fall back to '/'
      }
      window.location.replace(safeReturnUrl)
    }

    handleCallback()
  }, [searchParams, navigate])

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
