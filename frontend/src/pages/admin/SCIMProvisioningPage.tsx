import React from 'react'
import { Box, Typography, Paper, Alert, TextField, Stack, Chip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

/**
 * SCIMProvisioningPage displays SCIM 2.0 configuration info and endpoint URLs.
 * Admins use this to configure their identity provider's SCIM integration.
 */
const SCIMProvisioningPage: React.FC = () => {
  const baseUrl = window.location.origin
  const scimBaseUrl = `${baseUrl}/scim/v2`

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        SCIM Provisioning
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        SCIM 2.0 endpoints allow external identity providers to automatically provision and
        de-provision users and groups.
      </Typography>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
            Configure your identity provider with the endpoints below. Authentication requires a
            Bearer token (API key) with the{' '}
            <Chip label="scim:provision" size="small" sx={{ mx: 0.5 }} /> scope.
          </Alert>

          <Stack spacing={2}>
            <TextField
              label="SCIM Base URL"
              value={scimBaseUrl}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
              helperText="Use this as the Tenant URL in your identity provider's SCIM configuration."
              size="small"
            />
            <TextField
              label="Users Endpoint"
              value={`${scimBaseUrl}/Users`}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
              size="small"
            />
            <TextField
              label="Groups Endpoint"
              value={`${scimBaseUrl}/Groups`}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
              size="small"
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            SCIM requests must include a Bearer token in the Authorization header. Create an API key
            with the <strong>scim:provision</strong> scope on the{' '}
            <a href="/admin/apikeys">API Keys</a> page.
          </Typography>
          <Alert severity="warning">
            Store the API key securely. It provides full user and group provisioning access.
          </Alert>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Supported Operations
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>Users:</strong> List, Get, Create, Update (PUT &amp; PATCH), Delete
              (soft-delete)
            </Typography>
            <Typography variant="body2">
              <strong>Groups:</strong> List, Get (read-only — groups map to registry organizations)
            </Typography>
            <Typography variant="body2">
              <strong>Filtering:</strong> <code>userName eq &quot;value&quot;</code> and{' '}
              <code>externalId eq &quot;value&quot;</code>
            </Typography>
            <Typography variant="body2">
              <strong>Pagination:</strong> <code>startIndex</code> and <code>count</code> query
              parameters (1-indexed)
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}

export default SCIMProvisioningPage
