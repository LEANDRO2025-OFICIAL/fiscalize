# Contributing to fiscalize

Thank you for your interest in contributing! `fiscalize` is part of the **LS AGI BRASIL** GovTech initiative, providing open-source tooling for Brazilian public contract management and oversight under Law 14.133/2021.

## How to contribute

1. **Fork** the repository and create a feature branch (`git checkout -b feat/my-feature`).
2. **Write tests first** (TDD). Unit tests with Vitest, E2E with Playwright.
3. **Run the checks** before submitting:
   - `pnpm test` (unit tests)
   - `pnpm typecheck` (TypeScript)
   - `pnpm build` (production build)
   - `pnpm test:e2e` (end-to-end, optional)
4. **Open a Pull Request** with a clear description of the change.

## Code standards

- TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- pnpm workspaces monorepo (`apps/*`, `packages/*`).
- Drizzle ORM for database access; RLS for tenant isolation.
- Tailwind CSS for styling.
- Follow existing patterns (server components, RLS-scoped queries).

## Commit messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Reporting issues

Open an issue on GitHub with:
- A clear title and description.
- Steps to reproduce.
- Expected vs. actual behavior.
- Environment (Node version, pnpm version, OS).

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).