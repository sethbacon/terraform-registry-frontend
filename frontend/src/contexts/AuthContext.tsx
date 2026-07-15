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
      memberships: r.role_template
        ? [
          {
            organization_id: '',
            organization_name: '',
            role_template_name: r.role_template.name,
            role_template_scopes: r.role_template.scopes,
          },
        ]
        : [],
    }
  },
  login: (provider) => api.login(provider),
  // Registry dev/LDAP logins set the HttpOnly auth cookie (plus tfr_csrf) via
  // Set-Cookie on the response — no token in the body, nothing to persist. The
  // suite AuthProvider resolves the session via the subsequent /auth/me probe.
  devLogin: () => api.devLogin(),
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
