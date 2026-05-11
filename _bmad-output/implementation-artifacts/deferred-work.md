# Deferred Work

## Deferred from: code review of 1-4-web-app-scaffold (2026-05-11)

- No ESLint config in `apps/web` — `apps/web/package.json` declares `"lint": "eslint ."` and depends on `@nihonnohon/eslint-config`, but no `.eslintrc.*` or `eslint.config.*` exists; `turbo lint` will fail for this package. Full eslint wiring (including `eslint-plugin-boundaries`) is Story 1.5 scope.

## Deferred from: code review of 1-3-story-loader-package (2026-05-11)

- `vocab_keys` values not bounds-checked against `vocab_supplement` array length — semantic validation out of scope for loader; Story 2 components handle safe indexing.
- `sentence.grammar` indices not bounds-checked against `StoryModel.grammar` array — grammar panel (Story 4.2) handles out-of-range indices gracefully.
- Duplicate `sentence.id` values not checked for uniqueness — not required by AC3; relevant when navigation by id is implemented.
- No `ajv-formats` plugin for URI validation of `audio_url` — audio_url stored but not played in v1; URI validation belongs with the audio feature.
- No `sourcemap: true` in `packages/story-loader/tsup.config.ts` — add alongside schema package when debugging compiled outputs becomes needed.
- AJV `validate.errors` mutation not concurrency-safe — loader is synchronous; not a concern until async refactor.

## Deferred from: code review of 1-2-schema-package-and-story-format-contract (2026-05-11)

- `story-loader/package.json` `main`/`types` still point at `./src/index.ts` — same class of fix as schema package; Story 1.3 must update to `./dist/` paths before the loader is consumable from built contexts.
- `apps/web` has no declared `@nihonnohon/schema` workspace dependency — Story 1.4 adds it when apps/web scaffold is created.
- `audio_url` has no URI format validation in `story.v1.json` — audio playback is out of scope for v1; add `"format": "uri"` when audio feature is implemented.
- No `sourcemap: true` in `packages/schema/tsup.config.ts` — optional quality-of-life improvement; add if debugging compiled outputs becomes needed.
- `ruby`/`words` parallel array length not enforced in JSON Schema — Draft-07 cannot enforce cross-field array equality; story-loader (Story 1.3) must validate mismatched parallel array lengths and throw `LoaderError('SCHEMA_INVALID', ...)`.



## Deferred from: code review of 1-1-monorepo-initialization (2026-05-11)

- Package `exports` map in `packages/schema` and `packages/story-loader` points to non-existent `dist/index.{mjs,js,d.mts,d.ts}` — placeholder shape for Story 1.2/1.3 tsup build; consumers cannot resolve these packages under Node ESM resolution until tsup builds them.
- Turbo tasks (`build`, `dev`, `lint`, `typecheck`) are no-ops on the empty package and app stubs — actual scripts added in Stories 1.2–1.5. Risk: silent success masks real failures during this scaffold-only state.
- ESLint config (`packages/eslint-config`) uses legacy CommonJS `.eslintrc`-style. Won't work with ESLint 9 flat config; lacks `eslint` peer dependency. Spec defers full config (including `eslint-plugin-boundaries`) to Story 1.5.
- `.gitignore` missing common ignore entries that will be needed later: `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `.eslintcache`. Add when Story 1.4 introduces Vitest and Story 1.5 introduces Playwright.
- `packages/typescript-config/base.json` uses `module: ESNext` + `moduleResolution: bundler`. This is correct for Vite/tsup consumers but won't suit `apps/api` Node runtime when it's implemented. Decision: add a separate `node.json` preset or accept the compromise — defer until apps/api is real.
- `packages/typescript-config/react-library.json` extends base but declares no React peer dep contract — any consumer (currently only the future apps/web) must supply `react` and `@types/react` themselves. Story 1.4 concern.
- `turbo.json` task is named `typecheck` while the spec's Dev Notes parenthetically referenced `check-types` as the default scaffold name. Both root `package.json` scripts and `turbo.json` are internally consistent with `typecheck`. Spec is permissive — no rename needed.
