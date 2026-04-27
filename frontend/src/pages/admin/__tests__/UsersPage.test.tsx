import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- Mocks ----

const listUsersMock = vi.fn()
const searchUsersMock = vi.fn()
const listRoleTemplatesMock = vi.fn()
const getUserMembershipsMock = vi.fn()
const listOrganizationsMock = vi.fn()
const createUserMock = vi.fn()
const updateUserMock = vi.fn()
const deleteUserMock = vi.fn()
const addOrganizationMemberMock = vi.fn()
const updateOrganizationMemberMock = vi.fn()
const removeOrganizationMemberMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    searchUsers: (...args: unknown[]) => searchUsersMock(...args),
    listRoleTemplates: (...args: unknown[]) => listRoleTemplatesMock(...args),
    getUserMemberships: (...args: unknown[]) => getUserMembershipsMock(...args),
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    deleteUser: (...args: unknown[]) => deleteUserMock(...args),
    addOrganizationMember: (...args: unknown[]) => addOrganizationMemberMock(...args),
    updateOrganizationMember: (...args: unknown[]) => updateOrganizationMemberMock(...args),
    removeOrganizationMember: (...args: unknown[]) => removeOrganizationMemberMock(...args),
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

const fakeMembership = {
  organization_id: 'org-1',
  organization_name: 'Acme',
  role_template_id: 'rt-admin',
  role_template_name: 'admin',
  role_template_display_name: 'Administrator',
}

const fakeRoleTemplates = [
  { id: 'rt-admin', name: 'admin', display_name: 'Administrator' },
  { id: 'rt-viewer', name: 'viewer', display_name: 'Viewer' },
]

const fakeOrganizations = [
  { id: 'org-1', name: 'acme', display_name: 'Acme' },
  { id: 'org-2', name: 'beta', display_name: 'Beta' },
]

// ---- Tests ----

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listUsersMock.mockReturnValue(new Promise(() => {}))
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

  it('renders organization chips when memberships are present', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([fakeMembership])
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0)
    })
  })

  it('renders "No organizations" when memberships load empty', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('No organizations').length).toBeGreaterThan(0)
    })
  })

  it('opens Add User dialog when Add User is clicked', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add user/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('opens Edit User dialog when row edit is clicked', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([fakeMembership])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const editButtons = screen.getAllByRole('button', { name: /edit user/i })
    await userEvent.click(editButtons[0])
    await waitFor(() => expect(screen.getByText('Edit User')).toBeInTheDocument())
  })

  it('opens delete confirmation when delete is clicked', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const deleteButtons = screen.getAllByRole('button', { name: /delete user/i })
    await userEvent.click(deleteButtons[0])
    expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(0)
  })

  it('types in search input and triggers search endpoint', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    searchUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const search = screen.getByPlaceholderText('Search users...')
    fireEvent.change(search, { target: { value: 'alice' } })
    await waitFor(() => expect(searchUsersMock).toHaveBeenCalled())
  })

  it('creates a user via Add User dialog', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    createUserMock.mockResolvedValue({ id: 'u-new', email: 'c@example.com', name: 'Carol' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add user/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dialog = screen.getByRole('dialog')
    const emailInput = dialog.querySelector('input[type="email"]') as HTMLInputElement
    const nameInputs = dialog.querySelectorAll('input[type="text"]')
    fireEvent.change(emailInput, { target: { value: 'c@example.com' } })
    fireEvent.change(nameInputs[0], { target: { value: 'Carol' } })
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createUserMock).toHaveBeenCalled())
  })

  it('saves an edited user via Edit User dialog', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([fakeMembership])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    updateUserMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const editButtons = screen.getAllByRole('button', { name: /edit user/i })
    await userEvent.click(editButtons[0])
    await waitFor(() => expect(screen.getByText('Edit User')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(updateUserMock).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ name: expect.any(String) }),
      ),
    )
  })

  it('cancels Add User dialog', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add user/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('confirms deletion via the delete dialog', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    deleteUserMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const deleteButtons = screen.getAllByRole('button', { name: /delete user/i })
    await userEvent.click(deleteButtons[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const confirmBtns = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmBtns[confirmBtns.length - 1])
    await waitFor(() => expect(deleteUserMock).toHaveBeenCalledWith('u1'))
  })

  it('removes a membership in Edit User dialog', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([fakeMembership])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    removeOrganizationMemberMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const editButtons = screen.getAllByRole('button', { name: /edit user/i })
    await userEvent.click(editButtons[0])
    await waitFor(() => expect(screen.getByText('Edit User')).toBeInTheDocument())
    const removeBtn = await screen.findByRole('button', { name: /remove from organization/i })
    await userEvent.click(removeBtn)
    await waitFor(() => expect(removeOrganizationMemberMock).toHaveBeenCalledWith('org-1', 'u1'))
  })

  it('shows error alert when create user fails', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    listOrganizationsMock.mockResolvedValue(fakeOrganizations)
    listRoleTemplatesMock.mockResolvedValue(fakeRoleTemplates)
    createUserMock.mockRejectedValue(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add user/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dialog = screen.getByRole('dialog')
    const emailInput = dialog.querySelector('input[type="email"]') as HTMLInputElement
    const nameInputs = dialog.querySelectorAll('input[type="text"]')
    fireEvent.change(emailInput, { target: { value: 'x@example.com' } })
    fireEvent.change(nameInputs[0], { target: { value: 'X' } })
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument())
  })

  it('changes rows per page in pagination', async () => {
    listUsersMock.mockResolvedValue(fakeUsersResponse)
    getUserMembershipsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    const rowsSelect = screen.getByRole('combobox', { name: /rows per page/i })
    fireEvent.mouseDown(rowsSelect)
    const option25 = await screen.findByRole('option', { name: '25' })
    fireEvent.click(option25)
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith(1, 25)
    })
  })
})
