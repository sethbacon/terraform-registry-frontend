// Re-export the shared suite AuthProvider, injecting this app's backend contract.
// The provider is cookie/`/me`-driven and derives the role template from the primary
// membership — which, since #795, is a real organization membership rather than a
// fabricated one. useAuth/SESSION_WARNING_LEAD_MS are re-exported so existing
// imports keep working; useAuth additionally publishes `memberships` (see below).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ADMIN_SCOPE,
  AuthProvider as SuiteAuthProvider,
  useAuth as useSuiteAuth,
  SESSION_WARNING_LEAD_MS,
  type AuthApi,
  type AuthContextType,
  type MeResponse,
  type Membership,
  type SelectableOrganization,
} from '../suite'
import api from '../services/api'
import { setActingOrganization } from '../services/api/http'
import { ORGANIZATION_PAGE_MAX } from '../services/api/organizationsApi'
import type { AuthMembership } from '../services/api/authApi'
import { clearAuthStorage } from '../utils/authStorage'
import { queryClient } from '../queryClient'

/**
 * Maps `/auth/me`'s memberships onto the shared package's `Membership`
 * contract. Two differences have to be bridged, and both are the reason this
 * function exists rather than the array being passed through untouched:
 *
 *  1. The wire nests the role template under `role_template` (an object, or
 *     `null`); the shared contract wants it FLAT, as `role_template_name` and
 *     `role_template_scopes`. Nothing in the contract carries the role's
 *     display name, so it is dropped here — the provider synthesises
 *     `roleTemplate.display_name` from `role_template_name` regardless.
 *  2. `organization_id` and `organization_name` are required, NON-OPTIONAL
 *     strings in the contract. Until #795 that requirement was met by stamping
 *     both with a sentinel string (#622) so an org switcher would fail visibly
 *     rather than render a blank organization. There is nothing left to
 *     fabricate — the registry backend has had real per-organization
 *     memberships since backend #719 and `MeHandler` sends them — so the
 *     requirement is now met honestly, by these two rules:
 *
 *     - A membership with no usable `organization_id` is DROPPED. It could not
 *       be filtered on, granted against, or rendered, and the shared provider
 *       calls `.localeCompare` on this field while choosing the primary
 *       membership: one malformed entry would throw inside session resolution,
 *       which the provider treats as a failed `/me` and signs the user out.
 *     - An empty `organization_name` falls back to `organization_id`. The
 *       backend selects it as `COALESCE(o.name, '')`, so a membership whose
 *       organization row is missing arrives with an empty slug. Showing the id
 *       is honest and identifies the organization; showing '' reintroduces
 *       exactly the blank-organization render #622 set its tripwire for.
 *
 * Exported for unit testing.
 */
export function toSuiteMemberships(memberships: AuthMembership[]): Membership[] {
  return memberships
    .filter((m) => typeof m?.organization_id === 'string' && m.organization_id !== '')
    .map((m) => ({
      organization_id: m.organization_id,
      organization_name: m.organization_name || m.organization_id,
      role_template_name: m.role_template?.name ?? null,
      role_template_scopes: m.role_template?.scopes ?? [],
    }))
}

/**
 * The real memberships from the most recent successful `/auth/me`.
 *
 * The shared provider consumes `MeResponse.memberships` (to pick the primary
 * role template and to answer `hasScope(scope, organizationId)`) but does not
 * re-expose the array on its context, so this app publishes it alongside —
 * see the `useAuth` wrapper below.
 */
const MembershipsContext = createContext<Membership[]>([])

/**
 * Pushes the selected organization into the HTTP layer, which stamps it on
 * every request as the X-Organization-Id header (terraform-registry-backend#1011, suite
 * terraform-state-manager-backend#437). The provider owns the decision — it re-resolves the
 * selection against the memberships the server just returned — and the HTTP
 * layer only carries it. Null is pushed deliberately when there is no valid
 * selection: a multi-organization caller who has not chosen has nothing to
 * claim, and the backend refuses an unnamed write in exactly that case.
 * Clearing on unmount matters for the same reason a logout clears it — a stale
 * organization outliving its session is the one value that must not be
 * inherited by whoever signs in next.
 */
function OrganizationBridge() {
  const { currentOrganizationId } = useSuiteAuth()
  useEffect(() => {
    setActingOrganization(currentOrganizationId)
    return () => setActingOrganization(null)
  }, [currentOrganizationId])
  return null
}

/** Upper bound on the pages fetched for a platform administrator's universe. */
const PLATFORM_ADMIN_ORGANIZATION_PAGES = 20

/**
 * Supplies the organization directory a PLATFORM ADMINISTRATOR must choose from.
 *
 * The backend's tenant scope for an admin spans every organization and carries
 * none, so the shared rule refuses an unnamed create from them UNCONDITIONALLY
 * — not only when they reach several. A picker driven by memberships alone
 * therefore offered nothing to exactly the caller the server always requires
 * to choose. This fetches the estate's organizations for that caller and hands
 * them to the provider as `selectableOrganizations`, a DISPLAY universe and
 * not a grant: the server re-derives scope on every request regardless.
 *
 * The predicate is "admin scope AND no memberships": /auth/me publishes no
 * platform-admin flag, but the shared provider reports `admin` only when the
 * session actually carries it, and with no memberships the role-template union
 * is empty, so the only remaining carrier is the platform_admins table. An
 * admin WITH memberships already has a universe to pick from and is left alone.
 *
 * Failure degrades to "no extra choices": the refusal the admin then sees on a
 * create is the pre-existing one, not a new crash.
 */
