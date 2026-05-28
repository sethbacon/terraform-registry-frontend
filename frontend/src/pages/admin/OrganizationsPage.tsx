import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Chip,
  Tooltip,
} from '@mui/material'

import { REGISTRY_SEGMENT_RE } from '../../utils/registrySegment'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import PeopleIcon from '@mui/icons-material/People'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import api from '../../services/api'
import { Organization, OrganizationMemberWithUser, User } from '../../types'
import { RoleTemplate } from '../../types/rbac'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'

const OrganizationsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  const canManage =
    allowedScopes.includes('admin') || allowedScopes.includes('organizations:manage')
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)

  // Members state
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRoleTemplateId, setSelectedRoleTemplateId] = useState<string>('')
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([])

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    idp_type: '' as string,
    idp_name: '' as string,
  })

  const {
    data: organizations = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<Organization[]>({
    queryKey: queryKeys.organizations.list(),
    queryFn: async () => {
      const orgs = await api.listOrganizations()
      return orgs || []
    },
  })

  if (queryError && !error && !import.meta.env.DEV) {
    setError(t('admin.organizations.errLoad'))
  }

  const handleOpenDialog = (org?: Organization) => {
    if (org) {
      setEditingOrg(org)
      setFormData({
        name: org.name,
        display_name: org.display_name || '',
        idp_type: org.idp_type || '',
        idp_name: org.idp_name || '',
      })
    } else {
      setEditingOrg(null)
      setFormData({
        name: '',
        display_name: '',
        idp_type: '',
        idp_name: '',
      })
    }
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setEditingOrg(null)
    setError(null)
  }

  const saveOrgMutation = useMutation({
    mutationFn: async () => {
      if (editingOrg) {
        await api.updateOrganization(editingOrg.id, {
          ...(formData.name !== editingOrg.name ? { name: formData.name } : {}),
          display_name: formData.display_name,
          idp_type: formData.idp_type || null,
          idp_name: formData.idp_name || null,
        })
      } else {
        await api.createOrganization({ name: formData.name, display_name: formData.display_name })
      }
    },
    onSuccess: () => {
      handleCloseDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.organizations.errSave')))
    },
  })

  const deleteOrgMutation = useMutation({
    mutationFn: (id: string) => api.deleteOrganization(id),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setOrgToDelete(null)
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.organizations.errDelete')))
    },
  })

  const handleSaveOrganization = () => {
    setError(null)
    if (!REGISTRY_SEGMENT_RE.test(formData.name)) {
      setError(t('admin.organizations.errName'))
      return
    }
    saveOrgMutation.mutate()
  }

  const handleDeleteClick = (org: Organization) => {
    setOrgToDelete(org)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!orgToDelete) return
    setError(null)
    deleteOrgMutation.mutate(orgToDelete.id)
  }

  const handleViewMembers = async (org: Organization) => {
    setSelectedOrg(org)
    setMembersDialogOpen(true)
    await Promise.all([loadMembers(org.id), loadRoleTemplates()])
  }

  const loadMembers = async (orgId: string) => {
    try {
      setMembersLoading(true)
      const membersData = await api.listOrganizationMembers(orgId)
      setMembers(membersData)
    } catch (err) {
      console.error('Failed to load members:', err)
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await api.listUsers(1, 100)
      setAllUsers(response.users || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setAllUsers([])
    }
  }

  const loadRoleTemplates = async () => {
    try {
      const templates = await api.listRoleTemplates()
      setRoleTemplates(templates || [])
    } catch (err) {
      console.error('Failed to load role templates:', err)
      setRoleTemplates([])
    }
  }

  const handleOpenAddMember = async () => {
    await Promise.all([loadAllUsers(), loadRoleTemplates()])
    setSelectedUser(null)
    setSelectedRoleTemplateId('')
    setAddMemberDialogOpen(true)
  }

  const handleAddMember = async () => {
    if (!selectedOrg || !selectedUser) return

    try {
      setError(null)
      await api.addOrganizationMember(selectedOrg.id, {
        user_id: selectedUser.id,
        role_template_id: selectedRoleTemplateId || undefined,
      })
      setAddMemberDialogOpen(false)
      await loadMembers(selectedOrg.id)
    } catch (err: unknown) {
      console.error('Failed to add member:', err)
      setError(getErrorMessage(err, t('admin.organizations.errAddMember')))
    }
  }

  const handleUpdateMemberRole = async (userId: string, newRoleTemplateId: string | null) => {
    if (!selectedOrg) return

    try {
      setError(null)
      await api.updateOrganizationMember(selectedOrg.id, userId, {
        role_template_id: newRoleTemplateId || undefined,
      })
      await loadMembers(selectedOrg.id)
    } catch (err: unknown) {
      console.error('Failed to update member role:', err)
      setError(getErrorMessage(err, t('admin.organizations.errUpdateRole')))
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrg) return

    try {
      setError(null)
      await api.removeOrganizationMember(selectedOrg.id, userId)
      await loadMembers(selectedOrg.id)
    } catch (err: unknown) {
      console.error('Failed to remove member:', err)
      setError(getErrorMessage(err, t('admin.organizations.errRemoveMember')))
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('admin.organizations.pageTitle')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('admin.organizations.pageSubtitle')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          {t('admin.organizations.addOrganization')}
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
            <Typography
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.organizations.emptyState')}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ mt: 2 }}
            >
              {t('admin.organizations.createFirst')}
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.organizations.thName')}</TableCell>
                  <TableCell>{t('admin.organizations.thDisplayName')}</TableCell>
                  <TableCell>{t('admin.organizations.thIdentityProvider')}</TableCell>
                  <TableCell>{t('admin.organizations.thMembers')}</TableCell>
                  <TableCell>{t('admin.organizations.thCreated')}</TableCell>
                  <TableCell align="right">{t('admin.organizations.thActions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Typography
                        sx={{
                          fontWeight: 'medium',
                        }}
                      >
                        {org.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{org.display_name || '-'}</TableCell>
                    <TableCell>
                      {org.idp_type ? (
                        <Chip
                          label={`${org.idp_type.toUpperCase()}${org.idp_name ? `: ${org.idp_name}` : ''}`}
                          size="small"
                          color="info"
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          {t('admin.organizations.idpAny')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<PeopleIcon />}
                        onClick={() => handleViewMembers(org)}
                      >
                        {t('admin.organizations.viewMembers')}
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('admin.organizations.tooltipEditOrg')}>
                        <IconButton
                          size="small"
                          aria-label={t('admin.organizations.ariaEditOrg')}
                          onClick={() => handleOpenDialog(org)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('admin.organizations.tooltipDeleteOrg')}>
                        <IconButton
                          size="small"
                          aria-label={t('admin.organizations.ariaDeleteOrg')}
                          onClick={() => handleDeleteClick(org)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
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
        <DialogTitle>
          {editingOrg
            ? t('admin.organizations.dialogTitleEdit')
            : t('admin.organizations.dialogTitleAdd')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label={t('admin.organizations.labelName')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              error={!!formData.name && !REGISTRY_SEGMENT_RE.test(formData.name)}
              helperText={
                formData.name && !REGISTRY_SEGMENT_RE.test(formData.name)
                  ? t('admin.organizations.helpNameInvalid')
                  : t('admin.organizations.helpName')
              }
            />
            {editingOrg &&
              formData.name !== editingOrg.name &&
              REGISTRY_SEGMENT_RE.test(formData.name) && (
                <Alert severity="warning">
                  {t('admin.organizations.renameWarnPart1')}
                  <strong>{editingOrg.name}</strong>
                  {t('admin.organizations.renameWarnPart2')}
                  <strong>{formData.name}</strong>
                  {t('admin.organizations.renameWarnPart3')}
                </Alert>
              )}
            <TextField
              label={t('admin.organizations.labelDisplayName')}
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              required
              multiline
              rows={3}
              fullWidth
              helperText={t('admin.organizations.helpDisplayName')}
            />
            {editingOrg && (
              <>
                <FormControl fullWidth>
                  <InputLabel>{t('admin.organizations.labelIdpType')}</InputLabel>
                  <Select
                    value={formData.idp_type}
                    label={t('admin.organizations.labelIdpType')}
                    onChange={(e: SelectChangeEvent) =>
                      setFormData({ ...formData, idp_type: e.target.value, idp_name: '' })
                    }
                  >
                    <MenuItem value="">
                      <em>{t('admin.organizations.menuIdpAny')}</em>
                    </MenuItem>
                    <MenuItem value="oidc">OIDC</MenuItem>
                    <MenuItem value="saml">SAML</MenuItem>
                    <MenuItem value="ldap">LDAP</MenuItem>
                  </Select>
                </FormControl>
                {formData.idp_type && (
                  <TextField
                    label={t('admin.organizations.labelIdpName')}
                    value={formData.idp_name}
                    onChange={(e) => setFormData({ ...formData, idp_name: e.target.value })}
                    fullWidth
                    helperText={t('admin.organizations.helpIdpName')}
                  />
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('admin.organizations.cancel')}</Button>
          <Button
            onClick={handleSaveOrganization}
            variant="contained"
            disabled={!formData.name.trim() || !formData.display_name.trim()}
          >
            {editingOrg ? t('admin.organizations.save') : t('admin.organizations.create')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('admin.organizations.dialogTitleDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('admin.organizations.confirmDelete', { name: orgToDelete?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('admin.organizations.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('admin.organizations.delete')}
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
            <span>{t('admin.organizations.membersTitle', { name: selectedOrg?.name })}</span>
            {canManage && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={handleOpenAddMember}
              >
                {t('admin.organizations.addMember')}
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 2,
            }}
          >
            {canManage
              ? t('admin.organizations.membersManageDesc')
              : t('admin.organizations.membersViewDesc')}
          </Typography>
          {membersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : members.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.organizations.noMembers')}
              </Typography>
              {canManage && (
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  onClick={handleOpenAddMember}
                  sx={{ mt: 2 }}
                >
                  {t('admin.organizations.addFirstMember')}
                </Button>
              )}
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.organizations.thName')}</TableCell>
                    <TableCell>{t('admin.organizations.thEmail')}</TableCell>
                    <TableCell>{t('admin.organizations.thRole')}</TableCell>
                    {canManage && (
                      <TableCell align="right">{t('admin.organizations.thActions')}</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.user_name || t('admin.organizations.unknown')}</TableCell>
                      <TableCell>{member.user_email || '-'}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                              value={member.role_template_id || ''}
                              displayEmpty
                              onChange={(e: SelectChangeEvent) =>
                                handleUpdateMemberRole(member.user_id, e.target.value || null)
                              }
                            >
                              <MenuItem value="">
                                <em>{t('admin.organizations.noRole')}</em>
                              </MenuItem>
                              {roleTemplates.map((template) => (
                                <MenuItem key={template.id} value={template.id}>
                                  {template.display_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="body2">
                            {roleTemplates.find((rt) => rt.id === member.role_template_id)
                              ?.display_name || t('admin.organizations.noRole')}
                          </Typography>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell align="right">
                          <Tooltip title={t('admin.organizations.tooltipRemoveMember')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.organizations.ariaRemoveMember')}
                              onClick={() => handleRemoveMember(member.user_id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersDialogOpen(false)}>
            {t('admin.organizations.close')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Add Member Dialog */}
      <Dialog
        open={addMemberDialogOpen}
        onClose={() => setAddMemberDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('admin.organizations.addMemberTitle', { name: selectedOrg?.name })}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Autocomplete
              options={allUsers.filter((u) => !members.some((m) => m.user_id === u.id))}
              getOptionLabel={(option) => `${option.name} (${option.email})`}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('admin.organizations.labelSelectUser')}
                  placeholder={t('admin.organizations.placeholderSearchUsers')}
                />
              )}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('admin.organizations.labelRoleTemplate')}</InputLabel>
              <Select
                value={selectedRoleTemplateId}
                label={t('admin.organizations.labelRoleTemplate')}
                onChange={(e: SelectChangeEvent) => setSelectedRoleTemplateId(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t('admin.organizations.menuNoRoleViewOnly')}</em>
                </MenuItem>
                {roleTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.display_name}
                    {template.description && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          ml: 1,
                        }}
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
          <Button onClick={() => setAddMemberDialogOpen(false)}>
            {t('admin.organizations.cancel')}
          </Button>
          <Button onClick={handleAddMember} variant="contained" disabled={!selectedUser}>
            {t('admin.organizations.addMember')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default OrganizationsPage
