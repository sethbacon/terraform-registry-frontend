import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Table, TableBody } from '@mui/material'

const getPublicTerraformVersionMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getPublicTerraformVersion: (...args: unknown[]) => getPublicTerraformVersionMock(...args),
  },
}))

import TerraformBinaryVersionRow, { getChangelogUrl } from '../TerraformBinaryVersionRow'
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

function renderRow(props: Partial<ComponentProps<typeof TerraformBinaryVersionRow>> = {}) {
  const handlers = {
    onDeprecate: vi.fn(),
    onUndeprecate: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <Table>
      <TableBody>
        <TerraformBinaryVersionRow
          version={makeVersion()}
          mirrorName="terraform"
          tool="terraform"
          canManage
          {...handlers}
          {...props}
        />
      </TableBody>
    </Table>,
  )
  return handlers
}

describe('TerraformBinaryVersionRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [] })
  })

  it('renders the version, its latest chip and a release-notes link', () => {
    renderRow()
    expect(screen.getByText('1.8.0')).toBeInTheDocument()
    expect(screen.getByText('latest')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /release notes for 1\.8\.0/i })).toHaveAttribute(
      'href',
      'https://github.com/hashicorp/terraform/releases/tag/v1.8.0',
    )
  })

  it('omits the release-notes link for unknown tools', () => {
    renderRow({ tool: 'custom-tool' })
    expect(screen.queryByRole('link', { name: /release notes/i })).not.toBeInTheDocument()
  })

  it('hides the action cell when the user cannot manage mirrors', () => {
    renderRow({ canManage: false })
    expect(screen.queryByRole('button', { name: /delete version/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deprecate version/i })).not.toBeInTheDocument()
  })

  it('calls onDeprecate and onDelete with the row version', async () => {
    const handlers = renderRow()
    await userEvent.click(screen.getByRole('button', { name: /^deprecate version$/i }))
    expect(handlers.onDeprecate).toHaveBeenCalledWith(expect.objectContaining({ version: '1.8.0' }))
    await userEvent.click(screen.getByRole('button', { name: /delete version/i }))
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ version: '1.8.0' }))
  })

  it('offers undeprecate instead of deprecate for a deprecated version', async () => {
    const handlers = renderRow({ version: makeVersion({ is_deprecated: true, is_latest: false }) })
    expect(screen.getByText('deprecated')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /undeprecate version/i }))
    expect(handlers.onUndeprecate).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.8.0' }),
    )
  })

  it('disables deprecate and delete while the version is syncing', () => {
    renderRow({ version: makeVersion({ sync_status: 'syncing' }) })
    expect(screen.getByRole('button', { name: /^deprecate version$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /delete version/i })).toBeDisabled()
  })

  it('lazily loads platform rows when expanded', async () => {
    getPublicTerraformVersionMock.mockResolvedValue({
      platforms: [
        {
          id: 'p-1',
          os: 'linux',
          arch: 'amd64',
          sync_status: 'synced',
          filename: 'terraform_1.8.0_linux_amd64.zip',
          sha256_verified: true,
          gpg_verified: false,
        },
      ],
    })
    renderRow()
    expect(getPublicTerraformVersionMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /toggle version details/i }))
    expect(await screen.findByText('linux / amd64')).toBeInTheDocument()
    expect(getPublicTerraformVersionMock).toHaveBeenCalledWith('terraform', '1.8.0')
  })
})

describe('getChangelogUrl', () => {
  it('builds per-version GitHub release tags for terraform and opentofu', () => {
    expect(getChangelogUrl('terraform', '1.8.0')).toBe(
      'https://github.com/hashicorp/terraform/releases/tag/v1.8.0',
    )
    expect(getChangelogUrl('opentofu', '1.7.0')).toBe(
      'https://github.com/opentofu/opentofu/releases/tag/v1.7.0',
    )
  })

  it('builds per-version GitHub release tags for opa and packer', () => {
    expect(getChangelogUrl('opa', '0.60.0')).toBe(
      'https://github.com/open-policy-agent/opa/releases/tag/v0.60.0',
    )
    expect(getChangelogUrl('packer', '1.11.0')).toBe(
      'https://github.com/hashicorp/packer/releases/tag/v1.11.0',
    )
  })

  it('builds a per-version GitHub release tag for terraform-docs', () => {
    expect(getChangelogUrl('terraform-docs', '0.24.0')).toBe(
      'https://github.com/terraform-docs/terraform-docs/releases/tag/v0.24.0',
    )
  })

  it('links sentinel to the consolidated changelog page (no per-version tag)', () => {
    expect(getChangelogUrl('sentinel', '0.40.0')).toBe(
      'https://developer.hashicorp.com/sentinel/docs/changelog',
    )
  })

  it('does not double-prefix a version that already starts with v', () => {
    expect(getChangelogUrl('opa', 'v1.0.0')).toBe(
      'https://github.com/open-policy-agent/opa/releases/tag/v1.0.0',
    )
  })

  it('returns null for unknown/custom tools', () => {
    expect(getChangelogUrl('custom-tool', '1.0.0')).toBeNull()
  })
})
