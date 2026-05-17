# Deferred Work

## Deferred from: code review of 2-5-ag-ui-sse-lifecycle-and-store-integration (2026-05-17)

- **AC2 timer-cleared proof is indirect:** The test verifies no error fires after 5s following RUN_STARTED, but does not prove `clearTimeout` was actually called. A direct proof would require injecting spy timers. Acceptable for v1. [useAgUiRun.test.ts]
- **AC4 proposal single-chunk emission:** Proposal buffer path tested with one chunk; the story buffer path (multi-chunk) is tested separately. Cover multi-chunk proposal if the proposal path gains independent buffer logic. [useAgUiRun.test.ts]
- **AC9 mockEs.close() not verified on cancel:** The SSE connection close on cancellation is handled by the hook's useEffect cleanup (called when phase changes away from generating), not directly asserted. [useAgUiRun.test.ts]
- **No re-render test with changed createEventSource factory:** If the hook consumer re-renders with a new factory, the old EventSource should be closed. Not required by Story 2.5 ACs. [useAgUiRun.test.ts]
- **No test for non-generating phase on hook mount:** The no-op guard `if (store.phase !== 'generating' || !store.runId) return` is not directly exercised. Covered implicitly by store phase guards in authoringStore.test.ts. [useAgUiRun.test.ts]

## Deferred from: code review of 2-4-input-panel-chapter-selector-and-scopechip (2026-05-17)

- **`useBackendStatus` concurrent in-flight fetches:** Pre-existing — see 2-3 deferred section. Also surfaced again in 2-4 context via the `InputPanel` consuming the hook. [useBackendStatus.ts]
- **`useAgUiRun` 3s first-event timeout calls `_setError` after component unmounts:** On the success path `phaseRef.current` is read, but if the component unmounts during the 3s+5s window, the ref holds a stale value and `_setError` may fire on a newly-mounted store instance. Pre-existing; Story 2.5 owns the `useAgUiRun` lifecycle. [useAgUiRun.ts]
- **React concurrent-mode potential tear from separate `useAuthoringStore` subscriptions in `InputPanel`:** `inputText` and `chapterTarget` each use separate `useAuthoringStore` calls, theoretically readable in different render passes. Consolidate to a single combined selector if concurrent-mode tearing becomes observable. Not a current issue with synchronous Zustand. [InputPanel.tsx]
- **No visible indicator on steering toggle when hidden instructions are present:** If the user types steering instructions, collapses the panel, and forgets, the instructions are silently included in the next `generate()` call. A badge or dot on the toggle button would make this visible. Enhancement for a future story. [InputPanel.tsx]
- **`focus-visible` without `:focus` fallback for older browsers:** Pre-existing pattern across the whole app (all interactive elements); all deployment targets use modern browsers with `:focus-visible` support. [InputPanel.tsx, ScopeChip.tsx and throughout]

## Deferred from: code review of 2-3-app-shell-backendstatus-modetoggle-and-settingspanel (2026-05-17)

- **Concurrent in-flight `fetch()` in `useBackendStatus`:** No abort of previous call when re-trigger fires. Single-user v1; address if concurrent load grows. [useBackendStatus.ts]
- **`AbortSignal.timeout` browser support:** Requires Safari ≥ 16.4. All deployment targets meet this; document and accept. [useBackendStatus.ts]
- **`proposalText` not cleared on mode switch:** Stale Path B proposal persists if user switches modes. M3 / Path B scope — Story 4.x. [authoringStore.ts]
- **`storedInputs` snapshot missing `pathMode` and `temperature`:** Re-run URL construction in Story 2.6 will need to extend the snapshot; deferred intentionally. [authoringStore.ts / useAgUiRun.ts]
- **`save()` doesn't return from `downloading` phase:** No `output-clean` transition on download completion. Story 2.8 scope. [authoringStore.ts]
- **`useAuthoringStore()` full subscription in components:** Components subscribe to entire store; potential unnecessary re-renders at scale. Address when profiling shows need. [ModeToggle.tsx, SettingsPanel.tsx, BackendStatus.tsx]

## Deferred from: code review of 2-2-m1-production-backend-agent-sse-endpoints-and-cancellation (2026-05-17)

- **Dangling threads on asyncio.TimeoutError:** `asyncio.to_thread` threads can't be cancelled; after a 55s timeout the OS thread continues until TCP timeout. Under concurrent load threads pile up. Single-user v1 won't hit this; address in M2 if concurrent usage grows. [agent.py]
- **`_active_runs` multi-worker isolation:** Each uvicorn worker has its own dict; cancel routed to different worker silently does nothing. v1 uses single worker; v2 (Cloud Run) will need a shared store (Redis, etc.). [main.py]
- **`cancel` always returns `{"ok": True}`:** No 404 for unknown run_id; idempotent cancel is acceptable for v1. [main.py]
- **TEXT_MESSAGE_CHUNK + RUN_FINISHED both carry full JSON:** Doubles bandwidth per generation. Functionally correct; use Gemini streaming response in M2 to send true incremental chunks. [agent.py]
- **`path_mode` accepted but unused:** Path B (Generate from topic) is M3 scope. Wire `path_mode` into agent logic in Story 4.1. [agent.py]
- **Ch.0 vocab entries excluded from prompts:** `build_system_prompt` loops `range(1, chapter+1)` matching spike.py pattern; Ch.0 greetings (おはよう, etc.) are never included. Intentional curriculum design — revisit if greetings are needed. [agent.py]
- **Health 503 only for absent key, not invalid/revoked key:** Validating key correctness requires a Gemini API call, inappropriate for a health endpoint. Accept this limitation; add a separate "connection test" endpoint in v2 if needed. [main.py]

