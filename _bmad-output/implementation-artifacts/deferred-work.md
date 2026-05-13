# Deferred Work

## Deferred from: code review of 3-4-local-file-upload-and-validation (2026-05-13)

- **`saveStory` resolves before transaction commits:** `request.onsuccess` fires before `tx.oncomplete`; use `tx.oncomplete` to resolve and wire `tx.onerror`/`tx.onabort` to reject so callers get a real rejection on quota-exceeded or abort. [indexedDbService.ts:29]
- **Non-`LoaderError` from `saveStory` silently swallowed:** The `catch` block in `handleFileChange` only handles `LoaderError`; a native IDB rejection (quota, permission) is discarded with no user feedback. Add a fallback `else` branch with a generic error message. [LibraryRoute.tsx:handleFileChange]
- **Concurrent `openDb()` race:** If two callers both see `db === null` before the first open settles, each fire a separate `indexedDB.open()`. Benign today (no parallel IDB calls in current flows), but the unclosed extra connection will block future DB version upgrades.
- **`loadStory(text)` return value discarded in `handleFileChange`:** Called purely for validation; raw JSON stored via a separate `JSON.parse(text)`. Contract works correctly (IDB stores wire format; loader re-validates on read) but is non-obvious to future readers.
- **`_resetDb` exported from production module without env guard:** Test-only helper is callable from any app code. Consistent with `_resetVocab`/`_resetKanji` precedent; consider a `TEST_ONLY` comment or moving to a separate test-utils module if the pattern grows.
- **Manifest ID / UUID collision:** A library slug equal to a locally-stored UUID would shadow the local upload permanently (manifest checked first). Vanishingly unlikely given human-readable slug vs UUID formats, but worth noting before any non-slug manifest IDs are introduced.
- **`fetchManifest` called on every reader navigation:** No client-side cache; pre-existing gap. Browser cache mitigates in practice. Relevant if latency SLOs are tightened.

## Deferred from: code review of 2-5-minimum-viable-reader-route (2026-05-13)

- **`buildSupplementMap` not memoized:** Called on every render of `ReaderRoute`, allocating a new `Map` each time. Wrap with `useMemo(() => buildSupplementMap(story.vocabSupplement), [story.vocabSupplement])` before adding `React.memo` to `SentenceBlock` in a future refactor.

## Deferred from: code review of 3-3-full-story-loading-and-routing (2026-05-13)

- **`ReaderError` has no retry button:** `LibraryError` offers "Try again" via `useRevalidator`; `ReaderError` only links back to library. If `initVocab`, `initKanji`, or manifest fetch fail transiently, the user has no recovery path except navigating away. Add a retry affordance before v1 ships.
- **All non-404 loader errors produce the same generic message with no logging:** `LoaderError` (schema invalid, unsupported version), CDN 404 on story file, and `SyntaxError` from malformed JSON all show "Failed to load this story." with no distinguishing information and no `console.error`. Add error logging before production.
- **No catch-all route:** Paths like `/about`, `/credits`, or `/read/` (trailing slash, no segment) show the unstyled React Router default error UI. A root-level `errorElement` on the router would brand all unmatched paths.
- **`buildSupplementMap` synthetic IDs (-1, -2, …) can be stale in `lookupStore` across story navigations:** The lookup store is not reset on route change. If a user has a supplement word in the InfoPanel from Story A and navigates to Story B, the stale `entry` object remains until a new word is tapped. Reset `lookupStore` on loader entry or add navigation-based teardown.

## Deferred from: code review of 3-2-library-route-and-difficulty-filter (2026-05-13)

- **`parseDifficultyChapter` empty-string edge case:** A manifest entry with `difficulty: "Genki I"` (no space+chapter after the prefix) causes `parseDifficultyChapter` to return `""`, which appears as a blank `<option>` in the chapter dropdown. Requires difficulty format validation beyond type-checking in `isManifestEntry`.
- **`fetchManifest` silent invalid-entry drop:** Invalid manifest entries are filtered without a `console.warn`. Debugging manifest authoring errors in dev is harder than necessary. Add dev-mode warning before v1 ships.
- **`availableChapters` lexicographic sort:** Default `Array.sort()` puts `"Ch.10"` before `"Ch.9"`. No current impact with one story; fix with a numeric-component sort when multi-chapter sources are added.
- **Chapter select stale after revalidation:** If revalidation removes a currently-selected chapter, the `<select>` shows a stale value and the empty state is shown with no automatic reset. Reset `chapter` to `'All'` in a `useEffect` watching `availableChapters` if needed.
- **Static `<title>` not route-specific:** Library page shares the same `<title>` as all other routes. Acceptable for "basic SEO" in v1 but will need dynamic title management (e.g. `document.title` in `useEffect`) before v2 if the reader route needs a story-specific title.

## Deferred from: code review of 3-1-story-manifest-storycard-and-difficultybadge (2026-05-13)

- **`ReaderRoute` loader hardcoded:** Fetches `genki-i-ch6-tanaka-letter.json` unconditionally — will silently serve the wrong story if a second manifest entry is clicked. Story 3.3 replaces the loader body. [ReaderRoute.tsx:29]
- **`manifest.json` no build-time validation:** A hand-edit typo silently drops a story entry from the library with no developer warning. Story 3.2 adds `fetchManifest()` with `isManifestEntry` per-entry validation at runtime; a CI schema check would catch this earlier.
- **No unit tests for `isManifestEntry` type guard:** Boundary cases (non-string `difficulty`, empty `id`) are untested. Story 3.2 AC explicitly requires these tests.
- **`StoryCard` link AT name:** The accessible name of the `<Link>` is the full concatenation of title + Japanese title + description — can produce a noisy AT experience in a long list. Standard card-link pattern; consider `aria-labelledby` scoping in a future accessibility pass.
- **`filename` field coupling:** `ManifestEntry.filename` creates an implicit `id + ".json"` invariant that is not enforced anywhere. If it always equals `id + ".json"`, the field is redundant; if it can differ, the divergence is undocumented. Architectural decision in epics spec — revisit before adding non-trivially-named stories.
- **Duplicate supplement word entries silently drop:** `buildSupplementMap` iterates with index, so if `vocabSupplement` has two entries with the same `word`, the last one wins in the `Map` with no warning. Add a dedup check or dev-mode warning when building the map.
- **No `errorElement` on `/read/:storyId` route:** `loadStory()` rejection and fetch failures surface as an unhandled React crash. Epic 3 adds `ErrorBoundary` per spec — route error element must be added there.
- **`res.json()` on non-JSON 200 response throws unformatted `SyntaxError`:** CDN or proxy 200 HTML error pages produce a confusing error. Catch `SyntaxError` separately in the loader and throw a user-facing message; coordinate with Epic 3 error boundary work.
- **`loader()` body not directly unit tested:** The exported loader function is never called in `ReaderRoute.test.tsx`; tests mock `useLoaderData` only. The loader is intentionally thin (Epic 3 replaces it), but a loader integration test (mocking `fetch`) would close this gap post-Epic 3.

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
