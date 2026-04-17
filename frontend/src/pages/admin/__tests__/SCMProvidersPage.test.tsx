import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listSCMProvidersMock = vi.fn()
const getCurrentUserMembershipsMock = vi.fn()
const getSCMTokenStatusMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listSCMProviders: (...args: unknown[]) => listSCMProvidersMock(...args),
    getCurrentUserMemberships: (...args: unknown[]) => getCurrentUserMembershipsMock(...args),
    getSCMTokenStatus: (...args: unknown[]) => getSCMTokenStatusMock(...args),
    createSCMProvider: vi.fn(),
    updateSCMProvider: vi.fn(),
    deleteSCMProvider: vi.fn(),
    initiateSCMOAuth: vi.fn(),
    saveSCMToken: vi.fn(),
    revokeSCMToken: vi.fn(),
  },
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    allowedScopes: ['admin'],
    user: { id: 'u1', email: 'admin@example.com', name: 'Admin', role_template_name: 'admin' },
  }),
}))

import SCMProvidersPage from '../../admin/SCMProvidersPage'

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
        <SCMProvidersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeProviders = [
  {
    id: 'scm-1',
    name: 'GitHub Enterprise',
    type: 'github',
    base_url: 'https://github.example.com',
    client_id: 'abc123',
    active: true,
    created_at: '2025-01-01T00:00:00Z',
    oauth_callback_url: 'https://registry.example.com/callback',
  },
]

describe('SCMProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMembershipsMock.mockResolvedValue([])
    getSCMTokenStatusMock.mockResolvedValue({ connected: false })
  })

  it('shows loading spinner initially', () => {
    listSCMProvidersMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows empty state when no providers', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/no scm providers/i)).toBeInTheDocument()
    })
  })

  it('renders provider cards after loading', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument()
    })
  })

  it('shows Add Provider button', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add.*provider/i })).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    listSCMProvidersMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument()
    })
  })

  it('renders page heading', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/SCM Providers/i)).toBeInTheDocument()
    })
  })
})
