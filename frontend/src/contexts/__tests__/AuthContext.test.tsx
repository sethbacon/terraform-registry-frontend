import { render, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth, parseTokenExpiry, SESSION_WARNING_LEAD_MS } from '../AuthContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module
const mockApi = vi.hoisted(() => ({
  getCurrentUserWithRole: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}))

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
    // By default, /auth/me returns no session (unauthenticated).
    // Individual tests override this when needed.
    mockApi.getCurrentUserWithRole.mockRejectedValue(new Error('Unauthorized'))
    mockApi.refreshToken.mockRejectedValue(new Error('Unauthorized'))
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

  it('starts with isAuthenticated false when no token is stored', async () => {
    let authState: ReturnType<typeof useAuth> | null = null

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    // Wait for the async /auth/me check to complete
    await waitFor(() => {
      expect(authState!.isLoading).toBe(false)
    })
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
    // First call: mount effect tries /auth/me (no session → reject).
    // Second call: dev-mode login calls fetchCurrentUser (succeeds).
    mockApi.getCurrentUserWithRole
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValueOnce({
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

    // Wait for mount effect to complete
    await waitFor(() => {
      expect(authState!.isLoading).toBe(false)
    })

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await authState!.login(mockUser as any)
    })

    expect(authState!.isAuthenticated).toBe(true)
    expect(mockApi.getCurrentUserWithRole).toHaveBeenCalledTimes(2)
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

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { void auth }} />
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

// Build a signature-less JWT with a specific exp (seconds since epoch).
function fakeJwt(expSec: number | 'invalid'): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (expSec === 'invalid') return 'not-a-jwt'
  const payload = btoa(JSON.stringify({ exp: expSec }))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${header}.${payload}.`
}

describe('AuthContext session expiry (roadmap 4.2)', () => {
  beforeEach(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k) }
    keys.forEach((k) => localStorage.removeItem(k))
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('parseTokenExpiry returns Date for valid token', () => {
    const exp = Math.floor(Date.now() / 1000) + 600
    const date = parseTokenExpiry(fakeJwt(exp))
    expect(date).toBeInstanceOf(Date)
    expect(Math.abs(date!.getTime() - exp * 1000)).toBeLessThan(1000)
  })

  it('parseTokenExpiry returns null for malformed token', () => {
    expect(parseTokenExpiry('not-a-jwt')).toBeNull()
    expect(parseTokenExpiry('')).toBeNull()
    expect(parseTokenExpiry(null)).toBeNull()
  })

  it('setToken parses expiry and schedules warning', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const exp = Math.floor(new Date('2026-01-01T00:10:00Z').getTime() / 1000) // 10min out

    let authState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => { authState!.setToken(fakeJwt(exp)) })
    expect(authState!.sessionExpiresAt).not.toBeNull()
    expect(authState!.sessionExpiresSoon).toBe(false)

    // Advance to just before the warning window.
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000 - SESSION_WARNING_LEAD_MS - 1) })
    expect(authState!.sessionExpiresSoon).toBe(false)

    // Cross the warning threshold — silent refresh fires and fails (default mock rejects),
    // then the catch handler sets sessionExpiresSoon = true.
    await act(async () => { vi.advanceTimersByTime(2) })
    expect(authState!.sessionExpiresSoon).toBe(true)
    vi.useRealTimers()
  })

  it('setToken with malformed JWT does not crash and leaves expiry null', () => {
    let authState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    act(() => { authState!.setToken('not-a-jwt') })
    expect(authState!.sessionExpiresAt).toBeNull()
    expect(authState!.sessionExpiresSoon).toBe(false)
  })

  it('setToken with already-expiring token flags sessionExpiresSoon immediately', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const exp = Math.floor(Date.now() / 1000) + 30 // 30s from now, inside window

    let authState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )

    // Silent refresh attempt fires immediately and fails (mock rejects),
    // then catch sets sessionExpiresSoon = true.
    await act(async () => { authState!.setToken(fakeJwt(exp)) })
    expect(authState!.sessionExpiresSoon).toBe(true)
    vi.useRealTimers()
  })

  it('logout clears sessionExpiresSoon and sessionExpiresAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const exp = Math.floor(Date.now() / 1000) + 30
    let authState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )
    await act(async () => { authState!.setToken(fakeJwt(exp)) })
    expect(authState!.sessionExpiresSoon).toBe(true)

    act(() => { authState!.logout() })
    expect(authState!.sessionExpiresAt).toBeNull()
    expect(authState!.sessionExpiresSoon).toBe(false)
    vi.useRealTimers()
  })

  it('refreshToken reschedules warning with the new expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const initialExp = Math.floor(Date.now() / 1000) + 30 // inside warning window
    const refreshedExp = Math.floor(Date.now() / 1000) + 10 * 60 // 10 min out

    // First call: silent refresh attempt on setToken (already-expiring). Let it reject
    // so sessionExpiresSoon is set. Second call: manual refresh with new token.
    mockApi.refreshToken
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValueOnce({ token: fakeJwt(refreshedExp) })

    let authState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => { authState = auth }} />
      </AuthProvider>
    )
    await act(async () => { authState!.setToken(fakeJwt(initialExp)) })
    expect(authState!.sessionExpiresSoon).toBe(true)

    await act(async () => { await authState!.refreshToken() })
    expect(authState!.sessionExpiresSoon).toBe(false)
    expect(authState!.sessionExpiresAt).not.toBeNull()
    vi.useRealTimers()
  })
})
