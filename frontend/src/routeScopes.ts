import type { ScopeValue } from './types/rbac'

// Single source of truth for which scope (if any) each /admin/* route
// requires. App.tsx (route guards, via LazyRoute) and navigation.tsx
// (sidebar item filtering) both read from this map instead of each
// maintaining their own literal scope per path, so the two can't drift
// out of sync.
//
// A value of `null` means the route requires an authenticated user but no
// specific scope (matches NavItem['scope']'s "always visible to
// authenticated users" convention). Values are typed as the canonical
// ScopeValue union (#633) so a typo'd/retired scope is a compile error
// instead of silently drifting from types/rbac.ts's AVAILABLE_SCOPES.
//
// The object is `as const satisfies ...` rather than annotated
// `Record<string, ScopeValue | null>`. That annotation gave the map an INDEX
// SIGNATURE, so `ADMIN_ROUTE_SCOPES['/admin/typo']` type-checked and evaluated
// to `undefined` at runtime -- and `undefined` was LazyRoute's sentinel for
// "public route, no auth gate at all". A renamed admin path or an entry dropped
// in a refactor therefore downgraded an admin page from scope-gated to fully
// anonymous, with no compile error and nothing failing (#686). Keying on the
// literal union makes that a compile error at every call site instead.
export const ADMIN_ROUTE_SCOPES = {
  '/admin': null,
  '/admin/users': 'users:read',
  '/admin/organizations': 'organizations:read',
  '/admin/roles': 'users:read',
  '/admin/apikeys': null,
  '/admin/upload/module': 'modules:write',
  '/admin/upload/provider': 'providers:write',
  '/admin/scm-providers': 'scm:read',
  '/admin/mirrors': 'mirrors:read',
  '/admin/terraform-mirror': 'mirrors:read',
  '/admin/storage': 'admin',
  '/admin/approvals': 'mirrors:read',
  '/admin/version-approvals': 'mirrors:read',
  '/admin/policies': 'admin',
  '/admin/oidc': 'admin',
  '/admin/scim': 'admin',
  '/admin/mtls': 'admin',
  '/admin/audit-logs': 'audit:read',
  '/admin/security-scanning': 'admin',
  '/admin/notifications': 'admin',
  '/admin/branding': 'admin',
} as const satisfies Record<string, ScopeValue | null>

/** Every path ADMIN_ROUTE_SCOPES knows about. Indexing with anything else is a
 * compile error, which is the point. */
export type AdminRoutePath = keyof typeof ADMIN_ROUTE_SCOPES

/**
 * Scope lookup for consumers that hold a plain `string` and cannot narrow it --
 * today, the sidebar, whose NavItem paths come from the out-of-tree
 * @4cloudguru/cloud-suite-ui package.
 *
 * It defaults to `null` (authenticated users only), NOT to "public". That
 * asymmetry is deliberate: an unrecognised path should hide a nav item behind
 * auth, never expose a route. The route side does not use this function at all
 * -- it indexes the map directly, so a missing key stops the build.
 */
export function adminRouteScopeForPath(path: string): ScopeValue | null {
  return (ADMIN_ROUTE_SCOPES as Record<string, ScopeValue | null>)[path] ?? null
}
