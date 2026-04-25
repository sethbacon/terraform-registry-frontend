# CLAUDE.md — Terraform Registry Frontend

## Development Workflow

All changes follow this workflow. Do not deviate from it.

### Branches

- `main` — the single long-lived branch. All work branches off `main`; all PRs target `main`.
  **Must always exist — never delete.**
- Feature/fix branches are created from `main` and deleted after their PR is squash-merged.

```bash
# After a feature/fix PR is merged:
git push origin --delete fix/short-description   # remove remote branch
git branch -d fix/short-description              # remove local branch
git remote prune origin                          # prune stale remote-tracking refs
```

### Conventional Commits

PR titles (and ideally commit messages) must follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <description>
```

| Type | When to use | Version bump |
| ---- | ----------- | ------------ |
| `feat` | New user-facing feature | minor |
| `fix` | Bug fix | patch |
| `perf` | Performance improvement | patch |
| `refactor` | Code restructure (no behavior change) | none |
| `docs` | Documentation only | none |
| `test` | Adding or fixing tests | none |
| `ci` | CI/CD workflow changes | none |
| `chore` | Maintenance, deps, tooling | none |
| `deps` | Dependency updates | none |
| `security` | Security fix | patch |
| `revert` | Reverts a previous commit | patch |

Breaking changes: append `!` to the type (`feat!:`) **or** add a `BREAKING CHANGE:` footer.
These trigger a **major** version bump.

### Step-by-step

1. **Open a GitHub issue** describing the bug or feature before writing any code.

2. **Create a branch from `main`**:

   ```bash
   git fetch origin
   git checkout -b fix/short-description origin/main
   # or: feat/short-description, docs/topic, etc.
   ```

3. **Implement the change.**

4. **Commit — no co-author attribution**:

   ```bash
   git add <specific files>
   git commit -m "fix: short description of what was fixed

   Closes #<issue-number>"
   ```

   Do not add `Co-Authored-By:` trailers or `🤖 Generated with [Claude Code]` footers to
   commit messages or PR bodies.

5. **Push to origin**:

   ```bash
   git push -u origin fix/short-description
   ```

6. **Open a PR targeting `main`**:

   ```bash
   gh pr create --base main --title "fix: short description" --body "Closes #<issue>"
   ```

   - PR title must follow Conventional Commits — enforced by `pr-checks.yml`.
   - Squash-merge into `main` when approved.

### Releasing a version

Releases are fully automated via `release-please.yml`.

1. **Merge feature/fix PRs to `main`** as usual.

2. **release-please maintains an open release PR** titled
   `chore(main): release X.Y.Z`. It auto-updates `CHANGELOG.md` and
   `frontend/package.json` as commits accumulate. Review it at any time
   to see what will ship.

3. **When ready to release**, review and merge the release-please PR using a
   **squash merge** (GitHub default). release-please pushes the tag using the
   `terraform-registry-release-bot` GitHub App token.

4. **`release.yml` fires automatically** from the tag push (App token bypasses
   the `GITHUB_TOKEN` downstream-trigger limitation). It runs CI, builds and
   signs the Docker image, attests SLSA provenance, creates the GitHub Release,
   and updates the wiki version badge.

5. **Update deployment configs in the backend repo** to reference the new tag:

   **Helm chart** (in `deployments/helm/`):
   - `values.yaml` — update `frontend.image.tag`
   - `values-aks.yaml`, `values-eks.yaml`, `values-gke.yaml` — update `frontend.image.tag`

   **Kustomize overlays** (in `deployments/kubernetes/overlays/`):
   - `eks/kustomization.yaml` — update frontend `newTag`
   - `gke/kustomization.yaml` — update frontend `newTag`

#### Hotfix flow

For urgent fixes, create a `fix/` branch from `main`, open a PR, merge. release-please
will bump the patch version in the open release PR. Merge the release PR to ship.

#### Manual fallback

If `release-please.yml` fails, see [RELEASING.md](RELEASING.md) for the manual procedure.

---

## Project Overview

React 19 TypeScript SPA (single-page application) for the Enterprise Terraform Registry.

Backend API lives in a separate repository: [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend)

---

## Repository Structure

```txt
terraform-registry-frontend/
├── frontend/                 # React 19 TypeScript SPA (Vite + Material-UI v7)
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
    ├── docker-compose.yml       # Local dev stack (VITE_MODE=development, DEV_MODE=true)
    ├── docker-compose.test.yml  # E2E/CI stack (HTTPS frontend, seeds DB, DEV_MODE=true)
    └── docker-compose.prod.yml  # Production overrides (published images, DEV_MODE=false)
