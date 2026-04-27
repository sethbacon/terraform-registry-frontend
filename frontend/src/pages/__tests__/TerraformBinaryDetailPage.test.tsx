import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const listPublicTerraformMirrorConfigsMock = vi.fn()
const listPublicTerraformVersionsMock = vi.fn()
const getPublicTerraformVersionMock = vi.fn()
const deprecateTerraformVersionMock = vi.fn()
const undeprecateTerraformVersionMock = vi.fn()
const deleteTerraformVersionMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    listPublicTerraformMirrorConfigs: (...args: unknown[]) =>
      listPublicTerraformMirrorConfigsMock(...args),
    listPublicTerraformVersions: (...args: unknown[]) => listPublicTerraformVersionsMock(...args),
    getPublicTerraformVersion: (...args: unknown[]) => getPublicTerraformVersionMock(...args),
    deprecateTerraformVersion: (...args: unknown[]) => deprecateTerraformVersionMock(...args),
    undeprecateTerraformVersion: (...args: unknown[]) => undeprecateTerraformVersionMock(...args),
    deleteTerraformVersion: (...args: unknown[]) => deleteTerraformVersionMock(...args),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    allowedScopes: ['admin'],
  }),
}))

import TerraformBinaryDetailPage from '../TerraformBinaryDetailPage'

function renderPage(path = '/terraform/binaries/terraform') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/terraform/binaries/:name" element={<TerraformBinaryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const fakeConfig = {
  id: 'cfg-1',
  name: 'terraform',
  tool: 'terraform',
  description: 'Official Terraform binary',
  upstream_url: 'https://releases.hashicorp.com/terraform',
  enabled: true,
  auto_sync: true,
}

const fakeVersions = {
  versions: [
    {
      id: 'v-1',
      config_id: 'cfg-uuid-1',
      version: '1.8.0',
      published_at: '2025-06-01T00:00:00Z',
      deprecated: false,
      is_deprecated: false,
      is_latest: true,
      sync_status: 'synced',
      synced_at: '2025-06-01T00:00:00Z',
      platform_count: 10,
    },
    {
      id: 'v-2',
      config_id: 'cfg-uuid-1',
      version: '1.7.0',
      published_at: '2025-03-01T00:00:00Z',
      deprecated: true,
      is_deprecated: true,
      is_latest: false,
      sync_status: 'synced',
      synced_at: '2025-03-01T00:00:00Z',
      platform_count: 10,
    },
  ],
}

describe('TerraformBinaryDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [] })
  })

  it('shows loading spinner initially', () => {
    listPublicTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows error when config not found', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([])
    listPublicTerraformVersionsMock.mockResolvedValue({ versions: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument()
    })
  })

  it('shows error on API failure', async () => {
    listPublicTerraformMirrorConfigsMock.mockRejectedValue(new Error('Server error'))
    listPublicTerraformVersionsMock.mockRejectedValue(new Error('Server error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/failed to load details/i)).toBeInTheDocument()
    })
  })

  it('renders binary detail after loading', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('terraform')
    })
  })

  it('renders version table', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('1.8.0')).toBeInTheDocument()
    })
    expect(screen.getByText('1.7.0')).toBeInTheDocument()
  })

  it('shows back button', async () => {
    listPublicTerraformMirrorConfigsMock.mockRejectedValue(new Error('fail'))
    listPublicTerraformVersionsMock.mockRejectedValue(new Error('fail'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })
  })

  it('expands version row to show platform details', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
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
    renderPage()
    await waitFor(() => expect(screen.getByText('1.8.0')).toBeInTheDocument())
    const toggles = screen.getAllByRole('button', { name: /toggle version details/i })
    await userEvent.click(toggles[0])
    await waitFor(() => expect(screen.getByText('linux / amd64')).toBeInTheDocument())
  })

  it('shows empty platforms message when version has no platforms', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    getPublicTerraformVersionMock.mockResolvedValue({ platforms: [] })
    renderPage()
    await waitFor(() => expect(screen.getByText('1.8.0')).toBeInTheDocument())
    const toggles = screen.getAllByRole('button', { name: /toggle version details/i })
    await userEvent.click(toggles[0])
    await waitFor(() => expect(screen.getByText(/No platforms synced yet/)).toBeInTheDocument())
  })

  it('opens Deprecate dialog and deprecates a version', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    deprecateTerraformVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('1.8.0')).toBeInTheDocument())
    const deprecateBtn = screen.getByRole('button', { name: /^deprecate version$/i })
    await userEvent.click(deprecateBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dlgBtns = screen.getAllByRole('button', { name: /^deprecate$/i })
    await userEvent.click(dlgBtns[dlgBtns.length - 1])
    await waitFor(() =>
      expect(deprecateTerraformVersionMock).toHaveBeenCalledWith('cfg-uuid-1', '1.8.0'),
    )
  })

  it('opens Delete dialog and deletes a version', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    deleteTerraformVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('1.8.0')).toBeInTheDocument())
    const delBtns = screen.getAllByRole('button', { name: /delete version/i })
    await userEvent.click(delBtns[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const confirmBtns = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmBtns[confirmBtns.length - 1])
    await waitFor(() =>
      expect(deleteTerraformVersionMock).toHaveBeenCalledWith('cfg-uuid-1', '1.8.0'),
    )
  })

  it('undeprecates a deprecated version', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    undeprecateTerraformVersionMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('1.7.0')).toBeInTheDocument())
    const undepBtn = screen.getByRole('button', { name: /undeprecate version/i })
    await userEvent.click(undepBtn)
    await waitFor(() =>
      expect(undeprecateTerraformVersionMock).toHaveBeenCalledWith('cfg-uuid-1', '1.7.0'),
    )
  })

  it('cancels Deprecate dialog without action', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    renderPage()
    await waitFor(() => expect(screen.getByText('1.8.0')).toBeInTheDocument())
    const deprecateBtn = screen.getByRole('button', { name: /^deprecate version$/i })
    await userEvent.click(deprecateBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deprecateTerraformVersionMock).not.toHaveBeenCalled()
  })

  it('shows latest and deprecated chips on version rows', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue(fakeVersions)
    renderPage()
    await waitFor(() => expect(screen.getByText('latest')).toBeInTheDocument())
    expect(screen.getByText('deprecated')).toBeInTheDocument()
  })

  it('shows No versions alert when versions list is empty', async () => {
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([fakeConfig])
    listPublicTerraformVersionsMock.mockResolvedValue({ versions: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/No versions have been synced yet/)).toBeInTheDocument(),
    )
  })
})
