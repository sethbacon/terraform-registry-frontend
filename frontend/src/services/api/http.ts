import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { addApiBreadcrumb } from '../errorReporting'
import { clearAuthStorage } from '../../utils/authStorage'

// In dev mode, use empty baseURL to use relative paths (goes through Vite proxy)
// In production, use the configured URL or default to current origin
export const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

// Only use mock responses when explicitly enabled (e.g., when backend is not
// running). Hard-gated to non-production builds: if this flag were ever left
// true in a deployed build it would mask real 401/403/5xx errors as fake 200s,
// swallowing auth failures and backend outages (CWE-636, audit #615).
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true' && !import.meta.env.PROD

// Default request timeout. A hung backend would otherwise leave requests pending
// indefinitely with no feedback to the user. File uploads (uploadModule,
// uploadProvider) explicitly opt out with timeout: 0 -- large archives on a slow
// connection can legitimately take longer than this.
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/** Read a cookie value by name. Returns empty string if not found. */
export function getCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : ''
}

function getMockResponse(url: string): { data: unknown; status: number } {
  // Mock responses for development when backend is not available
  let mockData: { data: unknown } = { data: [] }

  if (url.includes('/modules') && !url.includes('/versions')) {
    mockData.data = { modules: [], meta: { total: 0, limit: 10, offset: 0 } }
  } else if (
    url.includes('/providers') &&
    !url.includes('/versions') &&
    !url.includes('/scm-providers')
  ) {
    mockData.data = { providers: [], meta: { total: 0, limit: 10, offset: 0 } }
  } else if (url.includes('/users')) {
    mockData.data = { users: [], meta: { total: 0, limit: 10, offset: 0 } }
  } else if (url.includes('/organizations')) {
    mockData.data = []
  } else if (url.includes('/apikeys')) {
    mockData.data = []
  } else if (url.includes('/scm-providers')) {
    mockData.data = []
  } else if (url.includes('/versions')) {
    mockData.data = { versions: [] }
  }

  return { data: mockData.data, status: 200 }
}

/**
 * URL suffixes for the SCM-provider endpoints that proxy the *external* SCM API
 * using the stored OAuth token. A 401 from one of these means the OAuth token
 * expired or was revoked (show a reconnect prompt) — NOT that the user's app
 * session died. Endpoints that operate on the local provider record or the OAuth
 * linkage itself (list/get/update/delete, /oauth/*, /token, /verify) are
 * deliberately excluded: a 401 there is a real session failure and must redirect
 * to /login.
 *
 * This is a URL-shape heuristic. The robust fix is a structured backend signal
 * (a dedicated error code) so new external-SCM endpoints need not be enumerated
 * here — see audit issue #617 (backend change, out of tree). Until then, any new
 * endpoint that calls the external SCM API on the user's behalf must be added to
 * this list.
 */
const SCM_OAUTH_SUBRESOURCES = ['/repositories', '/tags', '/branches'] as const

/**
 * Classifies a 401 on an SCM-provider request as an OAuth-token failure (true,
 * keep the session) vs a user-session failure (false, wipe + redirect), from the
 * request URL shape.
 */
export function isSCMOAuthFailureUrl(url: string): boolean {
  return (
    url.includes('/scm-providers/') && SCM_OAUTH_SUBRESOURCES.some((suffix) => url.includes(suffix))
  )
}

/**
 * The CSRF double-submit only works when the SPA and API share an origin: the
 * tfr_csrf cookie is read via document.cookie, which is same-origin only. If
 * VITE_API_URL points at a different origin the cookie is unreadable and every
 * mutating request goes out with no X-CSRF-Token header (the backend then
 * rejects it — fail-closed, not a bypass). Returns a warning string for a
 * cross-origin config, or null when same-origin (audit #631).
 */
export function checkCsrfOriginConfig(apiBaseUrl: string, appOrigin: string): string | null {
  if (!apiBaseUrl) return null
  let apiOrigin: string
  try {
    apiOrigin = new URL(apiBaseUrl, appOrigin).origin
  } catch {
    // Relative base (e.g. "" or "/api") — same-origin by construction.
    return null
  }
  if (apiOrigin === appOrigin) return null
  return (
    `[api] VITE_API_URL (${apiOrigin}) is a different origin than the app (${appOrigin}). ` +
    'The tfr_csrf cookie is not readable cross-origin, so CSRF-protected (mutating) requests ' +
    'will be sent without X-CSRF-Token and rejected. Serve the API same-origin (reverse proxy) ' +
    'for the double-submit CSRF defense to work.'
  )
}

// Surface a cross-origin API misconfiguration loudly at startup instead of
// letting every mutation silently fail without a CSRF header (audit #631).
const csrfOriginWarning = checkCsrfOriginConfig(
  API_BASE_URL,
  typeof window !== 'undefined' ? window.location.origin : '',
)
if (csrfOriginWarning) {
  console.error(csrfOriginWarning)
}

/**
 * The single shared Axios instance behind every domain API module. All
 * cross-cutting behavior — CSRF double-submit echo, 401 session handling,
 * breadcrumb timing — lives in the interceptors below so domain modules
 * stay pure endpoint bindings.
 */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
  // Include cookies (HttpOnly auth cookie + CSRF cookie) on all requests.
  withCredentials: true,
  // Only validate successful status codes (2xx and 3xx)
  // This ensures errors are properly caught by the error interceptor
  validateStatus: (status) => status >= 200 && status < 400,
})

