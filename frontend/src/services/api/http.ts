import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { addApiBreadcrumb } from '../errorReporting'
import { clearAuthStorage } from '../../utils/authStorage'

// In dev mode, use empty baseURL to use relative paths (goes through Vite proxy)
// In production, use the configured URL or default to current origin
export const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

// Only use mock responses when explicitly enabled (e.g., when backend is not running)
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

// Default request timeout. A hung backend would otherwise leave requests pending
// indefinitely with no feedback to the user. File uploads (uploadModule,
// uploadProvider) explicitly opt out with timeout: 0 -- large archives on a slow
// connection can legitimately take longer than this.
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/** Read a cookie value by name. Returns empty string if not found. */
function getCookie(name: string): string {
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
 * The single shared Axios instance behind every domain API module. All
 * cross-cutting behavior — auth header fallback, CSRF double-submit echo,
 * 401 session handling, breadcrumb timing — lives in the interceptors below
 * so domain modules stay pure endpoint bindings.
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
    // For backward compatibility: if an auth token is in localStorage (migration
    // period), include it as a Bearer header. Once all sessions have migrated to
    // HttpOnly cookies this block can be removed.
    // Skip when the caller already set an explicit Authorization header (e.g. the
    // Setup Wizard's "SetupToken <token>" bootstrap calls) -- a stray legacy JWT in
    // localStorage must never silently override a caller's own auth scheme.
    // AxiosHeaders preserves the caller's key casing for property access, so use
    // the case-insensitive .has() when available (a lowercase "authorization"
    // would otherwise slip past a plain property check).
    const legacyToken = localStorage.getItem('auth_token')
    const hasExplicitAuth =
      typeof config.headers.has === 'function'
        ? config.headers.has('Authorization')
        : !!config.headers.Authorization
    if (legacyToken && !hasExplicitAuth) {
      config.headers.Authorization = `Bearer ${legacyToken}`
    }

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

// Response interceptor for error handling
http.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    // Only return mock data when explicitly enabled (for offline development)
    if (USE_MOCK_DATA) {
      return getMockResponse(error.config?.url || '')
    }

    if (error.response?.status === 401) {
      // SCM provider endpoints return 401 when the SCM OAuth token has expired or
      // been revoked — this is not a user session failure. Let the error propagate
      // so the calling component (e.g. RepositoryBrowser) can show the reconnect
      // prompt rather than wiping the user's session and redirecting to /login.
      const url = error.config?.url || ''
      const isSCMOAuthFailure =
        url.includes('/scm-providers/') &&
        (url.includes('/repositories') || url.includes('/tags') || url.includes('/branches'))

      if (!isSCMOAuthFailure) {
        // Only redirect when the user previously had an active session
        // (legacy token/cached user, or the cookie-only session model). Fresh
        // anonymous visitors receive 401 on probing endpoints like /auth/me —
        // this is expected and should NOT trigger a redirect so public pages
        // remain accessible. The "tfr_csrf" cookie is set only when the backend
        // issues or refreshes the auth cookie (see middleware/csrf.go) and cleared
        // on logout, so its presence is a reliable cookie-session signal even
        // though the HttpOnly auth cookie itself isn't readable from JS.
        const hadSession =
          !!localStorage.getItem('auth_token') ||
          !!localStorage.getItem('user') ||
          !!getCookie('tfr_csrf')
        clearAuthStorage()
        // Expire the CSRF cookie so the session signal is ONE-SHOT, exactly like
        // the localStorage keys clearAuthStorage() just removed. Without this, a
        // session invalidated server-side (revocation, secret rotation, clock
        // skew) redirects in a loop: /login mounts AuthProvider, which probes
        // /auth/me, 401s, and re-triggers this handler with the cookie still set.
        // Safe to clear from JS -- the cookie is non-HttpOnly by design and a dead
        // session's CSRF token has no value.
        document.cookie = 'tfr_csrf=; Max-Age=0; path=/'
        if (hadSession) {
          window.location.href = '/login'
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
