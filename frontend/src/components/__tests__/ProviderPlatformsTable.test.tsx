import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProviderPlatformsTable from '../ProviderPlatformsTable'
import type { ProviderPlatform } from '../../types'

function makePlatform(overrides: Partial<ProviderPlatform> = {}): ProviderPlatform {
  return {
    id: 'plat-1',
    provider_version_id: 'v-1',
    os: 'linux',
    arch: 'amd64',
    shasum: 'abc123sha',
    ...overrides,
  } as ProviderPlatform
}

describe('ProviderPlatformsTable', () => {
  it('renders nothing when the version has no platforms', () => {
    const { container } = render(
      <ProviderPlatformsTable platforms={[]} copiedChecksum={null} onCopyChecksum={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders a row per platform with its checksum', () => {
    render(
      <ProviderPlatformsTable
        platforms={[
          makePlatform(),
          makePlatform({ id: 'plat-2', os: 'darwin', arch: 'arm64', shasum: 'def456sha' }),
        ]}
        copiedChecksum={null}
        onCopyChecksum={vi.fn()}
      />,
    )
    expect(screen.getByText('Available Platforms')).toBeInTheDocument()
    expect(screen.getByText('linux')).toBeInTheDocument()
    expect(screen.getByText('darwin')).toBeInTheDocument()
    expect(screen.getByText('abc123sha')).toBeInTheDocument()
    expect(screen.getByText('def456sha')).toBeInTheDocument()
  })

  it('shows N/A and no copy button for a platform without a checksum', () => {
    render(
      <ProviderPlatformsTable
        platforms={[makePlatform({ shasum: '' })]}
        copiedChecksum={null}
        onCopyChecksum={vi.fn()}
      />,
    )
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy checksum/i })).not.toBeInTheDocument()
  })

  it('calls onCopyChecksum with the row checksum', async () => {
    const onCopyChecksum = vi.fn()
    render(
      <ProviderPlatformsTable
        platforms={[makePlatform()]}
        copiedChecksum={null}
        onCopyChecksum={onCopyChecksum}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /copy checksum/i }))
    expect(onCopyChecksum).toHaveBeenCalledWith('abc123sha')
  })
})
