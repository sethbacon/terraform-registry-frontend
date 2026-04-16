import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const listOrganizationsMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
  },
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ allowedScopes: ['admin'], user: { id: 'u1' } }),
}))

import OrganizationsPage from '../OrganizationsPage'

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
        <OrganizationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeOrgs = [
  {
    id: 'org-1',
    name: 'acme-corp',
    display_name: 'Acme Corporation',
    created_at: '2025-03-15T10:00:00Z',
    updated_at: '2025-03-15T10:00:00Z',
  },
  {
    id: 'org-2',
    name: 'globex',
    display_name: 'Globex Inc',
    created_at: '2025-04-20T08:00:00Z',
    updated_at: '2025-04-20T08:00:00Z',
  },
]

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listOrganizationsMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and description after load', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Organizations')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Manage organizations and their members'),
    ).toBeInTheDocument()
  })

  it('shows org table with data', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('acme-corp')).toBeInTheDocument()
    })
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    expect(screen.getByText('globex')).toBeInTheDocument()
    expect(screen.getByText('Globex Inc')).toBeInTheDocument()
    // Table headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Display Name')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
  })

  it('shows Add Organization button', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Add Organization')).toBeInTheDocument()
    })
  })

  it('shows empty state when no organizations exist', async () => {
    listOrganizationsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No organizations found')).toBeInTheDocument()
    })
    expect(screen.getByText('Create First Organization')).toBeInTheDocument()
  })

  it('shows empty state when API fails', async () => {
    listOrganizationsMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    // Error alert is suppressed in DEV mode; component falls through to empty state
    await waitFor(() => {
      expect(screen.getByText('No organizations found')).toBeInTheDocument()
    })
  })
})
