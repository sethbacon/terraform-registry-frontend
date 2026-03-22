<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

- fix: lower Dockerfile npm audit gate from `high` to `critical` to unblock builds blocked by unfixable swagger-ui-react transitive vulnerabilities (immutable@3.x, dompurify@3.2.x) (#11)

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
