import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ModulesPage from '../ModulesPage'

// ---- Mocks ----

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

const searchModulesMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    searchModules: (...args: unknown[]) => searchModulesMock(...args),
  },
}))

// ---- Helpers ----

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithRoute(initialPath = '/modules') {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/modules" element={<ModulesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeModules = [
  {
    id: '1',
    namespace: 'hashicorp',
    name: 'consul',
    system: 'aws',
    description: 'Consul on AWS',
    latest_version: '1.0.0',
    download_count: 42,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
  },
  {
    id: '2',
    namespace: 'hashicorp',
    name: 'vault',
    system: 'azure',
    description: 'Vault on Azure',
    latest_version: '2.3.1',
    download_count: 100,
    created_at: '2025-02-01T00:00:00Z',
    updated_at: '2025-07-01T00:00:00Z',
  },
]

// ---- Tests ----

describe('ModulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchModulesMock.mockResolvedValue({
      modules: fakeModules,
      meta: { total: 2, limit: 12, offset: 0 },
    })
  })

  it('renders the page heading', async () => {
    renderWithRoute()
    expect(await screen.findByText('Terraform Modules')).toBeInTheDocument()
  })

  it('renders module cards returned by the API', async () => {
    renderWithRoute()
    expect(await screen.findByText('consul')).toBeInTheDocument()
    expect(screen.getByText('vault')).toBeInTheDocument()
  })

  // -- URL param sync --

  it('reads the initial search query from URL ?q= param', async () => {
    renderWithRoute('/modules?q=consul')
    // The search input should be pre-filled
    const input = await screen.findByPlaceholderText('Search modules...')
    expect(input).toHaveValue('consul')
  })

  it('reads the initial page from URL ?page= param', async () => {
    searchModulesMock.mockResolvedValue({
      modules: fakeModules,
      meta: { total: 50, limit: 12, offset: 12 },
    })
    // Force grid view so the paginated limit is 12 (grouped uses limit=100).
    renderWithRoute('/modules?page=2&view=grid')
    // The API should be called with offset 12 (page 2, limit 12)
    await screen.findByText('Terraform Modules')
    expect(searchModulesMock).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 12 }),
    )
  })

  it('reads sort/order from URL params and passes to API', async () => {
    renderWithRoute('/modules?sort=name&order=asc')
    await screen.findByText('Terraform Modules')
    expect(searchModulesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'name', order: 'asc' }),
    )
  })

  // -- Sort changes --

  it('changes sort via dropdown and passes new params to API', async () => {
    const user = userEvent.setup()
    renderWithRoute()
    await screen.findByText('consul')

    // Open the sort select dropdown
    const sortSelect = screen.getByLabelText('Sort By')
    await user.click(sortSelect)

    // Pick "Most Downloaded"
    const listbox = within(screen.getByRole('listbox'))
    await user.click(listbox.getByText('Most Downloaded'))

    // Wait for refetch - API should now include sort=downloads, order=desc
    await screen.findByText('consul')
    const calls = searchModulesMock.mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall.sort).toBe('downloads')
    expect(lastCall.order).toBe('desc')
  })

  // -- Empty state --

  it('shows empty state with "Clear filters" button when no results and query present', async () => {
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0, limit: 12, offset: 0 },
    })
    renderWithRoute('/modules?q=nonexistent')
    expect(await screen.findByText('No modules found')).toBeInTheDocument()
    expect(screen.getByText('Try a different search query or sort option')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('does not show "Clear filters" when empty state without query or sort', async () => {
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0, limit: 12, offset: 0 },
    })
    renderWithRoute('/modules')
    expect(await screen.findByText('No modules found')).toBeInTheDocument()
    expect(screen.getByText('Upload your first module to get started')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
  })

  it('shows "Clear filters" when no results but sort is active', async () => {
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0, limit: 12, offset: 0 },
    })
    renderWithRoute('/modules?sort=name&order=asc')
    expect(await screen.findByText('No modules found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('clicking "Clear filters" resets query and sort', async () => {
    const user = userEvent.setup()
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0, limit: 12, offset: 0 },
    })
    renderWithRoute('/modules?q=nope&sort=name&order=asc')
    const clearBtn = await screen.findByRole('button', { name: /clear filters/i })
    await user.click(clearBtn)

    // After clearing, the input should be empty (wait for state to propagate)
    const input = screen.getByPlaceholderText('Search modules...')
    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  // -- View mode toggle preserved --

  it('renders the view mode toggle buttons', async () => {
    renderWithRoute()
    await screen.findByText('consul')
    expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /grouped by provider/i })).toBeInTheDocument()
  })

  // -- View mode URL persistence --

  it('defaults to grouped view when no ?view= param is present', async () => {
    renderWithRoute()
    await screen.findByText('consul')
    // Grouped view renders provider section headers (e.g. "Aws", "Azure")
    expect(screen.getByText('Aws')).toBeInTheDocument()
    expect(screen.getByText('Azure')).toBeInTheDocument()
  })

  it('reads initial view mode from URL ?view=grid param', async () => {
    renderWithRoute('/modules?view=grid')
    await screen.findByText('consul')
    // Grid view does NOT render provider section headers
    expect(screen.queryByText('Aws')).not.toBeInTheDocument()
    expect(screen.queryByText('Azure')).not.toBeInTheDocument()
  })

  it('switching to grid view calls the API with the grid limit', async () => {
    const user = userEvent.setup()
    renderWithRoute()
    await screen.findByText('consul')
    await user.click(screen.getByRole('button', { name: /grid view/i }))
    // Grid view uses limit=12; grouped uses limit=100.
    await waitFor(() => {
      const lastCall = searchModulesMock.mock.calls[searchModulesMock.mock.calls.length - 1][0]
      expect(lastCall.limit).toBe(12)
    })
  })

  it('switching from grid back to grouped uses the grouped limit', async () => {
    const user = userEvent.setup()
    renderWithRoute('/modules?view=grid')
    await screen.findByText('consul')
    await user.click(screen.getByRole('button', { name: /grouped by provider/i }))
    await waitFor(() => {
      const lastCall = searchModulesMock.mock.calls[searchModulesMock.mock.calls.length - 1][0]
      expect(lastCall.limit).toBe(100)
    })
  })

  // -- Sort default + persistence --

  it('defaults to Name A-Z sort when no ?sort= is present', async () => {
    renderWithRoute()
    await screen.findByText('Terraform Modules')
    const lastCall = searchModulesMock.mock.calls[searchModulesMock.mock.calls.length - 1][0]
    expect(lastCall.sort).toBe('name')
    expect(lastCall.order).toBe('asc')
  })

  it('treats explicit ?sort=relevance as no sort/order to the API', async () => {
    renderWithRoute('/modules?sort=relevance')
    await screen.findByText('Terraform Modules')
    const lastCall = searchModulesMock.mock.calls[searchModulesMock.mock.calls.length - 1][0]
    expect(lastCall.sort).toBeUndefined()
    expect(lastCall.order).toBeUndefined()
  })

  it('renders the sort dropdown', async () => {
    renderWithRoute()
    await screen.findByText('consul')
    expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
  })
})