// Request interceptor to add CSRF token on mutating requests
http.interceptors.request.use(
  (config) => {
    // Add CSRF token header on mutating requests. The backend sets a non-HttpOnly
    // "tfr_csrf" cookie; we read it and echo it in X-CSRF-Token so the server can
    // validate the double-submit pattern.
    const method = (config.method || 'get').toUpperCase()
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const csrfToken = getCookie('tfr_csrf')
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }

    // Stamp the request start time for breadcrumb duration tracking
    ;(config as InternalAxiosRequestConfig & { _startTime?: number })._startTime = Date.now()
    return config
  },
  (error) => Promise.reject(error),
)

// Loop-prevention guard (audit #621): once the session-expiry redirect fires,
// never fire it again for this page's lifetime — independent of whether the
// tfr_csrf cookie deletion below actually took effect. Browser cookie deletion
// silently no-ops when the cookie was set with a Domain attribute this code
// doesn't mirror; without this guard that would keep hadSession=true forever and
// reintroduce the /login <-> 401 redirect loop the cookie expiry is meant to
// prevent. This module-scope flag only covers concurrent/same-tick 401s within a
// single page instance — a real redirect is a full-page navigation that reloads
// the module and resets it. The attribute-independent, navigation-surviving half
// of the guard is the "already on /login" check at the redirect site below:
// after the reload lands on /login, we refuse to redirect to /login again, so a
// Domain-scoped cookie whose deletion no-ops still cannot loop.
let hasRedirectedToLogin = false

// The redirect target. Refusing to navigate here when we are already on this path
// is what makes the loop guard survive a real page reload (see #621 above).
const LOGIN_PATH = '/login'

// Response interceptor for error handling
http.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    // Only return mock data when explicitly enabled AND the backend gave no
    // response at all (offline/no-backend dev). Never let it pre-empt real error
    // handling: a 401/403/5xx from a running backend must reach the session and
    // error logic below, not be masked as a fake 200 (CWE-636, audit #615).
    if (USE_MOCK_DATA && !error.response) {
      return getMockResponse(error.config?.url || '')
    }

    if (error.response?.status === 401) {
      // SCM provider endpoints return 401 when the SCM OAuth token has expired or
      // been revoked — this is not a user session failure. Let the error propagate
      // so the calling component (e.g. RepositoryBrowser) can show the reconnect
      // prompt rather than wiping the user's session and redirecting to /login.
      const url = error.config?.url || ''
      const isSCMOAuthFailure = isSCMOAuthFailureUrl(url)

      if (!isSCMOAuthFailure) {
        // Only redirect when the user previously had an active cookie session.
        // Fresh anonymous visitors receive 401 on probing endpoints like
        // /auth/me — this is expected and should NOT trigger a redirect so
        // public pages remain accessible. The "tfr_csrf" cookie is set only
        // when the backend issues or refreshes the auth cookie (see
        // middleware/csrf.go) and cleared on logout, so its presence is a
        // reliable session signal even though the HttpOnly auth cookie itself
        // isn't readable from JS.
        const hadSession = !!getCookie('tfr_csrf')
        clearAuthStorage()
        // Expire the CSRF cookie so the session signal is ONE-SHOT, exactly like
        // the localStorage keys clearAuthStorage() just removed. Without this, a
        // session invalidated server-side (revocation, secret rotation, clock
        // skew) redirects in a loop: /login mounts AuthProvider, which probes
        // /auth/me, 401s, and re-triggers this handler with the cookie still set.
        // Safe to clear from JS -- the cookie is non-HttpOnly by design and a dead
        // session's CSRF token has no value.
        document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
        // Two independent loop guards close the Domain-scoped-cookie case where the
        // deletion above no-ops and hadSession stays true forever: (1) the
        // module-scope flag stops concurrent 401s in this page instance; (2) the
        // "already on /login" check survives a real page reload (which resets that
        // flag) — redirecting to /login while already on /login is the loop itself.
        const alreadyOnLoginPage = window.location.pathname === LOGIN_PATH
        if (hadSession && !hasRedirectedToLogin && !alreadyOnLoginPage) {
          hasRedirectedToLogin = true
          window.location.href = LOGIN_PATH
        }
      }
    }
    return Promise.reject(error)
  },
)

// Breadcrumb interceptor — records API calls for error reporting context
http.interceptors.response.use(
  (response) => {
    const cfg = response.config as InternalAxiosRequestConfig & { _startTime?: number }
    const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
    addApiBreadcrumb(cfg.method ?? 'GET', cfg.url ?? '', response.status, duration)
    return response
  },
  (error: AxiosError) => {
    const cfg = (error.config ?? {}) as InternalAxiosRequestConfig & { _startTime?: number }
    const duration = cfg._startTime ? Date.now() - cfg._startTime : undefined
    addApiBreadcrumb(cfg.method ?? 'GET', cfg.url ?? '', error.response?.status, duration)
    return Promise.reject(error)
  },
)

/**
 * Request-config factory for Setup Wizard endpoints, which authenticate with a
 * one-time setup token instead of the normal JWT bearer token / auth cookie.
 */
export function setupRequest(setupToken: string) {
  return {
    headers: { Authorization: `SetupToken ${setupToken}` },
  }
}
