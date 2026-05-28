import React, { useState } from 'react'
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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import api from '../../services/api'
import { MirrorPolicy } from '../../types/rbac'
import { getErrorMessage } from '../../utils/errors'
import { queryKeys } from '../../services/queryKeys'

interface PolicyFormData {
  name: string
  description: string
  policy_type: 'allow' | 'deny'
  upstream_registry: string
  namespace_pattern: string
  provider_pattern: string
  priority: number
  is_active: boolean
  requires_approval: boolean
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
}

const MirrorPoliciesPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create / Edit dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<MirrorPolicy | null>(null)
  const [formData, setFormData] = useState<PolicyFormData>(defaultFormData)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [policyToDelete, setPolicyToDelete] = useState<MirrorPolicy | null>(null)

  // Evaluate dialog
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false)
  const [evaluateForm, setEvaluateForm] = useState({ registry: '', namespace: '', provider: '' })
  const [evaluateResult, setEvaluateResult] = useState<{
    allowed: boolean
    matched_policy?: string
    reason?: string
  } | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const {
    data: policies = [],
    isLoading: loading,
    error: queryError,
    refetch: loadPolicies,
  } = useQuery<MirrorPolicy[]>({
    queryKey: queryKeys.policies.list(),
    queryFn: async () => {
      const data = await api.listMirrorPolicies()
      return Array.isArray(data) ? data : []
    },
  })

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.mirrorPolicies.errLoad')))
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof api.createMirrorPolicy>[0]) => {
      if (editingPolicy) {
        return api.updateMirrorPolicy(editingPolicy.id, payload)
      }
      return api.createMirrorPolicy(payload)
    },
    onSuccess: () => {
      setSuccess(
        editingPolicy ? t('admin.mirrorPolicies.msgUpdated') : t('admin.mirrorPolicies.msgCreated'),
      )
      setError(null)
      setFormDialogOpen(false)
      setEditingPolicy(null)
      setFormData(defaultFormData)
      queryClient.invalidateQueries({ queryKey: queryKeys.policies._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.mirrorPolicies.errSave')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMirrorPolicy(id),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setPolicyToDelete(null)
      setSuccess(t('admin.mirrorPolicies.msgDeleted'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.policies._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.mirrorPolicies.errDelete')))
    },
  })

  const saving = saveMutation.isPending

  const handleSave = () => {
    setError(null)
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
    })
  }

  const handleDelete = () => {
    if (!policyToDelete) return
    setError(null)
    deleteMutation.mutate(policyToDelete.id)
  }

  const handleEvaluate = async () => {
    try {
      setEvaluating(true)
      setEvaluateResult(null)
      const result = await api.evaluateMirrorPolicy({
        registry: evaluateForm.registry,
        namespace: evaluateForm.namespace,
        provider: evaluateForm.provider,
      })
      setEvaluateResult(result)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('admin.mirrorPolicies.errEvaluate')))
    } finally {
      setEvaluating(false)
    }
  }

  const openEditDialog = (policy: MirrorPolicy) => {
    setEditingPolicy(policy)
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
    })
    setFormDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingPolicy(null)
    setFormData(defaultFormData)
    setFormDialogOpen(true)
  }

  const getPolicyTypeChip = (policyType: 'allow' | 'deny') => {
    if (policyType === 'allow') {
      return (
        <Chip
          label={t('admin.mirrorPolicies.chipAllow')}
          size="small"
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    }
    return (
      <Chip
        label={t('admin.mirrorPolicies.chipDeny')}
        size="small"
        color="error"
        icon={<BlockIcon />}
      />
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={loading} aria-live="polite">
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
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h4">{t('admin.mirrorPolicies.pageTitle')}</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t('admin.mirrorPolicies.pageSubtitle')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={t('admin.mirrorPolicies.tooltipEvaluate')}>
                <Button
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => {
                    setEvaluateForm({ registry: '', namespace: '', provider: '' })
                    setEvaluateResult(null)
                    setEvaluateDialogOpen(true)
                  }}
                >
                  {t('admin.mirrorPolicies.evaluate')}
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  loadPolicies()
                }}
              >
                {t('admin.mirrorPolicies.refresh')}
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                {t('admin.mirrorPolicies.createPolicy')}
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
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" sx={{ flex: 1, mr: 1 }}>
                        {policy.name}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 0.5,
                        }}
                      >
                        {getPolicyTypeChip(policy.policy_type)}
                        <Chip
                          label={
                            policy.is_active
                              ? t('admin.mirrorPolicies.chipActive')
                              : t('admin.mirrorPolicies.chipInactive')
                          }
                          size="small"
                          color={policy.is_active ? 'default' : 'default'}
                          variant={policy.is_active ? 'filled' : 'outlined'}
                        />
                      </Box>
                    </Box>

                    {policy.description && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{
                          marginBottom: '16px',
                        }}
                      >
                        {policy.description}
                      </Typography>
                    )}

                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mb: 1,
                      }}
                    >
                      {policy.upstream_registry && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('admin.mirrorPolicies.chipRegistry', {
                            value: policy.upstream_registry,
                          })}
                        />
                      )}
                      {policy.namespace_pattern && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('admin.mirrorPolicies.chipNamespace', {
                            value: policy.namespace_pattern,
                          })}
                        />
                      )}
                      {policy.provider_pattern && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('admin.mirrorPolicies.chipProvider', {
                            value: policy.provider_pattern,
                          })}
                        />
                      )}
                      {policy.requires_approval && (
                        <Chip
                          size="small"
                          color="warning"
                          label={t('admin.mirrorPolicies.chipRequiresApproval')}
                        />
                      )}
                    </Box>

                    {policy.priority !== undefined && policy.priority !== 0 && (
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{
                          display: 'block',
                        }}
                      >
                        {t('admin.mirrorPolicies.priority', { value: policy.priority })}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions>
                    <Tooltip title={t('admin.mirrorPolicies.tooltipEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('admin.mirrorPolicies.ariaEdit')}
                        onClick={() => openEditDialog(policy)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('admin.mirrorPolicies.tooltipDelete')}>
                      <IconButton
                        size="small"
                        aria-label={t('admin.mirrorPolicies.ariaDelete')}
                        color="error"
                        onClick={() => {
                          setPolicyToDelete(policy)
                          setDeleteDialogOpen(true)
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
                      {t('admin.mirrorPolicies.emptyState')}
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
              setFormDialogOpen(false)
              setEditingPolicy(null)
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingPolicy
                ? t('admin.mirrorPolicies.dialogTitleEdit')
                : t('admin.mirrorPolicies.dialogTitleCreate')}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={t('admin.mirrorPolicies.labelName')}
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  helperText={t('admin.mirrorPolicies.helpName')}
                />

                <TextField
                  label={t('admin.mirrorPolicies.labelDescription')}
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <FormControl fullWidth required>
                  <InputLabel>{t('admin.mirrorPolicies.labelPolicyType')}</InputLabel>
                  <Select
                    label={t('admin.mirrorPolicies.labelPolicyType')}
                    value={formData.policy_type}
                    onChange={(e) =>
                      setFormData({ ...formData, policy_type: e.target.value as 'allow' | 'deny' })
                    }
                  >
                    <MenuItem value="allow">{t('admin.mirrorPolicies.menuAllow')}</MenuItem>
                    <MenuItem value="deny">{t('admin.mirrorPolicies.menuDeny')}</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label={t('admin.mirrorPolicies.labelUpstreamRegistry')}
                  fullWidth
                  value={formData.upstream_registry}
                  onChange={(e) => setFormData({ ...formData, upstream_registry: e.target.value })}
                  helperText={t('admin.mirrorPolicies.helpUpstreamRegistry')}
                  placeholder="registry.terraform.io"
                />

                <TextField
                  label={t('admin.mirrorPolicies.labelNamespacePattern')}
                  fullWidth
                  value={formData.namespace_pattern}
                  onChange={(e) => setFormData({ ...formData, namespace_pattern: e.target.value })}
                  helperText={t('admin.mirrorPolicies.helpNamespacePattern')}
                />

                <TextField
                  label={t('admin.mirrorPolicies.labelProviderPattern')}
                  fullWidth
                  value={formData.provider_pattern}
                  onChange={(e) => setFormData({ ...formData, provider_pattern: e.target.value })}
                  helperText={t('admin.mirrorPolicies.helpProviderPattern')}
                />

                <TextField
                  label={t('admin.mirrorPolicies.labelPriority')}
                  type="number"
                  fullWidth
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                  }
                  helperText={t('admin.mirrorPolicies.helpPriority')}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label={t('admin.mirrorPolicies.labelActive')}
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
                  label={t('admin.mirrorPolicies.labelRequiresApproval')}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setFormDialogOpen(false)
                  setEditingPolicy(null)
                }}
                disabled={saving}
              >
                {t('admin.mirrorPolicies.cancel')}
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={!formData.name || saving}>
                {saving
                  ? t('admin.mirrorPolicies.saving')
                  : editingPolicy
                    ? t('admin.mirrorPolicies.update')
                    : t('admin.mirrorPolicies.create')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>{t('admin.mirrorPolicies.confirmDeleteTitle')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('admin.mirrorPolicies.confirmDeleteText', { name: policyToDelete?.name })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>
                {t('admin.mirrorPolicies.cancel')}
              </Button>
              <Button variant="contained" color="error" onClick={handleDelete}>
                {t('admin.mirrorPolicies.delete')}
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
            <DialogTitle>{t('admin.mirrorPolicies.dialogTitleEvaluate')}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('admin.mirrorPolicies.evaluateIntro')}
                </Typography>
                <TextField
                  label={t('admin.mirrorPolicies.labelRegistry')}
                  fullWidth
                  required
                  value={evaluateForm.registry}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, registry: e.target.value })}
                  placeholder="registry.terraform.io"
                />
                <TextField
                  label={t('admin.mirrorPolicies.labelNamespace')}
                  fullWidth
                  required
                  value={evaluateForm.namespace}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, namespace: e.target.value })}
                  placeholder="hashicorp"
                />
                <TextField
                  label={t('admin.mirrorPolicies.labelProvider')}
                  fullWidth
                  required
                  value={evaluateForm.provider}
                  onChange={(e) => setEvaluateForm({ ...evaluateForm, provider: e.target.value })}
                  placeholder="aws"
                />
                {evaluateResult && (
                  <Alert severity={evaluateResult.allowed ? 'success' : 'error'} sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>
                        {evaluateResult.allowed
                          ? t('admin.mirrorPolicies.resultAllowed')
                          : t('admin.mirrorPolicies.resultDenied')}
                      </strong>
                      {evaluateResult.matched_policy &&
                        t('admin.mirrorPolicies.resultMatchedPolicy', {
                          policy: evaluateResult.matched_policy,
                        })}
                      {evaluateResult.reason &&
                        t('admin.mirrorPolicies.resultReason', { reason: evaluateResult.reason })}
                    </Typography>
                  </Alert>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEvaluateDialogOpen(false)}>
                {t('admin.mirrorPolicies.close')}
              </Button>
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
                {evaluating
                  ? t('admin.mirrorPolicies.evaluating')
                  : t('admin.mirrorPolicies.evaluate')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  )
}

export default MirrorPoliciesPage
