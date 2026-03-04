import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Stack,
  CircularProgress,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import SCMIcon from '@mui/icons-material/AccountTree';
import ArrowBack from '@mui/icons-material/ArrowBack';
import api from '../../services/api';
import PublishFromSCMWizard from '../../components/PublishFromSCMWizard';

type ModuleMethod = 'choose' | 'upload' | 'scm';

const ModuleUploadPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    moduleData?: { namespace: string; name: string; provider: string };
    method?: ModuleMethod;
  };
  const prefilledModule = state?.moduleData;

  const [moduleMethod, setModuleMethod] = useState<ModuleMethod>(state?.method ?? 'choose');

  // SCM new-module metadata (before wizard)
  const [scmNamespace, setScmNamespace] = useState(prefilledModule?.namespace || '');
  const [scmName, setScmName] = useState(prefilledModule?.name || '');
  const [scmSystem, setScmSystem] = useState(prefilledModule?.provider || '');
  const [scmDescription, setScmDescription] = useState('');
  const [scmModuleId, setScmModuleId] = useState<string | null>(null);
  const [scmCreating, setScmCreating] = useState(false);
  const [scmError, setScmError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Module upload state
  const [moduleFile, setModuleFile] = useState<File | null>(null);
  const [moduleNamespace, setModuleNamespace] = useState(prefilledModule?.namespace || '');
  const [moduleName, setModuleName] = useState(prefilledModule?.name || '');
  const [moduleProvider, setModuleProvider] = useState(prefilledModule?.provider || '');
  const [moduleVersion, setModuleVersion] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');

  const handleModuleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setModuleFile(file);
      setError(null);
    }
  };

  const handleModuleUpload = async () => {
    if (!moduleFile || !moduleNamespace || !moduleName || !moduleProvider || !moduleVersion) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('namespace', moduleNamespace);
      formData.append('name', moduleName);
      formData.append('system', moduleProvider);
      formData.append('version', moduleVersion);
      if (moduleDescription) formData.append('description', moduleDescription);
      formData.append('file', moduleFile);

      await api.uploadModule(formData);

      navigate(`/modules/${moduleNamespace}/${moduleName}/${moduleProvider}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload module. Please try again.');
      setUploading(false);
    }
  };

  const handleScmProceed = async () => {
    if (!scmNamespace || !scmName || !scmSystem) {
      setScmError('Namespace, name, and provider are required');
      return;
    }
    try {
      setScmCreating(true);
      setScmError(null);
      const module = await api.createModuleRecord({
        namespace: scmNamespace,
        name: scmName,
        system: scmSystem,
        description: scmDescription || undefined,
      });
      setScmModuleId(module.id);
    } catch (err: any) {
      setScmError(err.response?.data?.error || 'Failed to create module record');
    } finally {
      setScmCreating(false);
    }
  };

  const renderModuleMethodChooser = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        How would you like to publish this module?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a packaged archive directly, or connect a git repository for automated publishing via webhooks.
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setModuleMethod('upload')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Upload from File
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Package your module as a <strong>.tar.gz</strong> archive and upload it directly. Best for one-off or manual releases.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          variant="outlined"
          sx={{ flex: 1, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea sx={{ height: '100%' }} onClick={() => setModuleMethod('scm')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <SCMIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Link from SCM Repository
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Connect a GitHub, Azure DevOps, GitLab, or Bitbucket repository. New versions publish automatically when tags are pushed.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  );

  const renderScmMetadataForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => { setModuleMethod('choose'); setScmError(null); setScmModuleId(null); }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        Link Module to SCM Repository
      </Typography>

      {scmModuleId ? (
        <PublishFromSCMWizard
          moduleId={scmModuleId}
          moduleSystem={scmSystem}
          onComplete={() => {
            navigate(`/modules/${scmNamespace}/${scmName}/${scmSystem}`);
          }}
          onCancel={() => {
            setModuleMethod('choose');
            setScmModuleId(null);
          }}
        />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            First, define the module identity. Then you'll choose a repository and configure publishing settings.
          </Typography>
          <Stack spacing={3} sx={{ maxWidth: 500 }}>
            <TextField
              label="Namespace"
              value={scmNamespace}
              onChange={(e) => setScmNamespace(e.target.value)}
              placeholder="e.g., bconline"
              required
              fullWidth
              helperText="Your organization identifier"
            />
            <TextField
              label="Module Name"
              value={scmName}
              onChange={(e) => setScmName(e.target.value)}
              placeholder="e.g., networking-vpc"
              required
              fullWidth
            />
            <TextField
              label="Provider"
              value={scmSystem}
              onChange={(e) => setScmSystem(e.target.value)}
              placeholder="e.g., aws"
              required
              fullWidth
              helperText="Cloud provider this module targets (aws, azure, google, etc.)"
            />
            <TextField
              label="Description (optional)"
              value={scmDescription}
              onChange={(e) => setScmDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            {scmError && <Alert severity="error">{scmError}</Alert>}

            <Button
              variant="contained"
              onClick={handleScmProceed}
              disabled={scmCreating || !scmNamespace || !scmName || !scmSystem}
              startIcon={scmCreating ? <CircularProgress size={18} /> : <SCMIcon />}
              size="large"
            >
              {scmCreating ? 'Creating...' : 'Continue to Repository Selection'}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );

  const renderFileUploadForm = () => (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => { setModuleMethod('choose'); setError(null); setSuccess(null); }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>
      <Typography variant="h6" gutterBottom>
        Upload Terraform Module
      </Typography>
      <Box sx={{ mb: 3, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>Requirements:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          • Package your module as a <strong>.tar.gz</strong> or <strong>.tgz</strong> file<br />
          • Include all <strong>.tf</strong> files (main.tf, variables.tf, outputs.tf)<br />
          • Add a <strong>README.md</strong> with usage documentation<br />
          • Use semantic versioning (1.0.0, 2.1.3, etc.)<br />
          • Module address format: <strong>namespace/name/provider</strong>
        </Typography>
      </Box>

      <Stack spacing={3}>
        <TextField
          label="Namespace"
          value={moduleNamespace}
          onChange={(e) => setModuleNamespace(e.target.value)}
          placeholder="e.g., bconline"
          required
          fullWidth
          helperText="Your organization identifier (like a GitHub or DevOps org)."
        />
        <TextField
          label="Description"
          value={moduleDescription}
          onChange={(e) => setModuleDescription(e.target.value)}
          placeholder="e.g., Creates a VPC with public and private subnets"
          fullWidth
          multiline
          rows={3}
          helperText="Brief description of what this module does and its purpose."
        />
        <TextField
          label="Module Name"
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          placeholder="e.g., networking-vpc"
          required
          fullWidth
          helperText="Descriptive name for what the module does"
        />
        <TextField
          label="Provider"
          value={moduleProvider}
          onChange={(e) => setModuleProvider(e.target.value)}
          placeholder="e.g., aws"
          required
          fullWidth
          helperText="Cloud provider this module targets (aws, azure, google, etc.)"
        />
        <TextField
          label="Version"
          value={moduleVersion}
          onChange={(e) => setModuleVersion(e.target.value)}
          placeholder="e.g., 1.0.0"
          required
          fullWidth
          helperText="Semantic version in format X.Y.Z (e.g., 1.0.0, 2.1.3). Use 0.x.x for pre-release."
        />

        <Box>
          <input
            id="module-file-input"
            type="file"
            accept=".tar.gz,.tgz"
            onChange={handleModuleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="module-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              fullWidth
              sx={{ py: 2 }}
            >
              {moduleFile ? moduleFile.name : 'Select Module File (.tar.gz)'}
            </Button>
          </label>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Button
          variant="contained"
          onClick={handleModuleUpload}
          disabled={uploading || !moduleFile}
          startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
          size="large"
        >
          {uploading ? 'Uploading...' : 'Upload Module'}
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Upload Module
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Publish a Terraform module to your registry
      </Typography>

      <Paper sx={{ width: '100%' }}>
        {moduleMethod === 'choose' && renderModuleMethodChooser()}
        {moduleMethod === 'upload' && renderFileUploadForm()}
        {moduleMethod === 'scm' && renderScmMetadataForm()}
      </Paper>
    </Container>
  );
};

export default ModuleUploadPage;
