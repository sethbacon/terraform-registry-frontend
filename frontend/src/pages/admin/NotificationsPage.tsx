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
} from '@mui/material'
import { NotificationChannelsSection, type NotificationChannelTypeOption } from '@sethbacon/terraform-suite-ui'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Notifications'
import api from '../../services/api'
import { queryKeys } from '../../services/queryKeys'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import type {
  NotificationChannelEvent,
  NotificationChannelInput,
  NotificationChannelType,
  NotificationEvents,
  NotificationsConfigInput,
} from '../../types'

const CHANNEL_EVENT_TYPES: NotificationChannelEvent[] = [
  'module_published',
  'approval_pending',
  'cve_detected',
  'scanner_update_available',
]

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
// alongside the shared SMTP recipients list above. Rendered via the shared
// @sethbacon/terraform-suite-ui NotificationChannelsSection component.
const CHANNEL_TYPE_OPTIONS: NotificationChannelTypeOption[] = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'slack', label: 'Slack' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'email', label: 'Email', isEmail: true },
]

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
        recipients: (config.recipients ?? []).join(', '),
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

  const channelsQuery = useQuery({
    queryKey: queryKeys.notifications.channels(),
    queryFn: api.listNotificationChannels,
  })
  const invalidateChannels = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.channels() })
  const channelEventOptions = CHANNEL_EVENT_TYPES.map((e) => ({ value: e, label: t(`admin.notifications.event.${e}`) }))

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

          <NotificationChannelsSection
            channels={channelsQuery.data ?? []}
            isLoading={channelsQuery.isLoading}
            isError={channelsQuery.isError}
            canManage={isAdmin}
            channelTypes={CHANNEL_TYPE_OPTIONS}
            eventOptions={channelEventOptions}
            onCreate={async (input) => {
              await api.createNotificationChannel(input as NotificationChannelInput)
              invalidateChannels()
            }}
            onUpdate={async (id, input) => {
              await api.updateNotificationChannel(id, input as NotificationChannelInput)
              invalidateChannels()
            }}
            onDelete={async (id) => {
              await api.deleteNotificationChannel(id)
              invalidateChannels()
            }}
            onTest={async (id) => {
              await api.testNotificationChannel(id)
              invalidateChannels()
            }}
            onToggleEnabled={async (channel, enabled) => {
              await api.updateNotificationChannel(channel.id, {
                name: channel.name,
                type: channel.type as NotificationChannelType,
                events: channel.events as NotificationChannelEvent[],
                enabled,
              })
              invalidateChannels()
            }}
          />
        </>
      )}
    </Page>
  )
}

export default NotificationsPage
