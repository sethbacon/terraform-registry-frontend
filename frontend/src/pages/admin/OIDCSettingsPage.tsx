import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Autocomplete,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SaveIcon from '@mui/icons-material/Save';
import api from '../../services/api';
import type { OIDCConfigResponse, OIDCGroupMapping, OIDCGroupMappingInput, Organization } from '../../types';
import { queryKeys } from '../../services/queryKeys';

// Available roles that can be assigned to mapped groups — must match system role template names
const AVAILABLE_ROLES = ['viewer', 'publisher', 'devops', 'user_manager', 'auditor', 'admin'];

const emptyMapping: OIDCGroupMapping = { group: '', organization: '', role: 'viewer' };

const OIDCSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Group claim name + default role (top-level form fields)
  const [groupClaimName, setGroupClaimName] = useState('');
  const [defaultRole, setDefaultRole] = useState('');

  // Group mapping rows
  const [mappings, setMappings] = useState<OIDCGroupMapping[]>([]);

  // Dialog state for add/edit mapping
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [mappingForm, setMappingForm] = useState<OIDCGroupMapping>(emptyMapping);

  // Delete confirm dialog
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Org autocomplete state
  const [orgOptions, setOrgOptions] = useState<string[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgInputValue, setOrgInputValue] = useState('');

  const {
    data: config = null,
    isLoading: loading,
    error: queryError,
  } = useQuery<OIDCConfigResponse>({
    queryKey: queryKeys.oidcConfig.get(),
    queryFn: () => api.getAdminOIDCConfig(),
  });

  // Sync local form state when config loads
  useEffect(() => {
    if (config) {
      setGroupClaimName(config.group_claim_name ?? '');
      setDefaultRole(config.default_role ?? '');
      setMappings(config.group_mappings ?? []);
    }
  }, [config]);

  if (queryError && !error) {
    const e = queryError as { response?: { data?: { error?: string } } };
    setError(e.response?.data?.error ?? 'Failed to load OIDC configuration');
  }

  const saveMutation = useMutation({
    mutationFn: (input: OIDCGroupMappingInput) => api.updateOIDCGroupMapping(input),
    onSuccess: (updated) => {
      setGroupClaimName(updated.group_claim_name ?? '');
      setDefaultRole(updated.default_role ?? '');
      setMappings(updated.group_mappings ?? []);
      setSuccess('Group mapping settings saved successfully.');
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.oidcConfig._def });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'Failed to save group mapping settings');
    },
  });

  const saving = saveMutation.isPending;

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    saveMutation.mutate({
      group_claim_name: groupClaimName,
      group_mappings: mappings,
      default_role: defaultRole,
    });
  };

  // Dialog helpers
  const loadOrgs = async () => {
    setOrgLoading(true);
    try {
      const orgs: Organization[] = await api.listOrganizations(1, 200);
      setOrgOptions(orgs.map(o => o.name));
    } catch {
      setOrgOptions([]);
    } finally {
      setOrgLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingIndex(null);
    setMappingForm(emptyMapping);
    setOrgInputValue('');
    setDialogOpen(true);
    loadOrgs();
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setMappingForm({ ...mappings[index] });
    setOrgInputValue(mappings[index].organization);
    setDialogOpen(true);
    loadOrgs();
  };

  const handleDialogSave = () => {
    if (!mappingForm.group || !mappingForm.organization || !mappingForm.role) return;
    if (editingIndex !== null) {
      setMappings(prev => prev.map((m, i) => (i === editingIndex ? mappingForm : m)));
    } else {
      setMappings(prev => [...prev, mappingForm]);
    }
    setDialogOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex !== null) {
      setMappings(prev => prev.filter((_, i) => i !== deleteIndex));
    }
    setDeleteIndex(null);
  };

  return (
    <Container maxWidth="lg" aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
              <ManageAccountsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4">OIDC Groups</Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary">
              Configure group claim mapping from your identity provider to registry organizations and roles.
              Changes take effect on the next login without requiring a server restart.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

          {/* Active config summary */}
          {config && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Active OIDC Provider</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary">Provider</Typography>
                  <Typography variant="body2">{config.provider_type}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Issuer</Typography>
                  <Typography variant="body2">{config.issuer_url}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Client ID</Typography>
                  <Typography variant="body2">{config.client_id}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip
                      label={config.is_active ? 'Active' : 'Inactive'}
                      color={config.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>
              </Stack>
            </Paper>
          )}

          {/* Group mapping settings */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Group Claim Mapping</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Map IdP group claims to registry organizations and roles. The group claim name must match
              the claim key in your OIDC ID token (e.g. <code>groups</code>).
            </Typography>

            <Stack spacing={3}>
              {/* Group claim name + default role */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Group Claim Name"
                  value={groupClaimName}
                  onChange={e => setGroupClaimName(e.target.value)}
                  placeholder="groups"
                  helperText="The ID token claim that contains the user's group list"
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Default Role</InputLabel>
                  <Select
                    value={defaultRole}
                    label="Default Role"
                    onChange={(e: SelectChangeEvent) => setDefaultRole(e.target.value)}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {AVAILABLE_ROLES.map(r => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {/* Mappings table */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">Group Mappings</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={openAddDialog}
                  >
                    Add Mapping
                  </Button>
                </Stack>

                {mappings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No group mappings configured. Click "Add Mapping" to create one.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>IdP Group</TableCell>
                          <TableCell>Organization</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mappings.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Chip label={m.group} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{m.organization}</TableCell>
                            <TableCell>
                              <Chip label={m.role} size="small" color="primary" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" aria-label="Edit claim mapping" onClick={() => openEditDialog(i)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" aria-label="Delete claim mapping" color="error" onClick={() => setDeleteIndex(i)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              {/* Save button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Box>
            </Stack>
          </Paper>

          {/* Add / Edit mapping dialog */}
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editingIndex !== null ? 'Edit Group Mapping' : 'Add Group Mapping'}</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="IdP Group"
                  value={mappingForm.group}
                  onChange={e => setMappingForm(f => ({ ...f, group: e.target.value }))}
                  placeholder="e.g. platform-admins"
                  helperText="The exact group name as it appears in the ID token claim"
                  fullWidth
                  autoFocus
                />
                <Autocomplete
                  freeSolo
                  options={orgOptions}
                  loading={orgLoading}
                  value={mappingForm.organization}
                  inputValue={orgInputValue}
                  onInputChange={(_, v) => {
                    setOrgInputValue(v);
                    setMappingForm(f => ({ ...f, organization: v }));
                  }}
                  onChange={(_, v) => {
                    const val = (v as string) ?? '';
                    setOrgInputValue(val);
                    setMappingForm(f => ({ ...f, organization: val }));
                  }}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Organization"
                      placeholder="e.g. my-org"
                      helperText="Registry organization name the user will be added to"
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {orgLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={mappingForm.role}
                    label="Role"
                    onChange={(e: SelectChangeEvent) =>
                      setMappingForm(f => ({ ...f, role: e.target.value }))
                    }
                  >
                    {AVAILABLE_ROLES.map(r => (
                      <MenuItem key={r} value={r}>{r}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleDialogSave}
                variant="contained"
                disabled={!mappingForm.group || !mappingForm.organization || !mappingForm.role}
              >
                {editingIndex !== null ? 'Update' : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete confirm dialog */}
          <Dialog open={deleteIndex !== null} onClose={() => setDeleteIndex(null)}>
            <DialogTitle>Remove Group Mapping</DialogTitle>
            <DialogContent>
              <Typography>
                Remove the mapping for group{' '}
                <strong>{deleteIndex !== null ? mappings[deleteIndex]?.group : ''}</strong>?
                This will not affect existing memberships — it only stops new logins from
                automatically setting this membership.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteIndex(null)}>Cancel</Button>
              <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                Remove
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
};

export default OIDCSettingsPage;
