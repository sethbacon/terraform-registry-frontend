<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
