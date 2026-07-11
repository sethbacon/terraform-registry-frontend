import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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
    // Reset in case a previous test mutated the shared mock (e.g. "shows select
    // user placeholder" below reassigns mockAuth.user).
    mockAuth.user = { id: 'u1', email: 'admin@example.com', name: 'Admin', primary_role: 'admin' }
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

  it('selecting a user reloads on the backend cookie swap without touching localStorage', async () => {
    // Cookie-only auth (#467): impersonation swaps the HttpOnly auth cookie
    // server-side; the token-less response body must never be persisted to
    // localStorage — the reload alone picks up the new session via /auth/me.
    // vi.spyOn preserves the real Location object (see the CallbackPage
    // lesson: `{...window.location, reload: vi.fn()}` silently drops origin/href/
    // etc. because Location's props are prototype getters, not own properties).
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    localStorage.removeItem('auth_token')

    getDevStatusMock.mockResolvedValue({ dev_mode: true })
    listUsersForImpersonationMock.mockResolvedValue({
      users: [
        { id: 'u1', email: 'admin@example.com', name: 'Admin', primary_role: 'admin' },
        { id: 'u2', email: 'user@example.com', name: 'Regular User', primary_role: 'viewer' },
      ],
    })
    impersonateUserMock.mockResolvedValue({
      user: { id: 'u2', email: 'user@example.com', name: 'Regular User' },
      message: 'impersonation cookie set',
    })

    render(<DevUserSwitcher />)
    await waitFor(() => expect(screen.getByText(/DEV/)).toBeInTheDocument())

    fireEvent.mouseDown(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    fireEvent.click(within(listbox).getByText('Regular User'))

    await waitFor(() => expect(impersonateUserMock).toHaveBeenCalledWith('u2'))
    await waitFor(() => expect(reloadSpy).toHaveBeenCalled())
    // Nothing token-shaped may land in client-readable storage.
    expect(localStorage.getItem('auth_token')).toBeNull()
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
