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
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
