import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ---- Mocks ----

const getDashboardStatsMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    getDashboardStats: (...args: unknown[]) => getDashboardStatsMock(...args),
  },
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: ['admin'] }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import DashboardPage from '../../admin/DashboardPage'

// ---- Helpers ----

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// ---- Mock data ----

const fakeDashboardData = {
  modules: {
    total: 15,
    versions: 42,
    downloads: 1200,
    by_system: [
      { system: 'aws', count: 10 },
      { system: 'azure', count: 5 },
    ],
  },
  providers: {
    total: 8,
    manual: 5,
    mirrored: 3,
    total_versions: 20,
    manual_versions: 12,
    mirrored_versions: 8,
    downloads: 800,
  },
  users: 25,
  organizations: 3,
  downloads: 2500,
  scm_providers: 2,
  binary_mirrors: {
    total: 2,
    healthy: 2,
    failed: 0,
    syncing: 0,
    platforms: 14,
    downloads: 500,
    by_tool: [
      { tool: 'terraform', platforms: 10 },
      { tool: 'opentofu', platforms: 4 },
    ],
  },
  provider_mirrors: { total: 3, healthy: 3, failed: 0 },
  scanning: {
    enabled: true,
    total: 42,
    pending: 2,
    clean: 38,
    findings: 1,
    error: 1,
  },
  recent_syncs: [
    {
      mirror_name: 'hashicorp-mirror',
      mirror_type: 'provider',
      status: 'success',
      started_at: '2025-06-01T12:00:00Z',
      versions_synced: 5,
      platforms_synced: 0,
      triggered_by: 'scheduler',
    },
    {
      mirror_name: 'terraform-binary',
      mirror_type: 'binary',
      status: 'failed',
      started_at: '2025-06-01T10:00:00Z',
      versions_synced: 0,
      platforms_synced: 0,
      triggered_by: 'manual',
    },
  ],
}

// ---- Tests ----

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while fetching', () => {
    getDashboardStatsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and subheading after load', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
    expect(screen.getByText('Registry health at a glance')).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Modules').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Providers').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total Downloads')).toBeInTheDocument()
    expect(screen.getByText('Terraform Binaries')).toBeInTheDocument()
  })

  it('shows health pills', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Binary Mirrors').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Provider Mirrors').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Storage').length).toBeGreaterThanOrEqual(1)
  })

  it('shows recent sync table entries', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('hashicorp-mirror')).toBeInTheDocument()
    })
    expect(screen.getByText('terraform-binary')).toBeInTheDocument()
  })

  it('shows Quick Links heading and link labels', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Quick Links')).toBeInTheDocument()
    })
    expect(screen.getByText('Upload Module')).toBeInTheDocument()
    expect(screen.getByText('Upload Provider')).toBeInTheDocument()
    expect(screen.getByText('Manage Users')).toBeInTheDocument()
  })

  it('shows error alert on API failure', async () => {
    getDashboardStatsMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard statistics.')).toBeInTheDocument()
    })
  })

  it('shows Refresh button', async () => {
    getDashboardStatsMock.mockResolvedValue(fakeDashboardData)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('shows empty sync message when no recent_syncs', async () => {
    getDashboardStatsMock.mockResolvedValue({
      ...fakeDashboardData,
      recent_syncs: [],
    })
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText('No sync history yet. Trigger a sync from the mirror pages.'),
      ).toBeInTheDocument()
    })
  })

  it('shows mirror failure alert when failed > 0', async () => {
    getDashboardStatsMock.mockResolvedValue({
      ...fakeDashboardData,
      binary_mirrors: {
        ...fakeDashboardData.binary_mirrors,
        failed: 1,
      },
    })
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText(
          'One or more mirrors have failed their last sync. Check the mirror pages for details.',
        ),
      ).toBeInTheDocument()
    })
  })
})