```

---

## Tech Stack

| Concern    | Technology                          |
| ---------- | ----------------------------------- |
| Language   | TypeScript 5.7.2 (strict mode)      |
| Framework  | React 19                            |
| Build Tool | Vite 6.1.11                         |
| UI         | Material-UI v7 + Emotion            |
| HTTP       | Axios 1.6.7                         |
| Router     | React Router v6                     |
| Markdown   | react-markdown + remark-gfm         |
| Linting    | ESLint 9 with TypeScript ESLint     |
| Formatting | Prettier 3 (eslint-config-prettier) |
| E2E Tests  | Playwright                          |

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

# Format code with Prettier
npm run format

# Check formatting (CI — fails on unformatted files)
npm run format:check

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

### Docker Compose environments

| Compose file                                     | Purpose           | Frontend mode                     | Backend DEV_MODE |
| ------------------------------------------------ | ----------------- | --------------------------------- | ---------------- |
| `docker-compose.yml`                             | Local development | `development` (Dev Login enabled) | `true`           |
| `docker-compose.test.yml`                        | E2E testing / CI  | `development` (Dev Login enabled) | `true`           |
| `docker-compose.yml` + `docker-compose.prod.yml` | Production        | `production` (published image)    | `false`          |

```bash
cd deployments

# Local development — backend + frontend (DEV_MODE=true, VITE_MODE=development)
docker compose up -d
# Frontend: https://localhost:3000 (self-signed cert)  |  Backend API: http://localhost:8080

# E2E / CI test stack — pulls backend from ghcr.io, HTTPS frontend for Playwright
docker compose -f docker-compose.test.yml up -d --build
# Frontend: https://localhost:3000  |  Playwright baseURL default matches

# Use a locally built backend (e.g. unpublished migration):
#   cd ../../terraform-registry-backend/deployments && docker compose build backend
#   BACKEND_IMAGE=deployments-backend docker compose -f docker-compose.test.yml up -d
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

---

## Repository Security Hardening (applied 2026-04-09)

### Branch Protection

**`main` branch:**

- Required status checks (strict — branch must be up-to-date): `Frontend Lint & Build`
- Required pull request reviews: 1 approving review, dismiss stale reviews, require code owner review
- Enforce admins: no (admin/owner can bypass review requirements as sole maintainer)
- Required conversation resolution: yes
- Force pushes: blocked
- Branch deletion: blocked

**`development` branch (historical — now deleted):**

- Required status checks (non-strict): `Frontend Lint & Build`
- Required linear history: yes
- Required conversation resolution: yes
- Force pushes: blocked
- Branch deletion: blocked
- Admin bypass: allowed (owner can push directly for admin tasks)

### Merge Strategy

- **Squash merge** — default for feature/fix branches → `development`
- **Merge commits** — used for release PRs (`development` → `main`) to preserve commit ancestry and prevent CHANGELOG conflicts
- **Rebase merges** — disabled
- **Delete branch on merge** — enabled; feature/fix branches are cleaned up automatically
- **Allow update branch** — enabled; PRs can pull in base branch changes via GitHub UI
- **Web commit signoff required** — enabled; all web-based commits require DCO signoff

> **GitHub repo settings required:** Both "Allow merge commits" and "Allow squash merging"
> must be enabled. "Allow rebase merging" remains disabled.

### Dependency Management

- **Dependabot vulnerability alerts** — enabled
- **Dependabot automated security fixes** — enabled
- **Dependabot version updates** — configured via `.github/dependabot.yml` for npm (frontend + e2e) and GitHub Actions (biweekly)

### Code Ownership

- **CODEOWNERS** file at `.github/CODEOWNERS` — `@sethbacon` owns all files; `frontend/`, `.github/`, `deployments/`, and `e2e/` require explicit owner review

### Security Features (GitHub)

- Secret scanning: enabled
- Secret scanning push protection: enabled
- `npm audit --audit-level=high` in Dockerfile and scheduled workflow
- rehype-sanitize for Markdown rendering (XSS mitigation)
- All GitHub Actions pinned to full commit SHAs
- Scheduled weekly builds with auto-issue on failure
- **SLSA provenance attestation** on Docker images via `actions/attest-build-provenance`
- **Cosign keyless signing** on Docker images via Sigstore (verify with `cosign verify`)

### Repository Topics

`terraform`, `terraform-registry`, `react`, `typescript`, `material-ui`, `vite`, `private-registry`

### Tag Protection Rule (documented 2026-04-13)

To protect release tags (`v*.*.*`) from deletion, apply a repository ruleset via the GitHub CLI or UI:

```bash
gh api repos/{owner}/{repo}/rulesets --method POST \
  --field name="Protect release tags" \
  --field target=tag \
  --field enforcement=active \
  --field 'conditions[ref_name][include][]=refs/tags/v*.*.*' \
  --field 'rules[][type]=deletion'
```

Alternatively, in the GitHub UI: **Settings > Rules > Rulesets > New ruleset** targeting tags matching `v*.*.*` with a "Restrict deletions" rule.

### Remaining Recommendations (not yet applied)

- **Enable secret scanning non-provider patterns and validity checks** for broader secret detection
