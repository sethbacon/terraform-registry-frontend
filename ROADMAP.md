# Terraform Registry Frontend — Roadmap

**Baseline:** v0.7.0 (2026-04-17)
**Goal:** Close enterprise-adoption gaps identified in the 2026-04-17 independent evaluation; bring the UI to WCAG 2.1 AA, add enterprise identity UX, raise test quality, and remove external CDN dependencies.

UX-specific items continue to live in [`ROADMAP-UX.md`](ROADMAP-UX.md); this roadmap references that document but focuses on **engineering, security, testing, and enterprise-readiness** work.

---

## Cross-repo dependency summary

The following items require coordinated work with `terraform-registry-backend`:

| Frontend item                   | Backend item                     | Topic                |
| ------------------------------- | -------------------------------- | -------------------- |
| A1.1 (httpOnly cookie auth)     | B2.4 (OIDC refresh + CSRF)       | Auth token migration |
| A1.2 (Silent renew)             | B2.4 (OIDC refresh)              | Refresh flow         |
| B2.1 (SAML login picker)        | B2.1 (SAML connector)            | SAML login flow      |
| B2.2 (LDAP login form)          | B2.2 (LDAP connector)            | LDAP login flow      |
| B2.3 (SCIM admin page)          | B2.3 (SCIM endpoints)            | SCIM provisioning    |
| E4.1 (Deprecation banner)       | E4.1 (Module deprecation API)    | Module deprecation   |
| E4.2 (Policy results in upload) | E4.3 (OPA/Rego policy)           | Policy evaluation    |
| E4.3 (Test results UI)          | E4.4 (Module test orchestration) | Module test display  |
| E4.4 (Quota dashboard)          | D3.4 (Per-org quotas)            | Org quota management |
| E4.5 (OCI pull snippet)         | E4.2 (OCI endpoint)              | OCI distribution     |
| G5.1 (Whitelabel theme)         | New config endpoint              | Theme API            |
| H0.3 (Release workflow)         | H0.2 (Release workflow)          | CI/CD streamlining   |

---

## Legend

- **Size:** S (<1d), M (1–3d), L (1–2w), XL (>2w)
- **Priority:** P0 (adoption blocker), P1 (high), P2 (medium), P3 (nice-to-have)
- **Track:** A = Security · B = Enterprise identity UX · C = Accessibility · D = Telemetry / privacy · E = Feature UX (backend-dependent) · F = Air-gap / bundling · G = Whitelabel / theming · H = Developer experience · I = Internationalization

---

## Phase 0 — Quick wins (all parallel; target: 1 sprint)

### H0.1 · Add Prettier · [P0/S] ✅

- Install Prettier + `eslint-config-prettier`; create `.prettierrc`.
- Add `npm run format` + `npm run format:check`.
- CI step runs `format:check` (fail on diff).
- Bulk-format existing codebase in a single commit; update CONTRIBUTING.md.
- **Files:** `frontend/package.json`, `frontend/.prettierrc`, `frontend/eslint.config.js`, `CONTRIBUTING.md`, `.github/workflows/ci.yml`
- **AC:** CI fails on unformatted code; all existing files conform.

### H0.2 · Add browserslist · [P0/S] ✅

- `frontend/package.json`: add `"browserslist": ["defaults", "not IE 11", "not dead", "last 2 versions"]`.
- Update README "Browser Support" section.
- **Files:** `frontend/package.json`, `README.md`
- **AC:** Vite uses browserslist; declared in README.

### A0.1 · Pin Docker base-image digests · [P0/S] ✅

- `frontend/Dockerfile`: pin `node:22-alpine` and `nginx:1.25-alpine` to `@sha256:<digest>`.
- Add Dependabot entry for `docker` ecosystem.
- **Files:** `frontend/Dockerfile`, `.github/dependabot.yml`
- **AC:** Digests pinned; Dependabot config updated.

### E0.1 · Set coverage ratchet floor · [P0/S] ✅

