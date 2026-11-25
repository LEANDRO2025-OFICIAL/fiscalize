# fiscalize — Open-source Brazilian public contract management & oversight

[![CI](https://github.com/LEANDRO2025-OFICIAL/fiscalize/actions/workflows/ci.yml/badge.svg)](https://github.com/LEANDRO2025-OFICIAL/fiscalize/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

> **EN** — Open-source platform for managing and overseeing Brazilian public procurement contracts under **Law 14.133/2021**: contract registration (manual or PNCP import), items, fiscal designation, measurements with per-item balance, glosa, approval with segregation of duties, receipt, evidence (PDF/TXT/Word/PNG/JPG) with SHA-256, occurrences with photo and geolocation, 3D works map, tamper-evident audit trail, and a **PDF dossier for the Court of Accounts (TCE)**. Multi-tenant with Row-Level Security. Maintained by [LEANDRO2025-OFICIAL](https://github.com/LEANDRO2025-OFICIAL).

> **PT-BR** — Plataforma open-source para gestão e fiscalização de contratos públicos conforme a **Lei 14.133/2021**: cadastro de contratos (manual ou importação do PNCP), itens, designação de fiscal, medições com saldo por item, glosa, aprovação com segregação de funções, recebimento, evidências (PDF/TXT/Word/PNG/JPG) com SHA-256, ocorrências com foto e geolocalização, mapa 3D da obra, trilha de auditoria encadeada e **dossiê em PDF para o Tribunal de Contas (TCE)**. Multi-tenant com Row-Level Security. Mantido por [LEANDRO2025-OFICIAL](https://github.com/LEANDRO2025-OFICIAL).

## Why this matters / Por que importa

Brazilian public contract oversight is one of the most audit-intensive activities in public administration. Fiscal agents must track measurements, glosas, receipts, evidence and occurrences for every contract, and produce a complete dossier for the Court of Accounts (TCE/TCM/TCU). Most of this is still done with spreadsheets and paper, leading to audit findings, fines and nullified contracts.

`fiscalize` provides a complete, auditable, multi-tenant platform with:
- **Segregation of duties** (fiscal / controller / administrator).
- **Tamper-evident audit trail** (hash-chained SHA-256 events).
- **Evidence integrity** (SHA-256 checksums on every uploaded file).
- **Row-Level Security** (PostgreSQL RLS) — each organization only sees its own data.
- **PNCP integration** (read-only import of public contracts).

## Features / Funcionalidades

- Contracts: manual registration or PNCP import
- Items and fiscal designation
- Measurements: per-item balance, glosa, approval with segregation of duties, receipt
- Evidence (PDF, TXT, Word, PNG, JPG) with SHA-256
- Occurrences with photo and geolocation
- 3D works map (MapLibre)
- Tamper-evident audit trail (hash-chained)
- PDF dossier for the Court of Accounts
- Multi-tenant with Row-Level Security
- Supplier portal (read-only view by CNPJ)

## Quick start / Início rápido

Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL 16 (or Docker).

```sh
git clone https://github.com/LEANDRO2025-OFICIAL/fiscalize.git
cd fiscalize
pnpm install
cp .env.example .env   # set DATABASE_URL, DIRECT_DATABASE_URL, AUTH_SECRET
pnpm db:migrate && pnpm db:seed   # demo users, password Demo@2026
pnpm dev   # http://localhost:3000
```

Or with Docker:

```sh
docker compose up -d
```

## Tests / Testes

```sh
pnpm test          # unit tests (Vitest)
pnpm typecheck     # TypeScript strict
pnpm build         # production build
pnpm test:e2e      # end-to-end (Playwright)
```

## Architecture / Arquitetura

Monorepo (pnpm workspaces):
- `apps/web` — Next.js 16 (App Router) web application
- `packages/db` — Drizzle ORM schema, migrations, RLS
- `packages/domain` — business logic (measurements, designation)
- `packages/audit` — SHA-256, canonical JSON, hash-chained audit events
- `e2e` — Playwright end-to-end tests
- `docs` — documentation

## Contributing / Contribuindo

Pull requests are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first. This project follows a TDD-first workflow.

## Security / Segurança

See [SECURITY.md](./SECURITY.md) for the security policy and responsible disclosure.

## License

MIT — see [LICENSE](./LICENSE).

## Maintainer / Mantenedor

Leandro Santos — [LEANDRO2025-OFICIAL](https://github.com/LEANDRO2025-OFICIAL) — leowizz70@gmail.com

Part of the **LS AGI BRASIL** GovTech initiative (open-sourcing Brazilian public-contract tooling).