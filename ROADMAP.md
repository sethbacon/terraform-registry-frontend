<!-- markdownlint-disable MD024 -->

# Improvement Roadmap

> Generated from a comprehensive code review on 2026-04-10.
> All file paths are relative to `frontend/src/` unless otherwise noted.
> Each phase is self-contained — tasks within a phase can be executed in parallel by independent agents unless noted otherwise.

---

## Phase 1 — Critical Foundations

> **Priority:** Critical | **Tasks:** 4 | **Parallelizable:** All

### Task 1.1: Add React error boundaries

**Why:** Any unhandled rendering error in any component currently crashes the entire application with a white screen. There are zero error boundaries in the codebase.

**Files to create:**

- `components/ErrorBoundary.tsx`

**Files to modify:**

- `App.tsx` — wrap the `<Routes>` block and each `<Suspense>` fallback

**Implementation details:**

- Create a class component `ErrorBoundary` implementing `componentDidCatch` and `getDerivedStateFromError`
- Render a user-friendly fallback UI with MUI `Alert` and a "Reload" button
- Accept an optional `fallback` prop for customizable error UI
- Wrap the top-level `<Routes>` in `App.tsx` with `<ErrorBoundary>`
- Consider wrapping each lazy-loaded route individually so one page crash doesn't take down the whole app

**Acceptance criteria:**

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Manually throwing an error in a component renders the fallback UI instead of a white screen
- [ ] Other routes remain navigable after one route errors

---

### Task 1.2: Fix duplicate `ProviderPlatform` interface

**Why:** `types/index.ts` defines `ProviderPlatform` twice (lines 149-160 and lines 181-190). The second definition is missing `storage_path` and `storage_backend` fields. TypeScript declaration merging causes the second to silently override the first.

**Files to modify:**

- `types/index.ts`

**Implementation details:**

- Delete the second definition (lines 181-190)
- Keep the first definition (lines 149-160) which has all 10 fields: `id`, `provider_version_id`, `os`, `arch`, `filename`, `storage_path`, `storage_backend`, `size_bytes`, `shasum`, `download_count`
- Grep all files for `ProviderPlatform` usage and verify no code depends on the narrower type

**Acceptance criteria:**

- [ ] Single `ProviderPlatform` interface with all 10 fields
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 1.3: Fix duplicate `RoleTemplate` interface

**Why:** `RoleTemplate` is defined in both `types/index.ts` (lines 13-20, 7 fields, `is_system` optional) and `types/rbac.ts` (lines 3-12, 9 fields, `is_system` required, adds `created_at`/`updated_at`). This creates type inconsistency.

**Files to modify:**

- `types/index.ts`
- `types/rbac.ts`

**Implementation details:**

