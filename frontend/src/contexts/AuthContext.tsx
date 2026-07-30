// Re-export the shared suite AuthProvider, injecting this app's backend contract.
// The provider is cookie/`/me`-driven and derives the role template from the primary
// membership. The registry /me payload exposes a single role_template, so the adapter
// surfaces it as one synthetic membership. useAuth/SESSION_WARNING_LEAD_MS are
// re-exported so existing imports keep working.
import type { ReactNode } from 'react'
import {
  AuthProvider as SuiteAuthProvider,
  useAuth,
  SESSION_WARNING_LEAD_MS,
  type AuthApi,
  type MeResponse,
} from '@sethbacon/terraform-suite-ui'
import api from '../services/api'
import { clearAuthStorage } from '../utils/authStorage'
import { queryClient } from '../queryClient'
import type { RoleTemplateInfo } from '../types'

// Membership.organization_id/organization_name are required, non-optional
// strings in the shared package's contract, so the synthetic membership below
// can't simply omit them. This obviously-fake sentinel (rather than '') is
// used for both fields so that if a future suite-ui feature (an org switcher,
// breadcrumbs, etc.) ever renders them, it fails visibly instead of silently
// showing a blank organization (#622).
const NO_ORGANIZATION_SENTINEL = '(no organization — registry has a single role_template)'

/**
 * Builds the synthetic single-membership array the shared package's
 * MeResponse contract expects, from this app's single role_template (the
 * registry backend has no real multi-org membership concept). Exported for
 * unit testing.
 */
export function toSyntheticMemberships(
  roleTemplate: RoleTemplateInfo | null,
): MeResponse['memberships'] {
  return roleTemplate
    ? [
      {
        organization_id: NO_ORGANIZATION_SENTINEL,
        organization_name: NO_ORGANIZATION_SENTINEL,
        role_template_name: roleTemplate.name,
        role_template_scopes: roleTemplate.scopes,
      },
    ]
    : []
}

// On sign-out, also drop the react-query cache so prior-user admin/query data does not
// linger in memory until a full page reload (a retention gap on shared/kiosk machines).
function handleClearStorage(): void {
  clearAuthStorage()
  queryClient.clear()
}

const authApi: AuthApi = {
  getCurrentUser: async (): Promise<MeResponse> => {
    const r = await api.getCurrentUserWithRole()
    return {
      user: r.user,
      allowed_scopes: r.allowed_scopes,
      session_expires_at: r.session_expires_at ?? undefined,
      memberships: toSyntheticMemberships(r.role_template),
    }
  },
  login: (provider) => api.login(provider),
  // Registry dev/LDAP logins set the HttpOnly auth cookie (plus tfr_csrf) via
  // Set-Cookie on the response — no token in the body, nothing to persist. The
  // suite AuthProvider resolves the session via the subsequent /auth/me probe.
  //
  // devLogin is dynamically imported (rather than going through the eager `api`
  // barrel, which deliberately excludes devApi) so this dev-only endpoint stays
  // out of the production bundle even though AuthContext itself is always
  // eagerly loaded (#608). LoginPage only calls this from its own
  // import.meta.env-gated "Dev Login" button.
  devLogin: () => import('../services/api/devApi').then((devApi) => devApi.devLogin()),
  ldapLogin: (username, password) => api.ldapLogin(username, password),
  logout: () => api.logout(),
  refreshToken: async () => {
    const r = await api.refreshToken()
    return { expires_in: r?.expires_in ?? 0 }
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SuiteAuthProvider api={authApi} onClearStorage={handleClearStorage}>
      {children}
    </SuiteAuthProvider>
  )
}

export { useAuth, SESSION_WARNING_LEAD_MS }
