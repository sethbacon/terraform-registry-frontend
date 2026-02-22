# CLAUDE.md — Terraform Registry Frontend

## Project Overview

React 18 TypeScript SPA (single-page application) for the Enterprise Terraform Registry.

Backend API lives in a separate repository: [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend)

---

## Repository Structure

```txt
terraform-registry-frontend/
├── frontend/                 # React 18 TypeScript SPA (Vite + Material-UI)
│   ├── src/
│   │   ├── pages/            # Admin dashboard, modules, providers, login, etc.
│   │   ├── components/       # Layout, ProtectedRoute, PublishWizard, etc.
│   │   ├── services/api.ts   # Axios HTTP client (all API calls go here)
│   │   ├── contexts/         # AuthContext, ThemeContext
│   │   └── types/            # TypeScript type definitions
│   ├── Dockerfile            # Multi-stage: node build → nginx serve
│   ├── nginx.conf            # Nginx config proxying /api/* to backend
│   ├── vite.config.ts
│   └── package.json
├── e2e/                      # Playwright end-to-end tests
│   ├── tests/
│   ├── fixtures/
│   └── playwright.config.ts
└── deployments/
    ├── docker-compose.yml       # Full stack (uses ghcr.io backend image)
    ├── docker-compose.test.yml  # CI test stack (uses ghcr.io backend image)
    └── docker-compose.prod.yml  # Frontend service only
```

---

## Tech Stack

| Concern | Technology |
| --- | --- |
| Language | TypeScript 5.7.2 (strict mode) |
| Framework | React 18.2.0 |
| Build Tool | Vite 6.1.11 |
| UI | Material-UI v5 + Emotion |
| HTTP | Axios 1.6.7 |
| Router | React Router v6 |
| Markdown | react-markdown + remark-gfm |
| Linting | ESLint 9 with TypeScript ESLint |
| E2E Tests | Playwright |

---

## Common Commands

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server (http://localhost:5173, proxies /api/* to backend)
npm run dev

# Build for production
npm run build

# Lint (zero warnings enforced)
npm run lint

# Preview production build
npm run preview
```

### E2E Tests

```bash
cd e2e

# Install dependencies and Playwright browsers
npm ci
npx playwright install chromium

# Run all tests (requires a running backend at localhost:8080 with DEV_MODE=true)
npx playwright test --workers=1 --retries=0 --reporter=list
```

### Docker Compose (full stack with published backend image)

```bash
cd deployments

# Development / local testing (pulls backend from ghcr.io, builds frontend locally)
docker-compose -f docker-compose.test.yml up -d
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
```

---

## Frontend Conventions

- **All API calls** go through `services/api.ts` (Axios instance with auth interceptors). Never call `fetch` directly.
- **Global state** uses React Context (`AuthContext`, `ThemeContext`). Redux is not used.
- **Protected routes** use `components/ProtectedRoute.tsx`.
- **TypeScript strict mode** is enforced — `noUnusedLocals` and `noUnusedParameters` are errors. `any` types require explicit justification in a comment.
- **MUI `TextField` inputs** for non-obvious fields must include a `helperText` prop explaining the expected value.
- **New pages** must be added to the router in `App.tsx` and, if admin-only, wrapped in `ProtectedRoute` with the appropriate required scope.

### Setup Wizard

- `pages/SetupWizardPage.tsx` — 5-step first-run wizard for OIDC, storage, and admin configuration.
- Route: `/setup` (public, no auth layout — uses `SetupToken` header instead of JWT).
- API methods in `services/api.ts` use a dedicated `setupRequest(token)` helper that sends `Authorization: SetupToken <token>`.
- The wizard checks `/api/v1/setup/status` on mount and redirects to `/` if setup is already completed.
- Types: `OIDCConfigInput`, `OIDCConfigResponse`, `SetupTestResult`, `ConfigureAdminInput`, `CompleteSetupResponse` in `types/index.ts`.

---

## Development Notes

- CI/CD pipelines are configured in `.github/workflows/ci.yml` (lint/build + E2E).
- E2E tests require the backend image `ghcr.io/sethbacon/terraform-registry-backend:latest` to be available.
- The `docker-compose.test.yml` pulls the backend from GHCR rather than building it from source.
- For backend configuration, API documentation, and architecture details, see [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend).
