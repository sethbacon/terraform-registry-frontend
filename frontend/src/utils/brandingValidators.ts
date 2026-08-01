/**
 * Client-side mirror of the backend's whitelabel colour gate
 * (internal/api/uitheme/uitheme.go: `reHexColor`), so an admin gets field-level
 * feedback instead of a submit error. Deliberately narrower than MUI can parse:
 * the backend rejects rgb()/hsl() notation, so accepting it here would only
 * produce a 400 on save.
 */
export function isValidBrandingColor(value: string): boolean {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value)
}
