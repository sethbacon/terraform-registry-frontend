# Terraform Registry Frontend -- Roadmap

> **Goal**: Raise all review scores to 9/10 or 10/10.
> **Out of scope**: v1.0 API stability (deferred), state management, runtime execution (plan/apply).
> **Structure**: Phases are ordered by impact. Work items within each phase are **independent** and can be worked on by separate agents in parallel unless noted otherwise.
> **Coordinates with**: `terraform-registry-backend/ROADMAP.md` -- the backend roadmap introduces new API endpoints for scanning setup, storage migration, advanced search, and module deprecation that this frontend will consume.

---

## Phase 1: Testing & CI Foundation (Maturity 6→9)

### 1.1 Vitest Coverage Configuration & Enforcement

**Why**: `vitest.config.ts` (18 lines) has zero coverage configuration -- no thresholds, no reporters, no include/exclude. There is no CI enforcement of frontend coverage at all. The backend enforces 75% minimum; the frontend enforces nothing.

**Current state**:
- `frontend/vitest.config.ts`: `environment: 'happy-dom'`, `globals: true`, `setupFiles: './src/setupTests.ts'`. No `coverage` section.
- 4 unit test files totaling 313 lines across `components/__tests__/`, `hooks/__tests__/`, `contexts/__tests__/`, `services/__tests__/`.
- No `@vitest/coverage-v8` or `@vitest/coverage-istanbul` in `package.json`.

**Work items**:

1. **Install coverage provider**: Add `@vitest/coverage-v8` as a dev dependency in `frontend/package.json`.

2. **Add coverage configuration** to `frontend/vitest.config.ts`:
   ```ts
   test: {
     environment: 'happy-dom',
     setupFiles: './src/setupTests.ts',
     globals: true,
     unstubGlobals: true,
     coverage: {
       provider: 'v8',
       reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
       reportsDirectory: './coverage',
       include: ['src/**/*.{ts,tsx}'],
       exclude: [
         'src/**/*.test.{ts,tsx}',
         'src/**/*.spec.{ts,tsx}',
         'src/main.tsx',
         'src/setupTests.ts',
         'src/vite-env.d.ts',
         'src/**/*.d.ts',
       ],
       thresholds: {
         statements: 40,
         branches: 40,
         functions: 40,
         lines: 40,
       },
     },
   },
   ```
   Start with 40% thresholds (realistic for current state) and ratchet up as tests are added in 1.2-1.5.

3. **Add `test:coverage` script** to `frontend/package.json`:
   ```json
   "test:coverage": "vitest run --coverage"
   ```

4. **Add `.gitignore` entry** for `frontend/coverage/`.

**Affected files**: `frontend/vitest.config.ts`, `frontend/package.json`, `.gitignore`

**Acceptance criteria**: `npm run test:coverage` generates a coverage report. Coverage thresholds fail the build below 40%.

---

### 1.2 Unit Tests: Services Layer

**Why**: `services/__tests__/api.test.ts` is 29 lines with 3 structural tests (checks that `api` is an object, has `searchModules`, has `login`) and zero behavioral tests. The `ApiClient` class has 100+ methods across 1,308 lines.

**Current state**:
- `frontend/src/services/api.ts` (1,308 lines): Axios-based client with Bearer token interceptor, 401 handler, mock data fallback, `SetupToken` header for setup endpoints.
- `frontend/src/services/queryKeys.ts` (17 lines): Only 3 domains (modules, providers, dashboard).
- `frontend/src/services/errorReporting.ts` (37 lines): Custom error reporter with `init()`, `captureError()`, `setUser()`.

**Work items**:

1. **Create `services/__tests__/api.test.ts` (rewrite)** -- Behavioral tests for the ApiClient:
   - Test auth interceptor: requests include `Authorization: Bearer <token>` when token is set.
   - Test 401 interceptor: clears auth and redirects on 401 (except SCM OAuth 401s which should propagate).
   - Test `setupRequest()`: uses `SetupToken` header instead of Bearer.
   - Test a representative method from each category (module search, provider search, admin user list, storage config) to verify correct HTTP method, URL, and payload mapping.
   - Mock Axios using `vitest.mock('axios')` or use `msw` (Mock Service Worker) for more realistic HTTP mocking.

2. **Create `services/__tests__/errorReporting.test.ts`**:
   - Test `init()` with and without `VITE_ERROR_REPORTING_DSN`.
   - Test `captureError()` calls fetch with correct payload structure.
   - Test `setUser()` sets user ID for subsequent reports.
   - Test `captureError()` gracefully handles fetch failures.

3. **Create `services/__tests__/queryKeys.test.ts`**:
   - Test that query keys produce unique arrays for different parameters.
   - Test that key hierarchy is stable (important for cache invalidation).

**Affected files**: `frontend/src/services/__tests__/api.test.ts` (rewrite), `frontend/src/services/__tests__/errorReporting.test.ts` (new), `frontend/src/services/__tests__/queryKeys.test.ts` (new)

**Acceptance criteria**: Full behavioral coverage of the API client's interceptor logic, error handling, and header management. 80%+ coverage on the services layer.

---

### 1.3 Unit Tests: Hooks & Contexts

**Why**: `useModuleDetail.ts` (418 lines) is the most complex hook and has zero tests. `AuthContext.test.tsx` (104 lines, 4 cases) does not test `login`, `refreshToken`, or `fetchUser`. `ThemeContext.tsx` and `HelpContext.tsx` are untested.

