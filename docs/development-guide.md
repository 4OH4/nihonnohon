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

### PWA / Offline Tests

`pnpm dev` never registers a service worker. This is deliberate, so the default E2E suite
always runs without one. Offline behaviour can only be checked against a production build.

**Automated:** a separate Chromium-only suite in `apps/web/e2e-pwa/` builds the app and
serves it with `vite preview` on port 4173. It needs `vocab.json` and the built workspace
packages, so run `pnpm build` from the root once first.

```bash
# from apps/web
pnpm test:e2e:pwa
```

`precache.spec.ts` checks what the build precaches and the 10 MB budget. `offline.spec.ts`
loads the app online, goes offline and exercises the library, an unopened story, word
lookup, deep links and an uploaded story. The default `pnpm test:e2e` does not run this suite.

**Manually in Chrome:**

1. `pnpm build` (root), then `pnpm preview` in `apps/web`, and open `http://localhost:4173`.
2. DevTools → Application → Service workers: `sw.js` is *activated and is running*.
   Cache storage lists a `workbox-precache-v2-…` cache containing the stories, `vocab.json`
   and the fonts.
3. Reload once. The first visit is never controlled by the worker, because updates use prompt mode.
4. DevTools → Network → **Offline**, then reload and browse: open a story you have not opened
   yet and tap a word.

**Clean up afterwards:** Application → Storage → **Clear site data** for `localhost:4173`.
Otherwise the old worker keeps serving the previous build to later preview sessions. The dev
server on port 5173 is a different origin and is unaffected.

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

CI runs `pnpm build-vocab` only, before linting and testing — `vocab.json` is gitignored and must be generated on every run. `kanji-data.json` is committed to the repo, so `pnpm build-kanji` is a local, occasional task: run it when refreshing the kanji data and commit the result.

### PWA icons

The app icon set (favicon, apple-touch-icon, and the 64/192/512 and maskable PWA icons in `apps/web/public/`) is generated from one source, `apps/web/public/favicon.svg`, by `@vite-pwa/assets-generator` (config: `apps/web/pwa-assets.config.ts`). To change the artwork, edit the SVG, then regenerate and commit the PNGs and ICO:

```bash
# from apps/web
pnpm generate-pwa-assets
```

The generated files are committed; `pnpm build` does not regenerate them. Keep every mark inside the maskable safe zone, a central circle with a radius of 40% of the icon width, or launchers that crop to a circle will clip it. See [ADR 007](adr/007-pwa-offline.md) for the PWA design.

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
2. `pnpm build-vocab`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. `pnpm run test:unit`
6. `playwright install --with-deps chromium firefox webkit`
7. `pnpm run test:e2e`
8. `pnpm run build`
9. `pnpm --filter @nihonnohon/web test:e2e:pwa` (offline / service-worker suite, Chromium only)

All steps must pass before merging.

If the E2E step fails purely on stale Playwright snapshots, CI regenerates the Linux
baselines, commits them back to the branch, and re-verifies in the same run — so snapshot
drift self-heals rather than blocking. See
[CONTRIBUTING.md](../CONTRIBUTING.md#visual-regression-snapshot-tests) for details.

---

## Deployment

Deployed automatically to Vercel on merge to `main`. Configuration: `vercel.json` builds from the
monorepo root (`buildCommand: turbo build --filter=@nihonnohon/web`, `outputDirectory:
apps/web/dist`) and adds a SPA catch-all rewrite (`/(.*) → /index.html`).
