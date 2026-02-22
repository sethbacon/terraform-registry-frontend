<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to the frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.2.0] - 2026-02-22

### Added

- **Setup Wizard page** (`frontend/src/pages/SetupWizardPage.tsx`) — multi-step first-run wizard
  at `/setup`; guides the operator through OIDC provider configuration, storage backend
  configuration, and initial admin user creation; uses the one-time setup token for
  authorisation and redirects to login on completion.

- **Setup wizard API client** (`frontend/src/services/api.ts`) — eight new `ApiClient` methods:
  `validateSetupToken`, `testOIDCConfig`, `saveOIDCConfig`, `testStorageConfig`,
  `saveStorageConfig`, `configureAdmin`, `completeSetup`, and `getSetupStatus`; all setup
  requests use a `SetupToken <token>` Authorization header instead of the normal JWT bearer token.

- **Setup wizard TypeScript types** (`frontend/src/types/index.ts`) — `OIDCConfigInput`,
  `StorageConfigInput`, `SetupValidateTokenResponse`, `SetupTestResult`,
  `SetupOIDCConfigResponse`, `SetupStorageConfigResponse`, `SetupAdminResponse`, and
  `SetupCompleteResponse`; `SetupStatus` extended with `setup_completed`, `oidc_configured`,
  and `admin_configured` fields.

### Changed

- **`App.tsx`** — `/setup` route added as a public (unauthenticated) route rendering
  `SetupWizardPage`.

---

## [1.1.2] - 2026-02-21

> First tagged release of the standalone `terraform-registry-frontend` repository,
> split from the `sethbacon/terraform-registry` monorepo.
> Includes all frontend changes through v1.1.2 of the monorepo.

### Added

- **E2E CI environment hardening** — `deployments/docker-compose.test.yml`:
  - All services now have Docker health checks; `nginx` and `backend` use `depends_on: service_healthy`
    so compose never starts a container before its dependency is ready.
  - New `seed-db` one-shot service runs `create-dev-admin-user.sql` after the database is healthy,
    giving the dev admin account to all CI runs without manual seeding.
  - `ENCRYPTION_KEY` added to backend service so the server starts without a missing-key panic.
  - `TFR_DATABASE_SSL_MODE=disable` set; the postgres container in CI does not use TLS.
  - Port `5433:5432` binding removed (not needed by CI — localhost leakage avoidance).

- **Playwright `maxFailures: 1`** — `e2e/playwright.config.ts`: stops the entire run on the first
  test failure so noisy cascading failures don't obscure the root cause.

### Fixed

- **`import.meta.env.DEV` always false at build time** — `frontend/src/pages/LoginPage.tsx`:
  `import.meta.env.DEV` is always `false` during `vite build` regardless of `--mode`; changed to
  `import.meta.env.MODE === 'development'` so the dev-login bypass button renders correctly in the
  E2E environment.

- **`waitForSelector` false mismatch on API keys empty state** — `e2e/tests/admin.spec.ts`:
  The API keys empty-state element is a `<p>` tag, not `<h6>`; changed selector from
  `h6:has-text("No API keys")` to `[class*="MuiPaper"]` to avoid the timeout.

### Changed

- **Node 18 → 20** — CI (`ci.yml`) upgraded frontend and E2E jobs from Node 18 to 20, matching
  the current LTS release used upstream.

- **ESLint 8 → 9 + plugin upgrades** — `eslint`, `@typescript-eslint/eslint-plugin`, and
  `@typescript-eslint/parser` upgraded to compatible v9/v8 versions; `eslint.config.js` adopted.

---

## [1.1.1] - 2026-02-19

### Fixed

- **`(latest)` label stuck on deprecated version** — `ModuleVersionList` and related version-listing
  components: the "latest" badge is now driven by the `is_latest` flag returned from the backend, so a
  deprecated version never stays labelled `(latest)` after a newer version is published.

- **`auto_publish_enabled` toggle always reading `false`** — `PublishFromSCMWizard.tsx` and
  `RepositoryBrowser.tsx`: the backend's JSON field was renamed from `auto_publish` to
  `auto_publish_enabled`; updated all frontend reads to the new key so the SCM auto-publish toggle
  reflects the actual stored value after link creation or page reload.

- **Selected tag not published on link creation** — `PublishFromSCMWizard.tsx`:
  When a user picked a specific tag in the "Choose Repository" step and then clicked "Link Module",
  the tag was never imported. The wizard now calls `triggerManualSync` immediately after a successful
  link when a tag is selected, so the chosen version is imported automatically.

- **Module detail page not refreshing after sync** — `ModuleDetailPage.tsx`:
  Replaced the single 2-second `setTimeout` reload with a `pollForVersions` helper that re-fetches
  module details at 2 s, 5 s, and 12 s after sync is triggered, ensuring newly imported versions
  appear without a manual page refresh.

### Changed

- **Repository browser visual selection feedback** — `RepositoryBrowser.tsx`:
  - Selected repository accordion gains a `primary.main` border and a `CheckCircleIcon`.
  - A `"Selected"` `Chip` appears in the summary next to the repository name.
  - Tag list items receive the MUI `selected` state when they match the active `selectedTag` prop.
  - `onRepositorySelect` clears `selectedTag` on every repository change to prevent stale state.

- **Inline publishing options in SCM wizard step 1** — `PublishFromSCMWizard.tsx`:
  An inline **Publishing Options** panel appears immediately after selecting a repository, letting
  users configure `auto_publish_enabled` and pick a specific tag before advancing to step 2.

- **Upload page split into dedicated module and provider pages** — `src/pages/admin/`:
  - `ModuleUploadPage` (`/admin/upload/module`) — file upload or SCM-wizard paths.
  - `ProviderUploadPage` (`/admin/upload/provider`) — manual upload or mirror-configuration paths.
  - Original `UploadPage` reduced to a `<Navigate to="/admin/upload/module" replace />` shim for
    backward compatibility.
  - `App.tsx` registers the two new routes under `ProtectedRoute`.
  - Dashboard quick-action links and `ProvidersPage` upload button updated to the new paths.

---

## [1.0.0] - 2026-02-20

### Added

- Initial release as a standalone repository, split from the `sethbacon/terraform-registry` monorepo.
- React 18 TypeScript SPA with Vite + Material-UI v5.
- Module Browser — search, filter, explore modules with pagination and README rendering.
- Provider Browser — discover and manage provider versions with platform information.
- Admin Dashboard — system statistics and management tools.
- Upload Interface — module and provider publishing with SCM linking.
- SCM Management — configure GitHub, Azure DevOps, GitLab, and Bitbucket.
- Mirror Management — configure and trigger provider synchronization.
- API Key Management — create, rotate, and expire API keys with scope controls.
- Interactive API Docs — Swagger UI and ReDoc at `/api-docs`.
- Playwright E2E test suite.
- GitHub Actions CI: frontend lint/build + gated E2E tests.
- Dependabot for npm and GitHub Actions dependencies.
