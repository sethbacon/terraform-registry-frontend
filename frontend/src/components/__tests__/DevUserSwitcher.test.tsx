import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getDevStatusMock = vi.fn()
const listUsersForImpersonationMock = vi.fn()
const impersonateUserMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getDevStatus: (...args: unknown[]) => getDevStatusMock(...args),
    listUsersForImpersonation: (...args: unknown[]) => listUsersForImpersonationMock(...args),
    impersonateUser: (...args: unknown[]) => impersonateUserMock(...args),
  },
}))

const mockAuth = {
  isAuthenticated: true,
  user: { id: 'u1', email: 'admin@example.com', name: 'Admin', primary_role: 'admin' },
  currentUser: { id: 'u1', email: 'admin@example.com', name: 'Admin', role_template_name: 'admin' },
  allowedScopes: ['admin'],
  login: vi.fn(),
  logout: vi.fn(),
  setToken: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

import DevUserSwitcher from '../DevUserSwitcher'

describe('DevUserSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when dev mode is not enabled', async () => {
    getDevStatusMock.mockResolvedValue({ dev_mode: false })
    const { container } = render(<DevUserSwitcher />)
    await waitFor(() => {
      expect(getDevStatusMock).toHaveBeenCalled()
    })
    // Should render nothing in production mode
    expect(container.querySelector('[class*="Chip"]')).toBeNull()
  })

  it('renders DEV chip when dev mode is enabled', async () => {
    getDevStatusMock.mockResolvedValue({ dev_mode: true })
    listUsersForImpersonationMock.mockResolvedValue({ users: [] })
    render(<DevUserSwitcher />)
    await waitFor(() => {
      expect(screen.getByText(/DEV/)).toBeInTheDocument()
    })
  })

  it('renders nothing while loading', () => {
    getDevStatusMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DevUserSwitcher />)
    expect(container.innerHTML).toBe('')
  })

  it('renders user list when dev mode and users available', async () => {
    getDevStatusMock.mockResolvedValue({ dev_mode: true })
    listUsersForImpersonationMock.mockResolvedValue({
      users: [
        { id: 'u1', email: 'admin@example.com', name: 'Admin', primary_role: 'admin' },
        { id: 'u2', email: 'user@example.com', name: 'Regular User', primary_role: 'viewer' },
      ],
    })
    render(<DevUserSwitcher />)
    await waitFor(() => {
      expect(screen.getByText(/DEV/)).toBeInTheDocument()
    })
    // The Select should show the current user
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders nothing when dev status endpoint fails', async () => {
    getDevStatusMock.mockRejectedValue(new Error('Not found'))
    const { container } = render(<DevUserSwitcher />)
    await waitFor(() => {
      expect(getDevStatusMock).toHaveBeenCalled()
    })
    // Should render nothing when dev mode check fails
    expect(container.querySelector('[class*="Chip"]')).toBeNull()
  })

  it('shows select user placeholder when current user not in list', async () => {
    mockAuth.user = { id: 'u999', email: 'other@example.com', name: 'Other', primary_role: 'admin' }
    getDevStatusMock.mockResolvedValue({ dev_mode: true })
    listUsersForImpersonationMock.mockResolvedValue({
      users: [{ id: 'u1', email: 'admin@example.com', name: 'Admin', primary_role: 'admin' }],
    })
    render(<DevUserSwitcher />)
    await waitFor(() => {
      expect(screen.getByText(/DEV/)).toBeInTheDocument()
    })
    expect(screen.getByText('Select user')).toBeInTheDocument()
  })
})
