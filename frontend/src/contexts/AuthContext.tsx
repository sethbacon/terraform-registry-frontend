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
  // Registry dev/LDAP logins return a JWT in the body (no cookie is set). Persist it so
  // the api client attaches it as a Bearer header on the subsequent /me call; logout
  // clears it via clearAuthStorage (onClearStorage).
  devLogin: async () => {
    const r = await api.devLogin()
    if (r?.token) localStorage.setItem('auth_token', r.token)
    return r
  },
  ldapLogin: async (username, password) => {
    const r = await api.ldapLogin(username, password)
    if (r?.token) localStorage.setItem('auth_token', r.token)
    return r
  },
  logout: () => api.logout(),
  refreshToken: async () => {
    const r = await api.refreshToken()
    return { expires_in: r?.expires_in ?? 0 }
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SuiteAuthProvider api={authApi} onClearStorage={clearAuthStorage}>
      {children}
    </SuiteAuthProvider>
  )
}

export { useAuth, SESSION_WARNING_LEAD_MS }
