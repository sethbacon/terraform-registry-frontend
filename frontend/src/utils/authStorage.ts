/**
 * All localStorage keys belonging to an auth session. Nothing in the app
 * WRITES any of these anymore — auth is cookie-only (HttpOnly cookie +
 * tfr_csrf double-submit). They are kept here purely so clearAuthStorage()
 * removes stale values left behind by pre-cookie-migration sessions.
 */
export const AUTH_STORAGE_KEYS = [
  'auth_token', // legacy JWT persisted by old sessions; one-time cleanup only
  'user',
  'role_template',
  'allowed_scopes',
  'authorized', // legacy: Swagger UI "Authorize" persisted this under persistAuthorization
] as const

/** Remove every auth-related localStorage key. Call on logout and on 401 session expiry. */
export function clearAuthStorage(): void {
  AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k))
}
