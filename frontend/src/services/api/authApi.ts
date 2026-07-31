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

export async function getCurrentUserWithRole(): Promise<{
  user: User
  role_template: RoleTemplateInfo | null
  allowed_scopes: string[]
  session_expires_at: string | null
}> {
  const response = await http.get('/api/v1/auth/me')
  return {
    user: response.data.user,
    role_template: response.data.role_template || null,
    allowed_scopes: response.data.allowed_scopes || [],
    session_expires_at: response.data.session_expires_at || null,
  }
}
