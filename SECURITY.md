<!-- markdownlint-disable MD013 -->
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

The frontend is released as a matched pair with the backend. See the
[backend compatibility matrix](https://github.com/sethbacon/terraform-registry-backend/blob/main/deployments/COMPATIBILITY.md)
for the canonical version pairings.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use one of the following channels:

1. **GitHub Security Advisories** (preferred): Use the [Report a Vulnerability](https://github.com/sethbacon/terraform-registry-frontend/security/advisories/new) feature on this repository.
2. **Email**: Contact the maintainer directly at the email address listed on their GitHub profile.

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### What to expect

- **Acknowledgment**: Within 48 hours of your report.
- **Status update**: Within 7 days with an assessment and remediation timeline.
- **Resolution**: Security patches are prioritized and typically released within 30 days of confirmation.

### Scope

The following are considered in-scope:

- Cross-site scripting (XSS) in the frontend
- Authentication or authorization bypasses
- Sensitive data exposure (tokens, credentials)
- Dependency vulnerabilities with a known exploit path

The following are out of scope:

- The backend API (see [terraform-registry-backend](https://github.com/sethbacon/terraform-registry-backend) for its security policy)
- Vulnerabilities that require physical access to the server
- Social engineering attacks

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).
We will credit reporters in the release notes unless anonymity is requested.

## Security Practices

- All releases are signed with [cosign](https://github.com/sigstore/cosign) (keyless, Sigstore) and include SLSA build provenance attestations
- Dependencies are monitored by Dependabot, weekly (npm — frontend + e2e —, Docker, and GitHub Actions)
- `npm audit --audit-level=high` runs in the Docker build, on every pull request, and in the scheduled security workflow
- Markdown rendering is sanitised with `rehype-sanitize` (XSS mitigation)
- `ApiDocumentation.tsx` renders the same-origin `/swagger.json` spec via `swagger-ui-react`, relying on that dependency's bundled DOMPurify-based sanitizer rather than app-side sanitization. This is a tracked residual-trust item, not an active vuln: the spec is server-controlled, and the mitigation is keeping `swagger-ui-react` patched (covered by the weekly `npm audit`/Dependabot workflow) plus ensuring the backend never reflects user-controlled strings into spec description/example fields
- The frontend follows OWASP Top 10 mitigations applicable to SPAs (output encoding, strict CSP via nginx, no `dangerouslySetInnerHTML` outside the sanitised renderer)
- HSTS (`Strict-Transport-Security`) is sent by `nginx.conf`, which terminates TLS directly. `nginx-ecs.conf.template` (ECS/Cloud Run/ACA) and any deployment that fronts the container with an external reverse proxy/ALB (see `deployments/docker-compose.prod.yml`) deliberately do **not** set it themselves -- HSTS only has effect on the hop that actually terminates TLS, so it must be configured at that edge/ALB, not on the origin container behind it
- Authentication uses an HttpOnly session cookie set by the backend (no JWT is ever persisted in `localStorage`); mutating requests are protected by a double-submit CSRF token (the `tfr_csrf` cookie echoed in an `X-CSRF-Token` header)

## Repository Hardening

The following GitHub repository controls are configured for `main` to protect
the release pipeline and supply chain:

### Branch Protection (`main`)

- Required status checks (strict — branch must be up-to-date): `Lint`, `Typecheck`, `Unit Tests (1/4)`..`(4/4)`, `Unit Test Coverage`, `Contract Check`, `Build`, `Conventional PR Title`, `E2E (security subset)`
  - `E2E (security subset)` (the XSS/CSRF/open-redirect abuse suite in `e2e/tests/security.spec.ts`) was added on every PR so a regression in that control is caught before merge instead of only in the release-gated full E2E run (#604). The branch protection rule on GitHub must be updated by a repo admin to add this context to the required list above.
  - `Dependency Audit` (`npm audit --audit-level=high`, frontend + e2e) also now runs on every PR (#598), closing the weekly-only blind spot for anything not yet GHSA-listed. It is deliberately **not** on the required-checks list yet: as of this writing `frontend`'s resolved dependency tree has pre-existing high-severity advisories (`brace-expansion` via the eslint toolchain, GHSA-mh99-v99m-4gvg; `react-router` via the direct `react-router-dom` dependency, GHSA-qwww-vcr4-c8h2) with no non-breaking fix available, so the check fails today independent of any PR's own content. Promote it to required once those advisories are cleared through the normal Dependabot update flow -- adding it as required before then would block every PR regardless of content.
- Required pull request reviews: 1 approving review, dismiss stale reviews, require code-owner review
- Required conversation resolution: yes
- Force pushes: blocked; branch deletion: blocked

### Merge Strategy

- **Squash merge only** — rebase merges and merge commits are disabled
- Delete branch on merge: enabled
- Allow update branch: enabled
- Web commit signoff (DCO) required for web-based commits

### Tag Protection

Release tags matching `v*.*.*` are protected from deletion via a repository
ruleset. To re-apply via the GitHub CLI:

```bash
gh api repos/{owner}/{repo}/rulesets --method POST \
  --field name="Protect release tags" \
  --field target=tag \
  --field enforcement=active \
  --field 'conditions[ref_name][include][]=refs/tags/v*.*.*' \
  --field 'rules[][type]=deletion'
```

Or in the UI: **Settings → Rules → Rulesets → New ruleset** targeting tags
matching `v*.*.*` with a "Restrict deletions" rule.

### Dependency Management

- Dependabot vulnerability alerts: enabled
- Dependabot automated security fixes: enabled
- Dependabot version updates configured via `.github/dependabot.yml` for npm
  (frontend + e2e), Docker (frontend), and GitHub Actions -- all weekly
  (Mondays)

### Code Ownership

- `.github/CODEOWNERS` requires explicit owner review for `frontend/`,
  `.github/`, `deployments/`, and `e2e/`

### Supply-Chain Security

- All GitHub Actions are pinned to full commit SHAs. Some are pinned **in this repository**
  (`.github/workflows/`) and some in the shared workflows this repository calls — see
  *Shared CI workflows* below. Checking only `.github/workflows/` no longer verifies this
  claim on its own, which is the point of recording the relationship.
- Secret scanning + push protection: enabled
- `npm audit --audit-level=high` in Dockerfile, on every pull request, and in the scheduled security workflow
- `rehype-sanitize` for Markdown rendering (XSS mitigation)
- Scheduled weekly security workflow with auto-issue on failure
- **OSV-Scanner findings are filed, not just logged**: the weekly `OSV Scan` job maintains a single tracking issue carrying the `osv-report` label, naming every high/critical advisory (id, severity, package, installed version, minimal fix, lockfile). It is rewritten in place while the findings persist, comments what changed when the set changes, and closes itself once a scan reports none. An unreadable or absent scan report fails the job rather than reading as clean. Logic and tests: `frontend/scripts/osv-report.mjs`
- **SLSA provenance attestation** on Docker images via `actions/attest-build-provenance`
- **SBOM (SPDX) generation and attestation** on Docker images via Syft (`anchore/sbom-action`) and `actions/attest-sbom`
- **Cosign keyless signing** on Docker images via Sigstore (verify with `cosign verify`)

### Backend-supplied URLs and the external-origin allowlist

Several URLs reaching this app come from the backend rather than from user input:
the suite-sibling switcher link and the Consumed-by panel link (`GET /api/v1/ui/config`),
the whitelabel logo/hero/favicon URLs (`GET /api/v1/ui/theme`), and the SCM OAuth
authorization redirect. They are validated at the app boundary by
`isSafeExternalUrl` (`frontend/src/utils/externalUrl.ts`) before reaching any
navigation or resource sink.

That validator always rejects dangerous URI schemes (`javascript:`, `data:`,
`vbscript:`, `file:`, …), protocol-relative URLs, and control-character smuggling.

**Origin allowlist.** Set `VITE_ALLOWED_EXTERNAL_ORIGINS` (comma-separated) to the
origins this deployment should be willing to link or redirect to; the app's own
origin is always permitted. Matching is on full origin — scheme, host and port.
It is build-time configuration on purpose: the risk being mitigated is a
**compromised or misconfigured backend** returning an attacker-controlled URL, so
an allowlist the backend could influence would mitigate nothing.

**Accepted risks** (issue #559):

1. **`http:` is accepted alongside `https:`.** Requiring HTTPS would break three
   supported cases, two of them silently: a locally-running suite sibling (the
   backend's development default is `base_url: http://localhost:8080`, so the
   switcher and Consumed-by links would simply disappear), whitelabel assets
   served over plain HTTP (they degrade to defaults with no indication why), and
   OAuth against a self-hosted SCM on an internal network — Bitbucket Data
   Center, self-hosted GitLab and Azure DevOps Server are supported targets and
   are not always TLS-fronted internally. The origin allowlist, not the scheme
   check, is the control that constrains *where* the app will navigate.
2. **The allowlist is inert when unset.** The default preserves prior behaviour —
   any `http(s)` origin is accepted — so that upgrading does not silently break
   deployments whose sibling and asset origins are not yet declared. Any
   deployment where those origins are known should set the variable; until it is
   set, a backend able to return an arbitrary URL can point these sinks at an
   arbitrary host.

### Shared package: `@4cloudguru/cloud-suite-ui`

This app depends on the out-of-tree package
[`@4cloudguru/cloud-suite-ui`](https://github.com/4cloudguru/cloud-suite-ui)
(public, npmjs), which carries **load-bearing security code**
shared across the Terraform Suite apps: the authentication/session provider
(`SuiteAuthProvider` — session lifecycle, expiry warnings, scope checks),
the GDPR consent provider, the theme provider, and the app shell/navigation.
Local files under `src/contexts/` and several `src/components/` are thin
wrappers around it (see the "Shared Suite Package" section of
`ARCHITECTURE.md` for the full mapping).

Because a compromised or regressed publish of this package would affect
authentication in every consuming app, it is subject to the following
controls:

- **Exact version pin** — `package.json` pins the package to an exact
  version (no semver range), and `package-lock.json` enforces the tarball's
  `sha512` integrity. A malicious re-publish of the same version cannot be
  installed without an integrity failure, and a new version cannot arrive
  via a routine floating-range install.
- **Audited** — the package received the same blind security audit
  methodology as this repo on 2026-07-10 (26 findings: 2 high, 16 medium,
  remainder low/info). All findings were remediated in
  [v0.5.3](https://github.com/4cloudguru/cloud-suite-ui/releases/tag/v0.5.3)
  (2026-07-11). The pin has moved past v0.5.3 since then via the manual,
  reviewed update process below -- see `frontend/package.json` for the
  exact version currently pinned, rather than relying on a version number
  in this doc that would go stale on the next bump. The package repo now
  carries its own `SECURITY.md` and a security-model section in its README.
- **Upstream supply-chain gates** — the package's own CI runs typecheck,
  tests, build, and CodeQL; its publish workflow verifies the tarball
  contains only `dist/` + docs before publishing and attaches a build
  provenance attestation (`actions/attest-build-provenance`) to each
  release.
- **Manual, reviewed updates** — this dependency is deliberately held
  outside Dependabot's reach by an explicit `@4cloudguru/*` `ignore` rule in
  `.github/dependabot.yml`: it is released and version-pinned in lockstep with
  the rest of the suite, out of band. Version bumps are manual PRs that must
  update the exact pin and lockfile together and review the upstream
  [CHANGELOG](https://github.com/4cloudguru/cloud-suite-ui/blob/main/CHANGELOG.md)
  for auth/consent-relevant changes.

## Shared CI workflows

Part of this repository's CI is **defined in another repository** — [`4cloudguru/shared-workflows`](https://github.com/4cloudguru/shared-workflows) — and called from `.github/workflows/`. That is a real supply-chain relationship, and it is recorded here so an audit of this repository does not stop at this repository's own tree.

**What runs, and where it is pinned.** Each caller in `.github/workflows/` names the shared workflow on its `uses:` line, pinned to a full 40-hex commit SHA with a trailing comment naming the release that SHA is. The tag is a label; the SHA is what runs. An unlabelled SHA is rejected by the workflow-hardening gate, because a bare 40-hex ref cannot be reviewed or updated deliberately.

**Why the pins have to agree across repositories.** A shared definition drifts differently from a duplicated file: every repository looks like it is using "the shared one" while sitting on different commits, which is *harder* to see than divergent files, not easier. A signature in `security-orchestration` (`shared-workflow-pin-parity`) reports **disagreement** between callers of the same shared workflow — it reports disagreement rather than staleness, because a repository deliberately held back is a decision while N repositories disagreeing without anyone deciding is drift.

**What the shared repository is itself protected by.** Its `main` requires its own zizmor and actionlint checks with `enforce_admins` enabled, restricts which third-party actions may run to an explicit allowlist, issues a read-only default `GITHUB_TOKEN`, and runs the workflow-hardening gate against itself.

**What this repository still controls.** Triggers, concurrency, and the secrets it passes. Secrets are passed **by name** — never `secrets: inherit`, which would forward every secret in this repository to a workflow owned by someone else. Any `vars.*` a shared workflow reads resolve against **this** repository, so credentials and their installation scope do not move.
