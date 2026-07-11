import { render, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AUTH_STORAGE_KEYS } from '../../utils/authStorage'

// Mock the api module (default export) that the AuthProvider adapter injects.
const mockApi = vi.hoisted(() => ({
  getCurrentUserWithRole: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  devLogin: vi.fn(),
  ldapLogin: vi.fn(),
}))

vi.mock('../../services/api', () => ({ default: mockApi }))

const me = {
  user: { id: 'u1', email: 'a@b.c', name: 'Alice' },
  role_template: { name: 'admin', display_name: 'Admin', scopes: ['admin'] },
  allowed_scopes: ['modules:read'],
  session_expires_at: null as string | null,
}

let latest: ReturnType<typeof useAuth>
function Consumer() {
  latest = useAuth()
  return <div data-testid="auth">{String(latest.isAuthenticated)}</div>
}

async function renderAuth() {
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  )
  await waitFor(() => expect(latest.isLoading).toBe(false))
}

beforeEach(() => {
  AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k))
  vi.clearAllMocks()
})

describe('AuthProvider', () => {
  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
    expect(() => render(<Consumer />)).toThrow(/within an AuthProvider/)
    spy.mockRestore()
  })

  it('resolves the session from /me on mount', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    await renderAuth()
    expect(latest.isAuthenticated).toBe(true)
    expect(latest.user?.email).toBe('a@b.c')
    expect(latest.allowedScopes).toEqual(['modules:read'])
    expect(latest.roleTemplate?.name).toBe('admin')
  })

  it('stays anonymous when /me fails', async () => {
    mockApi.getCurrentUserWithRole.mockRejectedValue(new Error('401'))
    await renderAuth()
    expect(latest.isAuthenticated).toBe(false)
    expect(latest.user).toBeNull()
    expect(latest.allowedScopes).toEqual([])
  })

  it('hasScope honours exact scopes and the admin wildcard', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue({ ...me, allowed_scopes: ['admin'] })
    await renderAuth()
    expect(latest.hasScope('modules:write')).toBe(true)
  })

  it('flags an already-expired session immediately', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue({
      ...me,
      session_expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    await renderAuth()
    expect(latest.sessionExpiresSoon).toBe(true)
  })

  it('devLogin establishes a cookie session then re-resolves the user (no localStorage write)', async () => {
    mockApi.getCurrentUserWithRole.mockRejectedValueOnce(new Error('401'))
    // Token-less body (#467): the backend sets the HttpOnly cookie via Set-Cookie.
    mockApi.devLogin.mockResolvedValue({ user: {}, expires_in: 3600 })
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    await renderAuth()
    expect(latest.isAuthenticated).toBe(false)
    await act(() => latest.devLogin())
    expect(mockApi.devLogin).toHaveBeenCalled()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(latest.isAuthenticated).toBe(true)
  })

  it('ldapLogin posts credentials then re-resolves the user (no localStorage write)', async () => {
    mockApi.getCurrentUserWithRole.mockRejectedValueOnce(new Error('401'))
    mockApi.ldapLogin.mockResolvedValue(undefined)
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    await renderAuth()
    await act(() => latest.ldapLogin('alice', 'secret'))
    expect(mockApi.ldapLogin).toHaveBeenCalledWith('alice', 'secret')
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(latest.isAuthenticated).toBe(true)
  })

  it('login delegates to the full-page OAuth redirect', async () => {
    mockApi.getCurrentUserWithRole.mockRejectedValue(new Error('401'))
    await renderAuth()
    act(() => latest.login('saml'))
    expect(mockApi.login).toHaveBeenCalledWith('saml')
  })

  it('logout clears cached storage and redirects', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    localStorage.setItem('user', 'cached')
    await renderAuth()
    act(() => latest.logout())
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockApi.logout).toHaveBeenCalled()
  })

  it('refreshSession failure signs the user out cleanly', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    mockApi.refreshToken.mockRejectedValue(new Error('expired'))
    await renderAuth()
    await act(() => latest.refreshSession())
    expect(mockApi.logout).toHaveBeenCalled()
  })

  it('refreshSession success keeps the session alive', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    mockApi.refreshToken.mockResolvedValue({ expires_in: 3600 })
    await renderAuth()
    await act(() => latest.refreshSession())
    expect(latest.isAuthenticated).toBe(true)
    expect(mockApi.logout).not.toHaveBeenCalled()
  })
})
