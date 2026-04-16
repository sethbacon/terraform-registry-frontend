import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    roleTemplate: null,
    allowedScopes: [],
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    setToken: vi.fn(),
  }),
}))

vi.mock('../../components/ProviderIcon', () => ({
  ProviderIcon: ({ provider }: { provider: string }) => <span data-testid="provider-icon">{provider}</span>,
  providerDisplayName: (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1),
}))

const searchProvidersMock = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    searchProviders: (...args: unknown[]) => searchProvidersMock(...args),
  },
}))

import ProvidersPage from '../ProvidersPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage(initialPath = '/providers') {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/providers" element={<ProvidersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeProviders = [
  {
    id: 'p-1',
    namespace: 'hashicorp',
    type: 'aws',
    description: 'AWS provider',
    latest_version: '5.0.0',
    download_count: 1000,
    source: null,
  },
  {
    id: 'p-2',
    namespace: 'hashicorp',
    type: 'azurerm',
    description: 'Azure RM provider',
    latest_version: '3.0.0',
    download_count: 500,
    source: 'registry.terraform.io',
  },
]

describe('ProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton while fetching', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId('registry-item-grid-skeleton')).toBeInTheDocument()
  })

  it('renders page heading', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Terraform Providers')).toBeInTheDocument()
    expect(screen.getByText(/Browse and discover/)).toBeInTheDocument()
  })

  it('renders provider cards after load', async () => {
    searchProvidersMock.mockResolvedValue({
      providers: fakeProviders,
      meta: { total: 2 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('aws')).toBeInTheDocument()
      expect(screen.getByText('azurerm')).toBeInTheDocument()
    })
  })

  it('shows empty state when no providers found', async () => {
    searchProvidersMock.mockResolvedValue({
      providers: [],
      meta: { total: 0 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No providers found')).toBeInTheDocument()
    })
  })

  it('shows error when API fails', async () => {
    searchProvidersMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load providers. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows search field', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByPlaceholderText('Search providers...')).toBeInTheDocument()
  })

  it('shows sort dropdown', () => {
    searchProvidersMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
  })

  it('shows network mirrored chip for mirrored providers', async () => {
    searchProvidersMock.mockResolvedValue({
      providers: fakeProviders,
      meta: { total: 2 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Network Mirrored')).toBeInTheDocument()
    })
  })

  it('shows download counts', async () => {
    searchProvidersMock.mockResolvedValue({
      providers: fakeProviders,
      meta: { total: 2 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('1000 downloads')).toBeInTheDocument()
      expect(screen.getByText('500 downloads')).toBeInTheDocument()
    })
  })
})
