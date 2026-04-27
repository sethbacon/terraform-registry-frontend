import React from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip,
  TextField,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import { useSetupWizard } from '../../../contexts/SetupWizardContext'
import type { StorageBackendType } from '../../../types'

const StorageStep: React.FC = () => {
  const {
    storageForm,
    setStorageForm,
    changeStorageBackend,
    storageTesting,
    storageTestResult,
    storageSaving,
    storageSaved,
    testStorage,
    saveStorage,
    goToStep,
  } = useSetupWizard()

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          Storage Backend Configuration
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure where Terraform modules and providers will be stored.
      </Typography>

      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {(['local', 'azure', 's3', 'gcs'] as StorageBackendType[]).map((type) => (
            <Chip
              key={type}
              label={
                type === 'local'
                  ? 'Local'
                  : type === 'azure'
                    ? 'Azure Blob'
                    : type === 's3'
                      ? 'AWS S3'
                      : 'Google Cloud'
              }
              onClick={() => changeStorageBackend(type)}
              color={storageForm.backend_type === type ? 'primary' : 'default'}
              variant={storageForm.backend_type === type ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        {storageForm.backend_type === 'local' && (
          <>
            <TextField
              fullWidth
              label="Base Path"
              value={storageForm.local_base_path || ''}
              onChange={(e) => setStorageForm({ ...storageForm, local_base_path: e.target.value })}
              helperText="Directory path where files will be stored"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={storageForm.local_serve_directly ?? true}
                  onChange={(e) =>
                    setStorageForm({ ...storageForm, local_serve_directly: e.target.checked })
                  }
                />
              }
              label="Serve files directly (recommended for local development)"
            />
          </>
        )}

        {storageForm.backend_type === 'azure' && (
          <>
            <TextField
              fullWidth
              label="Account Name"
              value={storageForm.azure_account_name || ''}
              onChange={(e) =>
                setStorageForm({ ...storageForm, azure_account_name: e.target.value })
              }
              required
            />
            <TextField
              fullWidth
              label="Account Key"
              type="password"
              value={storageForm.azure_account_key || ''}
              onChange={(e) =>
                setStorageForm({ ...storageForm, azure_account_key: e.target.value })
              }
              required
            />
            <TextField
              fullWidth
              label="Container Name"
              value={storageForm.azure_container_name || ''}
              onChange={(e) =>
                setStorageForm({ ...storageForm, azure_container_name: e.target.value })
              }
              required
            />
            <TextField
              fullWidth
              label="CDN URL (optional)"
              value={storageForm.azure_cdn_url || ''}
              onChange={(e) => setStorageForm({ ...storageForm, azure_cdn_url: e.target.value })}
            />
          </>
        )}

        {storageForm.backend_type === 's3' && (
          <>
            <TextField
              fullWidth
              label="Region"
              value={storageForm.s3_region || ''}
              onChange={(e) => setStorageForm({ ...storageForm, s3_region: e.target.value })}
              placeholder="us-east-1"
              required
            />
            <TextField
              fullWidth
              label="Bucket"
              value={storageForm.s3_bucket || ''}
              onChange={(e) => setStorageForm({ ...storageForm, s3_bucket: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Endpoint (optional, for S3-compatible services)"
              value={storageForm.s3_endpoint || ''}
              onChange={(e) => setStorageForm({ ...storageForm, s3_endpoint: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Auth Method</InputLabel>
              <Select
                value={storageForm.s3_auth_method || 'access_key'}
                label="Auth Method"
                onChange={(e) => setStorageForm({ ...storageForm, s3_auth_method: e.target.value })}
              >
                <MenuItem value="access_key">Access Key</MenuItem>
                <MenuItem value="iam_role">IAM Role</MenuItem>
                <MenuItem value="assume_role">Assume Role</MenuItem>
                <MenuItem value="web_identity">Web Identity</MenuItem>
              </Select>
            </FormControl>
            {(storageForm.s3_auth_method === 'access_key' || !storageForm.s3_auth_method) && (
              <>
                <TextField
                  fullWidth
                  label="Access Key ID"
                  value={storageForm.s3_access_key_id || ''}
                  onChange={(e) =>
                    setStorageForm({ ...storageForm, s3_access_key_id: e.target.value })
                  }
                />
                <TextField
                  fullWidth
                  label="Secret Access Key"
                  type="password"
                  value={storageForm.s3_secret_access_key || ''}
                  onChange={(e) =>
                    setStorageForm({ ...storageForm, s3_secret_access_key: e.target.value })
                  }
                />
              </>
            )}
            {storageForm.s3_auth_method === 'assume_role' && (
              <>
                <TextField
                  fullWidth
                  label="Role ARN"
                  value={storageForm.s3_role_arn || ''}
                  onChange={(e) => setStorageForm({ ...storageForm, s3_role_arn: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Role Session Name"
                  value={storageForm.s3_role_session_name || ''}
                  onChange={(e) =>
                    setStorageForm({ ...storageForm, s3_role_session_name: e.target.value })
                  }
                />
              </>
            )}
          </>
        )}

        {storageForm.backend_type === 'gcs' && (
          <>
            <TextField
              fullWidth
              label="Bucket"
              value={storageForm.gcs_bucket || ''}
              onChange={(e) => setStorageForm({ ...storageForm, gcs_bucket: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Project ID"
              value={storageForm.gcs_project_id || ''}
              onChange={(e) => setStorageForm({ ...storageForm, gcs_project_id: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Auth Method</InputLabel>
              <Select
                value={storageForm.gcs_auth_method || 'credentials_file'}
                label="Auth Method"
                onChange={(e) =>
                  setStorageForm({ ...storageForm, gcs_auth_method: e.target.value })
                }
              >
                <MenuItem value="credentials_file">Credentials File</MenuItem>
                <MenuItem value="credentials_json">Credentials JSON</MenuItem>
                <MenuItem value="default">Application Default Credentials</MenuItem>
              </Select>
            </FormControl>
            {storageForm.gcs_auth_method === 'credentials_file' && (
              <TextField
                fullWidth
                label="Credentials File Path"
                value={storageForm.gcs_credentials_file || ''}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, gcs_credentials_file: e.target.value })
                }
              />
            )}
            {storageForm.gcs_auth_method === 'credentials_json' && (
              <TextField
                fullWidth
                label="Credentials JSON"
                value={storageForm.gcs_credentials_json || ''}
                onChange={(e) =>
                  setStorageForm({ ...storageForm, gcs_credentials_json: e.target.value })
                }
                multiline
                rows={4}
              />
            )}
          </>
        )}

        {storageTestResult && (
          <Alert severity={storageTestResult.success ? 'success' : 'error'}>
            {storageTestResult.message}
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button variant="text" onClick={() => goToStep(1)}>
            ← Back
          </Button>
          <Button variant="outlined" onClick={testStorage} disabled={storageTesting}>
            {storageTesting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Test Connection
          </Button>
          <Button variant="contained" onClick={saveStorage} disabled={storageSaving}>
            {storageSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Save Storage Configuration
          </Button>
        </Stack>

        {storageSaved && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button variant="contained" color="primary" onClick={() => goToStep(3)}>
              Next: Security Scanning →
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

export default StorageStep