- `vitest.config.ts`: thresholds set to current measured floor **55/49/47/56** (statements/branches/functions/lines).
- Thresholds ratchet upward as tests are added (see T-track below and E5.1).
- **Files:** `frontend/vitest.config.ts`
- **AC:** CI gate enforced; no drop below current floor; thresholds increase per T-track milestones.

### E0.2 · Remove `continue-on-error: true` on E2E · [P0/S] ✅

- `.github/workflows/ci.yml`: E2E required on `main`.
- Nightly full-matrix workflow stays separate with retries.
- **Files:** `.github/workflows/ci.yml`
- **AC:** `main` branch protection includes E2E.

### C0.1 · Declare WCAG 2.1 AA target · [P1/S] ✅

- Create `ACCESSIBILITY.md` stating conformance target + known exceptions.
- Link from README + SECURITY.md.
- **Files:** `ACCESSIBILITY.md`, `README.md`, `SECURITY.md`
- **AC:** Document merged; scope stated.

### C0.2 · Add skip-to-content link · [P1/S] ✅

- Add `<a href="#main-content" className="skip-link">` in `Layout.tsx`.
- Focus-visible styles.
- **Files:** `frontend/src/components/Layout.tsx`
- **AC:** Keyboard Tab from top of page reaches skip link; activates focus on main content.

### G0.1 · Update ARCHITECTURE.md with auth flow diagram · [P2/S] ✅

- Include OIDC/SAML/cookie flow; reference backend endpoints.
- **Files:** `ARCHITECTURE.md`
- **AC:** Diagram merged as Mermaid in markdown.

### D0.1 · Remove CDN dependency — bundle ReDoc locally · [P1/S] ✅

- Remove `cdn.jsdelivr.net` from CSP in `nginx.conf`.
- `npm i redoc` and import locally in `ApiDocumentation.tsx`.
- **Files:** `frontend/package.json`, `frontend/src/pages/ApiDocumentation.tsx`, `frontend/nginx.conf`
- **AC:** Air-gap install renders API docs with no external requests.

### U0.1 · Fix Command Palette (Ctrl+K) modal margins · [P1/S] ✅

- The search modal’s left and right margins are too tight at smaller viewport widths.
- `CommandPalette.tsx` uses `fullWidth` + `maxWidth="sm"` but items use only `px: 2` (16px) padding and the list has zero horizontal padding.
- Increase horizontal padding on the dialog content/paper and item list to provide comfortable breathing room (minimum 24px or `px: 3`).
- Verify at 360px, 768px, and 1280px viewports.
- **Files:** `frontend/src/components/CommandPalette.tsx`
- **AC:** Modal content has ≥24px left/right padding at all breakpoints; visual regression screenshot updated.
- **Source:** UAT

### U0.2 · Setup wizard: prompt to configure newly added features · [P1/M]

- **Problem (from UAT):** When new features are added to the setup wizard (e.g., security scanning), there is no way to know whether a feature has been configured at least once. Existing deployments that completed the wizard before a feature was added never see its configuration step.
- Add a `feature_flags` / `setup_features_completed` tracking mechanism:
  1. **Backend (↔):** New DB column or JSON field on the setup/config table tracking which wizard features have been completed (e.g., `{"oidc": true, "storage": true, "scanning": false, "admin_user": true}`).
  2. **Frontend:** On app load, compare the backend’s feature-completion map against the current wizard step list. If any feature is `false` or missing, surface a non-blocking banner/toast: _"New feature available: Security Scanning. [Configure now]"_ linking to the relevant admin page or a mini re-run of that wizard step.
  3. `SetupWizardContext` gains persistent state (not just transient `oidcSaved`/`storageSaved`/`scanningSaved` booleans).
- **Files:** `frontend/src/contexts/SetupWizardContext.tsx`, `frontend/src/components/Layout.tsx` (banner), `frontend/src/services/api.ts`, `frontend/src/types/index.ts`
- **AC:** After upgrading to a version with a new wizard step, admin sees a prompt; dismissing it persists `completed` for that feature; new installs see no extra prompts.
- **Source:** UAT
- **↔ Backend:** Requires new endpoint or field on `/api/v1/setup/status` to persist feature-completion flags.

