# Contributing to Nihon no Hon

## First-time setup

1. Install [pnpm](https://pnpm.io/) (required — npm and yarn are not supported)
2. Clone the repo and install dependencies:
   ```bash
   pnpm install
   ```
3. Build all packages:
   ```bash
   turbo build
   ```

## Development

Start the development server from the repo root:

```bash
turbo dev
```

The app is available at `http://localhost:5173`.

**Important:** Always use `turbo dev` from the repo root, not `pnpm dev` from inside `apps/web`.
The Turborepo pipeline ensures packages are built and `vocab.json` is generated before the
dev server starts.

## Testing

```bash
turbo test:unit     # run Vitest unit tests across all packages
turbo test:e2e      # run Playwright e2e tests (requires the app to build first)
turbo lint          # run ESLint across all packages
turbo typecheck     # run TypeScript type checking across all packages
```

For Playwright to run locally, install browsers once:

```bash
pnpm --filter @nihonnohon/web exec playwright install chromium firefox webkit
```

## Where does code go?

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
| App-local TypeScript types | `apps/web/src/types.ts` |
| ADRs and project docs | `docs/` |

## Package conventions

- **No barrel `index.ts` re-export files** — import source files directly.
- **`apps/web` imports compiled `@nihonnohon/*` package outputs only** — never
  `../../packages/*/src/`. This boundary is enforced by `eslint-plugin-boundaries`.
- **`packages/` packages never import from `apps/`** — enforced by `eslint-plugin-boundaries`.
- **Tailwind utilities only** — no custom CSS classes except design token definitions in
  `tailwind.config.ts`.

## Adding a story

To add a story to the built-in library:

1. Place the story JSON in `apps/web/public/stories/`
2. Add an entry to `apps/web/public/stories/manifest.json`
3. No code changes required

Story JSON must conform to `packages/schema/schemas/story.v1.json`. Validate with:

```bash
python apps/story-generator/src/story_generator/validator.py path/to/story.json
```

## Schema version bump contract

Breaking changes to `story.v1.json` require:

1. Increment `schema_version` (e.g. `"1"` → `"2"`)
2. Add a new loader in `packages/story-loader/src/v2.ts`
3. Register it in `packages/story-loader/src/index.ts`
4. Update `SCHEMA_CHANGELOG.md` in `packages/schema/`
5. Coordinate with the story-generator project to update its validation

Non-breaking additions (new optional fields) do **not** require a version bump.
`additionalProperties: false` must not be violated.
