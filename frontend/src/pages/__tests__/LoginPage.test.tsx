import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogin = vi.fn()
const mockDevLogin = vi.fn().mockResolvedValue(undefined)
const mockLdapLogin = vi.fn().mockResolvedValue(undefined)
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, devLogin: mockDevLogin, ldapLogin: mockLdapLogin }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGetAuthProviders = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    getAuthProviders: (...args: unknown[]) => mockGetAuthProviders(...args),
  },
}))

// #667: the Dev Login button is gated on the BACKEND's dev status, not on
// import.meta.env.MODE. A build-time gate meant `--build-arg VITE_MODE=development`
// opened an unauthenticated login path in an image otherwise indistinguishable
// from production. Mocked here so the tests below can drive both answers.
const mockGetDevStatus = vi.fn()
vi.mock('../../services/api/devApi', () => ({
  getDevStatus: (...args: unknown[]) => mockGetDevStatus(...args),
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleTheme: vi.fn(),
    productName: 'Terraform Registry',
    logoUrl: null,
    loginHeroUrl: null,
    direction: 'ltr' as const,
  }),
}))

import LoginPage from '../LoginPage'

function mockProviders(providers: Array<{ type: string; name: string; id?: string }>) {
  mockGetAuthProviders.mockResolvedValue({ providers })
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGetDevStatus.mockResolvedValue({ dev_mode: false })
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders the login heading', async () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(screen.getByText('Terraform Registry')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching providers', () => {
    mockGetAuthProviders.mockReturnValue(new Promise(() => {})) // never resolves
    renderLoginPage()
    expect(screen.getByTestId('provider-loading')).toBeInTheDocument()
  })

  it('renders only SSO button when only OIDC provider is configured', async () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Azure AD' })).not.toBeInTheDocument()
  })

  it('renders only Azure AD button when only Azure provider is configured', async () => {
    mockProviders([{ type: 'azuread', name: 'Azure AD' }])
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with Azure AD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with SSO' })).not.toBeInTheDocument()
  })

  it('renders both buttons when both providers are configured', async () => {
    mockProviders([
      { type: 'oidc', name: 'OpenID Connect' },
      { type: 'azuread', name: 'Azure AD' },
    ])
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Azure AD' })).toBeInTheDocument()
  })

  it('shows "no providers" info alert when no providers are configured', async () => {
    mockProviders([])
    renderLoginPage()
    expect(await screen.findByTestId('no-providers-alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with SSO' })).not.toBeInTheDocument()
  })

  it('shows info text about SSO', () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(screen.getByText(/single sign-on for authentication/)).toBeInTheDocument()
  })

  it('does not render dev login button when the backend is not in dev mode', () => {
    // Renamed with #667: this used to pass because MODE was "test", and it now
    // passes because the mocked backend reports dev_mode: false (the default in
    // beforeEach). Same assertion, different reason -- and a test whose name
    // states the old reason is one that goes on passing after the thing it
    // described stops existing.
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(screen.queryByText('Dev Login (Admin)')).not.toBeInTheDocument()
  })

  it('triggers login with provider type when SSO button is clicked', async () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with SSO' })
    await act(async () => {
      await userEvent.click(btn)
    })
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('oidc'))
  })

  it('triggers login with provider id for SAML IdPs', async () => {
    mockProviders([{ type: 'saml', name: 'Okta', id: 'okta-prod' }])
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with Okta' })
    await act(async () => {
      await userEvent.click(btn)
    })
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('okta-prod'))
  })

  it('renders LDAP form when LDAP provider is configured', async () => {
    mockProviders([{ type: 'ldap', name: 'LDAP' }])
    renderLoginPage()
    expect(await screen.findByRole('textbox', { name: /username/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('shows SSO buttons and LDAP form together', async () => {
    mockProviders([
      { type: 'oidc', name: 'OpenID Connect' },
      { type: 'ldap', name: 'LDAP' },
    ])
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument()
    expect(screen.getByText('OR SIGN IN WITH LDAP')).toBeInTheDocument()
  })

  it('calls ldapLogin and navigates on successful LDAP sign-in', async () => {
    // Cookie-only auth (#467): ldapLogin resolves with no body — the session
    // arrives via Set-Cookie.
    mockLdapLogin.mockResolvedValue(undefined)
    mockProviders([{ type: 'ldap', name: 'LDAP' }])
    renderLoginPage()
    const usernameInput = await screen.findByRole('textbox', { name: /username/i })
    const passwordInput = screen.getByLabelText(/password/i)
    const signInBtn = screen.getByRole('button', { name: 'Sign In' })
    await act(async () => {
      await userEvent.type(usernameInput, 'testuser')
      await userEvent.type(passwordInput, 'testpass')
      await userEvent.click(signInBtn)
    })
    await waitFor(() => {
      expect(mockLdapLogin).toHaveBeenCalledWith('testuser', 'testpass')
    })
  })

  it('shows error when LDAP login fails', async () => {
    mockLdapLogin.mockRejectedValue(new Error('Invalid credentials'))
    mockProviders([{ type: 'ldap', name: 'LDAP' }])
    renderLoginPage()
    const usernameInput = await screen.findByRole('textbox', { name: /username/i })
    const passwordInput = screen.getByLabelText(/password/i)
    const signInBtn = screen.getByRole('button', { name: 'Sign In' })
    await act(async () => {
      await userEvent.type(usernameInput, 'testuser')
      await userEvent.type(passwordInput, 'wrongpass')
      await userEvent.click(signInBtn)
    })
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows only the generic message when LDAP login fails outside development builds (#618-class)', async () => {
    vi.stubEnv('DEV', false)
    mockLdapLogin.mockRejectedValue(new Error('Invalid credentials'))
    mockProviders([{ type: 'ldap', name: 'LDAP' }])
    renderLoginPage()
    const usernameInput = await screen.findByRole('textbox', { name: /username/i })
    const passwordInput = screen.getByLabelText(/password/i)
    const signInBtn = screen.getByRole('button', { name: 'Sign In' })
    await act(async () => {
      await userEvent.type(usernameInput, 'testuser')
      await userEvent.type(passwordInput, 'wrongpass')
      await userEvent.click(signInBtn)
    })
    await waitFor(() => {
      expect(screen.getByText('LDAP login failed. Check your credentials.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })

  it('shows only the generic message when dev login fails outside development builds (#618-class)', async () => {
    // Button visibility now comes from the BACKEND's dev status, not from MODE
    // (#667) — so this test has to say the backend is in dev mode for the button
    // to exist at all. What it is actually asserting is unchanged and is about
    // the OTHER flag: `DEV` still gates whether the raw error text is surfaced,
    // and a build where the two disagree must show only the generic message.
    //
    // The previous comment here said visibility was "driven by MODE". That was
    // true when it was written and is not any more.
    mockGetDevStatus.mockResolvedValue({ dev_mode: true })
    vi.stubEnv('DEV', false)
    mockDevLogin.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8080'))
    mockProviders([])
    renderLoginPage()
    const devLoginBtn = await screen.findByRole('button', { name: 'Dev Login (Admin)' })
    await act(async () => {
      await userEvent.click(devLoginBtn)
    })
    await waitFor(() => {
      expect(screen.getByText('Dev login failed. Check server logs.')).toBeInTheDocument()
    })
    expect(screen.queryByText('ECONNREFUSED 127.0.0.1:8080')).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })
})

describe('Dev Login gate (#667)', () => {
  it('does not render Dev Login when the backend reports dev_mode false', async () => {
    mockProviders([])
    mockGetDevStatus.mockResolvedValue({ dev_mode: false })
    renderLoginPage()
    await waitFor(() => expect(mockGetDevStatus).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /dev login/i })).not.toBeInTheDocument()
  })

  it('renders Dev Login when the backend reports dev_mode true', async () => {
    mockProviders([])
    mockGetDevStatus.mockResolvedValue({ dev_mode: true })
    renderLoginPage()
    expect(await screen.findByRole('button', { name: /dev login/i })).toBeInTheDocument()
  })

  it('FAILS CLOSED when the dev-status call rejects', async () => {
    // Production does not serve /api/v1/dev/status at all, so the request
    // rejecting is the ordinary production path -- not an edge case. If this
    // ever renders the button, a network blip becomes an auth-bypass affordance.
    mockProviders([])
    mockGetDevStatus.mockRejectedValue(new Error('404'))
    renderLoginPage()
    await waitFor(() => expect(mockGetDevStatus).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /dev login/i })).not.toBeInTheDocument()
  })
})
