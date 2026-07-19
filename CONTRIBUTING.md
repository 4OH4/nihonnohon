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

### Visual regression snapshot tests

Playwright's `toMatchSnapshot()` stores per-platform baseline PNGs in
`apps/web/e2e/accessibility.spec.ts-snapshots/`. CI runs on Linux, so the committed
baselines are the Linux (`-linux.png`) variants.

**You normally don't generate these by hand.** When you push a branch that changes the
rendered UI or adds a new `toMatchSnapshot()` call, CI heals the baselines automatically:

1. The `E2E tests` step fails on the mismatch (or missing baseline).
2. CI re-runs Playwright with `--update-snapshots`, commits the regenerated PNGs as
   `chore(e2e): update playwright linux snapshots [skip ci]`, and pushes them back to your
   branch.
3. It re-runs the E2E suite to verify. If the snapshots were the only difference, the run
   goes green in the same pass; a genuine test regression still fails the build.

After CI heals a branch, run `git pull` to bring the auto-committed baselines into your
local checkout before pushing again (otherwise your next push is rejected as
non-fast-forward).

**Fork PRs:** the auto-commit pushes using the `SNAPSHOT_PUSH_TOKEN` secret, which is not
available to pull requests from forks. For a fork PR, either a maintainer runs the
**Update Playwright Snapshots** workflow (`workflow_dispatch`, see
[`.github/workflows/update-snapshots.yml`](.github/workflows/update-snapshots.yml)) against
the branch, or you regenerate the `-linux.png` baselines locally (e.g. via the Playwright
Docker image) and commit them.

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

## Maintainers

### Snapshot auto-heal infrastructure

The CI snapshot auto-heal (see [Visual regression snapshot tests](#visual-regression-snapshot-tests))
pushes a commit back to the branch under test. On `main` that would normally be blocked by the
**Protect Main** repository ruleset, which requires all changes to go through a pull request.
Two pieces make the push work:

- **Ruleset bypass** — the *Repository admin* role is on the "Protect Main" bypass list
  (`bypass_mode: always`). A push authenticated as a repo admin therefore satisfies the rule.
  The other rules (no deletion, no force-push, require-PR for everyone else) stay in force.
- **`SNAPSHOT_PUSH_TOKEN` secret** — a fine-grained PAT owned by a repo admin, scoped to this
  repository with **Contents: Read and write**. Both [`ci.yml`](.github/workflows/ci.yml) and
  [`update-snapshots.yml`](.github/workflows/update-snapshots.yml) check out with
  `${{ secrets.SNAPSHOT_PUSH_TOKEN || secrets.GITHUB_TOKEN }}`, so the auto-commit is
  authenticated as the admin (who can bypass) rather than the built-in `github-actions[bot]`
  (who cannot). The fallback to `GITHUB_TOKEN` is why the auto-commit is silently skipped on
  fork PRs — forks don't receive the secret.

The auto-commit message carries `[skip ci]` so the pushed commit doesn't re-trigger CI (no loop).

**Rotating the token:** generate a fresh fine-grained PAT (same scope) and update the secret:

```bash
gh secret set SNAPSHOT_PUSH_TOKEN --repo <owner>/<repo>   # paste the new PAT when prompted
```

If the push starts failing with `remote: error: GH013: Repository rule violations found`,
either the token expired/was revoked or the admin-role bypass was removed from the ruleset.

## License

This project is released under the [MIT License](./LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
