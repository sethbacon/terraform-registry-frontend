# Terraform Registry Frontend -- UX Roadmap

> **Goal**: Tighten the end-user experience across first-run, module browsing, admin navigation, and feedback. Complements `ROADMAP.md`, which focuses on testing, CI, and data-layer maturity.
> **Out of scope**: New features (state backend, run management, etc.), visual redesigns, brand refresh.
> **Structure**: Phases are ordered by user impact. Items within a phase are independent unless noted.
> **Coordinates with**: `ROADMAP.md` (testing/CI/React Query work) and `terraform-registry-backend/ROADMAP.md` (endpoints for advanced search, scanning setup, deprecation, storage migration).

---

## Testing & Coverage Gates (applies to every item)

**Non-negotiable**: every item in this roadmap is considered **incomplete** until the test work it lists is landed, the full Vitest + Playwright suites pass, and the coverage gate holds. No item may be merged that reduces any coverage metric.

### Current baseline vs. target

| Metric       | Current (`vitest.config.ts`) | Target after this roadmap |
| ------------ | ---------------------------- | ------------------------- |
| statements   | 42%                          | **≥ 55%**                 |
| branches     | 37%                          | **≥ 50%**                 |
| functions    | 36%                          | **≥ 50%**                 |
| lines        | 43%                          | **≥ 55%**                 |

The per-phase ratchet is defined in the "Coverage Threshold Progression" table at the bottom of this document. Each phase lands with a matching `vitest.config.ts` threshold bump so regressions can't accumulate unnoticed.

### Per-item testing rules

1. **New component / hook / context / util** → ships with a Vitest file next to it under `__tests__/`, covering: happy path, at least one error path, one edge case, and any accessibility attributes the component promises (aria-live, role, keyboard handlers). No component-library passthrough tests — test behavior, not MUI internals.
2. **Page-level change** → expand or add a Playwright spec in `e2e/tests/` exercising the user flow end-to-end against the real dev backend. Update existing specs when selectors or navigation change; stale specs are bugs.
3. **Refactor of existing code** (e.g., extracting `ConfirmDialog`, splitting `SetupWizardPage`) → existing tests must continue to pass **unmodified** wherever the public behavior is unchanged. If a test has to change, that change is scrutinized in review: it must be because the behavior legitimately changed, not because the refactor "was inconvenient to test the old way."
4. **Deleted code** → its tests are also deleted in the same commit. Don't leave zombie `.test.tsx` files referencing removed exports.
5. **Coverage delta check** → every PR runs `npm run test:coverage`; the CI job fails if any metric drops. Contributors running `npm run test:coverage` locally see the same numbers.

### Per-PR validation checklist

Before marking any roadmap item complete, the PR must prove all of:

- [ ] `npm run lint` — zero warnings (`--max-warnings 0` is enforced).
- [ ] `npm run build` — TypeScript compiles.
- [ ] `npm run test:coverage` — all unit tests pass; coverage thresholds met or exceeded.
- [ ] `npx playwright test` — relevant specs pass against the docker-compose dev stack.
- [ ] Coverage summary posted on the PR: include the `text-summary` output showing the metric delta vs. `main`.
- [ ] If a page is changed, at least one Playwright spec directly covers the new/changed UX.
- [ ] If a new user-facing control is added, at least one assertion checks its accessibility (role, name, keyboard activation).

### Test inventory (baseline)

- **Unit** (Vitest): 48 test files across `src/components/__tests__/`, `src/pages/__tests__/`, `src/pages/admin/__tests__/`, `src/contexts/__tests__/`, `src/hooks/__tests__/`, `src/services/__tests__/`, `src/utils/__tests__/`.
- **E2E** (Playwright): 14 specs in `e2e/tests/` covering auth, home, modules, providers, upload, approvals, admin, audit, policies, OIDC settings, setup wizard, terraform binaries, terraform mirror admin, accessibility.

New items should extend this structure, not duplicate it. When in doubt, colocate a unit test next to the file it covers; reserve Playwright for flows that cross page boundaries or hit the real API.

---

## Phase 1: First-Run & Onboarding (Ease of Use 7→9)

### 1.1 Make the "Getting Started" credentials snippet actionable

**Why**: The snippet on the home page shows `token = "<your-api-key>"` as a literal. A user who clicks the copy button gets a non-functional snippet, pastes it into `~/.terraformrc`, runs `terraform init`, and hits an auth error. This is the single most common first-time papercut.

**Current state**:

- `frontend/src/pages/HomePage.tsx:426` renders a hardcoded `credentials` block with the placeholder token.
- `handleCopyCredentials` (line 94) copies the literal placeholder text to clipboard.
- Step 2 of the "Getting Started" section ("Get an API Key") has no link to the API keys page and no way to create a key inline.

**Work items**:

1. **Conditional rendering based on auth**:
   - When unauthenticated: show current snippet + a "Sign in to generate a key" button that links to `/login`.
   - When authenticated: replace the placeholder snippet with a "Create API key" button that opens a lightweight dialog (reuse or share logic with `APIKeysPage`).

2. **Inline API key creation dialog** (new component `components/QuickApiKeyDialog.tsx`):
   - Fields: name (required), description (optional), expiry preset dropdown (7/30/90 days / never).
   - On submit: call `api.createApiKey(...)`, then show the plaintext token **once** inside the `credentials` snippet, with a clearly visible copy button and a warning: "This is the only time this token will be displayed. Store it securely."
   - Closing the dialog without copying triggers a confirmation ("You haven't copied the token — close anyway?").

3. **Update the copy handler**:
   - When the user has just created a key, copy the actual token-substituted snippet (not the placeholder).
   - On copy, fire an `aria-live="polite"` announcement (see item 4.1).

4. **Link to the full API Keys page** beside the dialog launcher: "Manage all keys →" routes to `/admin/apikeys`.

5. **Tests**:
   - **Unit** — new file `frontend/src/components/__tests__/QuickApiKeyDialog.test.tsx`:
     - renders closed by default, opens via prop;
     - name field validation (empty submit blocked, error message visible);
     - expiry preset dropdown populated from a constant (asserted directly, not MUI internals);
     - submit calls mocked `api.createApiKey`, success branch renders plaintext token inside snippet, copy button present;
     - error branch renders inline `<Alert severity="error">` with server message;
     - close-without-copy triggers confirmation prompt;
     - `aria-live` announcement on copy (spy on Announcer from 4.1 if landed, otherwise assert text content in live region).
   - **Unit** — extend `frontend/src/pages/__tests__/HomePage.test.tsx`:
     - unauthenticated path shows "Sign in to generate a key" CTA instead of placeholder snippet;
     - authenticated path shows "Create API key" button and "Manage all keys" link.
   - **E2E** — extend `e2e/tests/home.spec.ts`:
     - authenticated dev-login → click Create API key → submit → assert snippet contains non-placeholder token (use `navigator.clipboard.readText()` via `page.evaluate`);
     - unauthenticated visitor sees Sign-in CTA (no Copy button).
   - **Coverage target**: ≥ 90% statements on `QuickApiKeyDialog.tsx`; `HomePage.tsx` does not regress from current baseline.

**Affected files**: `frontend/src/pages/HomePage.tsx`, `frontend/src/components/QuickApiKeyDialog.tsx` (new), `frontend/src/pages/admin/APIKeysPage.tsx` (extract shared create-key logic if needed), `frontend/src/components/__tests__/QuickApiKeyDialog.test.tsx` (new), `frontend/src/pages/__tests__/HomePage.test.tsx` (extend), `e2e/tests/home.spec.ts` (extend)

**Acceptance criteria**: An authenticated user completes Sign-in → Copy-snippet → `terraform init` with no placeholders to hand-edit. Unauthenticated users see a Sign-in CTA instead of a broken snippet. All new/changed code is covered; coverage report shows no metric drop.

---

### 1.2 Symmetric login provider probing

**Why**: `LoginPage.tsx` probes Azure AD availability (lines 28–36) and only shows that button when the provider is reachable. OIDC receives no such probe — "Sign in with SSO" is always visible. If OIDC is not configured, clicking it triggers a server-side error path with a late alert. The dev-login button similarly has no error handling: a 500 on `/api/v1/auth/dev-login` crashes into the React error boundary.

**Current state**:

- `frontend/src/pages/LoginPage.tsx:28-36`: Azure AD probed once on mount, button gated by `azureADAvailable`.
- `handleOIDCLogin` (line 88) → `handleProviderLogin('oidc')` → late `setLoginError` only if `fetch` returns a non-redirect.
- `handleDevLogin` (line 38) is not wrapped in try/catch.