- Keep the `types/rbac.ts` version as the canonical definition (it's the more complete type with timestamps and required `is_system`)
- Remove the `RoleTemplate` definition from `types/index.ts`
- Add a re-export in `types/index.ts`: `export type { RoleTemplate } from './rbac'`
- Grep all imports of `RoleTemplate` across the codebase and update any that import from `types/index` (they'll work via re-export, but verify)

**Acceptance criteria:**

- [ ] Single `RoleTemplate` definition in `types/rbac.ts`
- [ ] Re-export from `types/index.ts` for backwards compatibility
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 1.4: Configure Vitest and write foundational unit tests

**Why:** The project has zero unit tests. No testing framework is configured. The entire quality assurance relies on TypeScript type-checking + ESLint + E2E tests. Critical logic in `api.ts` (1,291 lines, 88 methods), `AuthContext.tsx`, `ProtectedRoute.tsx`, and `useDebounce.ts` has no test coverage.

**Files to create:**

- `frontend/vitest.config.ts`
- `frontend/src/setupTests.ts`
- `frontend/src/hooks/__tests__/useDebounce.test.ts`
- `frontend/src/components/__tests__/ProtectedRoute.test.tsx`
- `frontend/src/contexts/__tests__/AuthContext.test.tsx`
- `frontend/src/services/__tests__/api.test.ts`

**Files to modify:**

- `frontend/package.json` — add vitest + @testing-library/react + @testing-library/jest-dom + jsdom as devDependencies; add `"test"` and `"test:coverage"` scripts

**Implementation details:**

- Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event`
- Create `vitest.config.ts` extending the existing Vite config with `test: { environment: 'jsdom', setupFiles: './src/setupTests.ts', globals: true }`
- `useDebounce.test.ts`: test that value updates are delayed by the specified delay, test cleanup on unmount
- `ProtectedRoute.test.tsx`: test redirect to `/login` when unauthenticated, test "Access Denied" when scope missing, test pass-through when scope present, test `admin` scope grants all access
- `AuthContext.test.tsx`: test initial loading state, test `setToken` stores to localStorage, test `logout` clears all localStorage keys (`auth_token`, `user`, `role_template`, `allowed_scopes`), test 401 interceptor triggers logout
- `api.test.ts`: test auth header injection, test 401 response interceptor, test `setupRequest` uses `SetupToken` header format, test mock data mode

**Acceptance criteria:**

- [ ] `npm test` runs all unit tests with exit code 0
- [ ] `npm run test:coverage` outputs a coverage report
- [ ] Minimum 4 test files with at least 3 tests each
- [ ] `npm run build` still succeeds (no conflicts with vitest config)

---

## Phase 2 — Code Quality

> **Priority:** High | **Tasks:** 4 | **Parallelizable:** All

### Task 2.1: Extract shared utility functions

**Why:** `formatDate` is duplicated in `pages/admin/ApprovalsPage.tsx` (line 150, fallback `'N/A'`) and `pages/admin/MirrorsPage.tsx` (line 404, fallback `'Never'`). `getScopeInfo` is duplicated in `pages/admin/RolesPage.tsx` (line 38, fallback description `'Unknown scope'`) and `pages/admin/APIKeysPage.tsx` (line 322, fallback description `''`). `getScopeColor` exists only in `RolesPage.tsx` (line 47) but should be co-located with `getScopeInfo`.

**Files to create:**

- `utils/formatting.ts`
- `utils/scopes.ts`
- `utils/index.ts` (barrel export)

**Files to modify:**

- `pages/admin/ApprovalsPage.tsx`
- `pages/admin/MirrorsPage.tsx`
- `pages/admin/RolesPage.tsx`
- `pages/admin/APIKeysPage.tsx`

**Implementation details:**

- `utils/formatting.ts`: export `formatDate(dateStr?: string, fallback = 'N/A'): string` — accepts optional fallback parameter for the different use cases
- `utils/scopes.ts`: export `getScopeInfo(scopeValue: string)` and `getScopeColor(scopeValue: string)` — imports `AVAILABLE_SCOPES` from `types/rbac.ts`
- `utils/index.ts`: barrel re-exports from both files
- Update all 4 consuming files to import from `@/utils` instead of defining locally
- Delete the local function definitions from each consuming file

**Acceptance criteria:**

- [ ] Zero duplicate `formatDate` or `getScopeInfo` definitions in the codebase
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 2.2: Decompose `ModuleDetailPage.tsx`

**Why:** At 1,135 lines with 35 `useState` hooks, this is the largest file in the codebase. It contains at least 8 logical sections that impede readability and reuse.

**Files to create (under `pages/` or `components/`):**

| Component                            | Source lines         | Purpose                                   |
| ------------------------------------ | -------------------- | ----------------------------------------- |
| `hooks/useModuleDetail.ts`           | 69-236 (~170 lines)  | Custom hook for all data fetching + state |
| `components/ModuleDocumentation.tsx` | 542-655 (~113 lines) | Inputs/outputs/providers tables           |
| `components/SecurityScanPanel.tsx`   | 947-1015 (~68 lines) | Scan status and severity chips            |
| `components/SCMRepositoryPanel.tsx`  | 693-765 (~72 lines)  | SCM link status, sync/unlink              |
| `components/WebhookEventsPanel.tsx`  | 767-865 (~98 lines)  | Expandable event list                     |
| `components/VersionDetailsPanel.tsx` | 867-945 (~78 lines)  | Version info, deprecation controls        |

**Files to modify:**

- `pages/ModuleDetailPage.tsx`

**Implementation details:**

- Start with `useModuleDetail` hook extraction — move all `useState`, `useEffect`, and handler functions; return the state + handlers as a typed object
- Extract each sidebar panel as a standalone component accepting props
- The parent `ModuleDetailPage` should be reduced to ~300-400 lines: route params, the custom hook call, the layout JSX composing the sub-components
- Each extracted component should import its own MUI components and types

**Acceptance criteria:**

- [ ] `ModuleDetailPage.tsx` reduced to under 500 lines
- [ ] Each extracted component is independently importable
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] E2E test `modules.spec.ts` still passes

---

### Task 2.3: Normalize API import style

**Why:** 16 files use `import api from '../services/api'` (default export) and 10 files use `import { apiClient } from '../services/api'` (named export). Both reference the same singleton instance.

**Files to modify (the 10 using `{ apiClient }`):**

| File                                  | Import line |
| ------------------------------------- | ----------- |
| `contexts/AuthContext.tsx`            | 3           |
| `components/PublishFromSCMWizard.tsx` | 25          |
| `pages/admin/ApprovalsPage.tsx`       | 29          |
| `pages/LoginPage.tsx`                 | 15          |
| `pages/admin/MirrorPoliciesPage.tsx`  | 35          |
| `pages/SetupWizardPage.tsx`           | 37          |
| `pages/admin/MirrorsPage.tsx`         | 45          |
| `pages/admin/OIDCSettingsPage.tsx`    | 37          |
| `pages/admin/SCMProvidersPage.tsx`    | 37          |
| `pages/admin/StoragePage.tsx`         | 33          |

Also modify `services/api.ts` to remove the named `apiClient` export (keep only the default export `api`).

**Implementation details:**

- In each of the 10 files, change `import { apiClient } from '...'` to `import api from '...'`
- Find-and-replace all `apiClient.` calls to `api.` in each file
- In `services/api.ts`, remove the `export { apiClient }` or `export const apiClient` line
- Keep only `export default api`

**Acceptance criteria:**

- [ ] Zero imports of `apiClient` in the codebase
- [ ] All 26 files use `import api from '...'`
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 2.4: Consolidate local type definitions into shared types

**Why:** `ApprovalsPage.tsx` (lines 31-44) defines a local `ApprovalRequest` that duplicates `MirrorApprovalRequest` from `types/rbac.ts` (lines 16-36) with field name mismatches (`reviewer_notes` vs `review_notes`). `MirrorPoliciesPage.tsx` (lines 37-51) defines a local `MirrorPolicy` that duplicates `MirrorPolicy` from `types/rbac.ts` (lines 40-58) with optionality differences. `PolicyFormData` (lines 53-63) is unique.

**Files to modify:**

- `types/rbac.ts`
- `pages/admin/ApprovalsPage.tsx`
- `pages/admin/MirrorPoliciesPage.tsx`

**Implementation details:**

- Verify field names against actual backend API responses to determine which variant is correct (`reviewer_notes` vs `review_notes`)
- Update `types/rbac.ts` to be the canonical source for both types, matching the backend API contract
- Add `PolicyFormData` to `types/rbac.ts` (it's a form-specific type but still belongs with its domain types)
- Remove local interface definitions from both pages
- Update imports in both pages to use `types/rbac`

**Acceptance criteria:**

- [ ] Zero local interface definitions in `ApprovalsPage.tsx` or `MirrorPoliciesPage.tsx` (except `PolicyFormData` if it's truly page-specific)
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] E2E tests `approvals.spec.ts` and `policies.spec.ts` still pass

---

## Phase 3 — Strictness & Security

> **Priority:** Medium | **Tasks:** 5 | **Parallelizable:** Tasks 3.1-3.3 are sequential; tasks 3.4-3.5 can run in parallel with everything

### Task 3.1: Enable `react-hooks/exhaustive-deps` ESLint rule

**Why:** Disabled at `eslint.config.js` line 34. Missing dependency arrays cause stale closures and subtle bugs that are hard to diagnose.

**Files to modify:**

- `frontend/eslint.config.js` (line 34: change `'off'` to `'warn'`)
- All files with violations (run lint to discover)

**Implementation details:**

- Change the rule from `'off'` to `'warn'` first, run `npm run lint` to see the count of violations
- Fix each violation: add missing dependencies to arrays, or wrap callbacks in `useCallback` where appropriate
- Once all warnings are resolved, change `'warn'` to `'error'`
- Common fix patterns: add state setters to dep arrays (they're stable), wrap fetch functions in `useCallback`, use functional state updates to avoid dependencies on current state
- Note: the `--max-warnings 0` policy means even `'warn'` will fail CI, which is the desired behavior

**Acceptance criteria:**

- [ ] Rule set to `'warn'` or `'error'` in `eslint.config.js`
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` succeeds

---

### Task 3.2: Enable `@typescript-eslint/no-unused-vars` ESLint rule

**Why:** Disabled at `eslint.config.js` line 31. Dead variables increase cognitive load and may mask real bugs.

**Files to modify:**

- `frontend/eslint.config.js` (line 31)
- All files with violations

**Implementation details:**

- Change the rule from `'off'` to `['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]`
- Run `npm run lint`, fix violations by: removing truly unused variables, prefixing intentionally-unused params with `_`
- Once clean, change to `'error'`

**Acceptance criteria:**

- [ ] Rule enabled in `eslint.config.js`
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` succeeds

---

### Task 3.3: Enable `@typescript-eslint/no-explicit-any` ESLint rule (incremental)

**Why:** Disabled at `eslint.config.js` line 30. There are **88 `any` instances across 19 files**. Top offenders: `services/api.ts` (12), `pages/admin/SCMProvidersPage.tsx` (8), `pages/ModuleDetailPage.tsx` (8).

**Files to modify:**

- `frontend/eslint.config.js` (line 30)
- 19 files containing `any` (see breakdown below)

**`any` count per file:**

| File                                  | Count |
| ------------------------------------- | ----- |
| `services/api.ts`                     | 12    |
| `pages/admin/SCMProvidersPage.tsx`    | 8     |
| `pages/ModuleDetailPage.tsx`          | 8     |
| `pages/SetupWizardPage.tsx`           | 7     |
| `pages/admin/TerraformMirrorPage.tsx` | 6     |
| `pages/admin/UsersPage.tsx`           | 6     |
| `pages/admin/OrganizationsPage.tsx`   | 5     |
| `pages/admin/MirrorsPage.tsx`         | 5     |
| `pages/ProviderDetailPage.tsx`        | 4     |
| `pages/admin/APIKeysPage.tsx`         | 4     |
| `pages/admin/MirrorPoliciesPage.tsx`  | 4     |
| `pages/TerraformBinaryDetailPage.tsx` | 3     |
| `pages/ApiDocumentation.tsx`          | 3     |
| `pages/admin/ApprovalsPage.tsx`       | 3     |
| `pages/admin/StoragePage.tsx`         | 3     |
| `pages/admin/ModuleUploadPage.tsx`    | 2     |
| `components/PublishFromSCMWizard.tsx` | 2     |
| `components/RepositoryBrowser.tsx`    | 2     |
| `pages/admin/ProviderUploadPage.tsx`  | 1     |

**Implementation details:**

- Change the rule from `'off'` to `'warn'`
- The dominant pattern (~70 of 88) is `catch (err: any)` — replace with `catch (err: unknown)` and add type narrowing
- Create a shared `utils/errors.ts` with `getErrorMessage(err: unknown): string` to DRY up the ~70 catch blocks:
  ```typescript
  export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    const axiosErr = err as { response?: { data?: { error?: string } } };
    return axiosErr?.response?.data?.error || 'An unexpected error occurred';
  }
  ```
- For `api.ts`: type the `transformUser(user: any)` and `transformOrganization(org: any)` params with proper API response interfaces
- For `ApiDocumentation.tsx`: type the `spec: any` parameter with the OpenAPI spec type from swagger-ui-react
- Once all warnings resolved, change to `'error'`

**Acceptance criteria:**

- [ ] Rule enabled in `eslint.config.js`
- [ ] Zero `any` types remaining (or each justified with an `// eslint-disable-next-line` + comment)
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds

---

### Task 3.4: Add `SECURITY.md`

**Why:** No `SECURITY.md` exists anywhere in the repository. Already identified as a remaining recommendation in `CLAUDE.md` line 313. Private vulnerability reporting needs a documented channel.

**Files to create:**

- `SECURITY.md` at project root

**Files to modify:**

- `CLAUDE.md` — update "Remaining Recommendations" section to mark this item as done

**Implementation details:**

- Standard security policy format: Supported Versions table, Reporting a Vulnerability section (email or GitHub Security Advisories), disclosure timeline expectations, scope (what counts as a vulnerability)
- Reference the Apache 2.0 license
- Mention that the backend is in a separate repository with its own security policy

**Acceptance criteria:**

- [ ] `SECURITY.md` exists at project root
- [ ] Contains reporting instructions, supported versions, and disclosure policy
- [ ] `CLAUDE.md` "Remaining Recommendations" section updated

---

### Task 3.5: Add `.env.example`

**Why:** No `.env.example` exists. Four `VITE_*` variables are used across the codebase but undocumented.

**Files to create:**

- `frontend/.env.example`

**Files to modify:**

- `.gitignore` — add `.env` pattern if not already present

**All `VITE_*` variables to document:**

| Variable             | Default                 | Used in                                                     |
| -------------------- | ----------------------- | ----------------------------------------------------------- |
| `VITE_API_URL`       | `/api/v1`               | `services/api.ts` (line 5), `vite-env.d.ts` (line 9)        |
| `VITE_USE_MOCK_DATA` | `false`                 | `services/api.ts` (line 8), `vite-env.d.ts` (line 10)       |
| `VITE_PROXY_TARGET`  | `http://localhost:8080` | `frontend/vite.config.ts` (line 13)                         |
| `VITE_MODE`          | `development`           | `frontend/Dockerfile` (lines 6, 9, 29) — build arg, not env |

**Implementation details:**

- Document all 4 variables with comments explaining purpose and defaults
- All values should be commented out (prefixed with `#`) so the file serves as documentation, not active config
- Add `frontend/.env` and `frontend/.env.local` to `.gitignore` if not already present

**Acceptance criteria:**

- [ ] `frontend/.env.example` exists with all 4 variables documented
- [ ] `.gitignore` includes `.env` patterns

---

## Phase 4 — Testing & Performance

> **Priority:** Medium | **Tasks:** 5 | **Parallelizable:** All

### Task 4.1: Add Firefox to E2E cross-browser testing

**Why:** E2E tests only run in Chromium (`e2e/playwright.config.ts`). Firefox rendering and API differences could hide bugs.

**Files to modify:**

- `e2e/playwright.config.ts`
- `.github/workflows/ci.yml` — add `npx playwright install firefox` to the E2E job

**Implementation details:**

- Add a Firefox project alongside the existing Chromium configuration in the `projects` array
- Keep Chromium as the default; Firefox runs in CI only (use `process.env.CI` to conditionally include)
- Update `.github/workflows/ci.yml` to install Firefox browser

**Acceptance criteria:**

- [ ] `npx playwright test --project=firefox` runs successfully
- [ ] CI installs and uses both Chromium and Firefox

---

### Task 4.2: Fix tautological E2E assertions

**Why:** 1 pure tautology (`|| true`) and 13 weak `boolA || boolB` assertions reduce test value. 10 additional `.toBeTruthy()` assertions on generic page content test almost nothing.

**Pure tautology (always passes, must fix):**

| File            | Line | Assertion                                                 |
| --------------- | ---- | --------------------------------------------------------- |
| `admin.spec.ts` | 129  | `expect(hasCards \|\| hasEmptyText \|\| true).toBe(true)` |

**Weak `boolA || boolB` assertions (should strengthen):**

| File                             | Line                      |
| -------------------------------- | ------------------------- |
| `admin.spec.ts`                  | 31, 67, 86, 284, 343, 430 |
| `approvals.spec.ts`              | 48                        |
| `modules.spec.ts`                | 53, 186                   |
| `policies.spec.ts`               | 49                        |
| `providers.spec.ts`              | 51                        |
| `terraform-binaries.spec.ts`     | 42                        |
| `terraform-mirror-admin.spec.ts` | 42                        |

**Weak `.toBeTruthy()` assertions (should strengthen):**

| File                         | Line               |
| ---------------------------- | ------------------ |
| `admin.spec.ts`              | 212, 263, 303, 410 |
| `home.spec.ts`               | 131                |
| `modules.spec.ts`            | 113                |
| `providers.spec.ts`          | 126                |
| `terraform-binaries.spec.ts` | 117                |
| `upload.spec.ts`             | 24, 112            |

**Implementation details:**

- For the pure tautology: remove `|| true` so it becomes `expect(hasCards || hasEmptyText).toBe(true)`
- For weak `boolA || boolB` assertions: either seed test data so the assertion can be specific, or add a descriptive error message: `expect(hasCards || hasEmptyState, 'Expected either data cards or empty state message').toBe(true)`
- For `.toBeTruthy()` on page content: replace with specific text checks where possible (e.g., `expect(pageContent).toContain('some expected heading')`)
- If test data is not reliably seeded, the `boolA || boolB` pattern is acceptable with a comment explaining why — the pure tautology is the critical fix

**Acceptance criteria:**

- [ ] Zero `|| true` tautologies in the E2E suite
- [ ] All assertions either test something specific or document why they accept multiple valid states
- [ ] E2E suite still passes

---

### Task 4.3: Add E2E test for SetupWizardPage

**Why:** `SetupWizardPage.tsx` is a critical first-run flow with zero test coverage. It has 5 steps (Authenticate, OIDC, Storage, Admin, Complete) and uses a separate auth mechanism (`SetupToken` header).

**Files to create:**

- `e2e/tests/setup-wizard.spec.ts`

**Implementation details:**

- The test requires a fresh database (no existing setup). May need a dedicated docker-compose override or a backend API to reset setup state.
- Test the 5-step flow: navigate to `/setup`, enter setup token, configure OIDC (or skip), configure storage (local), create admin user, complete setup
- Test that `/setup` redirects to `/` when setup is already completed (based on `SetupWizardPage.tsx` line 97: `checkSetupStatus()` on mount)
- Test form validation (required fields, invalid inputs)

**Acceptance criteria:**

- [ ] New spec file with tests for the setup wizard flow
- [ ] Tests pass against the E2E test stack
- [ ] At minimum: test redirect-when-complete, test form validation

---

### Task 4.4: Add memoization to Layout and key list-rendering components

**Why:** `Layout.tsx` rebuilds the entire sidebar drawer (lines 175-303) on every render. `navigationItems` (line 95) and `adminNavGroups` (line 104) arrays are recreated every render. Zero `React.memo` usage in the entire codebase. Only 6 `useMemo` and 10 `useCallback` total across 53 source files.

**Files to modify:**

| File                              | Changes                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `components/Layout.tsx`           | Wrap `navigationItems`, `adminNavGroups`, and `drawer` JSX in `useMemo`; wrap event handlers in `useCallback` |
| `pages/ModulesPage.tsx`           | Memoize module card rendering and search handler                                                              |
| `pages/ProvidersPage.tsx`         | Memoize provider card rendering and search handler                                                            |
| `pages/admin/MirrorsPage.tsx`     | Memoize mirror cards (this page renders ALL mirrors with no pagination)                                       |
| `components/RegistryItemCard.tsx` | Wrap with `React.memo` (pure presentational component)                                                        |

**Implementation details:**

- `Layout.tsx`: `const navigationItems = useMemo(() => [...], [])` (static array, empty deps); `const adminNavGroups = useMemo(() => [...], [allowedScopes])` (only recalculate when scopes change)
- `RegistryItemCard.tsx`: `export default React.memo(RegistryItemCard)` — props are primitive values, this is a safe memo
- Avoid over-memoizing — only target components that re-render frequently with expensive or stable outputs

**Acceptance criteria:**

- [ ] `Layout.tsx` sidebar nav arrays are memoized
- [ ] `RegistryItemCard` is wrapped in `React.memo`
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] No visual regressions (manual check or E2E)

