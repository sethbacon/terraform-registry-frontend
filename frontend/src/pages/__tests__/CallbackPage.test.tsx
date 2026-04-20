import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AuthContext
const mockSetToken = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    setToken: mockSetToken,
  }),
}))

// Must import after mock setup
import CallbackPage from '../CallbackPage'

// Mock window.location.replace
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, replace: vi.fn() },
  })
})

function renderWithParams(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <CallbackPage />
    </MemoryRouter>
  )
}

describe('CallbackPage', () => {
  it('shows loading spinner initially', () => {
    renderWithParams('?token=abc123')
    expect(screen.getByText('Completing authentication...')).toBeInTheDocument()
  })

  it('shows error when error param is present', async () => {
    renderWithParams('?error=access_denied&error_description=User+denied+access')
    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument()
      expect(screen.getByText('User denied access')).toBeInTheDocument()
    })
  })

  it('shows fallback error message when only error param', async () => {
    renderWithParams('?error=server_error')
    await waitFor(() => {
      expect(screen.getByText('server_error')).toBeInTheDocument()
    })
  })

  it('redirects to home when no token param (cookie-based auth)', async () => {
    renderWithParams('')
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('/')
    })
  })

  it('calls setToken when token param is present', async () => {
    renderWithParams('?token=jwt-token-123')
    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith('jwt-token-123')
    })
  })

  it('shows redirecting message on error', async () => {
    renderWithParams('?error=invalid_request')
    await waitFor(() => {
      expect(screen.getByText('Redirecting to login page...')).toBeInTheDocument()
    })
  })
})