**Work items**:

1. **Probe both providers in parallel on mount**:

   ```ts
   const [providers, setProviders] = useState<{ oidc: boolean; azuread: boolean; loading: boolean }>({ oidc: false, azuread: false, loading: true });
   useEffect(() => {
     Promise.all(['oidc', 'azuread'].map(p =>
       fetch(`/api/v1/auth/login?provider=${p}`, { redirect: 'manual' })
         .then(r => r.type === 'opaqueredirect' || r.status === 0)
         .catch(() => false)
     )).then(([oidc, azuread]) => setProviders({ oidc, azuread, loading: false }));
   }, []);
   ```

2. **Render state**:
   - While loading: render disabled buttons with a `CircularProgress` indicator (or skeletons).
   - If a provider is unavailable: omit the button entirely and emit an info alert if *no* providers are available ("No SSO providers configured. Contact your administrator.").

3. **Wrap `handleDevLogin` in try/catch**: surface the error via the existing `setLoginError` Alert instead of bubbling to the ErrorBoundary.

4. **Consolidate provider buttons into a map-driven render** (removes the Azure-specific branching and scales to future providers like GitHub OAuth):

   ```ts
   const PROVIDERS = [
     { id: 'oidc',    label: 'Sign in with SSO',       sx: {} },
     { id: 'azuread', label: 'Sign in with Azure AD',  sx: { backgroundColor: '#0078d4', '&:hover': { backgroundColor: '#106ebe' } } },
   ];
   ```

5. **Backend coordination** (optional, cleaner): add a single `/api/v1/auth/providers` endpoint that returns `{providers: ['oidc', 'azuread']}`. Replace the two parallel probes with one call. (Track as a backend roadmap item.)

6. **Tests**:
   - **Unit** — extend `frontend/src/pages/__tests__/LoginPage.test.tsx` (already exists):
     - mock `fetch` for `/api/v1/auth/login?provider=oidc` and `?provider=azuread` with combinations: both available / neither / only OIDC / only Azure;
     - loading state: skeletons visible while probes pending;
     - no-provider state: info alert visible, dev-login remains visible in DEV_MODE;
     - `handleDevLogin` error path: 500 response renders inline `<Alert>`, does NOT throw (confirm via `expect(errorBoundarySpy).not.toHaveBeenCalled()`).
   - **E2E** — extend `e2e/tests/auth.spec.ts` (keep login-related scenarios in `auth.spec.ts` to avoid a 2nd login spec):
     - happy path: dev login visible, click, land on Home;
     - simulate OIDC unreachable via route interception (`page.route('**/auth/login?provider=oidc', r => r.abort())`); verify OIDC button not rendered;
     - force 500 on `/api/v1/auth/dev-login` via `page.route`; verify inline alert not ErrorBoundary.
   - **Coverage target**: `LoginPage.tsx` ≥ 85% statements (it is small enough to hit this easily). Branches covering all 4 probe-combination permutations.