---

### Task 4.5: Add pagination to MirrorsPage and limit ModulesPage grouped view

**Why:** `MirrorsPage.tsx` renders all mirrors with no pagination (line 243: `apiClient.listMirrors()` with no params). `ModulesPage.tsx` line 70 fetches `limit: 500` modules at once for the grouped view without pagination or virtualization.

**Files to modify:**

- `pages/admin/MirrorsPage.tsx`
- `pages/ModulesPage.tsx`

**Implementation details:**

- `MirrorsPage.tsx`: Add `TablePagination` or similar pagination control (consistent with other admin pages like `UsersPage.tsx` and `AuditLogPage.tsx`). Add `page`/`rowsPerPage` state, pass to API call.
- `ModulesPage.tsx`: Either reduce `limit: 500` (line 70) to a reasonable default (50-100) with pagination for grouped view, or add virtualization via `react-window`. Pagination is simpler and more consistent with the rest of the codebase.
- If adding `react-window`: install as a dependency, wrap the module card grid in a `FixedSizeGrid` or `FixedSizeList`

**Acceptance criteria:**

- [ ] `MirrorsPage` paginates results (default 10-25 per page)
- [ ] `ModulesPage` grouped view either paginates or virtualizes (no longer fetches 500 at once)
- [ ] `npm run build` succeeds
- [ ] E2E tests `modules.spec.ts` and `admin.spec.ts` (mirrors section) still pass

