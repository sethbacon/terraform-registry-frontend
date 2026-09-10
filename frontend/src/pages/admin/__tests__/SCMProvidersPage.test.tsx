import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

const listSCMProvidersMock = vi.fn()
const getSCMTokenStatusMock = vi.fn()
const createSCMProviderMock = vi.fn()
const updateSCMProviderMock = vi.fn()
const deleteSCMProviderMock = vi.fn()
const initiateSCMOAuthMock = vi.fn()
const saveSCMTokenMock = vi.fn()
const revokeSCMTokenMock = vi.fn()
const verifySCMProviderMock = vi.fn()
const getSCMCapabilitiesMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listSCMProviders: (...args: unknown[]) => listSCMProvidersMock(...args),
    getSCMTokenStatus: (...args: unknown[]) => getSCMTokenStatusMock(...args),
    createSCMProvider: (...args: unknown[]) => createSCMProviderMock(...args),
    updateSCMProvider: (...args: unknown[]) => updateSCMProviderMock(...args),
    deleteSCMProvider: (...args: unknown[]) => deleteSCMProviderMock(...args),
    initiateSCMOAuth: (...args: unknown[]) => initiateSCMOAuthMock(...args),
    saveSCMToken: (...args: unknown[]) => saveSCMTokenMock(...args),
    revokeSCMToken: (...args: unknown[]) => revokeSCMTokenMock(...args),
    verifySCMProvider: (...args: unknown[]) => verifySCMProviderMock(...args),
    getSCMCapabilities: (...args: unknown[]) => getSCMCapabilitiesMock(...args),
  },
}))

let mockAllowedScopes: string[] = ['admin']
// Real per-organization memberships, as useAuth has published since #795. They
// default the create form's destination organization, and (for a caller who is
// not a platform admin) supply the organization filter's options (#779).
let mockMemberships: Array<{ organization_id: string; organization_name: string }> = []

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    allowedScopes: mockAllowedScopes,
    memberships: mockMemberships,
    // As the suite provider resolves it: one membership is the acting
    // organization without picking; several means nothing chosen yet.
    currentOrganizationId: mockMemberships.length === 1 ? mockMemberships[0].organization_id : null,
    user: { id: 'u1', email: 'admin@example.com', name: 'Admin', role_template_name: 'admin' },
  }),
}))

import SCMProvidersPage from '../../admin/SCMProvidersPage'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function renderPage(initialEntries: string[] = ['/admin/scm-providers']) {
  const qc = createQueryClient()
  // The organization filter keeps its selection in the URL (#779);
  // initialEntries is how a test starts already filtered.
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <SCMProvidersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/**
 * A real AxiosError — getErrorStatus() narrows with `instanceof`, so a
 * duck-typed object would read as status-less and silently take the generic
 * branch, making the 403 guard below pass for the wrong reason.
 */
function axiosFailure(status: number, message: string): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      status,
      statusText: 'Error',
      headers: {},
      config: { headers: {} },
      data: { error: message },
    } as never,
  )
}

const fakeProviders = [
  {
    id: 'scm-1',
    organization_id: 'org-1',
    name: 'GitHub Enterprise',
    provider_type: 'github' as const,
    base_url: 'https://github.example.com',
    client_id: 'abc123',
    webhook_secret: 'wh-secret',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    oauth_callback_url: 'https://registry.example.com/callback',
  },
]

const fakeMemberships = [
  {
    organization_id: 'org-1',
    organization_name: 'Acme',
    role_template_id: 'rt',
    role_template_name: 'admin',
    role_template_display_name: 'Admin',
  },
]

