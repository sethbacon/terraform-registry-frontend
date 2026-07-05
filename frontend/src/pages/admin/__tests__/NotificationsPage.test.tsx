import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getNotificationsConfigMock = vi.fn()
const saveNotificationsConfigMock = vi.fn()
const sendTestNotificationMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    getNotificationsConfig: (...args: unknown[]) => getNotificationsConfigMock(...args),
    saveNotificationsConfig: (...args: unknown[]) => saveNotificationsConfigMock(...args),
    sendTestNotification: (...args: unknown[]) => sendTestNotificationMock(...args),
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
  api_key_expiry_warning_days: 7,
  api_key_expiry_check_interval_hours: 24,
  password_configured: true,
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = ['admin']
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
})
