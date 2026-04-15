# Architecture

This document describes the frontend architecture for the Terraform Registry, covering component hierarchy, routing, data fetching, authentication, and state management.

## Component Hierarchy

```
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
 |              |    |    |                   MirrorPoliciesPage
 |              |    |    |                   OIDCSettingsPage
 |              |    |    |                   AuditLogPage
 |              |    |    |                   SecurityScanningPage
 |              |    +-- ReactQueryDevtools
```

## Routing Structure

Routes are defined in `App.tsx`. The app uses React Router v6 with the following structure:

### Standalone routes (no Layout shell)

| Path | Component | Notes |
| ---- | --------- | ----- |
| `/login` | `LoginPage` | OIDC and dev login |
| `/auth/callback` | `CallbackPage` | OAuth redirect handler |
| `/setup` | `SetupWizardPage` | First-run setup wizard |

### Public routes (inside Layout)

| Path | Component | Loading |
| ---- | --------- | ------- |
| `/` | `HomePage` | Eager |
| `/modules` | `ModulesPage` | Eager |
| `/modules/:namespace/:name/:system` | `ModuleDetailPage` | Lazy |
| `/providers` | `ProvidersPage` | Eager |
| `/providers/:namespace/:type` | `ProviderDetailPage` | Lazy |
| `/terraform-binaries` | `TerraformBinariesPage` | Eager |
| `/terraform-binaries/:name` | `TerraformBinaryDetailPage` | Lazy |
| `/api-docs` | `ApiDocumentation` | Lazy |

### Admin routes (inside Layout, behind ProtectedRoute)

All admin routes are lazy-loaded and wrapped in `<ProtectedRoute requiredScope="...">`.

| Path | Component | Required Scope |
| ---- | --------- | -------------- |
| `/admin` | `DashboardPage` | (authenticated) |
| `/admin/users` | `UsersPage` | `users:read` |
| `/admin/organizations` | `OrganizationsPage` | `organizations:read` |
| `/admin/roles` | `RolesPage` | `users:read` |
| `/admin/apikeys` | `APIKeysPage` | (authenticated) |
| `/admin/upload/module` | `ModuleUploadPage` | `modules:write` |
| `/admin/upload/provider` | `ProviderUploadPage` | `providers:write` |
| `/admin/scm-providers` | `SCMProvidersPage` | `scm:read` |
| `/admin/mirrors` | `MirrorsPage` | `mirrors:read` |
| `/admin/terraform-mirror` | `TerraformMirrorPage` | `mirrors:read` |
| `/admin/storage` | `StoragePage` | `admin` |
| `/admin/approvals` | `ApprovalsPage` | `mirrors:read` |
| `/admin/policies` | `MirrorPoliciesPage` | `admin` |
| `/admin/oidc` | `OIDCSettingsPage` | `admin` |
| `/admin/audit-logs` | `AuditLogPage` | `audit:read` |
| `/admin/security-scanning` | `SecurityScanningPage` | `admin` |

`ProtectedRoute` checks `useAuth()` for authentication and scope. If loading, it shows a spinner. If unauthenticated, it redirects to `/login`. If the required scope is missing (and the user does not have `admin`), it shows "Access Denied".

The catch-all route (`*`) redirects to `/`.

## Data Fetching

### Overview

```
  Component
     |
     v
  useQuery / useMutation  (React Query)
     |
     v
  queryKeys.ts  (cache key factory)
     |
     v
  api.ts  (Axios client)
     |
     v
  Backend API  (/api/v1/...)
```

### API Client (`services/api.ts`)

A singleton `ApiClient` class wrapping an Axios instance. Key features:

- **Base URL**: Empty in dev (Vite proxy handles `/api/*`), configurable via `VITE_API_URL` in production.
- **Request interceptor**: Reads `auth_token` from `localStorage` and attaches `Authorization: Bearer <token>`.
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

Domains currently covered: `modules`, `providers`, `dashboard`, `users`, `organizations`, `apiKeys`, `scmProviders`, `auditLogs`, `storageConfigs`, `storageMigrations`, `mirrors`, `roles`, `approvals`, `policies`, `oidcConfig`, `terraformMirrors`.

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

React Query Devtools are mounted in production-excluded mode (`<ReactQueryDevtools initialIsOpen={false} />`).

## Authentication Flow

```
User clicks "Login with OIDC"
        |
        v
AuthContext.login('oidc')
        |
        v
api.login('oidc')  -->  browser redirects to IdP
        |
        v
IdP authenticates  -->  redirects to /auth/callback
        |
        v
CallbackPage extracts token from URL  -->  AuthContext.setToken(token)
        |
        v
Token stored in localStorage('auth_token')
        |
        v
AuthContext.fetchCurrentUser()  -->  api.getCurrentUserWithRole()
        |
        v
User, roleTemplate, allowedScopes stored in state + localStorage
        |
        v
Axios request interceptor attaches Bearer token to all API calls
```

