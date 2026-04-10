<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- feat: configure Vitest testing framework with happy-dom, @testing-library/react, and @testing-library/jest-dom
- feat: add foundational unit tests for useDebounce, ProtectedRoute, AuthContext, and api service (18 tests across 4 files)

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
