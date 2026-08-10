import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

// ---------------------------------------------------------------------------
// Helpers – we need to capture the interceptors that ApiClient registers so
// we can invoke them directly in tests.
// ---------------------------------------------------------------------------

type ReqFulfilled = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
type ReqRejected = (error: unknown) => unknown
type ResFulfilled = (response: AxiosResponse) => AxiosResponse
type ResRejected = (error: AxiosError) => unknown

let capturedReqFulfilled: ReqFulfilled
let capturedReqRejected: ReqRejected
let capturedResFulfilledHandlers: ResFulfilled[]
let capturedResRejectedHandlers: ResRejected[]
let mockAxiosInstance: AxiosInstance
let capturedCreateConfig: Record<string, unknown>

vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((fulfilled: ReqFulfilled) => {
          capturedReqFulfilled = fulfilled
        }),
      },
      response: {
        use: vi.fn(),
      },
    },
  }

  return {
    default: {
      create: vi.fn((config: Record<string, unknown>) => {
        // Expose for tests
        mockAxiosInstance = mockInstance as unknown as AxiosInstance
        capturedCreateConfig = config
        return mockInstance
      }),
    },
  }
})

// Import AFTER mocking axios so that the ApiClient constructor runs with the
// mock in place.
function getApiClient() {
  // Clear module cache so each test gets a fresh ApiClient with fresh interceptors
  vi.resetModules()
  // Re-apply the mock since resetModules clears it
  vi.doMock('axios', () => {
    const resFulfilledHandlers: ResFulfilled[] = []
    const resRejectedHandlers: ResRejected[] = []
    const mockInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((fulfilled: ReqFulfilled, rejected: ReqRejected) => {
            capturedReqFulfilled = fulfilled
            capturedReqRejected = rejected
          }),
        },
        response: {
          use: vi.fn((fulfilled: ResFulfilled, rejected: ResRejected) => {
            resFulfilledHandlers.push(fulfilled)
            capturedResFulfilledHandlers = resFulfilledHandlers
            resRejectedHandlers.push(rejected)
            capturedResRejectedHandlers = resRejectedHandlers
          }),
        },
      },
    }
    return {
      default: {
        create: vi.fn((config: Record<string, unknown>) => {
          mockAxiosInstance = mockInstance as unknown as AxiosInstance
          capturedCreateConfig = config
          return mockInstance
        }),
      },
    }
  })

  return import('../api').then((mod) => mod.default)
}

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Client configuration ──────────────────────────────────────────────

  describe('client configuration', () => {
    it('sets a default request timeout so a hung backend does not hang forever', async () => {
      await getApiClient()
      expect(capturedCreateConfig.timeout).toBe(30_000)
    })

    it('sends credentials so the HttpOnly auth + tfr_csrf cookies ride along', async () => {
      // withCredentials:true is load-bearing for the entire cookie-based
      // auth/CSRF model — flipping it to false would silently break every
      // authenticated request while leaving the hand-built interceptor tests green.
      await getApiClient()
      expect(capturedCreateConfig.withCredentials).toBe(true)
    })

    it('treats 2xx/3xx as success and 4xx/5xx as errors (validateStatus)', async () => {
      await getApiClient()
      const validateStatus = capturedCreateConfig.validateStatus as (status: number) => boolean
      expect(typeof validateStatus).toBe('function')
      expect(validateStatus(200)).toBe(true)
      expect(validateStatus(302)).toBe(true)
      expect(validateStatus(304)).toBe(true)
      expect(validateStatus(399)).toBe(true)
      expect(validateStatus(199)).toBe(false)
      expect(validateStatus(400)).toBe(false)
      expect(validateStatus(401)).toBe(false)
      expect(validateStatus(500)).toBe(false)
    })
  })

  // ─── Request interceptor – config-build error passthrough ─────────────

  describe('request interceptor – error passthrough', () => {
    it('re-rejects a request-config-build error unchanged', async () => {
      await getApiClient()

      const error = new Error('config build failed')
      await expect(capturedReqRejected(error)).rejects.toBe(error)
    })
  })

  // ─── Auth Interceptor ──────────────────────────────────────────────────
  // Cookie-only auth (#467): the HttpOnly session cookie is the sole ambient
  // credential. The interceptor must never synthesize an Authorization header
  // from client-readable storage — any JWT in localStorage is XSS-exfiltratable
  // and is treated as compromised, not re-attached.

  describe('request interceptor – no Authorization from localStorage', () => {
    it('does not attach Authorization even when a stray legacy token exists in localStorage', async () => {
      // Regression guard: a leftover pre-migration JWT in a shared browser
      // profile must stay inert — never silently promoted to a Bearer header.
      localStorage.setItem('auth_token', 'stale-legacy-jwt')
      await getApiClient()

      const config = {
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig

      const result = capturedReqFulfilled(config)
      expect(result.headers.Authorization).toBeUndefined()
    })

    it('does not add Authorization header when nothing is stored', async () => {
      await getApiClient()

      const config = {
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig

      const result = capturedReqFulfilled(config)
      expect(result.headers.Authorization).toBeUndefined()
    })

    it('leaves a caller-supplied Authorization header untouched', async () => {
      // The Setup Wizard's bootstrap calls set "SetupToken <token>" explicitly
      // (see setupRequest) — the interceptor must pass it through unmodified,
      // even with a stray legacy JWT sitting in localStorage.
      localStorage.setItem('auth_token', 'stale-legacy-jwt')
      await getApiClient()

      const config = {
        headers: { Authorization: 'SetupToken setup-abc123' } as Record<string, string>,
      } as InternalAxiosRequestConfig

      const result = capturedReqFulfilled(config)
      expect(result.headers.Authorization).toBe('SetupToken setup-abc123')
    })
  })

  // ─── CSRF Interceptor ──────────────────────────────────────────────────
  // This is the app's entire client-side CSRF defense (double-submit cookie):
  // echo the non-HttpOnly tfr_csrf cookie back as X-CSRF-Token on mutating
  // requests so the server can validate the pair.

  describe('request interceptor – CSRF token', () => {
    afterEach(() => {
      // Clear any cookie a test set so it doesn't leak into the next one.
      document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
    })

    it.each(['post', 'put', 'patch', 'delete'])(
      'attaches X-CSRF-Token on %s when the tfr_csrf cookie is present',
      async (method) => {
        document.cookie = 'tfr_csrf=csrf-token-value; path=/'
        await getApiClient()

        const config = {
          method,
          headers: {} as Record<string, string>,
        } as InternalAxiosRequestConfig
        const result = capturedReqFulfilled(config)
        expect(result.headers['X-CSRF-Token']).toBe('csrf-token-value')
      },
    )

    it.each(['post', 'PUT', 'Patch', 'DELETE'])(
      'is case-insensitive on the HTTP method (%s)',
      async (method) => {
        document.cookie = 'tfr_csrf=csrf-token-value; path=/'
        await getApiClient()

        const config = {
          method,
          headers: {} as Record<string, string>,
        } as InternalAxiosRequestConfig
        const result = capturedReqFulfilled(config)
        expect(result.headers['X-CSRF-Token']).toBe('csrf-token-value')
      },
    )

    it.each(['get', 'head'])(
      'omits X-CSRF-Token on %s even when the cookie is present',
      async (method) => {
        document.cookie = 'tfr_csrf=csrf-token-value; path=/'
        await getApiClient()

        const config = {
          method,
          headers: {} as Record<string, string>,
        } as InternalAxiosRequestConfig
        const result = capturedReqFulfilled(config)
        expect(result.headers['X-CSRF-Token']).toBeUndefined()
      },
    )

    it('defaults to GET (no header) when method is unspecified', async () => {
      document.cookie = 'tfr_csrf=csrf-token-value; path=/'
      await getApiClient()

      const config = { headers: {} as Record<string, string> } as InternalAxiosRequestConfig
      const result = capturedReqFulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBeUndefined()
    })

    it('omits X-CSRF-Token on a mutating request when no CSRF cookie exists yet', async () => {
      await getApiClient()

      const config = {
        method: 'post',
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig
      const result = capturedReqFulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBeUndefined()
    })

    it('extracts tfr_csrf when other cookies surround it', async () => {
      document.cookie = 'some_other=abc; path=/'
      document.cookie = 'tfr_csrf=csrf-token-value; path=/'
      document.cookie = 'yet_another=xyz; path=/'
      await getApiClient()

      const config = {
        method: 'post',
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig
      const result = capturedReqFulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('csrf-token-value')

      document.cookie = 'some_other=; Max-Age=0; path=/'
      document.cookie = 'yet_another=; Max-Age=0; path=/'
    })

    it('URL-decodes a tfr_csrf value containing encoded characters', async () => {
      // A base64url token wouldn't normally need encoding, but the cookie itself
      // could still carry percent-encoded characters -- getCookie must decode them.
      document.cookie = `tfr_csrf=${encodeURIComponent('token/with+special=chars')}; path=/`
      await getApiClient()

      const config = {
        method: 'post',
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig
      const result = capturedReqFulfilled(config)
      expect(result.headers['X-CSRF-Token']).toBe('token/with+special=chars')
    })

    // ─── #679: getCookie must not be able to break the request path ────────

    it('does not throw in the interceptor when tfr_csrf is malformed', async () => {
      // decodeURIComponent('ab%zz') throws URIError -- '%zz' is not a valid
      // escape. getCookie runs INSIDE the request interceptor, so an uncaught
      // throw rejects every mutating request with an opaque URIError instead of
      // a network error, which is a silent write outage that looks like nothing.
      //
      // The getter is stubbed rather than the value assigned through
      // document.cookie: what matters is that a malformed value REACHES
      // getCookie, and routing it through jsdom's cookie jar would make this
      // test depend on tough-cookie's validation rules instead of on the
      // behaviour under test.
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => 'tfr_csrf=ab%zz',
      })
      await getApiClient()

      const config = {
        method: 'post',
        headers: {} as Record<string, string>,
      } as InternalAxiosRequestConfig

      try {
        expect(() => capturedReqFulfilled(config)).not.toThrow()

        // And the raw bytes are what get echoed. The backend reads the same
        // undecoded value from the Cookie header, so this is the value that
        // actually matches; returning '' would drop the X-CSRF-Token header
        // entirely and turn a survivable request into a guaranteed rejection.
        expect(capturedReqFulfilled(config).headers['X-CSRF-Token']).toBe('ab%zz')
      } finally {
        delete (document as unknown as { cookie?: unknown }).cookie
      }
    })

    it('warns once, not per request, when two tfr_csrf cookies are visible', async () => {
      const { getCookie, resetDuplicateCookieWarning } = await import('../api/http')
      resetDuplicateCookieWarning()

      // jsdom's cookie jar keys on name+path+domain, so the setter cannot
      // produce a genuine shadowing pair. The browser can: a host-only cookie
      // plus a Domain-scoped one set by a sibling suite app on a shared parent
      // domain. document.cookie renders them indistinguishably, which is the
      // whole problem -- so stub the getter to emit what a browser would.
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => 'tfr_csrf=host-only; other=x; tfr_csrf=domain-scoped',
      })
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        // First match wins. There is no attribute information available to
        // choose better; the point is that the ambiguity is reported, not that
        // it is resolved.
        expect(getCookie('tfr_csrf')).toBe('host-only')
        expect(getCookie('tfr_csrf')).toBe('host-only')
        expect(getCookie('tfr_csrf')).toBe('host-only')

        const warnings = consoleError.mock.calls
          .map((c) => String(c[0] ?? ''))
          .filter((m) => m.includes('cookies named'))
        // Exactly one across three reads: this runs on every mutating request,
        // and a per-call log would bury the first occurrence under thousands.
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('tfr_csrf')
      } finally {
        delete (document as unknown as { cookie?: unknown }).cookie
        resetDuplicateCookieWarning()
      }
    })

    it('does not warn when only one tfr_csrf cookie is present', async () => {
      // The control half. Without it the warning could fire on every ordinary
      // single-cookie request and the test above would still pass.
      const { getCookie, resetDuplicateCookieWarning } = await import('../api/http')
      resetDuplicateCookieWarning()

      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => 'other=x; tfr_csrf=only-one; another=y',
      })
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        expect(getCookie('tfr_csrf')).toBe('only-one')
        expect(
          consoleError.mock.calls
            .map((c) => String(c[0] ?? ''))
            .filter((m) => m.includes('cookies named')),
        ).toHaveLength(0)
      } finally {
        delete (document as unknown as { cookie?: unknown }).cookie
        resetDuplicateCookieWarning()
      }
    })
  })

  // ─── 401 Interceptor ──────────────────────────────────────────────────

  describe('response interceptor – 401 handling', () => {
    it('does not treat stray legacy localStorage keys as a session (clears them, no redirect)', async () => {
      // Pre-migration sessions left auth_token/user in localStorage. Those keys
      // are no longer a session signal — only the tfr_csrf cookie is. A 401
      // must still sweep them out (one-time cleanup) without redirecting an
      // otherwise-anonymous visitor to /login.
      localStorage.setItem('auth_token', 'stale-legacy-jwt')
      localStorage.setItem('user', '{"id":"1"}')
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      window.history.pushState({}, '', '/public-page')

      // Use the first response rejected handler (401 auth handler), not the last (breadcrumb handler)
      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
      // No cookie signal → anonymous visitor → no redirect.
      expect(window.location.href).toContain('/public-page')
    })

    it('does not redirect on 401 when no session cookie exists (public endpoint)', async () => {
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      window.history.pushState({}, '', '/public-page')

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(window.location.href).toContain('/public-page')
    })

    it('redirects to /login on 401 for a cookie session (tfr_csrf present)', async () => {
      // The auth model: no token is ever written to localStorage, just the
      // HttpOnly auth cookie + the readable tfr_csrf double-submit cookie.
      document.cookie = 'tfr_csrf=some-csrf-token'
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(window.location.href).toContain('/login')

      // Clean up so this cookie doesn't leak into later tests.
      document.cookie = 'tfr_csrf=; Max-Age=0'
    })

    it('expires the tfr_csrf cookie on 401 so the redirect is one-shot (no reload loop)', async () => {
      // /login renders inside AuthProvider, which probes /auth/me on mount. If the
      // cookie survived the first 401, the probe's own 401 would re-trigger the
      // redirect and reload /login forever. The cookie signal must be consumed,
      // exactly like clearAuthStorage() consumes the localStorage signals.
      // path=/ matches how the backend really sets it (SetCSRFCookie, Path: "/").
      document.cookie = 'tfr_csrf=some-csrf-token; path=/'
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/auth/me' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      // Real browsers remove the cookie on Max-Age=0; happy-dom keeps the name with
      // an emptied value. Either way the token is gone, which is what getCookie sees.
      expect(document.cookie).not.toContain('some-csrf-token')

      // A second 401 (the /auth/me probe on the login page itself) must not redirect.
      window.history.pushState({}, '', '/somewhere-else')
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(window.location.href).toContain('/somewhere-else')
    })

    // SCM provider endpoints 401 when the SCM OAuth token has expired — that is
    // not a user session failure, so the tfr_csrf session signal must survive
    // (no cookie expiry, no redirect) and the reconnect prompt can render.
    it.each([
      ['repository endpoint', '/api/v1/scm-providers/123/repositories'],
      ['tags endpoint', '/api/v1/scm-providers/456/repositories/owner/repo/tags'],
      ['branches endpoint', '/api/v1/scm-providers/789/repositories/owner/repo/branches'],
    ])('does not clear the cookie session for SCM OAuth 401 (%s)', async (_label, url) => {
      document.cookie = 'tfr_csrf=live-session-csrf; path=/'
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url },
        isAxiosError: true,
      } as AxiosError

      window.history.pushState({}, '', '/scm-page')

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      // Session signal must NOT be consumed and no redirect issued.
      expect(document.cookie).toContain('tfr_csrf=live-session-csrf')
      expect(window.location.href).toContain('/scm-page')

      document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
    })

    it('never re-redirects to /login even if the CSRF cookie survives deletion, same page instance (loop guard #621)', async () => {
      // Reproduces the latent redirect loop: if tfr_csrf were Domain-scoped, the
      // path=/ deletion would silently no-op, hadSession would stay true, and
      // every subsequent 401 would redirect again. The module-level guard breaks
      // the loop within one page instance, independent of whether cookie deletion
      // took effect. Start off /login so the first redirect actually fires.
      window.history.pushState({}, '', '/app-page')
      document.cookie = 'tfr_csrf=live; path=/'
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/auth/me' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(window.location.href).toContain('/login')

      // Simulate a cookie that deletion could not remove (Domain-scoped in prod).
      document.cookie = 'tfr_csrf=live; path=/'
      window.history.pushState({}, '', '/still-here')
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      // The guard prevents a second redirect despite hadSession still being true.
      expect(window.location.href).toContain('/still-here')

      document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
    })

    it('does not redirect on 401 while already on /login even after a full page reload reset the module guard (navigation-surviving guard #621)', async () => {
      // The session-expiry redirect is a real full-page navigation to /login that
      // reloads the JS and RESETS hasRedirectedToLogin — getApiClient() re-imports
      // the module fresh below, reproducing that reset. If tfr_csrf were
      // Domain-scoped, its deletion no-ops and hadSession stays true on the
      // reloaded /login page, so the module flag alone cannot stop the loop. Only
      // refusing to navigate to /login while already on /login can. We spy on
      // location so pathname is pinned to /login and any href write is observable
      // (a bare URL check can't tell "no redirect" from "redirect to the page we
      // are already on").
      const originalLocation = window.location
      const hrefWrites: string[] = []
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
          origin: originalLocation.origin,
          pathname: '/login',
          get href() {
            return `${originalLocation.origin}/login`
          },
          set href(value: string) {
            hrefWrites.push(value)
          },
        },
      })
      try {
        document.cookie = 'tfr_csrf=live; path=/'
        await getApiClient() // fresh module → hasRedirectedToLogin === false

        const error = {
          response: { status: 401 },
          config: { url: '/api/v1/auth/me' },
          isAxiosError: true,
        } as AxiosError

        const authRejectedHandler = capturedResRejectedHandlers[0]
        await expect(authRejectedHandler(error)).rejects.toBe(error)
        // No navigation attempted despite hadSession=true and a reset module flag.
        expect(hrefWrites).toEqual([])
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: originalLocation,
        })
        document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
      }
    })
  })

  // ─── Mock-data safety (#615) ───────────────────────────────────────────────
  // VITE_USE_MOCK_DATA must never mask a real error response as a fake 200. The
  // mock short-circuit is scoped to the no-response (offline) case and is
  // hard-disabled in production builds.
  describe('response interceptor – mock data safety', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
    })

    it('does not mask a real 401 response as mock data (mock only applies with no response)', async () => {
      vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
      document.cookie = 'tfr_csrf=sess; path=/'
      await getApiClient()

      const error = {
        response: { status: 401 },
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      // Must reach the real 401 handler (reject + redirect), not resolve as mock.
      await expect(authRejectedHandler(error)).rejects.toBe(error)
      expect(window.location.href).toContain('/login')
    })

    it('still returns mock data when the backend is unreachable (no response) in dev', async () => {
      vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
      await getApiClient()

      const error = {
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      const result = await authRejectedHandler(error)
      expect(result).toEqual({
        data: { modules: [], meta: { total: 0, limit: 10, offset: 0 } },
        status: 200,
      })
    })

    it('never returns mock data in a production build even with the flag set (#615)', async () => {
      vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
      vi.stubEnv('PROD', true)
      await getApiClient()

      const error = {
        config: { url: '/api/v1/modules/search' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      // Even the no-response case must not fabricate a 200 in production.
      await expect(authRejectedHandler(error)).rejects.toBe(error)
    })
  })

  // ─── Mock data mode (VITE_USE_MOCK_DATA) ───────────────────────────────
  // Offline-development escape hatch: when explicitly enabled, the response
  // error interceptor short-circuits and returns canned data instead of
  // propagating the error, keyed off substrings in the failed request's URL.

  describe('response interceptor – mock data mode', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('does not return mock data when mock mode is disabled (default)', async () => {
      await getApiClient()

      const error = {
        response: { status: 500 },
        config: { url: '/api/v1/modules' },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      await expect(authRejectedHandler(error)).rejects.toBe(error)
    })

    it.each([
      ['/api/v1/modules/search', { modules: [], meta: { total: 0, limit: 10, offset: 0 } }],
      ['/api/v1/modules/ns/mod/aws/versions', { versions: [] }],
      ['/api/v1/providers/search', { providers: [], meta: { total: 0, limit: 10, offset: 0 } }],
      // Contains both '/providers' and '/scm-providers' so the providers branch's
      // scm-providers exclusion is false, falling through to the scm-providers branch.
      ['/api/v1/scm-providers/providers-fake', []],
      ['/api/v1/users', { users: [], meta: { total: 0, limit: 10, offset: 0 } }],
      ['/api/v1/organizations', []],
      ['/api/v1/apikeys', []],
      ['/api/v1/unmatched-resource', []],
    ])('returns mock data for %s when mock mode is enabled', async (url, expectedData) => {
      vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
      await getApiClient()

      const error = {
        config: { url },
        isAxiosError: true,
      } as AxiosError

      const authRejectedHandler = capturedResRejectedHandlers[0]
      const result = await authRejectedHandler(error)
      expect(result).toEqual({ data: expectedData, status: 200 })
    })

    it('falls back to an empty url when the error has no config in mock mode', async () => {
      vi.stubEnv('VITE_USE_MOCK_DATA', 'true')
      await getApiClient()

      const error = { isAxiosError: true } as AxiosError
      const authRejectedHandler = capturedResRejectedHandlers[0]
      const result = await authRejectedHandler(error)
      expect(result).toEqual({ data: [], status: 200 })
    })
  })

  // ─── Response interceptors – success passthrough & breadcrumb timing ───
  // http.ts registers two response interceptors: the auth/401 handler (index 0)
  // and the breadcrumb-timing handler (index 1). Both were previously only
  // exercised through their rejected callbacks; the fulfilled (success) path
  // of each was never invoked by any test.

  describe('response interceptor – auth handler success passthrough', () => {
    it('returns the response unchanged', async () => {
      await getApiClient()

      const response = { status: 200, config: {} } as AxiosResponse
      const result = capturedResFulfilledHandlers[0](response)
      expect(result).toBe(response)
    })
  })

  describe('response interceptor – breadcrumb timing', () => {
    it('records a breadcrumb with duration on success and returns the response unchanged', async () => {
      await getApiClient()

      const response = {
        status: 200,
        config: { method: 'get', url: '/api/v1/modules', _startTime: Date.now() - 42 },
      } as unknown as AxiosResponse
      const result = capturedResFulfilledHandlers[1](response)
      expect(result).toBe(response)
    })

    it('records a breadcrumb without a duration when _startTime was never stamped', async () => {
      await getApiClient()

      const response = { status: 200, config: {} } as AxiosResponse
      const result = capturedResFulfilledHandlers[1](response)
      expect(result).toBe(response)
    })

    it('records a breadcrumb on error and re-rejects with the same error', async () => {
      await getApiClient()

      const error = {
        response: { status: 500 },
        config: { method: 'post', url: '/api/v1/modules', _startTime: Date.now() - 10 },
        isAxiosError: true,
      } as unknown as AxiosError

      const breadcrumbHandler = capturedResRejectedHandlers[1]
      await expect(breadcrumbHandler(error)).rejects.toBe(error)
    })

    it('falls back to GET and an empty url/status when the error has no config', async () => {
      await getApiClient()

      const error = { isAxiosError: true } as AxiosError

      const breadcrumbHandler = capturedResRejectedHandlers[1]
      await expect(breadcrumbHandler(error)).rejects.toBe(error)
    })
  })

  // ─── Setup Token ───────────────────────────────────────────────────────

  describe('setupRequest – SetupToken header', () => {
    it('uses SetupToken header for setup endpoints', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { valid: true } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      await client.validateSetupToken('my-setup-token')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/validate-token',
        {},
        expect.objectContaining({
          headers: { Authorization: 'SetupToken my-setup-token' },
        }),
      )
    })
  })

  // ─── Representative API methods ────────────────────────────────────────

  describe('searchModules', () => {
    it('calls GET /api/v1/modules/search with query params', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { modules: [], meta: { total: 0 } } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.searchModules({ query: 'vpc', limit: 10, offset: 0 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/search', {
        params: { q: 'vpc', limit: 10, offset: 0 },
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('searchProviders', () => {
    it('calls GET /api/v1/providers/search with query params', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { providers: [], meta: { total: 0 } } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.searchProviders({ query: 'aws', limit: 5, offset: 0 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/providers/search', {
        params: { q: 'aws', limit: 5, offset: 0 },
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('listUsers', () => {
    it('calls GET /api/v1/users with pagination params', async () => {
      const client = await getApiClient()

      const mockResponse = {
        data: {
          users: [{ id: '1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' }],
          pagination: { page: 1, per_page: 20, total: 1 },
        },
      }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.listUsers(1, 20)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users', {
        params: { page: 1, per_page: 20 },
      })
      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('1')
    })
  })

  describe('getActiveStorageConfig', () => {
    it('calls GET /api/v1/storage/config', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { id: 's1', backend_type: 'local', is_active: true } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.getActiveStorageConfig()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/config')
      expect(result).toEqual(mockResponse.data)
    })
  })

  // ─── Scanner management admin API ──────────────────────────────────────

  describe('scanner management API', () => {
    it('getScanByID calls GET /api/v1/admin/scanning/scans/:id', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { id: 'scan-1', status: 'completed' } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.getScanByID('scan-1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/scans/scan-1')
      expect(result).toEqual(mockResponse.data)
    })

    it('checkScannerLatest calls GET /api/v1/admin/scanning/latest with the tool param', async () => {
      const client = await getApiClient()

      const mockResponse = {
        data: {
          tool: 'trivy',
          current_version: '0.49.0',
          latest_version: '0.50.0',
          update_available: true,
          signature_supported: true,
        },
      }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.checkScannerLatest('trivy')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/latest', {
        params: { tool: 'trivy' },
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('adminInstallScanner calls POST /api/v1/admin/scanning/install with the body', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { tool: 'trivy', installed_version: '0.50.0', activated: true } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const payload = { tool: 'trivy', version: '0.50.0', activate: true }
      const result = await client.adminInstallScanner(payload)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/scanning/install', payload)
      expect(result).toEqual(mockResponse.data)
    })

    it('triggerScannerCheck calls POST /api/v1/admin/scanning/check', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { message: 'check queued' } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.triggerScannerCheck()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/scanning/check')
      expect(result).toEqual(mockResponse.data)
    })

    it('saveScannerAutoUpdate calls PUT /api/v1/admin/scanning/auto-update with the body', async () => {
      const client = await getApiClient()

      const mockResponse = {
        data: { enabled: true, interval_hours: 24, requires_approval: true, auto_approve_rules: '' },
      }
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const payload = {
        enabled: true,
        interval_hours: 24,
        requires_approval: true,
        auto_approve_rules: '',
      }
      const result = await client.saveScannerAutoUpdate(payload)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/scanning/auto-update', payload)
      expect(result).toEqual(mockResponse.data)
    })
  })

  // ─── Notifications admin API ───────────────────────────────────────────

  describe('notifications admin API', () => {
    it('getNotificationsConfig calls GET /api/v1/admin/notifications/config', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { enabled: true, password_configured: false } }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.getNotificationsConfig()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/notifications/config')
      expect(result).toEqual(mockResponse.data)
    })

    it('saveNotificationsConfig calls PUT /api/v1/admin/notifications/config with the body', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { enabled: true } }
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const payload = {
        enabled: true,
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          username: 'mailer',
          from: 'noreply@example.com',
          use_tls: true,
          password: 'secret',
        },
        recipients: [] as string[],
        events: {
          api_key_expiring: true,
          module_published: true,
          approval_pending: true,
          cve_detected: true,
          scanner_update_available: true,
        },
        api_key_expiry_warning_days: 7,
        api_key_expiry_check_interval_hours: 24,
      }
      const result = await client.saveNotificationsConfig(payload)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/notifications/config', payload)
      expect(result).toEqual(mockResponse.data)
    })

    it('sendTestNotification posts the provided recipients', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { success: true, message: 'sent' } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const payload = { recipients: ['ops@example.com'] }
      const result = await client.sendTestNotification(payload)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/notifications/test', payload)
      expect(result).toEqual(mockResponse.data)
    })

    it('sendTestNotification falls back to an empty body when no request is given', async () => {
      const client = await getApiClient()

      const mockResponse = { data: { success: true, message: 'sent' } }
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

      const result = await client.sendTestNotification()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/notifications/test', {})
      expect(result).toEqual(mockResponse.data)
    })
  })

  // ─── Structural checks ────────────────────────────────────────────────

  describe('exports', () => {
    it('exports a default api client instance', async () => {
      const client = await getApiClient()
      expect(client).toBeDefined()
    })

    it('exposes core public methods', async () => {
      const client = await getApiClient()
      expect(typeof client.login).toBe('function')
      expect(typeof client.logout).toBe('function')
      expect(typeof client.searchModules).toBe('function')
      expect(typeof client.searchProviders).toBe('function')
      expect(typeof client.validateSetupToken).toBe('function')
      expect(typeof client.getVersionInfo).toBe('function')
      expect(typeof client.getActiveAdvisories).toBe('function')
      expect(typeof client.listAdminAdvisories).toBe('function')
      expect(typeof client.triggerAdvisoryPoll).toBe('function')
    })

    it('composes every domain module function exactly once (no cross-domain collisions)', async () => {
      // A duplicate function name across two domain modules would silently drop
      // one of them in the barrel's object spread — this is the parity guard the
      // index.ts doc comment refers to.
      const mod = await import('../api')
      const domainFnNames = Object.values(mod.apiDomains).flatMap((domain) =>
        Object.entries(domain)
          .filter(([, value]) => typeof value === 'function')
          .map(([name]) => name),
      )
      expect(new Set(domainFnNames).size).toBe(domainFnNames.length)

      const composed = mod.default as Record<string, unknown>
      const composedFnNames = Object.keys(composed).filter(
        (name) => typeof composed[name] === 'function',
      )
      expect([...composedFnNames].sort()).toEqual([...domainFnNames].sort())
    })

    it('excludes devApi (dev-only endpoints stay out of the eager production bundle, #608)', async () => {
      const mod = await import('../api')
      const composed = mod.default as Record<string, unknown>
      expect(composed.devLogin).toBeUndefined()
      expect(composed.getDevStatus).toBeUndefined()
      expect(composed.listUsersForImpersonation).toBeUndefined()
      expect(composed.impersonateUser).toBeUndefined()
      expect(mod.apiDomains).not.toHaveProperty('devApi')
    })
  })

  // ─── CVE Advisories ───────────────────────────────────────────────────────
  describe('CVE advisories', () => {
    describe('getActiveAdvisories', () => {
      it('calls GET /api/v1/advisories/active and returns array', async () => {
        const client = await getApiClient()

        const advisories = [
          {
            id: 'a1',
            source_id: 'CVE-2024-1234',
            severity: 'high',
            summary: 'A vuln',
            references: [],
            target_kind: 'binary',
            targets: [],
          },
        ]
          ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: advisories,
          })

        const result = await client.getActiveAdvisories()

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/advisories/active')
        expect(result).toHaveLength(1)
        expect(result[0].source_id).toBe('CVE-2024-1234')
      })

      it('returns empty array when response is not an array', async () => {
        const client = await getApiClient()

          ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null })

        const result = await client.getActiveAdvisories()

        expect(result).toEqual([])
      })
    })

    describe('listAdminAdvisories', () => {
      it('calls GET /api/v1/admin/advisories without params when kind is omitted', async () => {
        const client = await getApiClient()

        const mockResponse = { data: { advisories: [], total: 0 } }
          ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

        const result = await client.listAdminAdvisories()

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/advisories', {
          params: undefined,
        })
        expect(result.total).toBe(0)
      })

      it('passes kind as query param when provided', async () => {
        const client = await getApiClient()

        const mockResponse = { data: { advisories: [], total: 0 } }
          ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse)

        await client.listAdminAdvisories('binary')

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/advisories', {
          params: { kind: 'binary' },
        })
      })
    })

    describe('triggerAdvisoryPoll', () => {
      it('calls POST /api/v1/admin/advisories/poll and returns message', async () => {
        const client = await getApiClient()

          ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { message: 'poll queued' },
          })

        const result = await client.triggerAdvisoryPoll()

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/advisories/poll')
        expect(result.message).toBe('poll queued')
      })
    })
  })

  // ─── Auth ─────────────────────────────────────────────────────────────────
  describe('auth methods', () => {
    it('refreshToken calls POST /api/v1/auth/refresh and returns expires_in (no token)', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { expires_in: 900 },
        })
      const result = await client.refreshToken()
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/auth/refresh')
      expect(result.expires_in).toBe(900)
    })

    it('getCurrentUser calls GET /api/v1/auth/me', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1', email: 'a@b.com' } },
        })
      const result = await client.getCurrentUser()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/auth/me')
      expect(result.id).toBe('u1')
    })

    it('getCurrentUserWithRole returns user, role_template, allowed_scopes', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1' }, role_template: { id: 'r1' }, allowed_scopes: ['admin'] },
        })
      const result = await client.getCurrentUserWithRole()
      expect(result.user.id).toBe('u1')
      expect(result.role_template?.id).toBe('r1')
      expect(result.allowed_scopes).toEqual(['admin'])
    })

    it('getCurrentUserWithRole defaults missing fields', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1' } },
        })
      const result = await client.getCurrentUserWithRole()
      expect(result.role_template).toBeNull()
      expect(result.allowed_scopes).toEqual([])
    })

    // devLogin/getDevStatus/listUsersForImpersonation/impersonateUser are covered
    // in services/api/__tests__/devApi.test.ts, not here: devApi is deliberately
    // excluded from this composed client so it can be dead-code-eliminated from
    // the production bundle (#608) — see the "excludes devApi" test below.
  })

  // ─── Modules ──────────────────────────────────────────────────────────────
  describe('module methods', () => {
    it('getModuleVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { versions: [] },
        })
      await client.getModuleVersions('hashicorp', 'consul', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/v1/modules/hashicorp/consul/aws/versions',
      )
    })

    it('createModuleRecord', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'm1' },
        })
      const result = await client.createModuleRecord({
        namespace: 'ns',
        name: 'mod',
        system: 'aws',
        organization_id: 'org123',
      })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/create', {
        namespace: 'ns',
        name: 'mod',
        system: 'aws',
        organization_id: 'org123',
      })
      expect(result.id).toBe('m1')
    })

    it('uploadModule sends FormData', async () => {
      const client = await getApiClient()
      const fd = new FormData()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { ok: true },
        })
      await client.uploadModule(fd)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/modules',
        fd,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          // Large archives can legitimately exceed the default request timeout.
          timeout: 0,
        }),
      )
    })

    it('uploadModule forwards an AbortSignal so a stalled upload can be cancelled (#602)', async () => {
      const client = await getApiClient()
      const fd = new FormData()
      const controller = new AbortController()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.uploadModule(fd, { signal: controller.signal })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/modules',
        fd,
        expect.objectContaining({ timeout: 0, signal: controller.signal }),
      )
    })

    it('getModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'm1' },
        })
      await client.getModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws')
    })

    it('deleteModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws')
    })

    it('deleteModuleVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0',
      )
    })

    it('deprecateModuleVersion with message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModuleVersion('ns', 'mod', 'aws', '1.0.0', 'old')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate',
        { message: 'old' },
      )
    })

    it('deprecateModuleVersion without message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate',
        {},
      )
    })

    it('undeprecateModuleVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateModuleVersion('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0/deprecate',
      )
    })

    it('deprecateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateModule('ns', 'mod', 'aws', { message: 'eol' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/deprecate', {
        message: 'eol',
      })
    })

    it('undeprecateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateModule('ns', 'mod', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/modules/ns/mod/aws/deprecate')
    })

    it('updateModule', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateModule('m1', { description: 'new desc' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/modules/m1', {
        description: 'new desc',
      })
    })

    it('getModuleScan', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { status: 'clean' },
        })
      await client.getModuleScan('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0/scan',
      )
    })

    it('getModuleDocs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { content: '' },
        })
      await client.getModuleDocs('ns', 'mod', 'aws', '1.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/1.0.0/docs',
      )
    })
  })

  // ─── Providers ────────────────────────────────────────────────────────────
  describe('provider methods', () => {
    it('getProviderVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { versions: [] },
        })
      await client.getProviderVersions('hashicorp', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/providers/hashicorp/aws/versions')
    })

    it('uploadProvider sends FormData', async () => {
      const client = await getApiClient()
      const fd = new FormData()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.uploadProvider(fd)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/providers',
        fd,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          // Large archives can legitimately exceed the default request timeout.
          timeout: 0,
        }),
      )
    })

    it('uploadProvider forwards an AbortSignal so a stalled upload can be cancelled (#602)', async () => {
      const client = await getApiClient()
      const fd = new FormData()
      const controller = new AbortController()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.uploadProvider(fd, { signal: controller.signal })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/providers',
        fd,
        expect.objectContaining({ timeout: 0, signal: controller.signal }),
      )
    })

    it('getProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'p1' },
        })
      await client.getProvider('hashicorp', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws')
    })

    it('deleteProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteProvider('hashicorp', 'aws')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/providers/hashicorp/aws')
    })

    it('deleteProviderVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0',
      )
    })

    it('deprecateProviderVersion with message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateProviderVersion('hashicorp', 'aws', '5.0.0', 'old')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate',
        { message: 'old' },
      )
    })

    it('deprecateProviderVersion without message', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate',
        {},
      )
    })

    it('undeprecateProviderVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateProviderVersion('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/deprecate',
      )
    })

    it('getProviderDocs with all params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { docs: [] },
        })
      await client.getProviderDocs('hashicorp', 'aws', '5.0.0', 'resources', 'en', 10, 0)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/docs',
        { params: { category: 'resources', language: 'en', limit: 10, offset: 0 } },
      )
    })

    it('getProviderDocs without optional params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { docs: [] },
        })
      await client.getProviderDocs('hashicorp', 'aws', '5.0.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/docs',
        { params: {} },
      )
    })

    it('getProviderDocContent', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { content: '# Doc' },
        })
      await client.getProviderDocContent('hashicorp', 'aws', '5.0.0', 'resources', 'aws_instance')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws/versions/5.0.0/docs/resources/aws_instance',
      )
    })
  })

  // ─── Path-segment encoding at call sites (#614, CWE-116) ───────────────────
  // encodeSegment() itself is unit-tested in api/__tests__/http.test.ts. These
  // guard the call sites: a future edit that dropped encodeSegment() from a
  // domain function's URL-building would not be caught by benign alphanumeric
  // ids elsewhere in this file, since those are encoding-invariant.
  describe('path-segment encoding at call sites', () => {
    it('getModule encodes a fragment character in a route param so the request is not truncated', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'm1' },
        })
      await client.getModule('ns', 'mod#evil', 'aws')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/modules/ns/mod%23evil/aws')
    })

    it('deleteModuleVersion encodes a path separator in the version so the target resource cannot shift', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteModuleVersion('ns', 'mod', 'aws', '../other')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/modules/ns/mod/aws/versions/..%2Fother',
      )
    })

    it('getProvider encodes a query-string character in a route param so it cannot inject query params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'p1' },
        })
      await client.getProvider('hashicorp', 'aws?admin=true')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/providers/hashicorp/aws%3Fadmin%3Dtrue',
      )
    })

    it('getSCMProvider encodes a fragment character in the id so the request is not truncated', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'scm-1' },
        })
      await client.getSCMProvider('scm-1#evil')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1%23evil')
    })
  })

  // ─── Users ────────────────────────────────────────────────────────────────
  describe('user methods', () => {
    it('searchUsers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            users: [{ id: 'u1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' }],
            pagination: {},
          },
        })
      const result = await client.searchUsers('test', 1, 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/search', {
        params: { q: 'test', page: 1, per_page: 10 },
      })
      expect(result.users[0].id).toBe('u1')
    })

    it('getUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u1', email: 'a@b.com', name: 'A', created_at: '', updated_at: '' } },
        })
      const result = await client.getUser('u1')
      expect(result.id).toBe('u1')
    })

    it('createUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { user: { id: 'u2', email: 'b@b.com', name: 'B', created_at: '', updated_at: '' } },
        })
      const result = await client.createUser({ email: 'b@b.com', name: 'B' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/users', {
        email: 'b@b.com',
        name: 'B',
      })
      expect(result.id).toBe('u2')
    })

    it('updateUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            user: { id: 'u1', email: 'a@b.com', name: 'Updated', created_at: '', updated_at: '' },
          },
        })
      const result = await client.updateUser('u1', { name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/users/u1', { name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('deleteUser', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { ok: true },
        })
      await client.deleteUser('u1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/users/u1')
    })

    it('getUserMemberships', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { memberships: [{ org_id: 'o1' }] },
        })
      const result = await client.getUserMemberships('u1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/u1/memberships')
      expect(result).toHaveLength(1)
    })

    it('getCurrentUserMemberships', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { memberships: [] },
        })
      await client.getCurrentUserMemberships()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/users/me/memberships')
    })

    it('transformUser handles PascalCase fields', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            user: {
              ID: 'u1',
              Email: 'a@b.com',
              Name: 'A',
              CreatedAt: '2025-01-01',
              UpdatedAt: '2025-01-01',
              RoleTemplateID: 'r1',
            },
          },
        })
      const result = await client.getUser('u1')
      expect(result.id).toBe('u1')
      expect(result.email).toBe('a@b.com')
      expect(result.role_template_id).toBe('r1')
    })

    it('listUsers passes through inline memberships on each user', async () => {
      const client = await getApiClient()
      const inlineMembership = {
        organization_id: 'org-1',
        organization_name: 'Acme',
        role_template_name: 'admin',
        created_at: '2025-01-01',
      }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            users: [
              {
                id: 'u1',
                email: 'a@b.com',
                name: 'A',
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
                memberships: [inlineMembership],
              },
            ],
            pagination: { total: 1, page: 1, per_page: 20 },
          },
        })
      const result = await client.listUsers(1, 20)
      expect(result.users).toHaveLength(1)
      expect(result.users[0].memberships).toHaveLength(1)
      expect(result.users[0].memberships![0].organization_name).toBe('Acme')
    })
  })

  // ─── Organizations ────────────────────────────────────────────────────────
  describe('organization methods', () => {
    it('listOrganizations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            organizations: [
              {
                id: 'o1',
                name: 'org1',
                display_name: 'Org 1',
                idp_type: 'saml',
                idp_name: 'corp-idp',
                created_at: '',
                updated_at: '',
              },
            ],
          },
        })
      const result = await client.listOrganizations(1, 20)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations', {
        params: { page: 1, per_page: 20 },
      })
      expect(result).toHaveLength(1)
      // The transform must pass the IdP binding through — dropping it made the
      // binding invisible and un-clearable in the admin UI (#538).
      expect(result[0].idp_type).toBe('saml')
      expect(result[0].idp_name).toBe('corp-idp')
    })

    it('searchOrganizations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            organizations: [
              { id: 'o1', name: 'org1', display_name: 'Org 1', created_at: '', updated_at: '' },
            ],
          },
        })
      const result = await client.searchOrganizations('org', 1, 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations/search', {
        params: { q: 'org', page: 1, per_page: 10 },
      })
      expect(result).toHaveLength(1)
    })

    it('getOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            organization: {
              id: 'o1',
              name: 'org1',
              display_name: 'Org 1',
              created_at: '',
              updated_at: '',
            },
          },
        })
      const result = await client.getOrganization('o1')
      expect(result.id).toBe('o1')
    })

    it('createOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          status: 201,
          data: {
            organization: {
              id: 'o2',
              name: 'new',
              display_name: 'New',
              created_at: '',
              updated_at: '',
            },
          },
        })
      const result = await client.createOrganization({ name: 'new', display_name: 'New' })
      expect(result.id).toBe('o2')
    })

    it('createOrganization sanitizes a leaked backend error before wrapping it (#601)', async () => {
      // A 2xx/3xx-other-than-200/201 response resolves (validateStatus < 400) and
      // reaches the error branch. The raw backend string must NOT be smuggled out
      // through the plain-Error branch that bypasses getErrorMessage's sanitizer.
      const client = await getApiClient()
      const leaked = 'pq: duplicate key value violates unique constraint "orgs_name_key"'
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          status: 202,
          data: { error: leaked },
        })
      await expect(
        client.createOrganization({ name: 'dup', display_name: 'Dup' }),
      ).rejects.toThrow('Failed to create organization')
    })

    it('createOrganization still surfaces a short, clean backend error', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          status: 202,
          data: { error: 'Organization name already taken' },
        })
      await expect(
        client.createOrganization({ name: 'dup', display_name: 'Dup' }),
      ).rejects.toThrow('Organization name already taken')
    })

    it('updateOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            organization: {
              id: 'o1',
              name: 'org1',
              display_name: 'Updated',
              created_at: '',
              updated_at: '',
            },
          },
        })
      const result = await client.updateOrganization('o1', { display_name: 'Updated' })
      expect(result.display_name).toBe('Updated')
    })

    it('deleteOrganization', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteOrganization('o1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/organizations/o1')
    })

    it('addOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.addOrganizationMember('o1', { user_id: 'u1' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/organizations/o1/members', {
        user_id: 'u1',
      })
    })

    it('updateOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateOrganizationMember('o1', 'u1', { role_template_id: 'r1' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/organizations/o1/members/u1', {
        role_template_id: 'r1',
      })
    })

    it('removeOrganizationMember', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.removeOrganizationMember('o1', 'u1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/organizations/o1/members/u1')
    })

    it('listOrganizationMembers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { members: [{ user_id: 'u1' }] },
        })
      const result = await client.listOrganizationMembers('o1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/organizations/o1/members')
      expect(result).toHaveLength(1)
    })

    it('transformOrganization throws for undefined org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { organization: undefined },
        })
      await expect(client.getOrganization('bad')).rejects.toThrow(
        'Cannot transform undefined organization',
      )
    })
  })

  // ─── API Keys ─────────────────────────────────────────────────────────────
  describe('API key methods', () => {
    it('listAPIKeys without org filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { keys: [{ id: 'k1', name: 'key1', scopes: [], created_at: '' }] },
        })
      const result = await client.listAPIKeys()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys', { params: {} })
      expect(result).toHaveLength(1)
    })

    it('listAPIKeys with org filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { keys: [] },
        })
      await client.listAPIKeys('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys', {
        params: { organization_id: 'org-1' },
      })
    })

    it('listAPIKeys normalizes PascalCase keys', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { keys: [{ ID: 'k1', Name: 'mykey', Scopes: ['read'], CreatedAt: '2025-01-01' }] },
        })
      const result = await client.listAPIKeys()
      expect(result[0].id).toBe('k1')
      expect(result[0].name).toBe('mykey')
      expect(result[0].scopes).toEqual(['read'])
    })

    it('createAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { key: 'secret', id: 'k1' },
        })
      const data = { name: 'key1', organization_id: 'o1', scopes: ['read'] }
      await client.createAPIKey(data)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/apikeys', data)
    })

    it('getAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'k1' },
        })
      await client.getAPIKey('k1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/apikeys/k1')
    })

    it('updateAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateAPIKey('k1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/apikeys/k1', { name: 'updated' })
    })

    it('deleteAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteAPIKey('k1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/apikeys/k1')
    })

    it('rotateAPIKey', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { new_key: 'secret2' },
        })
      await client.rotateAPIKey('k1', 24)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/apikeys/k1/rotate', {
        grace_period_hours: 24,
      })
    })
  })

  // ─── SCM Providers ────────────────────────────────────────────────────────
  describe('SCM provider methods', () => {
    it('listSCMProviders', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listSCMProviders()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers', { params: {} })
    })

    it('listSCMProviders with org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listSCMProviders('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers', {
        params: { organization_id: 'org-1' },
      })
    })

    it('createSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'scm-1' },
        })
      await client.createSCMProvider({ organization_id: 'o1', provider_type: 'github', name: 'GH' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/scm-providers',
        expect.objectContaining({ provider_type: 'github' }),
      )
    })

    it('getSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'scm-1' },
        })
      await client.getSCMProvider('scm-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1')
    })

    it('updateSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateSCMProvider('scm-1', { name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1', {
        name: 'Updated',
      })
    })

    it('deleteSCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteSCMProvider('scm-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1')
    })

    it('verifySCMProvider', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { ok: true, expires_at: '2026-01-01T00:00:00Z' },
        })
      const result = await client.verifySCMProvider('scm-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/verify')
      expect(result.ok).toBe(true)
    })

    it('initiateSCMOAuth', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { redirect_url: 'https://github.com/oauth' },
        })
      await client.initiateSCMOAuth('scm-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/oauth/authorize',
      )
    })

    it('refreshSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.refreshSCMToken('scm-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/oauth/refresh',
      )
    })

    it('getSCMTokenStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { connected: true },
        })
      const result = await client.getSCMTokenStatus('scm-1')
      expect(result.connected).toBe(true)
    })

    it('listSCMRepositories', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { repositories: [] },
        })
      await client.listSCMRepositories('scm-1', 'search')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/repositories',
        { params: { search: 'search' } },
      )
    })

    it('listSCMRepositoryTags', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { tags: [] },
        })
      await client.listSCMRepositoryTags('scm-1', 'owner', 'repo')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/repositories/owner/repo/tags',
      )
    })

    it('listSCMRepositoryBranches', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { branches: [] },
        })
      await client.listSCMRepositoryBranches('scm-1', 'owner', 'repo')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/repositories/owner/repo/branches',
      )
    })

    it('revokeSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.revokeSCMToken('scm-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/scm-providers/scm-1/oauth/token',
      )
    })

    it('saveSCMToken', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.saveSCMToken('scm-1', 'token123')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/scm-providers/scm-1/token', {
        access_token: 'token123',
      })
    })
  })

  // ─── Module SCM Linking ───────────────────────────────────────────────────
  describe('module SCM linking', () => {
    it('linkModuleToSCM', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.linkModuleToSCM('m1', {
        provider_id: 'scm-1',
        repository_owner: 'org',
        repository_name: 'repo',
      })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/modules/m1/scm',
        expect.objectContaining({ provider_id: 'scm-1' }),
      )
    })

    it('getModuleSCMInfo', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { linked: true },
        })
      await client.getModuleSCMInfo('m1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm')
    })

    it('updateModuleSCMLink', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateModuleSCMLink('m1', { auto_publish_enabled: true })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm', {
        auto_publish_enabled: true,
      })
    })

    it('unlinkModuleFromSCM', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.unlinkModuleFromSCM('m1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm')
    })

    it('triggerManualSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerManualSync('m1', { tag_name: 'v1.0.0' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/sync', {
        tag_name: 'v1.0.0',
      })
    })

    it('triggerManualSync without data', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerManualSync('m1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/sync', {})
    })

    it('getWebhookEvents unwraps the events array from the response envelope', async () => {
      const client = await getApiClient()
      const sample = [
        { id: 'e1', event_type: 'tag', state: 'succeeded' },
        { id: 'e2', event_type: 'push', state: 'failed' },
      ]
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { events: sample },
        })
      const result = await client.getWebhookEvents('m1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/modules/m1/scm/events')
      // Regression: the backend returns { events: [...] } — the client must hand
      // callers the bare array, not the wrapper, or Array.isArray checks fail
      // downstream and the UI panel renders empty.
      expect(result).toEqual(sample)
    })

    it('getWebhookEvents returns [] when the envelope is missing events', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {},
        })
      const result = await client.getWebhookEvents('m1')
      expect(result).toEqual([])
    })
  })

  // ─── Scanning ─────────────────────────────────────────────────────────────
  describe('scanning methods', () => {
    it('getScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { enabled: true },
        })
      await client.getScanningConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/config')
    })

    it('getScanningStats', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { total: 10 },
        })
      await client.getScanningStats()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/stats', {
        params: undefined,
      })
    })

    it('getScanningStats with params', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { total: 5, total_filtered: 5 },
        })
      await client.getScanningStats({ status: 'failed', limit: 10, offset: 0 })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/scanning/stats', {
        params: { status: 'failed', limit: 10, offset: 0 },
      })
    })
  })

  // ─── Dashboard ────────────────────────────────────────────────────────────
  describe('dashboard methods', () => {
    it('getDashboardStats', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { modules: {} },
        })
      await client.getDashboardStats()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/stats/dashboard')
    })
  })

  // ─── Mirrors ──────────────────────────────────────────────────────────────
  describe('mirror methods', () => {
    it('listMirrors', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { mirrors: [{ id: 'mir-1' }] },
        })
      const result = await client.listMirrors()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors', { params: {} })
      expect(result).toHaveLength(1)
    })

    it('listMirrors enabledOnly', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { mirrors: [] },
        })
      await client.listMirrors(true)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors', {
        params: { enabled: 'true' },
      })
    })

    it('getMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'mir-1' },
        })
      await client.getMirror('mir-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1')
    })

    it('createMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'mir-2' },
        })
      await client.createMirror({
        name: 'test',
        upstream_registry_url: 'https://registry.terraform.io',
      })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/mirrors',
        expect.objectContaining({ name: 'test' }),
      )
    })

    it('updateMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateMirror('mir-1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1', {
        name: 'updated',
      })
    })

    it('deleteMirror', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteMirror('mir-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1')
    })

    it('triggerMirrorSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.triggerMirrorSync('mir-1', { namespace: 'hashicorp' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/mirrors/mir-1/sync',
        { namespace: 'hashicorp' },
        // Regression guard (#599): nginx grants this endpoint a 600s
        // proxy_read_timeout/proxy_send_timeout because syncs can take several
        // minutes -- the client must not abort at the shared 30s default.
        { timeout: 600_000 },
      )
    })

    it('getMirrorStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { status: 'idle' },
        })
      await client.getMirrorStatus('mir-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mirrors/mir-1/status')
    })

    it('getMirrorProviders', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { providers: ['hashicorp/aws'] },
        })
      const result = await client.getMirrorProviders('mir-1')
      expect(result).toEqual(['hashicorp/aws'])
    })
  })

  // ─── Roles ────────────────────────────────────────────────────────────────
  describe('role template methods', () => {
    it('listRoleTemplates', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ id: 'r1' }],
        })
      const result = await client.listRoleTemplates()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/role-templates')
      expect(result).toHaveLength(1)
    })

    it('getRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'r1' },
        })
      await client.getRoleTemplate('r1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1')
    })

    it('createRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'r2' },
        })
      await client.createRoleTemplate({ name: 'editor', display_name: 'Editor', scopes: ['write'] })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/role-templates',
        expect.objectContaining({ name: 'editor' }),
      )
    })

    it('updateRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateRoleTemplate('r1', { display_name: 'Updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1', {
        display_name: 'Updated',
      })
    })

    it('deleteRoleTemplate', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteRoleTemplate('r1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/role-templates/r1')
    })
  })

  // ─── Approvals ────────────────────────────────────────────────────────────
  describe('approval methods', () => {
    it('listApprovalRequests', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ id: 'a1' }],
        })
      const result = await client.listApprovalRequests({ status: 'pending' })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals', {
        params: { status: 'pending' },
      })
      expect(result).toHaveLength(1)
    })

    it('listApprovalRequests without filters', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listApprovalRequests()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals', { params: {} })
    })

    it('getApprovalRequest', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'a1' },
        })
      await client.getApprovalRequest('a1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/approvals/a1')
    })

    it('createApprovalRequest', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'a2' },
        })
      await client.createApprovalRequest({
        mirror_config_id: 'mir-1',
        provider_namespace: 'hashicorp',
      })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/approvals',
        expect.objectContaining({ provider_namespace: 'hashicorp' }),
      )
    })

    it('reviewApproval', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.reviewApproval('a1', { status: 'approved', notes: 'lgtm' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/approvals/a1/review', {
        status: 'approved',
        notes: 'lgtm',
      })
    })
  })

  // ─── Mirror Policies ──────────────────────────────────────────────────────
  describe('mirror policy methods', () => {
    it('listMirrorPolicies', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ id: 'p1' }],
        })
      await client.listMirrorPolicies()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies', { params: {} })
    })

    it('listMirrorPolicies with org', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] })
      await client.listMirrorPolicies('org-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies', {
        params: { organization_id: 'org-1' },
      })
    })

    it('getMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'p1' },
        })
      await client.getMirrorPolicy('p1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/policies/p1')
    })

    it('createMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'p2' },
        })
      await client.createMirrorPolicy({ name: 'allow-all', policy_type: 'allow' })
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/policies',
        expect.objectContaining({ name: 'allow-all' }),
      )
    })

    it('updateMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateMirrorPolicy('p1', { name: 'updated' })
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/v1/admin/policies/p1', {
        name: 'updated',
      })
    })

    it('deleteMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteMirrorPolicy('p1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/policies/p1')
    })

    it('evaluateMirrorPolicy', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { allowed: true },
        })
      await client.evaluateMirrorPolicy(
        { registry: 'https://registry.terraform.io', namespace: 'hashicorp', provider: 'aws' },
        'org-1',
      )
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/policies/evaluate',
        { registry: 'https://registry.terraform.io', namespace: 'hashicorp', provider: 'aws' },
        { params: { organization_id: 'org-1' } },
      )
    })
  })

  // ─── Storage ──────────────────────────────────────────────────────────────
  describe('storage methods', () => {
    it('getSetupStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { setup_required: false },
        })
      await client.getSetupStatus()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/setup/status')
    })

    it('listStorageConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ id: 's1' }],
        })
      await client.listStorageConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/configs')
    })

    it('getStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 's1' },
        })
      await client.getStorageConfig('s1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/storage/configs/s1')
    })

    it('createStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 's2' },
        })
      await client.createStorageConfig({ backend_type: 's3' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/storage/configs',
        expect.objectContaining({ backend_type: 's3' }),
      )
    })

    it('updateStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateStorageConfig('s1', { backend_type: 's3' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/v1/storage/configs/s1',
        expect.objectContaining({ backend_type: 's3' }),
      )
    })

    it('deleteStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteStorageConfig('s1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/storage/configs/s1')
    })

    it('activateStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { message: 'activated' },
        })
      await client.activateStorageConfig('s1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/storage/configs/s1/activate')
    })

    it('testStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true, message: 'ok' },
        })
      await client.testStorageConfig({ backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/storage/configs/test',
        expect.objectContaining({ backend_type: 'local' }),
      )
    })

    it('planStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { items: 10 },
        })
      await client.planStorageMigration('s1', 's2')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/storage/migrations/plan', {
        source_config_id: 's1',
        target_config_id: 's2',
      })
    })

    it('startStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'mig-1' },
        })
      await client.startStorageMigration('s1', 's2')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/admin/storage/migrations', {
        source_config_id: 's1',
        target_config_id: 's2',
      })
    })

    it('getStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'mig-1' },
        })
      await client.getStorageMigration('mig-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/storage/migrations/mig-1')
    })

    it('cancelStorageMigration', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'mig-1', status: 'cancelled' },
        })
      await client.cancelStorageMigration('mig-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/storage/migrations/mig-1/cancel',
      )
    })

    it('listStorageMigrations', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ id: 'mig-1' }],
        })
      await client.listStorageMigrations()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/storage/migrations')
    })
  })

  // ─── Setup Wizard ─────────────────────────────────────────────────────────
  describe('setup wizard methods', () => {
    it('testOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true },
        })
      await client.testOIDCConfig('tok', {
        issuer_url: 'https://auth.example.com',
        client_id: 'id',
        client_secret: 'secret',
      } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/oidc/test',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('saveOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.saveOIDCConfig('tok', { issuer_url: 'https://auth.example.com' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/oidc',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('getAdminOIDCConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { issuer_url: 'https://auth.example.com' },
        })
      await client.getAdminOIDCConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/oidc/config')
    })

    it('updateOIDCGroupMapping', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateOIDCGroupMapping({ group_claim_name: 'groups' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/v1/admin/oidc/group-mapping',
        expect.objectContaining({ group_claim_name: 'groups' }),
      )
    })

    it('testSetupStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true },
        })
      await client.testSetupStorageConfig('tok', { backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/storage/test',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('saveSetupStorageConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { message: 'saved' },
        })
      await client.saveSetupStorageConfig('tok', { backend_type: 'local' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/storage',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('testScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true },
        })
      await client.testScanningConfig('tok', { enabled: true } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/scanning/test',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('saveScanningConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { message: 'saved' },
        })
      await client.saveScanningConfig('tok', { enabled: true } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/scanning',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('configureAdmin', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.configureAdmin('tok', { admin_email: 'admin@example.com' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/admin',
        expect.anything(),
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })

    it('completeSetup', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true },
        })
      await client.completeSetup('tok')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/setup/complete',
        {},
        expect.objectContaining({ headers: { Authorization: 'SetupToken tok' } }),
      )
    })
  })

  // ─── Terraform Mirrors Admin ──────────────────────────────────────────────
  describe('terraform mirror admin methods', () => {
    it('listPublicTerraformMirrorConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ name: 'tf' }],
        })
      const result = await client.listPublicTerraformMirrorConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries')
      expect(result).toHaveLength(1)
    })

    it('listPublicTerraformMirrorConfigs handles non-array', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null })
      const result = await client.listPublicTerraformMirrorConfigs()
      expect(result).toEqual([])
    })

    it('listTerraformMirrorConfigs', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { configs: [] },
        })
      await client.listTerraformMirrorConfigs()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors')
    })

    it('createTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'tc-1' },
        })
      await client.createTerraformMirrorConfig({ name: 'test', tool: 'terraform' } as never)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors',
        expect.objectContaining({ name: 'test' }),
      )
    })

    it('getTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'tc-1' },
        })
      await client.getTerraformMirrorConfig('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1')
    })

    it('getTerraformMirrorStatus', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { status: 'idle' },
        })
      await client.getTerraformMirrorStatus('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/status',
      )
    })

    it('updateTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.updateTerraformMirrorConfig('tc-1', { name: 'updated' } as never)
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1',
        expect.objectContaining({ name: 'updated' }),
      )
    })

    it('deleteTerraformMirrorConfig', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteTerraformMirrorConfig('tc-1')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/admin/terraform-mirrors/tc-1')
    })

    it('triggerTerraformMirrorSync', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { message: 'started' },
        })
      await client.triggerTerraformMirrorSync('tc-1')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/sync',
        {},
        // Regression guard (#599): this endpoint didn't even match nginx's
        // long-timeout regex before the fix, so it needs the same client-side
        // override as triggerMirrorSync once nginx.conf covers both paths.
        { timeout: 600_000 },
      )
    })

    it('listTerraformVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { versions: [] },
        })
      await client.listTerraformVersions('tc-1', { synced: true })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions',
        { params: { synced: 'true' } },
      )
    })

    it('listTerraformVersions without filter', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { versions: [] },
        })
      await client.listTerraformVersions('tc-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions',
        { params: {} },
      )
    })

    it('getTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { version: '1.5.0' },
        })
      await client.getTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0',
      )
    })

    it('deleteTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deleteTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0',
      )
    })

    it('deprecateTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.deprecateTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0/deprecate',
        {},
      )
    })

    it('undeprecateTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} })
      await client.undeprecateTerraformVersion('tc-1', '1.5.0')
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/versions/1.5.0/deprecate',
      )
    })

    it('listTerraformVersionPlatforms returns array from data', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: [{ os: 'linux', arch: 'amd64' }],
        })
      const result = await client.listTerraformVersionPlatforms('tc-1', '1.5.0')
      expect(result).toHaveLength(1)
    })

    it('listTerraformVersionPlatforms returns platforms from nested', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { platforms: [{ os: 'linux' }] },
        })
      const result = await client.listTerraformVersionPlatforms('tc-1', '1.5.0')
      expect(result).toHaveLength(1)
    })

    it('getTerraformMirrorHistory', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { history: [] },
        })
      await client.getTerraformMirrorHistory('tc-1', 10)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/admin/terraform-mirrors/tc-1/history',
        { params: { limit: 10 } },
      )
    })
  })

  // ─── Terraform Mirrors Public ─────────────────────────────────────────────
  describe('terraform mirror public methods', () => {
    it('listPublicTerraformVersions', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { versions: [] },
        })
      await client.listPublicTerraformVersions('terraform')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/terraform/binaries/terraform/versions')
    })

    it('getPublicLatestTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { version: '1.9.0' },
        })
      await client.getPublicLatestTerraformVersion('terraform')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/terraform/binaries/terraform/versions/latest',
      )
    })

    it('getPublicTerraformVersion', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { version: '1.5.0' },
        })
      await client.getPublicTerraformVersion('terraform', '1.5.0')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/terraform/binaries/terraform/versions/1.5.0',
      )
    })

    it('getTerraformBinaryDownload', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { download_url: 'https://...' },
        })
      await client.getTerraformBinaryDownload('terraform', '1.5.0', 'linux', 'amd64')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/terraform/binaries/terraform/versions/1.5.0/linux/amd64',
      )
    })
  })

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  describe('audit log methods', () => {
    it('listAuditLogs with filters', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { logs: [], pagination: {} },
        })
      await client.listAuditLogs({ page: 1, per_page: 25, resource_type: 'module' })
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/audit-logs', {
        params: { page: 1, per_page: 25, resource_type: 'module' },
      })
    })

    it('getAuditLog', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { id: 'log-1' },
        })
      await client.getAuditLog('log-1')
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/audit-logs/log-1')
    })

    it('exportAuditLogsCSV creates download', async () => {
      const client = await getApiClient()
      const createElementSpy = vi.spyOn(document, 'createElement')
      const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { })
      const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
      const clickSpy = vi.fn()
      createElementSpy.mockReturnValue({
        click: clickSpy,
        href: '',
        download: '',
      } as unknown as HTMLAnchorElement)

      client.exportAuditLogsCSV([
        { id: 'l1', created_at: '2025-01-01', action: 'create', resource_type: 'module' } as never,
      ])

      expect(createURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeURLSpy).toHaveBeenCalledWith('blob:url')

      createElementSpy.mockRestore()
      revokeURLSpy.mockRestore()
      createURLSpy.mockRestore()
    })

    it('exportAuditLogsJSON creates download', async () => {
      const client = await getApiClient()
      const createElementSpy = vi.spyOn(document, 'createElement')
      const revokeURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { })
      const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
      const clickSpy = vi.fn()
      createElementSpy.mockReturnValue({
        click: clickSpy,
        href: '',
        download: '',
      } as unknown as HTMLAnchorElement)

      client.exportAuditLogsJSON([{ id: 'l1', action: 'create' } as never])

      expect(createURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()

      createElementSpy.mockRestore()
      revokeURLSpy.mockRestore()
      createURLSpy.mockRestore()
    })
  })

  // ─── Phase 2: Enterprise Identity ──────────────────────────────────────────
  describe('enterprise identity methods', () => {
    it('getAuthProviders calls GET /api/v1/auth/providers', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {
            providers: [
              { type: 'oidc', name: 'Corporate' },
              { type: 'saml', name: 'Okta', id: 's1' },
            ],
          },
        })
      const result = await client.getAuthProviders()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/auth/providers')
      expect(result.providers).toHaveLength(2)
      expect(result.providers[1].type).toBe('saml')
    })

    it('ldapLogin calls POST /api/v1/auth/ldap/login with credentials (cookie is set server-side)', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: {},
        })
      await client.ldapLogin('admin', 'secret')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/auth/ldap/login', {
        username: 'admin',
        password: 'secret',
      })
    })

    it('getIdentityGroupMappings calls GET /api/v1/admin/identity/group-mappings', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { saml: { group_mappings: [] }, ldap: { group_mappings: [] } },
        })
      const result = await client.getIdentityGroupMappings()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/identity/group-mappings')
      expect(result).toHaveProperty('saml')
      expect(result).toHaveProperty('ldap')
    })

    it('getMTLSConfig calls GET /api/v1/admin/mtls/config', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { enabled: true, client_ca_file: '/ca.pem', mappings: [] },
        })
      const result = await client.getMTLSConfig()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/admin/mtls/config')
      expect(result.enabled).toBe(true)
    })
  })

  // ─── Version Info ─────────────────────────────────────────────────────────
  describe('version info', () => {
    it('getVersionInfo', async () => {
      const client = await getApiClient()
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { version: '1.0.0' },
        })
      const result = await client.getVersionInfo()
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/version')
      expect(result.version).toBe('1.0.0')
    })
  })

  // ─── UI Theme (whitelabel) ──────────────────────────────────────────────
  // getUITheme() must tolerate a 404 (endpoint not implemented by the backend
  // yet) silently, but report any other failure so a broken theme endpoint
  // doesn't fail invisibly -- see issue #498.
  describe('getUITheme', () => {
    it('returns the theme config on success', async () => {
      const client = await getApiClient()
      const theme = { product_name: 'Acme Registry', primary_color: '#5C4EE5' }
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: theme,
        })

      const result = await client.getUITheme()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/ui/theme')
      expect(result).toEqual(theme)
    })

    it('returns null without reporting an error on 404 (endpoint not implemented)', async () => {
      const client = await getApiClient()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 404 },
        })

      const result = await client.getUITheme()

      expect(result).toBeNull()
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('returns null and reports the error on a non-404 failure', async () => {
      const client = await getApiClient()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const serverError = Object.assign(new Error('Internal Server Error'), {
        isAxiosError: true,
        response: { status: 500 },
      })
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(serverError)

      const result = await client.getUITheme()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('[ErrorReporting]', 'Internal Server Error', {
        endpoint: '/api/v1/ui/theme',
      })
    })

    it('returns null and reports the error on a network failure with no response', async () => {
      const client = await getApiClient()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
        ; (mockAxiosInstance.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('Network Error'),
        )

      const result = await client.getUITheme()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('[ErrorReporting]', 'Network Error', {
        endpoint: '/api/v1/ui/theme',
      })
    })
  })
})