---

## Phase 5 — UX & Accessibility

> **Priority:** Low | **Tasks:** 6 | **Parallelizable:** All

### Task 5.1: Add skip-to-content navigation

**Why:** No skip navigation exists anywhere in the app. Keyboard users must tab through the entire sidebar to reach main content.

**Files to modify:**

- `components/Layout.tsx` — add `id="main-content"` to `<Box component="main">` (line 437), add skip link as first child
- `index.css` — add `.skip-link` styles

**Implementation details:**

- Add `id="main-content"` to the `<Box component="main">` at `Layout.tsx` line 437
- Add a visually-hidden skip link as the first child of the Layout: `<a href="#main-content" className="skip-link">Skip to main content</a>`
- Add CSS in `index.css` for `.skip-link`: visually hidden by default, visible on `:focus` (positioned at top-left, high z-index, styled with the theme primary color)

**Acceptance criteria:**

- [ ] Pressing Tab as the first action on the page reveals a "Skip to main content" link
- [ ] Activating the link moves focus to the main content area
- [ ] The link is not visible when not focused

---

### Task 5.2: Add `aria-label` to all icon-only buttons

**Why:** ~45 `IconButton` instances across 16 files lack `aria-label`. Only 6 instances in the entire codebase have one (all in `Layout.tsx` and `HelpPanel.tsx`). Tooltip alone does not provide an accessible name for screen readers.

