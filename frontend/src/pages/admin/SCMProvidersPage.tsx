import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  FormHelperText,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import RefreshIcon from '@mui/icons-material/Refresh'
import GitHubIcon from '@mui/icons-material/GitHub'
import CloudIcon from '@mui/icons-material/Cloud'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/GitHub'
import api from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useAuth } from '../../contexts/AuthContext'
import type {
  SCMProvider,
  SCMProviderType,
  SCMAuthMode,
  CreateSCMProviderRequest,
} from '../../types/scm'
import type { UserMembership } from '../../types'
import { queryKeys } from '../../services/queryKeys'

interface TokenStatus {
  connected: boolean
  connected_at?: string
  expires_at?: string | null
  token_type?: string
}

const SCMProvidersPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<SCMProvider | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<SCMProvider | null>(null)
  const [patDialogOpen, setPatDialogOpen] = useState(false)
  const [patValue, setPatValue] = useState('')
  const [patProvider, setPatProvider] = useState<SCMProvider | null>(null)

  const [formData, setFormData] = useState<Partial<CreateSCMProviderRequest>>({
    organization_id: undefined,
    provider_type: 'github',
    name: '',
    base_url: null,
    tenant_id: null,
    client_id: '',
    client_secret: '',
    webhook_secret: '',
    auth_mode: 'oauth_user',
    github_app_id: '',
    github_installation_id: '',
    app_private_key: '',
  })

  // Per-provider "Test connection" (verify) outcomes for app-mode providers.
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, { ok: boolean; msg: string }>>(
    {},
  )

  // Memberships query
  const { data: memberships = [] } = useQuery<UserMembership[]>({
    queryKey: queryKeys.scmProviders.memberships(user?.id ?? ''),
    queryFn: async () => {
      const data = await api.getCurrentUserMemberships()
      return data || []
    },
    enabled: !!user?.id,
  })

  // Set default org when memberships load
  useEffect(() => {
    if (memberships.length > 0 && !formData.organization_id) {
      setFormData((prev) => ({
        ...prev,
        organization_id: memberships[0].organization_id,
      }))
    }
  }, [memberships]) // eslint-disable-line react-hooks/exhaustive-deps

  // Providers query
  const {
    data: providers = [],
    isLoading: loading,
    error: queryError,
    refetch: loadProviders,
  } = useQuery<SCMProvider[]>({
    queryKey: queryKeys.scmProviders.list(),
    queryFn: async () => {
      const data = await api.listSCMProviders()
      return Array.isArray(data) ? data : []
    },
  })

  // Token statuses — separate query so React Query manages its own lifecycle
  // and statuses are not lost when navigating away and back.
  const { data: tokenStatuses = {} } = useQuery<Record<string, TokenStatus>>({
    queryKey: [...queryKeys.scmProviders.list(), 'token-statuses', providers.map((p) => p.id)],
    queryFn: async () => {
      const statusEntries = await Promise.allSettled(
        providers.map((p) => api.getSCMTokenStatus(p.id).then((s) => [p.id, s] as const)),
      )
      const statuses: Record<string, TokenStatus> = {}
      statusEntries.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [id, status] = result.value
          statuses[id] = status
        }
      })
      return statuses
    },
    enabled: providers.length > 0,
  })

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.scmProviders.errLoad')))
  }

  const createMutation = useMutation({
    mutationFn: () => api.createSCMProvider(formData as CreateSCMProviderRequest),
    onSuccess: () => {
      setCreateDialogOpen(false)
      resetForm()
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.scmProviders._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.scmProviders.errCreate')))
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingProvider) throw new Error('No provider to update')
      return api.updateSCMProvider(editingProvider.id, {
        name: formData.name,
        base_url: formData.base_url,
        tenant_id: formData.tenant_id,
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        webhook_secret: formData.webhook_secret,
        auth_mode: formData.auth_mode,
        github_app_id: formData.github_app_id,
        github_installation_id: formData.github_installation_id,
        app_private_key: formData.app_private_key,
      })
    },
    onSuccess: () => {
      setEditingProvider(null)
      resetForm()
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.scmProviders._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.scmProviders.errUpdate')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSCMProvider(id),
    onSuccess: () => {
      setDeleteConfirmOpen(false)
      setProviderToDelete(null)
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.scmProviders._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.scmProviders.errDelete')))
    },
  })

  const handleCreate = () => {
    setError(null)
    createMutation.mutate()
  }

  const handleUpdate = () => {
    setError(null)
    updateMutation.mutate()
  }

  const handleDelete = () => {
    if (!providerToDelete) return
    setError(null)
    deleteMutation.mutate(providerToDelete.id)
  }

  const handleConnect = async (provider: SCMProvider) => {
    if (provider.provider_type === 'bitbucket_dc') {
      setPatProvider(provider)
      setPatValue('')
      setPatDialogOpen(true)
    } else {
      try {
        const response = await api.initiateSCMOAuth(provider.id)
        window.location.href = response.authorization_url
      } catch (err: unknown) {
        setError(getErrorMessage(err, t('admin.scmProviders.errOAuth')))
      }
    }
  }

  const handleSavePAT = async () => {
    if (!patProvider || !patValue) return
    try {
      setError(null)
      await api.saveSCMToken(patProvider.id, patValue)
      setPatDialogOpen(false)
      setPatValue('')
      setPatProvider(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.scmProviders.errSaveToken')))
    }
  }

  const isPATProvider = (type?: SCMProviderType) => type === 'bitbucket_dc'

  const isAppModeProvider = (p: SCMProvider) =>
    p.auth_mode === 'entra_app' || p.auth_mode === 'github_app'

  const handleVerify = async (provider: SCMProvider) => {
    setVerifyingId(provider.id)
    try {
      const res = await api.verifySCMProvider(provider.id)
      setVerifyResults((prev) => ({
        ...prev,
        [provider.id]: {
          ok: !!res.ok,
          msg: res.ok
            ? t('admin.scmProviders.testConnectionOk')
            : t('admin.scmProviders.testConnectionFailed'),
        },
      }))
    } catch (err: unknown) {
      setVerifyResults((prev) => ({
        ...prev,
        [provider.id]: {
          ok: false,
          msg: getErrorMessage(err, t('admin.scmProviders.testConnectionFailed')),
        },
      }))
    } finally {
      setVerifyingId(null)
    }
  }

  const getCallbackUrl = (providerId: string): string => {
    const baseUrl = window.location.origin
    return `${baseUrl}/api/v1/scm-providers/${providerId}/oauth/callback`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

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
      auth_mode: 'oauth_user',
      github_app_id: '',
      github_installation_id: '',
      app_private_key: '',
    })
  }

  const openEditDialog = (provider: SCMProvider) => {
    setEditingProvider(provider)
    setFormData({
      organization_id: provider.organization_id,
      name: provider.name,
      base_url: provider.base_url,
      tenant_id: provider.tenant_id,
      client_id: provider.client_id,
      client_secret: '', // Don't show existing secret
      webhook_secret: provider.webhook_secret || '',
      auth_mode: provider.auth_mode || 'oauth_user',
      github_app_id: provider.github_app_id || '',
      github_installation_id: provider.github_installation_id || '',
      app_private_key: '', // Don't show existing private key
    })
  }

  const getProviderIcon = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return <GitHubIcon />
      case 'azuredevops':
        return <CloudIcon />
      case 'gitlab':
        return <CloudIcon />
      case 'bitbucket_dc':
        return <CloudIcon />
      default:
        return <CloudIcon />
    }
  }

  const getProviderLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return 'GitHub'
      case 'azuredevops':
        return 'Azure DevOps'
      case 'gitlab':
        return 'GitLab'
      case 'bitbucket_dc':
        return 'Bitbucket Data Center'
      default:
        return type
    }
  }

  const getClientIdLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return t('admin.scmProviders.labelClientId')
      case 'azuredevops':
        return t('admin.scmProviders.labelAppId')
      case 'gitlab':
        return t('admin.scmProviders.labelApplicationId')
      default:
        return t('admin.scmProviders.labelClientId')
    }
  }

  const getClientSecretLabel = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return t('admin.scmProviders.labelClientSecret')
      case 'azuredevops':
        return t('admin.scmProviders.labelClientSecret')
      case 'gitlab':
        return t('admin.scmProviders.labelSecret')
      default:
        return t('admin.scmProviders.labelClientSecret')
    }
  }

  const getBaseUrlHelper = (type: SCMProviderType) => {
    switch (type) {
      case 'github':
        return t('admin.scmProviders.helpBaseUrlGithub')
      case 'azuredevops':
        return t('admin.scmProviders.helpBaseUrlAzure')
      case 'gitlab':
        return t('admin.scmProviders.helpBaseUrlGitlab')
      case 'bitbucket_dc':
        return t('admin.scmProviders.helpBaseUrlBitbucket')
      default:
        return t('admin.scmProviders.helpBaseUrlDefault')
    }
  }

  return (
    <Page maxWidth="lg" aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          <PageHeader
            icon={<PageTitleIcon />}
            title={t('admin.scmProviders.pageTitle')}
            actions={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    loadProviders()
                  }}
                >
                  {t('admin.scmProviders.refresh')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    resetForm()
                    setCreateDialogOpen(true)
                  }}
                >
                  {t('admin.scmProviders.addProvider')}
                </Button>
              </Box>
            }
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {providers.map((provider) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={provider.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          mr: 2,
                        }}
                      >
                        {getProviderIcon(provider.provider_type)}
                      </Box>
                      <Box
                        sx={{
                          flexGrow: 1,
                        }}
                      >
                        <Typography variant="h6">{provider.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {getProviderLabel(provider.provider_type)}
                        </Typography>
                      </Box>
                      <Chip
                        label={
                          provider.is_active
                            ? t('admin.scmProviders.active')
                            : t('admin.scmProviders.inactive')
                        }
                        color={provider.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    {provider.tenant_id && (
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {t('admin.scmProviders.tenantIdValue', { value: provider.tenant_id })}
                      </Typography>
                    )}

                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {t('admin.scmProviders.clientIdValue', {
                        label: getClientIdLabel(provider.provider_type),
                        value: provider.client_id,
                      })}
                    </Typography>

                    {provider.base_url && (
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {t('admin.scmProviders.baseUrlValue', { value: provider.base_url })}
                      </Typography>
                    )}

                    {provider.provider_type !== 'bitbucket_dc' && (
                      <Box
                        sx={{
                          mt: 2,
                          p: 1.5,

                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',

                          borderRadius: 1,

                          border: (theme) =>
                            `1px solid ${theme.palette.mode === 'dark' ? '#404040' : '#e0e0e0'}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{
                            display: 'block',
                            mb: 0.5,
                          }}
                        >
                          {t('admin.scmProviders.oauthCallbackUrl')}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
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
                          <Tooltip title={t('admin.scmProviders.tooltipCopy')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.scmProviders.ariaCopyCallback')}
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

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          flex: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{
                            display: 'block',
                          }}
                        >
                          {t('admin.scmProviders.created', {
                            date: new Date(provider.created_at).toLocaleDateString(),
                          })}
                        </Typography>
                        {(() => {
                          if (isAppModeProvider(provider)) {
                            return (
                              <Box
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                              >
                                <CheckCircleIcon sx={{ fontSize: '0.9rem', color: 'info.main' }} />
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'info.main', fontWeight: 600 }}
                                >
                                  {t('admin.scmProviders.appCredential')}
                                </Typography>
                              </Box>
                            )
                          }
                          const status = tokenStatuses[provider.id]
                          if (!status) return null
                          return status.connected ? (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.5,
                              }}
                            >
                              <CheckCircleIcon sx={{ fontSize: '0.9rem', color: 'success.main' }} />
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'success.main',
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    display: 'block',
                                  }}
                                >
                                  {t('admin.scmProviders.connected')}
                                </Typography>
                                {status.connected_at && (
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    sx={{ fontSize: '0.7rem', display: 'block' }}
                                  >
                                    {new Date(status.connected_at).toLocaleString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.5,
                              }}
                            >
                              <LinkOffIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{ fontStyle: 'italic' }}
                              >
                                {t('admin.scmProviders.notConnected')}
                              </Typography>
                            </Box>
                          )
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
                    {!isAppModeProvider(provider) && (
                      <>
                        <Tooltip
                          title={
                            tokenStatuses[provider.id]?.connected
                              ? provider.provider_type === 'bitbucket_dc'
                                ? t('admin.scmProviders.tooltipUpdatePat')
                                : t('admin.scmProviders.tooltipReconnectOauth')
                              : provider.provider_type === 'bitbucket_dc'
                                ? t('admin.scmProviders.tooltipConnectPat')
                                : t('admin.scmProviders.tooltipConnectOauth')
                          }
                        >
                          <IconButton
                            size="small"
                            aria-label={t('admin.scmProviders.ariaConnect')}
                            color="primary"
                            onClick={() => handleConnect(provider)}
                          >
                            <LinkIcon />
                          </IconButton>
                        </Tooltip>
                        {tokenStatuses[provider.id]?.connected && (
                          <Tooltip title={t('admin.scmProviders.tooltipDisconnect')}>
                            <IconButton
                              size="small"
                              aria-label={t('admin.scmProviders.ariaDisconnect')}
                              color="warning"
                              onClick={async () => {
                                try {
                                  await api.revokeSCMToken(provider.id)
                                  queryClient.invalidateQueries({
                                    queryKey: queryKeys.scmProviders._def,
                                  })
                                } catch (err: unknown) {
                                  setError(
                                    getErrorMessage(err, t('admin.scmProviders.errDisconnect')),
                                  )
                                }
                              }}
                            >
                              <LinkOffIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                    {isAppModeProvider(provider) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
                        <Button
                          size="small"
                          onClick={() => handleVerify(provider)}
                          disabled={verifyingId === provider.id}
                        >
                          {t('admin.scmProviders.testConnection')}
                        </Button>
                        {verifyResults[provider.id] && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: verifyResults[provider.id].ok ? 'success.main' : 'error.main',
                            }}
                          >
                            {verifyResults[provider.id].msg}
                          </Typography>
                        )}
                      </Box>
                    )}
                    <Tooltip title={t('admin.scmProviders.tooltipEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('admin.scmProviders.ariaEdit')}
                        onClick={() => openEditDialog(provider)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('admin.scmProviders.tooltipDelete')}>
                      <IconButton
                        size="small"
                        aria-label={t('admin.scmProviders.ariaDelete')}
                        color="error"
                        onClick={() => {
                          setProviderToDelete(provider)
                          setDeleteConfirmOpen(true)
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
              <Grid size={12}>
                <Card>
                  <CardContent>
                    <Typography variant="body1" color="textSecondary" align="center">
                      {t('admin.scmProviders.emptyState')}
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
              setCreateDialogOpen(false)
              setEditingProvider(null)
              resetForm()
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingProvider
                ? t('admin.scmProviders.dialogTitleEdit')
                : t('admin.scmProviders.dialogTitleAdd')}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {memberships.length > 0 && (
                  <FormControl fullWidth disabled={!!editingProvider}>
                    <InputLabel id="organization-label">
                      {t('admin.scmProviders.labelOrganization')}
                    </InputLabel>
                    <Select
                      labelId="organization-label"
                      value={formData.organization_id || ''}
                      label={t('admin.scmProviders.labelOrganization')}
                      onChange={(e) =>
                        setFormData({ ...formData, organization_id: e.target.value as string })
                      }
                    >
                      {memberships.map((membership) => (
                        <MenuItem
                          key={membership.organization_id}
                          value={membership.organization_id}
                        >
                          {membership.organization_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {!editingProvider && (
                  <FormControl fullWidth>
                    <InputLabel id="provider-type-label">
                      {t('admin.scmProviders.labelProviderType')}
                    </InputLabel>
                    <Select
                      labelId="provider-type-label"
                      value={formData.provider_type}
                      label={t('admin.scmProviders.labelProviderType')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          provider_type: e.target.value as SCMProviderType,
                          // Reset app-credential fields when the provider type changes
                          // so an incompatible auth_mode is never submitted.
                          auth_mode: 'oauth_user',
                          github_app_id: '',
                          github_installation_id: '',
                          app_private_key: '',
                        })
                      }
                    >
                      <MenuItem value="azuredevops">Azure DevOps</MenuItem>
                      <MenuItem value="bitbucket_dc">Bitbucket Data Center</MenuItem>
                      <MenuItem value="github">GitHub</MenuItem>
                      <MenuItem value="gitlab">GitLab</MenuItem>
                    </Select>
                  </FormControl>
                )}

                <TextField
                  label={t('admin.scmProviders.labelName')}
                  fullWidth
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  helperText={t('admin.scmProviders.helpName')}
                />

                {((editingProvider?.provider_type || formData.provider_type) === 'github' ||
                  (editingProvider?.provider_type || formData.provider_type) === 'azuredevops') && (
                    <FormControl fullWidth>
                      <InputLabel id="auth-mode-label">
                        {t('admin.scmProviders.labelAuthMode')}
                      </InputLabel>
                      <Select
                        labelId="auth-mode-label"
                        value={formData.auth_mode || 'oauth_user'}
                        label={t('admin.scmProviders.labelAuthMode')}
                        onChange={(e) =>
                          setFormData({ ...formData, auth_mode: e.target.value as SCMAuthMode })
                        }
                      >
                        <MenuItem value="oauth_user">
                          {t('admin.scmProviders.authModeOAuth')}
                        </MenuItem>
                        <MenuItem
                          value={
                            (editingProvider?.provider_type || formData.provider_type) === 'github'
                              ? 'github_app'
                              : 'entra_app'
                          }
                        >
                          {t('admin.scmProviders.authModeApp')}
                        </MenuItem>
                      </Select>
                      <FormHelperText>{t('admin.scmProviders.helpAuthMode')}</FormHelperText>
                    </FormControl>
                  )}

                {(editingProvider?.provider_type || formData.provider_type) === 'azuredevops' && (
                  <TextField
                    label={t('admin.scmProviders.labelTenantId')}
                    fullWidth
                    value={formData.tenant_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, tenant_id: e.target.value || null })
                    }
                    required
                    helperText={t('admin.scmProviders.helpTenantId')}
                  />
                )}

                {!isPATProvider(editingProvider?.provider_type || formData.provider_type) &&
                  !(
                    (editingProvider?.provider_type || formData.provider_type) === 'github' &&
                    formData.auth_mode === 'github_app'
                  ) && (
                    <>
                      <TextField
                        label={getClientIdLabel(
                          editingProvider?.provider_type || formData.provider_type || 'github',
                        )}
                        fullWidth
                        value={formData.client_id}
                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                        required
                        helperText={t('admin.scmProviders.helpClientId')}
                      />

                      <TextField
                        label={getClientSecretLabel(
                          editingProvider?.provider_type || formData.provider_type || 'github',
                        )}
                        type="password"
                        fullWidth
                        value={formData.client_secret}
                        onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                        required={!editingProvider}
                        helperText={
                          editingProvider ? t('admin.scmProviders.helpClientSecretKeep') : ''
                        }
                      />
                    </>
                  )}

                {(editingProvider?.provider_type || formData.provider_type) === 'github' &&
                  formData.auth_mode === 'github_app' && (
                    <>
                      <TextField
                        label={t('admin.scmProviders.labelGithubAppId')}
                        fullWidth
                        value={formData.github_app_id}
                        onChange={(e) =>
                          setFormData({ ...formData, github_app_id: e.target.value })
                        }
                        required
                      />
                      <TextField
                        label={t('admin.scmProviders.labelGithubInstallationId')}
                        fullWidth
                        value={formData.github_installation_id}
                        onChange={(e) =>
                          setFormData({ ...formData, github_installation_id: e.target.value })
                        }
                        required
                      />
                      <TextField
                        label={t('admin.scmProviders.labelAppPrivateKey')}
                        fullWidth
                        multiline
                        minRows={4}
                        value={formData.app_private_key}
                        onChange={(e) =>
                          setFormData({ ...formData, app_private_key: e.target.value })
                        }
                        required={!editingProvider}
                        helperText={
                          editingProvider
                            ? t('admin.scmProviders.helpAppPrivateKeyKeep')
                            : t('admin.scmProviders.helpGithubApp')
                        }
                      />
                    </>
                  )}

                <TextField
                  label={
                    isPATProvider(editingProvider?.provider_type || formData.provider_type)
                      ? t('admin.scmProviders.labelBaseUrl')
                      : t('admin.scmProviders.labelBaseUrlOptional')
                  }
                  fullWidth
                  value={formData.base_url || ''}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value || null })}
                  required={isPATProvider(editingProvider?.provider_type || formData.provider_type)}
                  helperText={getBaseUrlHelper(
                    editingProvider?.provider_type || formData.provider_type || 'github',
                  )}
                />

                <TextField
                  label={t('admin.scmProviders.labelWebhookSecret')}
                  fullWidth
                  value={formData.webhook_secret}
                  onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                  helperText={t('admin.scmProviders.helpWebhookSecret')}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setCreateDialogOpen(false)
                  setEditingProvider(null)
                  resetForm()
                }}
              >
                {t('admin.scmProviders.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={editingProvider ? handleUpdate : handleCreate}
                disabled={(() => {
                  if (!formData.name) return true
                  const ptype = editingProvider?.provider_type || formData.provider_type
                  const authMode = formData.auth_mode || 'oauth_user'
                  if (isPATProvider(ptype)) return !formData.base_url
                  if (ptype === 'github' && authMode === 'github_app') {
                    return (
                      !formData.github_app_id ||
                      !formData.github_installation_id ||
                      (!editingProvider && !formData.app_private_key)
                    )
                  }
                  return !formData.client_id || (!editingProvider && !formData.client_secret)
                })()}
              >
                {editingProvider ? t('admin.scmProviders.update') : t('admin.scmProviders.create')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
            <DialogTitle>{t('admin.scmProviders.confirmDeleteTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.scmProviders.confirmDeleteText', { name: providerToDelete?.name })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteConfirmOpen(false)}>
                {t('admin.scmProviders.cancel')}
              </Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                {t('admin.scmProviders.delete')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* PAT Dialog for Bitbucket Data Center */}
          <Dialog
            open={patDialogOpen}
            onClose={() => {
              setPatDialogOpen(false)
              setPatValue('')
              setPatProvider(null)
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {t('admin.scmProviders.connectToTitle', { name: patProvider?.name })}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.scmProviders.patIntro')}
                </Typography>
                <TextField
                  label={t('admin.scmProviders.labelPat')}
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
                  setPatDialogOpen(false)
                  setPatValue('')
                  setPatProvider(null)
                }}
              >
                {t('admin.scmProviders.cancel')}
              </Button>
              <Button variant="contained" onClick={handleSavePAT} disabled={!patValue}>
                {t('admin.scmProviders.saveToken')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Page>
  )
}

export default SCMProvidersPage
