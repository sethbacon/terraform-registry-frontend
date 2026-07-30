import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getPublicTerraformVersionMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getPublicTerraformVersion: (...args: unknown[]) => getPublicTerraformVersionMock(...args),
  },
}))

import TerraformBinaryVersionsTable from '../TerraformBinaryVersionsTable'
import type { TerraformVersion } from '../../types/terraform_mirror'

function makeVersion(overrides: Partial<TerraformVersion> = {}): TerraformVersion {
  return {
    id: 'v-1',
    config_id: 'cfg-uuid-1',
    version: '1.8.0',
    is_latest: true,
    is_deprecated: false,
    sync_status: 'synced',
    synced_at: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

function renderTable(versions: TerraformVersion[], canManage = true) {
  render(
    <TerraformBinaryVersionsTable
      versions={versions}
      mirrorName="terraform"
      tool="terraform"
      canManage={canManage}
      onDeprecate={vi.fn()}
      onUndeprecate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

describe('TerraformBinaryVersionsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [] })
  })

  it('shows the empty alert when nothing has been synced', () => {
    renderTable([])
    expect(screen.getByText(/No versions have been synced yet/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a row per version', () => {
    renderTable([makeVersion(), makeVersion({ id: 'v-2', version: '1.7.0', is_latest: false })])
    expect(screen.getByText('1.8.0')).toBeInTheDocument()
    expect(screen.getByText('1.7.0')).toBeInTheDocument()
  })

  it('only renders the actions column when the user can manage mirrors', () => {
    renderTable([makeVersion()], false)
    expect(screen.queryByRole('columnheader', { name: /actions/i })).not.toBeInTheDocument()
  })
})
