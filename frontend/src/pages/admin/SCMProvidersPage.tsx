import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import GitHubIcon from '@mui/icons-material/GitHub';
import CloudIcon from '@mui/icons-material/Cloud';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { SCMProvider, SCMProviderType, CreateSCMProviderRequest } from '../../types/scm';
import type { UserMembership } from '../../types';

interface TokenStatus {
  connected: boolean;
  connected_at?: string;
  expires_at?: string | null;
  token_type?: string;
}

const SCMProvidersPage: React.FC = () => {
  const { user } = useAuth();
  const [providers, setProviders] = useState<SCMProvider[]>([]);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [tokenStatuses, setTokenStatuses] = useState<Record<string, TokenStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SCMProvider | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<SCMProvider | null>(null);
  const [patDialogOpen, setPatDialogOpen] = useState(false);
  const [patValue, setPatValue] = useState('');
  const [patProvider, setPatProvider] = useState<SCMProvider | null>(null);

  const [formData, setFormData] = useState<Partial<CreateSCMProviderRequest>>({
    organization_id: undefined,
    provider_type: 'github',
    name: '',
    base_url: null,
    tenant_id: null,
    client_id: '',
    client_secret: '',
    webhook_secret: '',
  });

  useEffect(() => {
    loadProviders();
    loadMemberships();
  }, []);

  const loadMemberships = async () => {
    try {
      if (user?.id) {
        const data = await apiClient.getCurrentUserMemberships();
        setMemberships(data || []);
        // Set first organization as default if available
        if (data && data.length > 0 && !formData.organization_id) {
          setFormData(prev => ({
            ...prev,
            organization_id: data[0].organization_id,
          }));
        }
      }
    } catch (err: any) {
      console.error('Error loading memberships:', err);
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.listSCMProviders();
      const providerList = Array.isArray(data) ? data : [];
      setProviders(providerList);

      // Fetch token status for each provider in parallel
      const statusEntries = await Promise.allSettled(
        providerList.map((p) => apiClient.getSCMTokenStatus(p.id).then((s) => [p.id, s] as const))
      );
      const statuses: Record<string, TokenStatus> = {};
      statusEntries.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [id, status] = result.value;
          statuses[id] = status;
        }
      });
      setTokenStatuses(statuses);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load SCM providers');
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError(null);
      await apiClient.createSCMProvider(formData as CreateSCMProviderRequest);
      setCreateDialogOpen(false);
      resetForm();
      await loadProviders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create provider');
    }
  };

  const handleUpdate = async () => {
    if (!editingProvider) return;
    try {
      setError(null);
      await apiClient.updateSCMProvider(editingProvider.id, {
        name: formData.name,
        base_url: formData.base_url,
        tenant_id: formData.tenant_id,
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        webhook_secret: formData.webhook_secret,
      });
      setEditingProvider(null);
      resetForm();
      await loadProviders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update provider');
    }
  };

  const handleDelete = async () => {
    if (!providerToDelete) return;
    try {
      setError(null);
      await apiClient.deleteSCMProvider(providerToDelete.id);
      setDeleteConfirmOpen(false);
      setProviderToDelete(null);
      await loadProviders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete provider');
    }
  };

  const handleConnect = async (provider: SCMProvider) => {
    if (provider.provider_type === 'bitbucket_dc') {
      setPatProvider(provider);
      setPatValue('');
      setPatDialogOpen(true);
    } else {
      try {
        const response = await apiClient.initiateSCMOAuth(provider.id);
        window.location.href = response.authorization_url;
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to initiate OAuth');
      }
    }
  };

  const handleSavePAT = async () => {
    if (!patProvider || !patValue) return;
    try {
      setError(null);
      await apiClient.saveSCMToken(patProvider.id, patValue);
      setPatDialogOpen(false);
      setPatValue('');
      setPatProvider(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save access token');
    }
  };

  const isPATProvider = (type?: SCMProviderType) => type === 'bitbucket_dc';

  const getCallbackUrl = (providerId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/v1/scm-providers/${providerId}/oauth/callback`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const resetForm = () => {
    setFormData({
      organization_id: undefined,
      provider_type: 'github',
      name: '',
      base_url: null,
      tenant_id: null,
      client_id: '',
      client_secret: '',
      webhook_secret: '',
    });
  };

  const openEditDialog = (provider: SCMProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      base_url: provider.base_url,
      tenant_id: provider.tenant_id,
      client_id: provider.client_id,
      client_secret: '', // Don't show existing secret
      webhook_secret: provider.webhook_secret || '',
    });
  };

  const getProviderIcon = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return <GitHubIcon />;
      case 'azuredevops':
        return <CloudIcon />;
      case 'gitlab':
        return <CloudIcon />;
      case 'bitbucket_dc':
        return <CloudIcon />;
      default:
        return <CloudIcon />;
    }
  };

  const getProviderLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return 'GitHub';
      case 'azuredevops':
        return 'Azure DevOps';
      case 'gitlab':
        return 'GitLab';
      case 'bitbucket_dc':
        return 'Bitbucket Data Center';
      default:
        return type;
    }
  };

  const getClientIdLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return 'Client ID';
      case 'azuredevops':
        return 'App ID';
      case 'gitlab':
        return 'Application ID';
      default:
        return 'Client ID';
    }
  };

  const getClientSecretLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return 'Client Secret';
      case 'azuredevops':
        return 'Client Secret';
      case 'gitlab':
        return 'Secret';
      default:
        return 'Client Secret';
    }
  };

  const getBaseUrlHelper = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return 'For GitHub Enterprise: https://github.company.com';
      case 'azuredevops':
        return 'For Azure DevOps Server: https://dev.azure.com/organization';
      case 'gitlab':
        return 'For self-hosted GitLab: https://gitlab.company.com';
      case 'bitbucket_dc':
        return 'Required: https://bitbucket.company.com';
      default:
        return 'For self-hosted instances';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">SCM Providers</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadProviders}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            Add Provider
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {providers.map((provider) => (
          <Grid item xs={12} md={6} lg={4} key={provider.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box mr={2}>{getProviderIcon(provider.provider_type)}</Box>
                  <Box flexGrow={1}>
                    <Typography variant="h6">{provider.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {getProviderLabel(provider.provider_type)}
                    </Typography>
                  </Box>
                  <Chip
                    label={provider.is_active ? 'Active' : 'Inactive'}
                    color={provider.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {provider.tenant_id && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Tenant ID: {provider.tenant_id}
                  </Typography>
                )}

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {getClientIdLabel(provider.provider_type)}: {provider.client_id}
                </Typography>

                {provider.base_url && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Base URL: {provider.base_url}
                  </Typography>
                )}

                {provider.provider_type !== 'bitbucket_dc' && (
                  <Box
                    mt={2}
                    p={1.5}
                    sx={{
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                      borderRadius: 1,
                      border: (theme) =>
                        `1px solid ${theme.palette.mode === 'dark' ? '#404040' : '#e0e0e0'}`,
                    }}
                  >
                    <Typography variant="caption" color="textSecondary" display="block" mb={0.5}>
                      OAuth Callback URL:
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          wordBreak: 'break-all',
                          flex: 1,
                          color: (theme) =>
                            theme.palette.mode === 'dark'
                              ? theme.palette.primary.light
                              : theme.palette.primary.main,
                        }}
                      >
                        {getCallbackUrl(provider.id)}
                      </Typography>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(getCallbackUrl(provider.id))}
                          sx={{ flexShrink: 0 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Box display="flex" alignItems="flex-start" gap={1}>
                  <Box flex={1}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Created: {new Date(provider.created_at).toLocaleDateString()}
                    </Typography>
                    {(() => {
                      const status = tokenStatuses[provider.id];
                      if (!status) return null;
                      return status.connected ? (
                        <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                          <CheckCircleIcon sx={{ fontSize: '0.9rem', color: 'success.main' }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, lineHeight: 1.2, display: 'block' }}>
                              Connected
                            </Typography>
                            {status.connected_at && (
                              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                                {new Date(status.connected_at).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ) : (
                        <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                          <LinkOffIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
                          <Typography variant="caption" color="textDisabled" sx={{ fontStyle: 'italic' }}>
                            Not connected
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Box>
                  {tokenStatuses[provider.id]?.connected && (
                    <Chip
                      label={tokenStatuses[provider.id]?.token_type === 'pat' ? 'PAT' : 'OAuth'}
                      size="small"
                      variant="outlined"
                      color="success"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Box>
              </CardContent>

              <CardActions>
                <Tooltip title={tokenStatuses[provider.id]?.connected
                  ? (provider.provider_type === 'bitbucket_dc' ? 'Update PAT' : 'Reconnect OAuth')
                  : (provider.provider_type === 'bitbucket_dc' ? 'Connect PAT' : 'Connect OAuth')
                }>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleConnect(provider)}
                  >
                    <LinkIcon />
                  </IconButton>
                </Tooltip>
                {tokenStatuses[provider.id]?.connected && (
                  <Tooltip title="Disconnect">
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={async () => {
                        try {
                          await apiClient.revokeSCMToken(provider.id);
                          await loadProviders();
                        } catch (err: any) {
                          setError(err.response?.data?.error || 'Failed to disconnect');
                        }
                      }}
                    >
                      <LinkOffIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => openEditDialog(provider)}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      setProviderToDelete(provider);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {providers.length === 0 && !loading && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No SCM providers configured. Add one to get started!
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || !!editingProvider}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingProvider(null);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add SCM Provider'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {memberships.length > 1 && !editingProvider && (
              <FormControl fullWidth>
                <InputLabel id="organization-label">Organization</InputLabel>
                <Select
                  labelId="organization-label"
                  value={formData.organization_id || ''}
                  label="Organization"
                  onChange={(e) =>
                    setFormData({ ...formData, organization_id: e.target.value as string })
                  }
                >
                  {memberships.map((membership) => (
                    <MenuItem key={membership.organization_id} value={membership.organization_id}>
                      {membership.organization_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {!editingProvider && (
              <FormControl fullWidth>
                <InputLabel id="provider-type-label">Provider Type</InputLabel>
                <Select
                  labelId="provider-type-label"
                  value={formData.provider_type}
                  label="Provider Type"
                  onChange={(e) =>
                    setFormData({ ...formData, provider_type: e.target.value as SCMProviderType })
                  }
                >
                  <MenuItem value="github">GitHub</MenuItem>
                  <MenuItem value="azuredevops">Azure DevOps</MenuItem>
                  <MenuItem value="gitlab">GitLab</MenuItem>
                  <MenuItem value="bitbucket_dc">Bitbucket Data Center</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              helperText="Friendly name to identify this SCM connection (e.g., 'GitHub Production', 'Internal GitLab')"
            />

            {(editingProvider?.provider_type || formData.provider_type) === 'azuredevops' && (
              <TextField
                label="Tenant ID"
                fullWidth
                value={formData.tenant_id || ''}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value || null })}
                required
                helperText="Your Azure AD / Entra Tenant ID (found in Azure Portal → Azure Active Directory → Overview)"
              />
            )}

            {!isPATProvider(editingProvider?.provider_type || formData.provider_type) && (
              <>
                <TextField
                  label={getClientIdLabel(editingProvider?.provider_type || formData.provider_type || 'github')}
                  fullWidth
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                  helperText="OAuth App Client ID from your SCM provider's application or developer settings"
                />

                <TextField
                  label={getClientSecretLabel(editingProvider?.provider_type || formData.provider_type || 'github')}
                  type="password"
                  fullWidth
                  value={formData.client_secret}
                  onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                  required={!editingProvider}
                  helperText={editingProvider ? 'Leave blank to keep existing secret' : ''}
                />
              </>
            )}

            <TextField
              label={isPATProvider(editingProvider?.provider_type || formData.provider_type) ? 'Base URL' : 'Base URL (optional)'}
              fullWidth
              value={formData.base_url || ''}
              onChange={(e) =>
                setFormData({ ...formData, base_url: e.target.value || null })
              }
              required={isPATProvider(editingProvider?.provider_type || formData.provider_type)}
              helperText={getBaseUrlHelper(editingProvider?.provider_type || formData.provider_type || 'github')}
            />

            <TextField
              label="Webhook Secret (optional)"
              fullWidth
              value={formData.webhook_secret}
              onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              helperText="Used to validate webhook signatures from your SCM system. Can be added later."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setEditingProvider(null);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingProvider ? handleUpdate : handleCreate}
            disabled={!formData.name || (!isPATProvider(formData.provider_type) && (!formData.client_id || !formData.client_secret)) || (isPATProvider(formData.provider_type) && !formData.base_url)}
          >
            {editingProvider ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the provider "{providerToDelete?.name}"? This action
            cannot be undone and will remove all associated OAuth tokens and module links.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* PAT Dialog for Bitbucket Data Center */}
      <Dialog
        open={patDialogOpen}
        onClose={() => {
          setPatDialogOpen(false);
          setPatValue('');
          setPatProvider(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Connect to {patProvider?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Enter your Bitbucket Data Center Personal Access Token. You can generate one from your
              Bitbucket account settings under HTTP access tokens.
            </Typography>
            <TextField
              label="Personal Access Token"
              type="password"
              fullWidth
              value={patValue}
              onChange={(e) => setPatValue(e.target.value)}
              required
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPatDialogOpen(false);
              setPatValue('');
              setPatProvider(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePAT}
            disabled={!patValue}
          >
            Save Token
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SCMProvidersPage;
