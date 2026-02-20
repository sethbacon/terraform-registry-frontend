# Changelog

All notable changes to the frontend will be documented in this file.

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
