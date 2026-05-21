// Shared validation for Terraform registry identifier segments.
// Terraform CLI parses module/provider source addresses as
// <hostname>/<namespace>/<name>/<provider>, so each segment must be a valid
// URL path component. The pattern below mirrors the backend's
// internal/validation/segment.go regex so the UI and API agree.
export const REGISTRY_SEGMENT_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export const REGISTRY_SEGMENT_HELP =
  '1–64 chars; must start with a lowercase letter or digit; only lowercase letters, digits, hyphens, and underscores.'

export function isValidRegistrySegment(s: string): boolean {
  return REGISTRY_SEGMENT_RE.test(s)
}
