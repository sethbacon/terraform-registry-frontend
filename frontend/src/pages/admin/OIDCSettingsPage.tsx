import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Autocomplete,
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
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import SaveIcon from '@mui/icons-material/Save'
import Page from '../../components/Page'
import api from '../../services/api'
import type {
  OIDCConfigResponse,
  OIDCGroupMapping,
  OIDCGroupMappingInput,
  Organization,
  IdentityGroupMappings,
} from '../../types'
import { queryKeys } from '../../services/queryKeys'

// Available roles that can be assigned to mapped groups — must match system role template names
const AVAILABLE_ROLES = ['viewer', 'publisher', 'devops', 'user_manager', 'auditor', 'admin']

const emptyMapping: OIDCGroupMapping = { group: '', organization: '', role: 'viewer' }

const OIDCSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Group claim name + default role (top-level form fields)
  const [groupClaimName, setGroupClaimName] = useState('')
  const [defaultRole, setDefaultRole] = useState('')

  // Group mapping rows
  const [mappings, setMappings] = useState<OIDCGroupMapping[]>([])

  // Dialog state for add/edit mapping
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [mappingForm, setMappingForm] = useState<OIDCGroupMapping>(emptyMapping)

  // Delete confirm dialog
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  // Org autocomplete state
  const [orgOptions, setOrgOptions] = useState<string[]>([])
  const [orgLoading, setOrgLoading] = useState(false)
  const [orgInputValue, setOrgInputValue] = useState('')

  const {
    data: config = null,
    isLoading: loading,
    error: queryError,
  } = useQuery<OIDCConfigResponse>({
    queryKey: queryKeys.oidcConfig.get(),
    queryFn: () => api.getAdminOIDCConfig(),
  })

  // Fetch SAML + LDAP group mappings (read-only)
  const { data: identityMappings } = useQuery<IdentityGroupMappings>({
    queryKey: ['identity', 'group-mappings'],
    queryFn: () => api.getIdentityGroupMappings(),
  })

  // Sync local form state when config loads
  useEffect(() => {
    if (config) {
      setGroupClaimName(config.group_claim_name ?? '')
      setDefaultRole(config.default_role ?? '')
      setMappings(config.group_mappings ?? [])
    }
  }, [config])

  if (queryError && !error) {
    const e = queryError as { response?: { data?: { error?: string } } }
    setError(e.response?.data?.error ?? t('admin.oidcSettings.errLoad'))
  }

  const saveMutation = useMutation({
    mutationFn: (input: OIDCGroupMappingInput) => api.updateOIDCGroupMapping(input),
    onSuccess: (updated) => {
      setGroupClaimName(updated.group_claim_name ?? '')
      setDefaultRole(updated.default_role ?? '')
      setMappings(updated.group_mappings ?? [])
      setSuccess(t('admin.oidcSettings.msgSaved'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.oidcConfig._def })
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error ?? t('admin.oidcSettings.errSave'))
    },
  })

  const saving = saveMutation.isPending

  const handleSave = () => {
    setError(null)
    setSuccess(null)
    saveMutation.mutate({
      group_claim_name: groupClaimName,
      group_mappings: mappings,
      default_role: defaultRole,
    })
  }

  // Dialog helpers
  const loadOrgs = async () => {
    setOrgLoading(true)
    try {
      const orgs: Organization[] = await api.listOrganizations(1, 200)
      setOrgOptions(orgs.map((o) => o.name))
    } catch {
      setOrgOptions([])
    } finally {
      setOrgLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingIndex(null)
    setMappingForm(emptyMapping)
    setOrgInputValue('')
    setDialogOpen(true)
    loadOrgs()
  }

  const openEditDialog = (index: number) => {
    setEditingIndex(index)
    setMappingForm({ ...mappings[index] })
    setOrgInputValue(mappings[index].organization)
    setDialogOpen(true)
    loadOrgs()
  }

  const handleDialogSave = () => {
    if (!mappingForm.group || !mappingForm.organization || !mappingForm.role) return
    if (editingIndex !== null) {
      setMappings((prev) => prev.map((m, i) => (i === editingIndex ? mappingForm : m)))
    } else {
      setMappings((prev) => [...prev, mappingForm])
    }
    setDialogOpen(false)
  }

  const handleDeleteConfirm = () => {
    if (deleteIndex !== null) {
      setMappings((prev) => prev.filter((_, i) => i !== deleteIndex))
    }
    setDeleteIndex(null)
  }

  return (
    <Page maxWidth="lg" aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
                mb: 1,
              }}
            >
              <ManageAccountsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4">{t('admin.oidcSettings.pageTitle')}</Typography>
            </Stack>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.oidcSettings.pageSubtitle')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Active config summary */}
          {config && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('admin.oidcSettings.activeProvider')}
              </Typography>
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                sx={{
                  flexWrap: 'wrap',
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.oidcSettings.labelProvider')}
                  </Typography>
                  <Typography variant="body2">{config.provider_type}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.oidcSettings.labelIssuer')}
                  </Typography>
                  <Typography variant="body2">{config.issuer_url}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.oidcSettings.labelClientId')}
                  </Typography>
                  <Typography variant="body2">{config.client_id}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.oidcSettings.labelStatus')}
                  </Typography>
                  <Box>
                    <Chip
                      label={
                        config.is_active
                          ? t('admin.oidcSettings.active')
                          : t('admin.oidcSettings.inactive')
                      }
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
            <Typography variant="h6" gutterBottom>
              {t('admin.oidcSettings.groupClaimMapping')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 3,
              }}
            >
              {t('admin.oidcSettings.groupClaimDescBefore')}
              <code>groups</code>
              {t('admin.oidcSettings.groupClaimDescAfter')}
            </Typography>

            <Stack spacing={3}>
              {/* Group claim name + default role */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('admin.oidcSettings.labelGroupClaimName')}
                  value={groupClaimName}
                  onChange={(e) => setGroupClaimName(e.target.value)}
                  placeholder="groups"
                  helperText={t('admin.oidcSettings.helpGroupClaimName')}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>{t('admin.oidcSettings.labelDefaultRole')}</InputLabel>
                  <Select
                    value={defaultRole}
                    label={t('admin.oidcSettings.labelDefaultRole')}
                    onChange={(e: SelectChangeEvent) => setDefaultRole(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>{t('admin.oidcSettings.menuNone')}</em>
                    </MenuItem>
                    {AVAILABLE_ROLES.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {/* Mappings table */}
              <Box>
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1">
                    {t('admin.oidcSettings.groupMappings')}
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={openAddDialog}
                  >
                    {t('admin.oidcSettings.addMapping')}
                  </Button>
                </Stack>

                {mappings.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      py: 2,
                    }}
                  >
                    {t('admin.oidcSettings.emptyMappings')}
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('admin.oidcSettings.thIdpGroup')}</TableCell>
                          <TableCell>{t('admin.oidcSettings.thOrganization')}</TableCell>
                          <TableCell>{t('admin.oidcSettings.thRole')}</TableCell>
                          <TableCell align="right">{t('admin.oidcSettings.thActions')}</TableCell>
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
                              <Chip
                                label={m.role}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title={t('admin.oidcSettings.tooltipEdit')}>
                                <IconButton
                                  size="small"
                                  aria-label={t('admin.oidcSettings.ariaEdit')}
                                  onClick={() => openEditDialog(i)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('admin.oidcSettings.tooltipDelete')}>
                                <IconButton
                                  size="small"
                                  aria-label={t('admin.oidcSettings.ariaDelete')}
                                  color="error"
                                  onClick={() => setDeleteIndex(i)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
                  {saving ? t('admin.oidcSettings.saving') : t('admin.oidcSettings.saveChanges')}
                </Button>
              </Box>
            </Stack>
          </Paper>

          {/* Add / Edit mapping dialog */}
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {editingIndex !== null
                ? t('admin.oidcSettings.dialogTitleEdit')
                : t('admin.oidcSettings.dialogTitleAdd')}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label={t('admin.oidcSettings.labelIdpGroup')}
                  value={mappingForm.group}
                  onChange={(e) => setMappingForm((f) => ({ ...f, group: e.target.value }))}
                  placeholder="e.g. platform-admins"
                  helperText={t('admin.oidcSettings.helpIdpGroup')}
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
                    setOrgInputValue(v)
                    setMappingForm((f) => ({ ...f, organization: v }))
                  }}
                  onChange={(_, v) => {
                    const val = (v as string) ?? ''
                    setOrgInputValue(val)
                    setMappingForm((f) => ({ ...f, organization: val }))
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('admin.oidcSettings.labelOrganization')}
                      placeholder="e.g. my-org"
                      helperText={t('admin.oidcSettings.helpOrganization')}
                      fullWidth
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.slotProps?.input,
                          endAdornment: (
                            <>
                              {orgLoading ? <CircularProgress color="inherit" size={16} /> : null}
                              {params.slotProps?.input?.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                />
                <FormControl fullWidth>
                  <InputLabel>{t('admin.oidcSettings.labelRole')}</InputLabel>
                  <Select
                    value={mappingForm.role}
                    label={t('admin.oidcSettings.labelRole')}
                    onChange={(e: SelectChangeEvent) =>
                      setMappingForm((f) => ({ ...f, role: e.target.value }))
                    }
                  >
                    {AVAILABLE_ROLES.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>{t('admin.oidcSettings.cancel')}</Button>
              <Button
                onClick={handleDialogSave}
                variant="contained"
                disabled={!mappingForm.group || !mappingForm.organization || !mappingForm.role}
              >
                {editingIndex !== null
                  ? t('admin.oidcSettings.update')
                  : t('admin.oidcSettings.add')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete confirm dialog */}
          <Dialog open={deleteIndex !== null} onClose={() => setDeleteIndex(null)}>
            <DialogTitle>{t('admin.oidcSettings.removeTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.oidcSettings.removeTextBefore')}
                <strong>{deleteIndex !== null ? mappings[deleteIndex]?.group : ''}</strong>
                {t('admin.oidcSettings.removeTextAfter')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteIndex(null)}>{t('admin.oidcSettings.cancel')}</Button>
              <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                {t('admin.oidcSettings.remove')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      {/* SAML Group Mappings (read-only from server config) */}
      {identityMappings?.saml && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('admin.oidcSettings.samlGroupMappings')}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('admin.oidcSettings.samlReadOnly')}
          </Alert>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip
              label={t('admin.oidcSettings.chipGroupAttribute', {
                value: identityMappings.saml.group_attribute_name || t('admin.oidcSettings.notSet'),
              })}
            />
            <Chip
              label={t('admin.oidcSettings.chipDefaultRole', {
                value: identityMappings.saml.default_role || t('admin.oidcSettings.none'),
              })}
              color="secondary"
            />
          </Stack>
          {identityMappings.saml.group_mappings.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.oidcSettings.thSamlGroup')}</TableCell>
                    <TableCell>{t('admin.oidcSettings.thOrganization')}</TableCell>
                    <TableCell>{t('admin.oidcSettings.thRole')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {identityMappings.saml.group_mappings.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{m.group}</TableCell>
                      <TableCell>{m.organization}</TableCell>
                      <TableCell>
                        <Chip label={m.role} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.oidcSettings.noSamlMappings')}
            </Typography>
          )}
        </Paper>
      )}
      {/* LDAP Group Mappings (read-only from server config) */}
      {identityMappings?.ldap && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('admin.oidcSettings.ldapGroupMappings')}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('admin.oidcSettings.ldapReadOnly')}
          </Alert>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip
              label={t('admin.oidcSettings.chipDefaultRole', {
                value: identityMappings.ldap.default_role || t('admin.oidcSettings.none'),
              })}
              color="secondary"
            />
          </Stack>
          {identityMappings.ldap.group_mappings.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.oidcSettings.thLdapGroupDn')}</TableCell>
                    <TableCell>{t('admin.oidcSettings.thOrganization')}</TableCell>
                    <TableCell>{t('admin.oidcSettings.thRole')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {identityMappings.ldap.group_mappings.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{m.group_dn}</TableCell>
                      <TableCell>{m.organization}</TableCell>
                      <TableCell>
                        <Chip label={m.role} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.oidcSettings.noLdapMappings')}
            </Typography>
          )}
        </Paper>
      )}
    </Page>
  )
}

export default OIDCSettingsPage
