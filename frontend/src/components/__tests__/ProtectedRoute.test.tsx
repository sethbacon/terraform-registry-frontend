import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'
import { describe, it, expect, vi } from 'vitest'

// Mock useAuth from AuthContext
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      allowedScopes: [],
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      allowedScopes: [],
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  // #695 wiring. captureReturnUrl() being correct is worth nothing if this
  // component never calls it — which is the same failure the issue described
  // from the other side: a well-tested read of a key nothing ever wrote.
  it('captures the current location before redirecting to /login', () => {
    sessionStorage.clear()
    // captureReturnUrl reads window.location, not the router's. Under
    // BrowserRouter in the app those agree; MemoryRouter never touches
    // window.location, so the test has to set it explicitly.
    window.history.pushState({}, '', '/providers/hashicorp/aws')

    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      allowedScopes: [],
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(sessionStorage.getItem('returnUrl')).toBe('/providers/hashicorp/aws')

    sessionStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('captures nothing when the user is authenticated', () => {
    // The control. Without it, calling captureReturnUrl unconditionally at the
    // top of the component would satisfy the test above while leaving a stale
    // destination behind on every authenticated render.
    sessionStorage.clear()
    window.history.pushState({}, '', '/providers/hashicorp/aws')

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      allowedScopes: ['admin'],
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(sessionStorage.getItem('returnUrl')).toBeNull()

    sessionStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('shows Access Denied when required scope is missing', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      allowedScopes: ['modules:read'],
    })

    renderWithRouter(
      <ProtectedRoute requiredScope="admin">
        <div>Admin Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('renders children when required scope is present', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      allowedScopes: ['modules:read'],
    })

    renderWithRouter(
      <ProtectedRoute requiredScope="modules:read">
        <div>Module Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Module Content')).toBeInTheDocument()
  })

  it('grants access when user has admin scope regardless of required scope', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      allowedScopes: ['admin'],
    })

    renderWithRouter(
      <ProtectedRoute requiredScope="modules:write">
        <div>Admin Access Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Admin Access Content')).toBeInTheDocument()
  })

  it('renders children when no required scope is specified', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      allowedScopes: [],
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Any Auth Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Any Auth Content')).toBeInTheDocument()
  })
})
