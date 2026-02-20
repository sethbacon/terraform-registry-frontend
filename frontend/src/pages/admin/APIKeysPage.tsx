import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  InputAdornment,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  Slider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import api from '../../services/api';
import { APIKey, UserMembership } from '../../types';
import { REGISTRY_HOST } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { AVAILABLE_SCOPES } from '../../types/rbac';

function getExpirationStatus(expiresAt?: string | null): 'expired' | 'expiring-soon' | 'active' | 'never' {
  if (!expiresAt) return 'never';
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return 'never';
  const now = new Date();
  if (exp <= now) return 'expired';
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (exp.getTime() - now.getTime() <= sevenDays) return 'expiring-soon';
  return 'active';
}

function toDatetimeLocalValue(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const APIKeysPage: React.FC = () => {
  const { allowedScopes, roleTemplate, user } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);

  // Create dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [keyToEdit, setKeyToEdit] = useState<APIKey | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    scopes: [] as string[],
    expires_at: '',
  });

  // Rotate dialog state
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [keyToRotate, setKeyToRotate] = useState<APIKey | null>(null);
  const [rotateMode, setRotateMode] = useState<'immediate' | 'grace'>('immediate');
  const [gracePeriodHours, setGracePeriodHours] = useState(24);
  const [rotatedKeyValue, setRotatedKeyValue] = useState<string | null>(null);
  const [rotateResult, setRotateResult] = useState<{ oldStatus: string; oldExpiresAt?: string } | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization_id: '',
    scopes: [] as string[],
    expires_at: '',
  });

  // Check if user has admin scope (which grants all permissions)
  const hasAdminScope = allowedScopes.includes('admin');

  // Get available scopes for this user
  const availableScopes = hasAdminScope
    ? AVAILABLE_SCOPES.map((s) => s.value)
    : allowedScopes;

  useEffect(() => {
    loadAPIKeys();
    loadMemberships();
  }, [user?.id]);

  const loadMemberships = async () => {
    if (!user?.id) return;
    try {
      setMembershipsLoading(true);
      // Use self-access endpoint that doesn't require users:read scope
      const userMemberships = await api.getCurrentUserMemberships();
      setMemberships(userMemberships);
    } catch (err) {
      console.error('Failed to load memberships:', err);
      setMemberships([]);
    } finally {
      setMembershipsLoading(false);
    }
  };

  const loadAPIKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const keys = await api.listAPIKeys();
      // Ensure keys is always an array
      setApiKeys(Array.isArray(keys) ? keys : []);
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setApiKeys([]);
      setError('Failed to load API keys. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Create Dialog ---

  const handleOpenDialog = () => {
    setNewKeyValue(null);
    const defaultScopes = ['modules:read', 'providers:read'].filter((s) =>
      availableScopes.includes(s)
    );
    const defaultOrgId = memberships.length > 0 ? memberships[0].organization_id : '';
    setFormData({
      name: '',
      description: '',
      organization_id: defaultOrgId,
      scopes: defaultScopes,
      expires_at: '',
    });
    setError(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCreateAPIKey = async () => {
    try {
      setError(null);
      const orgId = formData.organization_id || (memberships.length > 0 ? memberships[0].organization_id : '');
      if (!orgId) {
        setError('You must be a member of an organization to create API keys.');
        return;
      }
      const response = await api.createAPIKey({
        name: formData.name,
        organization_id: orgId,
        description: formData.description || undefined,
        scopes: formData.scopes,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : undefined,
      });
      setNewKeyValue(response.key);
      await loadAPIKeys();
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      setError(err.response?.data?.error || 'Failed to create API key. Please try again.');
    }
  };

  // --- Edit Dialog ---

  const handleEditClick = (key: APIKey) => {
    setKeyToEdit(key);
    setEditFormData({
      name: key.name || '',
      scopes: key.scopes || [],
      expires_at: toDatetimeLocalValue(key.expires_at),
    });
    setError(null);
    setEditDialogOpen(true);
  };

  const handleEditScopeToggle = (scope: string) => {
    setEditFormData((prev) => {
      const newScopes = prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope];
      return { ...prev, scopes: newScopes };
    });
  };

  const handleEditSave = async () => {
    if (!keyToEdit) return;
    try {
      setError(null);
      await api.updateAPIKey(keyToEdit.id, {
        name: editFormData.name,
        scopes: editFormData.scopes,
        expires_at: editFormData.expires_at ? new Date(editFormData.expires_at).toISOString() : undefined,
      });
      setEditDialogOpen(false);
      setKeyToEdit(null);
      await loadAPIKeys();
    } catch (err: any) {
      console.error('Failed to update API key:', err);
      setError(err.response?.data?.error || 'Failed to update API key. Please try again.');
    }
  };

  // --- Rotate Dialog ---

  const handleRotateClick = (key: APIKey) => {
    setKeyToRotate(key);
    setRotateMode('immediate');
    setGracePeriodHours(24);
    setRotatedKeyValue(null);
    setRotateResult(null);
    setError(null);
    setRotateDialogOpen(true);
  };

  const handleRotateConfirm = async () => {
    if (!keyToRotate) return;
    try {
      setError(null);
      const hours = rotateMode === 'immediate' ? 0 : gracePeriodHours;
      const response = await api.rotateAPIKey(keyToRotate.id, hours);
      const newKey = response.new_key;
      setRotatedKeyValue(newKey?.key || newKey?.Key || '');
      setRotateResult({
        oldStatus: response.old_key_status,
        oldExpiresAt: response.old_expires_at,
      });
      await loadAPIKeys();
    } catch (err: any) {
      console.error('Failed to rotate API key:', err);
      setError(err.response?.data?.error || 'Failed to rotate API key. Please try again.');
    }
  };

  const handleCloseRotateDialog = () => {
    setRotateDialogOpen(false);
    setKeyToRotate(null);
    setRotatedKeyValue(null);
    setRotateResult(null);
  };

  // --- Delete Dialog ---

  const handleDeleteClick = (key: APIKey) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;
    try {
      setError(null);
      await api.deleteAPIKey(keyToDelete.id);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
      loadAPIKeys();
    } catch (err: any) {
      console.error('Failed to delete API key:', err);
      setError(err.response?.data?.error || 'Failed to delete API key. Please try again.');
    }
  };

  // --- Helpers ---

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleShowKey = (keyId: string) => {
    const newShowKeys = new Set(showKeys);
    if (newShowKeys.has(keyId)) {
      newShowKeys.delete(keyId);
    } else {
      newShowKeys.add(keyId);
    }
    setShowKeys(newShowKeys);
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  };

  const handleScopeToggle = (scope: string) => {
    setFormData((prev) => {
      const newScopes = prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope];
      return { ...prev, scopes: newScopes };
    });
  };

  const getScopeInfo = (scopeValue: string) => {
    return AVAILABLE_SCOPES.find((s) => s.value === scopeValue) || {
      value: scopeValue,
      label: scopeValue,
      description: '',
    };
  };

  const renderExpirationChip = (expiresAt?: string | null) => {
    const status = getExpirationStatus(expiresAt);
    switch (status) {
      case 'expired':
        return <Chip label="Expired" size="small" color="error" />;
      case 'expiring-soon':
        return (
          <Tooltip title={`Expires ${new Date(expiresAt!).toLocaleString()}`}>
            <Chip label="Expires soon" size="small" color="warning" />
          </Tooltip>
        );
      case 'active':
        return (
          <Typography variant="body2">
            {new Date(expiresAt!).toLocaleDateString()}
          </Typography>
        );
      case 'never':
      default:
        return (
          <Typography variant="body2" color="text.secondary">
            Never
          </Typography>
        );
    }
  };

  const renderScopeChips = (scopes: string[]) => {
    if (!scopes || scopes.length === 0) return <Typography variant="body2" color="text.secondary">None</Typography>;
    const maxVisible = 2;
    const visible = scopes.slice(0, maxVisible);
    const remaining = scopes.length - maxVisible;
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visible.map((scope) => (
          <Chip
            key={scope}
            label={scope}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              backgroundColor:
                scope === 'admin'
                  ? 'error.light'
                  : scope.includes(':write') || scope.includes(':manage')
                  ? 'warning.light'
                  : 'success.light',
            }}
          />
        ))}
        {remaining > 0 && (
          <Tooltip title={scopes.slice(maxVisible).join(', ')}>
            <Chip label={`+${remaining}`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
          </Tooltip>
        )}
      </Box>
    );
  };

  // Scope checkboxes component (reused in create and edit dialogs)
  const renderScopeCheckboxes = (
    selectedScopes: string[],
    onToggle: (scope: string) => void
  ) => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Scopes
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Select the permissions for this API key. You can only select scopes within your role's permissions.
      </Typography>
      {availableScopes.length === 0 ? (
        <Alert severity="error">
          No scopes available. Please contact an administrator to assign you a role.
        </Alert>
      ) : (
        <FormGroup>
          {availableScopes.map((scope) => {
            const info = getScopeInfo(scope);
            return (
              <Tooltip key={scope} title={info.description} placement="right">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedScopes.includes(scope)}
                      onChange={() => onToggle(scope)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{info.label}</Typography>
                      <Chip
                        label={scope}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor:
                            scope === 'admin'
                              ? 'error.light'
                              : scope.includes(':write') || scope.includes(':manage')
                              ? 'warning.light'
                              : 'success.light',
                        }}
                      />
                    </Box>
                  }
                />
              </Tooltip>
            );
          })}
        </FormGroup>
      )}
      {selectedScopes.length === 0 && availableScopes.length > 0 && (
        <Typography variant="caption" color="error">
          Please select at least one scope
        </Typography>
      )}
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            API Keys
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage API keys for Terraform CLI authentication
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Create API Key
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!membershipsLoading && memberships.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You are not a member of any organization. Contact an administrator to add you to an organization before creating API keys.
        </Alert>
      )}

      {/* API Keys Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : apiKeys.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">No API keys found</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenDialog}
              sx={{ mt: 2 }}
            >
              Create First API Key
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Scopes</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((apiKey) => {
                  const expStatus = getExpirationStatus(apiKey.expires_at);
                  return (
                    <TableRow
                      key={apiKey.id}
                      sx={expStatus === 'expired' ? { opacity: 0.5 } : undefined}
                    >
                      <TableCell>
                        <Typography fontWeight="medium">{apiKey.name || '-'}</Typography>
                        {apiKey.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {apiKey.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                          >
                            {showKeys.has(apiKey.id)
                              ? (apiKey.key_prefix ? apiKey.key_prefix + '...' : '-')
                              : (apiKey.key_prefix ? maskKey(apiKey.key_prefix + '...') : '-')}
                          </Typography>
                          {apiKey.key_prefix && (
                            <IconButton
                              size="small"
                              onClick={() => toggleShowKey(apiKey.id)}
                            >
                              {showKeys.has(apiKey.id) ? (
                                <VisibilityOffIcon fontSize="small" />
                              ) : (
                                <VisibilityIcon fontSize="small" />
                              )}
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{renderScopeChips(apiKey.scopes)}</TableCell>
                      <TableCell>{renderExpirationChip(apiKey.expires_at)}</TableCell>
                      <TableCell>
                        {apiKey.last_used_at && !isNaN(Date.parse(apiKey.last_used_at))
                          ? new Date(apiKey.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {apiKey.created_at && !isNaN(Date.parse(apiKey.created_at))
                          ? new Date(apiKey.created_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditClick(apiKey)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Rotate">
                            <IconButton
                              size="small"
                              onClick={() => handleRotateClick(apiKey)}
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(apiKey)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create API Key Dialog */}
      <Dialog
        open={openDialog}
        onClose={newKeyValue ? undefined : handleCloseDialog}
        disableEscapeKeyDown={!!newKeyValue}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          {newKeyValue ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                API key created successfully! Make sure to copy it now - you won't be able to see
                it again.
              </Alert>
              <TextField
                label="API Key"
                value={newKeyValue}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleCopyKey(newKeyValue)}>
                        <CopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { fontFamily: 'monospace' },
                }}
              />
              {copiedKey && (
                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                  Copied to clipboard!
                </Typography>
              )}
            </Box>
          ) : (
            <Stack spacing={3} sx={{ mt: 2 }}>
              {!roleTemplate && (
                <Alert severity="warning" icon={<InfoIcon />}>
                  You don't have a role template assigned. Contact an administrator to assign a role
                  before creating API keys.
                </Alert>
              )}
              {roleTemplate && (
                <Alert severity="info" icon={<InfoIcon />}>
                  Your role: <strong>{roleTemplate.display_name}</strong>. You can only create API keys
                  with scopes that match your role permissions.
                </Alert>
              )}
              {memberships.length === 0 && (
                <Alert severity="error">
                  You must be a member of an organization to create API keys.
                </Alert>
              )}
              {memberships.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>Organization</InputLabel>
                  <Select
                    value={formData.organization_id}
                    onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                    label="Organization"
                  >
                    {memberships.map((m) => (
                      <MenuItem key={m.organization_id} value={m.organization_id}>
                        {m.organization_name} {m.role_template_display_name && `(${m.role_template_display_name})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                helperText="A descriptive name for this API key"
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
              <TextField
                label="Expiration Date"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Leave empty for a key that never expires"
              />
              {renderScopeCheckboxes(formData.scopes, handleScopeToggle)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {newKeyValue ? (
            <Button onClick={handleCloseDialog} variant="contained">
              Done
            </Button>
          ) : (
            <>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button
                onClick={handleCreateAPIKey}
                variant="contained"
                disabled={
                  !formData.name ||
                  formData.scopes.length === 0 ||
                  availableScopes.length === 0 ||
                  memberships.length === 0
                }
              >
                Create
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit API Key Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit API Key</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Name"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Expiration Date"
              type="datetime-local"
              value={editFormData.expires_at}
              onChange={(e) => setEditFormData({ ...editFormData, expires_at: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for a key that never expires"
            />
            {renderScopeCheckboxes(editFormData.scopes, handleEditScopeToggle)}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={!editFormData.name || editFormData.scopes.length === 0}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rotate API Key Dialog */}
      <Dialog
        open={rotateDialogOpen}
        onClose={rotatedKeyValue ? undefined : handleCloseRotateDialog}
        disableEscapeKeyDown={!!rotatedKeyValue}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rotate API Key</DialogTitle>
        <DialogContent>
          {rotatedKeyValue ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                Key rotated successfully! Copy your new key now - you won't be able to see it again.
              </Alert>
              <TextField
                label="New API Key"
                value={rotatedKeyValue}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleCopyKey(rotatedKeyValue)}>
                        <CopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { fontFamily: 'monospace' },
                }}
              />
              {copiedKey && (
                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                  Copied to clipboard!
                </Typography>
              )}
              {rotateResult && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {rotateResult.oldStatus === 'revoked'
                    ? 'The old key has been revoked immediately.'
                    : `The old key will remain valid until ${new Date(rotateResult.oldExpiresAt!).toLocaleString()}.`}
                </Alert>
              )}
            </Box>
          ) : (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Typography>
                Rotating key "<strong>{keyToRotate?.name}</strong>" will generate a new key.
                Choose how to handle the old key:
              </Typography>
              <FormControl>
                <RadioGroup
                  value={rotateMode}
                  onChange={(e) => setRotateMode(e.target.value as 'immediate' | 'grace')}
                >
                  <FormControlLabel
                    value="immediate"
                    control={<Radio />}
                    label="Revoke old key immediately"
                  />
                  <FormControlLabel
                    value="grace"
                    control={<Radio />}
                    label="Keep old key valid for a grace period"
                  />
                </RadioGroup>
              </FormControl>
              {rotateMode === 'grace' && (
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Grace period: {gracePeriodHours} hour{gracePeriodHours !== 1 ? 's' : ''}
                  </Typography>
                  <Slider
                    value={gracePeriodHours}
                    onChange={(_, val) => setGracePeriodHours(val as number)}
                    min={1}
                    max={72}
                    step={1}
                    marks={[
                      { value: 1, label: '1h' },
                      { value: 24, label: '24h' },
                      { value: 48, label: '48h' },
                      { value: 72, label: '72h' },
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}h`}
                  />
                  <Typography variant="caption" color="text.secondary">
                    The old key will continue to work during the grace period, giving you time to update integrations.
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {rotatedKeyValue ? (
            <Button onClick={handleCloseRotateDialog} variant="contained">
              Done
            </Button>
          ) : (
            <>
              <Button onClick={handleCloseRotateDialog}>Cancel</Button>
              <Button onClick={handleRotateConfirm} variant="contained" color="warning">
                Rotate Key
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete API key "{keyToDelete?.name}"? This action cannot be
            undone and will break any existing integrations using this key.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Usage Instructions */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Using API Keys
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          To use an API key with Terraform CLI, add it to your Terraform CLI configuration:
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
              color: (theme) => theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
            }}
          >
            {`# ~/.terraformrc (Unix) or %APPDATA%/terraform.rc (Windows)
credentials "${REGISTRY_HOST}" {
  token = "YOUR_API_KEY_HERE"
}`}
          </Box>
        </Typography>
      </Paper>
    </Container>
  );
};

export default APIKeysPage;
