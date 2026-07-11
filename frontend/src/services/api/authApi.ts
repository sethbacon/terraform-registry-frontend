import { http, API_BASE_URL } from './http'
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
  window.location.href = `${API_BASE_URL}/api/v1/auth/login?provider=${provider}`
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
 * Redirects the browser to the backend /api/v1/auth/logout endpoint, which in turn
 * redirects to the OIDC provider's end_session_endpoint (if configured) so that the
 * IdP SSO session is terminated. This prevents silent re-authentication after logout.
 * The backend uses client_id (not id_token_hint) so nothing sensitive needs to be
 * stored client-side.
 */
export function logout() {
  window.location.href = `${API_BASE_URL}/api/v1/auth/logout`
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
