# Deferred Work

## Deferred from: code review of 2-4-infopanel-and-kanjibreakdown-components (2026-05-12)

- **kanjiService race:** `lookupKanji` returns null if `initKanji` hasn't resolved when `KanjiBreakdown` first mounts. Breakdown silently disappears; no re-render when map becomes available. Pre-existing architecture; revisit if kanji data is ever lazily loaded post-route.
- **Empty label span:** When `KanjiEntry.kw === null` and `m` is an empty array, `kw ?? m[0] ?? ''` emits an empty `<span>` with font metrics but no visible text. Unlikely with real kyouiku kanji data; address if data quality issues arise.
- **aria-live verbosity:** No `aria-atomic` on the InfoPanel live region — KanjiBreakdown chip text is announced alongside word/meaning/reading on each lookup update, potentially producing verbose AT readout for words with many kanji. Revisit during Story 4.4 full a11y audit.

## Deferred from: code review of 2-3-wordtoken-and-sentenceblock-components (2026-05-12)

- `WordToken` renders `<rt>` with empty string when `ruby` is null. Some screen readers may announce the empty annotation or add an awkward pause. Fix: conditionally omit `<rt>` when `ruby` is null, or add `aria-hidden` when empty. Defer until fuller a11y audit in Story 4.4.

## Deferred from: code review of 2-2-lookup-and-preference-stores (2026-05-12)

- `preferenceStore.ts` `partialize` manually enumerates all five state fields — adding a new persisted field requires remembering to update this list; a missed field silently loses persistence. Consider an `Omit<state, keyof actions>` type approach if the store grows.
- `lookupStore.lookup` accepts empty-string `word` and `sentenceId` without validation — not a concern for valid callers (loader enforces `minLength:1` via AJV), but worth a runtime guard if the service is ever called from untrusted paths.
- `usePreferenceStore` persist config has no `version` or `migrate` option — a future union change to `textSize` or `activeTab` will silently rehydrate stale values. Add a `version` and `migrate` function when either field's union is narrowed or extended.

## Deferred from: code review of 2-1-vocabulary-and-kanji-data-services (2026-05-12)

- Test-only exports (`_initVocabFromData`, `_resetVocab`, `_initKanjiFromData`, `_resetKanji`) are exported from production modules with only a naming convention as guard; no compile-time or package-boundary enforcement. Acceptable for v1; revisit if these are misused.
- `kanji-data.json` entries have a `char` field that duplicates the top-level object key — if these ever diverge (copy-paste error), `lookupKanji` returns an entry whose `entry.char` is inconsistent with the key used to retrieve it. Add a build-time consistency assertion if the file is ever regenerated.
- Duplicate `id` values in `vocab.json` would silently drop earlier entries in the `Map` constructor (`new Map(data.map(e => [e.id, e]))`). Architecture prevents this (append-only CSV, stable IDs), but a build-vocab guard would make it explicit.

## Deferred from: code review of 1-5-monorepo-pipeline-ci-and-project-scaffolding (2026-05-12)

- `eslint-plugin-boundaries` path patterns may not match when linting from workspace directory — `pattern: 'packages/*'` and `pattern: 'apps/*'` in `packages/eslint-config/index.js` require `basePath` pointing to the repo root to resolve correctly; without it the boundary rules may silently never fire. Investigate and add `basePath` configuration in a follow-up.
- `scripts/build-vocab.ts` uses `process.cwd()` instead of `import.meta.url` — intentional design choice for turbo root task context; if ever run outside turbo (e.g., directly via `tsx`), paths will break. Low risk while turbo manages the task.
- Header row safety in `scripts/build-vocab.ts` — no skip logic if `scripts/data/genki-vocab.csv` ever gains a header row; headerless format is intentional. Add a guard when format changes.
- `buildVocab.test.ts` reads `vocab.json` at module scope — produces an opaque ENOENT crash if the file is missing. Acceptable within turbo pipeline (enforced by `dependsOn: build-vocab`); refactor to `beforeAll` if running tests outside turbo becomes common.
- `@typescript-eslint` v7 + TypeScript 5.5 — resolved v7.18.0 supports TypeScript 5.5; monitor if upgrading TypeScript past 5.5 triggers compatibility issues before moving to `@typescript-eslint` v8.

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
