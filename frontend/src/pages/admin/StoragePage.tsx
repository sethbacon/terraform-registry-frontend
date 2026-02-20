import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  FormControlLabel,
  FormHelperText,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Paper,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import { apiClient } from '../../services/api';
import type { StorageConfigResponse, StorageConfigInput, StorageBackendType, SetupStatus } from '../../types';

const StoragePage: React.FC = () => {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [configs, setConfigs] = useState<StorageConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<StorageConfigInput>({
    backend_type: 'local',
    local_base_path: './data/storage',
    local_serve_directly: true,
  });

  const steps = ['Select Backend', 'Configure Settings', 'Review & Save'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = await apiClient.getSetupStatus();
      setSetupStatus(status);

      if (!status.setup_required) {
        const configList = await apiClient.listStorageConfigs();
        setConfigs(Array.isArray(configList) ? configList : []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load storage configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleBackendChange = (type: StorageBackendType) => {
    const newFormData: StorageConfigInput = { backend_type: type };

    switch (type) {
      case 'local':
        newFormData.local_base_path = './data/storage';
        newFormData.local_serve_directly = true;
        break;
      case 'azure':
        newFormData.azure_account_name = '';
        newFormData.azure_account_key = '';
        newFormData.azure_container_name = '';
        break;
      case 's3':
        newFormData.s3_region = 'us-east-1';
        newFormData.s3_bucket = '';
        newFormData.s3_auth_method = 'default';
        break;
      case 'gcs':
        newFormData.gcs_bucket = '';
        newFormData.gcs_auth_method = 'default';
        break;
    }

    setFormData(newFormData);
  };

  const handleTestConfig = async () => {
    try {
      setTesting(true);
      setError(null);
      const result = await apiClient.testStorageConfig(formData);
      if (result.success) {
        setSuccess('Storage configuration is valid!');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Configuration test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiClient.createStorageConfig(formData);
      setSuccess('Storage configuration saved successfully!');
      await loadData();
      setActiveStep(0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getBackendIcon = (type: StorageBackendType) => {
    switch (type) {
      case 'local':
        return <FolderIcon />;
      case 'azure':
      case 's3':
      case 'gcs':
        return <CloudIcon />;
      default:
        return <StorageIcon />;
    }
  };

  const getBackendLabel = (type: StorageBackendType) => {
    switch (type) {
      case 'local':
        return 'Local File System';
      case 'azure':
        return 'Azure Blob Storage';
      case 's3':
        return 'Amazon S3 / S3-Compatible';
      case 'gcs':
        return 'Google Cloud Storage';
      default:
        return type;
    }
  };

  const renderBackendSelection = () => (
    <Grid container spacing={3}>
      {(['local', 'azure', 's3', 'gcs'] as StorageBackendType[]).map((type) => (
        <Grid item xs={12} sm={6} key={type}>
          <Card
            sx={{
              cursor: 'pointer',
              border: formData.backend_type === type ? 2 : 1,
              borderColor: formData.backend_type === type ? 'primary.main' : 'divider',
              '&:hover': { borderColor: 'primary.light' },
            }}
            onClick={() => handleBackendChange(type)}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                {getBackendIcon(type)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {getBackendLabel(type)}
                </Typography>
                {formData.backend_type === type && (
                  <CheckCircleIcon color="primary" sx={{ ml: 'auto' }} />
                )}
              </Box>
              <Typography variant="body2" color="textSecondary">
                {type === 'local' && 'Store files on the local file system. Best for development and small deployments.'}
                {type === 'azure' && 'Use Azure Blob Storage for scalable cloud storage with Azure integration.'}
                {type === 's3' && 'Use Amazon S3 or any S3-compatible storage (MinIO, DigitalOcean Spaces, etc.).'}
                {type === 'gcs' && 'Use Google Cloud Storage for GCP-native storage with workload identity support.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderLocalSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Base Path"
        fullWidth
        value={formData.local_base_path || ''}
        onChange={(e) => setFormData({ ...formData, local_base_path: e.target.value })}
        helperText="Directory where files will be stored (relative to working directory or absolute path)"
        required
      />
      <FormControlLabel
        control={
          <Switch
            checked={formData.local_serve_directly ?? true}
            onChange={(e) => setFormData({ ...formData, local_serve_directly: e.target.checked })}
          />
        }
        label="Serve files directly (recommended for local development)"
      />
    </Box>
  );

  const renderAzureSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Account Name"
        fullWidth
        value={formData.azure_account_name || ''}
        onChange={(e) => setFormData({ ...formData, azure_account_name: e.target.value })}
        required
        helperText="Your Azure Storage account name (visible in Azure Portal → Storage Accounts)"
      />
      <TextField
        label="Account Key"
        type="password"
        fullWidth
        value={formData.azure_account_key || ''}
        onChange={(e) => setFormData({ ...formData, azure_account_key: e.target.value })}
        required
        helperText="Primary or secondary access key (Azure Portal → Storage Account → Access keys). Keep this secret."
      />
      <TextField
        label="Container Name"
        fullWidth
        value={formData.azure_container_name || ''}
        onChange={(e) => setFormData({ ...formData, azure_container_name: e.target.value })}
        required
        helperText="Blob container name. The container must exist before activating this backend."
      />
      <TextField
        label="CDN URL (optional)"
        fullWidth
        value={formData.azure_cdn_url || ''}
        onChange={(e) => setFormData({ ...formData, azure_cdn_url: e.target.value })}
        helperText="If using Azure CDN, provide the CDN endpoint URL"
      />
    </Box>
  );

  const renderS3Settings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Bucket"
        fullWidth
        value={formData.s3_bucket || ''}
        onChange={(e) => setFormData({ ...formData, s3_bucket: e.target.value })}
        required
        helperText="S3 bucket name. The bucket must already exist in the specified region."
      />
      <TextField
        label="Region"
        fullWidth
        value={formData.s3_region || ''}
        onChange={(e) => setFormData({ ...formData, s3_region: e.target.value })}
        required
        helperText="AWS region where the bucket is located (e.g., us-east-1, eu-west-1)"
      />
      <TextField
        label="Endpoint (optional)"
        fullWidth
        value={formData.s3_endpoint || ''}
        onChange={(e) => setFormData({ ...formData, s3_endpoint: e.target.value })}
        helperText="For S3-compatible services (MinIO, DigitalOcean Spaces, etc.)"
      />
      <FormControl fullWidth>
        <InputLabel>Authentication Method</InputLabel>
        <Select
          value={formData.s3_auth_method || 'default'}
          label="Authentication Method"
          onChange={(e) => setFormData({ ...formData, s3_auth_method: e.target.value })}
        >
          <MenuItem value="default">Default Credential Chain</MenuItem>
          <MenuItem value="static">Access Key / Secret Key</MenuItem>
          <MenuItem value="oidc">OIDC / Web Identity</MenuItem>
          <MenuItem value="assume_role">AssumeRole</MenuItem>
        </Select>
        <FormHelperText>
          default = AWS credential chain (recommended for EC2/EKS with IAM roles) · static = explicit key/secret (local dev or non-AWS S3-compatible) · oidc = web identity token (GitHub Actions, EKS pod identity) · assume_role = cross-account access
        </FormHelperText>
      </FormControl>

      {formData.s3_auth_method === 'static' && (
        <>
          <TextField
            label="Access Key ID"
            fullWidth
            value={formData.s3_access_key_id || ''}
            onChange={(e) => setFormData({ ...formData, s3_access_key_id: e.target.value })}
            required
            helperText="IAM user access key ID. Use secrets management rather than committing credentials."
          />
          <TextField
            label="Secret Access Key"
            type="password"
            fullWidth
            value={formData.s3_secret_access_key || ''}
            onChange={(e) => setFormData({ ...formData, s3_secret_access_key: e.target.value })}
            required
            helperText="IAM user secret access key. Use secrets management rather than committing credentials."
          />
        </>
      )}

      {(formData.s3_auth_method === 'oidc' || formData.s3_auth_method === 'assume_role') && (
        <>
          <TextField
            label="Role ARN"
            fullWidth
            value={formData.s3_role_arn || ''}
            onChange={(e) => setFormData({ ...formData, s3_role_arn: e.target.value })}
            required
            helperText="IAM Role ARN to assume (e.g., arn:aws:iam::123456789012:role/TerraformRegistry)"
          />
          <TextField
            label="Role Session Name (optional)"
            fullWidth
            value={formData.s3_role_session_name || ''}
            onChange={(e) => setFormData({ ...formData, s3_role_session_name: e.target.value })}
          />
        </>
      )}

      {formData.s3_auth_method === 'oidc' && (
        <TextField
          label="Web Identity Token File"
          fullWidth
          value={formData.s3_web_identity_token_file || ''}
          onChange={(e) => setFormData({ ...formData, s3_web_identity_token_file: e.target.value })}
          helperText="Path to the web identity token file (e.g., for Kubernetes service account tokens)"
        />
      )}

      {formData.s3_auth_method === 'assume_role' && (
        <TextField
          label="External ID (optional)"
          fullWidth
          value={formData.s3_external_id || ''}
          onChange={(e) => setFormData({ ...formData, s3_external_id: e.target.value })}
          helperText="Optional external ID defined in the role's trust policy, used for cross-account access"
        />
      )}
    </Box>
  );

  const renderGCSSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Bucket"
        fullWidth
        value={formData.gcs_bucket || ''}
        onChange={(e) => setFormData({ ...formData, gcs_bucket: e.target.value })}
        required
      />
      <TextField
        label="Project ID (optional)"
        fullWidth
        value={formData.gcs_project_id || ''}
        onChange={(e) => setFormData({ ...formData, gcs_project_id: e.target.value })}
        helperText="Required if creating a new bucket"
      />
      <FormControl fullWidth>
        <InputLabel>Authentication Method</InputLabel>
        <Select
          value={formData.gcs_auth_method || 'default'}
          label="Authentication Method"
          onChange={(e) => setFormData({ ...formData, gcs_auth_method: e.target.value })}
        >
          <MenuItem value="default">Application Default Credentials</MenuItem>
          <MenuItem value="service_account">Service Account</MenuItem>
          <MenuItem value="workload_identity">Workload Identity</MenuItem>
        </Select>
        <FormHelperText>
          default = ADC / gcloud auth (recommended for GKE) · service_account = JSON key file · workload_identity = keyless federation (GitHub Actions, GKE Workload Identity)
        </FormHelperText>
      </FormControl>

      {formData.gcs_auth_method === 'service_account' && (
        <>
          <TextField
            label="Credentials File Path (optional)"
            fullWidth
            value={formData.gcs_credentials_file || ''}
            onChange={(e) => setFormData({ ...formData, gcs_credentials_file: e.target.value })}
            helperText="Path to service account JSON file"
          />
          <TextField
            label="Credentials JSON (optional)"
            fullWidth
            multiline
            rows={4}
            value={formData.gcs_credentials_json || ''}
            onChange={(e) => setFormData({ ...formData, gcs_credentials_json: e.target.value })}
            helperText="Paste service account JSON directly (alternative to file path)"
          />
        </>
      )}

      <TextField
        label="Endpoint (optional)"
        fullWidth
        value={formData.gcs_endpoint || ''}
        onChange={(e) => setFormData({ ...formData, gcs_endpoint: e.target.value })}
        helperText="For GCS emulators or compatible services"
      />
    </Box>
  );

  const renderSettingsForm = () => {
    switch (formData.backend_type) {
      case 'local':
        return renderLocalSettings();
      case 'azure':
        return renderAzureSettings();
      case 's3':
        return renderS3Settings();
      case 'gcs':
        return renderGCSSettings();
      default:
        return null;
    }
  };

  const renderReview = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configuration Summary
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Typography variant="body2" color="textSecondary">Backend Type</Typography>
          </Grid>
          <Grid item xs={8}>
            <Typography variant="body1">{getBackendLabel(formData.backend_type)}</Typography>
          </Grid>

          {formData.backend_type === 'local' && (
            <>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Base Path</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.local_base_path}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 'azure' && (
            <>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Account Name</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.azure_account_name}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Container</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.azure_container_name}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 's3' && (
            <>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Bucket</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.s3_bucket}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Region</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.s3_region}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Auth Method</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.s3_auth_method || 'default'}</Typography>
              </Grid>
            </>
          )}

          {formData.backend_type === 'gcs' && (
            <>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Bucket</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.gcs_bucket}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Auth Method</Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{formData.gcs_auth_method || 'default'}</Typography>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Box display="flex" gap={2}>
        <Button
          variant="outlined"
          onClick={handleTestConfig}
          disabled={testing}
          startIcon={testing ? <CircularProgress size={20} /> : <RefreshIcon />}
        >
          Test Configuration
        </Button>
      </Box>
    </Box>
  );

  const renderSetupWizard = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Storage Configuration
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Configure where the registry will store module and provider files. This is required before you can upload artifacts.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        {activeStep === 0 && renderBackendSelection()}
        {activeStep === 1 && renderSettingsForm()}
        {activeStep === 2 && renderReview()}
      </Paper>

      <Box display="flex" justifyContent="space-between">
        <Button
          disabled={activeStep === 0}
          onClick={() => setActiveStep((prev) => prev - 1)}
        >
          Back
        </Button>
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSaveConfig}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              Save Configuration
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => setActiveStep((prev) => prev + 1)}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  const renderExistingConfigs = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Storage Settings</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center">
          <InfoIcon sx={{ mr: 1 }} />
          Storage has been configured. Changing storage backends after initial setup may result in data loss.
          Create a new configuration and activate it only after migrating existing data.
        </Box>
      </Alert>

      <Grid container spacing={3}>
        {configs.map((config) => (
          <Grid item xs={12} md={6} key={config.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  {getBackendIcon(config.backend_type)}
                  <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                    {getBackendLabel(config.backend_type)}
                  </Typography>
                  <Chip
                    label={config.is_active ? 'Active' : 'Inactive'}
                    color={config.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Divider sx={{ my: 1 }} />

                {config.backend_type === 'local' && (
                  <Typography variant="body2" color="textSecondary">
                    Path: {config.local_base_path}
                  </Typography>
                )}

                {config.backend_type === 'azure' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Account: {config.azure_account_name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Container: {config.azure_container_name}
                    </Typography>
                  </>
                )}

                {config.backend_type === 's3' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Bucket: {config.s3_bucket}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Region: {config.s3_region}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Auth: {config.s3_auth_method || 'default'}
                    </Typography>
                  </>
                )}

                {config.backend_type === 'gcs' && (
                  <>
                    <Typography variant="body2" color="textSecondary">
                      Bucket: {config.gcs_bucket}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Auth: {config.gcs_auth_method || 'default'}
                    </Typography>
                  </>
                )}

                <Typography variant="caption" color="textSecondary" display="block" mt={2}>
                  Updated: {new Date(config.updated_at).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {setupStatus?.setup_required ? renderSetupWizard() : renderExistingConfigs()}
    </Box>
  );
};

export default StoragePage;
