// Single source of truth for which scope (if any) each /admin/* route
// requires. App.tsx (route guards, via LazyRoute) and navigation.tsx
// (sidebar item filtering) both read from this map instead of each
// maintaining their own literal scope per path, so the two can't drift
// out of sync.
//
// A value of `null` means the route requires an authenticated user but no
// specific scope (matches NavItem['scope']'s "always visible to
// authenticated users" convention).
export const ADMIN_ROUTE_SCOPES: Record<string, string | null> = {
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
}
