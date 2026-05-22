/** All localStorage keys belonging to an auth session. */
export const AUTH_STORAGE_KEYS = [
  'auth_token',
  'user',
  'role_template',
  'allowed_scopes',
  'authorized', // Swagger UI "Authorize" dialog persists this when persistAuthorization is enabled
] as const

/** Remove every auth-related localStorage key. Call on logout and on 401 session expiry. */
export function clearAuthStorage(): void {
  AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k))
}