## Deferred from: code review of 2-1-frontend-project-scaffold-state-machine-and-ag-ui-hook (2026-05-17)

- **`clear()` during generating leaves SSE open until next render:** `clear()` is valid from any phase but the SSE cleanup runs asynchronously. Add UI guard in Story 2.6 when components bind `clear()` to the generating phase. [authoringStore.ts / useAgUiRun.ts]
- **`steeringInstructions` empty-string ambiguity:** Empty field sends no param; non-empty sends the value. If the backend distinguishes missing vs empty, silent mismatch. Confirm API contract in Story 2.2. [useAgUiRun.ts]
- **`crypto.randomUUID()` secure-context requirement:** Only safe on localhost and HTTPS. If ever previewed over plain HTTP (staging), throws and breaks generation. All deployment targets use localhost/HTTPS so not a practical issue for v1. [authoringStore.ts]
- **`_resolveCancel()` leaves `storedInputs` intact:** Cancelled run leaves a Re-run snapshot. Whether the cancelled inputs should persist or be cleared is a product decision; resolve when building Re-run in Story 2.6. [authoringStore.ts]
- **`generate()` from error doesn't clear `outputJson`:** Stale output from a prior successful run persists while retrying. No component reads `outputJson` directly in Story 2.1 so no visible effect; clear it in the error-retry path when output display is wired up in Story 2.7. [authoringStore.ts]
- **`approve()` doesn't clear `proposalText`/`outputJson`:** Stale Path A output persists when entering Path B approval flow. Scope to Story 4.3. [authoringStore.ts]

## Deferred from: code review of 1-3-m0-feasibility-spike (2026-05-17)

- **CWD-relative FIXTURE_PATH / DATA_DIR:** Spike uses relative paths that only resolve correctly when invoked via `make spike` from `apps/story-generator-backend/`. Add a CWD assertion or resolve paths relative to `__file__` when this script is promoted to a reusable tool. [spike.py]
- **No enforced Gemini timeout:** AC1 documents the 60-second expectation but the Gemini call has no programmatic timeout. Add request timeout in the production `agent.py` (Story 2.2). [spike.py]
- **Raw LLM response not persisted:** On a successful run the raw JSON string from Gemini is discarded. Consider writing it alongside the fixture for debugging variance between runs. [spike.py]
- **No markdown fence stripping:** If `response_mime_type="application/json"` fails to prevent a code-fence wrapper, `json.loads` will fail without a helpful diagnostic. Strip ` ```json … ``` ` fences as a defensive fallback in the production agent. [spike.py, agent.py Story 2.2]

## Deferred from: code review of 1-2-backend-project-scaffold (2026-05-16)

- **Duplicate vocab ID silent overwrite:** `by_id[entry.id] = entry` in `load_vocab_data` silently replaces earlier entries with identical IDs. Trusted reference data makes this low-risk for now; add a warning log or assertion in Story 2.2. [data_loader.py:load_vocab_data]
- **`ValidationResult` mutable list despite `frozen=True`:** `frozen=True` prevents attribute reassignment but not `errors.append(...)`. No external callers yet — harden the API surface (use tuple) in Story 2.2 when the validator interface stabilises. [validator.py:ValidationResult]
- **Unpinned `requirements.txt`:** All deps except `ag-ui-protocol` are unpinned. Reproducibility risk grows over time. Lock versions or add a `pip-compile`-generated lockfile when the backend dependency set stabilises. [requirements.txt]
- **Uncaught `ValueError` on malformed CSV rows:** `int(row[0])` and `int(row["Chapter"])` raise `ValueError` on bad data. Fail-fast at startup is correct for trusted reference data; add validation with a clear error message if the CSVs ever come from an external source. [data_loader.py]

## Deferred from: code review of 4-4-credits-seo-polish-and-playwright-e2e-suite (2026-05-13)