### U0.3 · Storage page: allow creating new storage config inline for migration · [P1/M] ✅

- **Problem (from UAT):** The storage migration wizard allows selecting an existing storage config as the migration target, but there is no way to create a **new** storage configuration directly from the migration flow. Users must navigate away to create a config first, then return to start migration.
- Add an inline "Create new storage config" option within `StorageMigrationWizard.tsx`:
  1. "Migrate to" dropdown gains a "+ Create new configuration" entry at the bottom.
  2. Selecting it opens an inline form (or modal) matching the fields from the StoragePage create-config flow.
  3. On save, the new config is auto-selected as the migration target and the wizard continues.
- **Files:** `frontend/src/components/StorageMigrationWizard.tsx`, `frontend/src/pages/admin/StoragePage.tsx` (extract shared form component)
- **AC:** Admin can create a brand-new storage config and start migration in a single flow without leaving the page.
- **Source:** UAT

### U0.4 · Admin dashboard: add security scanning summary card · [P1/S] ✅

- **Problem (from UAT):** The admin dashboard shows scanning-enabled status and basic counts but scanning results are not prominent enough — users report no security scanning info visible.
- Enhance the scanning card on `DashboardPage.tsx`:
  1. Show severity breakdown (Critical / High / Medium / Low) aggregated across all scanned modules.
  2. Show last-scan timestamp and next-scheduled-scan time.
  3. Show top-3 modules with highest finding counts (link to their detail pages).
  4. If scanning is disabled, show a prominent "Enable Scanning" CTA.
- **↔ Backend:** May need a new `/api/v1/scanning/summary` endpoint returning aggregated severity counts and top-N modules. Check if existing endpoints already provide this data.
- **Files:** `frontend/src/pages/admin/DashboardPage.tsx`, `frontend/src/services/api.ts`
- **AC:** Dashboard renders severity breakdown, last scan time, and top-3 findings modules; E2E test covers card visibility.
- **Source:** UAT

### H0.3 · Streamline release workflow · [P1/M] ✅

- **Problem (from UAT):** Current release process (per `CLAUDE.md`) has high friction — merge conflicts on CHANGELOG / `package.json` version bumps when `prepare-release.yml` races against feature merges, redundant CI runs (full lint/test/build on release branch + again on tag), and frontend deployment-manifest updates live in the **backend** repo requiring cross-repo coordination.
- Evaluate and implement best-practice improvements:
  1. **Single-commit release:** `prepare-release.yml` should rebase the version-bump commit onto latest `main` atomically, not create a merge-conflict-prone PR.
  2. **Tag-triggered release:** Auto-tag on version-bump commit; `release.yml` triggers on `v*` push. Skip manual dispatch.
  3. **Skip redundant CI:** Release workflow reuses CI artifacts from the triggering commit (download-artifact or workflow_call passthrough).
  4. **Deployment manifest auto-PR:** Backend repo's `prepare-release.yml` bumps Helm `Chart.yaml` `appVersion` in its release commit. Post-release job in backend `release.yml` opens a cross-repo PR bumping frontend image tag. Kustomize overlays keep `<IMAGE_TAG>` placeholders (substituted by per-environment CD pipelines).
  5. **Document** the streamlined flow in `CLAUDE.md` and `CONTRIBUTING.md`.
- **Files:** `.github/workflows/prepare-release.yml`, `.github/workflows/release.yml`, `.github/workflows/auto-tag.yml`, `CLAUDE.md`, `CONTRIBUTING.md`
- **AC:** Release requires ≤1 manual step; no merge conflicts on CHANGELOG; deployment manifests auto-updated via cross-repo PR.
- **Source:** UAT
- **↔ Backend H0.2:** Coordinate shared deployment-manifest update strategy.

#### U0.5 · Binary detail — link to version changelog · [P2/S] ✅

