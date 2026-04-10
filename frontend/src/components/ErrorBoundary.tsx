import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button, Container, Stack, Typography } from '@mui/material';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Alert severity="error">
            <AlertTitle>Something went wrong</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
              An unexpected error occurred. You can try again or reload the page.
            </Typography>
            {this.state.error && (
              <Box
                component="pre"
                sx={{
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: 'action.hover',
                  p: 1,
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                {this.state.error.message}
              </Box>
            )}
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button size="small" variant="contained" onClick={this.handleReload}>
                Reload Page
              </Button>
            </Stack>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
