import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Table, TableBody } from '@mui/material'

const getPublicTerraformVersionMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getPublicTerraformVersion: (...args: unknown[]) => getPublicTerraformVersionMock(...args),
  },
}))

import TerraformBinaryPlatformRows from '../TerraformBinaryPlatformRows'

function renderRows(mirrorName = 'terraform', version = '1.8.0') {
  return render(
    <Table>
      <TableBody>
        <TerraformBinaryPlatformRows mirrorName={mirrorName} version={version} />
      </TableBody>
    </Table>,
  )
}

const platform = {
  id: 'p-1',
  os: 'linux',
  arch: 'amd64',
  sync_status: 'synced',
  filename: 'terraform_1.8.0_linux_amd64.zip',
  sha256_verified: true,
  gpg_verified: false,
}

describe('TerraformBinaryPlatformRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a spinner while platforms are loading', () => {
    getPublicTerraformVersionMock.mockReturnValue(new Promise(() => {}))
    renderRows()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders a row per platform from the public endpoint', async () => {
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [platform] })
    renderRows()
    await waitFor(() => expect(screen.getByText('linux / amd64')).toBeInTheDocument())
    expect(getPublicTerraformVersionMock).toHaveBeenCalledWith('terraform', '1.8.0')
    expect(screen.getByText('terraform_1.8.0_linux_amd64.zip')).toBeInTheDocument()
    expect(screen.getByText('synced')).toBeInTheDocument()
  })

  it('shows the empty message when the version has no platforms', async () => {
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [] })
    renderRows()
    await waitFor(() => expect(screen.getByText(/No platforms synced yet/)).toBeInTheDocument())
  })

  it('falls back to the empty message when the request fails', async () => {
    getPublicTerraformVersionMock.mockRejectedValue(new Error('boom'))
    renderRows()
    await waitFor(() => expect(screen.getByText(/No platforms synced yet/)).toBeInTheDocument())
  })
})
