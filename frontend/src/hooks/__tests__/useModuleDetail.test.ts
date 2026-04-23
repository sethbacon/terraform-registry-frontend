import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { AxiosError } from 'axios'

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
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

  it('sets error with "Module not found" on 404', async () => {
    const err = new AxiosError('Not Found', 'ERR_BAD_REQUEST')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (err as any).response = { status: 404, data: {} }
    mockApi.getModule.mockRejectedValue(err)

    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.error).toBe('Module not found')
    })
  })

  it('merges protocol versions over module.versions when both present', async () => {
    mockApi.getModuleVersions.mockResolvedValue({
      modules: [{ versions: [{ version: '3.0.0' }, { version: '0.9.0' }] }],
    })
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.versions[0].version).toBe('3.0.0')
    expect(result.current.versions.length).toBe(2)
  })

  it('falls back to module.versions when protocol versions missing', async () => {
    mockApi.getModuleVersions.mockResolvedValue({ modules: [] })
    mockApi.getModule.mockResolvedValue({
      id: 'mod-123',
      namespace: 'hashicorp',
      name: 'consul',
      system: 'aws',
      versions: [{ version: '1.1.1' }, { version: '1.0.0' }],
    })
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.versions[0].version).toBe('1.1.1')
  })

  it('calls handlePublishNewVersion and navigates with state', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handlePublishNewVersion() })

    expect(mockNavigate).toHaveBeenCalledWith('/admin/upload/module', expect.objectContaining({
      state: expect.objectContaining({
        moduleData: { namespace: 'hashicorp', name: 'consul', provider: 'aws' },
      }),
    }))
  })

  it('handleDeleteModule calls api.deleteModule and navigates on success', async () => {
    mockApi.deleteModule.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.handleDeleteModule()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockApi.deleteModule).toHaveBeenCalledWith('hashicorp', 'consul', 'aws')
    })
  })

  it('handleDeleteModule sets error when mutation fails', async () => {
    mockApi.deleteModule.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.handleDeleteModule()
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })

  it('handleDeleteVersion is a no-op when no version is queued for deletion', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleDeleteVersion() })
    expect(mockApi.deleteModuleVersion).not.toHaveBeenCalled()
  })

  it('openDeleteVersionDialog sets versionToDelete and opens the dialog', async () => {
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openDeleteVersionDialog('2.0.0') })

    expect(result.current.versionToDelete).toBe('2.0.0')
    expect(result.current.deleteVersionDialogOpen).toBe(true)
  })

  it('handleDeleteVersion calls api.deleteModuleVersion when a version is queued', async () => {
    mockApi.deleteModuleVersion.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openDeleteVersionDialog('2.0.0') })

    await act(async () => {
      result.current.handleDeleteVersion()
    })

    await waitFor(() => {
      expect(mockApi.deleteModuleVersion).toHaveBeenCalledWith('hashicorp', 'consul', 'aws', '2.0.0')
    })
  })

  it('handleDeprecateVersion calls api.deprecateModuleVersion with selected version', async () => {
    mockApi.deprecateModuleVersion.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.selectedVersion?.version).toBe('2.0.0'))

    act(() => { result.current.setDeprecationMessage('use 3.0.0 instead') })
    await act(async () => {
      result.current.handleDeprecateVersion()
    })

    await waitFor(() => {
      expect(mockApi.deprecateModuleVersion).toHaveBeenCalledWith(
        'hashicorp', 'consul', 'aws', '2.0.0', 'use 3.0.0 instead', undefined,
      )
    })
  })

  it('handleUndeprecateVersion calls api.undeprecateModuleVersion', async () => {
    mockApi.undeprecateModuleVersion.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.selectedVersion?.version).toBe('2.0.0'))

    await act(async () => {
      result.current.handleUndeprecateVersion()
    })

    await waitFor(() => {
      expect(mockApi.undeprecateModuleVersion).toHaveBeenCalledWith('hashicorp', 'consul', 'aws', '2.0.0')
    })
  })

  it('handleDeprecateModule calls api.deprecateModule with message', async () => {
    mockApi.deprecateModule.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setModuleDeprecationMessage('EOL')
      result.current.setSuccessorModuleId('other/mod/aws')
    })

    await act(async () => {
      result.current.handleDeprecateModule()
    })

    await waitFor(() => {
      expect(mockApi.deprecateModule).toHaveBeenCalledWith(
        'hashicorp', 'consul', 'aws', { message: 'EOL', successor_module_id: 'other/mod/aws' },
      )
    })
  })

  it('handleUndeprecateModule calls api.undeprecateModule', async () => {
    mockApi.undeprecateModule.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.handleUndeprecateModule()
    })

    await waitFor(() => {
      expect(mockApi.undeprecateModule).toHaveBeenCalledWith('hashicorp', 'consul', 'aws')
    })
  })

  it('handleSCMSync is a no-op when module.id is unavailable', async () => {
    mockApi.getModule.mockResolvedValue(null)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleSCMSync() })
    expect(mockApi.triggerManualSync).not.toHaveBeenCalled()
  })

  it('handleSCMSync calls api.triggerManualSync when module.id is available', async () => {
    mockApi.triggerManualSync.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.module?.id).toBe('mod-123'))

    act(() => { result.current.handleSCMSync() })

    await waitFor(() => {
      expect(mockApi.triggerManualSync).toHaveBeenCalledWith('mod-123')
    })
  })

  it('handleSCMUnlink is a no-op when module.id is unavailable', async () => {
    mockApi.getModule.mockResolvedValue(null)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleSCMUnlink() })
    expect(mockApi.unlinkModuleFromSCM).not.toHaveBeenCalled()
  })

  it('handleSCMUnlink calls api.unlinkModuleFromSCM when module.id is available', async () => {
    mockApi.unlinkModuleFromSCM.mockResolvedValue(undefined)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.module?.id).toBe('mod-123'))

    act(() => { result.current.handleSCMUnlink() })

    await waitFor(() => {
      expect(mockApi.unlinkModuleFromSCM).toHaveBeenCalledWith('mod-123')
    })
  })

  it('handleCopySource writes source string to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.selectedVersion?.version).toBe('2.0.0'))

    act(() => { result.current.handleCopySource() })

    expect(writeText).toHaveBeenCalledWith('hashicorp/consul/aws')
    expect(result.current.copiedSource).toBe(true)
  })

  it('handleCopySource is a no-op without module or version', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    mockApi.getModule.mockResolvedValue(null)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleCopySource() })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('handleUpdateDescription calls api.updateModule when module.id is available', async () => {
    const updateModule = vi.fn().mockResolvedValue(undefined)
      // Extend api mock ad-hoc so updateModule is callable via the hook.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (mockApi as any).updateModule = updateModule
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.module?.id).toBe('mod-123'))

    act(() => { result.current.handleUpdateDescription('new description') })

    await waitFor(() => {
      expect(updateModule).toHaveBeenCalledWith('mod-123', { description: 'new description' })
    })
  })

  it('loadWebhookEvents populates webhookEvents list', async () => {
    mockApi.getWebhookEvents.mockResolvedValue([
      { id: 'ev-1', delivery_id: 'd1', event_type: 'push', processed: true, created_at: '2025-01-01' },
    ])
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadWebhookEvents('mod-123')
    })

    expect(result.current.webhookEventsLoaded).toBe(true)
    expect(result.current.webhookEvents).toHaveLength(1)
  })

  it('loadWebhookEvents falls back to empty list on error', async () => {
    mockApi.getWebhookEvents.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadWebhookEvents('mod-123')
    })

    expect(result.current.webhookEvents).toEqual([])
    expect(result.current.webhookEventsLoaded).toBe(true)
  })

  it('getTerraformExample returns empty string when no module/version selected', async () => {
    mockApi.getModule.mockResolvedValue(null)
    const { result } = renderHook(() => useModuleDetail(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.getTerraformExample()).toBe('')
  })
})
