import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { OIDCConfigResponse, Organization } from '../../../types'

// Real AxiosError instances mirror what the shared http client actually rejects
// with in production, so getErrorMessage's AxiosError-scoped sanitization runs
// (a plain { response: … } object would skip it and hit the generic fallback).
function axiosErrorWith(dataError: string, status = 500): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`)
  error.response = {
    status,
    statusText: 'Error',
    data: { error: dataError },
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

const getAdminOIDCConfigMock = vi.fn()
const updateOIDCGroupMappingMock = vi.fn()
const listOrganizationsMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    getAdminOIDCConfig: (...args: unknown[]) => getAdminOIDCConfigMock(...args),
    updateOIDCGroupMapping: (...args: unknown[]) => updateOIDCGroupMappingMock(...args),
    listOrganizations: (...args: unknown[]) => listOrganizationsMock(...args),
  },
}))

/** One page of organizations, as the API layer returns it since backend #893. */
const orgPage = (organizations: unknown[], hasMore = false, total: number | null = null) => ({
  organizations,
  hasMore,
  total,
})

import OIDCSettingsPage from '../OIDCSettingsPage'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const fakeConfig: OIDCConfigResponse = {
  id: 'oidc-1',
  name: 'Corporate IDP',
  provider_type: 'azure',
  issuer_url: 'https://login.example.com',
  client_id: 'client-abc-123',
  redirect_url: 'https://registry.example.com/callback',
  scopes: ['openid', 'profile'],
  is_active: true,
  group_claim_name: 'groups',
  default_role: 'viewer',
  group_mappings: [
    { group: 'platform-admins', organization: 'infra-team', role: 'admin' },
    { group: 'developers', organization: 'dev-org', role: 'publisher' },
  ],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
}

const fakeOrgs: Organization[] = [
  {
    id: 'org-1',
    name: 'infra-team',
    display_name: 'Infra Team',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'org-2',
    name: 'dev-org',
    display_name: 'Dev Org',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

describe('OIDCSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listOrganizationsMock.mockResolvedValue(orgPage(fakeOrgs))
  })

  it('shows loading spinner while fetching', () => {
    getAdminOIDCConfigMock.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<OIDCSettingsPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders heading and description after load', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('OIDC Groups')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Configure group claim mapping from your identity provider/),
    ).toBeInTheDocument()
  })

  it('renders active OIDC provider summary', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Active OIDC Provider')).toBeInTheDocument()
    })
    expect(screen.getByText('azure')).toBeInTheDocument()
    expect(screen.getByText('https://login.example.com')).toBeInTheDocument()
    expect(screen.getByText('client-abc-123')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Inactive chip when provider is not active', async () => {
    getAdminOIDCConfigMock.mockResolvedValue({ ...fakeConfig, is_active: false })
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('populates group claim name and default role from config', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('groups')).toBeInTheDocument()
    })
  })

  it('renders group mappings table with data', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('platform-admins')).toBeInTheDocument()
    })
    expect(screen.getByText('infra-team')).toBeInTheDocument()
    expect(screen.getByText('developers')).toBeInTheDocument()
    expect(screen.getByText('dev-org')).toBeInTheDocument()
    // Table headers
    expect(screen.getByText('IdP Group')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
  })

  it('shows empty message when no group mappings', async () => {
    getAdminOIDCConfigMock.mockResolvedValue({
      ...fakeConfig,
      group_mappings: [],
    })
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/No group mappings configured/)).toBeInTheDocument()
    })
  })

  it('opens add mapping dialog and adds a new mapping', async () => {
    getAdminOIDCConfigMock.mockResolvedValue({
      ...fakeConfig,
      group_mappings: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add Mapping'))
    expect(screen.getByText('Add Group Mapping')).toBeInTheDocument()

    // Fill in the group field
    const groupInput = screen.getByLabelText('IdP Group')
    await user.type(groupInput, 'qa-engineers')

    // Fill in the organization field
    const orgInput = screen.getByLabelText('Organization')
    await user.type(orgInput, 'qa-org')

    // Click Add
    const addButton = screen.getByRole('button', { name: 'Add' })
    await user.click(addButton)

    // Mapping should appear in the table
    await waitFor(() => {
      expect(screen.getByText('qa-engineers')).toBeInTheDocument()
    })
  })

  it('opens edit dialog for existing mapping', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('platform-admins')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByLabelText('Edit claim mapping')
    await user.click(editButtons[0])

    expect(screen.getByText('Edit Group Mapping')).toBeInTheDocument()
    expect(screen.getByDisplayValue('platform-admins')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('opens delete confirmation and removes a mapping', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('platform-admins')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByLabelText('Delete claim mapping')
    await user.click(deleteButtons[0])

    // Confirm dialog should appear
    expect(screen.getByText('Remove Group Mapping')).toBeInTheDocument()
    expect(screen.getByText(/Remove the mapping for group/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    // The mapping should be gone
    await waitFor(() => {
      expect(screen.queryByText('platform-admins')).not.toBeInTheDocument()
    })
    // The other mapping should still be there
    expect(screen.getByText('developers')).toBeInTheDocument()
  })

  it('calls save mutation and shows success message', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    updateOIDCGroupMappingMock.mockResolvedValue(fakeConfig)
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(updateOIDCGroupMappingMock).toHaveBeenCalledWith({
        group_claim_name: 'groups',
        group_mappings: fakeConfig.group_mappings,
        default_role: 'viewer',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Group mapping settings saved successfully.')).toBeInTheDocument()
    })
  })

  it('shows error alert when save mutation fails', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    updateOIDCGroupMappingMock.mockRejectedValue(axiosErrorWith('Permission denied', 403))
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })
  })

  it('shows error when query fails to load config', async () => {
    getAdminOIDCConfigMock.mockRejectedValue(axiosErrorWith('Unauthorized access', 401))
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Unauthorized access')).toBeInTheDocument()
    })
  })

  // ─── #601: leaked backend internals must never render verbatim (CWE-209) ──────
  // Before the fix both error paths read response.data.error and passed it
  // straight to setError() → rendered raw in the <Alert>. These reproduce that
  // bypass: they fail on the pre-fix code (the leaked token appears) and pass once
  // the paths route through getErrorMessage()/sanitizeServerErrorMessage().

  it('does not surface a leaked backend stack trace when config load fails (#601)', async () => {
    const leaked = 'panic: runtime error: invalid memory address\n\tgoroutine 12 [running]'
    getAdminOIDCConfigMock.mockRejectedValue(axiosErrorWith(leaked, 500))
    renderWithProviders(<OIDCSettingsPage />)
    // An error alert still appears (safe boilerplate), but not the raw internals.
    await screen.findByRole('alert')
    expect(screen.queryByText(/panic:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/goroutine/)).not.toBeInTheDocument()
  })

  it('does not surface a leaked backend SQL error when save fails (#601)', async () => {
    getAdminOIDCConfigMock.mockResolvedValue(fakeConfig)
    const leaked = 'pq: duplicate key value violates unique constraint "oidc_group_key"'
    updateOIDCGroupMappingMock.mockRejectedValue(axiosErrorWith(leaked, 409))
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Save Changes'))

    await screen.findByRole('alert')
    expect(screen.queryByText(/constraint/)).not.toBeInTheDocument()
    expect(screen.queryByText(/pq:/)).not.toBeInTheDocument()
  })

  it('cancel button closes the add dialog without adding', async () => {
    getAdminOIDCConfigMock.mockResolvedValue({
      ...fakeConfig,
      group_mappings: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<OIDCSettingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Mapping')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add Mapping'))
    expect(screen.getByText('Add Group Mapping')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('Add Group Mapping')).not.toBeInTheDocument()
    })
    expect(screen.getByText(/No group mappings configured/)).toBeInTheDocument()
  })
})
