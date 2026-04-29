# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

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
- Dependencies are monitored by Dependabot (npm — frontend + e2e — and GitHub Actions)
- `npm audit --audit-level=high` runs in the Docker build and the scheduled security workflow
- Markdown rendering is sanitised with `rehype-sanitize` (XSS mitigation)
- The frontend follows OWASP Top 10 mitigations applicable to SPAs (output encoding, strict CSP via nginx, no `dangerouslySetInnerHTML` outside the sanitised renderer, JWT stored with conservative defaults)

## Repository Hardening

The following GitHub repository controls are configured for `main` to protect
the release pipeline and supply chain:

### Branch Protection (`main`)

- Required status checks (strict — branch must be up-to-date): `Lint`, `Typecheck`, `Unit Tests`, `Contract Check`, `Build`, `Conventional PR Title`
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
  (frontend + e2e) and GitHub Actions (biweekly)

### Code Ownership

- `.github/CODEOWNERS` requires explicit owner review for `frontend/`,
  `.github/`, `deployments/`, and `e2e/`

### Supply-Chain Security

- All GitHub Actions pinned to full commit SHAs
- Secret scanning + push protection: enabled
- `npm audit --audit-level=high` in Dockerfile and the scheduled security workflow
- `rehype-sanitize` for Markdown rendering (XSS mitigation)
- Scheduled weekly security workflow with auto-issue on failure
- **SLSA provenance attestation** on Docker images via `actions/attest-build-provenance`
- **Cosign keyless signing** on Docker images via Sigstore (verify with `cosign verify`)
