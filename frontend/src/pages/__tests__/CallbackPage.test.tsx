import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
    renderWithParams('')
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

  it('redirects to home on the cookie-only callback (no params)', async () => {
    renderWithParams('')
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('/')
    })
  })

  it('never persists a ?token= query param to localStorage (cookie-only, #467)', async () => {
    // The backend no longer sends ?token= on callbacks. Even if a crafted or
    // stale URL carries one, it must be ignored — never written to localStorage
    // — and the navigation away from /auth/callback leaves no token in the URL.
    renderWithParams('?token=jwt-token-123')
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('/')
    })
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('shows redirecting message on error', async () => {
    renderWithParams('?error=invalid_request')
    await waitFor(() => {
      expect(screen.getByText('Redirecting to login page...')).toBeInTheDocument()
    })
  })

  it('navigates to /login 3 seconds after an error is shown', () => {
    // Fake timers to deterministically fire the redirect setTimeout without a
    // real 3s wait. handleCallback's error branch has no `await` before
    // scheduling the timeout, so it has already run synchronously by the time
    // render() (which wraps effects in act()) returns -- no waitFor needed.
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter initialEntries={['/auth/callback?error=access_denied']}>
          <Routes>
            <Route path="/auth/callback" element={<CallbackPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>,
      )
      expect(screen.getByText('Authentication Error')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
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

  it('guards against a duplicate callback exchange on React StrictMode double-invoke', async () => {
    // StrictMode intentionally mounts, cleans up, and remounts effects once in
    // dev to surface effects that aren't idempotent. exchangedRef must make the
    // second invocation a no-op, otherwise a double-mount would double-run the
    // whole callback handler (redundant navigation / OIDC-exchange side effects).
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/auth/callback']}>
          <CallbackPage />
        </MemoryRouter>
      </React.StrictMode>,
    )
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledTimes(1)
    })
  })
})
