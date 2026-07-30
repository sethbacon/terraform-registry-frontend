/**
 * App-boundary validator for URLs sourced from the backend / whitelabel config (the
 * suite-switcher sibling URL and the whitelabel theme logo/hero/favicon URLs) before they are
 * handed to shared `@sethbacon/terraform-suite-ui` components.
 *
 * Defense-in-depth: the app currently trusts the backend config verbatim. This validator parses
 * with the URL constructor and rejects embedded control characters, so a value the browser would
 * silently normalize into a protocol-relative off-origin URL (e.g. "/\t/evil.com" -> "//evil.com")
 * is never passed through to a navigation/resource sink. Allows same-origin-relative paths/hashes
 * and absolute http(s) URLs only.
 */
/**
 * Origins this app will follow to, beyond its own. Read from
 * `VITE_ALLOWED_EXTERNAL_ORIGINS` (comma-separated, e.g.
 * "https://tsm.example.com,https://cdn.example.com").
 *
 * Deliberately build/deploy-time configuration rather than anything the backend
 * serves: the threat this guards against is a *compromised or misconfigured
 * backend* handing us an attacker-controlled URL (issue #559). An allowlist the
 * backend could influence would defend against nothing.
 *
 * Values are normalised to `URL.origin`, so scheme/host/port must all match; a
 * trailing path in the configured value is ignored.
 */
export function allowedExternalOrigins(): string[] {
  const raw = import.meta.env.VITE_ALLOWED_EXTERNAL_ORIGINS
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry).origin
      } catch {
        // A malformed entry is dropped rather than silently widening the
        // allowlist — an unparseable value must never behave like "allow all".
        return ''
      }
    })
    .filter(Boolean)
}

export function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return false

  // Reject embedded ASCII control characters (C0 range + DEL). The WHATWG URL parser strips
  // tab/newline/CR (U+0009/U+000A/U+000D) before parsing, which can turn a "relative-looking"
  // value into a protocol-relative off-origin URL at the sink.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false

  // Protocol-relative ("//evil.com") and backslash variants.
  if (/^[/\\]{2}/.test(trimmed) || /^\/\\/.test(trimmed)) return false

  // Same-origin-relative path or same-page anchor — never carries a scheme, safe.
  if (/^[/#.]/.test(trimmed)) return true

  // Absolute URL: allow only http(s).
  //
  // `http:` is accepted alongside `https:` as a documented, deliberate
  // acceptance (issue #559) rather than an oversight. Requiring https here would
  // break three real cases, two of them silently: a locally-running suite
  // sibling (the backend's dev default is `base_url: http://localhost:8080`, so
  // the switcher and the Consumed-by link would just vanish), whitelabel assets
  // served over http (they degrade to defaults with no indication), and OAuth
  // against a self-hosted SCM on an internal network — Bitbucket Data Center,
  // self-hosted GitLab and Azure DevOps Server are supported deployment targets
  // and are not always fronted by TLS internally. The origin allowlist below is
  // the control that actually constrains *where* we will navigate; the scheme
  // check only screens out dangerous URI schemes. See SECURITY.md.
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

    // When an allowlist is configured, an absolute URL must match this app's
    // own origin or one of the listed origins. Unconfigured, this check is
    // inert and behaviour is unchanged — see SECURITY.md for why that is the
    // default and what residual risk it leaves.
    const allowed = allowedExternalOrigins()
    if (allowed.length === 0) return true

    const selfOrigin = typeof window !== 'undefined' ? window.location?.origin : undefined
    return url.origin === selfOrigin || allowed.includes(url.origin)
  } catch {
    return false
  }
}
