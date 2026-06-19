import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
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
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import BusinessIcon from '@mui/icons-material/Business'
import PersonIcon from '@mui/icons-material/Person'
import DownloadIcon from '@mui/icons-material/Download'
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip'
import EmptyState from '../../components/EmptyState'
import Page from '../../components/Page'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { User, UserMembership, Organization } from '../../types'
import { RoleTemplate } from '../../types/rbac'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'

interface UserWithMemberships extends User {
  memberships?: UserMembership[]
  membershipsLoading?: boolean
}

const UsersPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  const isAdmin = allowedScopes.includes('admin')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // GDPR action state
  const [exportingUserId, setExportingUserId] = useState<string | null>(null)
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false)
  const [userToErase, setUserToErase] = useState<User | null>(null)
  const [eraseConfirmText, setEraseConfirmText] = useState('')

  // Local memberships state (per-user enrichment)
  const [userMemberships, setUserMemberships] = useState<
    Record<string, { memberships?: UserMembership[]; loading: boolean }>
  >({})

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithMemberships | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  // Organizations for selection
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)

  // Role templates for selection
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([])
  const [roleTemplatesLoading, setRoleTemplatesLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    organizationId: '',
    roleTemplateId: '', // Role template for org membership
  })

  // User memberships being edited
  const [editMemberships, setEditMemberships] = useState<UserMembership[]>([])

  const {
    data: usersData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.users.list({
      page: page + 1,
      perPage: rowsPerPage,
      search: searchQuery || undefined,
    }),
    queryFn: async () => {
      if (searchQuery) {
        return api.searchUsers(searchQuery, page + 1, rowsPerPage)
      }
      return api.listUsers(page + 1, rowsPerPage)
    },
  })

  const rawUsers = usersData?.users || []
  const totalUsers = usersData?.pagination?.total || 0

  // Merge memberships into users
  const users: UserWithMemberships[] = rawUsers.map((u: User) => ({
    ...u,
    memberships: userMemberships[u.id]?.memberships,
    membershipsLoading: userMemberships[u.id]?.loading ?? true,
  }))

  if (queryError && !error) {
    setError(t('admin.users.errLoad'))
  }

  // Load memberships whenever rawUsers changes
  useEffect(() => {
    for (const user of rawUsers) {
      if (userMemberships[user.id] === undefined) {
        // If the list response already includes memberships inline, use them directly
        // to avoid N+1 individual GET /api/v1/users/{id}/memberships requests.
        if (user.memberships !== undefined) {
          setUserMemberships((prev) => ({
            ...prev,
            [user.id]: { memberships: user.memberships, loading: false },
          }))
        } else {
          setUserMemberships((prev) => ({ ...prev, [user.id]: { loading: true } }))
          api
            .getUserMemberships(user.id)
            .then((memberships) => {
              setUserMemberships((prev) => ({
                ...prev,
                [user.id]: { memberships, loading: false },
              }))
            })
            .catch(() => {
              setUserMemberships((prev) => ({
                ...prev,
                [user.id]: { memberships: [], loading: false },
              }))
            })
        }
      }
    }
  }, [rawUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrganizations = async () => {
    try {
      setOrgsLoading(true)
      const orgs = await api.listOrganizations()
      setOrganizations(orgs || [])
    } catch (err) {
      console.error('Failed to load organizations:', err)
      setOrganizations([])
    } finally {
      setOrgsLoading(false)
    }
  }

  const loadRoleTemplates = async () => {
    try {
      setRoleTemplatesLoading(true)
      const templates = await api.listRoleTemplates()
      setRoleTemplates(templates || [])
    } catch (err) {
      console.error('Failed to load role templates:', err)
      setRoleTemplates([])
    } finally {
      setRoleTemplatesLoading(false)
    }
  }

  const handleOpenDialog = async (user?: UserWithMemberships) => {
    await Promise.all([loadOrganizations(), loadRoleTemplates()])

    if (user) {
      setEditingUser(user)
      setFormData({
        email: user.email,
        name: user.name || '',
        organizationId: '',
        roleTemplateId: '',
      })
      setEditMemberships(user.memberships || [])
    } else {
      setEditingUser(null)
      setFormData({
        email: '',
        name: '',
        organizationId: '',
        roleTemplateId: '',
      })
      setEditMemberships([])
    }
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setEditingUser(null)
    setError(null)
    setEditMemberships([])
  }

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      let userId = editingUser?.id
      if (editingUser) {
        await api.updateUser(editingUser.id, { name: formData.name })
      } else {
        const newUser = await api.createUser({ email: formData.email, name: formData.name })
        userId = newUser.id
      }
      // Add to organization if selected (for new users)
      if (!editingUser && formData.organizationId && userId) {
        try {
          await api.addOrganizationMember(formData.organizationId, {
            user_id: userId,
            role_template_id: formData.roleTemplateId || undefined,
          })
        } catch (err) {
          console.error('Failed to add user to organization:', err)
        }
      }
    },
    onSuccess: () => {
      handleCloseDialog()
      setUserMemberships({})
      queryClient.invalidateQueries({ queryKey: queryKeys.users._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.users.errSave')))
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
      setError(null)
      setUserMemberships({})
      queryClient.invalidateQueries({ queryKey: queryKeys.users._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.users.errDelete')))
    },
  })

  // GDPR Article 17 — anonymize user PII while preserving the audit trail.
  const eraseUserMutation = useMutation({
    mutationFn: (id: string) => api.eraseUser(id),
    onSuccess: (data) => {
      setEraseDialogOpen(false)
      setUserToErase(null)
      setEraseConfirmText('')
      setError(null)
      setInfo(data.message || t('admin.users.userErased'))
      setUserMemberships({})
      queryClient.invalidateQueries({ queryKey: queryKeys.users._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.users.errErase')))
    },
  })

  // GDPR Articles 15/20 — full data export. Triggers a browser download
  // by creating a temporary blob URL; cleaned up after the click is dispatched.
  const handleExportClick = async (user: User) => {
    setError(null)
    setInfo(null)
    setExportingUserId(user.id)
    try {
      const { blob, filename } = await api.exportUserData(user.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setInfo(t('admin.users.exportedData', { email: user.email }))
    } catch (err) {
      setError(getErrorMessage(err, t('admin.users.errExport')))
    } finally {
      setExportingUserId(null)
    }
  }

  const handleEraseClick = (user: User) => {
    setUserToErase(user)
    setEraseConfirmText('')
    setEraseDialogOpen(true)
  }

  const handleEraseConfirm = () => {
    if (!userToErase) return
    if (eraseConfirmText !== userToErase.email) return
    eraseUserMutation.mutate(userToErase.id)
  }

  const handleSaveUser = () => {
    setError(null)
    saveUserMutation.mutate()
  }

  const handleAddMembership = async () => {
    if (!editingUser || !formData.organizationId) return

    try {
      setError(null)
      await api.addOrganizationMember(formData.organizationId, {
        user_id: editingUser.id,
        role_template_id: formData.roleTemplateId || undefined,
      })

      // Refresh memberships
      const memberships = await api.getUserMemberships(editingUser.id)
      setEditMemberships(memberships)

      // Reset selection
      setFormData((prev) => ({ ...prev, organizationId: '', roleTemplateId: '' }))
    } catch (err: unknown) {
      console.error('Failed to add membership:', err)
      setError(getErrorMessage(err, t('admin.users.errAddMembership')))
    }
  }

  const handleUpdateMembershipRole = async (orgId: string, newRoleTemplateId: string | null) => {
    if (!editingUser) return

    try {
      setError(null)
      await api.updateOrganizationMember(orgId, editingUser.id, {
        role_template_id: newRoleTemplateId || undefined,
      })

      // Refresh memberships to get updated role template info
      const memberships = await api.getUserMemberships(editingUser.id)
      setEditMemberships(memberships)
    } catch (err: unknown) {
      console.error('Failed to update membership role:', err)
      setError(getErrorMessage(err, t('admin.users.errUpdateRole')))
    }
  }

  const handleRemoveMembership = async (orgId: string) => {
    if (!editingUser) return

    try {
      setError(null)
      await api.removeOrganizationMember(orgId, editingUser.id)

      // Update local state
      setEditMemberships((prev) => prev.filter((m) => m.organization_id !== orgId))
    } catch (err: unknown) {
      console.error('Failed to remove membership:', err)
      setError(getErrorMessage(err, t('admin.users.errRemoveMembership')))
    }
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!userToDelete) return
    setError(null)
    deleteUserMutation.mutate(userToDelete.id)
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const getRoleTemplateColor = (
    templateName?: string,
  ): 'error' | 'warning' | 'primary' | 'info' | 'success' | 'default' => {
    switch (templateName) {
      case 'admin':
        return 'error'
      case 'devops':
      case 'user_manager':
        return 'warning'
      case 'publisher':
        return 'primary'
      case 'viewer':
        return 'info'
      case 'auditor':
        return 'success'
      default:
        return 'default'
    }
  }

  // Get organizations not already assigned to the user
  const availableOrganizations = organizations.filter(
    (org) => !editMemberships.some((m) => m.organization_id === org.id),
  )

  return (
    <Page maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('admin.users.pageTitle')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('admin.users.pageSubtitle')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          {t('admin.users.addUser')}
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder={t('admin.users.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setPage(0)
        }}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          },
        }}
      />
      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.users.thName')}</TableCell>
                <TableCell>{t('admin.users.thEmail')}</TableCell>
                <TableCell>{t('admin.users.thOrgRoles')}</TableCell>
                <TableCell>{t('admin.users.thCreated')}</TableCell>
                <TableCell align="right">{t('admin.users.thActions')}</TableCell>
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
                  <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                    <EmptyState
                      title={t('admin.users.emptyTitle')}
                      description={t('admin.users.emptyDescription')}
                      icon={<PersonIcon />}
                      data-testid="users-empty-state"
                    />
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
                        <Stack
                          direction="row"
                          spacing={0.5}
                          useFlexGap
                          sx={{
                            flexWrap: 'wrap',
                          }}
                        >
                          {user.memberships.map((m) => (
                            <Tooltip
                              key={m.organization_id}
                              title={
                                m.role_template_display_name
                                  ? t('admin.users.tooltipMembership', {
                                      org: m.organization_name,
                                      role: m.role_template_display_name,
                                    })
                                  : t('admin.users.tooltipMembershipNoRole', {
                                      org: m.organization_name,
                                    })
                              }
                            >
                              <Chip
                                icon={<BusinessIcon />}
                                label={t('admin.users.chipMembership', {
                                  org: m.organization_name,
                                  role: m.role_template_display_name || t('admin.users.noRole'),
                                })}
                                size="small"
                                color={getRoleTemplateColor(m.role_template_name || undefined)}
                                variant="outlined"
                                sx={{ mb: 0.5 }}
                              />
                            </Tooltip>
                          ))}
                        </Stack>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          {t('admin.users.noOrganizations')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('admin.users.tooltipEdit')}>
                        <IconButton
                          size="small"
                          aria-label={t('admin.users.ariaEdit')}
                          onClick={() => handleOpenDialog(user)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {isAdmin && (
                        <>
                          <Tooltip title={t('admin.users.tooltipExport')}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={t('admin.users.ariaExport')}
                                onClick={() => handleExportClick(user)}
                                disabled={exportingUserId === user.id}
                              >
                                {exportingUserId === user.id ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <DownloadIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t('admin.users.tooltipErase')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.users.ariaErase')}
                              onClick={() => handleEraseClick(user)}
                              color="warning"
                            >
                              <PrivacyTipIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title={t('admin.users.tooltipDelete')}>
                        <IconButton
                          size="small"
                          aria-label={t('admin.users.ariaDelete')}
                          onClick={() => handleDeleteClick(user)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
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
        <DialogTitle>
          {editingUser ? t('admin.users.dialogTitleEdit') : t('admin.users.dialogTitleAdd')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label={t('admin.users.labelEmail')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
              disabled={!!editingUser}
              helperText={t('admin.users.helpEmail')}
            />
            <TextField
              label={t('admin.users.labelName')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              helperText={t('admin.users.helpName')}
            />

            <Divider sx={{ my: 1 }} />

            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.users.sectionOrgMembership')}
            </Typography>

            {/* Show existing memberships when editing */}
            {editingUser && editMemberships.length > 0 && (
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mb: 1,
                  }}
                >
                  {t('admin.users.currentOrgs')}
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
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
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
                            <em>{t('admin.users.noRole')}</em>
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
                        aria-label={t('admin.users.ariaRemoveFromOrg')}
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
                  {editingUser ? t('admin.users.addToOrg') : t('admin.users.orgOptional')}
                </InputLabel>
                <Select
                  value={formData.organizationId}
                  label={editingUser ? t('admin.users.addToOrg') : t('admin.users.orgOptional')}
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({ ...formData, organizationId: e.target.value })
                  }
                  disabled={orgsLoading}
                >
                  <MenuItem value="">
                    <em>{t('admin.users.menuNone')}</em>
                  </MenuItem>
                  {availableOrganizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.display_name || org.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{t('admin.users.helpAssignOrg')}</FormHelperText>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('admin.users.labelRoleTemplate')}</InputLabel>
                <Select
                  value={formData.roleTemplateId}
                  label={t('admin.users.labelRoleTemplate')}
                  onChange={(e: SelectChangeEvent) =>
                    setFormData({ ...formData, roleTemplateId: e.target.value })
                  }
                  disabled={!formData.organizationId || roleTemplatesLoading}
                >
                  <MenuItem value="">
                    <em>{t('admin.users.noRole')}</em>
                  </MenuItem>
                  {roleTemplates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.display_name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{t('admin.users.helpRoleTemplate')}</FormHelperText>
              </FormControl>
              {editingUser && (
                <Button
                  variant="outlined"
                  onClick={handleAddMembership}
                  disabled={!formData.organizationId}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  {t('admin.users.add')}
                </Button>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('admin.users.cancel')}</Button>
          <Button onClick={handleSaveUser} variant="contained">
            {editingUser ? t('admin.users.save') : t('admin.users.create')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('admin.users.dialogTitleDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('admin.users.confirmDelete', { name: userToDelete?.name })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('admin.users.cancel')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('admin.users.delete')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* GDPR Erase Confirmation Dialog */}
      <Dialog
        open={eraseDialogOpen}
        onClose={() => {
          if (!eraseUserMutation.isPending) {
            setEraseDialogOpen(false)
            setEraseConfirmText('')
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('admin.users.eraseTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              {t('admin.users.eraseWarnPart1')}
              <strong>{userToErase?.email}</strong>
              {t('admin.users.eraseWarnPart2')}
              <strong>{t('admin.users.eraseWarnCannotUndo')}</strong>
            </Alert>
            <Typography variant="body2">
              {t('admin.users.eraseConfirmPart1')}
              <code>{userToErase?.email}</code>
              {t('admin.users.eraseConfirmPart2')}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={eraseConfirmText}
              onChange={(e) => setEraseConfirmText(e.target.value)}
              placeholder={userToErase?.email}
              disabled={eraseUserMutation.isPending}
              slotProps={{
                htmlInput: { 'aria-label': t('admin.users.ariaConfirmErasure') },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEraseDialogOpen(false)
              setEraseConfirmText('')
            }}
            disabled={eraseUserMutation.isPending}
          >
            {t('admin.users.cancel')}
          </Button>
          <Button
            onClick={handleEraseConfirm}
            color="error"
            variant="contained"
            disabled={
              eraseUserMutation.isPending || eraseConfirmText !== (userToErase?.email ?? '')
            }
          >
            {eraseUserMutation.isPending ? <CircularProgress size={20} /> : t('admin.users.erase')}
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  )
}

export default UsersPage
