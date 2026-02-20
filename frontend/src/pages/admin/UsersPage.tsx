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
  TablePagination,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Tooltip,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import api from '../../services/api';
import { User, UserMembership, Organization } from '../../types';
import { RoleTemplate } from '../../types/rbac';

interface UserWithMemberships extends User {
  memberships?: UserMembership[];
  membershipsLoading?: boolean;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserWithMemberships[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithMemberships | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Organizations for selection
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Role templates for selection
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [roleTemplatesLoading, setRoleTemplatesLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    organizationId: '',
    roleTemplateId: '', // Role template for org membership
  });

  // User memberships being edited
  const [editMemberships, setEditMemberships] = useState<UserMembership[]>([]);

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, searchQuery]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (searchQuery) {
        response = await api.searchUsers(searchQuery, page + 1, rowsPerPage);
      } else {
        response = await api.listUsers(page + 1, rowsPerPage);
      }

      const usersData = response.users || [];
      setUsers(usersData.map((u: User) => ({ ...u, memberships: undefined, membershipsLoading: true })));
      setTotalUsers(response.pagination?.total || 0);

      // Load memberships for each user
      for (const user of usersData) {
        loadUserMemberships(user.id);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserMemberships = async (userId: string) => {
    try {
      const memberships = await api.getUserMemberships(userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, memberships, membershipsLoading: false }
            : u
        )
      );
    } catch (err) {
      console.error(`Failed to load memberships for user ${userId}:`, err);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, memberships: [], membershipsLoading: false }
            : u
        )
      );
    }
  };

  const loadOrganizations = async () => {
    try {
      setOrgsLoading(true);
      const orgs = await api.listOrganizations();
      setOrganizations(orgs || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setOrganizations([]);
    } finally {
      setOrgsLoading(false);
    }
  };

  const loadRoleTemplates = async () => {
    try {
      setRoleTemplatesLoading(true);
      const templates = await api.listRoleTemplates();
      setRoleTemplates(templates || []);
    } catch (err) {
      console.error('Failed to load role templates:', err);
      setRoleTemplates([]);
    } finally {
      setRoleTemplatesLoading(false);
    }
  };

  const handleOpenDialog = async (user?: UserWithMemberships) => {
    await Promise.all([loadOrganizations(), loadRoleTemplates()]);

    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        name: user.name || '',
        organizationId: '',
        roleTemplateId: '',
      });
      setEditMemberships(user.memberships || []);
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        name: '',
        organizationId: '',
        roleTemplateId: '',
      });
      setEditMemberships([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setError(null);
    setEditMemberships([]);
  };

  const handleSaveUser = async () => {
    try {
      setError(null);
      let userId = editingUser?.id;

      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: formData.name,
        });
      } else {
        const newUser = await api.createUser({ email: formData.email, name: formData.name });
        userId = newUser.id;
      }

      // Add to organization if selected (for new users)
      if (!editingUser && formData.organizationId && userId) {
        try {
          await api.addOrganizationMember(formData.organizationId, {
            user_id: userId,
            role_template_id: formData.roleTemplateId || undefined,
          });
        } catch (err: any) {
          console.error('Failed to add user to organization:', err);
          // Don't fail the whole operation, user was created
        }
      }

      handleCloseDialog();
      loadUsers();
    } catch (err: any) {
      console.error('Failed to save user:', err);
      setError(err.response?.data?.error || 'Failed to save user. Please try again.');
    }
  };

  const handleAddMembership = async () => {
    if (!editingUser || !formData.organizationId) return;

    try {
      setError(null);
      await api.addOrganizationMember(formData.organizationId, {
        user_id: editingUser.id,
        role_template_id: formData.roleTemplateId || undefined,
      });

      // Refresh memberships
      const memberships = await api.getUserMemberships(editingUser.id);
      setEditMemberships(memberships);

      // Reset selection
      setFormData(prev => ({ ...prev, organizationId: '', roleTemplateId: '' }));
    } catch (err: any) {
      console.error('Failed to add membership:', err);
      setError(err.response?.data?.error || 'Failed to add organization membership');
    }
  };

  const handleUpdateMembershipRole = async (orgId: string, newRoleTemplateId: string | null) => {
    if (!editingUser) return;

    try {
      setError(null);
      await api.updateOrganizationMember(orgId, editingUser.id, {
        role_template_id: newRoleTemplateId || undefined
      });

      // Refresh memberships to get updated role template info
      const memberships = await api.getUserMemberships(editingUser.id);
      setEditMemberships(memberships);
    } catch (err: any) {
      console.error('Failed to update membership role:', err);
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleRemoveMembership = async (orgId: string) => {
    if (!editingUser) return;

    try {
      setError(null);
      await api.removeOrganizationMember(orgId, editingUser.id);

      // Update local state
      setEditMemberships(prev => prev.filter(m => m.organization_id !== orgId));
    } catch (err: any) {
      console.error('Failed to remove membership:', err);
      setError(err.response?.data?.error || 'Failed to remove from organization');
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setError(null);
      await api.deleteUser(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setError(err.response?.data?.error || 'Failed to delete user. Please try again.');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getRoleTemplateColor = (templateName?: string): 'error' | 'warning' | 'primary' | 'info' | 'success' | 'default' => {
    switch (templateName) {
      case 'admin':
        return 'error';
      case 'devops':
      case 'user_manager':
        return 'warning';
      case 'publisher':
        return 'primary';
      case 'viewer':
        return 'info';
      case 'auditor':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get organizations not already assigned to the user
  const availableOrganizations = organizations.filter(
    org => !editMemberships.some(m => m.organization_id === org.id)
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user accounts and permissions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search users..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setPage(0);
        }}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
        }}
      />

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Organizations & Roles</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No users found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.membershipsLoading ? (
                        <CircularProgress size={16} />
                      ) : user.memberships && user.memberships.length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {user.memberships.map((m) => (
                            <Tooltip
                              key={m.organization_id}
                              title={m.role_template_display_name
                                ? `${m.organization_name}: ${m.role_template_display_name}`
                                : `${m.organization_name}: No role assigned`
                              }
                            >
                              <Chip
                                icon={<BusinessIcon />}
                                label={`${m.organization_name} (${m.role_template_display_name || 'No role'})`}
                                size="small"
                                color={getRoleTemplateColor(m.role_template_name || undefined)}
                                variant="outlined"
                                sx={{ mb: 0.5 }}
                              />
                            </Tooltip>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No organizations
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(user)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(user)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
              disabled={!!editingUser}
              helperText="User's email address. Used as the login identifier and cannot be changed after creation."
            />
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              helperText="Full display name shown throughout the interface"
            />

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" color="text.secondary">
              Organization Membership
            </Typography>

            {/* Show existing memberships when editing */}
            {editingUser && editMemberships.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Current Organizations:
                </Typography>
                <Stack spacing={1}>
                  {editMemberships.map((m) => (
                    <Box
                      key={m.organization_id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                        borderRadius: 1,
                      }}
                    >
                      <BusinessIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {m.organization_name}
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          value={m.role_template_id || ''}
                          displayEmpty
                          onChange={(e: SelectChangeEvent) =>
                            handleUpdateMembershipRole(m.organization_id, e.target.value || null)
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
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveMembership(m.organization_id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Add to organization */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {editingUser ? 'Add to Organization' : 'Organization (Optional)'}
                </InputLabel>
                <Select
                  value={formData.organizationId}
                  label={editingUser ? 'Add to Organization' : 'Organization (Optional)'}
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({ ...formData, organizationId: e.target.value })
                  }
                  disabled={orgsLoading}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {availableOrganizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.display_name || org.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Assign this user to an organization to control which resources they can access.</FormHelperText>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Role Template</InputLabel>
                <Select
                  value={formData.roleTemplateId}
                  label="Role Template"
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({ ...formData, roleTemplateId: e.target.value })
                  }
                  disabled={!formData.organizationId || roleTemplatesLoading}
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
                <FormHelperText>Defines the permissions granted within the selected organization. Manage templates under Admin → Roles.</FormHelperText>
              </FormControl>
              {editingUser && (
                <Button
                  variant="outlined"
                  onClick={handleAddMembership}
                  disabled={!formData.organizationId}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  Add
                </Button>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveUser} variant="contained">
            {editingUser ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{userToDelete?.name}"? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UsersPage;
