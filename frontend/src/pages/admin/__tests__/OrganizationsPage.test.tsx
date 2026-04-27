import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const listOrganizationsMock = vi.fn()
const createOrganizationMock = vi.fn()
const updateOrganizationMock = vi.fn()
const deleteOrganizationMock = vi.fn()
const listOrganizationMembersMock = vi.fn()
const listRoleTemplatesMock = vi.fn()
const listUsersMock = vi.fn()
const addOrgMemberMock = vi.fn()
const updateOrgMemberMock = vi.fn()
const removeOrgMemberMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
    createOrganization: (...args: unknown[]) => createOrganizationMock(...args),
    updateOrganization: (...args: unknown[]) => updateOrganizationMock(...args),
    deleteOrganization: (...args: unknown[]) => deleteOrganizationMock(...args),
    listOrganizationMembers: (...args: unknown[]) => listOrganizationMembersMock(...args),
    listRoleTemplates: (...args: unknown[]) => listRoleTemplatesMock(...args),
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    addOrganizationMember: (...args: unknown[]) => addOrgMemberMock(...args),
    updateOrganizationMember: (...args: unknown[]) => updateOrgMemberMock(...args),
    removeOrganizationMember: (...args: unknown[]) => removeOrgMemberMock(...args),
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
    listOrganizationsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and description after load', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Organizations')).toBeInTheDocument()
    })
    expect(screen.getByText('Manage organizations and their members')).toBeInTheDocument()
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

  it('opens Add Organization dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add organization/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('opens Edit Organization dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const editBtns = screen.getAllByRole('button', { name: /edit organization/i })
    await userEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Edit Organization')).toBeInTheDocument())
  })

  it('opens Delete confirmation dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const delBtns = screen.getAllByRole('button', { name: /delete organization/i })
    await userEvent.click(delBtns[0])
    expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(0)
  })

  it('opens View Members dialog and loads members', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([
      {
        user_id: 'u1',
        organization_id: 'org-1',
        user_email: 'alice@example.com',
        user_name: 'Alice',
        role_template_id: 'rt-admin',
        role_template_name: 'admin',
        role_template_display_name: 'Administrator',
      },
    ])
    listRoleTemplatesMock.mockResolvedValue([
      { id: 'rt-admin', name: 'admin', display_name: 'Administrator' },
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const membersBtns = screen.getAllByRole('button', { name: /view members/i })
    await userEvent.click(membersBtns[0])
    await waitFor(() => expect(listOrganizationMembersMock).toHaveBeenCalledWith('org-1'))
  })

  it('creates a new organization via the Add dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    createOrganizationMock.mockResolvedValue({ id: 'new', name: 'newco' })
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add organization/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const nameInput = screen.getByLabelText(/^Name/i)
    await userEvent.type(nameInput, 'newco')
    const dnInput = screen.getByLabelText(/Display Name/i)
    await userEvent.type(dnInput, 'New Co')
    const saveBtn = screen.getByRole('button', { name: /^create$|^save$/i })
    await userEvent.click(saveBtn)
    await waitFor(() => expect(createOrganizationMock).toHaveBeenCalled())
  })

  it('shows "No organizations found" and allows creation from empty state', async () => {
    listOrganizationsMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('No organizations found')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /create first organization/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('cancels the Add Organization dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add organization/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('saves edits via the Edit Organization dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    updateOrganizationMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const editBtns = screen.getAllByRole('button', { name: /edit organization/i })
    await userEvent.click(editBtns[0])
    await waitFor(() => expect(screen.getByText('Edit Organization')).toBeInTheDocument())
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    await userEvent.click(saveBtn)
    await waitFor(() =>
      expect(updateOrganizationMock).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ display_name: 'Acme Corporation' }),
      ),
    )
  })

  it('deletes an organization via Delete confirmation dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    deleteOrganizationMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const delBtns = screen.getAllByRole('button', { name: /delete organization/i })
    await userEvent.click(delBtns[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const confirms = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(confirms[confirms.length - 1])
    await waitFor(() => expect(deleteOrganizationMock).toHaveBeenCalledWith('org-1'))
  })

  it('cancels the Delete confirmation dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    const delBtns = screen.getAllByRole('button', { name: /delete organization/i })
    await userEvent.click(delBtns[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deleteOrganizationMock).not.toHaveBeenCalled()
  })

  it('closes Members dialog via Close button', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([])
    listRoleTemplatesMock.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getAllByRole('button', { name: /view members/i })[0])
    await waitFor(() =>
      expect(screen.getByText(/Organization Members - acme-corp/i)).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() =>
      expect(screen.queryByText(/Organization Members - acme-corp/i)).not.toBeInTheDocument(),
    )
  })

  it('opens Add Member dialog from Members dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([])
    listRoleTemplatesMock.mockResolvedValue([
      { id: 'rt-admin', name: 'admin', display_name: 'Administrator', description: 'Full access' },
    ])
    listUsersMock.mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice', email: 'alice@example.com' }],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getAllByRole('button', { name: /view members/i })[0])
    await waitFor(() =>
      expect(screen.getByText(/Organization Members - acme-corp/i)).toBeInTheDocument(),
    )
    const addFirstBtns = screen.getAllByRole('button', { name: /add.*member/i })
    await userEvent.click(addFirstBtns[0])
    await waitFor(() => expect(screen.getByText(/Add Member to acme-corp/i)).toBeInTheDocument())
    await waitFor(() => expect(listUsersMock).toHaveBeenCalled())
  })

  it('cancels Add Member dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([])
    listRoleTemplatesMock.mockResolvedValue([])
    listUsersMock.mockResolvedValue({ users: [] })
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getAllByRole('button', { name: /view members/i })[0])
    await waitFor(() =>
      expect(screen.getByText(/Organization Members - acme-corp/i)).toBeInTheDocument(),
    )
    await userEvent.click(screen.getAllByRole('button', { name: /add.*member/i })[0])
    await waitFor(() => expect(screen.getByText(/Add Member to acme-corp/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() =>
      expect(screen.queryByText(/Add Member to acme-corp/i)).not.toBeInTheDocument(),
    )
    expect(addOrgMemberMock).not.toHaveBeenCalled()
  })

  it('renders existing members in Members dialog', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([
      {
        user_id: 'u1',
        organization_id: 'org-1',
        user_email: 'alice@example.com',
        user_name: 'Alice',
        role_template_id: 'rt-admin',
        role_template_name: 'admin',
        role_template_display_name: 'Administrator',
      },
    ])
    listRoleTemplatesMock.mockResolvedValue([
      { id: 'rt-admin', name: 'admin', display_name: 'Administrator' },
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getAllByRole('button', { name: /view members/i })[0])
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('removes a member via Remove member button', async () => {
    listOrganizationsMock.mockResolvedValue(fakeOrgs)
    listOrganizationMembersMock.mockResolvedValue([
      {
        user_id: 'u1',
        organization_id: 'org-1',
        user_email: 'alice@example.com',
        user_name: 'Alice',
        role_template_id: 'rt-admin',
        role_template_name: 'admin',
        role_template_display_name: 'Administrator',
      },
    ])
    listRoleTemplatesMock.mockResolvedValue([
      { id: 'rt-admin', name: 'admin', display_name: 'Administrator' },
    ])
    removeOrgMemberMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    await userEvent.click(screen.getAllByRole('button', { name: /view members/i })[0])
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /remove member/i }))
    await waitFor(() => expect(removeOrgMemberMock).toHaveBeenCalledWith('org-1', 'u1'))
  })

  // ── Phase 2: Identity Provider fields ─────────────────────────────────────
  it('shows Identity Provider column with IdP chip', async () => {
    const orgsWithIdp = [{ ...fakeOrgs[0], idp_type: 'saml', idp_name: 'Okta' }, { ...fakeOrgs[1] }]
    listOrganizationsMock.mockResolvedValue(orgsWithIdp)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    expect(screen.getByText('Identity Provider')).toBeInTheDocument()
    expect(screen.getByText('SAML: Okta')).toBeInTheDocument()
  })

  it('shows IdP chip without name when idp_name is empty', async () => {
    const orgsWithIdp = [{ ...fakeOrgs[0], idp_type: 'ldap' }]
    listOrganizationsMock.mockResolvedValue(orgsWithIdp)
    renderPage()
    await waitFor(() => expect(screen.getByText('acme-corp')).toBeInTheDocument())
    expect(screen.getByText('LDAP')).toBeInTheDocument()
  })
})
