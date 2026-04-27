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
  setupStatus: null as { pending_feature_setup?: boolean } | null,
  authMethod: 'oidc' as 'oidc' | 'ldap',
  oidcForm: { provider_type: 'generic_oidc', issuer_url: '' } as Record<string, unknown>,
  oidcSaved: false,
  ldapForm: { ...defaultLdapForm } as Record<string, unknown>,
  ldapSaved: false,
  storageForm: { backend_type: 'local', local_base_path: '/data' } as Record<string, unknown>,
  storageSaved: false,
  scanningForm: { enabled: false, tool: 'trivy' } as Record<string, unknown>,
  scanningSaved: false,
  scanningTestResult: null as { version?: string } | null,
  adminEmail: '',
  adminSaved: false,
  completing: false,
  completeSetup: vi.fn(),
  goToStep: vi.fn(),
}

vi.mock('../../../../contexts/SetupWizardContext', () => ({
  useSetupWizard: () => mockCtx,
}))

import ReviewStep from '../ReviewStep'

function allSaved() {
  Object.assign(mockCtx, {
    setupStatus: null,
    authMethod: 'oidc',
    oidcForm: { provider_type: 'generic_oidc', issuer_url: 'https://issuer.example.com' },
    oidcSaved: true,
    ldapForm: { ...defaultLdapForm },
    ldapSaved: false,
    storageForm: { backend_type: 'local', local_base_path: '/data' },
    storageSaved: true,
    scanningForm: { enabled: false, tool: 'trivy' },
    scanningSaved: true,
    scanningTestResult: null,
    adminEmail: 'admin@example.com',
    adminSaved: true,
    completing: false,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mockCtx, {
    setupStatus: null,
    authMethod: 'oidc',
    oidcForm: { provider_type: 'generic_oidc', issuer_url: '' },
    oidcSaved: false,
    ldapForm: { ...defaultLdapForm },
    ldapSaved: false,
    storageForm: { backend_type: 'local', local_base_path: '/data' },
    storageSaved: false,
    scanningForm: { enabled: false, tool: 'trivy' },
    scanningSaved: false,
    scanningTestResult: null,
    adminEmail: '',
    adminSaved: false,
    completing: false,
  })
})

describe('ReviewStep', () => {
  it('renders heading', () => {
    render(<ReviewStep />)
    expect(screen.getByText('Ready to Complete Setup')).toBeInTheDocument()
  })

  it('shows "Not configured" chips when nothing is saved', () => {
    render(<ReviewStep />)
    const notConfigured = screen.getAllByText('Not configured')
    expect(notConfigured.length).toBe(4)
  })

  it('shows "Configured" chips when all steps are saved', () => {
    allSaved()
    render(<ReviewStep />)
    const configured = screen.getAllByText('Configured')
    expect(configured.length).toBe(3) // Identity, Storage, Admin
  })

  it('shows "Disabled" chip when scanning is saved but disabled', () => {
    allSaved()
    render(<ReviewStep />)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('shows config details when saved', () => {
    allSaved()
    render(<ReviewStep />)
    expect(screen.getByText(/Generic OIDC/)).toBeInTheDocument()
    expect(screen.getByText(/issuer\.example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/LOCAL/)).toBeInTheDocument()
    expect(screen.getByText(/admin@example\.com/)).toBeInTheDocument()
  })

  it('disables Complete button when not all required steps are saved', () => {
    render(<ReviewStep />)
    expect(screen.getByRole('button', { name: /Complete Setup/i })).toBeDisabled()
  })

  it('enables Complete button when auth, storage, and admin are saved', () => {
    allSaved()
    render(<ReviewStep />)
    expect(screen.getByRole('button', { name: /Complete Setup/i })).toBeEnabled()
  })

  it('calls completeSetup on button click', async () => {
    allSaved()
    render(<ReviewStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Complete Setup/i }))
    expect(mockCtx.completeSetup).toHaveBeenCalledOnce()
  })

  it('shows permanent warning alert', () => {
    render(<ReviewStep />)
    expect(screen.getByText(/This action is permanent/)).toBeInTheDocument()
  })

  it('navigates back on Back click', async () => {
    render(<ReviewStep />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Back/i }))
    expect(mockCtx.goToStep).toHaveBeenCalledWith(4)
  })

  it('shows spinner when completing', () => {
    allSaved()
    mockCtx.completing = true
    render(<ReviewStep />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complete Setup/i })).toBeDisabled()
  })
})
