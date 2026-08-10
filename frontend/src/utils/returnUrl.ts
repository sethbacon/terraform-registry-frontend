/**
 * Capture where the user was, so login can return them there (#695).
 *
 * `CallbackPage` has always read `sessionStorage.returnUrl` and validated it
 * against an open-redirect (resolving it and requiring a same-origin result).
 * Nothing ever wrote the key, so the guard protected a feature that did not
 * work: every OIDC login landed on '/'. This is the missing write half.
 *
 * sessionStorage is the right store even though the flow leaves the origin
 * entirely: it is scoped to the tab and survives a cross-origin round trip to
 * the identity provider and back, which is precisely the journey being spanned.
 * Router state would not survive it.
 */

/** The key CallbackPage reads. Kept here so the two halves cannot drift apart. */
export const RETURN_URL_KEY = 'returnUrl'

/**
 * Record the current location as the post-login destination.
 *
 * Never throws. One caller is the axios 401 interceptor, and an exception on
 * the request/response path there would abort the very redirect this exists to
 * improve -- the same failure shape as #679. sessionStorage is unavailable or
 * throws outright in Safari private mode and under some storage-partitioning
 * settings, so the write is best-effort by design: losing the return path
 * degrades to landing on '/', which is exactly today's behaviour.
 */
export function captureReturnUrl(): void {
  try {
    const { pathname, search, hash } = window.location

    // Capturing an auth route would defeat the feature or loop it: '/login'
    // sends the user back to the login form after logging in, and '/auth/callback'
    // re-enters the callback that is mid-consumption of this very key.
    if (pathname === '/login' || pathname.startsWith('/auth/')) return

    // '/' is already the fallback CallbackPage uses when the key is absent, so
    // writing it buys nothing and only creates a stale entry to step over.
    const target = pathname + search + hash
    if (target === '/') return

    window.sessionStorage.setItem(RETURN_URL_KEY, target)
  } catch {
    // Storage unavailable or full. The user lands on '/' -- no worse than before.
  }
}
