import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockLogout = vi.fn()
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockToggleTheme = vi.fn()
const mockUseThemeMode = vi.fn()
vi.mock('../../contexts/ThemeContext', () => ({
  useThemeMode: () => mockUseThemeMode(),
}))

const mockOpenHelp = vi.fn()
const mockUseHelp = vi.fn()
vi.mock('../../contexts/HelpContext', () => ({
  useHelp: () => mockUseHelp(),
}))

vi.mock('../DevUserSwitcher', () => ({
  default: () => <div data-testid="dev-user-switcher" />,
}))

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

import Layout from '../Layout'
import i18n from '../../i18n'

// ── Helpers ────────────────────────────────────────────────────────────────

function setAuth(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    logout: mockLogout,
    allowedScopes: [],
    ...overrides,
  })
}

function renderLayout(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Layout />
    </MemoryRouter>,
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockUseThemeMode.mockReturnValue({
    mode: 'light',
    toggleTheme: mockToggleTheme,
    productName: 'Terraform Registry',
    logoUrl: null,
    loginHeroUrl: null,
    direction: 'ltr',
  })
  mockUseHelp.mockReturnValue({ helpOpen: false, openHelp: mockOpenHelp, closeHelp: vi.fn() })
  setAuth()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Layout', () => {
  // 1. Basic rendering
  it('renders the app bar title and navigation items', () => {
    renderLayout()

    // App bar contains the title
    expect(screen.getAllByText('Terraform Registry').length).toBeGreaterThanOrEqual(1)

    // All public nav items are present
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(screen.getByText('Providers')).toBeInTheDocument()
    expect(screen.getByText('Terraform Binaries')).toBeInTheDocument()
    expect(screen.getByText('API Docs')).toBeInTheDocument()
  })

  // 2. Unauthenticated state
  it('shows Login button when not authenticated', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument()
    expect(screen.queryByLabelText('account of current user')).not.toBeInTheDocument()
  })

  // 3. Authenticated state — user menu
  it('shows account icon and user email in menu when authenticated', async () => {
    const user = userEvent.setup()
    setAuth({
      isAuthenticated: true,
      user: { email: 'alice@example.com', id: '1', name: 'Alice', username: 'alice' },
    })
    renderLayout()

    // Login button should not be present
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()

    // Click account icon to open menu
    const accountBtn = screen.getByLabelText('account of current user')
    await user.click(accountBtn)

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  // 4. Logout
  it('calls logout when Logout menu item is clicked', async () => {
    const user = userEvent.setup()
    setAuth({
      isAuthenticated: true,
      user: { email: 'bob@test.com', id: '2', name: 'Bob', username: 'bob' },
    })
    renderLayout()

    await user.click(screen.getByLabelText('account of current user'))
    await user.click(screen.getByText('Logout'))

    expect(mockLogout).toHaveBeenCalledOnce()
  })

  // 5. Admin nav hidden when unauthenticated
  it('does not show admin navigation when unauthenticated', () => {
    renderLayout()

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument()
  })

  // 6. Admin nav visible for admin scope
  it('shows all admin navigation groups for admin scope', () => {
    setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
    renderLayout()

    // Dashboard link
    expect(screen.getByText('Dashboard')).toBeInTheDocument()

    // Identity group
    expect(screen.getByText('Identity')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Roles')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('OIDC Groups')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()

    // Source Control group — label and item share the same text
    expect(screen.getAllByText('Source Control').length).toBe(2)

    // Mirroring group
    expect(screen.getByText('Mirroring')).toBeInTheDocument()
    expect(screen.getByText('Provider Config')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Mirror Policies')).toBeInTheDocument()

    // System group
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('Security Scanning')).toBeInTheDocument()
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
  })

  // 7. Scoped admin nav — limited scopes only see allowed items
  it('filters admin nav items based on user scopes', () => {
    setAuth({
      isAuthenticated: true,
      allowedScopes: ['mirrors:read'],
    })
    renderLayout()

    // Should see API Keys (scope: null — always visible) and mirroring items
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Provider Config')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Binaries Config')).toBeInTheDocument()

    // Should NOT see admin-only items
    expect(screen.queryByText('OIDC Groups')).not.toBeInTheDocument()
    expect(screen.queryByText('Storage')).not.toBeInTheDocument()
    expect(screen.queryByText('Security Scanning')).not.toBeInTheDocument()
    expect(screen.queryByText('Mirror Policies')).not.toBeInTheDocument()

    // Should NOT see items requiring other scopes
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument()
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument()
  })

  // 8. Collapsible admin groups
  it('collapses and expands admin nav groups on click', async () => {
    const user = userEvent.setup()
    setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
    renderLayout()

    // Identity group items are visible by default (open)
    expect(screen.getByText('Users')).toBeInTheDocument()

    // Click the Identity group header to collapse it
    await user.click(screen.getByText('Identity'))

    // Items should be hidden after collapse animation (unmountOnExit)
    // Wait for the Collapse transition to complete
    await vi.waitFor(() => {
      expect(screen.queryByText('Users')).not.toBeInTheDocument()
    })

    // Click again to re-expand
    await user.click(screen.getByText('Identity'))
    await vi.waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument()
    })
  })

  // 9. Theme toggle
  it('calls toggleTheme when theme button is clicked', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByLabelText('Settings'))
    await user.click(screen.getByText('Dark mode'))
    expect(mockToggleTheme).toHaveBeenCalledOnce()
  })

  // 10. Help button
  it('calls openHelp when help button is clicked', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('Context Help'))
    expect(mockOpenHelp).toHaveBeenCalledOnce()
  })

  // 11. About modal
  it('opens About modal when About button is clicked', async () => {
    const user = userEvent.setup()
    renderLayout()

    expect(screen.queryByTestId('about-modal')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('About'))
    expect(screen.getByTestId('about-modal')).toBeInTheDocument()
  })

  // 12. Active nav item — home route
  it('highlights the active navigation item based on route', () => {
    setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
    renderLayout('/modules')

    // The Modules nav item should have the active border styling
    // We verify by checking the link is rendered and has the correct href
    const modulesLink = screen.getByText('Modules').closest('a')
    expect(modulesLink).toHaveAttribute('href', '/modules')
  })

  // 13. DevUserSwitcher shown when authenticated
  it('renders DevUserSwitcher when authenticated', () => {
    setAuth({ isAuthenticated: true })
    renderLayout()

    expect(screen.getByTestId('dev-user-switcher')).toBeInTheDocument()
  })

  // 14. DevUserSwitcher hidden when not authenticated
  it('does not render DevUserSwitcher when not authenticated', () => {
    renderLayout()

    expect(screen.queryByTestId('dev-user-switcher')).not.toBeInTheDocument()
  })

  // 15. Skip-to-content link
  it('renders a skip-to-content link for accessibility', () => {
    renderLayout()

    const skipLink = screen.getByText('Skip to main content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink.getAttribute('href')).toBe('#main-content')
  })

  // 16. Close About modal
  it('closes About modal when close callback fires', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByLabelText('Support'))
    await user.click(screen.getByText('About'))
    expect(screen.getByTestId('about-modal')).toBeInTheDocument()

    await user.click(within(screen.getByTestId('about-modal')).getByText('Close'))
    expect(screen.queryByTestId('about-modal')).not.toBeInTheDocument()
  })

  // 17. Closing user menu without logging out
  it('closes user menu when clicking away (handleClose)', async () => {
    const user = userEvent.setup()
    setAuth({
      isAuthenticated: true,
      user: { email: 'carol@test.com', id: '3', name: 'Carol', username: 'carol' },
    })
    renderLayout()

    // Open the menu
    await user.click(screen.getByLabelText('account of current user'))
    expect(screen.getByRole('presentation')).toBeInTheDocument()

    // Press Escape to close the menu — MUI backdrop/presentation should disappear
    await user.keyboard('{Escape}')
    await vi.waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    })

    // logout should NOT have been called
    expect(mockLogout).not.toHaveBeenCalled()
  })

  // 18. localStorage persistence of admin nav group state
  it('persists collapsed admin group state to localStorage', async () => {
    const user = userEvent.setup()
    setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
    renderLayout()

    // Collapse the Identity group
    await user.click(screen.getByText('Identity'))

    // Check that localStorage was updated
    const stored = localStorage.getItem('adminNavGroups')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.identity).toBe(false)
  })

  // 19. Mobile: admin groups collapsed by default; active group auto-opens
  describe('mobile admin nav (roadmap 3.3)', () => {
    function mockMobile(matches: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('max-width') ? matches : !matches,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    }

    it('collapses all admin groups by default on mobile when not on an admin route', () => {
      mockMobile(true)
      setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
      renderLayout('/modules')
      // Group headers are visible but their items are not.
      expect(screen.getByText('Identity')).toBeInTheDocument()
      expect(screen.queryByText('Users')).not.toBeInTheDocument()
      expect(screen.queryByText('Storage')).not.toBeInTheDocument()
    })

    it('auto-opens the active group on mobile based on the current URL', () => {
      mockMobile(true)
      setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
      renderLayout('/admin/storage')
      // System group contains /admin/storage and should be the only open group.
      // "Storage" appears twice: once in the breadcrumb and once in the nav item.
      expect(screen.getAllByText('Storage').length).toBeGreaterThanOrEqual(2)
      expect(screen.queryByText('Users')).not.toBeInTheDocument()
    })

    it('opening a group on mobile closes all other groups (accordion)', async () => {
      mockMobile(true)
      const user = userEvent.setup()
      setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
      renderLayout('/admin/storage')
      // Open Identity; System should collapse.
      await user.click(screen.getByText('Identity'))
      await vi.waitFor(() => {
        expect(screen.getByText('Users')).toBeInTheDocument()
      })
      // After System collapses, only the breadcrumb entry for "Storage" remains.
      await vi.waitFor(() => {
        expect(screen.getAllByText('Storage')).toHaveLength(1)
      })
    })
  })

  describe('command palette (roadmap 3.1)', () => {
    it('renders a palette trigger in the AppBar and opens on click', async () => {
      const user = userEvent.setup()
      setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
      renderLayout('/')
      const trigger = screen.getByTestId('command-palette-trigger')
      expect(trigger).toBeInTheDocument()
      await user.click(trigger)
      expect(screen.getByTestId('command-palette-input')).toBeInTheDocument()
    })

    it('opens on Cmd+K hotkey', async () => {
      setAuth({ isAuthenticated: true, allowedScopes: ['admin'] })
      renderLayout('/')
      // dispatch a native keydown (jsdom)
      const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      window.dispatchEvent(ev)
      await vi.waitFor(() => {
        expect(screen.getByTestId('command-palette-input')).toBeInTheDocument()
      })
    })
  })

  // 21. Language picker — native names regardless of active locale (#229)
  describe('language picker', () => {
    const NATIVE_NAMES = [
      'English',
      'Español',
      'Français',
      'Deutsch',
      '日本語',
      'Português',
      'Nederlands',
      'Norsk bokmål',
      '简体中文',
      'Italiano',
    ]

    async function openSettingsMenu() {
      const user = userEvent.setup()
      renderLayout()
      // The settings button's aria-label is itself translated, so look it up
      // through i18n rather than hardcoding the English string.
      await user.click(screen.getByLabelText(i18n.t('header.settings')))
      return user
    }

    it.each(['en', 'es', 'fr', 'de', 'ja', 'pt', 'nl', 'nb', 'zh', 'it'])(
      'shows all language names in their native script when active locale is %s',
      async (locale) => {
        await i18n.changeLanguage(locale)
        await openSettingsMenu()

        const menu = screen.getByRole('menu')
        for (const name of NATIVE_NAMES) {
          expect(within(menu).getByText(name)).toBeInTheDocument()
        }
      },
    )

    it('always shows English as an option in non-English locales', async () => {
      await i18n.changeLanguage('de')
      await openSettingsMenu()
      expect(within(screen.getByRole('menu')).getByText('English')).toBeInTheDocument()
    })
  })
})