**Affected files**: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/__tests__/LoginPage.test.tsx` (extend), `e2e/tests/auth.spec.ts` (extend)

**Acceptance criteria**: User only sees login buttons for providers that are actually reachable. Failed dev-login shows an inline alert, not the ErrorBoundary fallback. Tests cover every probe-combination and both failure paths.

---

### 1.3 Split the Setup Wizard into step components

**Why**: `SetupWizardPage.tsx` is 1,112 lines of one component that holds state for every step (OIDC, storage, scanning — after item 2.1 of `ROADMAP.md` — admin, review). Maintenance is painful: adding a step means renumbering every `activeStep === N` conditional and threading new state through the same file. Each step rerenders the entire wizard on any keystroke.

**Current state**:

- `frontend/src/pages/SetupWizardPage.tsx` (1,112 lines): one `SetupWizardPage` component with ~20 `useState` hooks and five `{activeStep === N && (...)}` blocks.
- No shared context for the setup token; it is passed manually between step logic inline.
- No progress persistence: refreshing the page loses all entered state.

**Work items**:

1. **Create `contexts/SetupWizardContext.tsx`**:
   - Holds `setupToken`, `activeStep`, and `stepData` (a discriminated union keyed by step id).
   - Provides `nextStep`, `prevStep`, `goToStep(id)`, `setStepData(id, data)`.
   - Optional: persist `stepData` (minus the token) to `sessionStorage` so accidental refresh does not nuke progress. Token stays memory-only for safety.

2. **Create `pages/setup/` directory with one file per step**:
   - `steps/AuthenticateStep.tsx` — verifies setup token, stores it in context.
   - `steps/OIDCStep.tsx` — OIDC configuration and test.
   - `steps/StorageStep.tsx` — storage backend configuration and test.
   - `steps/ScanningStep.tsx` — security scanner configuration (from `ROADMAP.md` item 2.1).
   - `steps/AdminUserStep.tsx` — admin account creation.
   - `steps/ReviewStep.tsx` — summary of configured settings + "Complete setup" button.
   - Each step exports `{ id: string, label: string, component: FC, canContinue: (data) => boolean }`.

3. **Rewrite `SetupWizardPage.tsx`** as a thin shell (~150 lines):
   - Renders `<Stepper>` with labels from the step registry.
   - Renders the active step's component.
   - "Back" / "Next" buttons wired to context.
   - A single "Abandon setup" button that clears `sessionStorage` and redirects to `/login`.

4. **Shared UI patterns** across steps:
   - Consistent `<StepHeader>` component (title + description).
   - Consistent "Test connection" button pattern: `testing` state + result banner (success shows detected version, failure shows error).
   - Extract `<StepActions>` for the Back/Next row.

5. **Tests**:
   - **Migration safety**: `frontend/src/pages/__tests__/SetupWizardPage.test.tsx` (already exists) must continue to pass. If any assertion changes, the PR description must call out which behavior changed and why.
   - **Unit** — one new test file per step under `frontend/src/pages/setup/steps/__tests__/`:
     - `AuthenticateStep.test.tsx` — valid token advances context; invalid shows error.
     - `OIDCStep.test.tsx` — fields validate, "Test connection" success/failure banners render, Next disabled until canContinue returns true.
     - `StorageStep.test.tsx` — backend-type switch swaps conditional fields; test connection flow.
     - `ScanningStep.test.tsx` — scanner selector, skip-for-now path, test connection flow.
     - `AdminUserStep.test.tsx` — password strength indicator, mismatch error, submit.
     - `ReviewStep.test.tsx` — summary reflects accumulated context data; Complete calls finalize endpoint.
   - **Unit** — `frontend/src/contexts/__tests__/SetupWizardContext.test.tsx`:
     - step navigation (`nextStep`, `prevStep`, `goToStep`);
     - `setStepData` merges correctly;
     - sessionStorage persistence round-trip (but token never persisted);
     - reset clears state + sessionStorage.
   - **E2E** — `e2e/tests/setup-wizard.spec.ts` (extend):
     - full happy-path traversal (existing);
     - **new**: refresh-mid-wizard recovers step position + non-token data;
     - **new**: browser back button returns to previous step without data loss;
     - **new**: abandon wizard clears state and redirects to login.
   - **Coverage target**: each new step ≥ 80% statements; `SetupWizardContext.tsx` ≥ 90%; combined wizard coverage exceeds the 1,112-line monolith's current coverage.

**Affected files**: `frontend/src/pages/SetupWizardPage.tsx` (rewrite), `frontend/src/pages/setup/` (new directory with per-step tests), `frontend/src/contexts/SetupWizardContext.tsx` (new), `frontend/src/contexts/__tests__/SetupWizardContext.test.tsx` (new), `frontend/src/pages/__tests__/SetupWizardPage.test.tsx` (update), `e2e/tests/setup-wizard.spec.ts` (extend)

**Acceptance criteria**: `SetupWizardPage.tsx` is under 200 lines. Each step is a standalone component with its own tests ≥ 80% statements. Refreshing the page mid-wizard preserves progress (except the token, which requires re-auth). All previously passing setup-wizard assertions still pass.

**Depends on**: Coordinate with `ROADMAP.md` item 2.1 (scanning step) so the two efforts don't conflict.

---

## Phase 2: Module Browsing & Consumption (Ease of Use 7→9, Features 8→9)

### 2.1 Dynamic Usage Example on Module Detail

**Why**: The Usage Example on the module detail page is a single static code block with no tool selector and no per-module input hints. Users must read the README, open the Inputs tab, and hand-assemble the block themselves.

**Current state**:

- `frontend/src/pages/ModuleDetailPage.tsx:323-346`: renders `getTerraformExample()` inside a `<pre>` with a single copy button.
- `useModuleDetail.ts` exposes `getTerraformExample()` which returns a plain `module "<name>" { source = "..."  version = "..." }` string.
- `moduleDocs` is fetched and rendered on the "Inputs / Outputs" tab but never used to populate the example.

**Work items**:

1. **Add tool selector** (radio or toggle group): `terraform` | `opentofu`. Both currently generate identical syntax, but the selector sets future-proofing for divergence and matches the binary mirror audience. Persist to `localStorage` under `preferredTool`.

2. **Compute required inputs** from `moduleDocs`:
   - Filter variables where `default === undefined` (required inputs).
   - For each, render a commented placeholder using the variable's type:
     - `string` → `"<value>"`
     - `number` → `0`
     - `bool` → `false`
     - `list(...)` → `[]`
     - `map(...)` / `object(...)` → `{}`

3. **Split into two code blocks with tabs**:
   - **"Source block"** (minimal): just `source` + `version`. Default tab — preserves today's behavior for users who know what they're doing.
   - **"With required inputs"**: source/version plus the commented-placeholder inputs. Clearly labeled "Required inputs (fill before applying)".

4. **Copy button behavior**:
   - Copies the currently active tab.
   - Announces via `aria-live` (see 4.1).

5. **Edge case**: if `moduleDocs` has no variables (uncommon but possible for no-input modules), hide the second tab and show only the source block.

6. **Tests**:
   - **Unit** — new `frontend/src/utils/__tests__/terraformExample.test.ts` (pure function, easy to cover thoroughly):
     - each variable type (`string`, `number`, `bool`, `list`, `map`, `object`, unknown) maps to its expected placeholder;
     - variables with non-undefined defaults are skipped;
     - empty module (no variables) returns source-only block;
     - tool selector `terraform` vs `opentofu` produces expected output (currently identical — golden-snapshot both so future divergence is caught).
   - **Unit** — extend `frontend/src/hooks/__tests__/useModuleDetail.test.ts`:
     - `getTerraformExample` with/without `moduleDocs` returns correct block.
   - **Unit** — new `frontend/src/pages/__tests__/ModuleDetailPage.test.tsx` (create if missing; at minimum cover the new usage-example block):
     - tab switch between "Source block" and "With required inputs" renders correct content;
     - copy button copies active tab, announces via Announcer (4.1);
     - tool selector persists to localStorage.
   - **E2E** — extend `e2e/tests/modules.spec.ts`:
     - open a seeded module with required inputs → switch to "With required inputs" tab → copy → assert clipboard contains `variable_name = "<value>"`.
   - **Coverage target**: `terraformExample.ts` ≥ 95% statements (pure function, trivial to fully cover). Branches for every type path.

**Affected files**: `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/hooks/useModuleDetail.ts`, `frontend/src/utils/terraformExample.ts` (new), `frontend/src/utils/__tests__/terraformExample.test.ts` (new), `frontend/src/hooks/__tests__/useModuleDetail.test.ts` (extend), `frontend/src/pages/__tests__/ModuleDetailPage.test.tsx` (new or extend), `e2e/tests/modules.spec.ts` (extend)

**Acceptance criteria**: A user browsing any module can copy a drop-in `module "..."` block including commented placeholders for every required input, without leaving the detail page. Every variable type has a test; coverage report shows `terraformExample.ts` ≥ 95%.

---

### 2.2 Skeleton loading states (replace `CircularProgress` collapses)

**Why**: `ModulesPage`, `ProvidersPage`, `ModuleDetailPage`, and most admin pages render a centered `CircularProgress` during load. This collapses layout (everything jumps on data arrival) and hides information architecture from users trying to anticipate content. `HomePage` already uses `Skeleton` correctly — propagate the pattern.

**Current state**:

- `frontend/src/pages/ModulesPage.tsx:324-327`, `ProvidersPage.tsx` (similar), `ModuleDetailPage.tsx:121-124`: centered `CircularProgress`.
- `HomePage.tsx:189, 266-267, 309-310`: uses `<Skeleton variant="text" />` and `<Skeleton variant="rounded" />` matching the final element sizes.

**Work items**:

1. **Create `components/skeletons/` directory**:
   - `RegistryItemCardSkeleton.tsx` — matches `RegistryItemCard` dimensions (title line, subtitle line, 3-line description clamp, chip row).
   - `ModuleDetailSkeleton.tsx` — matches header + usage-example + docs-tabs + sidebar layout.
   - `AdminTableSkeleton.tsx` — generic table row skeleton (used by Users, API Keys, Audit Logs, etc.).

2. **Replace `CircularProgress` fallbacks**:
   - `ModulesPage`: render a grid of 12 `RegistryItemCardSkeleton`s during initial load. On subsequent page/sort/filter changes, keep previous results visible with opacity 0.6 + a small `<LinearProgress />` at the top of the results (common pattern; React Query provides `isPlaceholderData` + `keepPreviousData`).
   - `ProvidersPage`: same pattern.
   - `ModuleDetailPage`: render `ModuleDetailSkeleton` (the full layout shell).
   - Admin list pages: render `AdminTableSkeleton` rows (after React Query migration in `ROADMAP.md` item 3.1, `placeholderData` integration becomes straightforward).

3. **Layout stability**: verify no layout shift between skeleton and real content by matching widths/heights exactly. Use Chrome DevTools "Rendering → Layout Shift Regions" during dev.

4. **Tests**:
   - **Unit** — new `frontend/src/components/skeletons/__tests__/`:
     - `RegistryItemCardSkeleton.test.tsx` — renders expected MUI Skeleton variants; matches reference dimensions.
     - `ModuleDetailSkeleton.test.tsx` — renders header + usage + sidebar skeleton blocks.
     - `AdminTableSkeleton.test.tsx` — renders N rows based on prop.
   - **Unit** — extend `frontend/src/pages/__tests__/ModulesPage.test.tsx`:
     - loading state renders 12 card skeletons (not a CircularProgress);
     - pagination transition keeps previous results visible with dimmed styling + LinearProgress;
     - final data arrives → skeletons removed, results visible.
   - **Unit** — extend `frontend/src/pages/__tests__/ProvidersPage.test.tsx` with same expectations.
   - **E2E** — `e2e/tests/modules.spec.ts` (extend): intercept `/api/v1/modules` with a 2s delayed response; assert skeletons visible during wait; assert no layout shift after data arrives (verify via comparing `boundingBox` of a stable element before/after).
   - **Coverage target**: each new skeleton component ≥ 90% statements (trivial). `ModulesPage.tsx` and `ProvidersPage.tsx` branch coverage improves by 2+ points due to new loading-state branch assertions.

**Affected files**: `frontend/src/components/skeletons/` (new), `frontend/src/components/skeletons/__tests__/` (new), `frontend/src/pages/ModulesPage.tsx`, `frontend/src/pages/ProvidersPage.tsx`, `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/pages/__tests__/ModulesPage.test.tsx` (extend), `frontend/src/pages/__tests__/ProvidersPage.test.tsx` (extend), `e2e/tests/modules.spec.ts` (extend)

**Acceptance criteria**: No page shows a centered spinner on initial load. Subsequent queries (pagination, filter changes) do not clear the results area; they dim existing results until new data arrives. Tests verify both initial-load and pagination-transition states.

---

### 2.3 Consolidate Module Detail header actions into a kebab menu

**Why**: The module header Stack at `ModuleDetailPage.tsx:252-317` mixes read-only chips (namespace, version selector, download count) with destructive admin actions (Delete Module, Deprecate Module, Undeprecate Module) and a Publish New Version button. On viewports below ~1200px these wrap into a visually chaotic row.

**Current state**:

- `ModuleDetailPage.tsx:252-317`: one `Stack direction="row" flexWrap="wrap"` containing 5+ chips/selects/buttons.
- Destructive actions are inline `outlined` buttons with no grouping.

**Work items**:

1. **Redesign the header row** (conceptual):
   - Title row (unchanged): back arrow + module name + "Publish New Version" button (primary action, stays visible).
   - Metadata row: namespace chip + version selector + download count chip + "⋮" (kebab menu).
   - Kebab menu contents (visible only when `canManage`):
     - "Edit description" (moves current inline edit affordance here).
     - Divider.
     - "Deprecate module" (or "Undeprecate" if already deprecated).
     - "Delete module" (red text, destructive styling).

2. **New component** `components/ModuleActionsMenu.tsx`:
   - Wraps MUI `IconButton` + `Menu`.
   - Receives `canManage`, `module`, and action callbacks.
   - Keyboard accessible (MUI handles this, but verify arrow-key navigation).

3. **Inline description edit**: keep the current inline pencil affordance as a secondary path, OR remove it in favor of the kebab item. Decision: keep inline pencil (low-friction for the most common admin action), but also expose via kebab for discoverability.

4. **Responsive behavior**:
   - Below `sm`: "Publish New Version" collapses into the kebab as a primary item.
   - At `md`+: "Publish" stays visible, kebab only contains secondary/destructive actions.

5. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/ModuleActionsMenu.test.tsx`:
     - non-admin (canManage=false) renders nothing (or only edit if that's scope-gated separately);
     - admin: menu opens on button click, all expected items present;
     - deprecated module shows "Undeprecate", non-deprecated shows "Deprecate";
     - "Delete module" item has destructive styling and calls its handler;
     - keyboard: Enter on trigger opens menu, ArrowDown cycles, Escape closes (MUI behavior but assert it integrates).
   - **Unit** — extend `frontend/src/pages/__tests__/ModuleDetailPage.test.tsx` (new or existing):
     - header renders on small viewport without overflow (check `Stack` flex wrapping or use `getComputedStyle` snapshot);
     - Publish button collapses into kebab at xs breakpoint.
   - **E2E** — new or extend `e2e/tests/modules.spec.ts`:
     - admin opens kebab → Delete Module → ConfirmDialog (from 4.4) appears → types path → confirms → module deleted → redirect to list.
   - **Coverage target**: `ModuleActionsMenu.tsx` ≥ 90% statements. `ModuleDetailPage.tsx` should gain branch coverage from responsive-breakpoint conditionals.

**Affected files**: `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/components/ModuleActionsMenu.tsx` (new), `frontend/src/components/__tests__/ModuleActionsMenu.test.tsx` (new), `frontend/src/pages/__tests__/ModuleDetailPage.test.tsx` (new/extend), `e2e/tests/modules.spec.ts` (extend)

**Acceptance criteria**: On any viewport ≥320px, the module detail header fits on at most two visible rows with no overflow. Destructive actions are grouped and not reachable by accidental tap on a nearby chip. Tests cover both admin-visible and non-admin-hidden states.

---

### 2.4 Version selector: filter deprecated versions by default

**Why**: Modules with many releases clutter the version dropdown with `[DEPRECATED]`-tagged entries. A user who wants to "just pick the latest stable" has to scan the full list.

**Current state**:

- `ModuleDetailPage.tsx:254-275`: `<Select>` lists all versions, deprecated ones get `color: text.disabled` + `[DEPRECATED]` suffix. No filter.

**Work items**:

1. **Add a `FormControlLabel` + `Switch` next to the selector**: "Show deprecated versions" (off by default).

2. **Filter logic**:
   - When off: hide deprecated versions unless the currently selected version is deprecated (in which case, keep it visible so the dropdown still reflects state).
   - When on: show all.

3. **Persist preference** to `localStorage` under `showDeprecatedVersions` (per-user, not per-module — power users want it on everywhere).

4. **Edge case**: if *all* versions are deprecated (entire module is end-of-life), ignore the filter and show everything with an informational banner: "All versions of this module are deprecated."

5. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/VersionSelector.test.tsx` (assuming extraction):
     - mixed-deprecation list: default state hides deprecated entries;
     - toggle flips, all entries visible;
     - currently-selected deprecated version remains visible even when filter is off;
     - all-deprecated edge case: filter ignored, banner rendered with correct text;
     - localStorage round-trip: mount → toggle on → unmount → remount → toggle still on.
   - **E2E** — extend `e2e/tests/modules.spec.ts`:
     - deprecate a seed version via API setup hook → visit module → version selector does not include deprecated entry → toggle switch → entry appears;
     - refresh → toggle state persists.
   - **Coverage target**: `VersionSelector.tsx` ≥ 90% statements; all 4 behavioral branches (filter on/off × selected deprecated/not) covered.

**Affected files**: `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/components/VersionSelector.tsx` (new via extraction), `frontend/src/components/__tests__/VersionSelector.test.tsx` (new), `e2e/tests/modules.spec.ts` (extend)

**Acceptance criteria**: Default view on any module hides deprecated versions. A persistent toggle restores the full list. All edge cases (selected-is-deprecated, all-deprecated) have tests.

---

### 2.5 Module Upload: reorder fields, add drag-and-drop

**Why**: `ModuleUploadPage.tsx:270-316` renders fields in this order: Namespace → Description (multiline) → Module Name → Provider → Version → File. The tall multiline Description in position 2 dominates the form before the user understands what they are naming. Also, the file input is a hidden `<input>` behind a button — no drag-and-drop, no file size display pre-upload, no .tar.gz validation feedback.

**Current state**:

- `frontend/src/pages/admin/ModuleUploadPage.tsx`:
  - Lines 270-316: field order as described.
  - Lines 319-337: file input wrapped in a label, no drop zone.
  - No client-side file size or type validation (backend enforces 100MB).

**Work items**:

1. **Reorder fields** to match the module address format users already see elsewhere (`namespace/name/provider`):
   - Namespace
   - Module Name
   - Provider
   - Version
   - File upload
   - Description (optional, last)

2. **Group identity fields** into a single `Stack direction="row"` on `md+` viewports: `[Namespace] / [Module Name] / [Provider]` renders inline with slash dividers, reinforcing the address format.

3. **Drag-and-drop file zone**:
   - Replace the current button with a bordered `<Box>` that accepts drop events.
   - Visual states: idle ("Drop .tar.gz here or click to browse"), drag-over (highlight), selected (filename + size + "Replace file" button).
   - Client-side validation:
     - Extension check: `.tar.gz` or `.tgz`. Reject with inline error.
     - Size check: warn at >50MB, hard-block at >100MB (matches backend limit).

4. **Progress during upload**:
   - Use `XMLHttpRequest` or `axios` with `onUploadProgress` to show an `<LinearProgress variant="determinate" value={percent} />`.
   - Disable all form fields during upload.
   - On success, navigate to the new module page (existing behavior).
   - On failure, preserve form state so the user can retry without re-entering fields.

5. **Extract shared "drop zone" component** `components/FileDropZone.tsx` — can be reused by `ProviderUploadPage` and future uploads.

6. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/FileDropZone.test.tsx`:
     - idle state renders prompt text;
     - simulated drag-enter event sets drag-over style;
     - drop with valid `.tar.gz` invokes `onFileSelected`;
     - drop with invalid extension shows inline error, does NOT invoke callback;
     - file >100MB blocked with error; 50–100MB shows warning;
     - click on zone triggers hidden file input (verify via ref or accessible label + userEvent);
     - replace-file button clears selection.
   - **Unit** — extend `frontend/src/pages/admin/__tests__/ModuleUploadPage.test.tsx`:
     - fields render in new order (assert DOM order via `getAllByRole('textbox')`);
     - progress bar visible during upload (mock axios `onUploadProgress`);
     - failed upload preserves field values (assert after simulated 500 response).
   - **Unit** — extend `frontend/src/pages/admin/__tests__/ProviderUploadPage.test.tsx` similarly once FileDropZone is shared.
   - **E2E** — extend `e2e/tests/upload.spec.ts`:
     - drag a fixture `.tar.gz` file from local disk onto the drop zone (`page.locator(...).dispatchEvent('drop', ...)` with `DataTransfer`);
     - fill fields, submit, verify progress bar, verify success redirect.
   - **Coverage target**: `FileDropZone.tsx` ≥ 90% statements, ≥ 85% branches (every validation branch covered). `ModuleUploadPage.tsx` must not regress.

**Affected files**: `frontend/src/pages/admin/ModuleUploadPage.tsx`, `frontend/src/pages/admin/ProviderUploadPage.tsx`, `frontend/src/components/FileDropZone.tsx` (new), `frontend/src/components/__tests__/FileDropZone.test.tsx` (new), `frontend/src/pages/admin/__tests__/ModuleUploadPage.test.tsx` (extend), `frontend/src/pages/admin/__tests__/ProviderUploadPage.test.tsx` (extend), `e2e/tests/upload.spec.ts` (extend)

**Acceptance criteria**: Upload form reads naturally top-to-bottom in the module-address order. Users can drag-and-drop archives. Upload progress is visible; failed uploads preserve form state. Every validation branch has a test.

---

## Phase 3: Navigation & Discoverability (Ease of Use 7→9)

### 3.1 Global Command Palette (Ctrl/Cmd+K)

**Why**: The app has 5 public routes + 16 admin routes + hundreds of modules/providers. Power users (the dominant audience for a self-hosted registry) benefit enormously from keyboard-driven navigation. Today the only way to jump between pages is clicking through the drawer or typing URLs.

**Current state**:

- No global keyboard shortcut infrastructure.
- Search is page-specific: `/modules` and `/providers` have their own search boxes; admin pages have their own filters or nothing.
- No `cmdk` or similar library in `package.json`.

**Work items**:

1. **Install `cmdk`** (`npm i cmdk`). Small (~5KB gzipped), well-maintained, accessibility-first.

2. **Create `components/CommandPalette.tsx`**:
   - Mounted in `Layout.tsx`.
   - Opened by `Cmd+K` / `Ctrl+K` (bind with a lightweight hook `useHotkey('mod+k', open)`).
   - Closed by `Escape` or clicking outside.

3. **Command sources** (each rendered as a grouped section):
   - **Navigation**: all public + admin routes (filtered by user scopes via `allowedScopes`). Each item: icon + label + route.
   - **Modules**: live search via `api.searchModules({ query, limit: 8 })`, debounced. Selecting navigates to `/modules/:ns/:name/:system`.
   - **Providers**: same pattern via `api.searchProviders`.
   - **Actions**: "Create API key", "Publish module", "Upload provider", "View audit logs" (all scope-gated).

4. **Keyboard shortcuts** within the palette:
   - Arrow keys navigate results.
   - `Enter` selects.
   - `Tab` cycles between sections (optional polish).
   - `Cmd+K` again closes.

5. **Visual affordance**: add a subtle `⌘K` hint button in the top AppBar next to the theme toggle. Clicking it opens the palette; hovering shows a tooltip "Quick navigation".

6. **Help Panel integration**: add a "Keyboard shortcuts" topic to `HelpContext` that lists `Cmd+K`, theme toggle, etc.

7. **Tests**:
   - **Unit** — new `frontend/src/hooks/__tests__/useHotkey.test.ts`:
     - fires callback on `mod+k` (both Cmd and Ctrl); ignores other keys; detaches listener on unmount; respects `preventDefault`.
   - **Unit** — new `frontend/src/components/__tests__/CommandPalette.test.tsx`:
     - closed by default; opens on Cmd+K; Escape closes;
     - navigation section filtered by `allowedScopes`; admin routes hidden for non-admin user;
     - typing debounces and calls `api.searchModules` + `api.searchProviders` (mocked);
     - arrow keys change highlighted item; Enter navigates via mocked `useNavigate`;
     - actions section entries gated by scope.
   - **Unit** — extend `frontend/src/components/__tests__/Layout.test.tsx`:
     - palette trigger button present in AppBar; click opens palette.
   - **E2E** — new `e2e/tests/command-palette.spec.ts`:
     - Cmd+K opens palette; type "users"; Enter navigates to `/admin/users`;
     - type a seeded module name; Enter navigates to module detail.
   - **Coverage target**: `CommandPalette.tsx` ≥ 80% statements; `useHotkey.ts` ≥ 95% (tiny).

**Affected files**: `frontend/src/components/CommandPalette.tsx` (new), `frontend/src/components/__tests__/CommandPalette.test.tsx` (new), `frontend/src/components/Layout.tsx`, `frontend/src/components/__tests__/Layout.test.tsx` (extend), `frontend/src/hooks/useHotkey.ts` (new), `frontend/src/hooks/__tests__/useHotkey.test.ts` (new), `frontend/package.json`, `e2e/tests/command-palette.spec.ts` (new)

**Acceptance criteria**: `Cmd+K` anywhere in the app opens a palette that can navigate to any accessible page or module/provider within 3 keystrokes. Scope-gating has dedicated tests.

---

### 3.2 Admin Breadcrumbs

**Why**: Public pages like Module Detail have breadcrumbs (`ModuleDetailPage.tsx:139-154`); admin pages have none. Deep flows (e.g., Organizations → member → role assignment, or Mirrors → config → history) leave users reliant on browser back.

**Current state**:

- No admin breadcrumb infrastructure. Each admin page renders its own `<Typography variant="h4">`.
- `react-router-dom` is already the routing library, which supports matched-route introspection.

**Work items**:

1. **Define route metadata** — extend each admin `<Route>` with a `handle` containing breadcrumb info:

   ```tsx
   <Route
     path="/admin/users"
     handle={{ breadcrumb: { label: 'Users', parent: '/admin' } }}
     element={...}
   />
   ```

2. **Create `components/AdminBreadcrumbs.tsx`**:
   - Uses `useMatches()` from `react-router-dom` to collect `handle.breadcrumb` entries.
   - Renders MUI `<Breadcrumbs>` with links for all but the current page.

3. **Mount breadcrumbs in the admin layout**:
   - Option A: create a dedicated `<AdminLayout>` route element that wraps all `/admin/*` routes and renders breadcrumbs above the `<Outlet>`.
   - Option B: mount `<AdminBreadcrumbs>` inline at the top of each admin page (more boilerplate but simpler to adopt incrementally).
   - Recommended: A. It also lets you add admin-wide affordances (e.g., a "Last updated" timestamp) later.

4. **Dynamic breadcrumbs** for detail pages (if/when admin detail pages are added, e.g., `/admin/users/:id`):
   - `handle.breadcrumb` can be a function that receives the loader data.
   - Example: `handle: { breadcrumb: (data) =>`User: ${data.user.email}`}`.

5. **Consistency with public pages**: migrate `ModuleDetailPage` and `ProviderDetailPage` breadcrumbs to the same pattern so there's one breadcrumb component project-wide.

6. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/AdminBreadcrumbs.test.tsx`:
     - renders chain from a mocked `useMatches` result;
     - current page renders as `Typography`, not link;
     - parent crumbs are clickable and navigate via mocked Router;
     - dynamic breadcrumb function receives loader data and returns expected label;
     - empty matches renders nothing (no crash).
   - **Unit** — if `<AdminLayout>` introduced, new `frontend/src/components/__tests__/AdminLayout.test.tsx`:
     - renders breadcrumbs + Outlet;
     - hides breadcrumbs when only root match (dashboard).
   - **Unit** — touch affected admin page tests to assert title rendering via breadcrumb (or remove duplicate h4 assertions if that markup is deleted).
   - **E2E** — new `e2e/tests/admin-navigation.spec.ts` (or extend `admin.spec.ts`):
     - visit 3 representative admin pages (Users, OIDC settings, Audit Log); verify breadcrumb text; click parent crumb to navigate.
   - **Coverage target**: `AdminBreadcrumbs.tsx` ≥ 90% statements.

**Affected files**: `frontend/src/App.tsx` (route metadata), `frontend/src/components/AdminBreadcrumbs.tsx` (new), `frontend/src/components/__tests__/AdminBreadcrumbs.test.tsx` (new), `frontend/src/components/AdminLayout.tsx` (new, optional), `frontend/src/components/__tests__/AdminLayout.test.tsx` (new if AdminLayout lands), all admin page components (remove duplicated h4 titles if breadcrumbs replace them visually), `e2e/tests/admin-navigation.spec.ts` (new) or `e2e/tests/admin.spec.ts` (extend)

**Acceptance criteria**: Every admin page shows a breadcrumb trail rooted at "Dashboard". Clicking any crumb navigates to that level. Tests cover static + dynamic breadcrumb cases.

---

### 3.3 Collapse admin nav groups by default on mobile

**Why**: `Layout.tsx:148-160` defaults all admin nav groups to open, storing state in `localStorage`. On a phone-sized drawer, this presents a ~15-item scrolling wall when admin users first open the menu.

**Current state**:

- `frontend/src/components/Layout.tsx:148-160`: `openGroups` defaults to all-open.
- `isMobile` (line 66) is available from `useMediaQuery`.

**Work items**:

1. **Initial state should depend on viewport**:

   ```ts
   const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
     const stored = (() => { try { return JSON.parse(localStorage.getItem('adminNavGroups') || 'null'); } catch { return null; } })();
     const defaultOpen = !isMobile; // collapse on mobile
     return Object.fromEntries(adminNavGroups.map(g => [g.key, stored?.[g.key] ?? defaultOpen]));
   });
   ```

2. **Active-group heuristic**: if the current URL matches a group's route prefix, expand that group regardless of default. Example: navigating to `/admin/audit-logs` auto-expands the "System" group.

3. **Mobile-specific interaction**: accordion behavior — opening a group closes others on mobile to keep the drawer short. Desktop behavior unchanged (multiple groups can be open).

4. **Tests**:
   - **Unit** — extend `frontend/src/components/__tests__/Layout.test.tsx`:
     - mock `useMediaQuery` to mobile → groups start collapsed;
     - mock desktop → groups start open (preserves current behavior);
     - current URL matches a group → that group auto-expands regardless of default;
     - mobile accordion: opening one group closes others; desktop leaves them independent;
     - localStorage override wins when present and viewport is desktop.
   - **E2E** — extend `e2e/tests/admin.spec.ts`:
     - `page.setViewportSize({ width: 390, height: 844 })` (mobile) → open drawer → assert only one group expanded;
     - navigate to `/admin/audit-logs` → drawer shows "System" group expanded.
   - **Coverage target**: `Layout.tsx` branch coverage should increase; assert the 4 new conditional branches are all exercised.

**Affected files**: `frontend/src/components/Layout.tsx`, `frontend/src/components/__tests__/Layout.test.tsx` (extend), `e2e/tests/admin.spec.ts` (extend)

**Acceptance criteria**: A mobile admin user lands on `/admin`, opens the drawer, and sees a compact list with only the active-context group expanded. Tests cover both viewport modes.

---

### 3.4 HomePage Quick Search: reorder toggle and field

**Why**: `HomePage.tsx:198-238` renders a large search field with the `Modules | Providers` toggle *below* it. Conventional patterns place type filters before or inside the input so users see scope before typing.

**Current state**:

- `HomePage.tsx:207-236`: `<TextField>` followed by a `<ToggleButtonGroup>` on a new row.

**Work items**:

1. **Move the toggle to the left of the input** (or make it a prefix adornment):
   - Option A (preferred): `<ToggleButtonGroup>` on the left, `<TextField>` filling the remaining space. Single row.
   - Option B: dropdown prefix adornment inside the TextField ("Modules ▾"). More compact, slightly harder to discover.

2. **Update placeholder based on toggle**: `"Search modules…"` vs `"Search providers…"` (already done — preserve).

3. **Submit behavior unchanged**: Enter / Search button navigates to `/modules?q=...` or `/providers?q=...`.

4. **Mobile**: on `xs`, stack vertically with toggle above (current behavior works here).

5. **Tests**:
   - **Unit** — extend `frontend/src/pages/__tests__/HomePage.test.tsx`:
     - toggle defaults to Modules; placeholder reads "Search modules…";
     - click Providers toggle; placeholder updates to "Search providers…";
     - Enter submits and navigates to the expected URL (`/modules?q=...` vs `/providers?q=...`) via mocked `useNavigate`;
     - on xs viewport (mock `useMediaQuery`), toggle renders above the input (assert DOM order).
   - **E2E** — extend `e2e/tests/home.spec.ts`:
     - type query → press Enter → land on `/modules?q=...`;
     - flip toggle → Enter → land on `/providers?q=...`.
   - **Coverage target**: `HomePage.tsx` branch coverage increases by 2+ points from the responsive layout conditional.

**Affected files**: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/__tests__/HomePage.test.tsx` (extend), `e2e/tests/home.spec.ts` (extend)

