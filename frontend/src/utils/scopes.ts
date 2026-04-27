/**
 * Shared scope display utilities used across admin pages.
 */

import { AVAILABLE_SCOPES } from '../types/rbac'

/**
 * Look up a scope's metadata (label, description) from {@link AVAILABLE_SCOPES}.
 *
 * Returns a sensible fallback object when the scope is not found.
 */
export function getScopeInfo(scopeValue: string) {
  return (
    AVAILABLE_SCOPES.find((s) => s.value === scopeValue) || {
      value: scopeValue,
      label: scopeValue,
      description: 'Unknown scope',
    }
  )
}

/**
 * Return a MUI color token for a scope chip based on the scope's category.
 */
export function getScopeColor(
  scope: string,
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' {
  if (scope === 'admin') return 'error'
  if (scope.includes(':write') || scope.includes(':manage')) return 'warning'
  if (scope.includes(':read')) return 'success'
  return 'default'
}
