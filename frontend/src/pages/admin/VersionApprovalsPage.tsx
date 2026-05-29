import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import VerifiedIcon from '@mui/icons-material/Verified'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import api from '../../services/api'
import { queryKeys } from '../../services/queryKeys'
import { getErrorMessage } from '../../utils/errors'
import { formatDate } from '../../utils'
import type {
  VersionApproval,
  VersionApprovalStatus,
  VersionApprovalEvent,
} from '../../types/version_approval'

// ──────────────────────────────────────────────────────────────────────────────
// Sub-component: status chip
// ──────────────────────────────────────────────────────────────────────────────

function ApprovalStatusChip({ status }: { status: VersionApprovalStatus | null | undefined }) {
  const { t } = useTranslation()
  if (!status) return null
  switch (status) {
    case 'approved':
      return (
        <Chip
          label={t('admin.versionApprovals.statusApproved')}
          size="small"
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    case 'rejected':
      return (
        <Chip
          label={t('admin.versionApprovals.statusRejected')}
          size="small"
          color="error"
          icon={<CancelIcon />}
        />
      )
    case 'pending_approval':
    default:
      return (
        <Chip
          label={t('admin.versionApprovals.statusPendingApproval')}
          size="small"
          color="warning"
          icon={<HourglassEmptyIcon />}
        />
      )
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-component: expandable audit trail row
// ──────────────────────────────────────────────────────────────────────────────

function EventsRow({ id, open }: { id: string; open: boolean }) {
  const { t } = useTranslation()
  const { data: events = [], isLoading } = useQuery<VersionApprovalEvent[]>({
    queryKey: queryKeys.versionApprovals.events(id),
    queryFn: () => api.getVersionApprovalEvents(id),
    enabled: open,
  })

  return (
    <TableRow>
      <TableCell colSpan={8} sx={{ py: 0 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ px: 4, py: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {t('admin.versionApprovals.auditTrail')}
            </Typography>
            {isLoading ? (
              <CircularProgress size={16} sx={{ ml: 1 }} />
            ) : events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('admin.versionApprovals.noEvents')}
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {events.map((ev) => (
                  <Typography key={ev.id} component="li" variant="body2">
                    <strong>{ev.action}</strong>
                    {ev.performed_by_name &&
                      ' ' + t('admin.versionApprovals.performedBy', { name: ev.performed_by_name })}
                    {ev.auto_approve_rule &&
                      ' — ' + t('admin.versionApprovals.autoApproveRule', { rule: ev.auto_approve_rule })}
                    {ev.notes && ` — "${ev.notes}"`}
                    {' · ' + formatDate(ev.created_at)}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-component: single table row
// ──────────────────────────────────────────────────────────────────────────────

function VersionRow({
  item,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
}: {
  item: VersionApproval
  selected: boolean
  onToggleSelect: () => void
  onApprove: (item: VersionApproval) => void
  onReject: (item: VersionApproval) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow hover>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onChange={onToggleSelect} size="small" />
        </TableCell>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="expand row">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {item.version}
          </Typography>
        </TableCell>
        <TableCell>
          {item.type === 'provider' ? (
            <Typography variant="body2">
              {item.provider_namespace}/{item.provider_name}
            </Typography>
          ) : (
            <Chip label="Terraform" size="small" variant="outlined" />
          )}
        </TableCell>
        <TableCell>
          <Typography variant="body2">{item.mirror_config_name}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{formatDate(item.synced_at)}</Typography>
        </TableCell>
        <TableCell>
          {item.gpg_verified && (
            <Tooltip title="GPG verified">
              <VerifiedIcon fontSize="small" color="success" titleAccess="GPG verified" />
            </Tooltip>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <ApprovalStatusChip status={item.approval_status} />
            {item.approval_status === 'pending_approval' && (
              <>
                <Button
                  size="small"
                  color="success"
                  variant="outlined"
                  onClick={() => onApprove(item)}
                >
                  {t('admin.versionApprovals.approve')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={() => onReject(item)}
                >
                  {t('admin.versionApprovals.reject')}
                </Button>
              </>
            )}
          </Box>
        </TableCell>
      </TableRow>
      <EventsRow id={item.id} open={open} />
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ label: string; value: VersionApprovalStatus | '' }> = [
  { label: 'admin.versionApprovals.pending', value: 'pending_approval' },
  { label: 'admin.versionApprovals.approved', value: 'approved' },
  { label: 'admin.versionApprovals.rejected', value: 'rejected' },
]

const VersionApprovalsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [statusTab, setStatusTab] = useState<VersionApprovalStatus | ''>('pending_approval')
  const [typeFilter, setTypeFilter] = useState<'provider' | 'terraform' | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Single approve/reject dialog
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    mode: 'approve' | 'reject'
    item: VersionApproval | null
    notes: string
  }>({ open: false, mode: 'approve', item: null, notes: '' })

  // Bulk dialog
  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean
    mode: 'approve' | 'reject'
    notes: string
  }>({ open: false, mode: 'approve', notes: '' })

  const queryParams = {
    status: statusTab || undefined,
    type: typeFilter || undefined,
  }

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.versionApprovals.list(queryParams),
    queryFn: () => api.listVersionApprovals(queryParams),
  })

  const items: VersionApproval[] = data?.items ?? []

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.versionApprovals.errLoad')))
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.versionApprovals._def })
    setSelected(new Set())
  }

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.approveVersion(id, notes ? { notes } : undefined),
    onSuccess: () => {
      setSuccess(t('admin.versionApprovals.approveSuccess'))
      setError(null)
      setActionDialog((d) => ({ ...d, open: false }))
      invalidate()
    },
    onError: (err: unknown) => {
      setActionDialog((d) => ({ ...d, open: false }))
      setError(getErrorMessage(err, t('admin.versionApprovals.errApprove')))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.rejectVersion(id, notes ? { notes } : undefined),
    onSuccess: () => {
      setSuccess(t('admin.versionApprovals.rejectSuccess'))
      setError(null)
      setActionDialog((d) => ({ ...d, open: false }))
      invalidate()
    },
    onError: (err: unknown) => {
      setActionDialog((d) => ({ ...d, open: false }))
      setError(getErrorMessage(err, t('admin.versionApprovals.errReject')))
    },
  })

  const bulkApproveMutation = useMutation({
    mutationFn: ({ ids, notes }: { ids: string[]; notes?: string }) =>
      api.bulkApproveVersions(ids, notes),
    onSuccess: (res) => {
      setSuccess(t('admin.versionApprovals.bulkApproveSuccess', { count: res.approved ?? 0 }))
      setError(null)
      setBulkDialog((d) => ({ ...d, open: false }))
      invalidate()
    },
    onError: (err: unknown) =>
      setError(getErrorMessage(err, t('admin.versionApprovals.errBulkApprove'))),
  })

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, notes }: { ids: string[]; notes?: string }) =>
      api.bulkRejectVersions(ids, notes),
    onSuccess: (res) => {
      setSuccess(t('admin.versionApprovals.bulkRejectSuccess', { count: res.rejected ?? 0 }))
      setError(null)
      setBulkDialog((d) => ({ ...d, open: false }))
      invalidate()
    },
    onError: (err: unknown) =>
      setError(getErrorMessage(err, t('admin.versionApprovals.errBulkReject'))),
  })

  const allSelected = items.length > 0 && selected.size === items.length
  const someSelected = selected.size > 0 && selected.size < items.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openActionDialog = (mode: 'approve' | 'reject', item: VersionApproval) => {
    setActionDialog({ open: true, mode, item, notes: '' })
  }

  const handleActionConfirm = () => {
    if (!actionDialog.item) return
    const notes = actionDialog.notes || undefined
    if (actionDialog.mode === 'approve') {
      approveMutation.mutate({ id: actionDialog.item.id, notes })
    } else {
      rejectMutation.mutate({ id: actionDialog.item.id, notes })
    }
  }

  const handleBulkConfirm = () => {
    const ids = Array.from(selected)
    const notes = bulkDialog.notes || undefined
    if (bulkDialog.mode === 'approve') {
      bulkApproveMutation.mutate({ ids, notes })
    } else {
      bulkRejectMutation.mutate({ ids, notes })
    }
  }

  const actionPending = approveMutation.isPending || rejectMutation.isPending
  const bulkPending = bulkApproveMutation.isPending || bulkRejectMutation.isPending

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} aria-busy={isLoading} aria-live="polite">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">{t('admin.versionApprovals.pageTitle')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('admin.versionApprovals.pageSubtitle')}
        </Typography>
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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Tabs
          value={statusTab}
          onChange={(_, v) => {
            setStatusTab(v)
            setSelected(new Set())
          }}
        >
          {STATUS_TABS.map((tab) => (
            <Tab key={tab.value} label={t(tab.label)} value={tab.value} />
          ))}
        </Tabs>

        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={(_, v) => setTypeFilter(v ?? '')}
          size="small"
        >
          <ToggleButton value="">{t('admin.versionApprovals.allTypes')}</ToggleButton>
          <ToggleButton value="provider">
            {t('admin.versionApprovals.providerVersions')}
          </ToggleButton>
          <ToggleButton value="terraform">
            {t('admin.versionApprovals.terraformVersions')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {selected.size > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={() => setBulkDialog({ open: true, mode: 'approve', notes: '' })}
          >
            {t('admin.versionApprovals.bulkApprove')} ({selected.size})
          </Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<CancelIcon />}
            onClick={() => setBulkDialog({ open: true, mode: 'reject', notes: '' })}
          >
            {t('admin.versionApprovals.bulkReject')} ({selected.size})
          </Button>
        </Box>
      )}

      <Paper variant="outlined">
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    size="small"
                  />
                </TableCell>
                <TableCell />
                <TableCell>{t('admin.versionApprovals.thVersion')}</TableCell>
                <TableCell>{t('admin.versionApprovals.thType')}</TableCell>
                <TableCell>{t('admin.versionApprovals.thMirrorConfig')}</TableCell>
                <TableCell>{t('admin.versionApprovals.thSyncedAt')}</TableCell>
                <TableCell>{t('admin.versionApprovals.thGpgStatus')}</TableCell>
                <TableCell>{t('admin.versionApprovals.thActions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.versionApprovals.noVersions')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <VersionRow
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onToggleSelect={() => toggleOne(item.id)}
                    onApprove={(i) => openActionDialog('approve', i)}
                    onReject={(i) => openActionDialog('reject', i)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Single action dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={() => setActionDialog((d) => ({ ...d, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.mode === 'approve'
            ? t('admin.versionApprovals.confirmApproveTitle')
            : t('admin.versionApprovals.confirmRejectTitle')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">
              {actionDialog.mode === 'approve'
                ? t('admin.versionApprovals.confirmApproveBody')
                : t('admin.versionApprovals.confirmRejectBody')}
            </Typography>
            <TextField
              label={t('admin.versionApprovals.notes')}
              fullWidth
              multiline
              rows={2}
              value={actionDialog.notes}
              onChange={(e) => setActionDialog((d) => ({ ...d, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setActionDialog((d) => ({ ...d, open: false }))}
            disabled={actionPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionDialog.mode === 'approve' ? 'success' : 'error'}
            onClick={handleActionConfirm}
            disabled={actionPending}
          >
            {actionPending ? (
              <CircularProgress size={20} />
            ) : actionDialog.mode === 'approve' ? (
              t('admin.versionApprovals.approve')
            ) : (
              t('admin.versionApprovals.reject')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk action dialog */}
      <Dialog
        open={bulkDialog.open}
        onClose={() => setBulkDialog((d) => ({ ...d, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {bulkDialog.mode === 'approve'
            ? t('admin.versionApprovals.confirmBulkApproveTitle', { count: selected.size })
            : t('admin.versionApprovals.confirmBulkRejectTitle', { count: selected.size })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label={t('admin.versionApprovals.notes')}
              fullWidth
              multiline
              rows={2}
              value={bulkDialog.notes}
              onChange={(e) => setBulkDialog((d) => ({ ...d, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBulkDialog((d) => ({ ...d, open: false }))}
            disabled={bulkPending}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={bulkDialog.mode === 'approve' ? 'success' : 'error'}
            onClick={handleBulkConfirm}
            disabled={bulkPending}
          >
            {bulkPending ? (
              <CircularProgress size={20} />
            ) : bulkDialog.mode === 'approve' ? (
              t('admin.versionApprovals.bulkApprove')
            ) : (
              t('admin.versionApprovals.bulkReject')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default VersionApprovalsPage
