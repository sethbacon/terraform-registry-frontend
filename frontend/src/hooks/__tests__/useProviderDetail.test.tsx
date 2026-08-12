import React from 'react'
import { renderHook, act, waitFor, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.hoisted(() => ({
  searchProviders: vi.fn(),
  getProviderVersions: vi.fn(),
  getProviderDocs: vi.fn(),
  deleteProvider: vi.fn(),
  deleteProviderVersion: vi.fn(),
  deprecateProviderVersion: vi.fn(),
  undeprecateProviderVersion: vi.fn(),
}))

vi.mock('../../services/api', () => ({ default: mockApi }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, allowedScopes: ['admin'] })),
}))

vi.mock('../../config', () => ({ REGISTRY_HOST: 'registry.example.com' }))

import { useProviderDetail } from '../useProviderDetail'

const provider = {
  id: 'p-1',
  namespace: 'hashicorp',
  type: 'aws',
  description: 'AWS provider',
  organization_id: 'org-1',
  download_count: 10,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

function version(v: string, extra: Record<string, unknown> = {}) {
  return {
    id: `id-${v}`,
    provider_id: 'p-1',
    version: v,
    protocols: ['6.0'],
    published_at: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    deprecated: false,
    ...extra,
  }
}

function createQueryClient(queryOverrides: Record<string, unknown> = {}) {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, ...queryOverrides } },
  })
}

/**
 * Renders the hook under the real router so ?tab=/?doc= behave as in the app,
 * and under a React Query client so the hook's queries/mutations behave as in
 * the app. A fresh client per render unless the caller supplies one, so cached
 * provider data never leaks between tests.
 */
function renderProviderDetail(
  initialPath = '/providers/hashicorp/aws',
  queryClient: QueryClient = createQueryClient(),
) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/providers/:namespace/:type" element={<>{children}</>} />
          {/* Landing route for handleDeleteProvider's navigate('/providers') */}
          <Route path="/providers" element={<div data-testid="providers-list" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(() => useProviderDetail(), { wrapper })
}