**Files to modify:**

| File                                  | Lines missing `aria-label`   |
| ------------------------------------- | ---------------------------- |
| `pages/admin/APIKeysPage.tsx`         | 556, 564, 572, 615, 782      |
| `pages/admin/MirrorPoliciesPage.tsx`  | 338, 343                     |
| `pages/admin/MirrorsPage.tsx`         | 67, 139, 554, 562, 573, 578  |
| `pages/HomePage.tsx`                  | 429                          |
| `components/RepositoryBrowser.tsx`    | 185                          |
| `pages/TerraformBinaryDetailPage.tsx` | 176, 206, 212, 224, 449      |
| `pages/admin/UsersPage.tsx`           | 440, 447, 543                |
| `pages/SetupWizardPage.tsx`           | 428                          |
| `pages/admin/SCMProvidersPage.tsx`    | 416, 479, 489, 506, 514      |
| `pages/ProviderDetailPage.tsx`        | 377, 472, 520                |
| `pages/admin/OIDCSettingsPage.tsx`    | 298, 301                     |
| `pages/admin/OrganizationsPage.tsx`   | 324, 331, 491                |
| `pages/admin/TerraformMirrorPage.tsx` | 116, 138, 289, 297, 303, 308 |
| `pages/ModuleDetailPage.tsx`          | 436, 511, 786                |

