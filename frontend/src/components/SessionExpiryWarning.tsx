import React, { useState } from 'react'
import { Snackbar, Alert, Stack, Button, CircularProgress } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

/**
 * Displays a persistent warning Snackbar when the current session is within the
 * warning window (see SESSION_WARNING_LEAD_MS). Offers Refresh session and Sign out.
 *
 * Mounted once in Layout so the warning appears on every authenticated page.
 */
const SessionExpiryWarning: React.FC = () => {
  const { sessionExpiresSoon, isAuthenticated, refreshToken, logout } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  if (!isAuthenticated || !sessionExpiresSoon) return null

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshToken()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      data-testid="session-expiry-warning"
    >
      <Alert
        severity="warning"
        variant="filled"
        sx={{ width: '100%', alignItems: 'center' }}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              color="inherit"
              size="small"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="session-expiry-refresh"
              startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Refresh session
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={logout}
              data-testid="session-expiry-signout"
            >
              Sign out
            </Button>
          </Stack>
        }
      >
        Your session expires in 2 minutes. Refresh to stay signed in.
      </Alert>
    </Snackbar>
  )
}

export default SessionExpiryWarning
