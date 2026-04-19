# Terraform Registry — Frontend

React 19 TypeScript SPA for the [Enterprise Terraform Registry](https://github.com/sethbacon/terraform-registry-backend).

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/sethbacon/59239e8575b4f784f875647e2b344b41/raw/frontend-coverage.json)](https://github.com/sethbacon/terraform-registry-frontend/actions/workflows/ci.yml)

## Overview

This repository contains the frontend UI and Playwright E2E test suite for the Enterprise Terraform Registry.

The backend API, database, and deployment infrastructure live in [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend).

## Features

- **Module Browser** — Search, filter, and explore modules with pagination and README rendering; toggle between grid and grouped-by-provider views; collapsible webhook events panel on module detail pages
- **Provider Browser** — Discover and manage provider versions with platform information; mirrored providers include a direct link to the matching `registry.terraform.io` documentation page
- **Admin Dashboard** — Refreshed card-based layout with summary stats (modules, providers, mirrors, users), binary mirror health (per-tool download counts and platform counts), provider mirror health, SCM provider count, and a unified recent sync activity feed
- **Upload Interface** — Easy module and provider publishing with SCM linking
- **SCM Management** — Connect GitHub, Azure DevOps, GitLab, and Bitbucket repositories
- **Mirror Management** — Configure and trigger provider synchronization from upstream registries
- **Terraform Binary Mirror** — Manage multiple named Terraform/OpenTofu binary mirror configs; per-config version management, platform-level inspection (SHA256 / GPG columns), on-demand sync trigger, and sync history; `version_filter` regex and `stable_only` flag supported
- **Terraform Binaries Browser** — Public `/terraform-binaries` listing of all active mirror configurations with tool badge, description, and latest synced version; drill into per-config version and platform asset pages
- **Mirror Approvals** — `/admin/approvals` page to review and action pending mirror sync approval requests (approve or reject with optional reason)
- **Mirror Policies** — `/admin/policies` CRUD interface for mirror policy rules: platform filters, version constraints, enabled/disabled toggle
- **Grouped Sidebar Navigation** — Admin nav items organized into collapsible sections (Identity, Source Control, Mirroring, Registry) for improved discoverability
- **API Key Management** — Create, edit, rotate, and expire API keys with scope controls
- **Interactive API Docs** — Full Swagger UI and ReDoc-based API reference at `/api-docs`
- **Responsive Design** — Works on desktop, tablet, and mobile

## Prerequisites

- Node.js 22+ (LTS) and npm
- A running backend API — see [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend) for setup
- Docker & Docker Compose (for the full stack via compose)

## Quick Start

### Development (against a local backend)

```bash
cd frontend
npm install

# The Vite dev server proxies /api/* to http://localhost:8080 by default
npm run dev
# App: http://localhost:5173
```

Make sure the backend is running at `http://localhost:8080` before starting the dev server.
See [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend) for backend setup.

### Docker Compose environments

| Compose file                                     | Purpose           | Frontend mode                     | Backend DEV_MODE |
| ------------------------------------------------ | ----------------- | --------------------------------- | ---------------- |
| `docker-compose.yml`                             | Local development | `development` (Dev Login enabled) | `true`           |
| `docker-compose.test.yml`                        | E2E testing / CI  | `development` (Dev Login enabled) | `true`           |
| `docker-compose.yml` + `docker-compose.prod.yml` | Production        | `production` (published image)    | `false`          |

**Local development** — backend + frontend via Docker, frontend also accessible via `npm run dev`:

```bash
cd deployments
docker compose up -d
# Frontend (dockerised): https://localhost:3000 (self-signed cert — accept the browser warning once)
# Backend API: http://localhost:8080

# Or run just the frontend dev server against the dockerised backend:
cd frontend && npm run dev
# App: http://localhost:5173
```

**E2E / CI test stack** — pulls backend from ghcr.io, builds frontend with HTTPS for Playwright:

```bash
cd deployments
docker compose -f docker-compose.test.yml up -d --build
# Frontend (HTTPS): https://localhost:3000
# Backend API: http://localhost:8080
```

To use a locally built backend (e.g. testing an unpublished migration):

```bash
cd ../../terraform-registry-backend/deployments && docker compose build backend
BACKEND_IMAGE=deployments-backend docker compose -f docker-compose.test.yml up -d --build
```

## Configuration

The frontend reads the backend API base URL from the `VITE_API_URL` environment variable at build time.

| Variable       | Default                  | Description                                |
| -------------- | ------------------------ | ------------------------------------------ |
| `VITE_API_URL` | (proxied by Vite in dev) | Backend API base URL for production builds |

In development the Vite proxy handles `/api/*` routing, so no env var is needed locally.
For Docker / production builds, set `VITE_API_URL=http://your-backend-host:8080`.

## Tech Stack

| Concern     | Technology                          |
| ----------- | ----------------------------------- |
| Language    | TypeScript 5.7.2 (strict mode)      |
| Framework   | React 19                            |
| Build Tool  | Vite 6.1.11                         |
| UI          | Material-UI v7 + Emotion            |
| HTTP Client | Axios 1.6.7                         |
| Router      | React Router v6                     |
| Markdown    | react-markdown + remark-gfm         |
| Linting     | ESLint 9 with TypeScript ESLint     |
| Formatting  | Prettier 3 (eslint-config-prettier) |
| E2E Tests   | Playwright                          |

## Architecture

The frontend follows a layered architecture: routes render pages, pages compose components, and components consume data via hooks.

```
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

**Authentication**: `AuthContext` reads a JWT from `localStorage`, attaches it via an Axios request interceptor, and handles 401 responses by clearing the session and redirecting to `/login`.

For a full deep-dive, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Development

### Frontend Commands

```bash
cd frontend

npm install           # Install dependencies
npm run dev           # Start development server (http://localhost:5173)
npm run build         # Build for production
npm run lint          # Lint (zero warnings enforced)
npm run format        # Format code with Prettier
npm run format:check  # Check formatting (CI)
npm run preview       # Preview production build
```

### Testing

**Unit tests** use Vitest with happy-dom and @testing-library/react:

```bash
cd frontend

npm test              # Run all unit tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with V8 coverage report
```

Coverage thresholds are enforced in `vitest.config.ts`: statements 70%, branches 60%, functions 60%, lines 70%. These are ratcheted up as coverage grows.

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

The CI pipeline is defined in `.github/workflows/ci.yml` and runs on pushes to `main` and PRs to `main`/`development`. Jobs run in parallel:

| Job           | What it does                                                                                |
| ------------- | ------------------------------------------------------------------------------------------- |
| **lint**      | `npm run lint` (zero warnings)                                                              |
| **typecheck** | `npx tsc --noEmit`                                                                          |
| **unit-test** | `npm run test:coverage` with artifact upload                                                |
| **build**     | Production build, uploads `dist/` artifact                                                  |
| **e2e-gated** | Playwright against the Docker Compose test stack (main branch, manual dispatch, or release) |

Additional workflows: `e2e.yml`, `release.yml` (tag-triggered image build + GHCR push), `scheduled-build.yml` (weekly drift check), `auto-tag.yml`, `pr-checks.yml`.

## Documentation

- [Architecture](ARCHITECTURE.md) - Component hierarchy, data flow, auth flow
- [Accessibility](ACCESSIBILITY.md) - WCAG 2.1 AA compliance, testing tools
- [Testing](TESTING.md) - Test patterns, running tests, coverage
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history
- [Roadmap](ROADMAP.md) - Planned improvements and phases
- [Backend Repository](https://github.com/sethbacon/terraform-registry-backend) - API, architecture, and configuration
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