**Current state**:
- `hooks/useModuleDetail.ts` (418 lines): Large hook managing module detail fetching, version selection, tab state, SCM info, and scan results. No React Query -- uses imperative `useState`+`useEffect`.
- `hooks/useDebounce.ts` (10 lines): Fully tested (71 lines of tests, 5 cases).
- `contexts/AuthContext.tsx` (140 lines): Provides `user`, `roleTemplate`, `allowedScopes`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshToken`, `setToken`. Uses `localStorage` for persistence, calls `api.getCurrentUserWithRole()`.
- `contexts/ThemeContext.tsx` (108 lines): Provides `mode` and `toggleTheme`. Persists to `localStorage`.
- `contexts/HelpContext.tsx` (51 lines): Provides `isHelpOpen`, `helpTopic`, `openHelp`, `closeHelp`.

**Work items**:

1. **Create `hooks/__tests__/useModuleDetail.test.ts`**:
   - Test initial loading state.
   - Test successful data fetch (mock `api.getModuleVersions`, `api.getModule`).
   - Test version selection (`selectVersion`).
   - Test tab state management.
   - Test SCM info loading when module has SCM link.
   - Test scan result loading.
   - Test error states (API failures).
   - Use `@testing-library/react` `renderHook` for hook testing.

2. **Expand `contexts/__tests__/AuthContext.test.tsx`** (currently 4 cases):
   - Add test for `login()` flow (calls `api.login()`, stores token, fetches user).
   - Add test for `refreshToken()` flow.
   - Add test for `fetchUser()` on mount when token exists in localStorage.
   - Add test for `logout()` clearing state and localStorage.
   - Add test for expired token handling (API returns 401 during `fetchUser`).

3. **Create `contexts/__tests__/ThemeContext.test.tsx`**:
   - Test default mode.
   - Test `toggleTheme()` switches between light and dark.
   - Test localStorage persistence across re-renders.

4. **Create `contexts/__tests__/HelpContext.test.tsx`**:
   - Test `openHelp(topic)` sets topic and opens panel.
   - Test `closeHelp()` clears state.

**Affected files**: `frontend/src/hooks/__tests__/useModuleDetail.test.ts` (new), `frontend/src/contexts/__tests__/AuthContext.test.tsx` (expand), `frontend/src/contexts/__tests__/ThemeContext.test.tsx` (new), `frontend/src/contexts/__tests__/HelpContext.test.tsx` (new)

---

### 1.4 Unit Tests: Core Components

**Why**: 18 component files (3,539 lines) with only 1 tested (`ProtectedRoute.test.tsx`, 109 lines). Key components like `ErrorBoundary`, `MarkdownRenderer`, `RegistryItemCard`, and `Layout` have zero tests.

**Work items**:

1. **Create `components/__tests__/ErrorBoundary.test.tsx`**:
   - Test renders children when no error.
   - Test renders fallback UI when child throws.
   - Test calls `captureError()` on error.
   - Test "Try Again" button resets error state.
   - Test custom `fallback` prop is used when provided.

2. **Create `components/__tests__/MarkdownRenderer.test.tsx`**:
   - Test renders markdown content as HTML.
   - Test sanitizes dangerous HTML (XSS prevention via `rehype-sanitize`).
   - Test handles empty/null content.
   - Test renders GFM features (tables, strikethrough, task lists).

3. **Create `components/__tests__/RegistryItemCard.test.tsx`**:
   - Test renders module card with name, namespace, description.
   - Test renders provider card variant.
   - Test click navigates to detail page.

4. **Create `utils/__tests__/errors.test.ts`**:
   - Test `getErrorMessage()` extracts from AxiosError, native Error, and string.
   - Test `getErrorStatus()` returns HTTP status from AxiosError.
   - Test fallback message when error is unrecognized.

5. **Create `utils/__tests__/formatting.test.ts`**:
   - Test all exported formatting functions with representative inputs.

**Affected files**: `frontend/src/components/__tests__/ErrorBoundary.test.tsx` (new), `frontend/src/components/__tests__/MarkdownRenderer.test.tsx` (new), `frontend/src/components/__tests__/RegistryItemCard.test.tsx` (new), `frontend/src/utils/__tests__/errors.test.ts` (new), `frontend/src/utils/__tests__/formatting.test.ts` (new)

---

### 1.5 GitHub Actions CI Pipeline

**Why**: The `.github/` directory only contains `dependabot.yml`. There are **no CI/CD pipelines** -- no lint, build, test, or deploy workflows. Every other aspect of quality enforcement depends on CI existing.

**Work items**:

1. **Create `.github/workflows/ci.yml`**:
   - **Trigger**: Push to `main`, pull requests to `main`.
   - **Jobs** (run in parallel where possible):
     - **lint**: `npm ci` + `npm run lint` in `frontend/`.
     - **typecheck**: `npm ci` + `npx tsc --noEmit` in `frontend/`.
     - **unit-test**: `npm ci` + `npm run test:coverage` in `frontend/`. Upload coverage report as artifact. Fail if coverage thresholds not met.
     - **build**: `npm ci` + `npm run build` in `frontend/`. Upload `dist/` as artifact for deployment jobs.
   - **Node version**: Use matrix or fixed version matching `.nvmrc` or engines field.
   - **Caching**: Cache `node_modules` with `actions/cache` keyed on `package-lock.json` hash.

2. **Create `.github/workflows/e2e.yml`**:
   - **Trigger**: Push to `main`, pull requests to `main`.
   - **Job**: Install Playwright browsers, start backend+frontend via Docker Compose (`deployments/docker-compose.test.yml`), run `npx playwright test` in `e2e/`.
   - Upload Playwright report (HTML + traces + videos) as artifact.
   - Separate workflow since E2E is slower and requires the Docker-based backend.

3. **Create `.github/workflows/release.yml`**:
   - **Trigger**: Push of `v*` tag.
   - Build production Docker image.
   - Push to container registry (GHCR).
   - Create GitHub Release with changelog.

4. **Create `.github/workflows/scheduled.yml`**:
   - **Trigger**: Weekly cron.
   - Run full CI pipeline to catch dependency drift.
   - On failure, create a GitHub issue.

5. **Pin all GitHub Actions to commit SHAs** (not version tags) for supply chain security, consistent with the backend repository pattern.

**Affected files**: `.github/workflows/ci.yml` (new), `.github/workflows/e2e.yml` (new), `.github/workflows/release.yml` (new), `.github/workflows/scheduled.yml` (new)

**Acceptance criteria**: PRs require passing lint, typecheck, unit tests with coverage, and build. E2E runs on every PR. Releases are automated on tag push.

---

### 1.6 Ratchet Coverage Thresholds

**Why**: After items 1.2-1.4 are complete, coverage will be significantly higher than the initial 40% threshold. The threshold should be ratcheted up to prevent regression.

**Work items**:

1. **After completing 1.2-1.4**, run `npm run test:coverage` and note actual coverage.
2. **Update thresholds** in `vitest.config.ts` to 5% below actual coverage (gives buffer for new untested code without allowing regression).
3. **Target**: 60% statements/lines, 50% branches/functions as a post-Phase-1 baseline.

**Depends on**: 1.1, 1.2, 1.3, 1.4.

---

## Phase 2: Feature Completeness (Features 8→9, Ease of Use 7→9)

### 2.1 Security Scanning Step in Setup Wizard

**Why**: The setup wizard (`SetupWizardPage.tsx`, 916 lines) configures OIDC, storage, and admin user but skips scanning. Users must manually set environment variables for scanning tools after setup. The backend roadmap (item 2.3) adds `POST /api/v1/setup/scanning/test` and `POST /api/v1/setup/scanning` endpoints.

**Current state**:
- Steps array (line 47): `['Authenticate', 'OIDC Provider', 'Storage Backend', 'Admin User', 'Complete']`.
- Each step is rendered via `{activeStep === N && (...)}` conditionals.
- State management: individual `useState` hooks for each step's form data, loading, and success flags.
- API layer: `api.ts` has `getScanningConfig()` (line 660) and `getScanningStats()` (line 665) but no setup-specific scanning methods.

**Work items**:

1. **Add API methods** to `services/api.ts`:
   ```ts
   async testScanningConfig(setupToken: string, data: ScanningConfigInput): Promise<ScanningTestResult> {
     return this.setupRequest(setupToken).post('/api/v1/setup/scanning/test', data);
   }
   async saveScanningConfig(setupToken: string, data: ScanningConfigInput): Promise<void> {
     return this.setupRequest(setupToken).post('/api/v1/setup/scanning', data);
   }
   ```

2. **Add TypeScript interfaces** to `types/` or inline in api.ts:
   ```ts
   interface ScanningConfigInput {
     enabled: boolean;
     tool: 'trivy' | 'checkov' | 'terrascan' | 'snyk' | 'custom';
     binary_path: string;
     expected_version?: string;
     timeout_secs?: number;
     worker_count?: number;
   }
   interface ScanningTestResult {
     success: boolean;
     detected_version: string;
     error?: string;
   }
   ```

3. **Update steps array** in `SetupWizardPage.tsx` (line 47):
   ```ts
   const steps = ['Authenticate', 'OIDC Provider', 'Storage Backend', 'Security Scanning', 'Admin User', 'Complete'];
   ```
   This inserts scanning as step 3 (after storage, before admin). Increment all subsequent `activeStep === N` conditionals by 1.

4. **Add scanning step state**:
   ```ts
   const [scanningForm, setScanningForm] = useState<ScanningConfigInput>({ enabled: false, tool: 'trivy', binary_path: '' });
   const [scanningTesting, setScanningTesting] = useState(false);
   const [scanningTestResult, setScanningTestResult] = useState<ScanningTestResult | null>(null);
   const [scanningSaving, setScanningSaving] = useState(false);
   const [scanningSaved, setScanningSaved] = useState(false);
   ```

5. **Render scanning step** (new `{activeStep === 3 && (...)}` block):
   - **Enable/disable toggle** (MUI Switch) at top.
   - If enabled:
     - **Tool selector** (MUI Select): `trivy`, `checkov`, `terrascan`, `snyk`, `custom`.
     - **Binary path** (MUI TextField): File path to scanner binary.
     - **Expected version** (MUI TextField, optional): Expected version string.
     - **Advanced settings** (MUI Accordion):
       - Timeout (seconds, default 300).
       - Worker count (default 2).
     - **Test button**: Calls `api.testScanningConfig(token, scanningForm)`. Shows detected version on success, error message on failure.
     - **Save button** (enabled after successful test or if disabled): Calls `api.saveScanningConfig(token, scanningForm)`.
   - If disabled: Show info text that scanning can be configured later via admin settings. Allow proceeding without configuring.
   - **Skip button**: Allows skipping scanning configuration entirely (proceeds to admin step).

6. **Update `GetSetupStatus` response handling**: The backend will add `scanning_configured` field. Handle it in the setup status check and the Complete step's summary chips.

7. **Update Complete step**: Add scanning row to the review summary showing configured tool and version, or "Skipped".

8. **Tests**:
   - Unit test for the scanning step rendering.
   - Expand E2E `setup-wizard.spec.ts` to cover the scanning step (test, save, skip flows).

**Affected files**: `frontend/src/pages/SetupWizardPage.tsx`, `frontend/src/services/api.ts`, `e2e/tests/setup-wizard.spec.ts`

**Acceptance criteria**: Setup wizard has a "Security Scanning" step that can test, configure, or skip scanner setup. Works with the backend's new setup endpoints.

---

### 2.2 Storage Migration Wizard UI

**Why**: The admin StoragePage (`StoragePage.tsx`, 727 lines) shows existing configs as read-only cards with no edit, delete, activate, or migrate actions. `api.activateStorageConfig()`, `api.updateStorageConfig()`, and `api.deleteStorageConfig()` exist in `api.ts` but are not wired to any UI. The backend roadmap (item 2.4) adds a full storage migration service with plan/execute/cancel/status endpoints.

**Current state**:
- `StoragePage.tsx`: Two modes -- setup wizard (first-run) and read-only config view (post-setup).
- Existing configs are displayed as static MUI Cards with Active/Inactive chips.
- No migration UI, no edit UI, no activate UI.
- `api.ts` storage methods (lines 1043-1080): `getActiveStorageConfig`, `listStorageConfigs`, `getStorageConfig`, `createStorageConfig`, `updateStorageConfig`, `deleteStorageConfig`, `activateStorageConfig`, `testStorageConfig`.

**Work items**:

1. **Add migration API methods** to `services/api.ts`:
   ```ts
   async planStorageMigration(sourceId: string, targetId: string): Promise<MigrationPlan> {
     return this.client.post('/api/v1/admin/storage/migrations/plan', { source_config_id: sourceId, target_config_id: targetId });
   }
   async startStorageMigration(sourceId: string, targetId: string): Promise<Migration> {
     return this.client.post('/api/v1/admin/storage/migrations', { source_config_id: sourceId, target_config_id: targetId });
   }
   async getStorageMigration(id: string): Promise<Migration> {
     return this.client.get(`/api/v1/admin/storage/migrations/${id}`);
   }
   async cancelStorageMigration(id: string): Promise<void> {
     return this.client.post(`/api/v1/admin/storage/migrations/${id}/cancel`);
   }
   async listStorageMigrations(): Promise<Migration[]> {
     return this.client.get('/api/v1/admin/storage/migrations');
   }
   ```

2. **Add TypeScript interfaces**:
   ```ts
   interface MigrationPlan {
     source_config_id: string;
     target_config_id: string;
     total_artifacts: number;
     total_modules: number;
     total_providers: number;
     estimated_size_bytes: number;
   }
   interface Migration {
     id: string;
     source_config_id: string;
     target_config_id: string;
     status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
     total_artifacts: number;
     migrated_artifacts: number;
     failed_artifacts: number;
     error_message?: string;
     started_at?: string;
     completed_at?: string;
     created_at: string;
   }
   ```

3. **Enhance `StoragePage.tsx` existing configs view**:
   - **Add action buttons** to each config card:
     - "Activate" button on inactive configs (calls `api.activateStorageConfig(id)` with confirmation dialog).
     - "Edit" button opens an inline form or dialog (calls `api.updateStorageConfig(id, data)`).
     - "Delete" button with confirmation (calls `api.deleteStorageConfig(id)`; disabled on active config).
   - **Add "Migrate" button**: Visible when multiple configs exist. Opens migration wizard dialog.

4. **Create `components/StorageMigrationWizard.tsx`** (new) -- MUI Dialog with stepper:
   - **Step 1 -- Select Source & Target**: Two dropdowns showing storage configs. Source defaults to active config. Target defaults to first inactive config. Validation: source !== target.
   - **Step 2 -- Review Plan**: Calls `api.planStorageMigration(source, target)`. Displays artifact count, breakdown by type (modules/providers), estimated size. Warning about duration for large migrations.
   - **Step 3 -- Execute & Monitor**: Start button calls `api.startStorageMigration(source, target)`. Shows real-time progress:
     - MUI LinearProgress with `(migrated / total) * 100`.
     - Text: "Migrated X of Y artifacts (Z failed)".
     - Status chip: pending → running → completed/failed/cancelled.
     - Cancel button calls `api.cancelStorageMigration(id)`.
     - Auto-polls `api.getStorageMigration(id)` every 2 seconds while status is `running`.
   - **Step 4 -- Complete**: Summary of migration results. If failures, list failed artifacts with error messages. Option to retry failed items (start a new migration for just the failed ones).

5. **Add migration history section** to StoragePage:
   - Below config cards, show a collapsible "Migration History" section.
   - Table with columns: ID, Source, Target, Status, Progress, Started, Completed.
   - Data from `api.listStorageMigrations()`.

6. **Tests**:
   - Unit test for `StorageMigrationWizard` component (render steps, plan display, progress calculation).
   - E2E test: create a second storage config, plan migration, verify artifact count.

**Affected files**: `frontend/src/pages/admin/StoragePage.tsx`, `frontend/src/components/StorageMigrationWizard.tsx` (new), `frontend/src/services/api.ts`

---

### 2.3 Advanced Search UI

**Why**: Current search on `ModulesPage.tsx` (258 lines) and `ProvidersPage.tsx` (187 lines) is a single text field with no filters, no sort options, and no URL state synchronization. The backend roadmap (item 2.2) adds PostgreSQL full-text search with relevance ranking, sort parameters, and namespace/system filters.

**Current state**:
- Both pages use `useDebounce(searchQuery, 300)` → `useQuery` with `api.searchModules({ query, limit, offset })`.
- `searchQuery` and `page` are `useState` only -- URL params are read once on mount via `useSearchParams().get('q')` but **never written back**.
- No sort selector, no filters, no namespace/system filter dropdowns.
- Module page has "grid" and "grouped" view modes; provider page has only grid.

**Work items**:

1. **URL state synchronization** for both pages:
   - Replace `useState` for `searchQuery`, `page`, `sort`, `order`, and filters with `useSearchParams`:
     ```ts
     const [searchParams, setSearchParams] = useSearchParams();
     const query = searchParams.get('q') || '';
     const page = parseInt(searchParams.get('page') || '1');
     const sort = searchParams.get('sort') || 'relevance';
     const order = searchParams.get('order') || 'desc';
     const namespace = searchParams.get('namespace') || '';
     ```
   - Update `setSearchParams` when any parameter changes, debounced for the query field.
   - This enables browser back/forward navigation to restore search state and shareable URLs.

2. **Add filter/sort controls** to `ModulesPage.tsx`:
   - **Sort dropdown** (MUI Select): `Relevance`, `Name (A-Z)`, `Name (Z-A)`, `Newest`, `Most Downloaded`.
   - **Namespace filter** (MUI Autocomplete with free text or loaded from available namespaces).
   - **System/provider filter** (MUI Autocomplete -- for modules, filter by target system like `aws`, `azurerm`, `gcp`).
   - Layout: Filter row between search input and results grid using MUI Stack/Grid.

3. **Add filter/sort controls** to `ProvidersPage.tsx`:
   - **Sort dropdown**: `Relevance`, `Name (A-Z)`, `Name (Z-A)`, `Newest`.
   - **Namespace filter** (Autocomplete).

4. **Update API calls** in both pages:
   - Pass `sort`, `order`, `namespace`, and `system` (modules only) parameters to `api.searchModules()` and `api.searchProviders()`.
   - Update `queryKeys.ts` to include sort/filter params in query keys for proper cache invalidation:
     ```ts
     modules: {
       search: (params: { query?: string; limit: number; offset: number; sort?: string; order?: string; namespace?: string; system?: string }) =>
         [...queryKeys.modules._def, 'search', params] as const,
     },
     ```

5. **Visual search result scoring**: When sort is `relevance`, show a subtle relevance indicator (e.g., match highlighting in the result card using `<mark>` tags on matched terms, or a small relevance chip). The backend returns `ts_rank` scores that can be used.

6. **Empty state improvements**: When no results match, show suggestions ("Try searching for...", "Clear filters", link to browse all modules).

7. **Tests**:
   - Unit test: URL ↔ state sync (changes to search params update the UI, changes to filters update URL).
   - E2E test: search with filters, verify URL contains params, navigate back/forward.

**Affected files**: `frontend/src/pages/ModulesPage.tsx`, `frontend/src/pages/ProvidersPage.tsx`, `frontend/src/services/api.ts`, `frontend/src/services/queryKeys.ts`

---

### 2.4 Module Deprecation UI

**Why**: The backend roadmap (item 4.1) adds module-level deprecation with migration guidance and successor module references. The frontend needs to display deprecation status and provide management UI.

**Current state**:
- Module detail pages show version-level deprecation (existing).
- No module-level deprecation concept in the UI.
- Module search results have no deprecation visual indicator.

**Work items**:

1. **Update module detail page** (`pages/ModuleDetailPage.tsx`):
   - Show a prominent deprecation banner (MUI Alert, severity `warning`) when `module.deprecated === true`.
   - Banner text: deprecation message + link to successor module (if set).
   - Example: "This module is deprecated. Consider using [namespace/name/system] instead."

2. **Add deprecation management** to module admin actions:
   - "Deprecate Module" button in the module's admin toolbar.
   - Opens dialog with: deprecation message (TextField, multiline), successor module selector (Autocomplete searching modules via `api.searchModules()`).
   - Calls `api.deprecateModule(namespace, name, system, { message, successor })`.
   - "Undeprecate Module" button visible when already deprecated. Calls `api.undeprecateModule(namespace, name, system)`.

3. **Add API methods** to `services/api.ts`:
   ```ts
   async deprecateModule(ns: string, name: string, system: string, data: { message: string; successor?: { namespace: string; name: string; system: string } }): Promise<void>;
   async undeprecateModule(ns: string, name: string, system: string): Promise<void>;
   ```

4. **Update search results** (`RegistryItemCard.tsx`):
   - Show a "Deprecated" chip (MUI Chip, color `warning`) on deprecated modules.
   - Reduce visual prominence (e.g., semi-transparent card) for deprecated modules.

5. **Tests**: Unit test for deprecation banner rendering. E2E test for deprecate/undeprecate flow.

**Affected files**: `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/components/RegistryItemCard.tsx`, `frontend/src/services/api.ts`

**Depends on**: Backend roadmap item 4.1 (module deprecation API endpoints).

---

## Phase 3: React Query Migration & Performance (Maturity 7→9, Ease of Use 7→9)

### 3.1 React Query Migration for Admin Pages

**Why**: All 16 admin pages (`pages/admin/`, 9,223 lines total) use imperative `useState` + `useEffect` + `try/catch` patterns instead of React Query. This means no request deduplication, no stale-while-revalidate, no automatic cache invalidation, no background refetching, and every page re-implements the same loading/error/data state manually.

**Current state**:
- Only 3 pages use React Query: `ModulesPage`, `ProvidersPage`, `DashboardPage`.
- `queryKeys.ts` (17 lines) only has keys for `modules`, `providers`, `dashboard`.
- Admin pages follow this anti-pattern:
  ```tsx
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      try { setLoading(true); const res = await api.listFoo(); setData(res); }
      catch (e) { setError(getErrorMessage(e)); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [deps]);
  ```

**Work items**:

1. **Expand `queryKeys.ts`** to cover all admin domains:
   ```ts
   export const queryKeys = {
     modules: { /* existing */ },
     providers: { /* existing */ },
     dashboard: { /* existing */ },
     users: {
       _def: ['users'] as const,
       list: (params?: { page?: number; limit?: number }) => [...queryKeys.users._def, 'list', params] as const,
       detail: (id: string) => [...queryKeys.users._def, 'detail', id] as const,
     },
     organizations: {
       _def: ['organizations'] as const,
       list: (params?: { page?: number; limit?: number }) => [...queryKeys.organizations._def, 'list', params] as const,
       detail: (id: string) => [...queryKeys.organizations._def, 'detail', id] as const,
       members: (orgId: string) => [...queryKeys.organizations._def, 'members', orgId] as const,
     },
     apiKeys: { _def: ['apiKeys'] as const, list: () => [...queryKeys.apiKeys._def, 'list'] as const },
     scmProviders: { _def: ['scmProviders'] as const, list: () => [...queryKeys.scmProviders._def, 'list'] as const },
     auditLogs: { _def: ['auditLogs'] as const, list: (params?: Record<string, unknown>) => [...queryKeys.auditLogs._def, 'list', params] as const },
     storageConfigs: { _def: ['storageConfigs'] as const, list: () => [...queryKeys.storageConfigs._def, 'list'] as const },
     mirrors: { _def: ['mirrors'] as const, list: () => [...queryKeys.mirrors._def, 'list'] as const },
     roles: { _def: ['roles'] as const, list: () => [...queryKeys.roles._def, 'list'] as const },
     approvals: { _def: ['approvals'] as const, list: (params?: Record<string, unknown>) => [...queryKeys.approvals._def, 'list', params] as const },
     policies: { _def: ['policies'] as const, list: () => [...queryKeys.policies._def, 'list'] as const },
     scanning: { _def: ['scanning'] as const, config: () => [...queryKeys.scanning._def, 'config'] as const, stats: () => [...queryKeys.scanning._def, 'stats'] as const },
     terraformBinaries: { _def: ['terraformBinaries'] as const, list: () => [...queryKeys.terraformBinaries._def, 'list'] as const },
   } as const;
   ```

2. **Migrate each admin page** (each page is an independent work item):
   - Replace `useState(data) + useState(loading) + useState(error) + useEffect(fetchData)` with `useQuery`.
   - Replace mutation calls (`await api.createFoo(data); fetchData()`) with `useMutation` + `queryClient.invalidateQueries()`.
   - Remove manual loading/error state management.
   - Priority order (by complexity and traffic):
     1. `UsersPage.tsx` (647 lines) -- list + CRUD
     2. `OrganizationsPage.tsx` (580 lines) -- list + CRUD + members
     3. `APIKeysPage.tsx` (914 lines) -- list + create + rotate + delete
     4. `AuditLogPage.tsx` (429 lines) -- list with pagination and filters
     5. `SCMProvidersPage.tsx` (757 lines) -- list + CRUD + OAuth
     6. `StoragePage.tsx` (727 lines) -- list + create + test
     7. `MirrorsPage.tsx` (887 lines) -- list + CRUD + sync
     8. `MirrorPoliciesPage.tsx` (574 lines) -- list + CRUD + evaluate
     9. `RolesPage.tsx` (297 lines) -- list + create
     10. `ApprovalsPage.tsx` (397 lines) -- list + review
     11. `OIDCSettingsPage.tsx` (423 lines) -- get + update
     12. `SecurityScanningPage.tsx` (198 lines) -- get config + stats
     13. `DashboardPage.tsx` (646 lines) -- already uses useQuery but may need update
     14. `TerraformMirrorPage.tsx` (1,095 lines) -- complex; list + CRUD + sync + status
     15. `ModuleUploadPage.tsx` (373 lines) -- form + upload
     16. `ProviderUploadPage.tsx` (280 lines) -- form + upload

3. **Add React Query Devtools** (already in `package.json` as `@tanstack/react-query-devtools`). Ensure it's mounted in `App.tsx` (it may already be; verify and add if missing).

4. **Tests**: After migration, unit tests should mock React Query's `QueryClientProvider` rather than mocking individual API calls.

**Acceptance criteria**: All admin pages use `useQuery`/`useMutation` instead of imperative fetch patterns. Cache invalidation works correctly (e.g., creating a user invalidates the users list). Loading/error states are handled consistently.

---

### 3.2 Frontend Performance Monitoring

**Why**: No Web Vitals reporting, no performance monitoring. The custom error reporter (`errorReporting.ts`, 37 lines) only captures errors, not performance data.

**Current state**:
- `errorReporting.ts` has `init()`, `captureError()`, `setUser()` -- POSTs to `VITE_ERROR_REPORTING_DSN`.
- No `web-vitals` package installed.
- No `@opentelemetry` packages installed.
- No performance tracking anywhere in the codebase.

**Work items**:

1. **Install `web-vitals`** package (`npm i web-vitals`).

2. **Create `services/performanceReporting.ts`**:
   - Import `onCLS`, `onFID`, `onFCP`, `onLCP`, `onTTFB`, `onINP` from `web-vitals`.
   - On init, register all vitals with a callback that:
     - Logs to console in development.
     - Batches and sends to `VITE_PERFORMANCE_DSN` endpoint (or reuses `VITE_ERROR_REPORTING_DSN` with a different event type) in production.
   - Expose `reportNavigation(routeName, durationMs)` for route-level timing.

3. **Add route-level timing** in `App.tsx`:
   - Use React Router's `useNavigation()` (or a wrapper) to measure navigation durations.
   - Report each route transition with `reportNavigation()`.

4. **Add build-time bundle analysis**:
   - Install `rollup-plugin-visualizer` as dev dependency.
   - Add `visualize` script: `VITE_ANALYZE=true vite build`.
   - Add `vite.config.ts` conditional: when `VITE_ANALYZE` is set, include the visualizer plugin.

5. **Tests**: Unit test for the batching/sending logic in performanceReporting.

**Affected files**: `frontend/package.json`, `frontend/src/services/performanceReporting.ts` (new), `frontend/src/main.tsx`, `frontend/vite.config.ts`

---

### 3.3 Enhanced Error Reporting

**Why**: The custom error reporter (`errorReporting.ts`, 37 lines) is basic -- fire-and-forget POST with no batching, no source maps, no breadcrumbs, no session replay. For production use, this should either be replaced by a proper SDK or significantly enhanced.

**Work items**:

1. **Add batching and retry** to `errorReporting.ts`:
   - Queue errors in memory.
   - Flush batch every 5 seconds or when batch reaches 10 errors.
   - Retry with exponential backoff on network failure (max 3 retries).

2. **Add breadcrumbs**: Capture user navigation (React Router transitions), API calls (Axios interceptor), console errors. Include last 20 breadcrumbs with each error report.

3. **Add source map support**: Upload source maps to the error reporting endpoint during CI build (`release.yml`). Include `release` version in error reports.

4. **Add session context**: Generate a random `sessionId` on page load. Include with all error reports for grouping.

5. **Optional Sentry integration**: If the user configures `VITE_SENTRY_DSN` instead of `VITE_ERROR_REPORTING_DSN`, initialize the Sentry SDK instead of the custom reporter. This allows both custom and managed error reporting:
   ```ts
   export function init() {
     if (import.meta.env.VITE_SENTRY_DSN) {
       Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, release: __APP_VERSION__ });
     } else if (import.meta.env.VITE_ERROR_REPORTING_DSN) {
       // existing custom reporter
     }
   }
   ```
   Add `@sentry/react` as optional peer dependency.

**Affected files**: `frontend/src/services/errorReporting.ts`, `frontend/src/main.tsx`, `frontend/package.json`

---

### 3.4 `useModuleDetail` Hook Refactor to React Query

**Why**: `useModuleDetail.ts` (418 lines) is the most complex piece of state management in the frontend and uses imperative `useState`+`useEffect` patterns. It fetches module versions, module metadata, SCM info, and scan results in a cascade of effects with manual loading/error tracking.

**Work items**:

1. **Extract into multiple React Query hooks**:
   - `useModuleVersions(namespace, name, system)` → `useQuery(queryKeys.modules.versions(ns, name, sys), () => api.getModuleVersions(...))`
   - `useModuleMetadata(namespace, name, system, version)` → `useQuery(queryKeys.modules.detail(ns, name, sys, version), () => api.getModule(...))`
   - `useModuleSCMInfo(namespace, name, system)` → `useQuery(queryKeys.modules.scm(ns, name, sys), () => api.getModuleSCMInfo(...))`
   - `useModuleScan(namespace, name, system, version)` → `useQuery(queryKeys.modules.scan(ns, name, sys, version), () => api.getModuleScan(...))`

2. **Create a composed `useModuleDetail` hook** that calls the above hooks and derives computed state (selected version, tab state, etc.).

3. **Add query keys** for the new hooks to `queryKeys.ts`.

4. **Update `ModuleDetailPage`** to use the refactored hook. The page's render logic should not change -- only the data fetching beneath it.

5. **Tests**: The existing absence of tests is addressed in Phase 1 item 1.3. The refactored hook should be easier to test since each sub-hook can be tested independently.

**Affected files**: `frontend/src/hooks/useModuleDetail.ts`, `frontend/src/services/queryKeys.ts`, `frontend/src/pages/ModuleDetailPage.tsx`

**Depends on**: 3.1 (uses the expanded `queryKeys.ts` patterns).

---

## Phase 4: Documentation & Polish (Documentation 9→10)

### 4.1 Component Storybook or Style Guide

**Why**: With 18 components and 16 admin pages, there is no way to browse or test UI components in isolation. New contributors cannot see what's available without reading source.

**Work items**:

1. **Evaluate approach**: Storybook is the standard but heavy. A lighter alternative is a `/dev/components` route that renders all components with sample props (only available in dev mode).

2. **If Storybook**:
   - Install `@storybook/react-vite`.
   - Create stories for key components: `RegistryItemCard`, `MarkdownRenderer`, `ErrorBoundary`, `Layout`, `ProviderIcon`, `SecurityScanPanel`, `VersionDetailsPanel`.
   - Add Storybook build to CI (static export).

3. **If dev route** (lighter approach):
   - Create `src/pages/dev/ComponentShowcase.tsx`.
   - Register under `/dev/components` route (only in development mode).
   - Render each component with representative props in a categorized list.

**Affected files**: Depends on approach. If Storybook: `.storybook/` (new), `src/components/*.stories.tsx` (new), `package.json`. If dev route: `src/pages/dev/ComponentShowcase.tsx` (new), `src/App.tsx`.

---

### 4.2 Accessibility Audit & Improvements

**Why**: No accessibility testing exists. MUI provides baseline a11y, but custom components (notably `RegistryItemCard`, `Layout`, `SetupWizardPage`) need manual verification.

**Work items**:

1. **Install `@axe-core/react`** (dev dependency) for runtime a11y warnings in development.

2. **Add Playwright accessibility tests**: Use `@axe-core/playwright` in a new `e2e/tests/accessibility.spec.ts` to scan key pages.

3. **Manual audit and fix** for common issues:
   - Ensure all images have `alt` text.
   - Ensure all form inputs have associated labels.
   - Verify keyboard navigation through the setup wizard.
   - Add `aria-label` to icon-only buttons (e.g., theme toggle, help toggle).
   - Verify color contrast ratios meet WCAG AA (MUI default theme should pass, but custom overrides may not).

4. **Add `lint-staged` + ESLint a11y rules**: Install `eslint-plugin-jsx-a11y` and enable recommended rules in ESLint config.

**Affected files**: `frontend/package.json`, `frontend/eslint.config.js`, `e2e/tests/accessibility.spec.ts` (new), various component files for fixes

---

### 4.3 Documentation Updates

**Work items** (each is independent, can be written in parallel):

1. **Update `README.md`** with:
   - Testing section (how to run unit tests, coverage, E2E).
   - CI pipeline overview.
   - Architecture diagram (component tree, data flow, state management).
   - Link to roadmap.

2. **Create `TESTING.md`**:
   - Unit test patterns and conventions.
   - E2E test patterns and how to add new tests.
   - How to run tests locally and in CI.
   - Coverage expectations and how to check.

3. **Update `CONTRIBUTING.md`** with:
   - Test requirements for PRs (unit tests for new components, E2E for new flows).
   - React Query patterns for data fetching.
   - Component file organization conventions.

4. **Create `ARCHITECTURE.md`**:
   - Component hierarchy diagram.
   - Data fetching patterns (React Query vs legacy useState/useEffect).
   - Routing structure.
   - Authentication flow (AuthContext → localStorage → API interceptor).
   - State management philosophy (React Query for server state, React state for UI state, Context for app-level concerns).

**Affected files**: `README.md`, `TESTING.md` (new), `CONTRIBUTING.md`, `ARCHITECTURE.md` (new)

---

## Summary: Score Impact Projection

| Category                 | Before | After | Key Drivers                                                                                              |
| ------------------------ | ------ | ----- | -------------------------------------------------------------------------------------------------------- |
| **Security**             | 8      | 9     | Scanning setup wizard, accessibility audit                                                               |
| **Ease of Use**          | 7      | 9     | Storage migration wizard, advanced search with filters/URL sync, scanning setup, React Query consistency |
| **Documentation**        | 9      | 10    | TESTING.md, ARCHITECTURE.md, README update, CONTRIBUTING update, component showcase                      |
| **Maturity**             | 6      | 9     | CI pipelines, unit test coverage (40→60%+), coverage enforcement, E2E improvements                       |
| **Feature Completeness** | 8      | 9     | Advanced search UI, storage migration wizard, scanning setup, module deprecation UI                      |
| **Enterprise Readiness** | 7      | 9     | CI/CD, error monitoring, performance monitoring, accessibility                                           |

---

## Dependency Graph

```
Phase 1 (parallel -- all independent):
  1.1 Vitest Coverage Config ────── independent (do first; gates 1.6)
  1.2 Unit Tests: Services ──────── independent
  1.3 Unit Tests: Hooks/Contexts ── independent
  1.4 Unit Tests: Components ────── independent
  1.5 GitHub Actions CI ─────────── independent
  1.6 Ratchet Coverage Thresholds ─ depends on 1.1 + 1.2 + 1.3 + 1.4

Phase 2 (parallel, after Phase 1 CI exists):
  2.1 Scanning Setup Wizard ────── requires backend roadmap 2.3
  2.2 Storage Migration Wizard ─── requires backend roadmap 2.4
  2.3 Advanced Search UI ───────── requires backend roadmap 2.2
  2.4 Module Deprecation UI ────── requires backend roadmap 4.1

Phase 3 (parallel):
  3.1 React Query Migration ────── independent (largest item; can be split across agents per page)
  3.2 Performance Monitoring ───── independent
  3.3 Enhanced Error Reporting ─── independent
  3.4 useModuleDetail Refactor ─── depends on 3.1 (query key patterns)

Phase 4 (after Phase 2-3):
  4.1 Component Showcase ───────── independent
  4.2 Accessibility Audit ──────── independent
  4.3 Documentation Updates ────── depends on all prior phases (documents new patterns)
```
