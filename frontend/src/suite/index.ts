/**
 * The app's declared contract surface for `@4cloudguru/cloud-suite-ui`: every
 * symbol this frontend takes from the shared suite package, named once, in one
 * file (#603).
 *
 * # Why this module exists
 *
 * The package is out-of-tree, versioned independently and pinned exactly, and
 * it carries load-bearing security code (the cookie/`/me` auth provider, the
 * URL validator, the acting-organization header name). Before this file the
 * app imported it from fourteen separate modules, so an upstream rename had
 * fourteen landing sites, there was nowhere to read off what the app actually
 * depends on, and a test that wanted a lightweight double had to mock the
 * package by name in every file that used it.
 *
 * `suitePackageDocumented.test.ts` keeps ARCHITECTURE.md's tables in step with
 * the importers; `__tests__/suiteFacade.test.ts` keeps this file honest — it
 * fails if the facade stops re-exporting something the app still imports, and
 * if any non-test module reaches past it to the package directly.
 *
 * # Two rules this file follows
 *
 *  1. NAMES ARE NOT TRANSLATED. Every re-export keeps the package's own name.
 *     Renaming here would look like encapsulation and behave like camouflage:
 *     an upstream rename would then be absorbed silently, and nobody reading a
 *     call site could find the upstream symbol it maps to. Adapting is the job
 *     of `contexts/AuthContext.tsx` and friends, which wrap with real local
 *     policy and say so; this file only declares.
 *  2. THE LIST IS EXPLICIT, never `export *`. The point is that the surface can
 *     be read, so it has to be written down. A `export *` facade would grow
 *     silently and document nothing.
 *
 * # What this file is NOT
 *
 * It is not a seam that lets the app run without the package: everything here
 * is a live re-export, and a breaking upstream change still breaks the build.
 * What it changes is where the break has to be repaired.
 */

// ── Identity and session ───────────────────────────────────────────────────
// Wrapped by `contexts/AuthContext.tsx`, which injects this app's `/auth/me`
// contract and publishes `memberships` alongside the shared context. Treated as
// security code: see SECURITY.md's "Shared package" section.
export {
  ADMIN_SCOPE,
  AuthProvider,
  useAuth,
  SESSION_WARNING_LEAD_MS,
} from '@4cloudguru/cloud-suite-ui'
export type {
  AuthApi,
  AuthContextType,
  MeResponse,
  Membership,
  SelectableOrganization,
} from '@4cloudguru/cloud-suite-ui'

// ── GDPR consent ───────────────────────────────────────────────────────────
// Wrapped by `contexts/ConsentContext.tsx`, which supplies this app's storage
// key; `components/ConsentBanner.tsx` is the banner's local module path.
export { ConsentProvider, useConsent, ConsentBanner } from '@4cloudguru/cloud-suite-ui'
export type { ConsentPreferences } from '@4cloudguru/cloud-suite-ui'

// ── Theme and whitelabel ───────────────────────────────────────────────────
// Wrapped by `contexts/ThemeContext.tsx`, which validates backend-sourced
// whitelabel URLs at the app boundary before handing them over.
export { SuiteThemeProvider, useThemeMode } from '@4cloudguru/cloud-suite-ui'
export type { UIThemeConfig } from '@4cloudguru/cloud-suite-ui'

// ── App shell and navigation ───────────────────────────────────────────────
// `SuiteLayout` is the whole chrome (AppBar, drawer, account menu,
// session-expiry banner); `components/Layout.tsx` supplies this app's nav
// config and panels. `NavItem`/`NavGroup` are the types `navigation.tsx`
// builds that config against.
export { OrganizationPicker, SuiteLayout, SuiteSwitcher } from '@4cloudguru/cloud-suite-ui'
export type { NavItem, NavGroup } from '@4cloudguru/cloud-suite-ui'

// ── Page primitives ────────────────────────────────────────────────────────
// Re-exported again from `components/{Page,PageHeader,DashboardCard}.tsx`,
// which are the module paths several dozen pages already import.
export { Page, PageHeader, DashboardCard } from '@4cloudguru/cloud-suite-ui'
export type { PageProps, PageHeaderProps, DashboardCardProps } from '@4cloudguru/cloud-suite-ui'

// ── Admin business components ──────────────────────────────────────────────
// Whole features owned upstream and embedded inline by this app's admin pages,
// which supply the data fetching and mutations around them. These are the
// highest-risk entries in this file: a prop change upstream is a behaviour
// change in a page here, not just a compile error.
export {
  ApiKeyExpirySettingsCard,
  BrandingSettingsCard,
  NotificationChannelsSection,
} from '@4cloudguru/cloud-suite-ui'
export type {
  ApiKeyExpirySettingsInput,
  NotificationChannelTypeOption,
} from '@4cloudguru/cloud-suite-ui'

// ── Cross-cutting primitives ───────────────────────────────────────────────
// `ORGANIZATION_HEADER` is the suite-wide name of the acting-organization
// header (terraform-registry-backend#1011); it is stamped in exactly one
// interceptor, guarded by `services/__tests__/actingOrganization.guard.test.ts`.
// `isSafeUrl` is the shared allowlist/normalisation check that
// `utils/externalUrl.ts` composes this app's narrower policy on top of.
export { ORGANIZATION_HEADER, isSafeUrl } from '@4cloudguru/cloud-suite-ui'