- **Source:** UAT
- **Priority:** Low — cosmetic/UX improvement.
- **Problem (from UAT):** The Terraform binary detail page shows available versions and platforms but provides no link to the upstream changelog for a given version. Users must manually search HashiCorp's releases page to understand what changed.
- **Proposal:** On the binary version detail view, add a "Changelog" or "Release notes" link that opens the upstream release page (e.g., `https://github.com/hashicorp/terraform/releases/tag/v{version}`). If the binary is a mirrored tool with a known upstream, derive the URL from the tool name + version; otherwise hide the link.
- **Files:** Binary detail page component (likely `TerraformBinaryDetail.tsx` or similar), possibly `api.ts` if upstream URL metadata needs fetching.
- **AC:** Each binary version row/card includes a clickable changelog link when an upstream URL is derivable; link opens in a new tab.

---

## Phase 0.5 — Test coverage ramp (prerequisite for 0.8.0 release)

Current coverage: **65/62/53/67** (statements/branches/functions/lines).
Target for 0.8.0: **70/60/60/70** — matching the original E0.1 goal.

Items are ordered by coverage-per-effort; each raises the ratchet floor in `vitest.config.ts` on merge.

### Track T — Unit test coverage

#### T0.1 · Services layer tests · [P0/M] ✅

- Test `api.ts` (remaining uncovered branches), `errorReporting.ts`, `performanceReporting.ts`, `queryKeys.ts`.
- Mock Axios, window globals, and performance APIs.
- **Target delta:** statements +5%, functions +5%.
- **Files:** `frontend/src/services/__tests__/api.test.ts`, `frontend/src/services/__tests__/errorReporting.test.ts`, `frontend/src/services/__tests__/performanceReporting.test.ts`
- **AC:** Service layer ≥90% line coverage; ratchet raised to **60/54/52/61**.

#### T0.2 · Admin page tests (high-value, low-coverage) · [P0/L] ✅

- Pages with <35% coverage: `UsersPage`, `StoragePage`, `MirrorsPage`, `AuditLogPage`, `OIDCSettingsPage`, `OrganizationsPage`, `APIKeysPage`, `SecurityScanningPage`, `RolesPage`.
- Use `msw` (Mock Service Worker) for API mocking; test CRUD flows, error states, loading states.
- **Target delta:** statements +8%, branches +6%.
- **Files:** `frontend/src/pages/admin/__tests__/*.test.tsx`
- **AC:** Each listed page ≥60% line coverage; ratchet raised to **65/58/56/65**.

#### T0.3 · Hooks and contexts tests · [P0/M] ✅

- `AuthContext`, `ThemeContext`, `AnnouncerContext`, `SetupWizardContext`.
- `useHotkey` and any other custom hooks.
- **Target delta:** functions +4%.
- **Files:** `frontend/src/contexts/__tests__/*.test.tsx`, `frontend/src/hooks/__tests__/*.test.ts`
- **AC:** All contexts and hooks ≥85% line coverage; ratchet raised to **67/59/60/67**.

#### T0.4 · Remaining component + page tests · [P1/M]

- Fill gaps in `DashboardPage`, `ModuleDetailPage`, `ProviderDetailPage`, `LoginPage`, `CallbackPage`.
- Cover `StorageMigrationWizard`, `PublishFromSCMWizard`, setup wizard steps.
- **Target delta:** statements +3%, branches +2%.
- **Files:** `frontend/src/pages/__tests__/*.test.tsx`, `frontend/src/components/__tests__/*.test.tsx`
- **AC:** All pages ≥50% line coverage; ratchet reaches **70/60/60/70**.

#### T0.5 · Types and utilities 100% · [P2/S] ✅

- Cover `src/types/index.ts`, `src/utils/index.ts`, `src/types/scm.ts`, `src/types/terraform_mirror.ts`.
- **Files:** `frontend/src/types/__tests__/*.test.ts`, `frontend/src/utils/__tests__/*.test.ts`
- **AC:** Types/utils at 100%; no further ratchet change expected (small files).

---

## Phase 1 — Security hardening (parallel tracks)

### Track A — Security

#### A1.1 · httpOnly cookie auth + CSRF token · [P0/L]

