import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.hoisted(() => ({
  listPublicTerraformMirrorConfigs: vi.fn(),
  listPublicTerraformVersions: vi.fn(),
  deprecateTerraformVersion: vi.fn(),
  undeprecateTerraformVersion: vi.fn(),
  deleteTerraformVersion: vi.fn(),
}))

vi.mock('../../services/api', () => ({ default: mockApi }))

const mockAuth = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, allowedScopes: ['admin'] })),
}))

vi.mock('../../contexts/AuthContext', () => mockAuth)

import { useTerraformBinaryDetail } from '../useTerraformBinaryDetail'
import type { TerraformVersion } from '../../types/terraform_mirror'

const config = { name: 'terraform', tool: 'terraform', description: 'Official Terraform binary' }

function version(v: string, extra: Partial<TerraformVersion> = {}): TerraformVersion {
  return {
    id: `id-${v}`,
    config_id: 'cfg-uuid-1',
    version: v,
    is_latest: false,
    is_deprecated: false,
    sync_status: 'synced',
    synced_at: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...extra,
  }
}

function renderBinaryDetail(initialPath = '/terraform-binaries/terraform') {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/terraform-binaries/:name" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  )
  return renderHook(() => useTerraformBinaryDetail(), { wrapper })
}

describe('useTerraformBinaryDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.useAuth.mockReturnValue({ isAuthenticated: true, allowedScopes: ['admin'] })
    mockApi.listPublicTerraformMirrorConfigs.mockResolvedValue([config])
    mockApi.listPublicTerraformVersions.mockResolvedValue({
      versions: [version('1.7.0'), version('1.8.0', { is_latest: true })],
    })
  })

  it('loads the config and sorts versions latest-first', async () => {
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toEqual(config)
    expect(result.current.versions.map((v) => v.version)).toEqual(['1.8.0', '1.7.0'])
  })

  it('sorts non-latest versions numerically descending', async () => {
    mockApi.listPublicTerraformVersions.mockResolvedValue({
      versions: [version('1.9.0'), version('1.10.0'), version('1.8.0')],
    })
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.versions.map((v) => v.version)).toEqual(['1.10.0', '1.9.0', '1.8.0'])
  })

  it('errors when the named mirror config is not published', async () => {
    mockApi.listPublicTerraformMirrorConfigs.mockResolvedValue([])
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.error).toMatch(/not found/i))
    expect(result.current.config).toBeNull()
  })

  it('errors when a lookup rejects', async () => {
    mockApi.listPublicTerraformVersions.mockRejectedValue(new Error('boom'))
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.error).toMatch(/failed to load details/i))
  })

  it('grants manage rights to mirrors:manage without admin', async () => {
    mockAuth.useAuth.mockReturnValue({
      isAuthenticated: true,
      allowedScopes: ['mirrors:manage'],
    })
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canManage).toBe(true)
  })

  it('withholds manage rights from an unauthenticated visitor', async () => {
    mockAuth.useAuth.mockReturnValue({ isAuthenticated: false, allowedScopes: ['admin'] })
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canManage).toBe(false)
  })

  it('deprecates the targeted version with the config UUID and clears the dialog', async () => {
    mockApi.deprecateTerraformVersion.mockResolvedValue({})
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setDeprecateTarget(result.current.versions[0])
      result.current.setDeprecateMessage('CVE-2025-0001')
    })
    await act(async () => {
      await result.current.handleDeprecate()
    })

    expect(mockApi.deprecateTerraformVersion).toHaveBeenCalledWith('cfg-uuid-1', '1.8.0')
    expect(result.current.deprecateTarget).toBeNull()
    expect(result.current.deprecateMessage).toBe('')
    expect(result.current.actionSuccess).toMatch(/1\.8\.0/)
  })

  it('surfaces a deprecate failure as an action error', async () => {
    mockApi.deprecateTerraformVersion.mockRejectedValue(new Error('nope'))
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setDeprecateTarget(result.current.versions[0])
    })
    await act(async () => {
      await result.current.handleDeprecate()
    })

    expect(result.current.actionError).toBeTruthy()
    expect(result.current.actionSuccess).toBeNull()
  })

  it('undeprecates a version', async () => {
    mockApi.undeprecateTerraformVersion.mockResolvedValue({})
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleUndeprecate(result.current.versions[1])
    })

    expect(mockApi.undeprecateTerraformVersion).toHaveBeenCalledWith('cfg-uuid-1', '1.7.0')
    expect(result.current.actionSuccess).toMatch(/1\.7\.0/)
  })

  it('deletes the targeted version and clears the dialog', async () => {
    mockApi.deleteTerraformVersion.mockResolvedValue({})
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setDeleteTarget(result.current.versions[0])
    })
    await act(async () => {
      await result.current.handleDelete()
    })

    expect(mockApi.deleteTerraformVersion).toHaveBeenCalledWith('cfg-uuid-1', '1.8.0')
    expect(result.current.deleteTarget).toBeNull()
  })

  it('does not call the API when no version has been targeted', async () => {
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleDeprecate()
      await result.current.handleDelete()
    })

    expect(mockApi.deprecateTerraformVersion).not.toHaveBeenCalled()
    expect(mockApi.deleteTerraformVersion).not.toHaveBeenCalled()
  })

  it('does not mutate when the mirror has no versions to source a config UUID from', async () => {
    mockApi.listPublicTerraformVersions.mockResolvedValue({ versions: [] })
    const { result } = renderBinaryDetail()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleUndeprecate(version('1.8.0'))
    })

    expect(mockApi.undeprecateTerraformVersion).not.toHaveBeenCalled()
  })
})
