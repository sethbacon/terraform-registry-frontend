import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const defaultLdapForm = {
  host: '', port: 389, use_tls: false, start_tls: true, insecure_skip_verify: false,
  bind_dn: '', bind_password: '', base_dn: '', user_filter: '(sAMAccountName=%s)',
  user_attr_email: 'mail', user_attr_name: 'displayName',
  group_base_dn: '', group_filter: '', group_member_attr: 'member',
}

const mockCtx = {
  authMethod: 'oidc' as 'oidc' | 'ldap',
  setAuthMethod: vi.fn(),
  oidcForm: {
    provider_type: 'generic_oidc',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_url: '',
    scopes: ['openid', 'email', 'profile'],
  },
  setOidcForm: vi.fn(),
  oidcTesting: false,
  oidcTestResult: null as { success: boolean; message: string } | null,
  oidcSaving: false,
  oidcSaved: false,
  testOIDC: vi.fn(),
  saveOIDC: vi.fn(),
  ldapForm: { ...defaultLdapForm },
  setLdapForm: vi.fn(),
  ldapTesting: false,
  ldapTestResult: null as { success: boolean; message: string } | null,
  ldapSaving: false,
  ldapSaved: false,
  testLDAP: vi.fn(),
  saveLDAP: vi.fn(),
  goToStep: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import OIDCStep from '../OIDCStep'

function filledForm() {
  mockCtx.oidcForm = {
    provider_type: 'generic_oidc',
    issuer_url: 'https://issuer.example.com',
    client_id: 'my-client',
    client_secret: 'my-secret',
    redirect_url: 'https://registry.example.com/api/v1/auth/callback',
    scopes: ['openid', 'email', 'profile'],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.authMethod = 'oidc'
  mockCtx.oidcForm = {
    provider_type: 'generic_oidc',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_url: '',
    scopes: ['openid', 'email', 'profile'],
  }
  mockCtx.oidcTesting = false
  mockCtx.oidcTestResult = null
  mockCtx.oidcSaving = false
  mockCtx.oidcSaved = false
  mockCtx.ldapForm = { ...defaultLdapForm }
  mockCtx.ldapTesting = false
  mockCtx.ldapTestResult = null
  mockCtx.ldapSaving = false
  mockCtx.ldapSaved = false
})

describe('OIDCStep', () => {
  it('renders heading and auth method toggle', () => {
    render(<OIDCStep />)
    expect(screen.getByText('Identity Provider')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OpenID Connect/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /LDAP/i })).toBeInTheDocument()
  })

  it('renders OIDC form fields when authMethod is oidc', () => {
    render(<OIDCStep />)
    expect(screen.getByLabelText(/Issuer URL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Client ID/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Client Secret/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Redirect URL/i)).toBeInTheDocument()
  })

  it('disables Test button when required fields are empty', () => {
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled()
  })

  it('disables Save button when redirect_url is empty', () => {
    mockCtx.oidcForm = { ...mockCtx.oidcForm, issuer_url: 'https://x', client_id: 'a', client_secret: 'b', redirect_url: '' }
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Save OIDC/i })).toBeDisabled()
  })

  it('enables Test button when issuer, client_id, client_secret filled', () => {
    mockCtx.oidcForm = { ...mockCtx.oidcForm, issuer_url: 'https://x', client_id: 'a', client_secret: 'b' }
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeEnabled()
  })

  it('enables Save button when all required fields filled', () => {
    filledForm()
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Save OIDC/i })).toBeEnabled()
  })

  it('calls testOIDC on Test button click', async () => {
    filledForm()
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Test Connection/i }))
    expect(mockCtx.testOIDC).toHaveBeenCalledOnce()
  })

  it('calls saveOIDC on Save button click', async () => {
    filledForm()
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Save OIDC/i }))
    expect(mockCtx.saveOIDC).toHaveBeenCalledOnce()
  })

  it('shows test result alert', () => {
    mockCtx.oidcTestResult = { success: true, message: 'Connection successful' }
    render(<OIDCStep />)
    expect(screen.getByText('Connection successful')).toBeInTheDocument()
  })

  it('shows error test result', () => {
    mockCtx.oidcTestResult = { success: false, message: 'Invalid issuer' }
    render(<OIDCStep />)
    expect(screen.getByText('Invalid issuer')).toBeInTheDocument()
  })

  it('shows Next button when saved', () => {
    mockCtx.oidcSaved = true
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Next: Configure Storage/i })).toBeInTheDocument()
  })

  it('does not show Next button before save', () => {
    render(<OIDCStep />)
    expect(screen.queryByRole('button', { name: /Next: Configure Storage/i })).not.toBeInTheDocument()
  })

  it('toggles client secret visibility', async () => {
    render(<OIDCStep />)
    const secretInput = screen.getByLabelText(/Client Secret/i)
    expect(secretInput).toHaveAttribute('type', 'password')
    const toggleButtons = screen.getAllByLabelText(/Toggle password/i)
    await userEvent.setup().click(toggleButtons[0])
    expect(secretInput).toHaveAttribute('type', 'text')
  })
})
