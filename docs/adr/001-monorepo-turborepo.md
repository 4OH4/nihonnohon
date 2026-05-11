# ADR 001: Monorepo with Turborepo

**Status:** Accepted
**Date:** 2026-05-11

## Context

The nihonnohon project has multiple TypeScript packages with cross-dependencies:
`@nihonnohon/schema` defines shared types and the story JSON schema; `@nihonnohon/story-loader`
consumes the schema to validate and transform story JSON; `apps/web` consumes both packages.

Options considered:
- **Separate repos:** Each package in its own repository. Clean isolation but poor DX for
  cross-package development and no shared task caching.
- **Single package:** Everything in one package. Simple but no enforced boundary between
  the schema contract and the web app.
- **Turborepo + pnpm workspaces:** A monorepo with task caching, enforced package boundaries,
  and a single install step.

## Decision

Use Turborepo with pnpm workspaces. Packages `@nihonnohon/schema` and
`@nihonnohon/story-loader` are built independently via `tsup` and consumed by `apps/web`
via workspace linking. `eslint-plugin-boundaries` enforces that `packages/` never imports
from `apps/`, and that `apps/web` imports compiled package outputs only (never source files).

`turbo dev` from the repo root is the only supported dev entrypoint. Running `pnpm dev`
from inside `apps/web` directly is not supported (packages must be built first via the
`dependsOn: ["^build"]` pipeline).

## Consequences

- **Task caching:** `turbo build` is a no-op on unchanged packages, making repeated builds fast.
- **Enforced boundaries:** `eslint-plugin-boundaries` prevents accidental source-level imports
  across the package/app divide.
- **pnpm required:** npm and yarn are not supported; pnpm workspaces are the foundation.
- **Nx rejected:** Enterprise overhead not justified for this project size.
- **pnpm-only rejected:** No task caching without Turborepo.
- **`apps/story-generator` excluded from workspace:** It is a Python project and must not
  appear in `pnpm-workspace.yaml`.
