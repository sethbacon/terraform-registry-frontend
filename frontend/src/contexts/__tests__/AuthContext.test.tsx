import { render, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module
const mockApi = {
  getCurrentUserWithRole: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}

vi.mock('../../services/api', () => ({
  default: mockApi,
}))

// Helper component to access auth context values
function AuthConsumer({ onRender }: { onRender: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth()
  onRender(auth)
  return <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
}

// Clear all localStorage keys
function clearStorage() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    keys.push(localStorage.key(i))
  }
  keys.forEach((k) => { if (k) localStorage.removeItem(k) })
}

describe('AuthContext', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  it('throws when useAuth is called outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

    function BadConsumer() {
      useAuth()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow('useAuth must be used within an AuthProvider')
    consoleSpy.mockRestore()
  })

  it('starts with isAuthenticated false when no token is stored', () => {
    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    expect(authState!.isAuthenticated).toBe(false)
    expect(authState!.user).toBeNull()
  })

  it('logout clears all localStorage keys', () => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@test.com', name: 'Test', created_at: '', updated_at: '' }))
    localStorage.setItem('role_template', JSON.stringify({ name: 'admin', display_name: 'Admin' }))
    localStorage.setItem('allowed_scopes', JSON.stringify(['admin']))
    localStorage.setItem('authorized', 'some-swagger-key')

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => {
      authState!.logout()
    })

    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('role_template')).toBeNull()
    expect(localStorage.getItem('allowed_scopes')).toBeNull()
    expect(localStorage.getItem('authorized')).toBeNull()
  })

  it('setToken stores token and sets authenticated', () => {
    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => {
      authState!.setToken('new-token-value')
    })

    expect(localStorage.getItem('auth_token')).toBe('new-token-value')
    expect(authState!.isAuthenticated).toBe(true)
  })

  // ─── New tests: login flow ─────────────────────────────────────────────

  it('login with OIDC provider redirects via api.login()', () => {
    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => {
      authState!.login('oidc')
    })

    expect(mockApi.login).toHaveBeenCalledWith('oidc')
  })

  it('login with azuread provider redirects via api.login()', () => {
    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => {
      authState!.login('azuread')
    })

    expect(mockApi.login).toHaveBeenCalledWith('azuread')
  })

  it('login with user object (dev mode) sets authenticated and fetches user from API', async () => {
    const mockUser = { id: '1', email: 'dev@test.com', name: 'Dev User', created_at: '', updated_at: '' }
    mockApi.getCurrentUserWithRole.mockResolvedValueOnce({
      user: mockUser,
      role_template: { name: 'admin', display_name: 'Admin' },
      allowed_scopes: ['admin'],
    })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await act(async () => {
      await authState!.login(mockUser as any)
    })

    expect(authState!.isAuthenticated).toBe(true)
    expect(mockApi.getCurrentUserWithRole).toHaveBeenCalled()
    expect(authState!.user).toEqual(mockUser)
  })

  // ─── refreshToken flow ─────────────────────────────────────────────────

  it('refreshToken stores new token on success', async () => {
    mockApi.refreshToken.mockResolvedValueOnce({ token: 'refreshed-token' })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await act(async () => {
      await authState!.refreshToken()
    })

    expect(mockApi.refreshToken).toHaveBeenCalled()
    expect(localStorage.getItem('auth_token')).toBe('refreshed-token')
  })

  it('refreshToken calls logout on failure', async () => {
    mockApi.refreshToken.mockRejectedValueOnce(new Error('Token expired'))
    vi.spyOn(console, 'error').mockImplementation(() => { })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await act(async () => {
      await authState!.refreshToken()
    })

    // After failed refresh, user should be logged out
    expect(mockApi.logout).toHaveBeenCalled()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  // ─── fetchUser on mount ────────────────────────────────────────────────

  it('fetches user from API on mount when token and user exist in localStorage', async () => {
    const storedUser = { id: '1', email: 'stored@test.com', name: 'Stored', created_at: '', updated_at: '' }
    localStorage.setItem('auth_token', 'existing-token')
    localStorage.setItem('user', JSON.stringify(storedUser))

    const freshUser = { id: '1', email: 'fresh@test.com', name: 'Fresh', created_at: '', updated_at: '' }
    mockApi.getCurrentUserWithRole.mockResolvedValueOnce({
      user: freshUser,
      role_template: null,
      allowed_scopes: [],
    })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    // Initially uses stored user
    expect(authState!.isAuthenticated).toBe(true)

    // Refreshes from API
    await waitFor(() => {
      expect(mockApi.getCurrentUserWithRole).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(authState!.user?.email).toBe('fresh@test.com')
    })
  })

  it('fetches user from API on mount when only token exists (fresh OIDC login)', async () => {
    localStorage.setItem('auth_token', 'oidc-token')
    // No stored user

    const apiUser = { id: '2', email: 'oidc@test.com', name: 'OIDC User', created_at: '', updated_at: '' }
    mockApi.getCurrentUserWithRole.mockResolvedValueOnce({
      user: apiUser,
      role_template: null,
      allowed_scopes: ['modules:read'],
    })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockApi.getCurrentUserWithRole).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(authState!.user?.email).toBe('oidc@test.com')
    })
  })

  // ─── Expired token handling ────────────────────────────────────────────

  it('calls logout when fetchUser fails on mount (expired token)', async () => {
    localStorage.setItem('auth_token', 'expired-token')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'x@y.com', name: 'X', created_at: '', updated_at: '' }))
    vi.spyOn(console, 'error').mockImplementation(() => { })

    mockApi.getCurrentUserWithRole.mockRejectedValueOnce(new Error('401 Unauthorized'))

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockApi.getCurrentUserWithRole).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockApi.logout).toHaveBeenCalled()
    })
  })

  // ─── logout clears state ───────────────────────────────────────────────

  it('logout resets user, roleTemplate, allowedScopes and isAuthenticated', async () => {
    localStorage.setItem('auth_token', 'token')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' }))
    localStorage.setItem('role_template', JSON.stringify({ name: 'admin', display_name: 'Admin' }))
    localStorage.setItem('allowed_scopes', JSON.stringify(['admin']))

    mockApi.getCurrentUserWithRole.mockResolvedValueOnce({
      user: { id: '1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' },
      role_template: { name: 'admin', display_name: 'Admin' },
      allowed_scopes: ['admin'],
    })

    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(authState!.isAuthenticated).toBe(true)
    })

    act(() => {
      authState!.logout()
    })

    expect(authState!.user).toBeNull()
    expect(authState!.roleTemplate).toBeNull()
    expect(authState!.allowedScopes).toEqual([])
    expect(authState!.isAuthenticated).toBe(false)
    expect(mockApi.logout).toHaveBeenCalled()
  })
})
