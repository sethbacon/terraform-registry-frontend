import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Notifications'
import ConfirmDialog from '../../components/ConfirmDialog'
import api from '../../services/api'
import { queryKeys } from '../../services/queryKeys'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import type {
  NotificationChannel,
  NotificationChannelEvent,
  NotificationChannelInput,
  NotificationEvents,
  NotificationsConfigInput,
} from '../../types'

const CHANNEL_EVENT_TYPES: NotificationChannelEvent[] = [
  'module_published',
  'approval_pending',
  'cve_detected',
  'scanner_update_available',
]

function apiErr(e: unknown, fallback: string): string {
  return getErrorMessage(e, fallback)
}

interface FormState {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  from: string
  use_tls: boolean
  recipients: string
  events: NotificationEvents
  api_key_expiry_warning_days: number
  api_key_expiry_check_interval_hours: number
}

const defaultEvents: NotificationEvents = {
  api_key_expiring: true,
  module_published: true,
  approval_pending: true,
  cve_detected: true,
  scanner_update_available: true,
}

const EVENT_TYPES: Array<keyof NotificationEvents> = [
  'api_key_expiring',
  'module_published',
  'approval_pending',
  'cve_detected',
  'scanner_update_available',
]

const defaultFormState: FormState = {
  enabled: false,
  host: '',
  port: 587,
  username: '',
  password: '',
  from: '',
  use_tls: true,
  recipients: '',
  events: defaultEvents,
  api_key_expiry_warning_days: 7,
  api_key_expiry_check_interval_hours: 24,
}