**Implementation details:**

- Add `aria-label="<action description>"` to every `<IconButton>` listed above
- Use the existing Tooltip `title` text as the `aria-label` value where a Tooltip wrapper exists
- For buttons without Tooltip: derive the label from the icon's purpose (e.g., `<DeleteIcon>` button gets `aria-label="Delete"`)

**Acceptance criteria:**

- [ ] Every `<IconButton>` in the codebase has an `aria-label` prop
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 5.3: Add `aria-busy` to loading state containers

**Why:** ~55 `CircularProgress` instances across 24 files have zero explicit ARIA attributes. While MUI's `CircularProgress` internally renders `role="progressbar"`, the parent containers don't set `aria-busy="true"`, so screen readers don't know a page region is loading.

**Files with full-page loading patterns to update:**

`components/AboutModal.tsx`, `components/DevUserSwitcher.tsx`, `components/ProtectedRoute.tsx`, `components/ProviderDocContent.tsx`, `components/PublishFromSCMWizard.tsx`, `components/RepositoryBrowser.tsx`, `pages/CallbackPage.tsx`, `pages/ModuleDetailPage.tsx`, `pages/ModulesPage.tsx`, `pages/ProvidersPage.tsx`, `pages/ProviderDetailPage.tsx`, `pages/SetupWizardPage.tsx`, `pages/TerraformBinariesPage.tsx`, `pages/TerraformBinaryDetailPage.tsx`, `pages/admin/APIKeysPage.tsx`, `pages/admin/ApprovalsPage.tsx`, `pages/admin/AuditLogPage.tsx`, `pages/admin/DashboardPage.tsx`, `pages/admin/MirrorPoliciesPage.tsx`, `pages/admin/MirrorsPage.tsx`, `pages/admin/ModuleUploadPage.tsx`, `pages/admin/OIDCSettingsPage.tsx`, `pages/admin/OrganizationsPage.tsx`, `pages/admin/ProviderUploadPage.tsx`, `pages/admin/RolesPage.tsx`, `pages/admin/SCMProvidersPage.tsx`, `pages/admin/StoragePage.tsx`, `pages/admin/TerraformMirrorPage.tsx`, `pages/admin/UsersPage.tsx`

