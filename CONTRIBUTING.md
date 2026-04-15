# Contributing to Terraform Registry — Frontend

Thank you for your interest in contributing to the frontend UI and E2E test suite.

## Table of Contents

- [Contributing to Terraform Registry — Frontend](#contributing-to-terraform-registry-%E2%80%94-frontend)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Fork and Clone](#fork-and-clone)
    - [Local Setup](#local-setup)
  - [Development Workflow](#development-workflow)
    - [Branch Naming](#branch-naming)
    - [Commit Messages](#commit-messages)
  - [Frontend (TypeScript) Standards](#frontend-(typescript)-standards)
    - [Linting](#linting)
    - [Conventions](#conventions)
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

- Node.js 22+ (LTS) and npm
- Docker and Docker Compose (for running the backend during development)

### Fork and Clone

```bash
git clone https://github.com/sethbacon/terraform-registry-frontend.git
cd terraform-registry-frontend
```

### Local Setup

Start the local dev stack (pulls backend from ghcr.io, builds frontend with Dev Login enabled):

```bash
cd deployments
docker compose up -d
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

| Type          | Pattern                  | Example                      |
| ------------- | ------------------------ | ---------------------------- |
| Feature       | `feat/short-description` | `feat/mirror-status-page`    |
| Bug fix       | `fix/issue-description`  | `fix/api-key-expiry-display` |
| Documentation | `docs/topic`             | `docs/e2e-setup`             |
| Refactor      | `refactor/area`          | `refactor/auth-context`      |

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
# Frontend: must lint, typecheck, test, and build clean
cd frontend
npm run lint
npx tsc --noEmit
npm test
npm run build
```

### What needs tests

| Change type | Required tests |
| ----------- | -------------- |
| New component | Unit test in `components/__tests__/ComponentName.test.tsx` |
| New hook | Unit test in `hooks/__tests__/hookName.test.ts` with `renderHook` + `QueryClientProvider` wrapper |
| New context | Unit test in `contexts/__tests__/ContextName.test.tsx` |
| New service function | Unit test in `services/__tests__/serviceName.test.ts` |
| New utility | Unit test in `utils/__tests__/utilName.test.ts` |
| New page / user flow | E2E spec in `e2e/tests/feature-name.spec.ts` |
| Bug fix | Regression test covering the fixed behavior |

Tests must pass with `npm test`. Coverage thresholds are enforced at 40% (statements, branches, functions, lines) via `vitest.config.ts` and will increase over time.

For detailed test patterns and examples, see [TESTING.md](TESTING.md).

---

## Data Fetching: React Query Patterns

All server state should use React Query (`@tanstack/react-query`), not `useState` + `useEffect` for data fetching.

### Preferred pattern

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import api from '../services/api';

// Reading data
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.users.list({ page: 1 }),
  queryFn: () => api.listUsers(1, 20),
});

// Mutating data
const queryClient = useQueryClient();
const createUser = useMutation({
  mutationFn: (data: CreateUserInput) => api.createUser(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users._def });
  },
});
```

### Query keys

Query keys are defined in `services/queryKeys.ts` using a factory pattern. Each domain has a `_def` base key and specific sub-keys:

```ts
queryKeys.modules.search({ query: 'vpc', limit: 10, offset: 0, viewMode: 'grid' })
// → ['modules', 'search', { query: 'vpc', ... }]

queryKeys.users.detail('user-123')
// → ['users', 'detail', 'user-123']
```

When adding a new domain, add its keys to `queryKeys.ts` following the existing pattern. Mutations should invalidate the `_def` key to refresh all related queries.

### Anti-pattern (do not use for server state)

```tsx
// BAD: manual fetch with useState + useEffect
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  api.listFoo().then(setData).finally(() => setLoading(false));
}, []);
```

Some older admin pages still use this pattern and are being migrated. New code should always use React Query.

---

## Component File Organization

```
frontend/src/
  components/          # Shared, reusable UI components
    __tests__/         # Component unit tests
    Layout.tsx         # App shell (sidebar + topbar + outlet)
    ProtectedRoute.tsx # Auth guard wrapper
    ErrorBoundary.tsx  # Error boundary with fallback UI
    ...
  contexts/            # React Context providers (auth, theme, help)
    __tests__/
  hooks/               # Custom React hooks
    __tests__/
  pages/               # Route-level page components
    __tests__/
    admin/             # Admin-only pages (behind ProtectedRoute)
  services/            # API client, query keys, error reporting
    __tests__/
  types/               # TypeScript type definitions
  utils/               # Pure utility functions
    __tests__/
```

**Conventions**:
- One component per file. File name matches the exported component/function.
- Tests live in a `__tests__/` directory alongside the source, named `SourceFile.test.ts(x)`.
- New pages go in `pages/` (public) or `pages/admin/` (admin). Register the route in `App.tsx`.
- Admin routes must be wrapped in `<ProtectedRoute requiredScope="...">`.

---

## Code Style

- **TypeScript strict mode** is enforced. Avoid `any` types; if unavoidable, add a comment explaining why.
- **ESLint** runs with zero warnings (`npm run lint`). No `// eslint-disable` without a comment justifying it.
- **No unused variables or imports**. ESLint catches these.
- **All API calls** go through `services/api.ts`. Never use `fetch` or create separate Axios instances.
- **MUI TextField inputs** for non-obvious fields must include a `helperText` prop.
- **Imports**: prefer named imports. Group imports: React/external libraries first, then internal modules.

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
