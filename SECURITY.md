# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

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

## License

This project is licensed under the [Apache License 2.0](LICENSE).
