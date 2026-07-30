import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

/** Renders the hook under the real router so ?tab=/?doc= behave as in the app. */
function renderProviderDetail(initialPath = '/providers/hashicorp/aws') {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/providers/:namespace/:type" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
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
      await result.current.handleDeleteVersion()
    })
    expect(mockApi.deleteProviderVersion).toHaveBeenCalledWith('hashicorp', 'aws', '5.0.0')
    expect(mockApi.searchProviders).toHaveBeenCalledTimes(2)
    expect(result.current.deleteVersionDialogOpen).toBe(false)
  })

  it('reports a failure to deprecate without leaving the dialog open', async () => {
    // Non-Error rejection => getErrorMessage falls back to the supplied copy
    mockApi.deprecateProviderVersion.mockRejectedValue({ status: 500 })
    const { result } = renderProviderDetail()

    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.handleDeprecateVersion()
    })
    expect(result.current.error).toMatch(/failed to deprecate version/i)
    expect(result.current.deprecateDialogOpen).toBe(false)
    expect(result.current.deprecating).toBe(false)
  })
})
