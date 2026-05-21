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

### Reader app

Start the development server from the repo root:

```bash
turbo dev
```

The app is available at `http://localhost:5173`.

**Important:** Always use `turbo dev` from the repo root, not `pnpm dev` from inside `apps/web`.
The Turborepo pipeline ensures packages are built and `vocab.json` is generated before the
dev server starts.

### AI Story Authoring Tool

The authoring tool has a React frontend and a Python (Google ADK) backend that must both be running. From `apps/story-generator-backend/`:

```bash
# First-time setup
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start both services (backend :8000, frontend :5174)
make dev
```

To run only the backend tests:

```bash
pytest
```

## Pre-commit hook

`pnpm install` automatically installs a git pre-commit hook (via [husky](https://typicode.github.io/husky/)).
The hook runs three checks before every commit:

```
lint → typecheck → test:unit
```

All three use Turbo, so results for unchanged packages are served from cache and typically
complete in under a second. A full run on a cold cache takes roughly 60 seconds.

If the hook blocks your commit, fix the reported errors before committing. Do not bypass the
hook with `--no-verify`.

To run the same checks manually at any time:

```bash
turbo lint && turbo typecheck && turbo test:unit
```

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

### Adding visual regression snapshot tests

Playwright's `toMatchSnapshot()` stores per-platform baseline PNGs. CI runs on Linux, so
Linux baselines must be committed alongside any new snapshot test. When you add a new
`toMatchSnapshot()` call, follow this one-time process to generate them:

1. Push your branch — CI will fail on the E2E step because the Linux PNGs don't exist yet.
2. Download the `playwright-actual-snapshots` artifact from the failed run:
   ```bash
   gh run download <run-id> --name playwright-actual-snapshots --dir /tmp/snapshots
   ```
3. Copy the `-linux.png` files into `apps/web/e2e/accessibility.spec.ts-snapshots/`:
   ```bash
   cp /tmp/snapshots/*linux*.png apps/web/e2e/accessibility.spec.ts-snapshots/
   ```
4. Commit and push — CI will pass on the next run.

The artifact is only uploaded when the E2E step fails, so it won't appear on green runs.

## Where does code go?

### Reader app (`apps/web`)

| Code type | Location |
|-----------|----------|
| React components | `apps/web/src/components/` |
| Route-level components | `apps/web/src/routes/` |
| Zustand stores | `apps/web/src/stores/` |
| Data services (vocab, kanji) | `apps/web/src/services/` |
| Pure utilities (no side effects) | `apps/web/src/utils/` |
| App-local TypeScript types | `apps/web/src/types.ts` |

### Story Authoring Tool

| Code type | Location |
|-----------|----------|
| React components | `apps/story-generator/src/components/` |
| Zustand authoring store | `apps/story-generator/src/stores/authoringStore.ts` |
| AG-UI / backend hooks | `apps/story-generator/src/hooks/` |
| FastAPI app & ADK agent | `apps/story-generator-backend/src/story_generator/` |
| Auto-generated Pydantic models | `apps/story-generator-backend/src/story_generator/models.py` |

### Shared packages

| Code type | Location |
|-----------|----------|
| Shared TypeScript types | `packages/schema/src/types.ts` |
| Story JSON schema | `packages/schema/schemas/story.v1.json` |
| Story loading & validation | `packages/story-loader/src/` |
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
# Requires jsonschema — available in the story-generator-backend venv
python -m jsonschema -i path/to/story.json packages/schema/schemas/story.v1.json
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

## License

This project is released under the [MIT License](./LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
