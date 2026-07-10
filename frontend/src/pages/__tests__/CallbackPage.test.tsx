import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must import after mock setup
import CallbackPage from '../CallbackPage'

// Mock window.location.replace. Spy on the real Location object rather than
// replacing it with `{ ...window.location, replace: vi.fn() }`: Location's
// properties (origin, href, pathname, ...) are getters on its prototype, not
// own enumerable properties, so a spread copies none of them -- the spread
// form silently produced a location with origin === undefined, which made
// CallbackPage's own `new URL(raw, window.location.origin)` throw on every
// call (invalid base URL) and fall back to '/' unconditionally, regardless of
// whether the origin-comparison guard would have accepted or rejected `raw`.
// That masked the open-redirect guard entirely -- every returnUrl, safe or
// malicious, coincidentally resolved to '/' by way of the catch block instead
// of via the intended same-origin check.
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('returnUrl')
  vi.spyOn(window.location, 'replace').mockImplementation(() => {})
})

function renderWithParams(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <CallbackPage />
    </MemoryRouter>,
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

  it('stores the token in localStorage when token param is present', async () => {
    renderWithParams('?token=jwt-token-123')
    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('jwt-token-123')
    })
  })

  it('shows redirecting message on error', async () => {
    renderWithParams('?error=invalid_request')
    await waitFor(() => {
      expect(screen.getByText('Redirecting to login page...')).toBeInTheDocument()
    })
  })

  describe('open-redirect guard (returnUrl)', () => {
    it('redirects to a legitimate same-origin returnUrl path', async () => {
      sessionStorage.setItem('returnUrl', '/admin/users')
      renderWithParams('')
      await waitFor(() => {
        expect(window.location.replace).toHaveBeenCalledWith('/admin/users')
      })
    })

    it('preserves the query string and hash on a same-origin returnUrl', async () => {
      sessionStorage.setItem('returnUrl', '/modules?sort=downloads#top')
      renderWithParams('')
      await waitFor(() => {
        expect(window.location.replace).toHaveBeenCalledWith('/modules?sort=downloads#top')
      })
    })

    it.each([
      ['an absolute cross-origin URL', 'https://evil.com'],
      ['a protocol-relative URL', '//evil.com'],
      ['a backslash-normalisation bypass', '/\\evil.com'],
      ['a single-slash scheme bypass', 'https:/evil.com'],
      ['a javascript: URI', 'javascript:alert(document.cookie)'],
    ])('falls back to "/" when returnUrl is %s', async (_label, payload) => {
      sessionStorage.setItem('returnUrl', payload)
      renderWithParams('')
      await waitFor(() => {
        expect(window.location.replace).toHaveBeenCalledWith('/')
      })
    })

    it('removes returnUrl from sessionStorage after reading it', async () => {
      sessionStorage.setItem('returnUrl', '/admin/users')
      renderWithParams('')
      await waitFor(() => {
        expect(window.location.replace).toHaveBeenCalled()
      })
      expect(sessionStorage.getItem('returnUrl')).toBeNull()
    })
  })
})
