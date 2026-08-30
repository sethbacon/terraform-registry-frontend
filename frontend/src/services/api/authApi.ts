import { http, API_BASE_URL, encodeSegment } from './http'
import type { User, RoleTemplateInfo } from '../../types'

// Authentication

/**
 * Fetch the list of available authentication providers from the backend.
 * Returns providers with type, name, and optional id (for SAML IdPs).
 */
export async function getAuthProviders(): Promise<{
  providers: Array<{ type: string; name: string; id?: string }>
}> {
  const response = await http.get('/api/v1/auth/providers')
  return response.data
}

export async function login(provider: string) {
  window.location.href = `${API_BASE_URL}/api/v1/auth/login?provider=${encodeSegment(provider)}`
}

/**
 * Authenticate via LDAP with username and password.
 * On success the backend sets the HttpOnly auth cookie (plus tfr_csrf); the
 * response body carries no token.
 */
export async function ldapLogin(username: string, password: string): Promise<void> {
  await http.post('/api/v1/auth/ldap/login', { username, password })
}

/**
 * Ends the session via a CSRF-protected POST, then navigates to wherever the
 * backend says the browser should land — the OIDC provider's
 * end_session_endpoint when one is configured, so the IdP SSO session is
 * terminated and cannot silently re-authenticate the user. The backend uses
 * client_id (not id_token_hint) so nothing sensitive is stored client-side.
 *
 * This is a POST and not a full-page GET navigation on purpose: a GET logout is
 * triggerable by a cross-site link (the auth cookie rides a top-level
 * navigation), which makes forced logout a CSRF. The POST goes through the
 * double-submit check that http's request interceptor satisfies.
 *
 * The backend answers 200 with the destination rather than a 302 because an XHR
 * cannot usefully follow a cross-origin redirect to the IdP — so the navigation
 * happens here instead.
 */
export async function logout(): Promise<void> {
  let destination = '/'
  try {
    const response = await http.post<{ redirect_url?: string }>('/api/v1/auth/logout')
    if (response.data?.redirect_url) destination = response.data.redirect_url
  } catch {
    // Session already gone (this backend answers 403 for a cookie-less
    // mutation), a stale CSRF cookie, or a network blip. Local session state is
    // cleared regardless, so leave the app anyway.
  }
  window.location.href = destination
}

export async function refreshToken(): Promise<{ expires_in: number }> {
  const response = await http.post<{ expires_in: number }>('/api/v1/auth/refresh')
  return response.data
}

export async function getCurrentUser(): Promise<User> {
  const response = await http.get<{ user: User }>('/api/v1/auth/me')
  return response.data.user
}

/**
 * One organization membership exactly as `GET /api/v1/auth/me` emits it.
 *
 * This is typed against the HANDLER (`MeHandler`, backend
 * `internal/api/admin/auth.go`), which builds the payload with `gin.H` and
 * nests the role template under a single `role_template` key that is
 * explicitly `null` when the membership carries no role.
 *
 * It is deliberately NOT typed against the backend's `admin.MeResponse` /
 * `admin.MeMembershipEntry` structs, which declare FLAT `role_template_id` /
 * `role_template_name` / `role_template_display_name` / `role_template_scopes`
 * fields. Those structs are referenced by nothing but the handler's swagger
 * annotation — no code path ever marshals them — so `backend/docs/swagger.yaml`
 * documents a membership shape that no client has ever received. Trusting it
 * here would silently produce `undefined` for every role field.
 *
 * `organization_name` is the organization's URL-safe SLUG (`o.name`). The human
 * display name (`o.display_name`) is not sent by this endpoint at all; adding
 * it is a backend change, not something to synthesise here.
 */
export interface AuthMembership {
  organization_id: string
  organization_name: string
  created_at: string
  role_template: RoleTemplateInfo | null
}

export async function getCurrentUserWithRole(): Promise<{
  user: User
  /**
   * The endpoint's deprecated back-compat convenience field: the role template
   * of `Memberships[0]`, carrying only `name`/`display_name` and no scopes.
   * Surfaced here because the endpoint sends it, but nothing consumes it —
   * `AuthContext` derives the display role from `memberships` below, which is
   * the same information per-organization and with scopes attached.
   */
  role_template: RoleTemplateInfo | null
  memberships: AuthMembership[]
  allowed_scopes: string[]
  session_expires_at: string | null
  /**
   * Remaining session lifetime in seconds, measured by the backend as it built the response.
   * Preferred by the shared auth provider over `session_expires_at`, because the absolute instant
   * must be compared against this browser's clock and is wrong by exactly the skew between the
   * two; a duration the backend measures and the browser applies shares no clock at all
   * (4cloudguru/cloud-suite-ui#181). Null when the backend does not send it.
   */
  session_expires_in: number | null
}> {
  const response = await http.get('/api/v1/auth/me')
  return {
    user: response.data.user,
    role_template: response.data.role_template || null,
    // Array.isArray rather than `|| []`: this array now feeds the shared auth
    // provider, which sorts it on `organization_id`. A non-array (or absent)
    // `memberships` must degrade to "no memberships", not to a value the
    // provider will try to iterate.
    memberships: Array.isArray(response.data.memberships) ? response.data.memberships : [],
    allowed_scopes: response.data.allowed_scopes || [],
    session_expires_at: response.data.session_expires_at || null,
    // typeof rather than `|| null` like its neighbours: this one is a NUMBER, and `0 || null` is
    // null. Zero means "no life left", which the provider fails closed on — collapsing it to null
    // would silently downgrade that to "no duration sent" and fall back to the instant. The
    // backend omits non-positive values today, so this is defence against a change there, not a
    // live path. Number.isFinite also rejects a NaN a malformed body could carry.
    session_expires_in: Number.isFinite(response.data.session_expires_in)
      ? Number(response.data.session_expires_in)
      : null,
  }
}
