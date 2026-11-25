# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a vulnerability

If you discover a security vulnerability in `fiscalize`, please report it responsibly:

- **Email:** leowizz70@gmail.com
- **Subject:** `[SECURITY] fiscalize — <short description>`

Please do **not** open a public GitHub issue for security vulnerabilities. I will acknowledge your report within 72 hours and work on a fix as soon as possible. You will be credited in the release notes unless you prefer to remain anonymous.

## Scope

This platform handles public procurement contracts, measurements, evidence and audit trails. Security is a first-class concern:

- **Multi-tenant isolation** via Row-Level Security (RLS) in PostgreSQL — each organization only sees its own data.
- **Segregation of duties** — fiscal, controller and administrator roles with distinct permissions.
- **Audit trail** — hash-chained, tamper-evident event log (SHA-256).
- **Evidence integrity** — files stored with SHA-256 checksums.
- **No secrets in the repository** — all credentials via environment variables (see `.env.example`).

## Responsible disclosure

If you find a vulnerability that could expose tenant data, contract information or audit integrity, please report it immediately via email. Do not exploit it beyond what is necessary to demonstrate the issue.