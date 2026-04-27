import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---- Mocks ----

const getSetupStatusMock = vi.fn()
const searchModulesMock = vi.fn()
const searchProvidersMock = vi.fn()
const listPublicTerraformMirrorConfigsMock = vi.fn()
const getCurrentUserMembershipsMock = vi.fn().mockResolvedValue([])
const createAPIKeyMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    getSetupStatus: (...args: unknown[]) => getSetupStatusMock(...args),
    searchModules: (...args: unknown[]) => searchModulesMock(...args),
    searchProviders: (...args: unknown[]) => searchProvidersMock(...args),
    listPublicTerraformMirrorConfigs: (...args: unknown[]) =>
      listPublicTerraformMirrorConfigsMock(...args),
    getCurrentUserMemberships: (...args: unknown[]) => getCurrentUserMembershipsMock(...args),
    createAPIKey: (...args: unknown[]) => createAPIKeyMock(...args),
  },
}))

// Mock AuthContext — toggle isAuthenticated via setAuthState.
let authState: { isAuthenticated: boolean } = { isAuthenticated: false }
function setAuthState(next: { isAuthenticated: boolean }) {
  authState = next
}
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: authState.isAuthenticated }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import HomePage from '../HomePage'
import { AnnouncerProvider } from '../../contexts/AnnouncerContext'

// ---- Helpers ----

function renderPage() {
  return render(
    <MemoryRouter>
      <AnnouncerProvider>
        <HomePage />
      </AnnouncerProvider>
    </MemoryRouter>,
  )
}

function mockSuccessfulLoad() {
  getSetupStatusMock.mockResolvedValue({ setup_required: false })
  searchModulesMock.mockResolvedValue({
    modules: [
      { namespace: 'hashicorp', name: 'consul', system: 'aws' },
      { namespace: 'hashicorp', name: 'vault', system: 'aws' },
    ],
    meta: { total: 10 },
  })
  searchProvidersMock.mockResolvedValue({
    providers: [{ namespace: 'hashicorp', type: 'aws' }],
    meta: { total: 5 },
  })
  listPublicTerraformMirrorConfigsMock.mockResolvedValue([{ name: 'terraform', tool: 'terraform' }])
}

// ---- Tests ----

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAuthState({ isAuthenticated: false })
    getCurrentUserMembershipsMock.mockResolvedValue([])
  })

  it('renders heading after data loads', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Private Terraform Registry')).toBeInTheDocument()
    })
  })

  it('shows module count and provider count after load', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/10 modules/)).toBeInTheDocument()
    })
    expect(screen.getByText(/5 providers/)).toBeInTheDocument()
  })

  it('shows the search field', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search modules/)).toBeInTheDocument()
    })
  })

  it('shows setup required alert when setup_required is true', async () => {
    getSetupStatusMock.mockResolvedValue({ setup_required: true })
    searchModulesMock.mockResolvedValue({
      modules: [],
      meta: { total: 0 },
    })
    searchProvidersMock.mockResolvedValue({
      providers: [],
      meta: { total: 0 },
    })
    listPublicTerraformMirrorConfigsMock.mockResolvedValue([])

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Setup Required')).toBeInTheDocument()
    })
    expect(screen.getByText(/This registry has not been configured yet/)).toBeInTheDocument()
  })

  it('shows CLI usage section with credentials snippet', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument()
    })
    expect(screen.getByText(/Get an API Key/)).toBeInTheDocument()
    expect(screen.getByText(/token = "<your-api-key>"/)).toBeInTheDocument()
  })

  it('shows module names from search results', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('hashicorp/consul')).toBeInTheDocument()
    })
    expect(screen.getByText('hashicorp/vault')).toBeInTheDocument()
  })

  it('shows toggle buttons for search type', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Modules' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Providers' })).toBeInTheDocument()
  })

  it('does not show setup alert when setup_required is false', async () => {
    mockSuccessfulLoad()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Private Terraform Registry')).toBeInTheDocument()
    })
    expect(screen.queryByText('Setup Required')).not.toBeInTheDocument()
  })

  describe('Quick Search (roadmap 3.4)', () => {
    it('renders the scope toggle before the input in DOM order', async () => {
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('quick-search-toggle')).toBeInTheDocument()
      })
      const stack = screen.getByTestId('quick-search-stack')
      const toggle = screen.getByTestId('quick-search-toggle')
      const input = screen.getByPlaceholderText(/Search modules/)
      expect(stack).toContainElement(toggle)
      expect(stack).toContainElement(input)
      // Node.DOCUMENT_POSITION_FOLLOWING === 4
      expect(toggle.compareDocumentPosition(input) & 4).toBe(4)
    })

    it('updates the placeholder when toggling scope to Providers', async () => {
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search modules/)).toBeInTheDocument()
      })
      await userEvent.click(screen.getByRole('button', { name: 'Providers' }))
      expect(screen.getByPlaceholderText(/Search providers/)).toBeInTheDocument()
    })

    it('navigates to /modules with q param on Enter', async () => {
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search modules/)).toBeInTheDocument()
      })
      const input = screen.getByPlaceholderText(/Search modules/) as HTMLInputElement
      await userEvent.type(input, 'consul{Enter}')
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith(expect.stringMatching(/^\/modules\?q=consul/)),
      )
    })

    it('navigates to /providers when toggle is on Providers and Enter is pressed', async () => {
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search modules/)).toBeInTheDocument()
      })
      await userEvent.click(screen.getByRole('button', { name: 'Providers' }))
      const input = screen.getByPlaceholderText(/Search providers/) as HTMLInputElement
      await userEvent.type(input, 'aws{Enter}')
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith(expect.stringMatching(/^\/providers\?q=aws/)),
      )
    })
  })

  describe('Getting Started API key CTA (roadmap 1.1)', () => {
    it('shows a Sign-in CTA (not Create API key) when unauthenticated', async () => {
      setAuthState({ isAuthenticated: false })
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('getting-started-signin')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('getting-started-create-key')).not.toBeInTheDocument()
    })

    it('shows Create API key + Manage all keys when authenticated', async () => {
      setAuthState({ isAuthenticated: true })
      getCurrentUserMembershipsMock.mockResolvedValue([
        { organization_id: 'org-1', organization_name: 'Acme' },
      ])
      mockSuccessfulLoad()
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('getting-started-create-key')).toBeInTheDocument()
      })
      expect(screen.getByTestId('getting-started-manage-keys')).toBeInTheDocument()
      expect(screen.queryByTestId('getting-started-signin')).not.toBeInTheDocument()
    })

    it('opens the QuickApiKeyDialog when Create API key is clicked', async () => {
      setAuthState({ isAuthenticated: true })
      getCurrentUserMembershipsMock.mockResolvedValue([
        { organization_id: 'org-1', organization_name: 'Acme' },
      ])
      mockSuccessfulLoad()
      renderPage()
      const btn = await screen.findByTestId('getting-started-create-key')
      await userEvent.click(btn)
      expect(await screen.findByRole('dialog', { name: /Create API key/i })).toBeInTheDocument()
    })
  })
})
