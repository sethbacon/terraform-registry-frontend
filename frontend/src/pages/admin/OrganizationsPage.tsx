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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  SelectChangeEvent,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import api from '../../services/api';
import { Organization, OrganizationMemberWithUser, User } from '../../types';
import { RoleTemplate } from '../../types/rbac';

const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  // Members state
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleTemplateId, setSelectedRoleTemplateId] = useState<string>('');
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const orgs = await api.listOrganizations();
      setOrganizations(orgs || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      // In dev mode, just show empty list instead of error
      setOrganizations([]);
      if (!import.meta.env.DEV) {
        setError('Failed to load organizations. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (org?: Organization) => {
    if (org) {
      setEditingOrg(org);
      setFormData({
        name: org.name,
        display_name: org.display_name || '',
      });
    } else {
      setEditingOrg(null);
      setFormData({
        name: '',
        display_name: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingOrg(null);
    setError(null);
  };

  const handleSaveOrganization = async () => {
    try {
      setError(null);
      if (editingOrg) {
        await api.updateOrganization(editingOrg.id, {
          display_name: formData.display_name,
        });
      } else {
        await api.createOrganization({
          name: formData.name,
          display_name: formData.display_name,
        });
      }
      handleCloseDialog();
      loadOrganizations();
    } catch (err: any) {
      console.error('Failed to save organization:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save organization. Please try again.';
      setError(errorMessage);
    }
  };

  const handleDeleteClick = (org: Organization) => {
    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;

    try {
      setError(null);
      await api.deleteOrganization(orgToDelete.id);
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
      loadOrganizations();
    } catch (err: any) {
      console.error('Failed to delete organization:', err);
      setError(err.response?.data?.error || 'Failed to delete organization. Please try again.');
    }
  };

  const handleViewMembers = async (org: Organization) => {
    setSelectedOrg(org);
    setMembersDialogOpen(true);
    await Promise.all([loadMembers(org.id), loadRoleTemplates()]);
  };

  const loadMembers = async (orgId: string) => {
    try {
      setMembersLoading(true);
      const membersData = await api.listOrganizationMembers(orgId);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await api.listUsers(1, 100);
      setAllUsers(response.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setAllUsers([]);
    }
  };

  const loadRoleTemplates = async () => {
    try {
      const templates = await api.listRoleTemplates();
      setRoleTemplates(templates || []);
    } catch (err) {
      console.error('Failed to load role templates:', err);
      setRoleTemplates([]);
    }
  };

  const handleOpenAddMember = async () => {
    await Promise.all([loadAllUsers(), loadRoleTemplates()]);
    setSelectedUser(null);
    setSelectedRoleTemplateId('');
    setAddMemberDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedOrg || !selectedUser) return;

    try {
      setError(null);
      await api.addOrganizationMember(selectedOrg.id, {
        user_id: selectedUser.id,
        role_template_id: selectedRoleTemplateId || undefined,
      });
      setAddMemberDialogOpen(false);
      await loadMembers(selectedOrg.id);
    } catch (err: any) {
      console.error('Failed to add member:', err);
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRoleTemplateId: string | null) => {
    if (!selectedOrg) return;

    try {
      setError(null);
      await api.updateOrganizationMember(selectedOrg.id, userId, {
        role_template_id: newRoleTemplateId || undefined
      });
      await loadMembers(selectedOrg.id);
    } catch (err: any) {
      console.error('Failed to update member role:', err);
      setError(err.response?.data?.error || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrg) return;

    try {
      setError(null);
      await api.removeOrganizationMember(selectedOrg.id, userId);
      await loadMembers(selectedOrg.id);
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Organizations
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage organizations and their members
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Organization
        </Button>
      </Box>

      {error && !import.meta.env.DEV && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Organizations Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : organizations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">No organizations found</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ mt: 2 }}
            >
              Create First Organization
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Typography fontWeight="medium">{org.name}</Typography>
                    </TableCell>
                    <TableCell>{org.display_name || '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<PeopleIcon />}
                        onClick={() => handleViewMembers(org)}
                      >
                        View Members
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(org)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(org)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add/Edit Organization Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingOrg ? 'Edit Organization' : 'Add Organization'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              helperText="Organization name (e.g., myorg)"
            />
            <TextField
              label="Display Name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              required
              multiline
              rows={3}
              fullWidth
              helperText="Display name for the organization"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveOrganization} 
            variant="contained"
            disabled={!formData.name.trim() || !formData.display_name.trim()}
          >
            {editingOrg ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Organization</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete organization "{orgToDelete?.name}"? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog */}
      <Dialog
        open={membersDialogOpen}
        onClose={() => setMembersDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Organization Members - {selectedOrg?.name}</span>
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAddIcon />}
              onClick={handleOpenAddMember}
            >
              Add Member
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage members and their roles in this organization
          </Typography>
          {membersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : members.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No members in this organization yet
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={handleOpenAddMember}
                sx={{ mt: 2 }}
              >
                Add First Member
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.user_name || 'Unknown'}</TableCell>
                      <TableCell>{member.user_email || '-'}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={member.role_template_id || ''}
                            displayEmpty
                            onChange={(e: SelectChangeEvent) =>
                              handleUpdateMemberRole(member.user_id, e.target.value || null)
                            }
                          >
                            <MenuItem value="">
                              <em>No role</em>
                            </MenuItem>
                            {roleTemplates.map((template) => (
                              <MenuItem key={template.id} value={template.id}>
                                {template.display_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveMember(member.user_id)}
                          color="error"
                          title="Remove member"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberDialogOpen}
        onClose={() => setAddMemberDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Member to {selectedOrg?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Autocomplete
              options={allUsers.filter(
                (u) => !members.some((m) => m.user_id === u.id)
              )}
              getOptionLabel={(option) => `${option.name} (${option.email})`}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select User" placeholder="Search users..." />
              )}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role Template</InputLabel>
              <Select
                value={selectedRoleTemplateId}
                label="Role Template"
                onChange={(e: SelectChangeEvent) => setSelectedRoleTemplateId(e.target.value)}
              >
                <MenuItem value="">
                  <em>No role (view only)</em>
                </MenuItem>
                {roleTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.display_name}
                    {template.description && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        - {template.description}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={!selectedUser}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrganizationsPage;