- **↔ Backend B2.4:** Coordinate refresh-token endpoint and `Set-Cookie` response.
- Remove `localStorage.setItem('auth_token', ...)` in `AuthContext.tsx`, `services/api.ts`, and all related consumers.
- Backend sets `auth_token` as `HttpOnly; Secure; SameSite=Strict` cookie.
- Add double-submit CSRF pattern: non-HttpOnly `csrf` cookie + `X-CSRF-Token` header on mutating requests.
- Axios: enable `withCredentials: true`.
- Keep minimal user info in localStorage (role template, allowed_scopes) for UI gating — no secrets.
- **Files:** `frontend/src/contexts/AuthContext.tsx`, `frontend/src/services/api.ts`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/CallbackPage.tsx`
- **AC:** No `auth_token` visible in browser DevTools Storage; CSRF token verified on POST/PUT/DELETE; e2e login still passes.

#### A1.2 · Automatic silent renew · [P1/M]

- **↔ Backend B2.4:** Uses `/auth/refresh` endpoint.
- Replace proactive `SessionExpiryWarning` approach with silent refresh ~2min before expiry.
- Warning dialog retained as fallback if refresh fails.
- **Files:** `frontend/src/contexts/AuthContext.tsx`, `frontend/src/components/SessionExpiryWarning.tsx`
- **AC:** Sessions extend transparently during active use; warning fires only on failure.

#### A1.3 · CSP nonces (remove `'unsafe-inline'` for styles) · [P1/M] ✅

- nginx config injects per-request nonce into `index.html` via `sub_filter`.
- Vite plugin or runtime patch to add nonce to style/script tags.
- MUI/Emotion: configure Emotion cache with `nonce` prop.
- **Files:** `frontend/nginx.conf`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/vite.config.ts`
- **AC:** CSP report-only for 1 release; then enforced; `'unsafe-inline'` removed from style-src.

#### A1.4 · Subresource Integrity for any remaining CDN assets · [P1/M]

- If any external asset remains post-D0.1, add SRI hashes.
- **Files:** `frontend/index.html`
- **AC:** Verified via SRI scanner.

#### A1.5 · Dependabot security-only auto-merge · [P2/S] ✅

- Dependabot security PRs auto-merge on passing CI (restricted to patch-level bumps).
- **Files:** `.github/workflows/dependabot-automerge.yml`
- **AC:** Workflow active.

### Track F — Air-gap / bundling

#### F1.1 · Vendor ReDoc locally · [P1/S]

- Full implementation of D0.1 if not already done.
- **Files:** `frontend/package.json`, `frontend/src/pages/ApiDocumentation.tsx`
- **AC:** No `jsdelivr` references in codebase.

#### F1.2 · Offline markdown sanitization audit · [P2/M]

- Audit `rehype-sanitize` + `remark-gfm` for any network calls; confirm fully offline.
- **Files:** `frontend/src/components/MarkdownRenderer.tsx`
- **AC:** Network inspector shows zero requests during module detail render.

---

## Phase 2 — Enterprise identity UX (↔ backend Track B)

### Track B — Identity UX

#### B2.1 · SAML login provider picker · [P0/L]

- **↔ Backend B2.1:** Consume `/auth/providers` listing SAML IdPs.
- Login page renders SAML buttons per configured IdP.
- SP-initiated flow: redirect to `/auth/saml/:idp/init`.
- Handle IdP-initiated ACS landing.
- **Files:** `frontend/src/pages/LoginPage.tsx`, `frontend/src/services/api.ts`, `frontend/src/types/index.ts`
- **AC:** E2E test logs in via Okta SAML and Entra SAML.

#### B2.2 · LDAP login form · [P0/M]

- **↔ Backend B2.2:** POST `/auth/ldap/login` with username + password.
- Form respects Caps-Lock warning, password reveal toggle, rate-limit UX (429 → "Too many attempts" message).
- **Files:** `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/LDAPLoginForm.tsx`
- **AC:** E2E test logs in against OpenLDAP.

#### B2.3 · SCIM provisioning admin page · [P0/L]

