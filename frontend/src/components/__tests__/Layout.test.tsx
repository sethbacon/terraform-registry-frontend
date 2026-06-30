import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteThemeProvider, AuthProvider, type AuthApi } from '@sethbacon/terraform-suite-ui'

// ── Mocks ──────────────────────────────────────────────────────────────────
// Help context stays app-level (SuiteLayout does not use it); mock it so the
// support menu's openHelp is observable.
const mockOpenHelp = vi.fn()
vi.mock('../../contexts/HelpContext', () => ({
  useHelp: () => ({ helpOpen: false, openHelp: mockOpenHelp, closeHelp: vi.fn() }),
}))

vi.mock('../DevUserSwitcher', () => ({ default: () => <div data-testid="dev-user-switcher" /> }))
vi.mock('../HelpPanel', () => ({
  default: () => <div data-testid="help-panel" />,
  HELP_PANEL_WIDTH: 320,
}))
vi.mock('../AboutModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="about-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))
// AdvisoryBanner + SuiteSwitcher fetch via useQuery; stub them so Layout tests
// don't need a QueryClientProvider. Both have their own dedicated tests.
vi.mock('../AdvisoryBanner', () => ({ default: () => null }))
vi.mock('../SuiteSwitcher', () => ({ SuiteSwitcher: () => null }))

import Layout from '../Layout'
import '../../i18n'

// ── Helpers ────────────────────────────────────────────────────────────────
// SuiteLayout consumes the package's own useAuth/useThemeMode, so drive auth
// through a real package AuthProvider with a mock backend contract. Pass null
// scopes for an unauthenticated session (getCurrentUser rejects).
function makeApi(scopes: string[] | null): AuthApi {
  return {
    getCurrentUser:
      scopes === null
        ? vi.fn().mockRejectedValue(new Error('unauthenticated'))
        : vi.fn().mockResolvedValue({
          user: { id: '1', email: 'alice@example.com', name: 'Alice' },
          memberships: [],
          allowed_scopes: scopes,
        }),
    login: vi.fn(),
    devLogin: vi.fn().mockResolvedValue(undefined),
    ldapLogin: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refreshToken: vi.fn().mockResolvedValue({ expires_in: 3600 }),
  }
}

function renderLayout({
  scopes = null,
  route = '/',
}: { scopes?: string[] | null; route?: string } = {}) {
  const api = makeApi(scopes)
  render(
    <SuiteThemeProvider defaultProductName="Terraform Registry" storageKey="terraform-registry-theme">
      <AuthProvider api={api}>
        <MemoryRouter initialEntries={[route]}>
          <Layout />
        </MemoryRouter>
      </AuthProvider>
    </SuiteThemeProvider>,
  )
  return api
}

// ── Setup ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Desktop layout so the permanent drawer (and its nav) is rendered: SuiteLayout
  // keys off useMediaQuery(up('md')), which uses a min-width media query.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Layout', () => {
  it('renders the brand and public navigation items', async () => {
    renderLayout()
    expect(await screen.findByText('Terraform Registry')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(screen.getByText('Providers')).toBeInTheDocument()
    expect(screen.getByText('Hosted Binaries')).toBeInTheDocument()
    expect(screen.getByText('API Docs')).toBeInTheDocument()
  })

  it('shows the Sign in link when unauthenticated', async () => {
    renderLayout({ scopes: null })
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Account')).not.toBeInTheDocument()
  })

  it('shows the account menu with the user when authenticated', async () => {
    const user = userEvent.setup()
    renderLayout({ scopes: ['admin'] })
    await user.click(await screen.findByLabelText('Account'))
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('calls the logout API from the account menu', async () => {
    const user = userEvent.setup()
    const api = renderLayout({ scopes: ['admin'] })
    await user.click(await screen.findByLabelText('Account'))
    await user.click(screen.getByText('Sign out'))
    expect(api.logout).toHaveBeenCalled()
  })

  it('does not show admin navigation when unauthenticated', async () => {
    renderLayout({ scopes: null })
    await screen.findByText('Home')
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument()
  })

  it('shows all admin navigation groups for admin scope', async () => {
    renderLayout({ scopes: ['admin'] })
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Identity')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Roles')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('OIDC Groups')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getAllByText('Source Control').length).toBe(2)
    expect(screen.getByText('Mirroring')).toBeInTheDocument()
    expect(screen.getByText('Provider Config')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Mirror Policies')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('Security Scanning')).toBeInTheDocument()
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
  })

  it('filters admin nav items based on user scopes', async () => {
    renderLayout({ scopes: ['mirrors:read'] })
    expect(await screen.findByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Provider Config')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Binary Mirrors')).toBeInTheDocument()
    expect(screen.queryByText('OIDC Groups')).not.toBeInTheDocument()
    expect(screen.queryByText('Storage')).not.toBeInTheDocument()
    expect(screen.queryByText('Security Scanning')).not.toBeInTheDocument()
    expect(screen.queryByText('Mirror Policies')).not.toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument()
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument()
  })

  it('collapses and expands admin nav groups on click', async () => {
    const user = userEvent.setup()
    renderLayout({ scopes: ['admin'] })
    expect(await screen.findByText('Users')).toBeInTheDocument()
    await user.click(screen.getByText('Identity'))
    await waitFor(() => expect(screen.queryByText('Users')).not.toBeInTheDocument())
    await user.click(screen.getByText('Identity'))
    await waitFor(() => expect(screen.getByText('Users')).toBeInTheDocument())
  })

  it('toggles the theme from the settings menu', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByLabelText('Settings'))
    await user.click(screen.getByText('Dark mode'))
    await waitFor(() => expect(localStorage.getItem('terraform-registry-theme')).toBe('dark'))
  })

  it('opens context help from the support menu', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('Context Help'))
    expect(mockOpenHelp).toHaveBeenCalledOnce()
  })

  it('opens the About modal from the support menu', async () => {
    const user = userEvent.setup()
    renderLayout()
    expect(screen.queryByTestId('about-modal')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('About'))
    expect(screen.getByTestId('about-modal')).toBeInTheDocument()
  })

  it('links navigation items to their routes', async () => {
    renderLayout({ scopes: ['admin'], route: '/modules' })
    const modulesLink = (await screen.findByText('Modules')).closest('a')
    expect(modulesLink).toHaveAttribute('href', '/modules')
  })

  it('renders DevUserSwitcher when authenticated', async () => {
    renderLayout({ scopes: ['admin'] })
    expect(await screen.findByTestId('dev-user-switcher')).toBeInTheDocument()
  })

  it('does not render DevUserSwitcher when unauthenticated', async () => {
    renderLayout({ scopes: null })
    await screen.findByRole('link', { name: 'Sign in' })
    expect(screen.queryByTestId('dev-user-switcher')).not.toBeInTheDocument()
  })

  it('renders a skip-to-content link', async () => {
    renderLayout()
    const skipLink = await screen.findByText('Skip to content')
    expect(skipLink.getAttribute('href')).toBe('#main-content')
  })

  it('closes the About modal when its close callback fires', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('About'))
    expect(screen.getByTestId('about-modal')).toBeInTheDocument()
    await user.click(within(screen.getByTestId('about-modal')).getByText('Close'))
    expect(screen.queryByTestId('about-modal')).not.toBeInTheDocument()
  })

  it('closes the account menu on Escape without logging out', async () => {
    const user = userEvent.setup()
    const api = renderLayout({ scopes: ['admin'] })
    await user.click(await screen.findByLabelText('Account'))
    expect(screen.getByRole('presentation')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('presentation')).not.toBeInTheDocument())
    expect(api.logout).not.toHaveBeenCalled()
  })

  it('persists collapsed admin group state to localStorage', async () => {
    const user = userEvent.setup()
    renderLayout({ scopes: ['admin'] })
    await screen.findByText('Users')
    await user.click(screen.getByText('Identity'))
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('adminNavGroups') ?? '{}').identity).toBe(false),
    )
  })
})