**Acceptance criteria**: A user reading left-to-right sees the search scope before the input, on desktop. Toggle-driven placeholder and submit behavior are asserted.

---

## Phase 4: Feedback, Accessibility & Edge Cases (Enterprise Readiness 7→9, Security 8→9)

### 4.1 Aria-live announcements for clipboard and toast feedback

**Why**: Today's copy buttons swap a Tooltip to "Copied!" visually. Screen-reader users receive no feedback. The setup wizard success/failure banners also lack `role="status"` announcements on dynamic change.

**Current state**:

- `HomePage.tsx:428`: Tooltip swaps to "Copied!" on click; no aria-live region.
- `ModuleDetailPage.tsx:327`: same pattern.
- Several places use MUI `<Alert>` but `<Alert>` doesn't automatically get `role="status"` unless inside a `<Snackbar>`.

**Work items**:

1. **Create `contexts/AnnouncerContext.tsx`**:
   - Provides `announce(message: string, priority?: 'polite' | 'assertive')`.
   - Mounts a `<div role="status" aria-live="polite">` and a `<div role="alert" aria-live="assertive">` in the DOM via `Layout.tsx`.
   - Implementation: on announce, set the text, clear it after 3 seconds so subsequent identical messages re-trigger SR readout.

2. **Wire copy handlers to announcer**:
   - `HomePage.handleCopyCredentials`: `announce('API key credentials copied to clipboard')`.
   - `ModuleDetailPage.handleCopySource`: `announce('Module source copied')`.
   - Any future copy handlers follow the same pattern.

