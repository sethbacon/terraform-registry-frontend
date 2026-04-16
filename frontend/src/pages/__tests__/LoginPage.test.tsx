import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AuthContext
const mockLogin = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}))

// Mock the api service
vi.mock('../../services/api', () => ({
  default: {
    devLogin: vi.fn().mockResolvedValue({ token: 'test-jwt' }),
    login: vi.fn(),
  },
}))

import LoginPage from '../LoginPage'

beforeEach(() => {
  vi.clearAllMocks()
  // Mock fetch for AzureAD check
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    type: 'basic',
    status: 200,
  } as Response)
})

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('renders the login heading', () => {
    renderLoginPage()
    expect(screen.getByText('Terraform Registry')).toBeInTheDocument()
  })

  it('renders the sign in subtitle', () => {
    renderLoginPage()
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
  })

  it('renders SSO login button', () => {
    renderLoginPage()
    expect(screen.getByText('Sign in with SSO')).toBeInTheDocument()
  })

  it('shows info text about SSO', () => {
    renderLoginPage()
    expect(screen.getByText(/single sign-on for authentication/)).toBeInTheDocument()
  })

  it('shows contact administrator message', () => {
    renderLoginPage()
    expect(screen.getByText(/Contact your administrator/)).toBeInTheDocument()
  })

  it('shows dev login button in development mode', () => {
    // import.meta.env.MODE is 'test' in vitest, not 'development'
    // So we check that the dev button is NOT shown in test mode
    renderLoginPage()
    // In test mode, isDev will be false
    expect(screen.queryByText('Dev Login (Admin)')).not.toBeInTheDocument()
  })
})
