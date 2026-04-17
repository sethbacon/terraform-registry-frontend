import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listTerraformMirrorConfigsMock = vi.fn()
const getTerraformMirrorStatusMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listTerraformMirrorConfigs: (...args: unknown[]) => listTerraformMirrorConfigsMock(...args),
    getTerraformMirrorStatus: (...args: unknown[]) => getTerraformMirrorStatusMock(...args),
    createTerraformMirrorConfig: vi.fn(),
    updateTerraformMirrorConfig: vi.fn(),
    deleteTerraformMirrorConfig: vi.fn(),
    triggerTerraformMirrorSync: vi.fn(),
    listTerraformVersions: vi.fn().mockResolvedValue({ versions: [] }),
    listTerraformVersionPlatforms: vi.fn().mockResolvedValue({ platforms: [] }),
    deleteTerraformVersion: vi.fn(),
    getTerraformMirrorHistory: vi.fn().mockResolvedValue({ history: [] }),
  },
}))

import TerraformMirrorPage from '../../admin/TerraformMirrorPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TerraformMirrorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeConfigs = [
  {
    id: 'tm-1',
    name: 'terraform',
    tool: 'terraform',
    description: 'Terraform binary mirror',
    upstream_url: 'https://releases.hashicorp.com/terraform',
    enabled: true,
    auto_sync: true,
    created_at: '2025-01-01T00:00:00Z',
    version_count: 5,
    platform_count: 20,
  },
]

describe('TerraformMirrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTerraformMirrorStatusMock.mockResolvedValue({
      status: 'idle',
      last_sync: '2025-06-01T00:00:00Z',
    })
  })

  it('shows loading spinner initially', () => {
    listTerraformMirrorConfigsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows empty state when no configs', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/no.*mirror.*config/i)).toBeInTheDocument()
    })
  })

  it('renders config cards after loading', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('terraform').length).toBeGreaterThan(0)
    })
  })

  it('shows Add button', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add|create|new/i })).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    listTerraformMirrorConfigsMock.mockRejectedValue(new Error('Server error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/error|failed|server error/i)).toBeInTheDocument()
    })
  })

  it('renders page heading', async () => {
    listTerraformMirrorConfigsMock.mockResolvedValue({ configs: fakeConfigs })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Terraform.*Mirror/i)).toBeInTheDocument()
    })
  })
})