3. **Replace ad-hoc success/error alerts with Snackbar+Announcer**:
   - For transient feedback (saved, deleted, copied), use MUI `<Snackbar>` auto-hide + announce.
   - For persistent errors (form validation), keep inline `<Alert>` but wrap dynamic ones in `role="status"`.

4. **Audit current `<Alert>` uses**: ensure all dynamically-added alerts (not render-time-conditional) trigger SR announcement.

5. **Tests**:
   - **Unit** — new `frontend/src/contexts/__tests__/AnnouncerContext.test.tsx`:
     - `announce('msg')` updates the polite live region;
     - `announce('urgent', 'assertive')` updates the assertive region;
     - text clears after 3s (fake timers);
     - duplicate consecutive messages still re-fire after a clear cycle;
     - nested provider usage throws explicit error (guardrail).
   - **Unit** — extend existing page tests (`HomePage.test.tsx`, `ModuleDetailPage.test.tsx`, etc.) to assert Announcer is called when copy handlers fire (spy on context method).
   - **E2E** — extend `e2e/tests/accessibility.spec.ts`:
     - perform a copy action; assert the live region's inner text contains "copied" at time of action and is empty 3s later;
     - axe-core scan on pages after dynamic actions (announcer mounted in Layout should not introduce violations).
   - **Coverage target**: `AnnouncerContext.tsx` ≥ 95% statements.