**Implementation details:**

- For full-page loading states (the common pattern `{loading && <Box display="flex" ...><CircularProgress /></Box>}`): add `aria-busy="true"` to the parent container and `aria-live="polite"` so screen readers announce the state change
- Don't add `aria-busy` to inline/small spinners (e.g., button loading indicators) — only to the region-level containers
- Pattern: `<Box aria-busy={loading} aria-live="polite" ...>{loading ? <CircularProgress /> : <Content />}</Box>`

**Acceptance criteria:**

- [ ] All full-page loading patterns include `aria-busy` on their container
- [ ] `npm run build` succeeds

---

### Task 5.4: Add data-fetching abstraction

**Why:** Every page independently manages `loading`, `error`, and `success` state with identical boilerplate. No caching, no request deduplication, no stale-while-revalidate. Each of the 25+ pages has its own `useState` + `useEffect` + `try/catch` pattern.

**Files to create (TanStack Query approach):**

- Install `@tanstack/react-query` and optionally `@tanstack/react-query-devtools`
- `services/queryKeys.ts` — query key constants
- Update `App.tsx` — add `QueryClientProvider` to provider hierarchy

**Files to create (custom hook approach):**

- `hooks/useApiQuery.ts`

**Implementation details (TanStack Query — recommended):**

- Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- Add `QueryClientProvider` to `App.tsx` provider hierarchy
- Create query key constants in `services/queryKeys.ts`
- Migrate 2-3 pages first as proof of concept (e.g., `ModulesPage.tsx`, `ProvidersPage.tsx`, `DashboardPage.tsx`)
- Each migration replaces the `useState(loading/error/data)` + `useEffect(fetch)` pattern with a single `useQuery` call
- Subsequent pages can be migrated incrementally

