<!-- markdownlint-disable MD013 -->
# Architecture

This document describes the frontend architecture for the Terraform Registry, covering component hierarchy, routing, data fetching, authentication, and state management.

## Component Hierarchy

```text
App
 |
 +-- ThemeProvider          (contexts/ThemeContext.tsx)
 |    +-- CssBaseline
 |    +-- AuthProvider      (contexts/AuthContext.tsx)
 |         +-- HelpProvider (contexts/HelpContext.tsx)
 |              +-- QueryClientProvider  (@tanstack/react-query)
 |              |    +-- Router
 |              |    |    +-- ErrorBoundary
 |              |    |    |    +-- Routes
 |              |    |    |         +-- Standalone pages (no Layout)
 |              |    |    |         |    LoginPage
 |              |    |    |         |    CallbackPage
 |              |    |    |         |    SetupWizardPage
 |              |    |    |         |
 |              |    |    |         +-- Layout (sidebar + topbar + Outlet)
 |              |    |    |              +-- Public pages
 |              |    |    |              |    HomePage
 |              |    |    |              |    ModulesPage
 |              |    |    |              |    ModuleDetailPage (lazy)
 |              |    |    |              |    ProvidersPage
 |              |    |    |              |    ProviderDetailPage (lazy)
 |              |    |    |              |    TerraformBinariesPage
 |              |    |    |              |    TerraformBinaryDetailPage (lazy)
 |              |    |    |              |    ApiDocumentation (lazy)
 |              |    |    |              |    SettingsPage (lazy)
 |              |    |    |              |
 |              |    |    |              +-- Admin pages (ProtectedRoute + lazy)
 |              |    |    |                   DashboardPage
 |              |    |    |                   UsersPage
 |              |    |    |                   OrganizationsPage
 |              |    |    |                   RolesPage
 |              |    |    |                   APIKeysPage
 |              |    |    |                   ModuleUploadPage
 |              |    |    |                   ProviderUploadPage
 |              |    |    |                   SCMProvidersPage
 |              |    |    |                   MirrorsPage
 |              |    |    |                   TerraformMirrorPage
 |              |    |    |                   StoragePage
 |              |    |    |                   ApprovalsPage
 |              |    |    |                   VersionApprovalsPage
 |              |    |    |                   MirrorPoliciesPage
 |              |    |    |                   OIDCSettingsPage
 |              |    |    |                   SCIMProvisioningPage
 |              |    |    |                   MTLSPage
 |              |    |    |                   AuditLogPage
 |              |    |    |                   SecurityScanningPage
 |              |    |    |
 |              |    |    |         +-- Dev-only page (import.meta.env.DEV)
 |              |    |    |              ComponentShowcase  (/dev/components)
 |              |    +-- ReactQueryDevtools
```

## Routing Structure

Routes are defined in `App.tsx`. The app uses React Router v6 with the following structure:

### Standalone routes (no Layout shell)

| Path             | Component         | Notes                  |
| ---------------- | ----------------- | ---------------------- |
| `/login`         | `LoginPage`       | OIDC and dev login     |
| `/auth/callback` | `CallbackPage`    | OAuth redirect handler |
| `/setup`         | `SetupWizardPage` | First-run setup wizard |

### Public routes (inside Layout)

| Path                                | Component                   | Loading |
| ----------------------------------- | --------------------------- | ------- |
| `/`                                 | `HomePage`                  | Eager   |
| `/modules`                          | `ModulesPage`               | Eager   |
| `/modules/:namespace/:name/:system` | `ModuleDetailPage`          | Lazy    |
| `/providers`                        | `ProvidersPage`             | Eager   |
| `/providers/:namespace/:type`       | `ProviderDetailPage`        | Lazy    |
| `/terraform-binaries`               | `TerraformBinariesPage`     | Eager   |
| `/terraform-binaries/:name`         | `TerraformBinaryDetailPage` | Lazy    |
| `/api-docs`                         | `ApiDocumentation`          | Lazy    |
| `/settings`                         | `SettingsPage`              | Lazy    |

### Admin routes (inside Layout, behind ProtectedRoute)

All admin routes are lazy-loaded and wrapped in `<ProtectedRoute requiredScope="...">`.

