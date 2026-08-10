import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { captureReturnUrl, RETURN_URL_KEY } from '../returnUrl'

// Issue #695 — CallbackPage read sessionStorage.returnUrl and validated it
// against an open redirect, but nothing in the app ever wrote the key. The guard
// was correct and the feature it guarded did not exist: every OIDC login landed
// on '/'. These cover the write half.

/** Point window.location at a path without navigating the jsdom document. */
function at(path: string): void {
  window.history.pushState({}, '', path)
}

describe('captureReturnUrl', () => {
  beforeEach(() => {
    sessionStorage.clear()
    at('/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('records the current path with its query and hash', () => {
    at('/modules/hashicorp/consul/aws?tab=readme#inputs')
    captureReturnUrl()

    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBe(
      '/modules/hashicorp/consul/aws?tab=readme#inputs',
    )
  })

  // The two routes that would break the feature by being captured.
  it.each([
    ['/login', 'would return the user to the login form after logging in'],
    ['/auth/callback', 'is mid-consumption of this very key'],
    ['/auth/anything', 'any auth route is part of the flow being spanned'],
  ])('refuses to capture %s, which %s', (path) => {
    at(path)
    captureReturnUrl()

    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBeNull()
  })

  it("does not store '/', which is already the fallback", () => {
    at('/')
    captureReturnUrl()

    // Storing it buys nothing and leaves a stale entry to step over later.
    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBeNull()
  })

  // The reason this matters is the caller, not the helper: one call site is the
  // axios 401 response interceptor, and a throw there would abort the redirect
  // this feature exists to improve -- the #679 failure shape exactly.
  it('never throws when sessionStorage is unavailable', () => {
    at('/modules')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => captureReturnUrl()).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })

  it('overwrites a stale entry rather than keeping the older destination', () => {
    at('/modules')
    captureReturnUrl()
    at('/providers/hashicorp/aws')
    captureReturnUrl()

    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBe('/providers/hashicorp/aws')
  })
})