- **↔ Backend B2.3:** New admin page `pages/admin/SCIMProvisioningPage.tsx`.
- Token management (create / rotate / revoke), per-IdP config, last-sync status, provisioning event log.
- Route: `/admin/scim` requiring scope `admin`.
- **Files:** `frontend/src/pages/admin/SCIMProvisioningPage.tsx`, `frontend/src/App.tsx`, `frontend/src/services/api.ts`
- **AC:** Admin can generate SCIM token and copy-to-clipboard; Okta completes user sync.

#### B2.4 · IdP group → role mapping UI enhancements · [P1/M]

- Extend `OIDCSettingsPage` to cover SAML + LDAP group claims.
- Preview: "Given group `X`, resulting scopes = `[…]`".
- **Files:** `frontend/src/pages/admin/OIDCSettingsPage.tsx`
- **AC:** Mapping saved, applied on next login; E2E verified.

#### B2.5 · Per-org IdP binding UI · [P1/M]

- **↔ Backend B2.1:** Optional per-org IdP.
- Organization page gains "Identity Provider" tab.
- **Files:** `frontend/src/pages/admin/OrganizationsPage.tsx`
- **AC:** Org-scoped login routes enforce the bound IdP.

#### B2.6 · mTLS client auth docs in UI · [P2/M]

- Admin page surfaces per-principal cert-subject mappings (read-only display + CRUD).
- **Files:** `frontend/src/pages/admin/MTLSPage.tsx`, `frontend/src/App.tsx`
- **AC:** Mapping CRUD operational.

---

## Phase 3 — Accessibility + telemetry / privacy (parallel tracks)

### Track C — Accessibility (WCAG 2.1 AA)

#### C3.1 · Full WCAG 2.1 AA audit + remediation · [P0/L]

- Automated pass (axe on every page in E2E).
- Manual pass: screen reader (NVDA + VoiceOver), keyboard-only, high-contrast, 200% zoom.
- Track violations as issues tagged `a11y`.
- Raise e2e policy from "≤5 serious" to "0 serious, 0 critical".
- **Files:** `e2e/tests/accessibility.spec.ts`, `ACCESSIBILITY.md`
- **AC:** `ACCESSIBILITY.md` updated with conformance report.

#### C3.2 · jsx-a11y: warn → error · [P1/M]

- Flip eslint severity from `warn` to `error`; fix all violations.
- Add `eslint-plugin-jsx-a11y/recommended` fully.
- **Files:** `frontend/eslint.config.js`, affected component files
- **AC:** CI lint passes with zero jsx-a11y warnings.

#### C3.3 · Focus management in SPA routes · [P1/M]

- On route change, move focus to main heading; announce page title via `AnnouncerContext`.
- **Files:** `frontend/src/App.tsx`, `frontend/src/contexts/AnnouncerContext.tsx`
- **AC:** Manual screen-reader test verified; E2E assertion added.

#### C3.4 · Reduced-motion support · [P1/M]

- `prefers-reduced-motion` media query disables transitions.
- MUI theme transitions conditional.
- **Files:** `frontend/src/contexts/ThemeContext.tsx`
- **AC:** Verified in DevTools emulation.

#### C3.5 · Color-contrast audit of theme tokens · [P2/M]

- All text/background pairs ≥ 4.5:1 (normal) / 3:1 (large).
- Fix or document exceptions for dark theme secondary color.
- **Files:** `frontend/src/contexts/ThemeContext.tsx`, `ACCESSIBILITY.md`
- **AC:** Audit doc published.

### Track D — Telemetry / privacy

#### D3.1 · User-facing telemetry opt-out · [P0/M]

- New user settings page `pages/SettingsPage.tsx` with toggles:
  - Error reporting
  - Performance reporting
  - Anonymous usage analytics
- Default: **opt-in required** (GDPR-safe default).
- Consent banner on first visit.
- Stored client-side + echoed to server for audit.
- **Files:** `frontend/src/pages/SettingsPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/ConsentBanner.tsx`, `frontend/src/services/api.ts`
- **AC:** Opt-out disables Sentry + performance + anonymous reporting globally; E2E verified.

