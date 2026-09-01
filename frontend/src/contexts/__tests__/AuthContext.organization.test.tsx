import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'
import { AUTH_STORAGE_KEYS } from '../../utils/authStorage'

// The organization picker's plumbing (terraform-registry-backend#1011, terraform-state-manager-backend#437):
// the provider's selection reaches the HTTP layer, and a platform administrator
// — who reaches every organization and belongs to none — is given a universe
// to choose from.

const mockApi = vi.hoisted(() => ({
  getCurrentUserWithRole: vi.fn(),
  listOrganizations: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  devLogin: vi.fn(),
  ldapLogin: vi.fn(),
}))
const setActingOrganization = vi.hoisted(() => vi.fn())

vi.mock('../../services/api', () => ({ default: mockApi }))
vi.mock('../../services/api/devApi', () => ({ devLogin: () => mockApi.devLogin() }))
vi.mock('../../services/api/http', () => ({
  setActingOrganization,
  http: {},
  encodeSegment: (v: string) => v,
}))

function membership(id: string, name: string, scopes: string[]) {
  return {
    organization_id: id,
    organization_name: name,
    created_at: '2025-01-01T00:00:00Z',
    role_template: { id: 'rt', name: 'publisher', display_name: 'Publisher', scopes },
  }
}

function me(memberships: ReturnType<typeof membership>[], allowedScopes: string[]) {
  return {
    user: { id: 'u1', email: 'a@b.c', name: 'Alice' },
    memberships,
    allowed_scopes: allowedScopes,
    session_expires_at: null as string | null,
  }
}

let latest: ReturnType<typeof useAuth>
function Consumer() {
  latest = useAuth()
  return null
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
  localStorage.removeItem('registry.organization')
  vi.clearAllMocks()
})

describe('acting organization reaches the HTTP layer', () => {
  it('pushes the single membership as the acting organization without any picking', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(
      me([membership('org-1', 'acme', ['modules:write'])], ['modules:write']),
    )
    await renderAuth()
    await waitFor(() => expect(setActingOrganization).toHaveBeenLastCalledWith('org-1'))
    expect(latest.currentOrganizationId).toBe('org-1')
  })

  it('pushes null while a multi-organization user has not chosen — nothing is invented', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(
      me(
        [
          membership('org-1', 'acme', ['modules:write']),
          membership('org-2', 'globex', ['modules:write']),
        ],
        ['modules:write'],
      ),
    )
    await renderAuth()
    expect(latest.currentOrganizationId).toBeNull()
    expect(setActingOrganization).toHaveBeenLastCalledWith(null)
    // The universe the picker renders is exactly the memberships.
    expect(latest.organizationChoices.map((o) => o.organization_id)).toEqual(['org-1', 'org-2'])
  })

  it('does not fetch an organization universe for an ordinary member', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(
      me([membership('org-1', 'acme', ['admin'])], ['admin']),
    )
    await renderAuth()
    await waitFor(() => expect(setActingOrganization).toHaveBeenLastCalledWith('org-1'))
    expect(mockApi.listOrganizations).not.toHaveBeenCalled()
  })
})

describe('a platform administrator is given a universe to choose from', () => {
  it('fetches every page of organizations and offers them as choices', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me([], ['admin']))
    mockApi.listOrganizations
      .mockResolvedValueOnce({
        organizations: [{ id: 'o1', name: 'one', display_name: 'One' }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        organizations: [{ id: 'o2', name: 'two', display_name: '' }],
        hasMore: false,
      })
    await renderAuth()
    await waitFor(() => expect(latest.organizationChoices).toHaveLength(2))
    expect(mockApi.listOrganizations).toHaveBeenNthCalledWith(1, 1, 100)
    expect(mockApi.listOrganizations).toHaveBeenNthCalledWith(2, 2, 100)
    expect(latest.organizationChoices).toEqual([
      { organization_id: 'o1', organization_name: 'One' },
      { organization_id: 'o2', organization_name: 'two' },
    ])
    // Nothing is chosen for them: the admin must pick, exactly as the backend demands.
    expect(latest.currentOrganizationId).toBeNull()
    expect(setActingOrganization).toHaveBeenLastCalledWith(null)
  })

  it('degrades to no extra choices when the directory cannot be fetched', async () => {
    mockApi.getCurrentUserWithRole.mockResolvedValue(me([], ['admin']))
    mockApi.listOrganizations.mockRejectedValue(new Error('boom'))
    await renderAuth()
    await waitFor(() => expect(mockApi.listOrganizations).toHaveBeenCalled())
    expect(latest.organizationChoices).toEqual([])
    expect(latest.isAuthenticated).toBe(true)
  })
})
