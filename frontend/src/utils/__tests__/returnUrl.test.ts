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

    // The whole sessionStorage accessor is replaced rather than spying on
    // Storage.prototype.setItem: jsdom exposes setItem as an OWN property of the
    // storage instance, so a prototype spy is never reached. The real setItem
    // then runs, nothing throws, and the test passes while proving nothing --
    // which is exactly how this first went green locally and failed in CI.
    let attempted = false
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => ({
        getItem: () => null,
        removeItem: () => {},
        clear: () => {},
        setItem: () => {
          attempted = true
          throw new Error('QuotaExceededError')
        },
      }),
    })

    try {
      expect(() => captureReturnUrl()).not.toThrow()
      // Proves the throwing path was entered. Without it the assertion above
      // also passes when captureReturnUrl returns early and never writes.
      expect(attempted, 'captureReturnUrl never attempted a write').toBe(true)
    } finally {
      if (original) {
        Object.defineProperty(window, 'sessionStorage', original)
      } else {
        delete (window as unknown as { sessionStorage?: unknown }).sessionStorage
      }
    }
  })

  it('overwrites a stale entry rather than keeping the older destination', () => {
    at('/modules')
    captureReturnUrl()
    at('/providers/hashicorp/aws')
    captureReturnUrl()

    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBe('/providers/hashicorp/aws')
  })
})