- **`/credits` route missing `errorElement`:** A render crash in CreditsRoute shows a blank page with no recovery path. CreditsRoute is static-only today so risk is very low, but consistency with other routes (which have `errorElement`) would be cleaner. Add `errorElement: <LibraryError />` when error boundaries are reviewed. [router.tsx]
- **`CreditsRoute` `document.title` strict-mode double-invoke:** React 18 strict mode runs effects twice; on second mount, `prev` has already been set to `'Credits — Nihon no Hon'`, so the cleanup restores the wrong title. Production-only effects don't double-invoke; dev-only concern. Revisit if title restoration bugs surface. [CreditsRoute.tsx]
- **CC licence version number precision:** Attribution text says "Creative Commons Attribution-ShareAlike licence" without specifying "4.0 International". Technically incomplete; correct to "CC BY-SA 4.0" before public v1 release. [CreditsRoute.tsx]
- **Duplicate E2E upload tests:** `'valid story file — reader loads'` and `'optional-fields-absent story — reader loads normally'` both upload the same fixture. Second test is retained for its difficulty-badge absence assertion, but the first sentence overlap could be trimmed.
- **Visual regression snapshot baseline drift:** Snapshot tests don't explicitly reset `localStorage` between runs. Each Playwright test gets a fresh page context so this is currently safe, but worth noting if shared-context patterns are introduced.

## Deferred from: code review of 4-3-responsive-layout-and-settingsmenu (2026-05-13)

- **Desktop right-panel tab label duplication:** Desktop tab buttons compute label via `tab.charAt(0).toUpperCase() + tab.slice(1)` rather than looking up from the `TABS` constant used by the mobile tab bar. A future label rename diverges silently between mobile and desktop. [ReaderRoute.tsx — desktop right panel tab buttons]
- **`activeTab` localStorage not validated:** Persisted `activeTab` is rehydrated without checking it's one of `'story' | 'vocabulary' | 'grammar'`. An invalid stored value causes an unknown tab state on startup. Guard belongs in preferenceStore `migrate` or `onRehydrateStorage` callback. [preferenceStore.ts]
- **No test for bottom tab bar absence on desktop:** The `lg:hidden` class is CSS-based and unverifiable in jsdom. Cover in Playwright E2E suite (Story 4.4). [ReaderRoute.test.tsx]
- **No test for story scroll restoration on tab switch:** jsdom does not implement `scrollTop` behavior. Cover in Playwright E2E suite (Story 4.4). [ReaderRoute.test.tsx]
- **`getAllByText().length > 0` assertions could be more precise:** Four ReaderRoute tests use `toBeGreaterThan(0)` instead of an exact count — acceptable given CSS-responsive dual DOM rendering but hides count regressions. Consider tightening when layout is stable. [ReaderRoute.test.tsx]

## Deferred from: code review of 4-2-grammar-panel-and-sentence-highlighting (2026-05-13)

- **Out-of-bounds SentenceModel.grammar indices silently mute all items:** If a sentence's `grammar: number[]` contains an index beyond `StoryModel.grammar.length - 1`, that index is added to `highlightedIndices` but never matches any `i`, so all items are muted despite no valid highlighted index. Silent-correct in practice (loader architecture forbids UI re-validation); address if a story authoring quality issue produces out-of-range grammar references. [GrammarPanel.tsx:17]
- **Stale selectedSentenceId (ID not in sentences prop) causes unexpected all-muted state:** When `sentences.find()` returns `undefined` (ID from store doesn't match any sentence in the prop), `activeSentence` is `null` so all items are muted even though the UI appears to have a selection. Indistinguishable from a valid empty-grammar sentence. Parent integration (Story 4.3) must pass `story.sentences` consistently; this cannot occur in correct usage. [GrammarPanel.tsx:15]
- **Empty-string grammar points render invisible list items:** A `""` entry in `StoryModel.grammar` produces a `<li>` with no visible text but real vertical height. Data quality constraint belongs in schema/loader layer; grammar point `minLength: 1` is not currently enforced by the schema. [GrammarPanel.tsx:32]

## Deferred from: code review of 4-1-vocabulary-panel-and-vocabitem (2026-05-13)

- **`isActive` word-string matching:** Two entries sharing the same `word` value (homophone across keywords and supplement lists) both render as active simultaneously. Author-controlled data makes this unlikely; address if story authoring tooling allows duplicates. [VocabItem.tsx:9]
- **`lesson: 'supplement'` assigned to keyword entries:** `toVocabEntries` labels all converted entries as `'supplement'` regardless of source; no downstream code currently branches on this field for panel entries. Revisit if keyword/supplement distinction is exposed in UI. [VocabPanel.tsx:11]
- **Two `useLookupStore` selectors in `VocabItem`:** `lookup` and `lookupState` are separate `useLookupStore()` calls, causing two re-renders per state change. Combine into a single selector or use `useShallow` if profiling identifies this as a bottleneck. [VocabItem.tsx:7-8]
- **No `aria-label` on `role="button"` div:** Screen readers concatenate all three child spans (word+reading+translation) as the button name. Explicit `aria-label` with the Japanese word would be cleaner; revisit in Story 4.4 full accessibility audit. [VocabItem.tsx:17]
- **Empty/whitespace `word` field passes silently to lookup:** `toVocabEntries` applies no guard; an empty word would render an empty InfoPanel heading. Schema/loader responsibility; add a guard if authoring tools can produce empty word fields. [VocabPanel.tsx:5]

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
