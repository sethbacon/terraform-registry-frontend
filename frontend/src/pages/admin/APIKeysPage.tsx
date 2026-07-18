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
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import KeyIcon from '@mui/icons-material/Key'
import { ApiKeyExpirySettingsCard, type ApiKeyExpirySettingsInput } from '@sethbacon/terraform-suite-ui'
import EmptyState from '../../components/EmptyState'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Key'
import CopyIcon from '@mui/icons-material/ContentCopy'
import InfoIcon from '@mui/icons-material/Info'
import EditIcon from '@mui/icons-material/Edit'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import api from '../../services/api'
import { APIKey } from '../../types'
import type { NotificationsConfigInput } from '../../types'
import { REGISTRY_HOST } from '../../config'
import { useAuth } from '../../contexts/AuthContext'
import { AVAILABLE_SCOPES } from '../../types/rbac'
import { getScopeInfo } from '../../utils'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'

function getExpirationStatus(
  expiresAt?: string | null,
): 'expired' | 'expiring-soon' | 'active' | 'never' {
  if (!expiresAt) return 'never'
  const exp = new Date(expiresAt)
  if (isNaN(exp.getTime())) return 'never'
  const now = new Date()
  if (exp <= now) return 'expired'
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  if (exp.getTime() - now.getTime() <= sevenDays) return 'expiring-soon'
  return 'active'
}

