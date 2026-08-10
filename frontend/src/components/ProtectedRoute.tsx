import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { captureReturnUrl } from '../utils/returnUrl'
import { CircularProgress, Box, Container, Typography, Alert, Button } from '@mui/material'
import type { ScopeValue } from '../types/rbac'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredScope?: ScopeValue // Optional scope required to access this route
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredScope }) => {
  const { isAuthenticated, isLoading, allowedScopes } = useAuth()

  // Helper to check if user has a specific scope (or admin which grants all)
  const hasScope = (scope: string) => {
    return allowedScopes.includes('admin') || allowedScopes.includes(scope)
  }

  if (isLoading) {
    return (
      <Box
        aria-busy="true"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    // Record the destination before bouncing to /login, so the OIDC callback can
    // return the user here instead of dropping them on '/' (#695).
    //
    // Written during render rather than from an effect on purpose: <Navigate>
    // performs its navigation from an effect of its own, and child effects run
    // before the parent's, so an effect here would fire too late to be read. The
    // write is idempotent and self-contained, so StrictMode's double render is
    // harmless, and captureReturnUrl never throws.
    captureReturnUrl()
    return <Navigate to="/login" replace />
  }

  // Check scope permission if a required scope is specified
  if (requiredScope && !hasScope(requiredScope)) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body2">
            You don't have permission to access this page. This page requires the{' '}
            <strong>{requiredScope}</strong> permission.
          </Typography>
        </Alert>
        <Button variant="contained" href="/admin">
          Go to Dashboard
        </Button>
      </Container>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute
