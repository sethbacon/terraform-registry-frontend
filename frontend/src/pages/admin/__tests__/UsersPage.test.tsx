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
const exportUserDataMock = vi.fn()
const eraseUserMock = vi.fn()

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
    exportUserData: (...args: unknown[]) => exportUserDataMock(...args),
    eraseUser: (...args: unknown[]) => eraseUserMock(...args),
  },
}))

// Default to admin scope so existing tests pass; individual tests can override.
const useAuthMock = vi.fn(() => ({
  allowedScopes: ['admin'],
  roleTemplate: { display_name: 'Administrator' },
  user: { id: 'user-1' },
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
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

  it('uses inline memberships and skips individual getUserMemberships calls', async () => {
    // When the list response already includes memberships on each user,
    // the page must NOT fire individual GET /users/{id}/memberships requests.
    const responseWithInlineMemberships = {
      ...fakeUsersResponse,
      users: fakeUsersResponse.users.map((u) => ({
        ...u,
        memberships: [fakeMembership],
      })),
    }
    listUsersMock.mockResolvedValue(responseWithInlineMemberships)

    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0)
    })

    // The individual membership fetches must not have been called
    expect(getUserMembershipsMock).not.toHaveBeenCalled()
  })

  // ---- GDPR actions (admin-scoped) ----

  describe('GDPR actions', () => {
    beforeEach(() => {
      // Reset to admin for this group; individual tests can override.
      useAuthMock.mockReturnValue({
        allowedScopes: ['admin'],
        roleTemplate: { display_name: 'Administrator' },
        user: { id: 'user-1' },
      })
      listUsersMock.mockResolvedValue(fakeUsersResponse)
      getUserMembershipsMock.mockResolvedValue([])
    })

    it('shows export and erase buttons for admin users', async () => {
      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      // Two users x two GDPR buttons each = 4 admin-only icon buttons.
      expect(screen.getAllByLabelText('Export user data')).toHaveLength(2)
      expect(screen.getAllByLabelText('Erase user data')).toHaveLength(2)
    })

    it('hides GDPR buttons for non-admin users', async () => {
      useAuthMock.mockReturnValue({
        allowedScopes: ['users:read', 'users:write'],
        roleTemplate: { display_name: 'User Manager' },
        user: { id: 'user-1' },
      })
      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      expect(screen.queryByLabelText('Export user data')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Erase user data')).not.toBeInTheDocument()
      // Edit is still available to non-admins (it's the existing behavior).
      expect(screen.getAllByLabelText('Edit user').length).toBeGreaterThan(0)
    })

    it('triggers a browser download when export succeeds', async () => {
      const blob = new Blob(['{"user":"data"}'], { type: 'application/json' })
      exportUserDataMock.mockResolvedValue({ blob, filename: 'user-data-u1.json' })

      // Stub URL APIs that JSDOM doesn't implement.
      const createURL = vi.fn(() => 'blob:mock-url')
      const revokeURL = vi.fn()
      const origCreate = (URL as unknown as { createObjectURL?: typeof createURL }).createObjectURL
      const origRevoke = (URL as unknown as { revokeObjectURL?: typeof revokeURL }).revokeObjectURL
      ;(URL as unknown as { createObjectURL: typeof createURL }).createObjectURL = createURL
      ;(URL as unknown as { revokeObjectURL: typeof revokeURL }).revokeObjectURL = revokeURL

      try {
        renderPage()
        await waitFor(() => screen.getByText('alice@example.com'))

        const exportButtons = screen.getAllByLabelText('Export user data')
        fireEvent.click(exportButtons[0])

        await waitFor(() => expect(exportUserDataMock).toHaveBeenCalledWith('u1'))
        expect(createURL).toHaveBeenCalledWith(blob)
        expect(revokeURL).toHaveBeenCalledWith('blob:mock-url')
        await waitFor(() =>
          expect(screen.getByText(/Exported user data for alice@example\.com/)).toBeInTheDocument(),
        )
      } finally {
        if (origCreate) {
          ;(URL as unknown as { createObjectURL: typeof origCreate }).createObjectURL = origCreate
        }
        if (origRevoke) {
          ;(URL as unknown as { revokeObjectURL: typeof origRevoke }).revokeObjectURL = origRevoke
        }
      }
    })

    it('shows an error alert when export fails', async () => {
      exportUserDataMock.mockRejectedValue(new Error('export blew up'))

      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      const exportButtons = screen.getAllByLabelText('Export user data')
      fireEvent.click(exportButtons[0])

      await waitFor(() =>
        expect(screen.getByText(/export blew up/)).toBeInTheDocument(),
      )
    })

    it('opens the erase confirmation dialog and requires email match', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      const eraseButtons = screen.getAllByLabelText('Erase user data')
      fireEvent.click(eraseButtons[0])

      // Dialog should be open with destructive copy referencing the email.
      await waitFor(() =>
        expect(screen.getByText(/permanently anonymizes/i)).toBeInTheDocument(),
      )

      // Erase button starts disabled because confirm text is empty.
      const confirm = screen.getByRole('button', { name: /^Erase$/ })
      expect(confirm).toBeDisabled()

      // Wrong email keeps it disabled.
      const input = screen.getByLabelText('Confirm erasure by typing the user email')
      await user.type(input, 'wrong@example.com')
      expect(confirm).toBeDisabled()

      // Correct email enables it.
      await user.clear(input)
      await user.type(input, 'alice@example.com')
      expect(confirm).not.toBeDisabled()
    })

    it('calls eraseUser and shows success when confirmed', async () => {
      const user = userEvent.setup()
      eraseUserMock.mockResolvedValue({
        message: 'User data has been erased.',
        user_id: 'u1',
      })

      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      const eraseButtons = screen.getAllByLabelText('Erase user data')
      fireEvent.click(eraseButtons[0])

      const input = await screen.findByLabelText('Confirm erasure by typing the user email')
      await user.type(input, 'alice@example.com')

      fireEvent.click(screen.getByRole('button', { name: /^Erase$/ }))

      await waitFor(() => expect(eraseUserMock).toHaveBeenCalledWith('u1'))
      await waitFor(() =>
        expect(screen.getByText(/User data has been erased/)).toBeInTheDocument(),
      )
    })

    it('surfaces backend error when erase fails', async () => {
      const user = userEvent.setup()
      eraseUserMock.mockRejectedValue(new Error('erase blew up'))

      renderPage()
      await waitFor(() => screen.getByText('alice@example.com'))

      const eraseButtons = screen.getAllByLabelText('Erase user data')
      fireEvent.click(eraseButtons[0])

      const input = await screen.findByLabelText('Confirm erasure by typing the user email')
      await user.type(input, 'alice@example.com')

      fireEvent.click(screen.getByRole('button', { name: /^Erase$/ }))

      await waitFor(() =>
        expect(screen.getByText(/erase blew up/)).toBeInTheDocument(),
      )
    })
  })
})