describe('SCMProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowedScopes = ['admin']
    mockMemberships = []
    getSCMTokenStatusMock.mockResolvedValue({ connected: false })
  })

  // ── canManage gates credential-mutation controls (#609) ────────────────────

  it('hides Add/Edit/Delete/Connect provider controls for the scm:read scope', async () => {
    mockAllowedScopes = ['scm:read']
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())

    // View access is unaffected — the viewer still sees the provider list.
    expect(screen.queryByRole('button', { name: /add.*provider/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit scm provider/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete scm provider/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect scm provider/i })).not.toBeInTheDocument()
  })

  it('hides Test connection for app-mode providers under the scm:read scope', async () => {
    mockAllowedScopes = ['scm:read']
    const appProvider = [
      {
        ...fakeProviders[0],
        id: 'scm-app',
        name: 'ADO App',
        provider_type: 'azuredevops' as const,
        auth_mode: 'entra_app' as const,
      },
    ]
    listSCMProvidersMock.mockResolvedValue(appProvider)
    renderPage()
    await waitFor(() => expect(screen.getByText('ADO App')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /test connection/i })).not.toBeInTheDocument()
  })

  it('shows Add/Edit/Delete/Connect provider controls for the canonical scm:manage scope', async () => {
    mockAllowedScopes = ['scm:manage']
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /add.*provider/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit scm provider/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete scm provider/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect scm provider/i })).toBeInTheDocument()
  })

  it('shows loading spinner initially', () => {
    listSCMProvidersMock.mockReturnValue(new Promise(() => {}))
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

  it('shows Active chip for active providers', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Connected status when token is connected', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    getSCMTokenStatusMock.mockResolvedValue({
      connected: true,
      token_type: 'oauth',
      connected_at: '2025-06-01T00:00:00Z',
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument())
    expect(screen.getByText('OAuth')).toBeInTheDocument()
  })

  it('shows Not connected when token is not connected', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    getSCMTokenStatusMock.mockResolvedValue({ connected: false })
    renderPage()
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument())
  })

  it('opens create provider dialog', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    mockMemberships = fakeMemberships
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
  })

  it('opens edit dialog when edit icon is clicked', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
  })

  it('opens delete confirmation dialog', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete scm provider/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('deletes a provider after confirmation', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    deleteSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete scm provider/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const dlgButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await userEvent.click(dlgButtons[dlgButtons.length - 1])
    await waitFor(() => expect(deleteSCMProviderMock).toHaveBeenCalledWith('scm-1'))
  })

  it('initiates OAuth when Connect is clicked on OAuth provider', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    initiateSCMOAuthMock.mockResolvedValue({ authorization_url: 'https://oauth.example.com/auth' })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(initiateSCMOAuthMock).toHaveBeenCalledWith('scm-1'))
  })

  // Regression guard (#559): authorization_url comes from the backend; it must be
  // validated at the app boundary before this full-page redirect navigation sink,
  // instead of trusting it verbatim (unvalidated redirect).
  it('refuses to redirect when the OAuth authorization URL is unsafe', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    initiateSCMOAuthMock.mockResolvedValue({ authorization_url: '//evil.com/steal-session' })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(initiateSCMOAuthMock).toHaveBeenCalledWith('scm-1'))
    expect(window.location.href).toBe('')
    expect(
      screen.getByText('The OAuth provider returned an invalid authorization URL'),
    ).toBeInTheDocument()
  })

  it('opens PAT dialog for Bitbucket Data Center provider', async () => {
    const bbProvider = [
      { ...fakeProviders[0], provider_type: 'bitbucket_dc' as const, name: 'BB DC' },
    ]
    listSCMProvidersMock.mockResolvedValue(bbProvider)
    renderPage()
    await waitFor(() => expect(screen.getByText('BB DC')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('shows Refresh button that re-fetches providers', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    listSCMProvidersMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(listSCMProvidersMock).toHaveBeenCalled())
  })

  it('cancels create dialog without saving', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    mockMemberships = fakeMemberships
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByText('Add SCM Provider')).not.toBeInTheDocument())
  })

  it('creates a new provider via Add dialog', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    mockMemberships = fakeMemberships
    createSCMProviderMock.mockResolvedValue({ id: 'new-scm' })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'My ADO')
    await userEvent.type(screen.getByLabelText(/Tenant ID/i), 'tenant-123')
    await userEvent.type(screen.getByLabelText(/^App ID/i), 'client-123')
    await userEvent.type(screen.getByLabelText(/Client Secret/i), 'secret-456')
    await userEvent.type(screen.getByLabelText(/Base URL/i), 'https://dev.azure.com/acme')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createSCMProviderMock).toHaveBeenCalled())
    expect(createSCMProviderMock.mock.calls[0][0].provider_type).toBe('azuredevops')
  })

  it('opens the Add dialog on Azure DevOps rather than GitHub', async () => {
    // Azure DevOps is the provider operators add here; defaulting to GitHub
    // made the Tenant ID and organization-bearing Base URL fields absent until
    // the type was changed, which is easy to miss.
    listSCMProvidersMock.mockResolvedValue([])
    mockMemberships = fakeMemberships
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())

    expect(screen.getByLabelText(/provider type/i)).toHaveTextContent(/azure devops/i)
    expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument()
  })

  it('creates a GitHub App provider with app fields and no client secret', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    mockMemberships = fakeMemberships
    createSCMProviderMock.mockResolvedValue({ id: 'gh-app' })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'GH App')
    // provider_type defaults to azuredevops; switch to GitHub, then to the
    // shared app credential mode.
    await userEvent.click(screen.getByRole('combobox', { name: /Provider Type/i }))
    await userEvent.click(await screen.findByRole('option', { name: /^GitHub$/ }))
    await userEvent.click(screen.getByRole('combobox', { name: /Authentication/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Shared app credential/i }))
    await userEvent.type(screen.getByLabelText(/GitHub App ID/i), '12345')
    await userEvent.type(screen.getByLabelText(/Installation ID/i), '67890')
    await userEvent.type(screen.getByLabelText(/Private Key/i), 'fake-pem')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createSCMProviderMock).toHaveBeenCalled())
    const payload = createSCMProviderMock.mock.calls[0][0]
    expect(payload.auth_mode).toBe('github_app')
    expect(payload.github_app_id).toBe('12345')
    expect(payload.github_installation_id).toBe('67890')
    expect(payload.app_private_key).toBe('fake-pem')
    // The client secret field is not rendered in app mode, so none is sent.
    expect(payload.client_secret).toBeFalsy()
  })

  it('verifies an app-mode provider via Test connection', async () => {
    const appProvider = [
      {
        ...fakeProviders[0],
        id: 'scm-app',
        name: 'ADO App',
        provider_type: 'azuredevops' as const,
        auth_mode: 'entra_app' as const,
      },
    ]
    listSCMProvidersMock.mockResolvedValue(appProvider)
    verifySCMProviderMock.mockResolvedValue({ ok: true, expires_at: '2026-01-01T00:00:00Z' })
    renderPage()
    await waitFor(() => expect(screen.getByText('ADO App')).toBeInTheDocument())
    // App-mode providers expose Test connection, not the per-user Connect button.
    expect(screen.queryByRole('button', { name: /connect scm provider/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /test connection/i }))
    await waitFor(() => expect(verifySCMProviderMock).toHaveBeenCalledWith('scm-app'))
    await waitFor(() => expect(screen.getByText('Connection OK')).toBeInTheDocument())
  })

  it('cancels the delete dialog without deleting', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete scm provider/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deleteSCMProviderMock).not.toHaveBeenCalled()
  })

  it('saves PAT for Bitbucket DC via PAT dialog', async () => {
    const bbProvider = [
      { ...fakeProviders[0], provider_type: 'bitbucket_dc' as const, name: 'BB DC' },
    ]
    listSCMProvidersMock.mockResolvedValue(bbProvider)
    saveSCMTokenMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('BB DC')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(screen.getByLabelText(/Personal Access Token/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/Personal Access Token/i), 'bbdc-pat')
    await userEvent.click(screen.getByRole('button', { name: /save token/i }))
    await waitFor(() => expect(saveSCMTokenMock).toHaveBeenCalledWith('scm-1', 'bbdc-pat'))
  })

  it('cancels the PAT dialog', async () => {
    const bbProvider = [
      { ...fakeProviders[0], provider_type: 'bitbucket_dc' as const, name: 'BB DC' },
    ]
    listSCMProvidersMock.mockResolvedValue(bbProvider)
    renderPage()
    await waitFor(() => expect(screen.getByText('BB DC')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(screen.getByLabelText(/Personal Access Token/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/Personal Access Token/i)).not.toBeInTheDocument(),
    )
    expect(saveSCMTokenMock).not.toHaveBeenCalled()
  })

  it('revokes token via Disconnect button when provider is connected', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    getSCMTokenStatusMock.mockResolvedValue({
      connected: true,
      token_type: 'oauth',
      connected_at: '2025-06-01T00:00:00Z',
    })
    revokeSCMTokenMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /disconnect scm provider/i }))
    await waitFor(() => expect(revokeSCMTokenMock).toHaveBeenCalledWith('scm-1'))
  })

  it('updates an existing provider via Edit dialog', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/Client Secret/i), 'updated-secret')
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() =>
      expect(updateSCMProviderMock).toHaveBeenCalledWith('scm-1', expect.any(Object)),
    )
  })

  // #909 — the dialog says "Leave blank to keep existing secret". These pin that
  // it is now true. They assert on the REQUEST BODY rather than on the call
  // happening at all: the broken version also called updateSCMProvider, also
  // resolved, and for an oauth_user provider destroyed the stored secret while
  // reporting success.
  it('omits client_secret entirely when the operator leaves it blank', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    // Change something else, and never touch the secret.
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect('client_secret' in body).toBe(false)
    expect('app_private_key' in body).toBe(false)
  })

  it('sends a client secret the operator typed', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/Client Secret/i), 'rotated-secret')
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    expect(updateSCMProviderMock.mock.calls[0][1].client_secret).toBe('rotated-secret')
  })

  it('offers no removal control for a provider that has no stored secret', async () => {
    // fakeProviders[0] carries no has_client_secret, so there is nothing to
    // remove and the control must not be offered -- otherwise it would send ""
    // for a provider whose secret was never set.
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    expect(screen.queryByLabelText(/remove the stored client secret/i)).not.toBeInTheDocument()
  })

  it('sends an empty client_secret when removal is explicitly requested', async () => {
    listSCMProvidersMock.mockResolvedValue([{ ...fakeProviders[0], has_client_secret: true }])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/remove the stored client secret/i))
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect('client_secret' in body).toBe(true)
    expect(body.client_secret).toBe('')
  })

  it('does not carry a removal intent into the next provider edited', async () => {
    listSCMProvidersMock.mockResolvedValue([{ ...fakeProviders[0], has_client_secret: true }])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/remove the stored client secret/i))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByText('Edit Provider')).not.toBeInTheDocument())

    // Reopen. A checkbox left ticked from the abandoned edit would silently
    // destroy the credential on the next save.
    //
    // findByRole rather than getByRole: MUI keeps the page behind a closing
    // dialog aria-hidden for the duration of the transition, so the button is
    // briefly unreachable even after the dialog's title has gone.
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    expect(screen.getByLabelText(/remove the stored client secret/i)).not.toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    expect('client_secret' in updateSCMProviderMock.mock.calls[0][1]).toBe(false)
  })

  // #908 — workload identity federation. The credential type is Azure DevOps
  // only, and a federated provider carries neither a tenant id nor a secret:
  // the platform projects a token and the row records only which identity to
  // assume. The backend rejects both if sent.
  const adoProvider = {
    ...fakeProviders[0],
    id: 'scm-ado',
    name: 'Azure DevOps',
    provider_type: 'azuredevops' as const,
    base_url: 'https://dev.azure.com/acme',
    tenant_id: 'tenant-1',
    auth_mode: 'entra_app' as const,
    has_client_secret: true,
  }

  it('offers no credential type for a non-Azure-DevOps provider', () => {
    // The column is meaningless outside entra_app, and offering it on a GitHub
    // provider would invite a value the backend refuses.
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    return waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument()).then(
      async () => {
        await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
        await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
        expect(screen.queryByLabelText(/credential type/i)).not.toBeInTheDocument()
      },
    )
  })

  it('offers no credential type for an Azure DevOps provider on per-user OAuth', async () => {
    // The column is only read when auth_mode is entra_app -- the backend's shape
    // CHECK is scoped to it. Offering the control on an oauth_user provider lets
    // an operator set a value that is stored and then never consulted, which
    // reads as "I chose federation" while the provider still uses OAuth.
    listSCMProvidersMock.mockResolvedValue([{ ...adoProvider, auth_mode: 'oauth_user' as const }])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    expect(screen.queryByLabelText(/credential type/i)).not.toBeInTheDocument()
  })

  it('renders an existing provider with no credential type as Client secret', async () => {
    // The whole installed base has no value in this column; reading absent as
    // anything but client_secret would reclassify every existing provider.
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    // The card shows "Azure DevOps" as both the name and the provider-type
    // label, so wait on the control being clicked rather than the text.
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    expect(screen.getByLabelText(/credential type/i)).toHaveTextContent(/client secret/i)
    expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument()
  })

  it('hides the tenant id and client secret once federation is selected', async () => {
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    // The card shows "Azure DevOps" as both the name and the provider-type
    // label, so wait on the control being clicked rather than the text.
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /workload identity/i }))

    expect(screen.queryByLabelText(/tenant id/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument()
  })

  it('switches to federation and retires the stored secret in ONE request', async () => {
    // Neither intermediate state satisfies the backend's shape constraint, so
    // the type change and the secret removal must travel together. Sending the
    // type alone is a 400; sending it without clearing leaves a retired secret
    // in the database.
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    // The card shows "Azure DevOps" as both the name and the provider-type
    // label, so wait on the control being clicked rather than the text.
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /workload identity/i }))
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect(body.entra_credential_type).toBe('federated')
    expect('client_secret' in body).toBe(true)
    expect(body.client_secret).toBe('')
    expect(body.tenant_id).toBeNull()
  })

  // #1041 — certificate credential in the UI.
  const PEM =
    '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----'

  it('renders an existing federated provider as federated, not as the default', async () => {
    // Regression for #914, which never loaded entra_credential_type into the
    // form: a federated provider opened as "Client secret" with the tenant and
    // secret fields showing.
    listSCMProvidersMock.mockResolvedValue([
      {
        ...adoProvider,
        tenant_id: null,
        has_client_secret: false,
        entra_credential_type: 'federated' as const,
      },
    ])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    expect(screen.getByLabelText(/credential type/i)).toHaveTextContent(/workload identity/i)
    expect(screen.queryByLabelText(/tenant id/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^client secret/i)).not.toBeInTheDocument()
  })

  it('selecting certificate hides the secret and shows the bundle field', async () => {
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /^certificate$/i }))

    expect(screen.queryByLabelText(/^client secret/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/certificate and private key/i)).toBeInTheDocument()
    // The tenant stays: the signed assertion names it.
    expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument()
  })

  it('switches to certificate: type, bundle and secret retirement in ONE request', async () => {
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /^certificate$/i }))
    await userEvent.type(screen.getByLabelText(/certificate and private key/i), PEM)
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect(body.entra_credential_type).toBe('certificate')
    expect(body.entra_certificate).toBe(PEM)
    expect(body.client_secret).toBe('')
  })

  it('switching a certificate provider back to a secret retires the bundle in the same request', async () => {
    listSCMProvidersMock.mockResolvedValue([
      {
        ...adoProvider,
        has_client_secret: false,
        has_entra_certificate: true,
        entra_credential_type: 'certificate' as const,
      },
    ])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /^client secret$/i }))
    await userEvent.type(screen.getByLabelText(/^client secret/i), 'new-secret')
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))

    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect(body.entra_credential_type).toBe('client_secret')
    expect(body.client_secret).toBe('new-secret')
    expect(body.entra_certificate).toBe('')
  })

  // #1042 — managed identity, and the deployment capability flag.
  const CAPS = (available: Record<string, boolean>) => ({
    entra_credential_types: Object.fromEntries(
      ['client_secret', 'federated', 'certificate', 'managed_identity'].map((t) => [
        t,
        {
          available: available[t] ?? false,
          reason: available[t] ? undefined : 'not_offered_by_deployment',
        },
      ]),
    ),
  })

  it('disables a credential type this deployment does not offer, rather than hiding it', async () => {
    // Disable-with-reason, never hide. A hidden option is indistinguishable
    // from a mis-wired flag — which is exactly how capabilities.oci stayed
    // dead and unnoticed for its whole life (#921).
    getSCMCapabilitiesMock.mockResolvedValue(
      CAPS({ client_secret: true, certificate: true, federated: false, managed_identity: false }),
    )
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/credential type/i))

    const mi = await screen.findByRole('option', { name: /managed identity/i })
    expect(mi).toBeInTheDocument()
    expect(mi).toHaveAttribute('aria-disabled', 'true')
    expect(mi).toHaveTextContent(/not enabled on this deployment/i)

    // And an offered one is selectable.
    expect(await screen.findByRole('option', { name: /^certificate/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('offers managed identity when the deployment reports it available', async () => {
    getSCMCapabilitiesMock.mockResolvedValue(CAPS({ client_secret: true, managed_identity: true }))
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/credential type/i))

    const mi = await screen.findByRole('option', { name: /managed identity/i })
    expect(mi).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('fails OPEN when capabilities cannot be read', async () => {
    // The backend enforces the allow-list on create and update, so leniency
    // here costs a 400 naming the config key. Strictness would grey out every
    // option the moment the endpoint hiccups — or against an older backend
    // that does not serve it at all.
    getSCMCapabilitiesMock.mockRejectedValue(new Error('404'))
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/credential type/i))

    expect(await screen.findByRole('option', { name: /managed identity/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('switching to managed identity clears the tenant, secret and certificate in ONE request', async () => {
    getSCMCapabilitiesMock.mockResolvedValue(CAPS({ client_secret: true, managed_identity: true }))
    listSCMProvidersMock.mockResolvedValue([adoProvider])
    updateSCMProviderMock.mockResolvedValue({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/credential type/i))
    await userEvent.click(await screen.findByRole('option', { name: /managed identity/i }))

    // The platform holds the credential: no tenant, no secret, no bundle.
    expect(screen.queryByLabelText(/tenant id/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^client secret/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/certificate and private key/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() => expect(updateSCMProviderMock).toHaveBeenCalled())
    const body = updateSCMProviderMock.mock.calls[0][1]
    expect(body.entra_credential_type).toBe('managed_identity')
    expect(body.tenant_id).toBeNull()
    expect(body.client_secret).toBe('')
  })

  it('cancels the Edit dialog', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByText('Edit Provider')).not.toBeInTheDocument())
    expect(updateSCMProviderMock).not.toHaveBeenCalled()
  })

  it('dismisses error alert via close button after OAuth failure', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    initiateSCMOAuthMock.mockRejectedValue(new Error('oauth boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() => expect(screen.getByText(/oauth boom/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByText(/oauth boom/i)).not.toBeInTheDocument())
  })

  it('renders Bitbucket / GitLab / Azure DevOps provider cards', async () => {
    listSCMProvidersMock.mockResolvedValue([
      { ...fakeProviders[0], id: 'scm-2', provider_type: 'gitlab' as const, name: 'GitLab' },
      {
        ...fakeProviders[0],
        id: 'scm-3',
        provider_type: 'azuredevops' as const,
        name: 'ADO',
        tenant_id: 'tenant-123',
      },
      {
        ...fakeProviders[0],
        id: 'scm-4',
        provider_type: 'bitbucket_dc' as const,
        name: 'BB',
      },
    ])
    renderPage()
    await waitFor(() => expect(screen.getAllByText('GitLab').length).toBeGreaterThan(0))
    expect(screen.getByText('ADO')).toBeInTheDocument()
    expect(screen.getByText('BB')).toBeInTheDocument()
    expect(screen.getByText(/Tenant ID: tenant-123/i)).toBeInTheDocument()
  })

  // ── Organization filter (#779) ─────────────────────────────────────────────

  describe('organization filter', () => {
    it('lists every provider the caller may see when no organization is selected', async () => {
      listSCMProvidersMock.mockResolvedValue([])
      renderPage()
      await waitFor(() => expect(listSCMProvidersMock).toHaveBeenCalledWith(undefined))
    })

    it('narrows the request to the organization named in the URL', async () => {
      listSCMProvidersMock.mockResolvedValue([])
      renderPage(['/admin/scm-providers?org=org-2'])
      await waitFor(() => expect(listSCMProvidersMock).toHaveBeenCalledWith('org-2'))
    })

    // ListProviders answers 403 for an organization the caller holds no
    // scm:read in. That is recoverable — pick a different organization — and
    // saying so is what makes it actionable; the generic message reads like an
    // outage the user can do nothing about.
    it('reports a 403 as "not a member" rather than a generic load failure', async () => {
      listSCMProvidersMock.mockRejectedValue(
        axiosFailure(403, 'Not a member of the requested organization'),
      )
      renderPage(['/admin/scm-providers?org=org-nope'])
      await waitFor(() => {
        expect(screen.getByText(/not a member of that organization/i)).toBeInTheDocument()
      })
    })

    // The other direction of the same guard: widening the 403 branch to catch
    // every failure would relabel real outages as a membership problem.
    it('still reports a non-403 failure as a load failure', async () => {
      listSCMProvidersMock.mockRejectedValue(axiosFailure(500, 'database unavailable'))
      renderPage(['/admin/scm-providers?org=org-2'])
      await waitFor(() => {
        expect(screen.getByText(/database unavailable/i)).toBeInTheDocument()
      })
      expect(screen.queryByText(/not a member of that organization/i)).not.toBeInTheDocument()
    })
  })
})