**Affected files**: `frontend/src/contexts/AnnouncerContext.tsx` (new), `frontend/src/contexts/__tests__/AnnouncerContext.test.tsx` (new), `frontend/src/components/Layout.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/ModuleDetailPage.tsx`, plus other copy/action handlers, `e2e/tests/accessibility.spec.ts` (extend)

**Acceptance criteria**: Every clipboard copy, destructive confirmation, and form-save produces an audible announcement for screen-reader users. Live-region content is asserted in unit and e2e tests.

**Coordinates with**: `ROADMAP.md` item 4.2 (Accessibility Audit) — this item addresses the dynamic-content half of a11y that passive audits tend to miss.

---

### 4.2 Session expiry warning and refresh

**Why**: JWTs are stored in localStorage with a fixed TTL. Users filling long forms (setup wizard, module upload, API key creation) can silently lose their session mid-task. The backend returns 401; the frontend redirects to `/login`, erasing form state.

**Current state**:

- `frontend/src/contexts/AuthContext.tsx`: has `refreshToken()` method.
- `frontend/src/services/api.ts`: 401 interceptor clears auth and redirects.
- No proactive token-expiry monitoring.
- No warning UX.

**Work items**:

1. **Parse token expiry on login** (and on any `setToken`):
   - Decode JWT (use `jwt-decode` package, 400 bytes gzipped) to extract `exp`.
   - Store `expiresAt: Date` in `AuthContext`.

2. **Schedule a warning** when 2 minutes remain:
   - Use `setTimeout(showWarning, expiresAt - 2min - now)`.
   - Clear timer on logout, refresh, or component unmount.

3. **Warning UX**: MUI `<Snackbar anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>` with `<Alert severity="warning">`:
   - Text: "Your session expires in 2 minutes. Refresh to stay signed in."
   - Actions: "Refresh session" (calls `refreshToken`), "Sign out".
   - Persists until acted on or session actually expires.

4. **After expiry**:
   - If user is mid-form (detect via `beforeunload` handler + persisted draft), show a modal: "Your session expired. Sign in again to continue — your draft has been saved." Offer "Sign in" which routes to `/login?return=/admin/upload/module`.
   - For idle tabs, the existing redirect is fine.

5. **Draft persistence for long forms** (separate but related):
   - `ModuleUploadPage`, `ProviderUploadPage`, `SetupWizardPage` (after 1.3): persist form values (not files) to `sessionStorage` on every change.
   - Clear on successful submit.

