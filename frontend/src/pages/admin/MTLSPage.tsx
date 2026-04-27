import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Stack,
} from '@mui/material'
import api from '../../services/api'
import type { MTLSConfigResponse } from '../../types'

const MTLSPage: React.FC = () => {
  const {
    data: config,
    isLoading,
    error,
  } = useQuery<MTLSConfigResponse>({
    queryKey: ['admin', 'mtls', 'config'],
    queryFn: () => api.getMTLSConfig(),
  })

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        mTLS Client Certificate Mappings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Mutual TLS certificate-subject to scope mappings. These are configured in the server
        configuration file and are read-only.
      </Typography>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load mTLS configuration.
        </Alert>
      )}

      {config && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={config.enabled ? 'Enabled' : 'Disabled'}
                color={config.enabled ? 'success' : 'default'}
              />
              {config.client_ca_file && (
                <Typography variant="body2" color="text.secondary">
                  CA File: <code>{config.client_ca_file}</code>
                </Typography>
              )}
            </Stack>
          </Paper>

          {config.mappings.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Certificate Subject</TableCell>
                    <TableCell>Scopes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {config.mappings.map((mapping, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {mapping.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {mapping.scopes.map((scope) => (
                            <Chip key={scope} label={scope} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No mTLS certificate mappings configured.
              </Typography>
            </Paper>
          )}
        </>
      )}
    </Container>
  )
}

export default MTLSPage