#### D3.2 · Cookie banner + preference center · [P1/M]

- Only required if analytics cookies introduced; currently minimal.
- If telemetry DSNs set, show banner.
- **Files:** `frontend/src/components/ConsentBanner.tsx`
- **AC:** Banner conforms to ePrivacy/GDPR.

#### D3.3 · Privacy policy + data handling doc · [P2/S]

- `PRIVACY.md` describing what's collected, retention, opt-out.
- Linked from footer.
- **Files:** `PRIVACY.md`, `frontend/src/components/Layout.tsx`
- **AC:** Merged.

---

## Phase 4 — Feature surface for new backend capabilities (↔ backend Tracks D/E/F)

### Track E — Feature UX

#### E4.1 · Module deprecation banner + admin toggle · [P0/M]

- **↔ Backend E4.1:** Consume `deprecation` block from module metadata.
- On `ModuleDetailPage`, render `<Alert severity="warning">` with deprecation reason + replacement link.
- Admin "Manage Versions" section exposes deprecation toggle + replacement_source.
- **Files:** `frontend/src/pages/ModuleDetailPage.tsx`, `frontend/src/pages/admin/ModuleUploadPage.tsx`, `frontend/src/types/index.ts`
- **AC:** E2E: deprecated version shows banner; non-deprecated does not.

#### E4.2 · Policy evaluation results in upload flow · [P1/M]

- **↔ Backend E4.3:** Consume policy evaluation response from upload API.
- Upload page displays policy check results; blocks submit on `deny`.
- Violation details expandable.
- **Files:** `frontend/src/pages/admin/ModuleUploadPage.tsx`, `frontend/src/components/PolicyResultsPanel.tsx`
- **AC:** E2E: upload violating policy fails with clear error surface.

#### E4.3 · Module test results UI · [P1/M]

- **↔ Backend E4.4:** Consume test results from version metadata.
- Version detail panel shows pass/fail per declared example; logs expandable.
- **Files:** `frontend/src/components/VersionDetailsPanel.tsx`, `frontend/src/components/TestResultsPanel.tsx`
- **AC:** Module with failing example shows red status.

#### E4.4 · Per-org quota dashboard · [P2/M]

- **↔ Backend D3.4:** Consume quota + usage API.
- Extend admin dashboard with quota usage charts (bar/gauge).
- **Files:** `frontend/src/pages/admin/DashboardPage.tsx`, `frontend/src/components/QuotaUsageChart.tsx`
- **AC:** Real-time usage renders from dedicated API endpoint.

#### E4.5 · OCI distribution affordances · [P2/M]

- **↔ Backend E4.2:** Detect OCI support from backend capabilities endpoint.
- Module detail page adds "Pull via OCI" snippet alongside Terraform snippet.
- **Files:** `frontend/src/components/UsageExample.tsx`
- **AC:** Snippet copy works; shows only when OCI endpoint available.

---

## Phase 5 — UX polish: whitelabel + internationalization

### Track G — Whitelabel / theming

#### G5.1 · Whitelabel theme system · [P0/L]

- **↔ Backend:** New config-driven `/api/v1/ui/theme` endpoint returning theme tokens.
- Extract theme tokens into JSON consumed at runtime.
- Support: primary color, secondary color, logo URL, product name, favicon, login-page hero image.
- CSS custom properties for easy override.
- Per-tenant theme optional (deferred).
- **Files:** `frontend/src/contexts/ThemeContext.tsx`, `frontend/src/services/api.ts`, `frontend/src/components/Layout.tsx`, `frontend/src/components/AboutModal.tsx`
- **AC:** Deploy-time env var or backend config changes branding without rebuild.

#### G5.2 · Custom logo + product name · [P1/M]

- Subset of G5.1 if phased.
- **Files:** `frontend/src/components/Layout.tsx`, `frontend/src/components/AboutModal.tsx`
- **AC:** Logo in sidebar + AboutModal swappable via theme config.

### Track I — Internationalization

#### I5.1 · Introduce `react-i18next` · [P1/L]

