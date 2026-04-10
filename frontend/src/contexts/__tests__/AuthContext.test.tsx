import { render, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module
vi.mock('../../services/api', () => ({
  default: {
    getCurrentUserWithRole: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  },
}))

// Helper component to access auth context values
function AuthConsumer({ onRender }: { onRender: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth()
  onRender(auth)
  return <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
}

// Use the Storage constructor from the jsdom environment
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
    vi.restoreAllMocks()
  })

  it('throws when useAuth is called outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

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
})
