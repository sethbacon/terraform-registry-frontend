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
vi.mock('../../services/api', () => ({
  default: {
    devLogin: (...args: unknown[]) => mockDevLogin(...args),
    login: (...args: unknown[]) => mockApiLogin(...args),
  },
}))

import LoginPage from '../LoginPage'

type ProbeResponse = 'ok' | 'fail' | 'reject' | { status: number; body?: unknown }

function mockProviderProbes(responses: Record<'oidc' | 'azuread', ProbeResponse>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: Request | URL | string) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const m = url.match(/provider=(\w+)/)
    const provider = (m?.[1] ?? '') as 'oidc' | 'azuread'
    const spec = responses[provider]
    if (spec === 'ok') return { type: 'opaqueredirect', status: 0 } as Response
    if (spec === 'reject') throw new Error('network')
    if (spec === 'fail') return { type: 'basic', status: 400, json: async () => ({}) } as unknown as Response
    return { type: 'basic', status: spec.status, json: async () => spec.body ?? {} } as unknown as Response
  })
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
  it('renders the login heading', () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'ok' })
    renderLoginPage()
    expect(screen.getByText('Terraform Registry')).toBeInTheDocument()
  })

  it('shows loading skeletons while probing providers', () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'ok' })
    renderLoginPage()
    expect(screen.getByTestId('provider-probing')).toBeInTheDocument()
  })

  it('renders only SSO button when OIDC probe succeeds and Azure fails', async () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'fail' })
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Azure AD' })).not.toBeInTheDocument()
  })

  it('renders only Azure AD button when Azure probe succeeds and OIDC fails', async () => {
    mockProviderProbes({ oidc: 'fail', azuread: 'ok' })
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with Azure AD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with SSO' })).not.toBeInTheDocument()
  })

  it('renders both buttons when both providers are reachable', async () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'ok' })
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Azure AD' })).toBeInTheDocument()
  })

  it('shows "no providers" info alert when both probes fail', async () => {
    mockProviderProbes({ oidc: 'fail', azuread: 'reject' })
    renderLoginPage()
    expect(await screen.findByTestId('no-providers-alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with SSO' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Azure AD' })).not.toBeInTheDocument()
  })

  it('shows info text about SSO', () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'ok' })
    renderLoginPage()
    expect(screen.getByText(/single sign-on for authentication/)).toBeInTheDocument()
  })

  it('does not render dev login button in test mode', () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'ok' })
    renderLoginPage()
    expect(screen.queryByText('Dev Login (Admin)')).not.toBeInTheDocument()
  })

  it('triggers api.login when OIDC button is clicked after successful probe', async () => {
    mockProviderProbes({ oidc: 'ok', azuread: 'fail' })
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with SSO' })
    await act(async () => { await userEvent.click(btn) })
    await waitFor(() => expect(mockApiLogin).toHaveBeenCalledWith('oidc'))
  })

  it('shows inline error Alert when provider login returns non-redirect error body', async () => {
    let probesDone = false
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: Request | URL | string) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!probesDone && url.includes('provider=')) {
        return { type: 'opaqueredirect', status: 0 } as Response
      }
      return { type: 'basic', status: 400, json: async () => ({ error: 'OIDC not configured' }) } as unknown as Response
    })
    renderLoginPage()
    const btn = await screen.findByRole('button', { name: 'Sign in with SSO' })
    probesDone = true
    await act(async () => { await userEvent.click(btn) })
    expect(await screen.findByText('OIDC not configured')).toBeInTheDocument()
  })
})
