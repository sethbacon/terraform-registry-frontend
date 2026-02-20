# Terraform Registry — Frontend

React 18 TypeScript SPA for the [Enterprise Terraform Registry](https://github.com/sethbacon/terraform-registry-backend).

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## Overview

This repository contains the frontend UI and Playwright E2E test suite for the Enterprise Terraform Registry.

The backend API, database, and deployment infrastructure live in [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend).

## Features

- **Module Browser** — Search, filter, and explore modules with pagination and README rendering
- **Provider Browser** — Discover and manage provider versions with platform information
- **Admin Dashboard** — System statistics and management tools
- **Upload Interface** — Easy module and provider publishing with SCM linking
- **SCM Management** — Connect GitHub, Azure DevOps, GitLab, and Bitbucket repositories
- **Mirror Management** — Configure and trigger provider synchronization from upstream registries
- **API Key Management** — Create, edit, rotate, and expire API keys with scope controls
- **Interactive API Docs** — Full Swagger UI and ReDoc-based API reference at `/api-docs`
- **Responsive Design** — Works on desktop, tablet, and mobile

## Prerequisites

- Node.js 18+ and npm
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

### Docker Compose (full stack with published backend image)

```bash
cd deployments

# Pulls backend from ghcr.io, builds frontend locally
docker-compose -f docker-compose.test.yml up -d
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
```

## Configuration

The frontend reads the backend API base URL from the `VITE_API_URL` environment variable at build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | (proxied by Vite in dev) | Backend API base URL for production builds |

In development the Vite proxy handles `/api/*` routing, so no env var is needed locally.
For Docker / production builds, set `VITE_API_URL=http://your-backend-host:8080`.

## Tech Stack

| Concern | Technology |
|---|---|
| Language | TypeScript 5.7.2 (strict mode) |
| Framework | React 18.2.0 |
| Build Tool | Vite 6.1.11 |
| UI | Material-UI v5 + Emotion |
| HTTP Client | Axios 1.6.7 |
| Router | React Router v6 |
| Markdown | react-markdown + remark-gfm |
| Linting | ESLint 9 with TypeScript ESLint |
| E2E Tests | Playwright |

## Development

### Frontend Commands

```bash
cd frontend

npm install        # Install dependencies
npm run dev        # Start development server (http://localhost:5173)
npm run build      # Build for production
npm run lint       # Lint (zero warnings enforced)
npm run preview    # Preview production build
```

### E2E Tests

The E2E suite uses Playwright and requires the full stack running (backend + postgres + frontend).

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
docker-compose -f docker-compose.test.yml up -d
cd ../e2e
npx playwright test --workers=1
```

## Documentation

- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - How to contribute
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

## Acknowledgments

- [React](https://react.dev/) - Frontend framework
- [Material-UI](https://mui.com/) - Component library
- [HashiCorp Terraform](https://www.terraform.io/) - Module and Provider protocols

---

Built for the Terraform community
