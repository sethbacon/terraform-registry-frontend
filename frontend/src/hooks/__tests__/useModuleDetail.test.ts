import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({ namespace: 'hashicorp', name: 'consul', system: 'aws' })),
  useNavigate: vi.fn(() => mockNavigate),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    allowedScopes: ['admin'],
  })),
}))

const mockApi = vi.hoisted(() => ({
  getModule: vi.fn(),
  getModuleVersions: vi.fn(),
  getModuleSCMInfo: vi.fn(),
  getModuleScan: vi.fn(),
  getModuleDocs: vi.fn(),
  deleteModule: vi.fn(),
  deleteModuleVersion: vi.fn(),
  deprecateModuleVersion: vi.fn(),
  undeprecateModuleVersion: vi.fn(),
  unlinkModuleFromSCM: vi.fn(),
  triggerManualSync: vi.fn(),
  getWebhookEvents: vi.fn(),
  deprecateModule: vi.fn(),
  undeprecateModule: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  default: mockApi,
}))

vi.mock('../../config', () => ({
  REGISTRY_HOST: 'registry.example.com',
}))

import { useModuleDetail } from '../useModuleDetail'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// ── Fixtures ─────────────────────────────────────────────────────────────

const moduleData = {
  id: 'mod-123',
  namespace: 'hashicorp',
  name: 'consul',
  system: 'aws',
  versions: [
    { version: '1.0.0' },
    { version: '2.0.0' },
  ],
}

const versionsData = {
  modules: [{
    versions: [
      { version: '2.0.0', readme: '# v2' },
      { version: '1.0.0', readme: '# v1' },
    ],
  }],
}

// ── Wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('useModuleDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mocks that individual tests may override
    vi.mocked(useParams).mockReturnValue({ namespace: 'hashicorp', name: 'consul', system: 'aws' })
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      allowedScopes: ['admin'],
    } as any)
    mockApi.getModule.mockResolvedValue(moduleData)
    mockApi.getModuleVersions.mockResolvedValue(versionsData)
    mockApi.getModuleSCMInfo.mockRejectedValue(new Error('404'))
    mockApi.getModuleScan.mockRejectedValue(new Error('404'))
    mockApi.getModuleDocs.mockResolvedValue(null)
  })

  it('starts in loading state', () => {
    // Block the API calls from resolving
    mockApi.getModule.mockReturnValue(new Promise(() => { }))
    mockApi.getModuleVersions.mockReturnValue(new Promise(() => { }))

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    expect(result.current.loading).toBe(true)
    expect(result.current.module).toBeNull()
    expect(result.current.versions).toEqual([])
  })

  it('loads module data and selects latest version', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.module).toEqual(moduleData)
    expect(result.current.versions).toHaveLength(2)
    // Latest version (2.0.0) should be selected
    expect(result.current.selectedVersion?.version).toBe('2.0.0')
  })

  it('sorts versions by semver descending', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.versions[0].version).toBe('2.0.0')
    expect(result.current.versions[1].version).toBe('1.0.0')
  })

  it('allows changing selected version', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSelectedVersion({ version: '1.0.0' } as any)
    })

    expect(result.current.selectedVersion?.version).toBe('1.0.0')
  })

  it('sets error state when module is not found', async () => {
    mockApi.getModule.mockResolvedValue(null)

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Module not found')
  })

  it('sets error state on API failure', async () => {
    mockApi.getModule.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
  })

  it('attempts to load SCM link when authenticated', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockApi.getModuleSCMInfo).toHaveBeenCalledWith('mod-123')
  })

  it('loads module scan for selected version when user can manage', async () => {
    mockApi.getModuleScan.mockResolvedValue({ status: 'completed', findings: [] })

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Scan is loaded for the selected version
    await waitFor(() => {
      expect(mockApi.getModuleScan).toHaveBeenCalledWith(
        'hashicorp', 'consul', 'aws', '2.0.0'
      )
    })
  })

  it('does not load scan when user cannot manage', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      allowedScopes: ['modules:read'],
    } as any)

    mockApi.getModuleSCMInfo.mockRejectedValue(new Error('404'))

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.canManage).toBe(false)
    expect(mockApi.getModuleScan).not.toHaveBeenCalled()
  })

  it('does not load details when route params are missing', async () => {
    vi.mocked(useParams).mockReturnValue({})

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    // Should remain in loading state since loadModuleDetails returns early
    expect(mockApi.getModule).not.toHaveBeenCalled()
  })

  it('generates correct Terraform example', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.selectedVersion).not.toBeNull()
    })

    const example = result.current.getTerraformExample()
    expect(example).toContain('registry.example.com/hashicorp/consul/aws')
    expect(example).toContain('>=2.0')
  })

  it('exposes route params', () => {
    vi.mocked(useParams).mockReturnValue({ namespace: 'hashicorp', name: 'consul', system: 'aws' })

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    expect(result.current.namespace).toBe('hashicorp')
    expect(result.current.name).toBe('consul')
    expect(result.current.system).toBe('aws')
  })
})
