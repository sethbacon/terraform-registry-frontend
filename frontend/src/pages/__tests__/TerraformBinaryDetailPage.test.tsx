import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const listPublicTerraformMirrorConfigsMock = vi.fn()
const listPublicTerraformVersionsMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    listPublicTerraformMirrorConfigs: (...args: unknown[]) =>
      listPublicTerraformMirrorConfigsMock(...args),
    listPublicTerraformVersions: (...args: unknown[]) =>
      listPublicTerraformVersionsMock(...args),
    getPublicTerraformVersion: vi.fn().mockResolvedValue({ platforms: [] }),
    deprecateTerraformVersion: vi.fn(),
    undeprecateTerraformVersion: vi.fn(),
    deleteTerraformVersion: vi.fn(),
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
      version: '1.8.0',
      published_at: '2025-06-01T00:00:00Z',
      deprecated: false,
      platform_count: 10,
    },
    {
      version: '1.7.0',
      published_at: '2025-03-01T00:00:00Z',
      deprecated: false,
      platform_count: 10,
    },
  ],
}

describe('TerraformBinaryDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listPublicTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => { }))
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
})
