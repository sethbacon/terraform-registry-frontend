import { render, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth, toSuiteMemberships } from '../AuthContext'
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
// devLogin is dynamically imported from devApi directly (not the barrel above,
// which deliberately excludes it) so the dev-only endpoint is dead-code-eliminated
// from the production bundle (#608) — mock that import target too.
vi.mock('../../services/api/devApi', () => ({ devLogin: () => mockApi.devLogin() }))

// Shaped like MeHandler's actual payload: a nested `role_template` object per
// membership (nullable), plus the deprecated flat `role_template` back-compat
// field the endpoint still sends. Since #795 the provider derives everything
// from `memberships`; the back-compat field is here so the fixture stays
// faithful to the wire, not because anything reads it.
const me = {
  user: { id: 'u1', email: 'a@b.c', name: 'Alice' },
  role_template: { name: 'admin', display_name: 'Admin', scopes: ['admin'] },
  memberships: [
    {
      organization_id: 'org-1',
      organization_name: 'acme',
      created_at: '2025-01-01T00:00:00Z',
      role_template: {
        id: 'rt-1',
        name: 'admin',
        display_name: 'Administrator',
        scopes: ['admin'],
      },
    },
  ],
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

  it('ends an already-expired session immediately rather than warning about it', async () => {
    // @4cloudguru/cloud-suite-ui 0.8.1 changed this to fail closed: a session
    // already past its expiry when /me resolves is ENDED, not flagged with
    // sessionExpiresSoon. Warning about a session the client already knows is dead
    // leaves the UI rendered against it until the user acts on the warning, so the
    // assertion here is that authentication is gone -- sessionExpiresSoon staying
    // false is the point, not an omission.
    mockApi.getCurrentUserWithRole.mockResolvedValue({
      ...me,
      session_expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    await renderAuth()
    await waitFor(() => expect(latest.isAuthenticated).toBe(false))
    expect(latest.user).toBeNull()
    expect(latest.allowedScopes).toEqual([])
    expect(latest.sessionExpiresSoon).toBe(false)
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

// Replaces the toSyntheticMemberships suite that guarded the #622 sentinel.
// The sentinel existed because the app had no real memberships to publish; it
// has them now, so the guards move from "the fake value is obviously fake" to
// "the real value survives the mapping intact and nothing is invented".
describe('toSuiteMemberships (#795)', () => {
  it('returns an empty array when there are no memberships', () => {
    expect(toSuiteMemberships([])).toEqual([])
  })

  it("flattens the handler's NESTED role_template onto the shared contract", () => {
    // The nested object is what MeHandler emits. The flat role_template_* keys
    // declared by the backend's admin.MeMembershipEntry struct (and therefore
    // by swagger.yaml) are never marshalled by any code path — reading those
    // instead would yield undefined for every role field.
    const [membership] = toSuiteMemberships([
      {
        organization_id: 'org-1',
        organization_name: 'acme',
        created_at: '2025-01-01T00:00:00Z',
        role_template: { id: 'rt-1', name: 'admin', display_name: 'Administrator', scopes: ['a'] },
      },
    ])
    expect(membership.organization_id).toBe('org-1')
    expect(membership.organization_name).toBe('acme')
    expect(membership.role_template_name).toBe('admin')
    expect(membership.role_template_scopes).toEqual(['a'])
  })

  it('keeps a membership whose role_template is null, with no role name', () => {
    const [membership] = toSuiteMemberships([
      {
        organization_id: 'org-2',
        organization_name: 'beta',
        created_at: '2025-01-01T00:00:00Z',
        role_template: null,
      },
    ])
    // Still a real organization the user belongs to — it must remain
    // selectable even though it grants no role.
    expect(membership.organization_id).toBe('org-2')
    expect(membership.role_template_name).toBeNull()
    expect(membership.role_template_scopes).toEqual([])
  })

  it('drops a membership with no usable organization_id', () => {
    // The shared provider calls organization_id.localeCompare while choosing
    // the primary membership. One malformed entry would throw inside session
    // resolution, which the provider treats as a failed /me — i.e. it would
    // sign the user out.
    expect(
      toSuiteMemberships([
        { organization_id: '', organization_name: 'blank', created_at: '', role_template: null },
        {
          organization_id: undefined,
          organization_name: 'missing',
          created_at: '',
          role_template: null,
        } as unknown as Parameters<typeof toSuiteMemberships>[0][number],
      ]),
    ).toEqual([])
  })

  it('falls back to the organization id when the slug is empty', () => {
    // organization_name is selected as COALESCE(o.name, '') server-side, so a
    // membership whose organization row is missing arrives with an empty slug.
    // Rendering '' is the blank organization #622 set its tripwire for.
    const [membership] = toSuiteMemberships([
      { organization_id: 'org-3', organization_name: '', created_at: '', role_template: null },
    ])
    expect(membership.organization_name).toBe('org-3')
  })
})

describe('memberships reach consumers (#795, the blocker for #779)', () => {
  it('publishes a two-membership /auth/me as two entries with their real names', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue({
      ...me,
      memberships: [
        {
          organization_id: 'org-b',
          organization_name: 'beta',
          created_at: '2025-01-02T00:00:00Z',
          role_template: { id: 'rt-2', name: 'viewer', display_name: 'Viewer', scopes: ['read'] },
        },
        {
          organization_id: 'org-a',
          organization_name: 'acme',
          created_at: '2025-01-01T00:00:00Z',
          role_template: { id: 'rt-1', name: 'admin', display_name: 'Admin', scopes: ['admin'] },
        },
      ],
    })
    await renderAuth()
    expect(latest.memberships).toHaveLength(2)
    expect(latest.memberships.map((m) => m.organization_name)).toEqual(['beta', 'acme'])
    expect(latest.memberships.map((m) => m.organization_id)).toEqual(['org-b', 'org-a'])
  })

  it('resolves per-organization scopes, which the fabricated membership could not carry', async () => {
    // hasScope(scope, organizationId) matches on organization_id and reads
    // that membership's own scopes. Under the sentinel there was exactly one
    // membership, its id was a fixed placeholder string and its scopes came
    // from a field the backend does not populate, so this always answered false.
    mockApi.getCurrentUserWithRole.mockResolvedValue({
      ...me,
      memberships: [
        {
          organization_id: 'org-a',
          organization_name: 'acme',
          created_at: '',
          role_template: { id: 'rt', name: 'auditor', display_name: 'A', scopes: ['audit:read'] },
        },
        {
          organization_id: 'org-b',
          organization_name: 'beta',
          created_at: '',
          role_template: { id: 'rt', name: 'viewer', display_name: 'V', scopes: ['modules:read'] },
        },
      ],
    })
    await renderAuth()
    expect(latest.hasScope('audit:read', 'org-a')).toBe(true)
    expect(latest.hasScope('audit:read', 'org-b')).toBe(false)
  })

  it("ignores the deprecated flat role_template: no memberships means no role", async () => {
    // The back-compat field is still on the wire and still populated. If the
    // adapter were still deriving a membership from it, roleTemplate would be
    // non-null here and one fabricated organization would be published.
    mockApi.getCurrentUserWithRole.mockResolvedValue({ ...me, memberships: [] })
    await renderAuth()
    expect(latest.memberships).toEqual([])
    expect(latest.roleTemplate).toBeNull()
  })

  it('drops memberships when the session ends', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me)
    await renderAuth()
    expect(latest.memberships).toHaveLength(1)
    act(() => latest.logout())
    // They name the previous user's organizations: they must not outlive the
    // session any more than the query cache does.
    expect(latest.memberships).toEqual([])
  })

  it('publishes no memberships when /me fails', async () => {
    mockApi.getCurrentUserWithRole.mockRejectedValue(new Error('401'))
    await renderAuth()
    expect(latest.memberships).toEqual([])
  })

  it('does not repopulate memberships from a /me that resolves after logout', async () => {
    // The adapter records memberships the moment /me resolves, which is
    // strictly before the shared provider decides whether to accept that
    // response. The provider discards a response from a superseded generation
    // (so `user` stays null); without the isAuthenticated gate on the way out,
    // the discarded response would still leave a signed-out session holding a
    // populated membership list.
    let resolveMe: (v: unknown) => void = () => { }
    mockApi.getCurrentUserWithRole.mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve
      }),
    )
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    act(() => latest.logout())
    await act(async () => {
      resolveMe(me)
    })
    expect(latest.isAuthenticated).toBe(false)
    expect(latest.memberships).toEqual([])
  })
})
