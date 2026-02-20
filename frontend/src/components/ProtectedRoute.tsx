import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, Container, Typography, Alert, Button } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredScope?: string; // Optional scope required to access this route
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredScope }) => {
  const { isAuthenticated, isLoading, allowedScopes } = useAuth();

  // Helper to check if user has a specific scope (or admin which grants all)
  const hasScope = (scope: string) => {
    return allowedScopes.includes('admin') || allowedScopes.includes(scope);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
