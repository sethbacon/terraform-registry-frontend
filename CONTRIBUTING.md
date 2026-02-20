# Contributing to Terraform Registry — Frontend

Thank you for your interest in contributing to the frontend UI and E2E test suite.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Frontend (TypeScript) Standards](#frontend-typescript-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)
- [Documentation](#documentation)

---

## Code of Conduct

This project expects all participants to interact with each other professionally and respectfully. Harassment, discrimination, or disruptive behavior of any kind is not acceptable.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for running the backend during development)

### Fork and Clone

```bash
git clone https://github.com/sethbacon/terraform-registry-frontend.git
cd terraform-registry-frontend
```

### Local Setup

Start the backend using the test Docker Compose (pulls backend from ghcr.io):

```bash
cd deployments
docker-compose -f docker-compose.test.yml up -d
```

Then start the frontend dev server in a second terminal:

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

Alternatively, set up the backend manually — see [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend).

> **DEV_MODE**: The `docker-compose.test.yml` starts the backend with `DEV_MODE=true`, which enables the dev login endpoint used by Playwright E2E fixtures.

---

## Development Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/short-description` | `feat/mirror-status-page` |
| Bug fix | `fix/issue-description` | `fix/api-key-expiry-display` |
| Documentation | `docs/topic` | `docs/e2e-setup` |
| Refactor | `refactor/area` | `refactor/auth-context` |

### Commit Messages

- Use the **imperative mood**: "Add feature" not "Added feature"
- Keep the subject line under **72 characters**
- Leave a blank line, then explain **why** the change is needed in the body
- Reference issues with `Fixes #123` or `Closes #123`

---

## Frontend (TypeScript) Standards

### Linting

```bash
cd frontend
npm run lint   # must produce zero warnings
npm run build  # must complete without errors
```

TypeScript strict mode is enforced. `any` types require explicit justification in a comment.

### Conventions

- **All API calls** go through `services/api.ts` (Axios instance with auth interceptors). Never call `fetch` directly.
- **Global state** uses React Context (`AuthContext`, `ThemeContext`). Redux is not used.
- **Protected routes** use `components/ProtectedRoute.tsx`.
- **MUI `TextField` inputs** for non-obvious fields must include a `helperText` prop explaining what value is expected and why.
- **New pages** must be added to the router in `App.tsx` and, if admin-only, wrapped in `ProtectedRoute` with the appropriate required scope.

---

## Testing Requirements

Before submitting a pull request:

```bash
# Frontend: must lint and build clean
cd frontend
npm run lint
npm run build

# E2E: run the Playwright suite against a running stack
cd e2e
npx playwright test --workers=1
```

---

## Pull Request Process

1. **Open an issue first** for substantial changes.
2. Write a clear PR description:
   - What changed and why
   - How you tested it
   - Screenshots for UI changes
   - Link to the issue being resolved
3. All CI checks must pass.
4. At least one reviewer approval is required before merging.
5. **Squash merge** is preferred to keep the main branch history clean.
6. The PR author is responsible for resolving merge conflicts.

---

## Reporting Security Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

Use [GitHub's private security advisory feature](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) to report issues privately. Include:

- A clear description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested mitigations

We will respond within 5 business days and coordinate a fix and disclosure timeline.

---

## Documentation

Documentation is a first-class deliverable:

- **New features**: update the relevant section of `README.md`.
- **New pages**: document any new routes, scopes, or UI concepts.
- **API changes**: coordinate with the backend repository — API changes require updates in [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend).

PRs that introduce user-visible features without corresponding documentation updates will be asked to add documentation before merge.
