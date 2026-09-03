import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { ORGANIZATION_HEADER } from '../../suite'
import { addApiBreadcrumb } from '../errorReporting'
import { clearAuthStorage } from '../../utils/authStorage'
import { captureReturnUrl } from '../../utils/returnUrl'

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

// One-shot, because getCookie runs on EVERY mutating request: a per-call log
// would bury the first (and only useful) occurrence under thousands of repeats.
let hasWarnedDuplicateCookie = false

/** Reset the duplicate-cookie warning latch. Test seam only. */
export function resetDuplicateCookieWarning(): void {
  hasWarnedDuplicateCookie = false
}

/**
 * Read a cookie value by name. Returns empty string if not found.
 *
 * Both hazards handled here are #679, and both matter because the two callers
 * (the axios request interceptor below, and the Swagger one in
 * ApiDocumentation.tsx) run on the request path:
 *
 * 1. `decodeURIComponent` throws `URIError` on a stray '%' that is not a valid
 *    escape -- `tfr_csrf=ab%zz` is enough. Thrown from inside an interceptor
 *    that rejects every mutating request with an opaque URIError rather than a
 *    network error. The RAW value is returned on a decode failure rather than
 *    '': the backend reads those same undecoded bytes from the Cookie header,
 *    so echoing them back is what actually matches, whereas '' drops the
 *    X-CSRF-Token header entirely and guarantees rejection.
 *
 * 2. `document.cookie` exposes no attributes, so a host-only cookie and a
 *    Domain-scoped one set by a sibling suite app on a shared parent domain are
 *    indistinguishable from here. First match is still what is returned --
 *    there is genuinely no information available to choose better -- but the
 *    collision is logged, because otherwise the symptom is every mutation
 *    failing server-side with nothing client-side to explain why.
 *
 *    The durable fix for (2) is a `__Host-` prefixed CSRF cookie, whose prefix
 *    makes a Domain-scoped duplicate impossible to set. That requires the
 *    backend to change the cookie it issues, so it is not done here.
 */
export function getCookie(name: string): string {
  const pattern = new RegExp(
    '(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)',
    'g',
  )
  const matches = Array.from(document.cookie.matchAll(pattern))
  if (matches.length === 0) return ''

  if (matches.length > 1 && !hasWarnedDuplicateCookie) {
    hasWarnedDuplicateCookie = true
    console.error(
      `[auth] ${matches.length} cookies named "${name}" are visible to this page. ` +
        'document.cookie hides their Domain/Path, so the wrong one may be echoed while the ' +
        'server reads another -- which presents as every mutating request failing CSRF ' +
        'validation. A sibling app on a shared parent domain is the usual cause.',
    )
  }

  const raw = matches[0][1]
  try {
    return decodeURIComponent(raw)
  } catch {
    // Malformed percent-encoding. Returning raw keeps the request survivable;
    // see (1) above for why '' would be strictly worse.
    return raw
  }
}

/**
 * URL-encode a single path segment before interpolating it into a
 * template-literal request URL. Axios does not encode manually-built path
 * strings, so an unescaped identifier containing '#', '?', or '/' can
 * truncate the request at a fragment (silently dropping later path
 * segments), inject a bogus query string, or shift the path to a different
 * resource than intended (CWE-116). Domain API modules should wrap every
 * interpolated namespace/name/id/version/etc. segment with this before
 * building a URL (#614).
 */
