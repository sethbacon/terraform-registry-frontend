/** Query-string keys that can carry a live session token or OIDC credential. */
const SENSITIVE_QUERY_KEYS = ['token', 'code', 'state', 'id_token']

/**
 * Strips sensitive query-string values from a URL before it's recorded in telemetry.
 * The OIDC callback flow transiently places the session token in the URL (`?token=`),
 * so recording `window.location.href` verbatim can ship a live session token to an
 * external error/performance-reporting DSN. Falls back to the original string if the
 * URL can't be parsed.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of SENSITIVE_QUERY_KEYS) {
      parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    return url
  }
}