function toDatetimeLocalValue(isoString?: string | null): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const APIKeysPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes, roleTemplate, user } = useAuth()
  const isAdmin = allowedScopes.includes('admin')
  const [error, setError] = useState<string | null>(null)

  // API-key-expiry notification settings (admin-only). Shares the notifications
  // config query/endpoint with admin/NotificationsPage -- saving here reads the
  // full current config and overrides only the expiry-related fields, since
  // the backend endpoint is a single full-replace PUT.
  const expiryConfigQuery = useQuery({
    queryKey: queryKeys.notifications.config(),
    queryFn: () => api.getNotificationsConfig(),
    enabled: isAdmin,
  })
  const saveExpiryMutation = useMutation({
    mutationFn: (input: ApiKeyExpirySettingsInput) => {
      const current = expiryConfigQuery.data
      if (!current) throw new Error(t('admin.apiKeys.expiryLoadError'))
      const payload: NotificationsConfigInput = {
        enabled: current.enabled,
        smtp: { ...current.smtp, password: '' },
        recipients: current.recipients,
        events: { ...current.events, api_key_expiring: input.apiKeyExpiring },
        api_key_expiry_warning_days: input.warningDays,
        api_key_expiry_check_interval_hours: input.checkIntervalHours,
      }
      return api.saveNotificationsConfig(payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.config() }),
  })

  // Memberships query
  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: queryKeys.apiKeys.memberships(user?.id ?? ''),
    queryFn: () => api.getCurrentUserMemberships(),
    enabled: !!user?.id,
  })

  // API Keys query
  const {
    data: apiKeys = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<APIKey[]>({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: async () => {
      const keys = await api.listAPIKeys()
      return Array.isArray(keys) ? keys : []
    },
  })

  useEffect(() => {
    if (queryError && !error) {
      setError(t('admin.apiKeys.errLoad'))
    }
  }, [queryError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Create dialog state
  const [openDialog, setOpenDialog] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [keyToEdit, setKeyToEdit] = useState<APIKey | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    scopes: [] as string[],
    expires_at: '',
  })

  // Rotate dialog state
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false)
  const [keyToRotate, setKeyToRotate] = useState<APIKey | null>(null)
  const [rotateMode, setRotateMode] = useState<'immediate' | 'grace'>('immediate')
  const [gracePeriodHours, setGracePeriodHours] = useState(24)
  const [rotatedKeyValue, setRotatedKeyValue] = useState<string | null>(null)
  const [rotateResult, setRotateResult] = useState<{
    oldStatus: string
    oldExpiresAt?: string
  } | null>(null)

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization_id: '',
    scopes: [] as string[],
    expires_at: '',
  })

  // Check if user has admin scope (which grants all permissions)
  const hasAdminScope = allowedScopes.includes('admin')

  // Get available scopes for this user
  const availableScopes = hasAdminScope ? AVAILABLE_SCOPES.map((s) => s.value) : allowedScopes

  // --- Create Dialog ---

  const handleOpenDialog = () => {
    setNewKeyValue(null)
    const defaultScopes = ['modules:read', 'providers:read'].filter((s) =>
      availableScopes.includes(s),
    )
    const defaultOrgId = memberships.length > 0 ? memberships[0].organization_id : ''
    setFormData({
      name: '',
      description: '',
      organization_id: defaultOrgId,
      scopes: defaultScopes,
      expires_at: '',
    })
    setError(null)
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
  }

  const handleCreateAPIKey = async () => {
    try {
      setError(null)
      const orgId =
        formData.organization_id || (memberships.length > 0 ? memberships[0].organization_id : '')
      if (!orgId) {
        setError(t('admin.apiKeys.errNoOrg'))
        return
      }
      const response = await api.createAPIKey({
        name: formData.name,
        organization_id: orgId,
        description: formData.description || undefined,
        scopes: formData.scopes,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : undefined,
      })
      setNewKeyValue(response.key)
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys._def })
    } catch (err: unknown) {
      console.error('Failed to create API key:', err)
      setError(getErrorMessage(err, t('admin.apiKeys.errCreate')))
    }
  }

  // --- Edit Dialog ---

  const handleEditClick = (key: APIKey) => {
    setKeyToEdit(key)
    setEditFormData({
      name: key.name || '',
      scopes: key.scopes || [],
      expires_at: toDatetimeLocalValue(key.expires_at),
    })
    setError(null)
    setEditDialogOpen(true)
  }

  const handleEditScopeToggle = (scope: string) => {
    setEditFormData((prev) => {
      const newScopes = prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope]
      return { ...prev, scopes: newScopes }
    })
  }

  const handleEditSave = async () => {
    if (!keyToEdit) return
    try {
      setError(null)
      await api.updateAPIKey(keyToEdit.id, {
        name: editFormData.name,
        scopes: editFormData.scopes,
        expires_at: editFormData.expires_at
          ? new Date(editFormData.expires_at).toISOString()
          : undefined,
      })
      setEditDialogOpen(false)
      setKeyToEdit(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys._def })
    } catch (err: unknown) {
      console.error('Failed to update API key:', err)
      setError(getErrorMessage(err, t('admin.apiKeys.errUpdate')))
    }
  }

  // --- Rotate Dialog ---

  const handleRotateClick = (key: APIKey) => {
    setKeyToRotate(key)
    setRotateMode('immediate')
    setGracePeriodHours(24)
    setRotatedKeyValue(null)
    setRotateResult(null)
    setError(null)
    setRotateDialogOpen(true)
  }

  const handleRotateConfirm = async () => {
    if (!keyToRotate) return
    try {
      setError(null)
      const hours = rotateMode === 'immediate' ? 0 : gracePeriodHours
      const response = await api.rotateAPIKey(keyToRotate.id, hours)
      const newKey = response.new_key
      setRotatedKeyValue(newKey?.key || '')
      setRotateResult({
        oldStatus: response.old_key_status,
        oldExpiresAt: response.old_expires_at,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys._def })
    } catch (err: unknown) {
      console.error('Failed to rotate API key:', err)
      setError(getErrorMessage(err, t('admin.apiKeys.errRotate')))
    }
  }

  const handleCloseRotateDialog = () => {
    setRotateDialogOpen(false)
    setKeyToRotate(null)
    setRotatedKeyValue(null)
    setRotateResult(null)
  }

  // --- Delete Dialog ---

  const handleDeleteClick = (key: APIKey) => {
    setKeyToDelete(key)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return
    try {
      setError(null)
      await api.deleteAPIKey(keyToDelete.id)
      setDeleteDialogOpen(false)
      setKeyToDelete(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys._def })
    } catch (err: unknown) {
      console.error('Failed to delete API key:', err)
      setError(getErrorMessage(err, t('admin.apiKeys.errDelete')))
    }
  }

  // --- Helpers ---

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const getKeyTail = (prefix: string) => {
    return '...' + prefix.slice(-6)
  }

  const handleScopeToggle = (scope: string) => {
    setFormData((prev) => {
      const newScopes = prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope]
      return { ...prev, scopes: newScopes }
    })
  }

  const renderExpirationChip = (expiresAt?: string | null) => {
    const status = getExpirationStatus(expiresAt)
    switch (status) {
      case 'expired':
        return <Chip label={t('admin.apiKeys.chipExpired')} size="small" color="error" />
      case 'expiring-soon':
        return (
          <Tooltip
            title={t('admin.apiKeys.tooltipExpires', {
              date: new Date(expiresAt!).toLocaleString(),
            })}
          >
            <Chip label={t('admin.apiKeys.chipExpiresSoon')} size="small" color="warning" />
          </Tooltip>
        )
      case 'active':
        return <Typography variant="body2">{new Date(expiresAt!).toLocaleDateString()}</Typography>
      case 'never':
      default:
        return (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t('admin.apiKeys.never')}
          </Typography>
        )
    }
  }

  const renderScopeChips = (scopes: string[]) => {
    if (!scopes || scopes.length === 0)
      return (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {t('admin.apiKeys.none')}
        </Typography>
      )
    const maxVisible = 2
    const visible = scopes.slice(0, maxVisible)
    const remaining = scopes.length - maxVisible
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
    )
  }

  // Scope checkboxes component (reused in create and edit dialogs)
  const renderScopeCheckboxes = (selectedScopes: string[], onToggle: (scope: string) => void) => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {t('admin.apiKeys.scopesTitle')}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          mb: 1,
          display: 'block',
        }}
      >
        {t('admin.apiKeys.scopesHelp')}
      </Typography>
      {availableScopes.length === 0 ? (
        <Alert severity="error">{t('admin.apiKeys.noScopesAvailable')}</Alert>
      ) : (
        <FormGroup>
          {availableScopes.map((scope) => {
            const info = getScopeInfo(scope)
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
            )
          })}
        </FormGroup>
      )}
      {selectedScopes.length === 0 && availableScopes.length > 0 && (
        <Typography variant="caption" color="error">
          {t('admin.apiKeys.selectAtLeastOne')}
        </Typography>
      )}
    </Box>
  )

  return (
    <Page maxWidth="lg" aria-busy={loading} aria-live="polite">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.apiKeys.pageTitle')}
        description={t('admin.apiKeys.pageSubtitle')}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
            {t('admin.apiKeys.createApiKey')}
          </Button>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!membershipsLoading && memberships.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('admin.apiKeys.warnNoOrg')}
        </Alert>
      )}
      {isAdmin && (
        <ApiKeyExpirySettingsCard
          value={{
            enabled: expiryConfigQuery.data?.enabled ?? false,
            apiKeyExpiring: expiryConfigQuery.data?.events.api_key_expiring ?? false,
            warningDays: expiryConfigQuery.data?.api_key_expiry_warning_days ?? 7,
            checkIntervalHours: expiryConfigQuery.data?.api_key_expiry_check_interval_hours ?? 24,
          }}
          isLoading={expiryConfigQuery.isLoading}
          onSave={async (input) => {
            await saveExpiryMutation.mutateAsync(input)
          }}
        />
      )}
      {/* API Keys Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            title={t('admin.apiKeys.emptyTitle')}
            description={t('admin.apiKeys.emptyDescription')}
            icon={<KeyIcon />}
            primaryAction={{
              label: t('admin.apiKeys.emptyAction'),
              icon: <AddIcon />,
              onClick: handleOpenDialog,
            }}
            data-testid="apikeys-empty-state"
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.apiKeys.thName')}</TableCell>
                  <TableCell>{t('admin.apiKeys.thKey')}</TableCell>
                  <TableCell>{t('admin.apiKeys.scopesTitle')}</TableCell>
                  <TableCell>{t('admin.apiKeys.thExpires')}</TableCell>
                  <TableCell>{t('admin.apiKeys.thLastUsed')}</TableCell>
                  <TableCell>{t('admin.apiKeys.thCreated')}</TableCell>
                  <TableCell align="right">{t('admin.apiKeys.thActions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((apiKey) => {
                  const expStatus = getExpirationStatus(apiKey.expires_at)
                  return (
                    <TableRow
                      key={apiKey.id}
                      sx={expStatus === 'expired' ? { opacity: 0.5 } : undefined}
                    >
                      <TableCell>
                        <Typography
                          sx={{
                            fontWeight: 'medium',
                          }}
                        >
                          {apiKey.name || '-'}
                        </Typography>
                        {apiKey.description && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              display: 'block',
                            }}
                          >
                            {apiKey.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                        >
                          {apiKey.key_prefix ? getKeyTail(apiKey.key_prefix) : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{renderScopeChips(apiKey.scopes)}</TableCell>
                      <TableCell>{renderExpirationChip(apiKey.expires_at)}</TableCell>
                      <TableCell>
                        {apiKey.last_used_at && !isNaN(Date.parse(apiKey.last_used_at))
                          ? new Date(apiKey.last_used_at).toLocaleDateString()
                          : t('admin.apiKeys.never')}
                      </TableCell>
                      <TableCell>
                        {apiKey.created_at && !isNaN(Date.parse(apiKey.created_at))
                          ? new Date(apiKey.created_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title={t('admin.apiKeys.tooltipEdit')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.apiKeys.ariaEdit')}
                              onClick={() => handleEditClick(apiKey)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('admin.apiKeys.tooltipRotate')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.apiKeys.ariaRotate')}
                              onClick={() => handleRotateClick(apiKey)}
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('admin.apiKeys.tooltipDelete')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.apiKeys.ariaDelete')}
                              onClick={() => handleDeleteClick(apiKey)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('admin.apiKeys.dialogTitleCreate')}</DialogTitle>
        <DialogContent>
          {newKeyValue ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                {t('admin.apiKeys.successCreated')}
              </Alert>
              <TextField
                label={t('admin.apiKeys.labelApiKey')}
                value={newKeyValue}
                fullWidth
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('admin.apiKeys.tooltipCopyApiKey')}>
                          <IconButton
                            aria-label={t('admin.apiKeys.ariaCopyApiKey')}
                            onClick={() => handleCopyKey(newKeyValue)}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                    sx: { fontFamily: 'monospace' },
                  },
                }}
              />
              {copiedKey && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'success.main',
                    mt: 1,
                    display: 'block',
                  }}
                >
                  {t('admin.apiKeys.copied')}
                </Typography>
              )}
            </Box>
          ) : (
            <Stack spacing={3} sx={{ mt: 2 }}>
              {!roleTemplate && (
                <Alert severity="warning" icon={<InfoIcon />}>
                  {t('admin.apiKeys.warnNoRole')}
                </Alert>
              )}
              {roleTemplate && (
                <Alert severity="info" icon={<InfoIcon />}>
                  {t('admin.apiKeys.roleInfoBefore')}
                  <strong>{roleTemplate.display_name}</strong>
                  {t('admin.apiKeys.roleInfoAfter')}
                </Alert>
              )}
              {memberships.length === 0 && (
                <Alert severity="error">{t('admin.apiKeys.errNoOrg')}</Alert>
              )}
              {memberships.length > 0 && (
                <FormControl fullWidth>
                  <InputLabel>{t('admin.apiKeys.labelOrganization')}</InputLabel>
                  <Select
                    value={formData.organization_id}
                    onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                    label={t('admin.apiKeys.labelOrganization')}
                  >
                    {memberships.map(
                      (m: {
                        organization_id: string
                        organization_name: string
                        role_template_display_name?: string
                      }) => (
                        <MenuItem key={m.organization_id} value={m.organization_id}>
                          {m.organization_name}{' '}
                          {m.role_template_display_name && `(${m.role_template_display_name})`}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              )}
              <TextField
                label={t('admin.apiKeys.labelName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                helperText={t('admin.apiKeys.helpName')}
              />
              <TextField
                label={t('admin.apiKeys.labelDescription')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
              <TextField
                label={t('admin.apiKeys.labelExpirationDate')}
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                fullWidth
                helperText={t('admin.apiKeys.helpExpiration')}
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
              {renderScopeCheckboxes(formData.scopes, handleScopeToggle)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {newKeyValue ? (
            <Button onClick={handleCloseDialog} variant="contained">
              {t('admin.apiKeys.done')}
            </Button>
          ) : (
            <>
              <Button onClick={handleCloseDialog}>{t('admin.apiKeys.cancel')}</Button>
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
                {t('admin.apiKeys.create')}
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
        <DialogTitle>{t('admin.apiKeys.dialogTitleEdit')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label={t('admin.apiKeys.labelName')}
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label={t('admin.apiKeys.labelExpirationDate')}
              type="datetime-local"
              value={editFormData.expires_at}
              onChange={(e) => setEditFormData({ ...editFormData, expires_at: e.target.value })}
              fullWidth
              helperText={t('admin.apiKeys.helpExpiration')}
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            {renderScopeCheckboxes(editFormData.scopes, handleEditScopeToggle)}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('admin.apiKeys.cancel')}</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={!editFormData.name || editFormData.scopes.length === 0}
          >
            {t('admin.apiKeys.save')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Rotate API Key Dialog */}
      <Dialog
        open={rotateDialogOpen}
        onClose={rotatedKeyValue ? undefined : handleCloseRotateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('admin.apiKeys.dialogTitleRotate')}</DialogTitle>
        <DialogContent>
          {rotatedKeyValue ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                {t('admin.apiKeys.successRotated')}
              </Alert>
              <TextField
                label={t('admin.apiKeys.labelNewApiKey')}
                value={rotatedKeyValue}
                fullWidth
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('admin.apiKeys.tooltipCopyApiKey')}>
                          <IconButton
                            aria-label={t('admin.apiKeys.ariaCopyRotated')}
                            onClick={() => handleCopyKey(rotatedKeyValue)}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                    sx: { fontFamily: 'monospace' },
                  },
                }}
              />
              {copiedKey && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'success.main',
                    mt: 1,
                    display: 'block',
                  }}
                >
                  {t('admin.apiKeys.copied')}
                </Typography>
              )}
              {rotateResult && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {rotateResult.oldStatus === 'revoked'
                    ? t('admin.apiKeys.rotateOldRevoked')
                    : t('admin.apiKeys.rotateOldValid', {
                      date: new Date(rotateResult.oldExpiresAt!).toLocaleString(),
                    })}
                </Alert>
              )}
            </Box>
          ) : (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Typography>
                {t('admin.apiKeys.rotateIntroBefore')}
                <strong>{keyToRotate?.name}</strong>
                {t('admin.apiKeys.rotateIntroAfter')}
              </Typography>
              <FormControl>
                <RadioGroup
                  value={rotateMode}
                  onChange={(e) => setRotateMode(e.target.value as 'immediate' | 'grace')}
                >
                  <FormControlLabel
                    value="immediate"
                    control={<Radio />}
                    label={t('admin.apiKeys.rotateImmediate')}
                  />
                  <FormControlLabel
                    value="grace"
                    control={<Radio />}
                    label={t('admin.apiKeys.rotateGrace')}
                  />
                </RadioGroup>
              </FormControl>
              {rotateMode === 'grace' && (
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    {t('admin.apiKeys.gracePeriod', { count: gracePeriodHours })}
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
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {t('admin.apiKeys.graceHelp')}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {rotatedKeyValue ? (
            <Button onClick={handleCloseRotateDialog} variant="contained">
              {t('admin.apiKeys.done')}
            </Button>
          ) : (
            <>
              <Button onClick={handleCloseRotateDialog}>{t('admin.apiKeys.cancel')}</Button>
              <Button onClick={handleRotateConfirm} variant="contained" color="warning">
                {t('admin.apiKeys.rotateKey')}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('admin.apiKeys.dialogTitleDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('admin.apiKeys.deleteConfirm', { name: keyToDelete?.name })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('admin.apiKeys.cancel')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('admin.apiKeys.tooltipDelete')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Usage Instructions */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('admin.apiKeys.usingApiKeysTitle')}
        </Typography>
        <Typography
          variant="body2"
          component="div"
          sx={{
            color: 'text.secondary',
          }}
        >
          {t('admin.apiKeys.usingApiKeysIntro')}
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5'),
              color: (theme) => (theme.palette.mode === 'dark' ? '#e6e6e6' : '#1e1e1e'),
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
    </Page>
  )
}

export default APIKeysPage
