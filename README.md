<!-- markdownlint-disable MD013 -->
# Enterprise Terraform Registry — Frontend

React 19 TypeScript SPA for the [Enterprise Terraform Registry](https://github.com/sethbacon/terraform-registry-backend).

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/sethbacon/59239e8575b4f784f875647e2b344b41/raw/frontend-coverage.json)](https://github.com/sethbacon/terraform-registry-frontend/actions/workflows/ci.yml)

This repository contains the frontend UI and Playwright E2E test suite for the Enterprise Terraform Registry. The backend API, database, and deployment infrastructure live in **[terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend)**.

## Features

- **Module Browser** — Search, filter, and explore modules; grid and grouped-by-provider views; collapsible webhook events panel on detail pages
- **Provider Browser** — Browse provider versions with platform info; mirrored providers link to upstream `registry.terraform.io` docs
- **Admin Dashboard** — Card-based layout with summary stats (modules, providers, mirrors, users), mirror health, SCM provider count, recent sync activity
- **Upload Interface** — Module and provider publishing with SCM linking
- **SCM Management** — GitHub, Azure DevOps, GitLab, and Bitbucket repository integration
- **Mirror Management** — Provider mirror configuration and sync triggers
- **Terraform Binary Mirror** — Multiple named Terraform/OpenTofu mirror configs; per-platform inspection; `version_filter` regex and `stable_only` flag
- **Terraform Binaries Browser** — Public `/terraform-binaries` listing with drill-down to per-config version and platform pages
- **Mirror Approvals** — Review and action pending mirror sync approval requests at `/admin/approvals`
- **Mirror Policies** — CRUD for mirror policy rules at `/admin/policies` (platform filters, version constraints, enabled/disabled toggle)
- **Grouped Sidebar Navigation** — Admin nav items grouped into Identity, Source Control, Mirroring, and Registry sections
- **API Key Management** — Create, edit, rotate, and expire API keys with scope controls
- **Interactive API Docs** — Swagger UI and ReDoc-based API reference at `/api-docs`
- **Internationalisation** — 10 locales (en, de, es, fr, it, ja, nb, nl, pt, zh) via react-i18next; auto-translation pipeline (DeepL)
- **Accessibility** — WCAG 2.1 AA target; axe-core E2E coverage; RTL-aware theme
- **Responsive Design** — Desktop, tablet, and mobile layouts

## Prerequisites

- Node.js 24.x and npm
- A running backend API — see [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend) for setup
- Docker & Docker Compose (for the full stack via compose)

## Quick Start

### Development (against a local backend)

```bash
cd frontend
npm install

# The Vite dev server proxies /api/* to http://localhost:8080 by default
npm run dev
# App: https://registry.local:3000 (HTTPS when local dev certs exist, otherwise http)
# Requires a hosts-file entry: 127.0.0.1 registry.local
```

Make sure the backend is running at `http://localhost:8080` before starting the dev server.
See [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend) for backend setup.

### Docker Compose stacks

Three compose stacks are provided in [`deployments/`](deployments/) for local
development, end-to-end testing, and production:

| Compose file                                     | Purpose           | Frontend mode                     | Backend `DEV_MODE` |
| ------------------------------------------------ | ----------------- | --------------------------------- | ------------------ |
| `docker-compose.yml`                             | Local development | `development` (Dev Login enabled) | `true`             |
| `docker-compose.test.yml`                        | E2E testing / CI  | `development` (Dev Login enabled) | `true`             |
| `docker-compose.yml` + `docker-compose.prod.yml` | Production        | `production` (published image)    | `false`            |

Quick start (local dev — backend + frontend in Docker):

```bash
cd deployments
docker compose up -d
# Frontend: https://registry.local:3000 (self-signed cert — accept the browser warning once)
#           requires a hosts-file entry: 127.0.0.1 registry.local
# Backend API: http://localhost:8080
```

For the Keycloak/OIDC stack, the production overlay, test users, and stack
maintenance procedures, see [`deployments/README.md`](deployments/README.md).

## Configuration

Frontend configuration is provided via Vite environment variables. All variables are optional; defaults are listed below. See [`frontend/.env.example`](frontend/.env.example) for the complete annotated template.

| Variable                   | Default                  | Description                                                                                                                                                          |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`             | (proxied by Vite in dev) | Backend API **origin** for production builds, e.g. `https://registry.example.com`. Must not include a path: every API call already hardcodes its own `/api/v1/...` prefix, so a path here (e.g. `.../api/v1`) would double it. |
| `VITE_PROXY_TARGET`        | `http://localhost:8080`  | Backend URL the Vite dev server proxies `/api/*` to. Override for TLS or non-local backend during development.                                                       |
| `VITE_USE_MOCK_DATA`       | `false`                  | When `true`, the API client returns static mock data instead of calling the backend (offline development).                                                           |
| `VITE_ERROR_REPORTING_DSN` | _(unset)_                | URL for batched browser error reports (Sentry-compatible DSN or any HTTP endpoint). When unset, errors log to console only.                                          |

In development the Vite proxy handles `/api/*` routing, so no env var is needed locally.
For Docker / production builds served through nginx, the bundled nginx config already proxies `/api/*` to the backend, so `VITE_API_URL` is normally left unset. Only set it if the frontend is genuinely served from a different origin than the backend -- and note the shipped Content-Security-Policy's `connect-src 'self'` will block that origin's requests unless you also route both through the same reverse proxy (see `nginx-ecs.conf.template`'s `BACKEND_URL` pattern) instead of calling the other origin directly from the browser. This value is compiled into the public JS bundle, so it must stay public-facing -- never an internal-only hostname.

## Tech Stack

| Concern     | Technology                          |
| ----------- | ----------------------------------- |
| Language    | TypeScript 6.0.3 (strict mode)      |
| Framework   | React 19                            |
| Build Tool  | Vite 8                              |
| UI          | Material-UI v9 + Emotion            |
| HTTP Client | Axios 1.x                           |
| Router      | React Router v6                     |
| Markdown    | react-markdown + remark-gfm         |
| Linting     | ESLint 10 with TypeScript ESLint    |
| Formatting  | Prettier 3 (eslint-config-prettier) |
| E2E Tests   | Playwright                          |

## Architecture

The frontend follows a layered architecture: routes render pages, pages compose components, and components consume data via hooks.

```text
App
 +-- ThemeProvider / AuthProvider / HelpProvider / QueryClientProvider
      +-- Router
           +-- Layout (sidebar + topbar)
           |    +-- Public pages:  HomePage, ModulesPage, ProvidersPage, ...
           |    +-- Admin pages:   ProtectedRoute -> DashboardPage, UsersPage, ...
           +-- Standalone pages: LoginPage, SetupWizardPage
```

**State management**: React Query (`@tanstack/react-query`) for all server state; React Context for app-level concerns (auth, theme, help panel); local `useState` for UI-only state.

**Data fetching**: API calls go through `services/api.ts` (Axios). Query cache keys are defined in `services/queryKeys.ts` using a factory pattern. Mutations invalidate related queries via `queryClient.invalidateQueries()`.

**Authentication**: Sessions are cookie-only. The backend sets an HttpOnly auth cookie; the Axios client sends it on every request via `withCredentials: true`, and `AuthContext` detects the session by calling `/api/v1/auth/me`. Mutating requests are protected by a CSRF double-submit: the non-HttpOnly `tfr_csrf` cookie is echoed in an `X-CSRF-Token` header. A 401 clears local session state and redirects to `/login`. (A legacy `localStorage` Bearer token is still honoured as a backward-compatible migration fallback and will be removed once all sessions use cookies.)

**Security posture (CSP nonce)**: When served through nginx, a per-request CSP nonce is derived from `$request_id` and injected into `index.html` (the `__CSP_NONCE__` placeholder), so the `Content-Security-Policy` `style-src` can use `'nonce-…'` instead of `'unsafe-inline'`. The Emotion cache reads the same nonce so MUI styles are allowed. See [`frontend/nginx.conf`](frontend/nginx.conf).

For a full deep-dive, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Development

### Frontend Commands

```bash
cd frontend

npm install           # Install dependencies
npm run dev           # Start development server (https://registry.local:3000)
npm run build         # Build for production
npm run lint          # Lint (zero warnings enforced)
npm run format        # Format code with Prettier
npm run format:check  # Check formatting (CI)
npm run preview       # Preview production build
npm run contract:check # Check API client against the backend OpenAPI spec
                       # (needs the backend running, e.g. deployments/docker-compose.contract-check.yml)
```

### Testing

**Unit tests** use Vitest with happy-dom and @testing-library/react:

```bash
cd frontend

npm test              # Run all unit tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with V8 coverage report
```

Coverage thresholds are enforced in `vitest.config.ts`: statements 80%, branches 70%, functions 70%, lines 80% (the current floor). These are ratcheted up as coverage grows.

**E2E tests** use Playwright and require the full stack (backend + postgres + frontend):

```bash
cd e2e

# Install dependencies and browsers
npm ci
npx playwright install chromium

# Run against a running stack (backend must have DEV_MODE=true)
npx playwright test --workers=1 --retries=0 --reporter=list
```

Or start the full test stack via Docker Compose:

```bash
cd deployments
docker compose -f docker-compose.test.yml up -d --build
cd ../e2e
npx playwright test --workers=1
```

For test patterns, conventions, and coverage details, see [TESTING.md](TESTING.md).

### CI Pipeline

The CI pipeline is defined in `.github/workflows/ci.yml` and runs on pushes to `main` and PRs to `main`. Jobs run in parallel:

| Job                    | What it does                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **lint**               | `npm run lint` (zero warnings)                                                              |
| **typecheck**          | `npx tsc --noEmit`                                                                          |
| **unit-test**          | Vitest unit tests, sharded into 4 parallel jobs (`Unit Tests (N/4)`)                        |
| **unit-test-coverage** | Merges the shard reports and enforces coverage thresholds                                   |
| **build**              | Production build, uploads `dist/` artifact                                                  |
| **contract-check**     | Runs `npm run contract:check` against the backend OpenAPI via `docker-compose.contract-check.yml` |
| **e2e-gated**          | Playwright against the Docker Compose test stack (main branch, manual dispatch, or release) |

Additional workflows: `release-please.yml` (automated versioning + release PR), `release.yml` (tag-triggered image build + GHCR push), `weekly-security.yml` (weekly security checks), `translate.yml` (DeepL/Google Translate sync of new i18n strings), `dependabot-automerge.yml`, `pr-checks.yml`, `wiki-sync.yml`.

## Documentation

- [Architecture](ARCHITECTURE.md) — Component hierarchy, data flow, auth flow
- [Accessibility](ACCESSIBILITY.md) — WCAG 2.1 AA compliance, testing tools
- [Testing](TESTING.md) — Test patterns, running tests, coverage
- [Privacy](PRIVACY.md) — Browser data collection and consent model
- [Releasing](RELEASING.md) — Release process and supply-chain verification
- [Security](SECURITY.md) — Reporting vulnerabilities and supported versions
- [Contributing](CONTRIBUTING.md) — How to contribute
- [Code of Conduct](CODE_OF_CONDUCT.md) — Community standards
- [Changelog](CHANGELOG.md) — Version history
- [Backend Repository](https://github.com/sethbacon/terraform-registry-backend) — API, architecture, configuration, deployment
- [Backend API Reference](https://github.com/sethbacon/terraform-registry-backend/blob/main/docs/api-reference.md)
- [Backend Architecture](https://github.com/sethbacon/terraform-registry-backend/blob/main/docs/architecture.md)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests. Key requirements:

- `npm run lint` must pass with zero warnings
- `npm run build` must complete without errors
- New pages require documentation updates

## License

This project is licensed under the Apache License, Version 2.0 — see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided **"AS IS"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of this software. See the [Apache 2.0 License](LICENSE) (Sections 7–8) for the full warranty disclaimer and limitation of liability.

**Operational security is the responsibility of the deploying organization.** This includes, but is not limited to: securing the deployment environment, managing secrets and credentials, configuring TLS, controlling network access, keeping dependencies up to date, and validating the fitness of this software for your specific use case. The maintainers make no guarantees regarding the security posture of any deployment.

## Acknowledgments

- [React](https://react.dev/) - Frontend framework
- [Material-UI](https://mui.com/) - Component library
- [HashiCorp Terraform](https://www.terraform.io/) - Module and Provider protocols
- [simple-icons](https://simpleicons.org/) - Provider brand icons (CC0)

### Trademark Notice

AWS and Amazon Web Services are trademarks of Amazon.com, Inc. or its affiliates. Microsoft Azure is a trademark of Microsoft Corporation. Google Cloud is a trademark of Google LLC. HashiCorp, Terraform, and Vault are trademarks of HashiCorp, Inc. VMware and vSphere are trademarks of Broadcom Inc. Oracle and OCI are trademarks of Oracle Corporation. All other trademarks are the property of their respective owners.

Use of these trademarks in this project is purely for identification purposes (to indicate which cloud provider a Terraform module or provider targets) and does not imply any affiliation with, endorsement by, or sponsorship from the trademark owners.

---

Built with ❤️ for the Terraform community