6. **Tests**:
   - **Unit** — extend `frontend/src/contexts/__tests__/AuthContext.test.tsx`:
     - on `setToken(jwt)`, `expiresAt` is parsed from `exp`;
     - schedules warning at `exp - 2min` (fake timers advance; assert warning handler called);
     - logout clears timers (no fire after unmount);
     - malformed JWT does not crash; falls back to no warning;
     - `refreshToken` reschedules warning with new expiry.
   - **Unit** — new `frontend/src/components/__tests__/SessionExpiryWarning.test.tsx`:
     - renders only when `expiresSoon` flag true in context;
     - "Refresh session" button calls `refreshToken`;
     - "Sign out" calls `logout` and routes to `/login`.
   - **Unit** — new `frontend/src/hooks/__tests__/useDraftPersistence.test.ts` (or similar) if a shared draft helper is extracted:
     - persists form values on change (debounced);
     - restores on mount;
     - clears on explicit reset.
   - **Unit** — extend `ModuleUploadPage.test.tsx`, `ProviderUploadPage.test.tsx`, `SetupWizardPage.test.tsx`: draft round-trip (mount with values in sessionStorage → form pre-populated).
   - **E2E** — new or extend `e2e/tests/auth.spec.ts`:
     - log in with a short-TTL token (dev-login variant or `page.evaluate` to swap in a crafted token); advance clock via `page.clock.fastForward`; assert warning Snackbar appears; click "Refresh session"; assert warning clears;
     - start module upload, fill fields, force logout; re-login; assert draft restored.
   - **Coverage target**: `SessionExpiryWarning.tsx` ≥ 90% statements; `AuthContext.tsx` branch coverage improves by 3+ points.

**Affected files**: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/__tests__/AuthContext.test.tsx` (extend), `frontend/src/components/SessionExpiryWarning.tsx` (new), `frontend/src/components/__tests__/SessionExpiryWarning.test.tsx` (new), `frontend/src/hooks/useDraftPersistence.ts` (new, optional), `frontend/src/hooks/__tests__/useDraftPersistence.test.ts` (new), `frontend/src/pages/admin/ModuleUploadPage.tsx`, `frontend/src/pages/admin/ProviderUploadPage.tsx`, `frontend/src/pages/SetupWizardPage.tsx`, `frontend/package.json`, `e2e/tests/auth.spec.ts` (extend)

**Acceptance criteria**: A user filling any form receives a warning at T-2min before their session expires and can refresh in place without losing their input. Expired sessions restore drafts after re-auth. Fake-timer tests prove the scheduling math.

---

### 4.3 Targeted empty states

**Why**: Empty states across the app are generic ("No modules found", "No results"). Each surface is an opportunity to guide the user to their next action. `ModulesPage.tsx:328-347` already does this reasonably ("Clear filters"); most admin pages do not.

**Current state**:

- `ModulesPage.tsx:328-347`: contextual empty state with "Clear filters" button.
- Admin pages (Users, API Keys, Mirrors, etc.) mostly render `"No X yet"` with no CTA.

**Work items**:

1. **Create `components/EmptyState.tsx`**:
   - Props: `icon`, `title`, `description`, `primaryAction?: { label, onClick, icon }`, `secondaryAction?: { label, onClick }`.
   - Consistent layout: centered, icon at 48px, title below, description below that, actions at the bottom.

2. **Inventory empty states** and define contextual copy + CTAs:
   - Modules (no results with filters): current behavior (`Clear filters`) — migrate to `EmptyState`.
   - Modules (no modules at all): "No modules published yet" + `Publish your first module` → `/admin/upload/module`.
   - Providers (similar pattern).
   - API Keys: "No API keys yet" + `Create API key` (primary) + `What are API keys?` (secondary, opens help panel topic).
   - Audit Logs: "No audit entries yet" + "Audit logs appear when users make changes. Try creating a module to see one."
   - SCM Providers: "No SCM providers configured" + `Add provider` → opens the add-provider dialog + link to docs.
   - Mirrors: similar.
   - Approvals: "Nothing to approve" + icon suggesting tranquility (checkmark).

3. **Help topic integration**: secondary "What is X?" actions should open the HelpPanel with the matching topic pre-loaded. Extends `HelpContext.openHelp(topic)`.

4. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/EmptyState.test.tsx`:
     - required props only → renders title + description, no action buttons;
     - primary action → button rendered, click invokes callback;
     - secondary action → renders as link/button with correct label;
     - icon prop renders custom icon; defaults to a stock icon when omitted.
   - **Unit** — extend each admin page test (`UsersPage.test.tsx`, `APIKeysPage.test.tsx`, `MirrorsPage.test.tsx`, `ApprovalsPage.test.tsx`, `AuditLogPage.test.tsx`, `OrganizationsPage.test.tsx`, `MirrorPoliciesPage.test.tsx`):
     - empty-list state renders `EmptyState` with expected title + CTA;
     - CTA click triggers the expected navigation or dialog open.
   - **Unit** — extend `HelpContext.test.tsx`:
     - `openHelp(topic)` with a new topic key opens the panel to the right topic.
   - **E2E** — extend `e2e/tests/admin.spec.ts`:
     - visit an admin page with no seed data; verify EmptyState CTA visible and clickable.
   - **Coverage target**: `EmptyState.tsx` ≥ 95% statements; no admin page coverage regression.

**Affected files**: `frontend/src/components/EmptyState.tsx` (new), `frontend/src/components/__tests__/EmptyState.test.tsx` (new), all admin pages, admin page test files (extend), `frontend/src/contexts/HelpContext.tsx`, `frontend/src/contexts/__tests__/HelpContext.test.tsx` (extend), `e2e/tests/admin.spec.ts` (extend)

**Acceptance criteria**: Every empty state offers a clear next action — either a primary CTA or a link to relevant help. Every admin page has a unit test asserting the empty-state CTA text and handler wiring.

---

### 4.4 Unified `ConfirmDialog` with type-to-confirm for irreversible actions

**Why**: `ModuleDetailPage.tsx:452-631` contains 5 nearly-identical `<Dialog>` blocks (Delete Module, Delete Version, Deprecate Version, Deprecate Module, Undeprecate Module). Each ~20 lines. Across the app, similar patterns appear in `UsersPage`, `APIKeysPage`, `MirrorsPage`, etc. Zero guardrails for truly irreversible ops like "Delete Module" (permanent deletion of all versions and files).

**Current state**:

- 5 inline dialogs in `ModuleDetailPage.tsx`, estimated 15+ similar across admin pages.
- No shared confirm component.
- "Delete Module" dialog is a plain "Are you sure?" with a Delete button — easy to muscle-memory-click through.

**Work items**:

1. **Create `components/ConfirmDialog.tsx`**:

   ```ts
   interface ConfirmDialogProps {
     open: boolean;
     onClose: () => void;
     onConfirm: () => void | Promise<void>;
     title: string;
     description: ReactNode;
     confirmLabel?: string;             // default "Confirm"
     cancelLabel?: string;              // default "Cancel"
     severity?: 'info' | 'warning' | 'error';  // default "info"
     typeToConfirmText?: string;        // if set, require user to type this string
     fields?: Array<{                   // optional extra inputs (e.g., deprecation message)
       id: string;
       label: string;
       multiline?: boolean;
       required?: boolean;
       placeholder?: string;
       helperText?: string;
     }>;
     onSubmit?: (values: Record<string, string>) => void | Promise<void>;  // called with field values if `fields` is set
     loading?: boolean;
   }
   ```

2. **Type-to-confirm for destructive ops**:
   - "Delete Module" → `typeToConfirmText = "${namespace}/${name}/${system}"`.
   - "Delete Version" → `typeToConfirmText = version`.
   - Deprecate (reversible) — no typing required.
   - Organization/user deletion — require typing email or org name.

3. **Visual cues**:
   - `severity: 'error'` → dialog title icon (MUI `WarningAmber`), confirm button red.
   - `severity: 'warning'` → yellow/amber.
   - Type-to-confirm input appears below the description with a live match indicator.

4. **Migrate all existing dialogs** to `ConfirmDialog`:
   - `ModuleDetailPage.tsx` — 5 dialogs → 5 invocations.
   - `UsersPage.tsx`, `APIKeysPage.tsx`, `OrganizationsPage.tsx`, `SCMProvidersPage.tsx`, `MirrorsPage.tsx`, etc. — every `<Dialog>` used for confirmation.

