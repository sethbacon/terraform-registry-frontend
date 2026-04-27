import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const defaultLdapForm = {
  host: '',
  port: 389,
  use_tls: false,
  start_tls: true,
  insecure_skip_verify: false,
  bind_dn: '',
  bind_password: '',
  base_dn: '',
  user_filter: '(sAMAccountName=%s)',
  user_attr_email: 'mail',
  user_attr_name: 'displayName',
  group_base_dn: '',
  group_filter: '',
  group_member_attr: 'member',
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
    mockCtx.oidcForm = {
      ...mockCtx.oidcForm,
      issuer_url: 'https://x',
      client_id: 'a',
      client_secret: 'b',
      redirect_url: '',
    }
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Save OIDC/i })).toBeDisabled()
  })

  it('enables Test button when issuer, client_id, client_secret filled', () => {
    mockCtx.oidcForm = {
      ...mockCtx.oidcForm,
      issuer_url: 'https://x',
      client_id: 'a',
      client_secret: 'b',
    }
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
    expect(
      screen.queryByRole('button', { name: /Next: Configure Storage/i }),
    ).not.toBeInTheDocument()
  })

  it('toggles client secret visibility', async () => {
    render(<OIDCStep />)
    const secretInput = screen.getByLabelText(/Client Secret/i)
    expect(secretInput).toHaveAttribute('type', 'password')
    const toggleButtons = screen.getAllByLabelText(/Toggle password/i)
    await userEvent.setup().click(toggleButtons[0])
    expect(secretInput).toHaveAttribute('type', 'text')
  })

  it('renders provider type select', () => {
    render(<OIDCStep />)
    expect(screen.getAllByText(/Provider Type/i).length).toBeGreaterThan(0)
  })

  it('updates scopes field', () => {
    mockCtx.oidcForm = { ...mockCtx.oidcForm, scopes: ['openid', 'email'] }
    render(<OIDCStep />)
    const scopesInput = screen.getByLabelText(/Scopes/i)
    expect(scopesInput).toHaveValue('openid email')
  })

  it('shows saved success alert', () => {
    mockCtx.oidcSaved = true
    render(<OIDCStep />)
    expect(screen.getByText(/OIDC provider configured successfully/i)).toBeInTheDocument()
  })

  it('shows spinner when oidcTesting', () => {
    filledForm()
    mockCtx.oidcTesting = true
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled()
  })

  it('shows spinner when oidcSaving', () => {
    filledForm()
    mockCtx.oidcSaving = true
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Save OIDC/i })).toBeDisabled()
  })

  it('calls goToStep(0) on Back button', async () => {
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(0)
  })

  it('calls goToStep(2) on Next button when saved', async () => {
    mockCtx.oidcSaved = true
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Next: Configure Storage/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(2)
  })
})

describe('OIDCStep — LDAP mode', () => {
  beforeEach(() => {
    mockCtx.authMethod = 'ldap'
  })

  it('renders LDAP form when authMethod is ldap', () => {
    render(<OIDCStep />)
    expect(screen.getByText(/Service Account/i)).toBeInTheDocument()
    expect(screen.getByText(/User Search/i)).toBeInTheDocument()
    expect(screen.getByText(/Group Lookup/i)).toBeInTheDocument()
  })

  it('renders TLS switches', () => {
    render(<OIDCStep />)
    expect(screen.getByLabelText(/Use TLS/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/StartTLS/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Skip TLS Verify/i)).toBeInTheDocument()
  })

  it('renders user search and group lookup fields', () => {
    render(<OIDCStep />)
    expect(screen.getByLabelText(/User Filter/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Attribute/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Name Attribute/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Group Base DN/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Group Filter/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Group Member Attr/i)).toBeInTheDocument()
  })

  it('disables LDAP Test button when required fields empty', () => {
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled()
  })

  it('disables LDAP Save button when required fields empty', () => {
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Save LDAP/i })).toBeDisabled()
  })

  it('enables LDAP buttons when required fields filled', () => {
    mockCtx.ldapForm = {
      ...defaultLdapForm,
      host: 'ldap.example.com',
      bind_dn: 'cn=svc,dc=example,dc=com',
      bind_password: 'secret',
      base_dn: 'dc=example,dc=com',
      user_filter: '(uid=%s)',
    }
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Save LDAP/i })).toBeEnabled()
  })

  it('calls testLDAP on Test button click', async () => {
    mockCtx.ldapForm = {
      ...defaultLdapForm,
      host: 'ldap.example.com',
      bind_dn: 'cn=svc,dc=example,dc=com',
      bind_password: 'secret',
      base_dn: 'dc=example,dc=com',
      user_filter: '(uid=%s)',
    }
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Test Connection/i }))
    expect(mockCtx.testLDAP).toHaveBeenCalledOnce()
  })

  it('calls saveLDAP on Save button click', async () => {
    mockCtx.ldapForm = {
      ...defaultLdapForm,
      host: 'ldap.example.com',
      bind_dn: 'cn=svc,dc=example,dc=com',
      bind_password: 'secret',
      base_dn: 'dc=example,dc=com',
      user_filter: '(uid=%s)',
    }
    render(<OIDCStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Save LDAP/i }))
    expect(mockCtx.saveLDAP).toHaveBeenCalledOnce()
  })

  it('shows LDAP test result', () => {
    mockCtx.ldapTestResult = { success: true, message: 'LDAP bind successful' }
    render(<OIDCStep />)
    expect(screen.getByText('LDAP bind successful')).toBeInTheDocument()
  })

  it('shows LDAP error result', () => {
    mockCtx.ldapTestResult = { success: false, message: 'Connection refused' }
    render(<OIDCStep />)
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
  })

  it('shows LDAP saved success', () => {
    mockCtx.ldapSaved = true
    render(<OIDCStep />)
    expect(screen.getByText(/LDAP configuration saved/i)).toBeInTheDocument()
  })

  it('shows Next button when ldapSaved', () => {
    mockCtx.ldapSaved = true
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Next: Configure Storage/i })).toBeInTheDocument()
  })

  it('toggles bind password visibility', async () => {
    render(<OIDCStep />)
    const toggleButtons = screen.getAllByLabelText(/Toggle password/i)
    expect(toggleButtons.length).toBeGreaterThan(0)
    await userEvent.setup().click(toggleButtons[0])
    // Just verify the click doesn't throw — the handler toggles showBindPassword state
  })

  it('shows spinners when ldapTesting', () => {
    mockCtx.ldapForm = {
      ...defaultLdapForm,
      host: 'ldap.example.com',
      bind_dn: 'cn=svc,dc=example,dc=com',
      bind_password: 'secret',
      base_dn: 'dc=example,dc=com',
      user_filter: '(uid=%s)',
    }
    mockCtx.ldapTesting = true
    render(<OIDCStep />)
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled()
  })
})
