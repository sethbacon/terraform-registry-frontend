# Privacy Policy

_Last updated: 2025-01-01_

## 1. Introduction

This Privacy Policy explains how the Terraform Registry ("we", "us", "the
Service") collects, uses, and protects your personal data. We are committed to
complying with the General Data Protection Regulation (GDPR), the California
Consumer Privacy Act (CCPA), and other applicable data protection laws.

## 2. Data Controller

The data controller is the organization that deploys this instance of the
Terraform Registry. Contact your administrator for specific data controller
information.

## 3. Data We Collect

### 3.1 Account Data

When you create an account or authenticate via SSO/OIDC:

- Display name
- Email address
- Organization membership
- Authentication tokens (hashed)

### 3.2 Usage Data

When you interact with the Service:

- Module and provider downloads (counted, not individually attributed)
- API request logs (IP address, user agent, timestamp)
- Audit trail events (actions, actor, timestamp)

### 3.3 Telemetry Data (opt-in only)

If you opt in through the consent banner or Settings page:

| Category            | Data Collected                                      |
| ------------------- | --------------------------------------------------- |
| **Error reporting** | JavaScript errors, stack traces, browser/OS version |
| **Performance**     | Core Web Vitals (CLS, FCP, LCP, INP, TTFB)          |
| **Analytics**       | Page views, feature usage (anonymized)              |

Telemetry is **disabled by default** and requires explicit opt-in consent.

## 4. Legal Basis for Processing

| Purpose            | Legal Basis (GDPR Art 6)                     |
| ------------------ | -------------------------------------------- |
| Account management | Performance of contract (Art 6(1)(b))        |
| Audit logging      | Legitimate interest — security (Art 6(1)(f)) |
| Telemetry          | Consent (Art 6(1)(a))                        |
| Security scanning  | Legitimate interest — security (Art 6(1)(f)) |

## 5. Data Retention

| Data Type        | Retention Period                             |
| ---------------- | -------------------------------------------- |
| Account data     | Duration of account + 30 days after deletion |
| Audit logs       | Configurable (default: 90 days)              |
| API request logs | 30 days                                      |
| Telemetry data   | 90 days                                      |

Audit logs may be held longer under a legal hold — see
[docs/compliance](docs/compliance/) for details.

## 6. Your Rights

Under GDPR, you have the right to:

- **Access** your personal data (Art 15) — available via the admin API
  `GET /admin/users/:id/export`
- **Rectify** inaccurate data (Art 16) — via your profile settings
- **Erase** your data (Art 17) — via admin API
  `POST /admin/users/:id/erase` or by contacting your administrator
- **Restrict** processing (Art 18)
- **Data portability** (Art 20) — export endpoint provides JSON format
- **Object** to processing (Art 21)
- **Withdraw consent** at any time (Art 7(3)) — via the Settings page

## 7. Cookies

| Cookie                       | Purpose               | Duration   |
| ---------------------------- | --------------------- | ---------- |
| `terraform-registry-theme`   | UI theme (light/dark) | Persistent |
| `terraform-registry-consent` | Consent preferences   | Persistent |
| Session cookie (HttpOnly)    | Authentication        | Session    |

No third-party tracking cookies are used.

## 8. Data Transfers

Data residency depends on where this instance is deployed. For multi-region
deployments, see the backend's
[data residency guide](https://github.com/sethbacon/terraform-registry-backend/blob/main/docs/data-residency.md).

## 9. Security

We implement technical and organizational measures including:

- Encryption in transit (TLS 1.2+)
- Encryption at rest (AES-256 / KMS)
- Role-based access control
- Audit logging of administrative actions
- Automated security scanning of modules and providers

See [SECURITY.md](SECURITY.md) and [docs/threat-model.md](docs/threat-model.md)
for details.

## 10. Changes to This Policy

We may update this policy from time to time. Material changes will be announced
through the application's notification system. The "Last updated" date at the
top reflects the most recent revision.

## 11. Contact

For privacy-related inquiries, contact your instance administrator or open a
GitHub issue with the `privacy` label.