describe('useProviderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.searchProviders.mockResolvedValue({ providers: [provider] })
    mockApi.getProviderVersions.mockResolvedValue({ versions: [version('5.0.0')] })
    mockApi.getProviderDocs.mockResolvedValue({ docs: [], total: 0 })
  })

  it('sorts versions newest-first with stable releases ahead of pre-releases', async () => {
    mockApi.getProviderVersions.mockResolvedValue({
      versions: [version('4.9.0'), version('5.0.0-beta.1'), version('5.0.0'), version('5.1.0')],
    })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.versions.map((v) => v.version)).toEqual([
      '5.1.0',
      '5.0.0',
      '5.0.0-beta.1',
      '4.9.0',
    ])
    // Newest version is selected automatically
    expect(result.current.selectedVersion?.version).toBe('5.1.0')
  })

  it('orders stable ahead of pre-releases, identically to useModuleDetail (#673)', async () => {
    // Deliberately the same fixture and expectation as the matching test in
    // useModuleDetail.test.ts and in utils/__tests__/semver.test.ts. The two
    // hooks each carried a private copy of the comparator and they had already
    // drifted apart once; asserting the same list from both is what turns a
    // future re-fork into a failure instead of a quiet difference between the
    // module page and the provider page.
    //
    // The case above passes against the old private copy too — it only has one
    // pre-release, so nothing distinguishes the implementations. This one adds
    // two pre-releases of the same version, which the old copy left in whatever
    // order the API returned.
    mockApi.getProviderVersions.mockResolvedValue({
      versions: [
        version('1.0.0'),
        version('2.0.0-beta.2'),
        version('2.0.0-beta.10'),
        version('2.0.0-rc.1'),
        version('2.0.0'),
      ],
    })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.versions.map((v) => v.version)).toEqual([
      '2.0.0',
      '2.0.0-rc.1',
      '2.0.0-beta.10',
      '2.0.0-beta.2',
      '1.0.0',
    ])
  })

  it('surfaces a not-found error when no provider matches the route', async () => {
    mockApi.searchProviders.mockResolvedValue({ providers: [] })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.error).toBe('Provider not found'))
    expect(result.current.provider).toBeNull()
  })

  it('surfaces a load error when the API rejects', async () => {
    mockApi.searchProviders.mockRejectedValue(new Error('boom'))
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/failed to load provider details/i)
  })

  it('does not fetch docs for providers that are not mirrored', async () => {
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasDocs).toBe(false)
    expect(mockApi.getProviderDocs).not.toHaveBeenCalled()
  })

  it('walks every page of the doc index for mirrored providers', async () => {
    mockApi.searchProviders.mockResolvedValue({
      providers: [{ ...provider, source: 'hashicorp/aws' }],
    })
    mockApi.getProviderDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'd1', title: 'Overview', slug: 'index', category: 'overview', language: 'hcl' },
        ],
        total: 2,
      })
      .mockResolvedValueOnce({
        docs: [{ id: 'd2', title: 'Bucket', slug: 's3', category: 'resources', language: 'hcl' }],
        total: 2,
      })

    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.docs).toHaveLength(2))
    expect(result.current.hasDocs).toBe(true)
    expect(mockApi.getProviderDocs).toHaveBeenCalledTimes(2)
    // Second call resumes from the offset reached by the first page
    expect(mockApi.getProviderDocs.mock.calls[1]).toEqual([
      'hashicorp',
      'aws',
      '5.0.0',
      undefined,
      'hcl',
      1000,
      1,
    ])
  })

  it('reads the selected doc out of the ?doc= query param', async () => {
    const { result } = renderProviderDetail('/providers/hashicorp/aws?tab=docs&doc=resources/s3')

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeTab).toBe(1)
    expect(result.current.selectedDocCategory).toBe('resources')
    expect(result.current.selectedDocSlug).toBe('s3')
  })

  it('selecting a doc switches to the documentation tab', async () => {
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.handleDocSelect('resources', 's3'))

    await waitFor(() => expect(result.current.activeTab).toBe(1))
    expect(result.current.selectedDocSlug).toBe('s3')
  })

  it('leaving the documentation tab clears the doc selection', async () => {
    const { result } = renderProviderDetail('/providers/hashicorp/aws?tab=docs&doc=resources/s3')

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.handleTabChange({} as React.SyntheticEvent, 0))

    await waitFor(() => expect(result.current.activeTab).toBe(0))
    expect(result.current.selectedDocCategory).toBeNull()
    expect(result.current.selectedDocSlug).toBeNull()
  })

  it('builds a registry-sourced example for directly published providers', async () => {
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    const example = result.current.getTerraformExample()
    expect(example).toContain('source  = "registry.example.com/hashicorp/aws"')
    expect(example).toContain('version = "5.0.0"')
    expect(result.current.githubUrl).toBeNull()
    expect(result.current.changelogUrl).toBeNull()
  })

  it('builds an upstream-sourced example and repo links for mirrored providers', async () => {
    mockApi.searchProviders.mockResolvedValue({
      providers: [{ ...provider, source: 'hashicorp/aws' }],
    })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    const example = result.current.getTerraformExample()
    expect(example).toContain('source  = "hashicorp/aws"')
    expect(example).toContain('version = ">=5.0"')
    expect(result.current.githubUrl).toBe('https://github.com/hashicorp/terraform-provider-aws')
    expect(result.current.changelogUrl).toBe(
      'https://github.com/hashicorp/terraform-provider-aws/releases/tag/v5.0.0',
    )
  })

  it('returns an empty example before a version is selected', async () => {
    mockApi.getProviderVersions.mockResolvedValue({ versions: [] })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.getTerraformExample()).toBe('')
  })

  it('reloads the provider after deleting a version', async () => {
    mockApi.deleteProviderVersion.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.openDeleteVersionDialog('5.0.0'))
    expect(result.current.deleteVersionDialogOpen).toBe(true)

    await act(async () => {
      result.current.handleDeleteVersion()
    })
    await waitFor(() =>
      expect(mockApi.deleteProviderVersion).toHaveBeenCalledWith('hashicorp', 'aws', '5.0.0'),
    )
    // The delete invalidates the provider detail query, which refetches it
    await waitFor(() => expect(mockApi.searchProviders).toHaveBeenCalledTimes(2))
    expect(result.current.deleteVersionDialogOpen).toBe(false)
    expect(result.current.versionToDelete).toBeNull()
  })

  it('reloads the provider after deprecating a version', async () => {
    mockApi.deprecateProviderVersion.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setDeprecationMessage('use 6.x'))
    await act(async () => {
      result.current.handleDeprecateVersion()
    })

    await waitFor(() =>
      expect(mockApi.deprecateProviderVersion).toHaveBeenCalledWith(
        'hashicorp',
        'aws',
        '5.0.0',
        'use 6.x',
      ),
    )
    await waitFor(() => expect(mockApi.searchProviders).toHaveBeenCalledTimes(2))
    expect(result.current.deprecationMessage).toBe('')
    expect(result.current.deprecateDialogOpen).toBe(false)
  })

  it('reloads the provider after removing a deprecation', async () => {
    mockApi.undeprecateProviderVersion.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      result.current.handleUndeprecateVersion()
    })

    await waitFor(() =>
      expect(mockApi.undeprecateProviderVersion).toHaveBeenCalledWith('hashicorp', 'aws', '5.0.0'),
    )
    await waitFor(() => expect(mockApi.searchProviders).toHaveBeenCalledTimes(2))
  })

  it('deletes the provider and navigates away', async () => {
    mockApi.deleteProvider.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      result.current.handleDeleteProvider()
    })

    await waitFor(() => expect(mockApi.deleteProvider).toHaveBeenCalledWith('hashicorp', 'aws'))
    // Deleting the provider leaves the detail route for the provider list
    await waitFor(() => expect(screen.getByTestId('providers-list')).toBeInTheDocument())
    expect(result.current.deleteProviderDialogOpen).toBe(false)
  })

  it('reports a failure to deprecate without leaving the dialog open', async () => {
    // Non-Error rejection => getErrorMessage falls back to the supplied copy
    mockApi.deprecateProviderVersion.mockRejectedValue({ status: 500 })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      result.current.handleDeprecateVersion()
    })
    await waitFor(() => expect(result.current.error).toMatch(/failed to deprecate version/i))
    expect(result.current.deprecateDialogOpen).toBe(false)
    expect(result.current.deprecating).toBe(false)
    // A failed write must not refetch — the cache is still correct
    expect(mockApi.searchProviders).toHaveBeenCalledTimes(1)
  })

  it('reports a failure to delete a version and keeps the queued version', async () => {
    mockApi.deleteProviderVersion.mockRejectedValue({ status: 500 })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.openDeleteVersionDialog('5.0.0'))
    await act(async () => {
      result.current.handleDeleteVersion()
    })

    await waitFor(() => expect(result.current.error).toMatch(/failed to delete version/i))
    expect(result.current.deleteVersionDialogOpen).toBe(false)
    expect(result.current.versionToDelete).toBe('5.0.0')
    expect(result.current.deleting).toBe(false)
  })

  it('keeps the version the user picked when a mutation refetches the provider', async () => {
    // Bug fix shipped with the React Query port (#674): the hand-rolled reload
    // reset the selection to versions[0] on every refetch, so deprecating any
    // version other than the newest snapped the detail panel back to the newest
    // one and the user never saw the change they had just made. useModuleDetail
    // already preserved the selection; this asserts the provider page does too.
    // The refetch has to return *changed* rows, or React Query's structural
    // sharing hands back the identical array, the selection effect never re-runs
    // and the assertion would hold even for a hook that resets the selection.
    mockApi.getProviderVersions
      .mockResolvedValueOnce({
        versions: [version('5.0.0'), version('4.0.0', { deprecated: true })],
      })
      .mockResolvedValueOnce({
        versions: [version('5.0.0'), version('4.0.0', { deprecated: false })],
      })
    mockApi.undeprecateProviderVersion.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.selectedVersion?.version).toBe('5.0.0'))
    act(() => result.current.setSelectedVersion(result.current.versions[1]))
    expect(result.current.selectedVersion?.version).toBe('4.0.0')
    expect(result.current.selectedVersion?.deprecated).toBe(true)

    await act(async () => {
      result.current.handleUndeprecateVersion()
    })
    await waitFor(() => expect(mockApi.searchProviders).toHaveBeenCalledTimes(2))
    // The refetched rows have landed (4.0.0 is no longer deprecated)
    await waitFor(() => expect(result.current.selectedVersion?.deprecated).toBe(false))

    expect(result.current.selectedVersion?.version).toBe('4.0.0')
  })

  it('picks up the refetched version row rather than the stale one', async () => {
    // The selection is preserved by version string, but it must point at the
    // freshly fetched row -- otherwise the panel would keep rendering the
    // pre-mutation `deprecated: false` copy of the same version.
    mockApi.getProviderVersions
      .mockResolvedValueOnce({ versions: [version('5.0.0')] })
      .mockResolvedValueOnce({
        versions: [version('5.0.0', { deprecated: true, deprecation_message: 'use 6.x' })],
      })
    mockApi.deprecateProviderVersion.mockResolvedValue({})
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.selectedVersion?.version).toBe('5.0.0'))
    expect(result.current.selectedVersion?.deprecated).toBe(false)

    await act(async () => {
      result.current.handleDeprecateVersion()
    })
    await waitFor(() => expect(result.current.selectedVersion?.deprecated).toBe(true))
    expect(result.current.selectedVersion?.deprecation_message).toBe('use 6.x')
  })

  it('dedupes concurrent readers of the same provider into one request', async () => {
    // Two mounted consumers of the hook share one cache entry, so the API is hit
    // once. The hand-rolled version fetched once per consumer (#674).
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/providers/hashicorp/aws']}>
          <Routes>
            <Route path="/providers/:namespace/:type" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({ first: useProviderDetail(), second: useProviderDetail() }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.first.loading).toBe(false))
    await waitFor(() => expect(result.current.second.loading).toBe(false))
    expect(mockApi.searchProviders).toHaveBeenCalledTimes(1)
    expect(mockApi.getProviderVersions).toHaveBeenCalledTimes(1)
    expect(result.current.second.provider?.type).toBe('aws')
  })

  it('caches the doc index per version instead of refetching on every switch', async () => {
    mockApi.searchProviders.mockResolvedValue({
      providers: [{ ...provider, source: 'hashicorp/aws' }],
    })
    mockApi.getProviderVersions.mockResolvedValue({
      versions: [version('5.0.0'), version('4.0.0')],
    })
    mockApi.getProviderDocs.mockResolvedValue({
      docs: [{ id: 'd1', title: 'Overview', slug: 'index', category: 'overview', language: 'hcl' }],
      total: 1,
    })
    // Mirrors the app's real client (src/queryClient.ts): a 30s stale window and
    // a live cache. With the test default of gcTime: 0 nothing is retained, so
    // there would be no caching claim left to make.
    const { result } = renderProviderDetail(
      '/providers/hashicorp/aws',
      createQueryClient({ gcTime: 5 * 60 * 1000, staleTime: 30_000 }),
    )

    await waitFor(() => expect(result.current.docs).toHaveLength(1))
    expect(mockApi.getProviderDocs).toHaveBeenCalledTimes(1)

    act(() => result.current.setSelectedVersion(result.current.versions[1]))
    await waitFor(() => expect(mockApi.getProviderDocs).toHaveBeenCalledTimes(2))
    expect(mockApi.getProviderDocs.mock.calls[1][2]).toBe('4.0.0')

    // Switching back is served from the cache for that version
    act(() => result.current.setSelectedVersion(result.current.versions[0]))
    await waitFor(() => expect(result.current.docs).toHaveLength(1))
    expect(mockApi.getProviderDocs).toHaveBeenCalledTimes(2)
  })
})