export function encodeSegment(value: string): string {
  return encodeURIComponent(value)
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
 * deliberately excluded: a 401 there may be a real session failure.
 *
 * This is a URL-shape heuristic, and it is no longer load-bearing: an
 * external-SCM endpoint missing from this list is merely `unconfirmed` (see
 * classifySession401 below), so it costs a /auth/me round-trip instead of
 * destroying a live session's CSRF cookie (#677). Listing one here just skips
 * that round-trip. A structured backend error code would remove the heuristic
 * entirely — see audit issue #617 (backend change, out of tree).
 */
const SCM_OAUTH_SUBRESOURCES = ['/repositories', '/tags', '/branches'] as const

/**
 * Classifies a 401 on an SCM-provider request as an OAuth-token failure (true,
 * definitely keep the session) from the request URL shape.
 */
export function isSCMOAuthFailureUrl(url: string): boolean {
  return (
    url.includes('/scm-providers/') && SCM_OAUTH_SUBRESOURCES.some((suffix) => url.includes(suffix))
  )
}

/**
 * GET /api/v1/auth/me is the one endpoint whose entire job is to answer "is this
 * browser's cookie session still alive?", and it is authenticated by nothing but
 * that session. A 401 from it is therefore the authoritative session-death
 * signal, and a 2xx is proof the session is alive.
 */
const SESSION_PROBE_URL = '/api/v1/auth/me'

/**
 * Marks the confirmation request issued by confirmSessionDead() so the 401
 * handler ignores it: the probe asks the handler's own question, and letting its
 * 401 back in would both recurse and look like a fresh session-death event.
 */
type SessionProbeConfig = { _sessionProbe?: boolean }

/** Is this request itself the authoritative session check? */
function isSessionProbeUrl(url: string): boolean {
  return url.split('?')[0].endsWith(SESSION_PROBE_URL)
}

/**
 * True when the request carried its own Authorization credential. Axios
 * normalizes headers into an AxiosHeaders instance whose values are only
 * reachable through .get(), but callers (and tests) hand in plain objects too,
 * so both shapes are read.
 */
function hasExplicitAuthorization(headers: unknown): boolean {
  if (!headers || typeof headers !== 'object') return false
  const bag = headers as {
    Authorization?: unknown
    authorization?: unknown
    get?: (name: string) => unknown
  }
  const viaGetter = typeof bag.get === 'function' ? bag.get('Authorization') : undefined
  return !!(bag.Authorization ?? bag.authorization ?? viaGetter)
}

/**
 * How a 401 relates to *this browser's cookie session* (#677). Only a request
 * that the session cookie authenticated can report that session's death:
 *
 * - `other-credential` — the request authenticated with something else: an
 *   explicit Authorization header (the Setup Wizard's SetupToken, or a Bearer
 *   token) or an SCM-provider call the backend proxies with the stored OAuth
 *   token. The 401 is about *that* credential and is evidence of nothing here.
 * - `session-dead` — the request IS the session check, so its 401 is the answer.
 * - `unconfirmed` — a cookie-authenticated request that could equally have 401d
 *   for an authorization failure returned as 401 rather than 403, a handler-level
 *   "not connected to this SCM provider", or a transient auth blip. The session
 *   may well be alive, so nothing may be torn down until /auth/me says otherwise.
 *
 * Note the direction of the residual risk: an endpoint nobody anticipated lands
 * in `unconfirmed`, which costs one extra GET and never destroys a live session
 * — the opposite of a URL-shape allowlist, where the unanticipated endpoint is
 * the one that breaks.
 */
export type Session401Verdict = 'other-credential' | 'session-dead' | 'unconfirmed'

export function classifySession401(
  config: { url?: string; headers?: unknown } | undefined,
): Session401Verdict {
  const url = config?.url || ''
  if (isSCMOAuthFailureUrl(url) || hasExplicitAuthorization(config?.headers)) {
    return 'other-credential'
  }
  return isSessionProbeUrl(url) ? 'session-dead' : 'unconfirmed'
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
 * The organization the user is acting in, registered by the auth layer.
 *
 * It lives here as a module variable rather than being read from storage,
 * because AuthProvider is the only thing that knows whether a remembered
 * choice is still valid — it re-resolves the selection against the memberships
 * the server just returned and discards anything that does not match. A value
 * read straight from localStorage would be exactly the stale, hand-edited or
 * other-user's value the provider exists to reject.
 *
 * Null means "nothing to claim": a caller who reaches several organizations
 * and has not chosen yet has nothing to send, and the backend refuses an
 * unnamed write in exactly that case (terraform-registry-backend#1011). Inventing a value here —
 * the first membership, say — would be the tenancy bug, not the fix. See
 * OrganizationBridge in contexts/AuthContext.
 */
let actingOrganization: string | null = null
export function setActingOrganization(organizationId: string | null): void {
  actingOrganization = organizationId
}

/**
 * The single shared Axios instance behind every domain API module. All
 * cross-cutting behavior — CSRF double-submit echo, acting-organization
 * claim, 401 session handling, breadcrumb timing — lives in the interceptors
 * below so domain modules stay pure endpoint bindings.
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

    // Name the organization the user is acting in, on EVERY request — not only
    // mutations. The backend verifies it against a scope it resolved itself and
    // refuses anything the caller may not reach, so this is a claim, never an
    // authorization boundary. Uniform stamping is one fewer thing to get right,
    // and it lets /auth/me answer with the scopes for the SELECTED organization
    // rather than a union. The header name is the shared constant: two ends
    // spelling it differently is the drift the suite package exists to close.
    if (actingOrganization) {
      config.headers[ORGANIZATION_HEADER] = actingOrganization
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
// doesn't mirror; without this guard the cookie would read as a live session
// forever and reintroduce the /login <-> 401 redirect loop the cookie expiry is
// meant to prevent. This module-scope flag only covers concurrent/same-tick 401s within a
// single page instance — a real redirect is a full-page navigation that reloads
// the module and resets it. The attribute-independent, navigation-surviving half
// of the guard is the "already on /login" check at the redirect site below:
// after the reload lands on /login, we refuse to redirect to /login again, so a
// Domain-scoped cookie whose deletion no-ops still cannot loop.
let hasRedirectedToLogin = false

// The redirect target. Refusing to navigate here when we are already on this path
// is what makes the loop guard survive a real page reload (see #621 above).
const LOGIN_PATH = '/login'

/**
 * Consume the session: drop the client-side remnants and send the user to
 * /login. Only called once the session is known to be dead, because the CSRF
 * cookie expiry below is destructive in a way JS cannot undo — the HttpOnly auth
 * cookie is not clearable from here, so a session that outlives its tfr_csrf
 * half keeps authenticating while every mutation fails the double-submit check
 * (#677).
 */
function endSession(): void {
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
  // deletion above no-ops and the cookie session signal stays true forever: (1)
  // the module-scope flag stops concurrent 401s in this page instance; (2) the
  // "already on /login" check survives a real page reload (which resets that
  // flag) — redirecting to /login while already on /login is the loop itself.
  const alreadyOnLoginPage = window.location.pathname === LOGIN_PATH
  if (!hasRedirectedToLogin && !alreadyOnLoginPage) {
    hasRedirectedToLogin = true
    // Capture INSIDE the redirect branch, not on every 401 (#695). A 401
    // that does not navigate is an SCM-OAuth failure, an anonymous probe,
    // or a suppressed loop-guard case -- recording a destination for any of
    // those would leave a stale entry that hijacks the next real login.
    captureReturnUrl()
    window.location.href = LOGIN_PATH
  }
}

// One confirmation at a time: a page that fans out six requests answers six
// 401s in the same tick, and six identical /auth/me probes would answer one
// question. Cleared when the probe settles rather than cached — a session can
// die at any moment, so the next 401 deserves a fresh answer.
let sessionProbeInFlight = false

/**
 * Ask /auth/me whether the session is actually dead, and only then tear it down.
 * A probe that cannot answer (5xx, network failure, rate limit) deliberately
 * leaves everything in place: a live session keeping a usable CSRF pair is
 * recoverable, a live session that lost it is a silent write outage.
 */
function confirmSessionDead(): void {
  if (sessionProbeInFlight) return
  sessionProbeInFlight = true
  http
    // Path spelled out rather than passed as SESSION_PROBE_URL because
    // scripts/contract-check.ts only resolves literal path arguments — inlining
    // keeps this call under the frontend/backend route contract check.
    .get('/api/v1/auth/me', { _sessionProbe: true } as AxiosRequestConfig & SessionProbeConfig)
    .then(
      () => {
        // 2xx: the session is alive, so that 401 meant something else entirely.
      },
      (probeError: AxiosError) => {
        if (probeError?.response?.status === 401) endSession()
      },
    )
    .finally(() => {
      sessionProbeInFlight = false
    })
}

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

    const config = error.config as (InternalAxiosRequestConfig & SessionProbeConfig) | undefined
    // The confirmation probe's own 401 is handled by confirmSessionDead(), which
    // asked the question; re-entering here would recurse.
    if (error.response?.status === 401 && !config?._sessionProbe) {
      // Not every 401 means the session died: an SCM-provider call proxied with
      // the stored OAuth token 401s when THAT token expired (the calling
      // component, e.g. RepositoryBrowser, shows a reconnect prompt), and a
      // request carrying its own Authorization credential 401s about that
      // credential. Neither is evidence about the cookie session (#677).
      const verdict = classifySession401(config)
      if (verdict !== 'other-credential') {
        // The "tfr_csrf" cookie is set only when the backend issues or refreshes
        // the auth cookie (see middleware/csrf.go) and cleared on logout, so its
        // presence is a reliable session signal even though the HttpOnly auth
        // cookie itself isn't readable from JS. Without it there is no session to
        // end and no reason to probe: fresh anonymous visitors receive 401 on
        // endpoints like /auth/me, which must leave public pages accessible. The
        // pre-cookie-migration localStorage keys are still swept.
        if (!getCookie('tfr_csrf')) {
          clearAuthStorage()
        } else if (verdict === 'session-dead') {
          endSession()
        } else {
          confirmSessionDead()
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
