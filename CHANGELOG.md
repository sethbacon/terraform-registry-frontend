<!-- markdownlint-disable MD013 MD024 MD041 -->
# Changelog

## [1.1.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.3...v1.1.0) (2026-05-07)


### Features

* add scan status filtering with pagination and namespace editing ([#271](https://github.com/sethbacon/terraform-registry-frontend/issues/271)) ([78f779d](https://github.com/sethbacon/terraform-registry-frontend/commit/78f779d7deae020ebdfdae3b05a0664caaaea3e3))


### Bug Fixes

* **tests:** update getScanningStats test to match new params signature ([#274](https://github.com/sethbacon/terraform-registry-frontend/issues/274)) ([133b2f9](https://github.com/sethbacon/terraform-registry-frontend/commit/133b2f914af0947aa607e0cd122c1b113dd1ae96))

## [1.0.3](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.2...v1.0.3) (2026-05-05)


### Bug Fixes

* stable provider version sorts before pre-release in detail page ([#263](https://github.com/sethbacon/terraform-registry-frontend/issues/263)) ([c3bd3ac](https://github.com/sethbacon/terraform-registry-frontend/commit/c3bd3ac6a297e129d2ff58ba3d3542ff3a6d0f4f)), closes [#262](https://github.com/sethbacon/terraform-registry-frontend/issues/262)

## [1.0.2](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.1...v1.0.2) (2026-05-04)


### Bug Fixes

* **users:** use inline memberships from list response to eliminate N+1 requests ([#260](https://github.com/sethbacon/terraform-registry-frontend/issues/260)) ([22e2ed3](https://github.com/sethbacon/terraform-registry-frontend/commit/22e2ed3016cb2de61598454c81256e78100b919a)), closes [#259](https://github.com/sethbacon/terraform-registry-frontend/issues/259)

## [1.0.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.0...v1.0.1) (2026-04-30)


### Bug Fixes

* add CSV export to scanning findings modal ([#256](https://github.com/sethbacon/terraform-registry-frontend/issues/256)) ([8202642](https://github.com/sethbacon/terraform-registry-frontend/commit/8202642bbc9a3e3a07755fd8cd52698e5e0fa7dc))
* correct sort field names sent to backend for newest/recently-updated ([#254](https://github.com/sethbacon/terraform-registry-frontend/issues/254)) ([7cd75d6](https://github.com/sethbacon/terraform-registry-frontend/commit/7cd75d6a3f8a07de57f91f1a2fa2b0dd1a957892))
* replace free-text platform filter with structured os/arch multi-select ([#257](https://github.com/sethbacon/terraform-registry-frontend/issues/257)) ([22b5959](https://github.com/sethbacon/terraform-registry-frontend/commit/22b595989cc4b2eeecf8bcc678a07c40013c6a98))
* widen module detail page to match provider detail width ([#255](https://github.com/sethbacon/terraform-registry-frontend/issues/255)) ([de56600](https://github.com/sethbacon/terraform-registry-frontend/commit/de56600280f818e6cb665b64440876a06a79e883)), closes [#252](https://github.com/sethbacon/terraform-registry-frontend/issues/252)

## [1.0.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.17.0...v1.0.0) (2026-04-29)


### Documentation

* 1.0.0 release prep (Release-As: 1.0.0) ([#247](https://github.com/sethbacon/terraform-registry-frontend/issues/247)) ([2451166](https://github.com/sethbacon/terraform-registry-frontend/commit/2451166ac3fc4d3beb8e137391f82448a5a47129))

## [0.17.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.16.1...v0.17.0) (2026-04-29)

### Features

* **cve:** add advisory banner for active CVE advisories ([#245](https://github.com/sethbacon/terraform-registry-frontend/issues/245)) ([45d8528](https://github.com/sethbacon/terraform-registry-frontend/commit/45d85286879b3f71705e42df623317653ae2ff23))

## [0.16.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.16.0...v0.16.1) (2026-04-28)

### Bug Fixes

* **scanning:** add format auto-detection for unknown scanner names ([#243](https://github.com/sethbacon/terraform-registry-frontend/issues/243)) ([ecf2ce3](https://github.com/sethbacon/terraform-registry-frontend/commit/ecf2ce373fa2cc92431b70ce25f8b919623a30ba)), closes [#242](https://github.com/sethbacon/terraform-registry-frontend/issues/242)

## [0.16.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.15.1...v0.16.0) (2026-04-28)

### Features

* **scanning:** add clickable findings modal with parsed results table ([#240](https://github.com/sethbacon/terraform-registry-frontend/issues/240)) ([b9c7536](https://github.com/sethbacon/terraform-registry-frontend/commit/b9c7536122e7a351f153ef35e5ca6d09e5edb404)), closes [#239](https://github.com/sethbacon/terraform-registry-frontend/issues/239)

## [0.15.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.15.0...v0.15.1) (2026-04-27)

### Bug Fixes

* **i18n:** update translations and decode HTML entities from DeepL ([#237](https://github.com/sethbacon/terraform-registry-frontend/issues/237)) ([4c9d96d](https://github.com/sethbacon/terraform-registry-frontend/commit/4c9d96dccbb79f66423b4bca1d48742218579781))

## [0.15.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.2...v0.15.0) (2026-04-27)

### Features

* **i18n:** translate public registry list pages ([#235](https://github.com/sethbacon/terraform-registry-frontend/issues/235)) ([8e8cc81](https://github.com/sethbacon/terraform-registry-frontend/commit/8e8cc81a95ca29aecb7a5729377240f80f41f21b)), closes [#196](https://github.com/sethbacon/terraform-registry-frontend/issues/196)
* **scanning:** surface security scanner logs and diagnostics ([#233](https://github.com/sethbacon/terraform-registry-frontend/issues/233)) ([7e7a3cf](https://github.com/sethbacon/terraform-registry-frontend/commit/7e7a3cfdcf192928bd231b786df963f72cef2426)), closes [#199](https://github.com/sethbacon/terraform-registry-frontend/issues/199)

## [0.14.2](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.1...v0.14.2) (2026-04-27)

### Bug Fixes

* **i18n:** show native language names in language picker ([#230](https://github.com/sethbacon/terraform-registry-frontend/issues/230)) ([4669b35](https://github.com/sethbacon/terraform-registry-frontend/commit/4669b35a710e4d421bf7b5fb1e216a2a30e1859f)), closes [#229](https://github.com/sethbacon/terraform-registry-frontend/issues/229)

## [0.14.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.0...v0.14.1) (2026-04-26)

### Bug Fixes

* **i18n:** correct stale comment referencing nonexistent CONTRIBUTING.md section ([#227](https://github.com/sethbacon/terraform-registry-frontend/issues/227)) ([124eb50](https://github.com/sethbacon/terraform-registry-frontend/commit/124eb5085075d174f47ca6a5c40b512c0e85012f))

## [0.14.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.13.0...v0.14.0) (2026-04-26)

### Features

* replace Crowdin with DeepL + Google Translate for i18n ([#222](https://github.com/sethbacon/terraform-registry-frontend/issues/222)) ([93285d5](https://github.com/sethbacon/terraform-registry-frontend/commit/93285d501f20a1bbc890cc3843f1da5c4e327d5d))

## [0.13.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.12.3...v0.13.0) (2026-04-25)

### Features

* add white-label branding step to setup wizard ([#218](https://github.com/sethbacon/terraform-registry-frontend/issues/218)) ([42c370c](https://github.com/sethbacon/terraform-registry-frontend/commit/42c370cda6c51a93983bd22c4b7eeb296edd970c)), closes [#200](https://github.com/sethbacon/terraform-registry-frontend/issues/200)
* **i18n:** move help panel content into translation files ([#216](https://github.com/sethbacon/terraform-registry-frontend/issues/216)) ([f057f08](https://github.com/sethbacon/terraform-registry-frontend/commit/f057f0878d8231a7b8897d2b304fe8771ddfd775)), closes [#202](https://github.com/sethbacon/terraform-registry-frontend/issues/202)
* **security-scanning:** show binary path and detected version in config section ([#217](https://github.com/sethbacon/terraform-registry-frontend/issues/217)) ([763e08f](https://github.com/sethbacon/terraform-registry-frontend/commit/763e08f7cac3fbf407152aa3511daa6a17a823c1)), closes [#198](https://github.com/sethbacon/terraform-registry-frontend/issues/198)
* **storage:** add guided migration UX for single-config state ([#215](https://github.com/sethbacon/terraform-registry-frontend/issues/215)) ([bece96e](https://github.com/sethbacon/terraform-registry-frontend/commit/bece96eab6da23a283e957b47a61349ce0e5eb10)), closes [#194](https://github.com/sethbacon/terraform-registry-frontend/issues/194)
* **ui:** combine top menu buttons into Settings and Support dropdowns ([#214](https://github.com/sethbacon/terraform-registry-frontend/issues/214)) ([edd56e3](https://github.com/sethbacon/terraform-registry-frontend/commit/edd56e3ab7e5d04b009664dd1bdc492ba5d1504a)), closes [#201](https://github.com/sethbacon/terraform-registry-frontend/issues/201)

## [0.12.3] - 2026-04-25

## [0.12.2] - 2026-04-24

## [0.12.1] - 2026-04-24

## [0.12.0] - 2026-04-24

### Added

- feat: internationalization (i18n) with i18next — English, Spanish, French, German, Japanese
- feat: whitelabel theming — configurable product name, logo, favicon, login hero, and brand colors via backend API
- feat: language picker in the header with automatic RTL text direction support
- feat: About modal shows product name from whitelabel config
- feat: Crowdin integration workflow for community translation contributions

## [0.11.1] - 2026-04-24

### Fixed

- fix: re-scan button now shows a warning when scanning is not configured on the registry; scan status updates automatically every 3 s while pending/scanning

## [0.11.0] - 2026-04-24

## [0.10.5] - 2026-04-24

### Fixed

- fix: limit gated E2E to 2 parallel workers to prevent Firefox networkidle timeout on Providers page

## [0.10.4] - 2026-04-24

### Added

- feat: add Re-scan button to SecurityScanPanel so admins can trigger a security rescan from the module detail page

### Fixed

- fix: add horizontal padding to command palette group headings

## [0.10.3] - 2026-04-23

### Added

- feat: show replacement_source in version deprecation banner (Terraform CLI >=1.10 protocol)
- feat: add Replacement Module Address field to Deprecate Version dialog

## [0.10.2] - 2026-04-23

### Added

- feat: default Modules page to Provider view and Name A-Z sort (#163)
- feat: persist Modules view mode in the URL as `?view=grid|grouped` (#163)
- feat: default Providers page sort to Name A-Z; explicit Relevance is now persisted as `?sort=relevance` (#163)

## [0.10.1] - 2026-04-22

### Added

- feat: add scanner auto-install UI to setup wizard (Trivy, Checkov, Terrascan)

## [0.10.0] - 2026-04-21

## [0.9.2] - 2026-04-20

### Fixed

- fix(setup): setup wizard now triggers for features added after initial setup — existing registries that completed setup before scanning was added now see a "Feature Configuration Required" banner and can configure scanning via the wizard (#155)
- fix(setup): `SetupWizardContext` no longer navigates away when `pending_feature_setup` is true
- fix(setup): `SetupWizardPage` renders the wizard shell in pending-feature mode instead of returning null
- fix(setup): HomePage banner shows contextual messaging ("Feature Configuration Required" vs "Setup Required") based on setup state

## [0.9.1] - 2026-04-20

### Fixed

- fix: Axios 401 interceptor no longer redirects anonymous visitors on public pages — only redirects when a previously authenticated session expires (#E2E)
- fix: E2E tests promoted from best-effort to required CI gate (removed continue-on-error) (#E2E)
- fix: accessibility E2E test waits for network idle before axe analysis (#E2E)
- fix: auth E2E test uses auto-retry assertion for login button visibility (#E2E)

## [0.9.0] - 2026-04-20

### Added

- feat: Phase 2 enterprise identity — SCIM provisioning, mTLS, LDAP, SAML admin pages, identity group mapping, expanded API + test coverage (#E2)

## [0.8.0] - 2026-04-18

### Added

- feat: Phase 0 quick wins — Prettier, browserslist, pinned Docker digests, coverage ratchet, skip-to-content link, ARCHITECTURE.md, CDN removal, admin dashboard scanning card (#147)
- feat: Phase 1 security hardening — CSP nonces, Subresource Integrity, Dependabot security auto-merge, vendored ReDoc, offline markdown sanitization audit (#148)
- feat: coverage phase 2 — 100+ new unit tests, F1.2 markdown audit, coverage ratchet to 75%, changelog link on binary detail page (#152)
- test: Phase 0.5 T-track coverage ramp — 54 new unit tests (#150)

### Fixed

- fix: lower coverage thresholds to ratchet floor (#149)

## [0.7.1] - 2026-04-17

### Fixed

- fix: handle rate-limited auth probes to prevent false "No SSO providers configured" message
- fix: remove redundant fetch in login handler to reduce auth rate limit consumption
- fix: prevent duplicate exchange-token requests in callback page

## [0.7.0] - 2026-04-16

### Added

- feat(home): actionable Getting Started section with QuickApiKeyDialog (roadmap 1.1)
- feat(login): symmetric provider probing with resilient dev login fallback (roadmap 1.2)
- feat(modules): dynamic UsageExample with tool selector and required-input placeholders (roadmap 2.1)
- feat(modules): skeleton loading states for modules, providers, and module detail pages (roadmap 2.2)
- feat(upload): FileDropZone with drag-and-drop, upload progress, and reordered fields (roadmap 2.5)
- feat(ux): global command palette with Cmd/Ctrl+K hotkey (roadmap 3.1)
- feat(admin): path-driven AdminBreadcrumbs rendered in Layout (roadmap 3.2)
- feat(ux): AnnouncerContext for aria-live screen reader feedback (roadmap 4.1)
- feat(auth): session expiry warning snackbar with refresh/sign-out actions (roadmap 4.2)
- feat(admin): targeted EmptyState component for API keys, users, and audit logs (roadmap 4.3)

### Changed

- refactor(setup): split SetupWizardPage into SetupWizardContext + per-step components (roadmap 1.3)
- refactor(modules): consolidate module header actions into ModuleActionsMenu kebab (roadmap 2.3)
- change(modules): filter deprecated versions in the version selector by default (roadmap 2.4)
- change(layout): collapse admin nav groups on mobile (roadmap 3.3)
- change(home): reorder quick-search toggle before input (roadmap 3.4)
- refactor(modules): unified ConfirmDialog with type-to-confirm for destructive actions (roadmap 4.4)

### Fixed

- fix(deployments): serve Keycloak over HTTPS for local OIDC UAT (backend >=0.6.0 requires HTTPS issuer URLs)

### Chore

- chore(ci): bump vitest coverage thresholds to Phase 4 targets (55 / 49 / 47 / 56)

## [0.6.3] - 2026-04-16

## [0.6.2] - 2026-04-16

## [0.6.1] - 2026-04-16

## [0.6.0] - 2026-04-15

## [0.5.6] - 2026-04-14

### Fixed

- fix: add scanning:read to scope display mapping (Closes #130)

## [0.5.5] - 2026-04-14

### Fixed

- fix: repair API docs sidebar links for tags with spaces (underscore encoding mismatch)
- fix: enable alphabetical tag sorting in SwaggerUI via wrapSelectors plugin

## [0.5.4] - 2026-04-14

### Added

- feat: add tabbed README / Inputs-Outputs documentation view on module detail page
- feat: add inline module description editing on module detail page
- feat: add Security Scanning admin page with configuration and recent scans
- feat: add scanning health status HealthPill to admin dashboard
- feat: sort API documentation sections alphabetically

## [0.5.3] - 2026-04-14

### Fixed

- fix: sort provider versions by semver descending instead of relying on backend `created_at` order
- fix: fetch all provider documentation pages (paginate with limit=1000) so large providers show all categories and docs in the sidebar

## [0.5.2] - 2026-04-14

### Performance

- perf: run Playwright E2E suite with 4 parallel workers (up from 1) — eliminates the "port conflicts" misconception; GH runners handle I/O-bound workers well
- perf: amortise dev-login cost to once per worker via worker-scoped `storageState` override — reduces ~75 serial login round-trips to at most 4 per run

## [0.5.1] - 2026-04-13

### Fixed

- fix: add null-safety for module detail page API responses to prevent TypeError crash

### Chore

- chore: remove stale ROADMAP.md

## [0.5.0-rc.3] - 2026-04-13

## [0.5.0-rc.2] - 2026-04-13

## [0.5.0-rc.1] - 2026-04-13

## [0.4.3] - 2026-04-13

### Fixed

- fix: exchange HttpOnly cookie for JWT on SSO callback page instead of expecting token in URL

### Chore

- chore: sync package-lock.json version to 0.4.2
- chore: document deployment config update steps in CLAUDE.md

## [0.4.2] - 2026-04-13

### Fixed

- fix: seed `system_settings.setup_completed = true` in E2E test stack so setup-redirect test passes
- fix: use correct env var `TFR_SECURITY_RATE_LIMITING_ENABLED` to disable rate limiting in test stack
- fix: use `getByRole('button')` for MUI Chip selectors in setup-wizard E2E spec

## [0.4.1] - 2026-04-13

### Changed

- refactor: decompose `ModuleDetailPage.tsx` (1,133 → 444 lines) into `useModuleDetail` hook and 5 sub-components — `ModuleDocumentation`, `SecurityScanPanel`, `SCMRepositoryPanel`, `WebhookEventsPanel`, `VersionDetailsPanel`

## [0.4.0] - 2026-04-13

### Added

- feat: add skip-to-content keyboard navigation link for accessibility
- feat: add `aria-label` to all 45 icon-only buttons across 14 files for screen reader accessibility
- feat: add `aria-busy` and `aria-live` attributes to all page-level loading containers (23 files) for screen reader state announcements
- feat: add TanStack Query data-fetching abstraction with proof-of-concept migration of ModulesPage, ProvidersPage, and DashboardPage — replaces manual `useState`/`useEffect`/`try-catch` boilerplate with `useQuery`, adds request caching and deduplication
- feat: add error reporting service placeholder (`services/errorReporting.ts`) with Sentry-compatible `init`/`captureError`/`setUser` interface — hooks into ErrorBoundary and global `unhandledrejection` handler, gated behind `VITE_ERROR_REPORTING_DSN` env var
- docs: document tag protection rule command in CLAUDE.md

### Fixed

- fix: update module scan API path from `/admin/modules/` to `/modules/` to match backend route fix (sethbacon/terraform-registry-backend#147)

## [0.3.8] - 2026-04-10

### Added

- feat: add Playwright E2E tests for SetupWizardPage — covers redirect-when-complete, page structure with stepper, token validation, OIDC step progression, storage backend chips, and public accessibility; uses route mocking for incomplete setup simulation
- feat: add Firefox to E2E cross-browser testing — conditionally included in CI only to keep local test runs fast

### Changed

- perf: add client-side pagination to MirrorsPage (10/25/50 per page) to avoid rendering all mirrors at once
- perf: reduce ModulesPage grouped view fetch limit from 500 to 100 modules per page with pagination controls
- perf: add memoization to Layout sidebar navigation arrays (`useMemo`), wrap `RegistryItemCard` in `React.memo`, memoize search handlers and grouped computations in ModulesPage/ProvidersPage/MirrorsPage

### Fixed

- fix: remove `|| true` tautology from E2E admin test and strengthen weak assertions across 9 test files with descriptive comments and more specific checks

## [0.3.8] - 2026-04-10

### Added

- feat: add Playwright E2E tests for SetupWizardPage — covers redirect-when-complete, page structure with stepper, token validation, OIDC step progression, storage backend chips, and public accessibility; uses route mocking for incomplete setup simulation
- feat: add Firefox to E2E cross-browser testing — conditionally included in CI only to keep local test runs fast

### Changed

- perf: add client-side pagination to MirrorsPage (10/25/50 per page) to avoid rendering all mirrors at once
- perf: reduce ModulesPage grouped view fetch limit from 500 to 100 modules per page with pagination controls
- perf: add memoization to Layout sidebar navigation arrays (`useMemo`), wrap `RegistryItemCard` in `React.memo`, memoize search handlers and grouped computations in ModulesPage/ProvidersPage/MirrorsPage

### Fixed

- fix: remove `|| true` tautology from E2E admin test and strengthen weak assertions across 9 test files with descriptive comments and more specific checks

## [0.3.7] - 2026-04-10

### Added

- feat: configure Vitest testing framework with happy-dom, @testing-library/react, and @testing-library/jest-dom
- feat: add foundational unit tests for useDebounce, ProtectedRoute, AuthContext, and api service (18 tests across 4 files)
- feat: add React error boundaries wrapping all routes — prevents white screen crashes by showing a user-friendly fallback UI with reload options
- docs: add `SECURITY.md` with vulnerability reporting instructions, supported versions, and disclosure policy
- docs: add `frontend/.env.example` documenting all four `VITE_*` environment variables
- docs: add `.env` and `.env.local` to `.gitignore`

### Changed

- chore: enable `react-hooks/exhaustive-deps` ESLint rule and fix all violations across the codebase
- refactor: normalize all API imports to use default `api` import instead of mixed `api`/`apiClient` named exports
- refactor: extract shared `formatDate`, `getScopeInfo`, and `getScopeColor` utilities to `utils/` directory, removing duplicate definitions from 4 admin pages
- refactor: consolidate local `ApprovalRequest` and `MirrorPolicy` type definitions into shared `types/rbac.ts`
- chore: enable `@typescript-eslint/no-unused-vars` ESLint rule and fix all violations
- chore: enable `@typescript-eslint/no-explicit-any` ESLint rule — replace all 88 `any` types across 19 files with type-safe alternatives; add shared `utils/errors.ts` with `getErrorMessage()` and `getErrorStatus()` helpers

### Fixed

- fix: remove duplicate `ProviderPlatform` interface — keep complete 10-field definition, delete narrower duplicate that was missing `storage_path` and `storage_backend`
- fix: consolidate duplicate `RoleTemplate` interface — canonical definition in `types/rbac.ts`, re-exported from `types/index.ts`

---

## [0.3.6] - 2026-04-10

### Added

- feat: surface module security scan results in module detail page — Security Scan sidebar panel shows scan status (clean/findings/pending/scanning/error), severity counts (Critical/High/Medium/Low), scanner name and version, and scan timestamp; visible to admin and modules:write users
- feat: surface module documentation in module detail page — Module Documentation section below README shows inputs (name, type, description, default, required), outputs (name, description, sensitive), provider requirements, and Terraform version constraints; visible to all users
- feat: add `ModuleScan`, `ModuleDoc`, and related TypeScript types to support backend v0.3.0 scanning and terraform-docs extraction features

### Fixed

- fix: remove deprecated `baseUrl` from `tsconfig.json` — `baseUrl` is no longer required as a prerequisite for `paths` in TypeScript 5.x bundler mode and is deprecated as of TS 6.0
- fix: install MUI v7.3.9 which was declared in `package.json` but absent from `node_modules`, resolving pre-existing TypeScript errors across 11 files

### Maintenance

- chore: document repository security hardening settings in `CLAUDE.md` — branch protection rules, merge strategy, dependency management, code ownership, and remaining recommendations
- chore: pin GitHub Actions workflow steps to full commit SHAs and harden CI/CD pipeline

---

## [0.3.6] - 2026-04-10

### Added

- feat: surface module security scan results in module detail page — Security Scan sidebar panel shows scan status (clean/findings/pending/scanning/error), severity counts (Critical/High/Medium/Low), scanner name and version, and scan timestamp; visible to admin and modules:write users
- feat: surface module documentation in module detail page — Module Documentation section below README shows inputs (name, type, description, default, required), outputs (name, description, sensitive), provider requirements, and Terraform version constraints; visible to all users
- feat: add `ModuleScan`, `ModuleDoc`, and related TypeScript types to support backend v0.3.0 scanning and terraform-docs extraction features

### Fixed

- fix: remove deprecated `baseUrl` from `tsconfig.json` — `baseUrl` is no longer required as a prerequisite for `paths` in TypeScript 5.x bundler mode and is deprecated as of TS 6.0
- fix: install MUI v7.3.9 which was declared in `package.json` but absent from `node_modules`, resolving pre-existing TypeScript errors across 11 files

### Maintenance

- chore: document repository security hardening settings in `CLAUDE.md` — branch protection rules, merge strategy, dependency management, code ownership, and remaining recommendations
- chore: pin GitHub Actions workflow steps to full commit SHAs and harden CI/CD pipeline

---

## [0.3.5] - 2026-03-25

### Fixed

- fix: bump `package.json` version to `0.3.5` so `__APP_VERSION__` bakes the correct version string into the Vite bundle at build time — prior releases emitted the wrong version in the About modal because `package.json` was not bumped before tagging
- fix: enforce `package.json` version sync in release workflow — `release.yml` guard job now fails fast if `frontend/package.json` `"version"` does not match the pushed tag, preventing future mismatches at release time

### Maintenance

- chore: document `package.json` version-sync requirement in `CLAUDE.md` — new CRITICAL step 2 in the Releasing section calls out the mandatory bump before committing the release

---

## [0.3.4] - 2026-03-24

### Maintenance

- chore: add PR template, CI changelog enforcement, and collection script — `.github/PULL_REQUEST_TEMPLATE.md` pre-fills the changelog section; `pr-checks.yml` fails PRs without a valid entry; `collect-changelog.sh` automates release-time changelog collection

---

## [0.3.3] - 2026-03-24

### Fixed

- fix: bump `package.json` version to `0.3.3` so `__APP_VERSION__` bakes correctly at Vite build time — prior builds always emitted `v0.3.0` because `package.json` was never updated after the initial version
- fix: proxy `/version` endpoint through nginx to the backend so the About modal can fetch the live backend version in production deployments

---

## [0.3.2] - 2026-03-24

### Added

- feat: About modal with frontend and backend version info — accessible from the toolbar via an info icon; displays frontend version (baked at Vite build time from `package.json`) and backend version (fetched live from `GET /version`)

---

## [0.3.1] - 2026-03-24

### Maintenance

- fix: upgrade GitHub Actions to Node 24 compatible versions (checkout@v4, setup-node@v4, actions/cache@v4)
- fix: upgrade Playwright to 1.58.2 for Node.js 24 runtime compatibility
- chore: opt GitHub Actions runners into Node.js 24 runtime; suppress deprecation warnings

---

## [0.3.0] - 2026-03-22

### Changed

- chore: upgrade React 18 → 19 and Material-UI v5 → v7; migrate all Grid v1 `item` props to Grid v2 `size` API across 11 pages
- chore: upgrade Dockerfile base image from `node:20-alpine` to `node:22-alpine`
- chore: raise npm audit gate from `--audit-level=critical` to `--audit-level=high` now that swagger-ui-react transitive vulnerabilities are resolved
- chore: update README and CLAUDE.md prerequisite notes to Node.js 22+ (LTS)

### Fixed

- fix: correct Vite dev server proxy target from hardcoded `https://localhost:443` to `http://localhost:8080` (Docker host port); add `VITE_PROXY_TARGET` env var override for TLS setups

### Added

- feat: add context help drawer content for Audit Logs page

---

## [0.2.10] - 2026-03-22

### Added

- feat: provider documentation tab — ProviderDetailPage gains a Documentation tab with a collapsible sidebar (grouped by subcategory → resource type) and inline markdown rendering; docs are fetched from the backend proxy and displayed without leaving the app
- feat: shared MarkdownRenderer component — extracted from ModuleDetailPage for reuse across provider docs and module readme rendering
- feat: Overview tab enhancements — GitHub Repository and Changelog buttons replace the external documentation link; info cards sidebar carried through to the Documentation tab

---

## [0.2.9] - 2026-03-17

### Fixed

- fix: set TFR_SERVER_PUBLIC_URL in E2E test compose so logout redirects to the nginx-fronted SPA instead of the raw backend port

---

## [0.2.8] - 2026-03-17

### Fixed

- fix: auto-save storage configuration after successful connection test so test + save are one action (#29)
- fix: hide Azure AD login button when provider is not configured, eliminating the confusing error on click (#30)
- fix: rename "Sign in with OIDC" button to "Sign in with SSO" for environment-agnostic labelling (#30)

---

## [0.2.7] - 2026-03-17

### Fixed

- fix: redirect nginx pid file to /tmp so container starts in AKS without root access to /var/run (#27)

---

## [0.2.6] - 2026-03-17

### Fixed

- fix: pre-create nginx temp dirs so container starts without CHOWN capability on AKS (#25)

---

## [0.2.5] - 2026-03-17

### Fixed

- fix: add `terraform_binary` and `file` to audit log resource type filter (#23)

### Docs

- docs: add UAT local build validation step to release workflow (#21)

---

## [0.2.4] - 2026-03-05

### Fixed

- fix: derive `REGISTRY_HOST` from `window.location.host` so module and provider usage examples include the port when non-standard (#17)

---

## [0.2.3] - 2026-03-05

### Fixed

- fix: mirrored provider usage example now shows upstream source (e.g. `hashicorp/aws`) with `>=major.minor` version constraint instead of registry hostname (#14)
- fix: module usage example now shows `>=major.minor` version constraint and removes placeholder comment (#14)

---

## [0.2.2] - 2026-03-05

### Fixed

- fix: lower Dockerfile npm audit gate from `high` to `critical` to unblock builds blocked by unfixable swagger-ui-react transitive vulnerabilities (`immutable@3.x`, `dompurify@3.2.x`) (#11)

---

## [0.2.1] - 2026-03-05

### Fixed

- fix: add explicit `Content-Type: application/json` header to nginx API proxy responses in `nginx.conf` and `nginx-ecs.conf.template` (#7)

### Changed

- docs: expand CONTRIBUTING.md table of contents, update Node.js prerequisite from 18+ to 20+, fix table alignment (#6)
- docs: fix markdown heading structure in e2e/README.md (#6)

---

## [0.2.0] - 2026-03-05

### Fixed

- admin/terraform-mirror: corrected OpenTofu default upstream URL from `https://releases.opentofu.org` to `https://github.com/opentofu/opentofu` (#1)
- nginx: add `Permissions-Policy` security header to `nginx.conf` and `nginx-ecs.conf.template` (#3)
- nginx: add extended proxy timeouts (600s) for long-running mirror sync operations (#3)

### Changed

- docker-compose: add `name: terraform-registry` project name for deterministic container naming (#3)
- docker-compose.oidc: add `terraform-state-manager` Keycloak realm and `shared-keycloak` external network for shared local development (#3)

---

## [0.1.0] - 2026-03-04

- Initial commit
