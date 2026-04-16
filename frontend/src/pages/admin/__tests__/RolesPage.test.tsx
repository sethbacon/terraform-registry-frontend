import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock api
const listRoleTemplatesMock = vi.fn()
vi.mock('../../../services/api', () => ({
  default: {
    listRoleTemplates: (...args: unknown[]) => listRoleTemplatesMock(...args),
  },
}))

import RolesPage from '../../admin/RolesPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <RolesPage />
    </QueryClientProvider>,
  )
}

const fakeRoles = [
  {
    id: 'r-1',
    name: 'viewer',
    display_name: 'Viewer',
    description: 'Read-only access to modules and providers',
    scopes: ['modules:read', 'providers:read'],
    is_system: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'r-2',
    name: 'admin',
    display_name: 'Administrator',
    description: 'Full access to all features',
    scopes: ['admin'],
    is_system: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'r-3',
    name: 'publisher',
    display_name: 'Publisher',
    description: 'Can upload modules and providers',
    scopes: ['modules:read', 'modules:write', 'providers:read', 'providers:write'],
    is_system: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

describe('RolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listRoleTemplatesMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and description after loading', async () => {
    listRoleTemplatesMock.mockResolvedValue(fakeRoles)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Roles & Permissions')).toBeInTheDocument()
    })
    expect(screen.getByText(/View the available roles/)).toBeInTheDocument()
  })

  it('renders the scope reference table', async () => {
    listRoleTemplatesMock.mockResolvedValue(fakeRoles)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Available Scopes Reference')).toBeInTheDocument()
    })
    // Multiple elements may exist since scopes appear in both reference table and role details
    expect(screen.getAllByText('Modules Read').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Administrator').length).toBeGreaterThanOrEqual(1)
  })

  it('renders role template list', async () => {
    listRoleTemplatesMock.mockResolvedValue(fakeRoles)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Role Templates')).toBeInTheDocument()
    })
    expect(screen.getByText('Viewer')).toBeInTheDocument()
    expect(screen.getByText('Publisher')).toBeInTheDocument()
  })

  it('shows scope count for each role', async () => {
    listRoleTemplatesMock.mockResolvedValue(fakeRoles)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('2 scopes')).toBeInTheDocument() // viewer
      expect(screen.getByText('1 scope')).toBeInTheDocument()  // admin
      expect(screen.getByText('4 scopes')).toBeInTheDocument() // publisher
    })
  })

  it('shows no roles found when empty', async () => {
    listRoleTemplatesMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No roles found.')).toBeInTheDocument()
    })
  })

  it('shows error when API fails', async () => {
    listRoleTemplatesMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Failed to load roles. Please try again.')).toBeInTheDocument()
    })
  })
})
