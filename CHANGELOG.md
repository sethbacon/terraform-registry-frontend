<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