**Implementation details (custom hook — alternative):**

- Create `hooks/useApiQuery.ts`: generic hook accepting a fetch function, returning `{ data, loading, error, refetch }`
- Add optional caching via a module-level `Map<string, { data, timestamp }>`
- Migrate same 2-3 proof-of-concept pages

**Acceptance criteria:**

- [ ] Data-fetching abstraction exists and is used by at least 2-3 pages
- [ ] Loading, error, and empty states work identically to the current behavior
- [ ] `npm run build` succeeds
- [ ] E2E tests pass

---

### Task 5.5: Add error reporting integration placeholder

**Why:** No monitoring or error reporting exists. Production rendering errors, API failures, and unhandled promise rejections are invisible to operators.

**Files to create:**

- `services/errorReporting.ts`

**Files to modify:**

- `components/ErrorBoundary.tsx` (from Task 1.1)
- `main.tsx`

**Implementation details:**

- Create `services/errorReporting.ts` with: `init()`, `captureError(error: Error, context?: Record<string, unknown>)`, `setUser(userId: string)`
- Default implementation: `console.error` + optional POST to configurable endpoint
- Design the interface to be Sentry-compatible (same method signatures) so swapping in Sentry later is a one-line change
- Call `captureError` from `ErrorBoundary.componentDidCatch`
- Add `window.addEventListener('unhandledrejection', ...)` in `main.tsx`
- Gate behind a `VITE_ERROR_REPORTING_DSN` env variable (when empty, reports to console only)

**Acceptance criteria:**

- [ ] `errorReporting.ts` exists with `init`, `captureError`, and `setUser` exports
- [ ] `ErrorBoundary` calls `captureError` on catch
- [ ] Unhandled promise rejections are captured
- [ ] No external dependencies when DSN is not configured

---

### Task 5.6: Add tag protection rule documentation

**Why:** Already identified in `CLAUDE.md` line 315 as a remaining recommendation. Release tags (`v*.*.*`) can currently be deleted by anyone with push access.

**Files to modify:**

- `CLAUDE.md` — update "Remaining Recommendations" section

**Implementation details:**

- Document the GitHub CLI command or API call to add a tag protection rule:
  ```bash
  gh api repos/{owner}/{repo}/rulesets --method POST \
    --field name="Protect release tags" \
    --field target=tag \
    --field enforcement=active \
    --field 'conditions[ref_name][include][]=refs/tags/v*.*.*' \
    --field 'rules[][type]=deletion'
  ```
  Or via GitHub UI: Settings > Rules > Rulesets > New ruleset targeting tags matching `v*.*.*`
- Move this item from "Remaining Recommendations" to a new "Applied" section or mark it as done
- The actual rule should be applied via the GitHub UI or CLI (not automated in CI)

**Acceptance criteria:**

- [ ] `CLAUDE.md` documents the tag protection rule command
- [ ] The "Remaining Recommendations" section is updated