5. **Tests**:
   - **Unit** — new `frontend/src/components/__tests__/ConfirmDialog.test.tsx`:
     - renders title + description + default labels;
     - severity variants render correct icon + color (assert aria-attributes / data-testid rather than color values);
     - `typeToConfirmText` blocks submit: button disabled until input matches; enabled on match; case-sensitive match;
     - `fields` prop renders additional inputs; `onSubmit` receives all field values;
     - loading state disables all buttons and the type-to-confirm input;
     - onConfirm returning a Promise keeps loading state until resolved;
     - onConfirm rejection surfaces error inside dialog, does not close.
   - **Unit — migration safety**: for every migrated dialog site, the page's existing test assertions about destructive flow must continue to pass (may need selector updates for the new ConfirmDialog markup). Any assertion change must be reviewed for behavior drift.
   - **Unit** — extend `ModuleDetailPage.test.tsx`:
     - delete-module flow: type full path → confirm → calls `api.deleteModule`;
     - type incorrect path → submit blocked;
     - deprecate flow: no typing required; optional deprecation message field rendered.
   - **E2E** — extend `e2e/tests/modules.spec.ts`:
     - delete module: verify confirm button disabled until module path typed correctly;
     - deprecate module: reversible action does not require typing.
   - **E2E** — extend `e2e/tests/admin.spec.ts` to cover one representative user/org deletion with typed confirm.
   - **Coverage target**: `ConfirmDialog.tsx` ≥ 95% statements, ≥ 90% branches (it's small and central). Every migrated page gains coverage from at least the happy-path confirm flow.

**Affected files**: `frontend/src/components/ConfirmDialog.tsx` (new), `frontend/src/components/__tests__/ConfirmDialog.test.tsx` (new), `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/pages/__tests__/ModuleDetailPage.test.tsx` (extend), and ~10 admin pages + their test files (extend), `e2e/tests/modules.spec.ts` (extend), `e2e/tests/admin.spec.ts` (extend).

**Acceptance criteria**: All confirmation dialogs use `ConfirmDialog`. Irreversible actions require typing a matching identifier before submit. `ModuleDetailPage.tsx` drops from 638 lines to ~400. No confirmation flow regresses in existing tests.

---

## Summary: Score Impact Projection

| Category                 | Before | After | Key Drivers                                                                                           |
| ------------------------ | ------ | ----- | ----------------------------------------------------------------------------------------------------- |
| **Ease of Use**          | 7      | 9     | Actionable Getting Started (1.1), setup wizard split (1.3), command palette (3.1), empty states (4.3) |
| **Security**             | 8      | 9     | Type-to-confirm destructive ops (4.4), session expiry UX (4.2)                                        |
| **Enterprise Readiness** | 7      | 9     | Session management (4.2), a11y announcements (4.1), admin breadcrumbs (3.2), keyboard shortcuts (3.1) |
| **Feature Completeness** | 8      | 9     | Dynamic usage example (2.1), drag-and-drop upload (2.5), deprecated version filter (2.4)              |

---

## Dependency Graph

```text
Phase 1 (mostly independent):
  1.1 Getting Started snippet     ──── independent
  1.2 Symmetric login probing     ──── independent
  1.3 Setup wizard split          ──── coordinate with ROADMAP.md item 2.1

Phase 2 (mostly independent):
  2.1 Dynamic usage example       ──── independent
  2.2 Skeleton loading states     ──── benefits from ROADMAP.md item 3.1 (React Query)
  2.3 Module actions kebab        ──── independent
  2.4 Version filter toggle       ──── independent
  2.5 Upload reorder + DnD        ──── independent

Phase 3 (mostly independent):
  3.1 Command palette             ──── independent
  3.2 Admin breadcrumbs           ──── independent
  3.3 Mobile drawer collapse      ──── independent
  3.4 Home search layout          ──── independent

Phase 4:
  4.1 Aria-live announcer         ──── independent; coordinates with ROADMAP.md item 4.2
  4.2 Session expiry UX           ──── independent
  4.3 Empty states                ──── independent
  4.4 Unified ConfirmDialog       ──── independent; reduces LOC across many pages
```

---

## Suggested Sequencing (fastest-to-user-impact first)

| Order | Items                                                | Rationale                                             |
| ----- | ---------------------------------------------------- | ----------------------------------------------------- |
| 1     | 1.1, 1.2, 3.4, 4.1                                   | Hours each; visible to every user on first load       |
| 2     | 2.5, 4.4, 2.4, 3.3                                   | Low risk, high daily-use impact                       |
| 3     | 2.3, 2.2, 3.2                                        | Multi-file refactors; meaningful polish               |
| 4     | 2.1, 3.1, 4.3                                        | New capabilities requiring component design           |
| 5     | 1.3, 4.2                                             | Largest refactors; defer until lighter items land     |

---

## Acceptance criteria for the overall roadmap

- A first-time authenticated user can go from "/" to `terraform init` with a real API key in under 2 minutes without manual snippet editing.
- A screen-reader user receives announcement feedback for every clipboard copy, form save, and destructive confirmation.
- Every admin page supports keyboard navigation (Cmd+K palette + breadcrumbs + logical focus order).
- No destructive action can be completed without either typing a matching identifier or a multi-step workflow.
- `ModuleDetailPage.tsx` drops below 450 lines via ConfirmDialog extraction (4.4) and ModuleActionsMenu extraction (2.3).
- `SetupWizardPage.tsx` drops below 200 lines via step-component extraction (1.3).
- **Coverage**: all four Vitest metrics at or above the final-phase thresholds (55/50/50/55) with no regressions at any intermediate phase.

---

## Coverage Threshold Progression

Each phase lands with a coordinated `vitest.config.ts` threshold bump. Thresholds ratchet up only; if a phase's work misses the new floor, the threshold is not raised until remediation tests land. This prevents the "we'll backfill tests later" death spiral.

| Phase                | Statements | Branches | Functions | Lines | Rationale                                                                                       |
| -------------------- | ---------- | -------- | --------- | ----- | ----------------------------------------------------------------------------------------------- |
| Baseline (current)   | 42         | 37       | 36        | 43    | As of `vitest.config.ts` at time of writing.                                                    |
| After Phase 1        | 46         | 40       | 40        | 47    | New Auth/SetupWizard tests, QuickApiKeyDialog — small bump, weighted toward branches/functions. |
| After Phase 2        | 50         | 44       | 44        | 51    | FileDropZone + terraformExample + skeletons are highly testable; crosses the 50% line.          |
| After Phase 3        | 52         | 47       | 47        | 53    | Palette, hotkey hook, breadcrumbs — adds mostly focused units.                                  |
| After Phase 4 (goal) | **55**     | **50**   | **50**    | **55**| Announcer, EmptyState, ConfirmDialog, SessionExpiryWarning — shared components reused widely.   |

### Enforcement

1. After each phase's first merged item, update `frontend/vitest.config.ts` `thresholds` block to the next row. The bump must land in the **same PR** as the item that achieves it — this way CI guards against regressions from the next PR onwards.
2. CI job (`.github/workflows/ci.yml` or equivalent) runs `npm run test:coverage`; if any metric drops below threshold, the build fails. Threshold bumps are tested in-branch so CI is green at merge.
3. If an unrelated change somehow lowers coverage, the fix is to add tests, not to lower the threshold.
4. Every PR description posts the coverage summary diff (copy-paste from `text-summary` reporter). A simple delta table is acceptable.

### When coverage is the wrong metric

Coverage ≥ 50% is a floor, not a ceiling. Some files legitimately resist coverage-by-lines:

- **`main.tsx`, `setupTests.ts`, `vite-env.d.ts`, `*.d.ts`** — already excluded in `vitest.config.ts`. Keep them excluded.
- **Pure JSX composition components** with no logic (e.g., a header that renders a logo and a title) — a single "renders without crashing" test covers the line count; don't write behavior tests for behavior that doesn't exist.
- **Error-boundary fallbacks** that we deliberately never trigger in tests — render-only smoke test is enough.

When a file is genuinely untestable in a meaningful way, add it to the `exclude` list **in the same PR** with a one-line comment explaining why. Do not silently lower thresholds.

### Cross-referencing with `ROADMAP.md`

`ROADMAP.md` item 1.1 ("Testing & CI Foundation") owns the broader testing infrastructure (coverage reporting, a11y audits, visual regression). This roadmap's per-item tests feed into that infrastructure. Where there is overlap (e.g., a11y unit tests vs. `ROADMAP.md`'s a11y audit item), the UX-roadmap tests are the behavioral specs; the audit item is the backstop.
