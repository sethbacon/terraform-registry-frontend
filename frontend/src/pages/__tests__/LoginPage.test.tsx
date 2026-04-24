import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogin = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiLogin = vi.fn()
const mockDevLogin = vi.fn().mockResolvedValue({ token: 'test-jwt' })
const mockGetAuthProviders = vi.fn()
const mockLdapLogin = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    devLogin: (...args: unknown[]) => mockDevLogin(...args),
    login: (...args: unknown[]) => mockApiLogin(...args),
    getAuthProviders: (...args: unknown[]) => mockGetAuthProviders(...args),
    ldapLogin: (...args: unknown[]) => mockLdapLogin(...args),
  },
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
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders the login heading', async () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(screen.getByText('Terraform Registry')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching providers', () => {
    mockGetAuthProviders.mockReturnValue(new Promise(() => { })) // never resolves
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

  it('does not render dev login button in test mode', () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    expect(screen.queryByText('Dev Login (Admin)')).not.toBeInTheDocument()
  })

  it('triggers api.login with provider type when SSO button is clicked', async () => {
    mockProviders([{ type: 'oidc', name: 'OpenID Connect' }])
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with SSO' })
    await act(async () => { await userEvent.click(btn) })
    await waitFor(() => expect(mockApiLogin).toHaveBeenCalledWith('oidc'))
  })

  it('triggers api.login with provider id for SAML IdPs', async () => {
    mockProviders([{ type: 'saml', name: 'Okta', id: 'okta-prod' }])
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with Okta' })
    await act(async () => { await userEvent.click(btn) })
    await waitFor(() => expect(mockApiLogin).toHaveBeenCalledWith('okta-prod'))
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
    mockLdapLogin.mockResolvedValue({ token: 'ldap-jwt' })
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
})
