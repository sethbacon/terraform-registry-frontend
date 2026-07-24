import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}))

const mockApi = vi.hoisted(() => ({
  getCurrentUserMemberships: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  default: mockApi,
}))

import { useDefaultOrgMembership } from '../useDefaultOrgMembership'
import { useAuth } from '../../contexts/AuthContext'

const memberships = [
  { organization_id: 'org-1', organization_name: 'Org One' },
  { organization_id: 'org-2', organization_name: 'Org Two' },
]

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDefaultOrgMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any)
    mockApi.getCurrentUserMemberships.mockResolvedValue(memberships)
  })

  it('loads the current user memberships', async () => {
    const { result } = renderHook(() => useDefaultOrgMembership(['test']), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.memberships).toEqual(memberships)
    expect(mockApi.getCurrentUserMemberships).toHaveBeenCalled()
  })

  it('defaults the selected org to the first membership once loaded when a setter is given', async () => {
    const setDefaultOrgId = vi.fn()
    const { result } = renderHook(
      () => useDefaultOrgMembership(['test'], undefined, setDefaultOrgId),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.memberships).toEqual(memberships))
    await waitFor(() => expect(setDefaultOrgId).toHaveBeenCalledWith('org-1'))
  })

  it('does not override an already-selected org', async () => {
    const setDefaultOrgId = vi.fn()
    const { result } = renderHook(
      () => useDefaultOrgMembership(['test'], 'org-2', setDefaultOrgId),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.memberships).toEqual(memberships))
    expect(setDefaultOrgId).not.toHaveBeenCalled()
  })

  it('does not call the setter when none is provided', async () => {
    const { result } = renderHook(() => useDefaultOrgMembership(['test']), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.memberships).toEqual(memberships))
    // No setter passed -- nothing to assert beyond the hook not throwing and
    // memberships still loading normally.
  })

  it('does not fetch memberships when there is no authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useAuth).mockReturnValue({ user: undefined } as any)
    const { result } = renderHook(() => useDefaultOrgMembership(['test']), {
      wrapper: createWrapper(),
    })

    expect(result.current.memberships).toEqual([])
    expect(mockApi.getCurrentUserMemberships).not.toHaveBeenCalled()
  })
})
