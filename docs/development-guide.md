---
generated: 2026-05-13
scan_level: deep
---

# Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22+ | Required by CI; earlier LTS may work |
| pnpm | 11.0.9 | **Required** — npm and yarn are not supported |

Install pnpm: https://pnpm.io/installation

---

## First-Time Setup

```bash
# Clone and install all workspace dependencies
pnpm install

# Build all internal packages (required before running the app)
turbo build
```

---

## Development Server

**Always start from the repo root using Turbo**, not from inside `apps/web`:

```bash
turbo dev
# App available at http://localhost:5173
```

> The `dependsOn: ["^build"]` Turborepo pipeline ensures `@nihonnohon/schema` and `@nihonnohon/story-loader` are built before Vite starts. Running `pnpm dev` from inside `apps/web` directly will fail if packages have not been built first.

If you change source files in `packages/schema` or `packages/story-loader`, rebuild them before the dev server reflects the changes:

```bash
turbo build
turbo dev
```

---

## Build

```bash
# Full monorepo build (packages first, then app)
turbo build

# Type-check all packages and the app
turbo typecheck
```

---

## Testing

### Unit Tests (Vitest)

```bash
# All packages + app
turbo test:unit

# App only
pnpm --filter @nihonnohon/web test:unit

# A single package
pnpm --filter @nihonnohon/story-loader test:unit
```

### E2E Tests (Playwright)

Install browsers once before the first run:

```bash
pnpm --filter @nihonnohon/web exec playwright install chromium firefox webkit
```

Run the full suite:

```bash
turbo test:e2e
# or from apps/web:
pnpm --filter @nihonnohon/web test:e2e
```

The E2E suite requires the app to be built. Turbo handles this via `dependsOn: ["build"]`.

### Lint + Type Check

```bash
turbo lint
turbo typecheck
```

---

## Data Build Scripts

These scripts are run once (or whenever the source data changes) to regenerate the static data files served from `public/`:

```bash
# Rebuild vocab.json from resources/genki1vocab.csv
pnpm build-vocab

# Rebuild kanji-data.json by fetching from kanjiapi.dev
pnpm build-kanji
```

These are also run as part of the CI pipeline (`pnpm build-vocab && pnpm build-kanji`) before linting and testing.

---

## Adding a Story

1. Place the story JSON in `apps/web/public/stories/`
2. Add an entry to `apps/web/public/stories/manifest.json`
3. No code changes required

Story JSON must conform to `packages/schema/schemas/story.v1.json`. Validate with:

```bash
python apps/story-generator/src/story_generator/validator.py path/to/story.json
```

---

## Code Organisation

| Code type | Location |
|-----------|----------|
| Shared TypeScript types | `packages/schema/src/types.ts` |
| Story JSON schema | `packages/schema/schemas/story.v1.json` |
| Story loading & validation | `packages/story-loader/src/` |
| React components | `apps/web/src/components/` |
| Route-level components | `apps/web/src/routes/` |
| Zustand stores | `apps/web/src/stores/` |
| Data services (vocab, kanji) | `apps/web/src/services/` |
| Pure utilities (no side effects) | `apps/web/src/utils/` |
| App-local TypeScript types | (see `@nihonnohon/schema`) |
| ADRs and project docs | `docs/` |

---

## Package Conventions

- **No barrel `index.ts` re-export files** — import source files directly.
- **`apps/web` imports compiled `@nihonnohon/*` outputs only** — never `../../packages/*/src/`. Enforced by `eslint-plugin-boundaries`.
- **`packages/` packages never import from `apps/`** — enforced by `eslint-plugin-boundaries`.
- **Tailwind utilities only** — no custom CSS classes except design token definitions in `tailwind.config.ts`.

---

## Schema Version Bump Contract

Breaking changes to `story.v1.json` require:

1. Increment `schema_version` enum (e.g. `"1"` → `"2"`)
2. Add a new loader: `packages/story-loader/src/v2.ts`
3. Register it in `packages/story-loader/src/index.ts`
4. Update `SCHEMA_CHANGELOG.md` in `packages/schema/`
5. Coordinate with the story-generator project

Non-breaking additions (new optional fields) do **not** require a version bump. `additionalProperties: false` must not be violated.

---

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every PR and push to `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm build-vocab && pnpm build-kanji`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. `pnpm run test:unit`
6. `playwright install --with-deps chromium firefox webkit`
7. `pnpm run test:e2e`
8. `pnpm run build`

All steps must pass before merging.

---

## Deployment

Deployed automatically to Vercel on merge to `main`. Configuration: `vercel.json` sets `rootDirectory: apps/web` and adds a SPA catch-all rewrite (`/(.*) → /index.html`).