- Wrap app with `I18nextProvider`; extract all user-visible strings into translation keys.
- Language detector (browser preference + user setting).
- Initial locales: `en` (reference) + `es`, `fr`, `de`, `ja` (machine-translated baseline flagged for review).
- Language switcher in header/footer.
- Dates/numbers via `Intl`.
- **Files:** `frontend/package.json`, `frontend/src/i18n.ts`, `frontend/src/locales/<lang>/*.json`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, all page/component files (string extraction)
- **AC:** E2E passes in at least two locales; strings externalized.

#### I5.2 · RTL support · [P2/M]

- Configure MUI RTL; verify on `ar`/`he` pseudo-locale.
- **Files:** `frontend/src/contexts/ThemeContext.tsx`
- **AC:** Smoke test in RTL mode.

#### I5.3 · Translation contribution workflow · [P3/M]

- Integrate with Crowdin or similar; document in CONTRIBUTING.md.
- **Files:** `CONTRIBUTING.md`, `.github/workflows/crowdin.yml`
- **AC:** External contributor can propose translations.

---

## Cross-cutting: test quality

### E5.1 · Raise coverage floor to 80% by v1.0.0 · [P1/M]

- Phase 0.5 (T-track) reaches 70/60/60/70 for v0.8.0.
- Incremental 70 → 75 → 80 across 0.8 → 0.9 → 1.0:
  - **v0.8.0:** 70/60/60/70 (T0.1–T0.4 complete)
  - **v0.9.0:** 75/65/65/75 (new features ship with tests; ratchet on merge)
  - **v1.0.0:** 80/70/70/80 (remaining gaps + visual component tests)
- **Files:** `frontend/vitest.config.ts`
- **AC:** Each milestone release meets its threshold; CHANGELOG tracks ratchet bumps.

### E5.2 · E2E matrix: Chromium + Firefox + WebKit on main · [P1/M]

- Currently Chromium local, Firefox CI. Add WebKit to CI.
- **Files:** `e2e/playwright.config.ts`, `.github/workflows/e2e.yml`
- **AC:** Playwright project `webkit` included in CI pipeline.

### E5.3 · Visual regression tests · [P2/M]

- Playwright screenshot diffs on key pages (home, module detail, admin dashboard, login).
- **Files:** `e2e/tests/visual-regression.spec.ts`, `e2e/screenshots/` (baselines)
- **AC:** Baseline committed; diffs flagged in PR.

### E5.4 · Contract tests against backend Swagger · [P2/M]

- Generate TypeScript client from `swagger.json`; type-check API usage at build time.
- **Files:** `frontend/scripts/generate-api-client.sh`, `frontend/src/services/generated/`, `frontend/tsconfig.json`
- **AC:** Build fails if backend removes an endpoint the frontend uses.

---

## Milestones

| Version    | Target content                                                                          |
| ---------- | --------------------------------------------------------------------------------------- |
| **0.8.0**  | Phase 0 + Phase 0.5 (T-track: coverage ≥70/60/60/70) + Phase 1 Track A items A1.1, A1.2 |
| **0.9.0**  | Phase 2 (SAML / LDAP / SCIM UX)                                                         |
| **0.10.0** | Phase 3 (WCAG 2.1 AA + telemetry opt-out)                                               |
| **0.11.0** | Phase 4 (feature surface for new backend capabilities)                                  |
| **1.0.0**  | Phase 5 (whitelabel + i18n baseline); all P0/P1 closed                                  |

---

## Scope boundaries

**Included:** React SPA, nginx container, Playwright E2E, build/CI under this repo.

**Explicitly excluded:** Backend server changes (see `terraform-registry-backend/ROADMAP.md`); see [`ROADMAP-UX.md`](ROADMAP-UX.md) for non-enterprise UX polish not listed here.

---

## How to contribute to this roadmap

1. Pick an item by ID (e.g., `B2.1`).
2. Open an issue titled `[roadmap:B2.1] <short title>`.
3. Submit PR referencing the issue.
4. Cross-repo items (`↔`) must coordinate via linked issues to `terraform-registry-backend`.
