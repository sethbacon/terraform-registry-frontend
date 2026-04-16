import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- Mocks ----

const listUsersMock = vi.fn()
const searchUsersMock = vi.fn()
const listRoleTemplatesMock = vi.fn()
const getUserMembershipsMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    searchUsers: (...args: unknown[]) => searchUsersMock(...args),
    listRoleTemplates: (...args: unknown[]) => listRoleTemplatesMock(...args),
    getUserMemberships: (...args: unknown[]) => getUserMembershipsMock(...args),
  },
}))

import UsersPage from '../../admin/UsersPage'

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

function renderPage() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const fakeUsersResponse = {
  users: [
    {
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      role_template_name: 'admin',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
    },
    {
      id: 'u2',
      email: 'bob@example.com',
      name: 'Bob Jones',
      role_template_name: 'viewer',
      created_at: '2025-02-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 20 },
}

// ---- Tests ----

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listUsersMock.mockReturnValue(new Promise(() => { }))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading after data loads', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument()
    })
    expect(screen.getByText('Manage user accounts and permissions')).toBeInTheDocument()
  })

  it('renders user table with email and name data', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('shows search field', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument()
    })
  })

  it('shows empty state when no users returned', async () => {
    listUsersMock.mockResolvedValue({
      users: [],
      pagination: { total: 0, page: 1, per_page: 20 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  it('shows Add User button', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    listUsersMock.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load users/)).toBeInTheDocument()
    })
  })
})
