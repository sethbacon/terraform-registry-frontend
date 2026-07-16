import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getNotificationsConfigMock = vi.fn()
const saveNotificationsConfigMock = vi.fn()
const sendTestNotificationMock = vi.fn()
const listNotificationChannelsMock = vi.fn()
const createNotificationChannelMock = vi.fn()
const updateNotificationChannelMock = vi.fn()
const deleteNotificationChannelMock = vi.fn()
const testNotificationChannelMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    getNotificationsConfig: (...args: unknown[]) => getNotificationsConfigMock(...args),
    saveNotificationsConfig: (...args: unknown[]) => saveNotificationsConfigMock(...args),
    sendTestNotification: (...args: unknown[]) => sendTestNotificationMock(...args),
    listNotificationChannels: (...args: unknown[]) => listNotificationChannelsMock(...args),
    createNotificationChannel: (...args: unknown[]) => createNotificationChannelMock(...args),
    updateNotificationChannel: (...args: unknown[]) => updateNotificationChannelMock(...args),
    deleteNotificationChannel: (...args: unknown[]) => deleteNotificationChannelMock(...args),
    testNotificationChannel: (...args: unknown[]) => testNotificationChannelMock(...args),
  },
}))

let mockAllowedScopes: string[] = ['admin']
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: mockAllowedScopes }),
}))

import NotificationsPage from '../../admin/NotificationsPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPage />
    </QueryClientProvider>,
  )
}

