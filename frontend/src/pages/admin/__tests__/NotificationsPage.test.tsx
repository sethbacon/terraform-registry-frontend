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

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: ['admin'] }),
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
})
