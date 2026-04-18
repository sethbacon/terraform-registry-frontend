import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listSCMProvidersMock = vi.fn()
const getCurrentUserMembershipsMock = vi.fn()
const getSCMTokenStatusMock = vi.fn()
const createSCMProviderMock = vi.fn()
const updateSCMProviderMock = vi.fn()
const deleteSCMProviderMock = vi.fn()
const initiateSCMOAuthMock = vi.fn()
const saveSCMTokenMock = vi.fn()
const revokeSCMTokenMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listSCMProviders: (...args: unknown[]) => listSCMProvidersMock(...args),
    getCurrentUserMemberships: (...args: unknown[]) => getCurrentUserMembershipsMock(...args),
    getSCMTokenStatus: (...args: unknown[]) => getSCMTokenStatusMock(...args),
    createSCMProvider: (...args: unknown[]) => createSCMProviderMock(...args),
    updateSCMProvider: (...args: unknown[]) => updateSCMProviderMock(...args),
    deleteSCMProvider: (...args: unknown[]) => deleteSCMProviderMock(...args),
    initiateSCMOAuth: (...args: unknown[]) => initiateSCMOAuthMock(...args),
    saveSCMToken: (...args: unknown[]) => saveSCMTokenMock(...args),
    revokeSCMToken: (...args: unknown[]) => revokeSCMTokenMock(...args),
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
  { organization_id: 'org-1', organization_name: 'Acme', role_template_id: 'rt', role_template_name: 'admin', role_template_display_name: 'Admin' },
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

  it('shows Active chip for active providers', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Connected status when token is connected', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    getSCMTokenStatusMock.mockResolvedValue({ connected: true, token_type: 'oauth', connected_at: '2025-06-01T00:00:00Z' })
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
    getCurrentUserMembershipsMock.mockResolvedValue(fakeMemberships)
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument())
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

  it('opens PAT dialog for Bitbucket Data Center provider', async () => {
    const bbProvider = [{ ...fakeProviders[0], provider_type: 'bitbucket_dc' as const, name: 'BB DC' }]
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
    getCurrentUserMembershipsMock.mockResolvedValue(fakeMemberships)
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByText('Add SCM Provider')).not.toBeInTheDocument())
  })

  it('creates a new provider via Add dialog', async () => {
    listSCMProvidersMock.mockResolvedValue([])
    getCurrentUserMembershipsMock.mockResolvedValue(fakeMemberships)
    createSCMProviderMock.mockResolvedValue({ id: 'new-scm' })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await waitFor(() => expect(screen.getByText('Add SCM Provider')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/^Name/i), 'My GitHub')
    await userEvent.type(screen.getByLabelText(/Client ID/i), 'client-123')
    await userEvent.type(screen.getByLabelText(/Client Secret/i), 'secret-456')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(createSCMProviderMock).toHaveBeenCalled())
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
    await waitFor(() =>
      expect(screen.getByLabelText(/Personal Access Token/i)).toBeInTheDocument(),
    )
    await userEvent.type(screen.getByLabelText(/Personal Access Token/i), 'bbdc-pat')
    await userEvent.click(screen.getByRole('button', { name: /save token/i }))
    await waitFor(() =>
      expect(saveSCMTokenMock).toHaveBeenCalledWith('scm-1', 'bbdc-pat'),
    )
  })

  it('cancels the PAT dialog', async () => {
    const bbProvider = [
      { ...fakeProviders[0], provider_type: 'bitbucket_dc' as const, name: 'BB DC' },
    ]
    listSCMProvidersMock.mockResolvedValue(bbProvider)
    renderPage()
    await waitFor(() => expect(screen.getByText('BB DC')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /connect scm provider/i }))
    await waitFor(() =>
      expect(screen.getByLabelText(/Personal Access Token/i)).toBeInTheDocument(),
    )
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
    await userEvent.click(
      screen.getByRole('button', { name: /disconnect scm provider/i }),
    )
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

  it('cancels the Edit dialog', async () => {
    listSCMProvidersMock.mockResolvedValue(fakeProviders)
    renderPage()
    await waitFor(() => expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit scm provider/i }))
    await waitFor(() => expect(screen.getByText('Edit Provider')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() =>
      expect(screen.queryByText('Edit Provider')).not.toBeInTheDocument(),
    )
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
    await waitFor(() =>
      expect(screen.queryByText(/oauth boom/i)).not.toBeInTheDocument(),
    )
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
})