| Path                       | Component              | Required Scope       |
| -------------------------- | ---------------------- | -------------------- |
| `/admin`                   | `DashboardPage`        | (authenticated)      |
| `/admin/users`             | `UsersPage`            | `users:read`         |
| `/admin/organizations`     | `OrganizationsPage`    | `organizations:read` |
| `/admin/roles`             | `RolesPage`            | `users:read`         |
| `/admin/apikeys`           | `APIKeysPage`          | (authenticated)      |
| `/admin/upload`            | redirect → `/admin/upload/module` | —         |
| `/admin/upload/module`     | `ModuleUploadPage`     | `modules:write`      |
| `/admin/upload/provider`   | `ProviderUploadPage`   | `providers:write`    |
| `/admin/scm-providers`     | `SCMProvidersPage`     | `scm:read`           |
| `/admin/mirrors`           | `MirrorsPage`          | `mirrors:read`       |
| `/admin/terraform-mirror`  | `TerraformMirrorPage`  | `mirrors:read`       |
| `/admin/storage`           | `StoragePage`          | `admin`              |
| `/admin/approvals`         | `ApprovalsPage`        | `mirrors:read`       |
| `/admin/version-approvals` | `VersionApprovalsPage` | `mirrors:read`       |
| `/admin/policies`          | `MirrorPoliciesPage`   | `admin`              |
| `/admin/oidc`              | `OIDCSettingsPage`     | `admin`              |
| `/admin/scim`              | `SCIMProvisioningPage` | `admin`              |
| `/admin/mtls`              | `MTLSPage`             | `admin`              |
| `/admin/audit-logs`        | `AuditLogPage`         | `audit:read`         |
| `/admin/security-scanning` | `SecurityScanningPage` | `admin`              |

`ProtectedRoute` checks `useAuth()` for authentication and scope. If loading, it shows a spinner. If unauthenticated, it redirects to `/login`. If the required scope is missing (and the user does not have `admin`), it shows "Access Denied".

In development builds only (`import.meta.env.DEV`), the `/dev/components` route renders `ComponentShowcase`.

The catch-all route (`*`) redirects to `/`.

## Data Fetching

### Overview

```text
  Component
     |
     v
  useQuery / useMutation  (React Query)
     |
     v
  queryKeys.ts  (cache key factory)
     |
     v
  services/api  (Axios client)
     |
     v
  Backend API  (/api/v1/...)
```

### API Client (`services/api/`)