const fakeConfig = {
  enabled: true,
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    username: 'notify-user',
    from: 'notify@example.com',
    use_tls: true,
  },
  recipients: [] as string[],
  events: {
    api_key_expiring: true,
    module_published: true,
    approval_pending: true,
    cve_detected: true,
    scanner_update_available: true,
  },
  api_key_expiry_warning_days: 7,
  api_key_expiry_check_interval_hours: 24,
  password_configured: true,
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = ['admin']
    listNotificationChannelsMock.mockResolvedValue([])
  })

  it('renders SMTP fields from mocked config', async () => {
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    renderPage()
    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('587')).toBeInTheDocument()
    expect(screen.getByDisplayValue('notify-user')).toBeInTheDocument()
    expect(screen.getByDisplayValue('notify@example.com')).toBeInTheDocument()
  })

  it('shows "configured" helper when password_configured is true', async () => {
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('A password is currently configured')).toBeInTheDocument()
    })
  })

  it('calls saveNotificationsConfig on Save', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    saveNotificationsConfigMock.mockResolvedValue(fakeConfig)
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(saveNotificationsConfigMock).toHaveBeenCalled()
    })
  })

  it('shows a loading spinner while the config query is pending', () => {
    getNotificationsConfigMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows an error alert when the config query fails', async () => {
    getNotificationsConfigMock.mockRejectedValue(new Error('network down'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })
  })

  it('toggles the enabled and use_tls switches and edits SMTP fields', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    const enabledSwitch = screen.getByRole('switch', { name: 'Enable notifications' })
    expect(enabledSwitch).toBeChecked()
    await user.click(enabledSwitch)
    expect(enabledSwitch).not.toBeChecked()

    const useTlsSwitch = screen.getByRole('switch', { name: 'Use TLS' })
    expect(useTlsSwitch).toBeChecked()
    await user.click(useTlsSwitch)
    expect(useTlsSwitch).not.toBeChecked()

    const hostField = screen.getByLabelText('Host')
    await user.clear(hostField)
    await user.type(hostField, 'smtp.new-host.com')
    expect(screen.getByDisplayValue('smtp.new-host.com')).toBeInTheDocument()

    const portField = screen.getByLabelText('Port')
    await user.clear(portField)
    await user.type(portField, '2525')
    expect(screen.getByDisplayValue('2525')).toBeInTheDocument()
  })

  it('saves with an empty password when the password field is left blank', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    saveNotificationsConfigMock.mockResolvedValue(fakeConfig)
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(saveNotificationsConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          smtp: expect.objectContaining({ password: '' }),
        }),
      )
    })
    expect(await screen.findByText('Notification settings saved')).toBeInTheDocument()
  })

  it('shows an error alert when the save mutation fails', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    saveNotificationsConfigMock.mockRejectedValue(new Error('save failed'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('save failed')).toBeInTheDocument()
  })

  it('sends a test notification with parsed recipients on success', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    sendTestNotificationMock.mockResolvedValue({
      success: true,
      message: 'Test email sent successfully',
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.type(
      screen.getByLabelText('Recipients (comma-separated, optional)'),
      'a@example.com, b@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Send Test Email' }))

    await waitFor(() => {
      expect(sendTestNotificationMock).toHaveBeenCalledWith({
        recipients: ['a@example.com', 'b@example.com'],
      })
    })
    expect(await screen.findByText('Test email sent successfully')).toBeInTheDocument()
  })

  it('sends a test notification with no recipients when the field is blank', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    sendTestNotificationMock.mockResolvedValue({ success: true, message: 'sent' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }))

    await waitFor(() => {
      expect(sendTestNotificationMock).toHaveBeenCalledWith(undefined)
    })
  })

  it('shows an error alert when the test result reports failure', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    sendTestNotificationMock.mockResolvedValue({ success: false, message: 'SMTP rejected' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }))

    expect(await screen.findByText('SMTP rejected')).toBeInTheDocument()
  })

  it('shows an error alert when the test mutation throws', async () => {
    const user = userEvent.setup()
    getNotificationsConfigMock.mockResolvedValue(fakeConfig)
    sendTestNotificationMock.mockRejectedValue(new Error('connection refused'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }))

    expect(await screen.findByText('connection refused')).toBeInTheDocument()
  })

  describe('non-admin gating', () => {
    beforeEach(() => {
      mockAllowedScopes = []
    })

    it('disables Save and Test controls for non-admin users', async () => {
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      renderPage()

      await waitFor(() => {
        expect(screen.getByDisplayValue('smtp.example.com')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Send Test Email' })).toBeDisabled()
      expect(screen.getByRole('switch', { name: 'Enable notifications' })).toBeDisabled()
      expect(screen.getByLabelText('Host')).toBeDisabled()
    })
  })

  describe('notification channels', () => {
    const channel = {
      id: 'c1',
      name: 'ops-slack',
      type: 'slack',
      has_target: true,
      events: ['cve_detected'],
      enabled: true,
      last_status: 'sent',
      last_error: null,
      last_sent_at: '2026-07-01T00:00:00Z',
      created_at: '2026-06-01',
      updated_at: '2026-06-10',
    }

    it('lists channels with event chips and delivery status', async () => {
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      listNotificationChannelsMock.mockResolvedValue([channel])
      renderPage()

      const row = await screen.findByRole('row', { name: /ops-slack/ })
      expect(within(row).getByText('CVE detected')).toBeInTheDocument()
      expect(within(row).getByText('sent')).toBeInTheDocument()
    })

    it('shows the empty hint when no channels exist', async () => {
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      listNotificationChannelsMock.mockResolvedValue([])
      renderPage()

      expect(
        await screen.findByText('No notification channels yet. Add one to receive alerts.'),
      ).toBeInTheDocument()
    })

    it('creates a webhook channel with selected events', async () => {
      const user = userEvent.setup()
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      listNotificationChannelsMock.mockResolvedValue([])
      createNotificationChannelMock.mockResolvedValue({ ...channel, type: 'webhook' })
      renderPage()

      await screen.findByText('No notification channels yet. Add one to receive alerts.')

      await user.click(screen.getByRole('button', { name: 'Add channel' }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Name', { exact: false }), 'ops-webhook')
      await user.type(
        within(dialog).getByLabelText('Destination URL', { exact: false }),
        'https://example.com/hook',
      )
      await user.click(within(dialog).getByLabelText('CVE detected'))
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(createNotificationChannelMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'ops-webhook',
            type: 'webhook',
            target: 'https://example.com/hook',
            events: ['cve_detected'],
          }),
        )
      })
    })

    it('sends a test notification through a channel', async () => {
      const user = userEvent.setup()
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      listNotificationChannelsMock.mockResolvedValue([channel])
      testNotificationChannelMock.mockResolvedValue({ status: 'sent' })
      renderPage()

      const row = await screen.findByRole('row', { name: /ops-slack/ })
      const [sendButton] = within(row).getAllByRole('button')
      await user.click(sendButton)

      await waitFor(() => expect(testNotificationChannelMock).toHaveBeenCalledWith('c1', expect.anything()))
      expect(await screen.findByText('Test notification sent.')).toBeInTheDocument()
    })

    it('deletes a channel after confirmation', async () => {
      const user = userEvent.setup()
      getNotificationsConfigMock.mockResolvedValue(fakeConfig)
      listNotificationChannelsMock.mockResolvedValue([channel])
      deleteNotificationChannelMock.mockResolvedValue(undefined)
      renderPage()

      const row = await screen.findByRole('row', { name: /ops-slack/ })
      const rowButtons = within(row).getAllByRole('button')
      await user.click(rowButtons[rowButtons.length - 1])
      await user.click(await screen.findByTestId('confirm-dialog-confirm'))

      await waitFor(() => expect(deleteNotificationChannelMock).toHaveBeenCalledWith('c1', expect.anything()))
    })
  })
})
