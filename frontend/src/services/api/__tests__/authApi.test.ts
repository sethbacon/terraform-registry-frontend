import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logout, getCurrentUserWithRole } from '../authApi'
import { http } from '../http'

// Logout is a CSRF-protected POST rather than a full-page GET navigation. A GET
// logout is triggerable by a cross-site link — the auth cookie rides a top-level
// navigation — so it must go through the double-submit check that http's request
// interceptor satisfies by echoing the tfr_csrf cookie in X-CSRF-Token.
describe('authApi.logout', () => {
  // The app root, resolved against the test origin: assigning '/' to
  // location.href yields an absolute URL in the DOM.
  const APP_ROOT = 'http://localhost/'

  beforeEach(() => {
    window.location.href = APP_ROOT
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to the logout endpoint rather than navigating to it', async () => {
    const post = vi
      .spyOn(http, 'post')
      .mockResolvedValue({ data: { redirect_url: 'https://idp.example.com/end-session' } })

    await logout()

    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout')
  })

  // The backend answers 200 with the destination instead of a 302 because an XHR
  // cannot follow a cross-origin redirect to the IdP's end_session_endpoint, so
  // the SPA performs that navigation itself. Without this the IdP SSO session
  // would survive logout and silently re-authenticate the user.
  it('navigates to the redirect_url returned by the backend', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({
      data: { redirect_url: 'https://idp.example.com/end-session' },
    })

    await logout()

    expect(window.location.href).toBe('https://idp.example.com/end-session')
  })

  // This backend answers 403 (not 200) when the session cookie is already gone,
  // since its CSRF middleware rejects a cookie-less mutation. Local state is
  // cleared regardless, so a failure must still leave the app rather than
  // stranding the user on an authenticated-looking page.
  it('still leaves the app when the logout request fails', async () => {
    vi.spyOn(http, 'post').mockRejectedValue(new Error('403'))

    await logout()

    expect(window.location.href).toBe(APP_ROOT)
  })

  it('falls back to the app root when the response carries no redirect_url', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({ data: {} })

    await logout()

    expect(window.location.href).toBe(APP_ROOT)
  })
})

// #181 — the mapping in getCurrentUserWithRole itself. The AuthContext test cannot
// reach this: it mocks getCurrentUserWithRole, so this function never runs there.
// Proven, not assumed — mutating this mapping left that test green.
describe('authApi.getCurrentUserWithRole session lifetime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const body = (extra: Record<string, unknown>) => ({
    data: {
      user: { id: 'u1', email: 'a@b.c', name: 'Ada' },
      role_template: null,
      memberships: [],
      allowed_scopes: ['modules:read'],
      session_expires_at: null,
      ...extra,
    },
  })

  it('carries the remaining lifetime through', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(body({ session_expires_in: 300 }))
    expect((await getCurrentUserWithRole()).session_expires_in).toBe(300)
  })

  it('keeps a zero rather than collapsing it to null', async () => {
    // The trap this mapping exists to avoid: `0 || null` is null. Zero means "no
    // life left", which the provider fails closed on — collapsing it would
    // silently downgrade that to "no duration sent" and fall back to the instant.
    vi.spyOn(http, 'get').mockResolvedValue(body({ session_expires_in: 0 }))
    expect((await getCurrentUserWithRole()).session_expires_in).toBe(0)
  })

  it('maps an absent duration to null', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(body({}))
    expect((await getCurrentUserWithRole()).session_expires_in).toBeNull()
  })

  it('rejects a non-numeric duration rather than passing NaN on', async () => {
    // Date.now() + NaN is NaN, and setTimeout(fn, NaN) fires immediately — a
    // malformed body must not be able to end the session.
    vi.spyOn(http, 'get').mockResolvedValue(body({ session_expires_in: 'soon' }))
    expect((await getCurrentUserWithRole()).session_expires_in).toBeNull()
  })
})
