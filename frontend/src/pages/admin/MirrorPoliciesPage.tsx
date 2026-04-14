import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Container,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../../services/api';
import { MirrorPolicy } from '../../types/rbac';
import { getErrorMessage } from '../../utils/errors';
import { queryKeys } from '../../services/queryKeys';

interface PolicyFormData {
  name: string;
  description: string;
  policy_type: 'allow' | 'deny';
  upstream_registry: string;
  namespace_pattern: string;
  provider_pattern: string;
  priority: number;
  is_active: boolean;
  requires_approval: boolean;
}

const defaultFormData: PolicyFormData = {
  name: '',
  description: '',
  policy_type: 'allow',
  upstream_registry: '',
  namespace_pattern: '',
  provider_pattern: '',
  priority: 0,
  is_active: true,
  requires_approval: false,
};

const MirrorPoliciesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create / Edit dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<MirrorPolicy | null>(null);
  const [formData, setFormData] = useState<PolicyFormData>(defaultFormData);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<MirrorPolicy | null>(null);

  // Evaluate dialog
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
  const [evaluateForm, setEvaluateForm] = useState({ registry: '', namespace: '', provider: '' });
  const [evaluateResult, setEvaluateResult] = useState<{ allowed: boolean; matched_policy?: string; reason?: string } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const {
    data: policies = [],
    isLoading: loading,
    error: queryError,
    refetch: loadPolicies,
  } = useQuery<MirrorPolicy[]>({
    queryKey: queryKeys.policies.list(),
    queryFn: async () => {
      const data = await api.listMirrorPolicies();
      return Array.isArray(data) ? data : [];
    },
  });

  if (queryError && !error) {
    setError(getErrorMessage(queryError, 'Failed to load mirror policies'));
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof api.createMirrorPolicy>[0]) => {
      if (editingPolicy) {
        return api.updateMirrorPolicy(editingPolicy.id, payload);
      }
      return api.createMirrorPolicy(payload);
    },
    onSuccess: () => {
      setSuccess(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
      setError(null);
      setFormDialogOpen(false);
      setEditingPolicy(null);
      setFormData(defaultFormData);
      queryClient.invalidateQueries({ queryKey: queryKeys.policies._def });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to save policy'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMirrorPolicy(id),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setPolicyToDelete(null);
      setSuccess('Policy deleted successfully');
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.policies._def });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Failed to delete policy'));
    },
  });

  const saving = saveMutation.isPending;

  const handleSave = () => {
    setError(null);
    saveMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      policy_type: formData.policy_type,
      upstream_registry: formData.upstream_registry || undefined,
      namespace_pattern: formData.namespace_pattern || undefined,
      provider_pattern: formData.provider_pattern || undefined,
      priority: formData.priority,
      is_active: formData.is_active,
      requires_approval: formData.requires_approval,
    });
  };

  const handleDelete = () => {
    if (!policyToDelete) return;
    setError(null);
    deleteMutation.mutate(policyToDelete.id);
  };

  const handleEvaluate = async () => {
    try {
      setEvaluating(true);
      setEvaluateResult(null);
      const result = await api.evaluateMirrorPolicy({
        registry: evaluateForm.registry,
        namespace: evaluateForm.namespace,
        provider: evaluateForm.provider,
      });
      setEvaluateResult(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to evaluate policy'));
    } finally {
      setEvaluating(false);
    }
  };

  const openEditDialog = (policy: MirrorPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      policy_type: policy.policy_type,
      upstream_registry: policy.upstream_registry || '',
      namespace_pattern: policy.namespace_pattern || '',
      provider_pattern: policy.provider_pattern || '',
      priority: policy.priority ?? 0,
      is_active: policy.is_active,
      requires_approval: policy.requires_approval,
    });
    setFormDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPolicy(null);
    setFormData(defaultFormData);
    setFormDialogOpen(true);
  };

  const getPolicyTypeChip = (policyType: 'allow' | 'deny') => {
    if (policyType === 'allow') {
      return <Chip label="Allow" size="small" color="success" icon={<CheckCircleIcon />} />;
    }
    return <Chip label="Deny" size="small" color="error" icon={<BlockIcon />} />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4">Mirror Policies</Typography>
              <Typography variant="body2" color="text.secondary">
                Define allow/deny rules for provider mirroring
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Evaluate a policy">
                <Button
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => {
                    setEvaluateForm({ registry: '', namespace: '', provider: '' });
                    setEvaluateResult(null);
                    setEvaluateDialogOpen(true);
                  }}
                >
                  Evaluate
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadPolicies}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
              >
                Create Policy
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

          <Grid container spacing={3}>
            {policies.map((policy) => (
              <Grid size={{ xs: 12, md: 6 }} key={policy.id}>
                <Card sx={{ opacity: policy.is_active ? 1 : 0.6 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" sx={{ flex: 1, mr: 1 }}>
                        {policy.name}
                      </Typography>
                      <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                        {getPolicyTypeChip(policy.policy_type)}
                        <Chip
                          label={policy.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          color={policy.is_active ? 'default' : 'default'}
                          variant={policy.is_active ? 'filled' : 'outlined'}
                        />
                      </Box>
                    </Box>

                    {policy.description && (
                      <Typography variant="body2" color="textSecondary" paragraph>
                        {policy.description}
                      </Typography>
                    )}

                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
                      {policy.upstream_registry && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Registry: ${policy.upstream_registry}`}
                        />
                      )}
                      {policy.namespace_pattern && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Namespace: ${policy.namespace_pattern}`}
                        />
                      )}
                      {policy.provider_pattern && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Provider: ${policy.provider_pattern}`}
                        />
                      )}
                      {policy.requires_approval && (
                        <Chip
                          size="small"
                          color="warning"
                          label="Requires approval"
                        />
                      )}
                    </Box>

                    {policy.priority !== undefined && policy.priority !== 0 && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        Priority: {policy.priority}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions>
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label="Edit policy" onClick={() => openEditDialog(policy)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        aria-label="Delete policy"
                        color="error"
                        onClick={() => {
                          setPolicyToDelete(policy);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}

            {policies.length === 0 && !loading && (
              <Grid size={12}>
                <Card>
                  <CardContent>
                    <Typography variant="body1" color="textSecondary" align="center">
                      No mirror policies found. Create one to control which providers can be mirrored.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Create / Edit Dialog */}
          <Dialog
            open={formDialogOpen}
            onClose={() => {
              setFormDialogOpen(false);
              setEditingPolicy(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create Mirror Policy'}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Name"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  helperText="A unique name for this policy"
                />

                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <FormControl fullWidth required>
                  <InputLabel>Policy Type</InputLabel>
                  <Select
                    label="Policy Type"
                    value={formData.policy_type}
                    onChange={(e) =>
                      setFormData({ ...formData, policy_type: e.target.value as 'allow' | 'deny' })
                    }
                  >
                    <MenuItem value="allow">Allow — permit matching providers to be mirrored</MenuItem>
                    <MenuItem value="deny">Deny — block matching providers from being mirrored</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Upstream Registry"
                  fullWidth
                  value={formData.upstream_registry}
                  onChange={(e) => setFormData({ ...formData, upstream_registry: e.target.value })}
                  helperText="e.g., registry.terraform.io (leave blank to match any)"
                  placeholder="registry.terraform.io"
                />

                <TextField
                  label="Namespace Pattern"
                  fullWidth
                  value={formData.namespace_pattern}
                  onChange={(e) => setFormData({ ...formData, namespace_pattern: e.target.value })}
                  helperText="Glob pattern, e.g., hashicorp or hash* (leave blank to match any)"
                />

                <TextField
                  label="Provider Pattern"
                  fullWidth
                  value={formData.provider_pattern}
                  onChange={(e) => setFormData({ ...formData, provider_pattern: e.target.value })}
                  helperText="Glob pattern, e.g., aws or a* (leave blank to match any)"
                />

                <TextField
                  label="Priority"
                  type="number"
                  fullWidth
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                  }
                  helperText="Higher priority policies are evaluated first"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Active"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.requires_approval}
                      onChange={(e) =>
                        setFormData({ ...formData, requires_approval: e.target.checked })
                      }
                    />
                  }
                  label="Requires Approval"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setFormDialogOpen(false);
                  setEditingPolicy(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!formData.name || saving}
              >
                {saving ? 'Saving...' : editingPolicy ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete the policy "{policyToDelete?.name}"? This action cannot
                be undone.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* Evaluate Policy Dialog */}
          <Dialog
            open={evaluateDialogOpen}
            onClose={() => setEvaluateDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Evaluate Policy</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Check whether a specific provider would be allowed or denied by the current policy set.
                </Typography>
                <TextField
                  label="Registry"
                  fullWidth
                  required
                  value={evaluateForm.registry}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, registry: e.target.value })}
                  placeholder="registry.terraform.io"
                />
                <TextField
                  label="Namespace"
                  fullWidth
                  required
                  value={evaluateForm.namespace}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, namespace: e.target.value })}
                  placeholder="hashicorp"
                />
                <TextField
                  label="Provider"
                  fullWidth
                  required
                  value={evaluateForm.provider}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, provider: e.target.value })}
                  placeholder="aws"
                />
                {evaluateResult && (
                  <Alert
                    severity={evaluateResult.allowed ? 'success' : 'error'}
                    sx={{ mt: 1 }}
                  >
                    <Typography variant="body2">
                      <strong>{evaluateResult.allowed ? 'Allowed' : 'Denied'}</strong>
                      {evaluateResult.matched_policy && (
                        <> — matched policy: {evaluateResult.matched_policy}</>
                      )}
                      {evaluateResult.reason && <> ({evaluateResult.reason})</>}
                    </Typography>
                  </Alert>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEvaluateDialogOpen(false)}>Close</Button>
              <Button
                variant="contained"
                startIcon={evaluating ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                onClick={handleEvaluate}
                disabled={
                  evaluating ||
                  !evaluateForm.registry ||
                  !evaluateForm.namespace ||
                  !evaluateForm.provider
                }
              >
                {evaluating ? 'Evaluating...' : 'Evaluate'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
};

export default MirrorPoliciesPage;