// ChannelsSection lists admin-configured notification channels (webhook,
// Slack, Microsoft Teams, or an ad-hoc email recipient list) for the
// module_published, approval_pending, cve_detected, and
// scanner_update_available events — additional delivery destinations
// alongside the shared SMTP recipients list above.
function ChannelsSection({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationChannel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NotificationChannel | null>(null)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const q = useQuery({ queryKey: queryKeys.notifications.channels(), queryFn: api.listNotificationChannels })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.channels() })

  const deleteMutation = useMutation({ mutationFn: api.deleteNotificationChannel, onSuccess: invalidate })
  const testMutation = useMutation({
    mutationFn: api.testNotificationChannel,
    onSuccess: () => {
      setNotice({ severity: 'success', text: t('admin.notifications.channels.testSent') })
      invalidate()
    },
    onError: (e) => setNotice({ severity: 'error', text: apiErr(e, t('admin.notifications.channels.testError')) }),
  })
  const toggleMutation = useMutation({
    mutationFn: ({ ch, enabled }: { ch: NotificationChannel; enabled: boolean }) =>
      api.updateNotificationChannel(ch.id, { name: ch.name, type: ch.type, events: ch.events, enabled }),
    onSuccess: invalidate,
    onError: (e) => setNotice({ severity: 'error', text: apiErr(e, t('admin.notifications.channels.saveError')) }),
  })

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {t('admin.notifications.channels.title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('admin.notifications.channels.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!isAdmin}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          {t('admin.notifications.channels.add')}
        </Button>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {q.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {q.isError && <Alert severity="error">{t('common.error')}</Alert>}
      {q.data && q.data.length === 0 && (
        <Alert severity="info">{t('admin.notifications.channels.noChannels')}</Alert>
      )}

      {q.data && q.data.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.notifications.channels.name')}</TableCell>
              <TableCell>{t('admin.notifications.channels.typeLabel')}</TableCell>
              <TableCell>{t('admin.notifications.channels.events')}</TableCell>
              <TableCell>{t('admin.notifications.channels.enabled')}</TableCell>
              <TableCell>{t('admin.notifications.channels.lastDelivery')}</TableCell>
              <TableCell align="right">{t('admin.notifications.channels.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {q.data.map((ch) => (
              <TableRow key={ch.id} hover>
                <TableCell>{ch.name}</TableCell>
                <TableCell>{t(`admin.notifications.channels.type.${ch.type}`)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {ch.events.length === 0 ? (
                      <Chip size="small" variant="outlined" label={t('admin.notifications.channels.allEvents')} />
                    ) : (
                      ch.events.map((e) => (
                        <Chip key={e} size="small" variant="outlined" label={t(`admin.notifications.event.${e}`)} />
                      ))
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Switch
                    size="small"
                    checked={ch.enabled}
                    disabled={!isAdmin}
                    onChange={(e) => toggleMutation.mutate({ ch, enabled: e.target.checked })}
                    slotProps={{ input: { 'aria-label': t('admin.notifications.channels.enabled') } }}
                  />
                </TableCell>
                <TableCell>
                  {ch.last_status ? (
                    <Chip
                      size="small"
                      color={ch.last_status === 'sent' ? 'success' : 'error'}
                      label={ch.last_status}
                    />
                  ) : (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {t('admin.notifications.channels.neverSent')}
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={t('admin.notifications.channels.test')}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!isAdmin || testMutation.isPending}
                        onClick={() => testMutation.mutate(ch.id)}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('common.edit')}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!isAdmin}
                        onClick={() => {
                          setEditing(ch)
                          setFormOpen(true)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('common.delete')}>
                    <span>
                      <IconButton size="small" color="error" disabled={!isAdmin} onClick={() => setDeleteTarget(ch)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ChannelFormDialog
        open={formOpen}
        channel={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t('admin.notifications.channels.deleteTitle')}
        severity="error"
        description={t('admin.notifications.channels.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </Paper>
  )
}

function ChannelFormDialog({
  open,
  channel,
  onClose,
  onSaved,
}: {
  open: boolean
  channel: NotificationChannel | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<NotificationChannel['type']>('webhook')
  const [target, setTarget] = useState('')
  const [events, setEvents] = useState<NotificationChannelEvent[]>([])
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seededFor, setSeededFor] = useState<string | null>(null)
  const seedKey = channel?.id ?? 'new'
  if (open && seededFor !== seedKey) {
    setSeededFor(seedKey)
    setError(null)
    setName(channel?.name ?? '')
    setType(channel?.type ?? 'webhook')
    setTarget('')
    setEvents(channel?.events ?? [])
    setEnabled(channel?.enabled ?? true)
  }
  if (!open && seededFor !== null) setSeededFor(null)

  const toggleEvent = (e: NotificationChannelEvent) =>
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))

  const mutation = useMutation({
    mutationFn: () => {
      const input: NotificationChannelInput = {
        name,
        type,
        events,
        enabled,
        target: target || undefined,
      }
      return channel ? api.updateNotificationChannel(channel.id, input) : api.createNotificationChannel(input)
    },
    onSuccess: onSaved,
    onError: (e) => setError(apiErr(e, t('admin.notifications.channels.saveError'))),
  })

  // On create the target is required; on edit a blank target keeps the existing one.
  const targetRequired = !channel
  const canSave = Boolean(name) && (!targetRequired || Boolean(target))
  const isEmail = type === 'email'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {channel ? t('admin.notifications.channels.edit') : t('admin.notifications.channels.add')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={t('admin.notifications.channels.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            size="small"
          />
          <TextField
            label={t('admin.notifications.channels.typeLabel')}
            value={type}
            onChange={(e) => setType(e.target.value as NotificationChannel['type'])}
            select
            fullWidth
            size="small"
          >
            <MenuItem value="webhook">{t('admin.notifications.channels.type.webhook')}</MenuItem>
            <MenuItem value="slack">{t('admin.notifications.channels.type.slack')}</MenuItem>
            <MenuItem value="teams">{t('admin.notifications.channels.type.teams')}</MenuItem>
            <MenuItem value="email">{t('admin.notifications.channels.type.email')}</MenuItem>
          </TextField>
          <TextField
            label={isEmail ? t('admin.notifications.channels.targetEmail') : t('admin.notifications.channels.target')}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required={targetRequired}
            fullWidth
            size="small"
            type={isEmail ? 'text' : 'url'}
            placeholder={isEmail ? 'ops@example.com, oncall@example.com' : 'https://'}
            helperText={
              channel
                ? isEmail
                  ? t('admin.notifications.channels.targetEmailKeep')
                  : t('admin.notifications.channels.targetKeep')
                : isEmail
                  ? t('admin.notifications.channels.targetEmailHelp')
                  : t('admin.notifications.channels.targetHelp')
            }
          />
          <Box>
            <FormGroup row>
              {CHANNEL_EVENT_TYPES.map((e) => (
                <FormControlLabel
                  key={e}
                  control={<Checkbox size="small" checked={events.includes(e)} onChange={() => toggleEvent(e)} />}
                  label={t(`admin.notifications.event.${e}`)}
                />
              ))}
            </FormGroup>
            <Box sx={{ color: 'text.secondary', fontSize: 12 }}>{t('admin.notifications.channels.eventsHelp')}</Box>
          </Box>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={t('admin.notifications.channels.enabled')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={mutation.isPending || !canSave} onClick={() => mutation.mutate()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const NotificationsPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  const isAdmin = allowedScopes.includes('admin')

  const {
    data: config,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.notifications.config(),
    queryFn: () => api.getNotificationsConfig(),
  })

  const [form, setForm] = useState<FormState>(defaultFormState)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testRecipients, setTestRecipients] = useState('')

  useEffect(() => {
    if (config) {
      setForm({
        enabled: config.enabled,
        host: config.smtp.host,
        port: config.smtp.port,
        username: config.smtp.username,
        password: '',
        from: config.smtp.from,
        use_tls: config.smtp.use_tls,
        recipients: config.recipients.join(', '),
        events: config.events,
        api_key_expiry_warning_days: config.api_key_expiry_warning_days,
        api_key_expiry_check_interval_hours: config.api_key_expiry_check_interval_hours,
      })
    }
  }, [config])

  if (queryError && !error) {
    setError(getErrorMessage(queryError, t('admin.notifications.loadError')))
  }

  const saveMutation = useMutation({
    mutationFn: (data: NotificationsConfigInput) => api.saveNotificationsConfig(data),
    onSuccess: () => {
      setSuccess(t('admin.notifications.saveSuccess'))
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications._def })
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.notifications.saveError')))
    },
  })

  const testMutation = useMutation({
    mutationFn: () =>
      api.sendTestNotification(
        testRecipients.trim()
          ? {
            recipients: testRecipients
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean),
          }
          : undefined,
      ),
    onSuccess: (data) => {
      if (data.success) {
        setSuccess(data.message || t('admin.notifications.testSuccess'))
        setError(null)
      } else {
        setError(data.message || t('admin.notifications.testError'))
      }
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, t('admin.notifications.testError')))
    },
  })

  const handleSave = () => {
    setError(null)
    saveMutation.mutate({
      enabled: form.enabled,
      smtp: {
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        from: form.from,
        use_tls: form.use_tls,
      },
      recipients: form.recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      events: form.events,
      api_key_expiry_warning_days: form.api_key_expiry_warning_days,
      api_key_expiry_check_interval_hours: form.api_key_expiry_check_interval_hours,
    })
  }

  const toggleEvent = (key: keyof NotificationEvents) =>
    setForm((f) => ({ ...f, events: { ...f.events, [key]: !f.events[key] } }))

  return (
    <Page maxWidth="md">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.notifications.pageTitle')}
        description={t('admin.notifications.pageSubtitle')}
      />
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error && !config ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Paper sx={{ p: 3, mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  disabled={!isAdmin}
                />
              }
              label={t('admin.notifications.enabled')}
            />

            <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>
              {t('admin.notifications.smtpSection')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label={t('admin.notifications.host')}
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('admin.notifications.port')}
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label={t('admin.notifications.username')}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="password"
                  label={t('admin.notifications.password')}
                  placeholder={t('admin.notifications.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={!isAdmin}
                  helperText={
                    config?.password_configured ? t('admin.notifications.passwordConfigured') : ''
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label={t('admin.notifications.from')}
                  value={form.from}
                  onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.use_tls}
                      onChange={(e) => setForm((f) => ({ ...f, use_tls: e.target.checked }))}
                      disabled={!isAdmin}
                    />
                  }
                  label={t('admin.notifications.useTls')}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
              {t('admin.notifications.apiKeyExpirySection')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('admin.notifications.warningDays')}
                  value={form.api_key_expiry_warning_days}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      api_key_expiry_warning_days: Number(e.target.value),
                    }))
                  }
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('admin.notifications.checkIntervalHours')}
                  value={form.api_key_expiry_check_interval_hours}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      api_key_expiry_check_interval_hours: Number(e.target.value),
                    }))
                  }
                  disabled={!isAdmin}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
              {t('admin.notifications.eventsSection')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TextField
              fullWidth
              label={t('admin.notifications.recipients')}
              helperText={t('admin.notifications.recipientsHelp')}
              value={form.recipients}
              onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
              disabled={!isAdmin}
              sx={{ mb: 2 }}
            />
            <FormGroup>
              {EVENT_TYPES.map((key) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={form.events[key]}
                      onChange={() => toggleEvent(key)}
                      disabled={!isAdmin}
                    />
                  }
                  label={t(`admin.notifications.event.${key}`)}
                />
              ))}
            </FormGroup>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                disabled={!isAdmin || saveMutation.isPending}
                onClick={handleSave}
              >
                {saveMutation.isPending ? <CircularProgress size={20} /> : t('admin.notifications.save')}
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('admin.notifications.test')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label={t('admin.notifications.testRecipients')}
                value={testRecipients}
                onChange={(e) => setTestRecipients(e.target.value)}
                disabled={!isAdmin}
                sx={{ minWidth: 300 }}
              />
              <Button
                variant="outlined"
                disabled={!isAdmin || testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? (
                  <CircularProgress size={20} />
                ) : (
                  t('admin.notifications.test')
                )}
              </Button>
            </Box>
          </Paper>

          <ChannelsSection isAdmin={isAdmin} />
        </>
      )}
    </Page>
  )
}

export default NotificationsPage