A composed barrel object (`services/api/index.ts`) that spreads every per-domain module (`modulesApi.ts`, `usersApi.ts`, etc.) into one flat `apiClient`, all sharing the single configured Axios instance in `services/api/http.ts`. The old 1900-line `ApiClient` god object (issue #474) was split into these per-domain modules; existing `import apiClient from '../services/api'` call sites keep working unchanged. Key features (implemented in `http.ts`):

- **Base URL**: Empty in dev (Vite proxy handles `/api/*`), configurable via `VITE_API_URL` in production.
- **Cookie credentials**: The Axios instance is created with `withCredentials: true`, so the HttpOnly auth cookie and the `tfr_csrf` cookie are sent on every request.
- **Request interceptor (CSRF)**: On mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`), reads the non-HttpOnly `tfr_csrf` cookie and echoes it in an `X-CSRF-Token` header (double-submit pattern). Auth is cookie-only -- no request ever attaches an `Authorization: Bearer` header sourced from `localStorage` (`authStorage.ts` keeps the legacy key list only to purge leftover values from pre-cookie-migration sessions).
- **Response interceptor (401)**: On 401, clears auth and redirects to `/login` -- except for SCM OAuth endpoints (`/scm-providers/*/repositories`, `/tags`, `/branches`) where 401 means the SCM token expired, not the user session.
- **Breadcrumb interceptor**: Records every API call (method, URL, status, duration) for error reporting context.
- **Setup requests**: The `setupRequest(token)` method creates one-off requests with `Authorization: SetupToken <token>` for the first-run setup wizard.
- **Mock data**: When `VITE_USE_MOCK_DATA=true`, returns mock responses instead of calling the backend (for offline development).

### Query Keys (`services/queryKeys.ts`)

Query keys use a factory pattern that ensures cache isolation and supports granular invalidation:

```ts
export const queryKeys = {
  modules: {
    _def: ['modules'] as const,
    search: (params) => [...queryKeys.modules._def, 'search', params] as const,
    detail: (namespace, name, system) => [...queryKeys.modules._def, 'detail', namespace, name, system] as const,
    versions: (namespace, name, system) => [...queryKeys.modules._def, 'versions', ...] as const,
    scan: (namespace, name, system, version) => [...queryKeys.modules._def, 'scan', ...] as const,
  },
  users: {
    _def: ['users'] as const,
    list: (params?) => [...queryKeys.users._def, 'list', params] as const,
    detail: (id) => [...queryKeys.users._def, 'detail', id] as const,
  },
  // ... 15+ domains total
} as const;
```

Domains currently covered, including: `modules`, `providers`, `dashboard`, `users`, `organizations`, `apiKeys`, `scmProviders`, `auditLogs`, `storageConfigs`, `storageMigrations`, `mirrors`, `roles`, `approvals`, `policies`, `quotas`, `oidcConfig`, `versionInfo`, `terraformMirrors`, `advisories`, `versionApprovals`.

**Invalidation pattern**: Mutations invalidate the `_def` key to refresh all queries for that domain:

```ts
queryClient.invalidateQueries({ queryKey: queryKeys.users._def });
```

### React Query Configuration

The `QueryClient` is configured in `App.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // Data considered fresh for 30 seconds
      retry: 1,                // One retry on failure
      refetchOnWindowFocus: false,
    },
  },
});
```

React Query Devtools are mounted as `<ReactQueryDevtools initialIsOpen={false} />` (the `initialIsOpen={false}` prop only sets the panel's initial collapsed state; the devtools package itself ships a production no-op build).

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User/Browser
    participant FE as Frontend (React)
    participant BE as Backend API
    participant IdP as OIDC Provider

    U->>FE: Click "Login with OIDC"
    FE->>FE: AuthContext.login('oidc')
    FE->>BE: GET /api/v1/auth/login?provider=oidc
    BE-->>U: 302 Redirect to IdP authorize URL
    U->>IdP: Authenticate (credentials / MFA)
    IdP-->>U: 302 Redirect to /auth/callback?code=...
    U->>FE: /auth/callback (CallbackPage)
    Note over FE,BE: Backend set an HttpOnly auth cookie (+ tfr_csrf cookie) on the callback redirect
    FE->>FE: CallbackPage navigates to the return URL<br/>(no token ever transits the URL -- the session lives in the HttpOnly cookie)
    FE->>BE: GET /api/v1/auth/me (HttpOnly cookie sent via withCredentials)
    BE-->>FE: { user, role_template, allowed_scopes }
    FE->>FE: Cache user + scopes in state & localStorage

    Note over FE,BE: Subsequent API calls
    FE->>BE: Any request (cookie sent automatically;<br/>mutations echo tfr_csrf in X-CSRF-Token)
    BE-->>FE: Response (or 401 → logout + redirect to /login)

    Note over FE,IdP: Logout
    U->>FE: Click "Logout"
    FE->>FE: Clear local session state & localStorage
    FE->>BE: GET /api/v1/auth/logout
    BE-->>U: Clear HttpOnly cookie + redirect to IdP logout endpoint
```

### Key details

- **AuthContext** (`contexts/AuthContext.tsx`) provides: `user`, `roleTemplate`, `allowedScopes`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshToken`, `setToken`.
- **Session detection**: The session lives in an HttpOnly cookie. On mount, AuthContext calls `/api/v1/auth/me` (cookie sent via `withCredentials`) to detect and validate the session. If a cached user is in `localStorage` it restores UI state immediately (optimistic) and revalidates against `/auth/me` in the background.
- **Logout**: Clears local session state and the cached localStorage keys (`auth_token`, `user`, `role_template`, `allowed_scopes`, `authorized`) and redirects to the backend's logout endpoint, which clears the HttpOnly auth cookie and terminates the IdP session.
- **Dev mode login**: When the backend runs with `DEV_MODE=true`, the login page shows a "Dev Login (Admin)" button that authenticates directly without an IdP redirect.
- **Token refresh**: `refreshToken()` calls `api.refreshToken()` and updates the stored token. On failure, it calls `logout()`.

## State Management

The application uses three state layers:

| Layer               | Tool             | Scope                               | Examples                                                                              |
| ------------------- | ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| **Server state**    | React Query      | API data, cached across components  | Module lists, user lists, provider data, dashboard stats                              |
| **App-level state** | React Context    | Shared across the entire app        | Auth session (`AuthContext`), theme mode (`ThemeContext`), help panel (`HelpContext`) |
| **UI state**        | React `useState` | Local to a single component or hook | Form inputs, dialog open/close, selected tab, pagination                              |

### Contexts

| Context        | File                        | Provides                                                                                                                                 |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthContext`  | `contexts/AuthContext.tsx`  | `user`, `roleTemplate`, `allowedScopes`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshToken`, `setToken`                   |
| `ThemeContext` | `contexts/ThemeContext.tsx` | `mode` (`'light'` or `'dark'`), `toggleTheme()`. Persists to `localStorage`. Falls back to system preference via `prefers-color-scheme`. |
| `HelpContext`  | `contexts/HelpContext.tsx`  | `helpOpen`, `openHelp()`, `closeHelp()`. Persists panel state to `localStorage`.                                                         |

Each context has a corresponding `use*` hook that throws if called outside the provider.

## Key Hooks

### `useModuleDetail` (`hooks/useModuleDetail.ts`)

The most complex hook in the codebase. It composes multiple React Query queries to load all data for a module detail page:

- `useQuery(queryKeys.modules.versions(...))` -- fetches version list
- `useQuery(queryKeys.modules.detail(...))` -- fetches module metadata
- `useQuery(queryKeys.modules.scan(...))` -- fetches security scan results (admin only)
- `useQuery(queryKeys.modules.docs(...))` -- fetches module documentation
- `useQuery(queryKeys.modules.scm(...))` -- fetches SCM link info (authenticated only)
- `useQuery(queryKeys.modules.webhookEvents(...))` -- fetches webhook events (authenticated only)

It also manages UI state (selected version, tab, dialogs) and provides `useMutation` wrappers for delete, deprecate, and SCM operations. Route params (`namespace`, `name`, `system`) come from `useParams()`.

### `useProviderDetail` (`hooks/useProviderDetail.ts`)

The provider-side counterpart to `useModuleDetail`. It owns everything `ProviderDetailPage` needs so the page itself stays presentational:

- Loads the provider and its versions (`api.searchProviders` + `api.getProviderVersions`), sorted newest-first with stable releases ahead of pre-releases.
- Walks the paginated doc index (`api.getProviderDocs`) for network-mirrored providers only.
- Owns the `?tab=docs` / `?doc=<category>/<slug>` query state via `useSearchParams`, plus dialog and copy-feedback UI state.
- Exposes delete / deprecate / undeprecate handlers and the derived `getTerraformExample()`, `githubUrl` and `changelogUrl` values.

Unlike `useModuleDetail` it does not use React Query yet -- it keeps the page's original `useState` + `useEffect` fetching.

### `useTerraformBinaryDetail` (`hooks/useTerraformBinaryDetail.ts`)

The mirrored-binary counterpart to the two hooks above, backing `TerraformBinaryDetailPage`:

- Loads the mirror summary and its versions from the two **public** endpoints (`api.listPublicTerraformMirrorConfigs` + `api.listPublicTerraformVersions`), sorted latest-first then numerically descending.
- Keeps the `config_id` (UUID) taken from the first version row -- admin actions need it, and the public config summary does not carry it.
- Owns the deprecate/undeprecate/delete dialog state plus the action error/success banners, and derives `canManage` from the `admin` / `mirrors:manage` scopes.

Like `useProviderDetail` it uses plain `useState` + `useEffect` rather than React Query.

### `useDebounce` (`hooks/useDebounce.ts`)

A simple generic debounce hook used for search input:

```ts
const debouncedQuery = useDebounce(searchQuery, 300);
```

### `useDefaultOrgMembership` (`hooks/useDefaultOrgMembership.ts`)

Loads the current user's organization memberships and, when given a
`setDefaultOrgId` callback, defaults the caller's selected-organization state
to the first membership once memberships load. Shared by admin pages that
attach a newly-created resource to one of the user's organizations (module
upload, SCM provider setup, API keys), replacing what was previously a
near-identical query+effect pair copy-pasted into each page.

### `usePagination` (`hooks/usePagination.ts`)

Shared MUI `TablePagination` state (0-based page + rows-per-page) and its
`onPageChange`/`onRowsPerPageChange` handlers, including resetting to page 0
when rows-per-page changes. Used by the admin pages with paginated tables
(audit logs, mirrors, security scanning, users) in place of each page
reimplementing the same state and handlers.

## Error Handling

### ErrorBoundary (`components/ErrorBoundary.tsx`)

Wraps route sections to catch render errors. Shows a fallback UI with a "Try Again" button. Reports errors via `errorReporting.captureError()`.

### Error Reporting (`services/errorReporting.ts`)

Enhanced error reporter with:

- **Batching**: Queues errors and flushes every 5 seconds or when 10 errors accumulate.
- **Retry**: Exponential backoff (up to 3 retries) on send failure.
- **Breadcrumbs**: Records the last 20 events (navigation — via `NavigationBreadcrumbTracker`/`useNavigationBreadcrumbs` on every route change, API calls, console errors) for debugging context.
- **Session tracking**: Random `sessionId` generated per page load, included with all reports.
- **Configuration** (three mutually exclusive outcomes, checked in order):
  1. `VITE_SENTRY_DSN` set — the Sentry SDK (`@sentry/react`) is lazy-loaded and initialized (preferred for production); `beforeSend`/`beforeBreadcrumb` hooks strip session tokens from URLs before they leave the browser.
  2. `VITE_ERROR_REPORTING_DSN` set (and no Sentry DSN) — the built-in batched custom reporter POSTs to that URL.
  3. Neither set — errors are logged to the console only.

### Performance Reporting (`services/performanceReporting.ts`)

Reports Core Web Vitals (CLS, FCP, LCP, INP, TTFB) and route-level navigation
timing — `reportNavigation()`, called from the same `NavigationBreadcrumbTracker`/
`useNavigationBreadcrumbs` hook that records navigation breadcrumbs above, so
every SPA route change reports both. Batches and flushes to `VITE_PERFORMANCE_DSN`
(falling back to `VITE_ERROR_REPORTING_DSN`) every 10 seconds or 25 entries,
via `sendBeacon` where available. In development, metrics are also logged to
the console. `reportNavigation()` is called unconditionally on every route
change regardless of consent, so it only buffers an entry once the service is
active (a DSN has been resolved by `init()`); dev-mode console logging stays
unconditional since it never leaves the browser. This prevents pre-consent
navigation history from being buffered and then flushed once the user later
opts in. Same DSN/`connect-src` constraints as error reporting apply (see
below).

### Telemetry Consent Gating (`components/TelemetryGate.tsx`)

Both error and performance reporting are opt-in: `TelemetryGate` starts/stops
each service in lockstep with the user's live consent preferences
(`useConsent()`), calling `init()` when a preference turns on and `destroy()`
on withdrawal or unmount — no page reload required. See PRIVACY.md section 3.3
for the consent lifecycle and legal basis.

### CSP and Telemetry Endpoints

The shipped Content-Security-Policy's `connect-src 'self'` (`nginx.conf`,
`nginx-ecs.conf.template`) means a DSN pointing at a genuinely cross-origin
endpoint (e.g. a Sentry SaaS `*.ingest.sentry.io` DSN) will have its
`fetch`/`sendBeacon` calls blocked by the browser — both send paths swallow
that failure silently by design, so telemetry would appear configured but
never actually leave the browser. Route third-party DSNs through this app's
own reverse proxy (same pattern as `nginx-ecs.conf.template`'s `BACKEND_URL`),
or add the destination origin to `connect-src` in both nginx configs.

### API Error Utilities (`utils/errors.ts`)

- `getErrorMessage(error)`: Extracts a human-readable message from `AxiosError`, native `Error`, or string.
- `getErrorStatus(error)`: Returns the HTTP status code from an `AxiosError`.

## Code Splitting

Critical-path pages (HomePage, LoginPage, ModulesPage, ProvidersPage, etc.) are loaded eagerly. Non-critical pages (detail pages, admin pages, API docs) are loaded lazily via `React.lazy()` with `<Suspense fallback={<div>Loading...</div>}>`.

## Shared Suite Package (`@4cloudguru/cloud-suite-ui`)

Cross-cutting concerns shared with the other Terraform Suite apps live in the
package [`@4cloudguru/cloud-suite-ui`](https://github.com/4cloudguru/cloud-suite-ui),
published publicly to npmjs and pinned to an **exact**
version in `package.json` (see the "Shared package" section of
`SECURITY.md` for the audit/provenance/update policy — the package carries the
auth/session provider and is treated as load-bearing security code).

The following local files are thin wrappers or re-exports around it:

| Local file                     | Wraps / re-exports from the package                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| `contexts/AuthContext.tsx`     | `AuthProvider`, `useAuth` (session lifecycle, expiry, scopes)       |
| `contexts/ConsentContext.tsx`  | `ConsentProvider`, `useConsent` (GDPR consent preferences)          |
| `contexts/ThemeContext.tsx`    | `SuiteThemeProvider`, `useThemeMode` (light/dark, RTL, whitelabel)  |
| `components/Layout.tsx`        | `SuiteLayout` (sidebar/topbar app shell)                            |
| `components/Page.tsx`          | `Page` + `PageProps`                                                |
| `components/PageHeader.tsx`    | `PageHeader` + `PageHeaderProps`                                    |
| `components/DashboardCard.tsx` | `DashboardCard` + `DashboardCardProps`                              |
| `components/ConsentBanner.tsx` | `ConsentBanner`                                                     |
| `components/SuiteSwitcher.tsx` | `SuiteSwitcher` (cross-app switcher)                                |
| `navigation.tsx`               | `NavItem` / `NavGroup` types for the sidebar config                 |

These files are not wrappers — they **consume** the package's components and
types directly, adding this app's own data fetching and policy around them:

| Local file                           | Consumes from the package                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `pages/admin/APIKeysPage.tsx`        | `ApiKeyExpirySettingsCard`, `ApiKeyExpirySettingsInput`                                             |
| `pages/admin/NotificationsPage.tsx`  | `NotificationChannelsSection`, `NotificationChannelTypeOption`                                      |
| `pages/admin/BrandingPage.tsx`       | `BrandingSettingsCard`, `UIThemeConfig`                                                             |
| `pages/setup/steps/BrandingStep.tsx` | `BrandingSettingsCard`, `UIThemeConfig` — the setup-wizard counterpart of the admin page above      |
| `services/api/themeApi.ts`           | `UIThemeConfig` (type only)                                                                         |
| `utils/externalUrl.ts`               | `isSafeUrl`, composed with this app's scheme narrowing and origin allowlist rather than re-exported |

`routeScopes.ts` and `services/errorReporting.ts` mention the package in
comments but import nothing from it, so they are deliberately absent from both
tables. `suitePackageDocumented.test.ts` keeps these lists in step with the
imports themselves.

## Shared Components

| Component                | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `Layout`                 | App shell with collapsible sidebar, topbar, and `<Outlet />` for nested routes |
| `ProtectedRoute`         | Auth guard checking authentication and scope                                   |
| `ErrorBoundary`          | Catches render errors with fallback UI                                         |
| `RegistryItemCard`       | Card component for module/provider search results                              |
| `MarkdownRenderer`       | Renders markdown content (README files) with GFM and HTML sanitization         |
| `SecurityScanPanel`      | Displays security scan results for a module version                            |
| `VersionDetailsPanel`    | Shows version metadata, inputs/outputs, dependencies                           |
| `WebhookEventsPanel`     | Collapsible panel showing SCM webhook events                                   |
| `ProviderDetailHeader`   | Breadcrumbs, title, version selector and manage actions for a provider        |
| `ProviderUsageExample`   | `required_providers` snippet with copy-source action                          |
| `ProviderPlatformsTable` | OS/arch build matrix with copyable SHA256 sums                                |
| `ProviderInfoPanel`      | Provider sidebar card (namespace, latest version, repo/changelog links)       |
| `ProviderVersionDetailsPanel` | Provider version sidebar card with deprecation status and actions        |
| `TerraformBinaryDetailHeader` | Breadcrumbs, title, tool chip and mirror-URL hint for a binary mirror     |
| `TerraformBinaryVersionsTable` | Synced-version table for a binary mirror (or its empty state)           |
| `TerraformBinaryVersionRow` | One version row with expandable platform detail; exports `getChangelogUrl` |
| `TerraformBinaryPlatformRows` | Lazily loaded OS/arch rows with SHA256 / GPG verification state          |
| `RepositoryBrowser`      | SCM repository picker with branch/tag selection                                |
| `StorageMigrationWizard` | Multi-step dialog for storage backend migration                                |
| `ProviderIcon`           | Renders provider brand icons from simple-icons                                 |
| `HelpPanel`              | Slide-out contextual help panel                                                |