function PlatformAdminOrganizations({
  onChoices,
}: {
  onChoices: (organizations: SelectableOrganization[] | undefined) => void
}) {
  const { isAuthenticated, memberships, hasScope } = useSuiteAuth()
  const isPlatformAdmin = isAuthenticated && memberships.length === 0 && hasScope(ADMIN_SCOPE)

  useEffect(() => {
    if (!isPlatformAdmin) {
      // Covers sign-out and a demotion mid-session as well as the ordinary
      // user: an acting-organization universe must not outlive the standing
      // that justified it.
      onChoices(undefined)
      return
    }
    let live = true
    const load = async () => {
      try {
        const choices: SelectableOrganization[] = []
        for (let page = 1; page <= PLATFORM_ADMIN_ORGANIZATION_PAGES; page++) {
          const result = await api.listOrganizations(page, ORGANIZATION_PAGE_MAX)
          if (!live) return
          for (const o of result.organizations) {
            choices.push({ organization_id: o.id, organization_name: o.display_name || o.name })
          }
          if (!result.hasMore) break
        }
        onChoices(choices)
      } catch {
        if (live) onChoices(undefined)
      }
    }
    void load()
    return () => {
      live = false
    }
  }, [isPlatformAdmin, onChoices])

  return null
}

/**
 * Where the selected organization is remembered across reloads. Namespaced to
 * this app rather than reusing the shared DEFAULT_ORGANIZATION_KEY: the suite
 * apps are separate origins with separate onboarding, so a user may
 * legitimately act in a different organization in each, and one shared key
 * would make picking in one silently re-point the other.
 *
 * The stored value is a HINT and never an authority — the provider matches it
 * against the memberships the server just returned and discards anything that
 * does not match.
 */
const ORGANIZATION_STORAGE_KEY = 'registry.organization'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  // Lifted to the provider's own parent because the directory is a PROP of the
  // provider while the standing that decides whether to fetch it is INSIDE:
  // PlatformAdminOrganizations reads the resolved session and hands the answer
  // back up. The provider re-resolves the selection when the extra
  // organizations land, which they do after /me has already settled.
  const [selectableOrganizations, setSelectableOrganizations] = useState<
    SelectableOrganization[] | undefined
  >(undefined)
  const handleChoices = useCallback((organizations: SelectableOrganization[] | undefined) => {
    setSelectableOrganizations(organizations)
  }, [])

  // On sign-out, also drop the react-query cache so prior-user admin/query data does not
  // linger in memory until a full page reload (a retention gap on shared/kiosk machines),
  // and drop the memberships for the same reason: they name the previous user's
  // organizations. The shared provider calls this on explicit logout AND on every
  // fail-closed transition (rejected/401 `/me`, lapsed session, malformed response),
  // i.e. at every moment this array stops being true.
  //
  // The `setMemberships([])` is retention only — what CONSUMERS see is already
  // guaranteed by the isAuthenticated gate in useAuth below, so removing this
  // line alone breaks no test. It is kept for the same reason as the
  // queryClient.clear() above it: a signed-out tab should not still be holding
  // the previous user's data.
  const handleClearStorage = useCallback(() => {
    clearAuthStorage()
    queryClient.clear()
    setMemberships([])
  }, [])

  // Memoised with no dependencies so the object identity is stable across renders.
  // (The shared provider holds `api` in a ref, so this is hygiene rather than a
  // correctness requirement — but a new object every render would still be a
  // trap for anyone who later moves it into a dependency array.)
  const authApi = useMemo<AuthApi>(
    () => ({
      getCurrentUser: async (): Promise<MeResponse> => {
        const r = await api.getCurrentUserWithRole()
        const suiteMemberships = toSuiteMemberships(r.memberships)
        setMemberships(suiteMemberships)
        return {
          user: r.user,
          allowed_scopes: r.allowed_scopes,
          session_expires_at: r.session_expires_at ?? undefined,
          session_expires_in: r.session_expires_in ?? undefined,
          memberships: suiteMemberships,
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
    }),
    [],
  )

  return (
    <MembershipsContext.Provider value={memberships}>
      <SuiteAuthProvider
        api={authApi}
        onClearStorage={handleClearStorage}
        organizationStorageKey={ORGANIZATION_STORAGE_KEY}
        selectableOrganizations={selectableOrganizations}
      >
        <OrganizationBridge />
        <PlatformAdminOrganizations onChoices={handleChoices} />
        {children}
      </SuiteAuthProvider>
    </MembershipsContext.Provider>
  )
}

/** The shared auth context, plus this app's real organization memberships. */
export type RegistryAuthContextType = AuthContextType & { memberships: Membership[] }

/**
 * The shared `useAuth`, widened with the memberships the shared context does
 * not itself expose.
 *
 * `memberships` is gated on `isAuthenticated` rather than returned raw. The
 * adapter above records them the moment `/auth/me` resolves, which is strictly
 * before the shared provider decides whether to accept that response — so a
 * `/me` that resolves after a logout (the provider discards it as a stale
 * generation) would otherwise leave a signed-out session holding a populated
 * membership list.
 */
export function useAuth(): RegistryAuthContextType {
  const suite = useSuiteAuth()
  const memberships = useContext(MembershipsContext)
  return useMemo(
    () => ({ ...suite, memberships: suite.isAuthenticated ? memberships : [] }),
    [suite, memberships],
  )
}

export { SESSION_WARNING_LEAD_MS }