### Key details

- **AuthContext** (`contexts/AuthContext.tsx`) provides: `user`, `roleTemplate`, `allowedScopes`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshToken`, `setToken`.
- **Persistence**: On mount, AuthContext checks `localStorage` for an existing token and cached user. If found, it restores state immediately (optimistic) and refreshes from the API in the background.
- **Logout**: Clears all localStorage keys (`auth_token`, `user`, `role_template`, `allowed_scopes`, `authorized`) and redirects to the backend's OIDC logout endpoint to terminate the IdP session.
- **Dev mode login**: When the backend runs with `DEV_MODE=true`, the login page shows a "Dev Login (Admin)" button that authenticates directly without an IdP redirect.
- **Token refresh**: `refreshToken()` calls `api.refreshToken()` and updates the stored token. On failure, it calls `logout()`.

## State Management

The application uses three state layers:

| Layer | Tool | Scope | Examples |
| ----- | ---- | ----- | -------- |
| **Server state** | React Query | API data, cached across components | Module lists, user lists, provider data, dashboard stats |
| **App-level state** | React Context | Shared across the entire app | Auth session (`AuthContext`), theme mode (`ThemeContext`), help panel (`HelpContext`) |
| **UI state** | React `useState` | Local to a single component or hook | Form inputs, dialog open/close, selected tab, pagination |

### Contexts

| Context | File | Provides |
| ------- | ---- | -------- |
| `AuthContext` | `contexts/AuthContext.tsx` | `user`, `roleTemplate`, `allowedScopes`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshToken`, `setToken` |
| `ThemeContext` | `contexts/ThemeContext.tsx` | `mode` (`'light'` or `'dark'`), `toggleTheme()`. Persists to `localStorage`. Falls back to system preference via `prefers-color-scheme`. |
| `HelpContext` | `contexts/HelpContext.tsx` | `helpOpen`, `openHelp()`, `closeHelp()`. Persists panel state to `localStorage`. |

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

### `useDebounce` (`hooks/useDebounce.ts`)

A simple generic debounce hook used for search input:

```ts
const debouncedQuery = useDebounce(searchQuery, 300);
```

## Error Handling

### ErrorBoundary (`components/ErrorBoundary.tsx`)

Wraps route sections to catch render errors. Shows a fallback UI with a "Try Again" button. Reports errors via `errorReporting.captureError()`.

### Error Reporting (`services/errorReporting.ts`)

Enhanced error reporter with:

- **Batching**: Queues errors and flushes every 5 seconds or when 10 errors accumulate.
- **Retry**: Exponential backoff (up to 3 retries) on send failure.
- **Breadcrumbs**: Records the last 20 events (navigation, API calls, console errors) for debugging context.
- **Session tracking**: Random `sessionId` generated per page load, included with all reports.
- **Sentry integration**: If `VITE_SENTRY_DSN` is set, delegates to `@sentry/react`. Otherwise falls back to `VITE_ERROR_REPORTING_DSN` (custom endpoint) or console-only.

### API Error Utilities (`utils/errors.ts`)

- `getErrorMessage(error)`: Extracts a human-readable message from `AxiosError`, native `Error`, or string.
- `getErrorStatus(error)`: Returns the HTTP status code from an `AxiosError`.

## Code Splitting

Critical-path pages (HomePage, LoginPage, ModulesPage, ProvidersPage, etc.) are loaded eagerly. Non-critical pages (detail pages, admin pages, API docs) are loaded lazily via `React.lazy()` with `<Suspense fallback={<div>Loading...</div>}>`.

## Shared Components

| Component | Purpose |
| --------- | ------- |
| `Layout` | App shell with collapsible sidebar, topbar, and `<Outlet />` for nested routes |
| `ProtectedRoute` | Auth guard checking authentication and scope |
| `ErrorBoundary` | Catches render errors with fallback UI |
| `RegistryItemCard` | Card component for module/provider search results |
| `MarkdownRenderer` | Renders markdown content (README files) with GFM and HTML sanitization |
| `SecurityScanPanel` | Displays security scan results for a module version |
| `VersionDetailsPanel` | Shows version metadata, inputs/outputs, dependencies |
| `WebhookEventsPanel` | Collapsible panel showing SCM webhook events |
| `RepositoryBrowser` | SCM repository picker with branch/tag selection |
| `StorageMigrationWizard` | Multi-step dialog for storage backend migration |
| `ProviderIcon` | Renders provider brand icons from simple-icons |
| `HelpPanel` | Slide-out contextual help panel |
