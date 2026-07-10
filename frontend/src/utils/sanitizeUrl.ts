/** Query-string keys that can carry a live session token or OIDC credential. */
const SENSITIVE_QUERY_KEYS = ['token', 'code', 'state', 'id_token']

function stripSensitiveParams(parsed: URL): void {
  for (const key of SENSITIVE_QUERY_KEYS) {
    parsed.searchParams.delete(key)
  }
}

/**
 * Strips sensitive query-string values from a URL before it's recorded in telemetry.
 * The OIDC callback flow transiently places the session token in the URL (`?token=`),
 * so recording `window.location.href` verbatim can ship a live session token to an
 * external error/performance-reporting DSN.
 *
 * Handles absolute URLs (window.location.href, Sentry's event.request.url) and
 * root-relative paths (Sentry navigation breadcrumbs record `data.from`/`data.to` as
 * relative paths like "/auth/callback?token=..."), which `new URL()` alone rejects.
 * Falls back to the original string if the URL can't be parsed.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    stripSensitiveParams(parsed)
    return parsed.toString()
  } catch {
    if (url.startsWith('/')) {
      // Root-relative path: parse against a placeholder base and return it relative
      // again so the caller's formatting is preserved.
      try {
        const parsed = new URL(url, 'http://placeholder.invalid')
        stripSensitiveParams(parsed)
        return parsed.pathname + parsed.search + parsed.hash
      } catch {
        return url
      }
    }
    return url
  }
}
