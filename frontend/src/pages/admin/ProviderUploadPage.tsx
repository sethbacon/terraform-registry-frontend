import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  SelectChangeEvent,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import CloudDownload from '@mui/icons-material/CloudDownload';
import ArrowBack from '@mui/icons-material/ArrowBack';
import api from '../../services/api';

type ProviderMethod = 'choose' | 'upload' | 'mirror';

const ProviderUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    providerData?: { namespace: string; type: string };
    method?: ProviderMethod;
  };
  const prefilledProvider = state?.providerData;

  const [providerMethod, setProviderMethod] = useState<ProviderMethod>(
    state?.method ?? (prefilledProvider ? 'upload' : 'choose')
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Provider upload state
  const [providerFile, setProviderFile] = useState<File | null>(null);
  const [providerNamespace, setProviderNamespace] = useState(prefilledProvider?.namespace || '');
  const [providerName, setProviderName] = useState(prefilledProvider?.type || '');
  const [providerVersion, setProviderVersion] = useState('');
  const [providerOS, setProviderOS] = useState('');
  const [providerArch, setProviderArch] = useState('');

  const handleProviderFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProviderFile(file);
      setError(null);
    }
  };

  const handleProviderUpload = async () => {
    if (!providerFile || !providerNamespace || !providerName || !providerVersion || !providerOS || !providerArch) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('namespace', providerNamespace);
      formData.append('type', providerName);
      formData.append('version', providerVersion);
      formData.append('os', providerOS);
      formData.append('arch', providerArch);
      formData.append('file', providerFile);

      await api.uploadProvider(formData);

      navigate(`/providers/${providerNamespace}/${providerName}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload provider. Please try again.');
      setUploading(false);
    }
  };

  const renderProviderMethodChooser = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        How would you like to add this provider?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a provider binary directly, or configure a mirror to automatically sync providers from the public Terraform Registry.
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setProviderMethod('upload')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Manual Upload
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Package a provider binary as a <strong>.zip</strong> file and upload it directly. Best for private or custom providers.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'secondary.main', boxShadow: 2 } }}
        >
          <CardActionArea
            sx={{ height: '100%' }}
            onClick={() => navigate('/admin/mirrors?action=add')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudDownload sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Provider Mirror
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure a mirror to automatically sync one or more providers from the public Terraform Registry on a schedule.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  );

  const renderFileUploadForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => { setProviderMethod('choose'); setError(null); setSuccess(null); }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        Upload Terraform Provider
      </Typography>
      <Box sx={{ mb: 3, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>Requirements:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          • Package provider binary as a <strong>.zip</strong> file<br />
          • Upload each OS/Architecture combination separately<br />
          • Use semantic versioning matching the binary version<br />
          • Filename should be: <strong>terraform-provider-NAME_VERSION_OS_ARCH.zip</strong><br />
          • Provider address format: <strong>namespace/type</strong>
        </Typography>
      </Box>

      <Stack spacing={3}>
        <TextField
          label="Namespace"
          value={providerNamespace}
          onChange={(e) => setProviderNamespace(e.target.value)}
          placeholder="e.g., myorg"
          required
          fullWidth
          helperText="Your organization identifier."
        />
        <TextField
          label="Provider Name"
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="e.g., custom-api"
          required
          fullWidth
          helperText="Provider type name (e.g., 'aws', 'azurerm', 'custom-api'). Lowercase only."
        />
        <TextField
          label="Version"
          value={providerVersion}
          onChange={(e) => setProviderVersion(e.target.value)}
          placeholder="e.g., 1.0.0"
          required
          fullWidth
          helperText="Semantic version in format X.Y.Z (e.g., 1.0.0, 2.1.3). Must match binary version."
        />

        <FormControl fullWidth required>
          <InputLabel>Operating System</InputLabel>
          <Select
            value={providerOS}
            label="Operating System"
            onChange={(e: SelectChangeEvent) => setProviderOS(e.target.value)}
          >
            <MenuItem value="linux">Linux</MenuItem>
            <MenuItem value="darwin">macOS (Darwin)</MenuItem>
            <MenuItem value="windows">Windows</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
            Target operating system for this provider binary
          </Typography>
        </FormControl>

        <FormControl fullWidth required>
          <InputLabel>Architecture</InputLabel>
          <Select
            value={providerArch}
            label="Architecture"
            onChange={(e: SelectChangeEvent) => setProviderArch(e.target.value)}
          >
            <MenuItem value="amd64">AMD64 (x86_64)</MenuItem>
            <MenuItem value="arm64">ARM64</MenuItem>
            <MenuItem value="386">386 (x86)</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
            CPU architecture for this provider binary (most common: amd64)
          </Typography>
        </FormControl>

        <Box>
          <input
            id="provider-file-input"
            type="file"
            accept=".zip"
            onChange={handleProviderFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="provider-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              fullWidth
              sx={{ py: 2 }}
            >
              {providerFile ? providerFile.name : 'Select Provider Binary (.zip)'}
            </Button>
          </label>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Button
          variant="contained"
          onClick={handleProviderUpload}
          disabled={uploading || !providerFile}
          startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
          size="large"
        >
          {uploading ? 'Uploading...' : 'Upload Provider'}
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Upload Provider
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Add a Terraform provider to your registry
      </Typography>

      <Paper sx={{ width: '100%' }}>
        {providerMethod === 'choose' && renderProviderMethodChooser()}
        {providerMethod === 'upload' && renderFileUploadForm()}
      </Paper>
    </Container>
  );
};

export default ProviderUploadPage;
