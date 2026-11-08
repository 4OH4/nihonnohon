# Story se4-2: Offline Library Precache and Offline E2E

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **reader on patchy mobile signal**,
I want every bundled story and the dictionary available offline after my first visit,
So that I can open and read any story on a train or plane.

Implements PRD **FR46** and the amended **NFR6**. Builds on se4-1, which added the plugin, the manifest and the guarded registration. Epic: `_bmad-output/planning-artifacts/supp-epic-4-pwa.md`. Decision record: `docs/adr/007-pwa-offline.md`. Can run in parallel with se4-3. The two stories touch different files: se4-3 owns `pwa.ts`, `pwaStore.ts`, `UpdatePrompt` and `SettingsMenu`.

## Acceptance Criteria

1. **AC1: Workbox config**
   - `VitePWA({ workbox: {...} })` in `apps/web/vite.config.ts` sets:
     - `globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}']`
     - `navigateFallback: '/index.html'`
     - `navigateFallbackDenylist: [/^\/_vercel\//]`
   - The block does **not** set `skipWaiting` or `clientsClaim` (these would break `registerType: 'prompt'` and FR47). It does not add `runtimeCaching`.
   - `showMaximumFileSizeToCacheInBytesWarning: true` is set at the top level of the `VitePWA` options, so a file over Workbox's 2 MiB per-file limit is reported in the build log. Without it the file is dropped from the precache silently.

2. **AC2: Precache content and budget**
   - After `pnpm build`, the precache manifest in `dist/sw.js` includes:
     - `index.html`, all JS and CSS
     - `vocab.json`, `kanji-data.json`, `stories/manifest.json` and **every** `stories/*.json` file
     - the four Noto Sans JP `.woff2` files (japanese and latin, weights 400 and 600)
     - `favicon.ico`, `favicon.svg`, `apple-touch-icon-180x180.png`, the `pwa-*.png` and maskable icons, and `manifest.webmanifest`
   - The legacy `.woff` fallbacks are **not** included.
   - No URL appears twice with different revisions.
   - The total size of the precached files is **≤ 10 MB** (10,000,000 bytes). Today it is about 4 MB.
   - The `PWA v2.x` build-log summary is pasted into the Completion Notes.
   - A build-output spec, `e2e-pwa/precache.spec.ts`, enforces all of AC2. See *Precache spec*.

3. **AC3: `vercel.json`**
   - `vercel.json` gains a `headers` entry that sets `Cache-Control: no-cache` on `/sw.js`.
   - `buildCommand`, `outputDirectory` and the SPA `rewrites` entry are unchanged.
   - A node-environment unit test, `src/__tests__/vercelConfig.test.ts`, asserts both points.

4. **AC4: Offline E2E**
   - The new config `apps/web/playwright.pwa.config.ts` builds the app, serves it with `vite preview` on port 4173 and runs only `apps/web/e2e-pwa/*.spec.ts`, on Chromium only.
   - Each offline test first primes the app:
     - load `/` online
     - wait until the service worker is activated
     - reload, so the page is **controlled** (prompt mode has no `clientsClaim`, so the first load is never controlled; see se4-1 Debug Log)
     - then call `context.setOffline(true)`
   - Once offline, each of these must work:
     - (a) Reloading `/` renders the library with one story card per entry in `public/stories/manifest.json`.
     - (b) Opening a story that was **never opened before** in this context renders its sentences. Use *A New Student in Class* (`genki-i-ch1-classroom-introduction`).
     - (c) Tapping 学生 updates the InfoPanel (`Word lookup panel`) with the translation "student". The `Kanji breakdown` shows two cells, containing "study" and "life".
     - (d) A hard navigation (`page.goto`) straight to `/read/<storyId>` renders the reader, for a different story that was never opened. This exercises the navigation fallback.
     - (e) A story uploaded while online (stored in IndexedDB, opened at `/read/<uuid>`) still opens with a hard navigation.
   - While offline, each test also asserts:
     - The data responses (the document, `/vocab.json`, `/kanji-data.json`, `/stories/*`) report `response.fromServiceWorker() === true`.
     - **No** same-origin request fails, apart from `/_vercel/*`. See *Offline network assertions*.

5. **AC5: Suite separation and CI**
   - `apps/web/package.json` gains `"test:e2e:pwa": "playwright test -c playwright.pwa.config.ts"`.
   - The default `pnpm test:e2e` (`playwright.config.ts`, `testDir: './e2e'`) does **not** pick up `e2e-pwa/`.
   - Vitest does not pick up `e2e-pwa/` either: add it to the `test.exclude` list in `vite.config.ts`.
   - `.github/workflows/ci.yml` runs `pnpm --filter @nihonnohon/web test:e2e:pwa` in a step **after** the existing `Build` step, with its own upload-on-failure step. Chromium is already installed by the existing browser-install step.
   - The PWA suite's output folders (`test-results-pwa/`, `playwright-report-pwa/`) are gitignored and lint-ignored. They are kept separate from the default suite's folders, which drive the snapshot-mismatch detection in CI.

6. **AC6: Docs**
   - `docs/architecture-web.md` describes:
     - the service worker (transparent cache, one guarded registration point, prompt updates)
     - what is precached
     - the navigation fallback and `/_vercel/` denylist
     - the ≤ 10 MB budget and what to do if it is exceeded
     - the opt-in rule for large optional assets
     - the `e2e-pwa` suite (in the E2E table)
     - the updated `vercel.json` snippet
   - `docs/development-guide.md` explains:
     - how to test offline locally: `pnpm build`, then `pnpm preview` in `apps/web`, then DevTools → Application → Service workers, then Network → Offline
     - how to run `pnpm test:e2e:pwa`
     - how to clear site data for `localhost:4173` afterwards
   - The CI Pipeline list in `docs/development-guide.md` includes the new step.

7. **AC7: No regressions; manual device checks**
   - `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit` and `pnpm test:e2e` (all four projects) pass. Existing E2E specs and `playwright.config.ts` are unchanged.
   - `pnpm test:e2e:pwa` passes locally.
   - **Before closing the story**, RT spot-checks a deployed preview (HTTPS) on real **iOS Safari** and **Android Chrome**:
     - one online visit
     - airplane mode
     - relaunch from the home screen, or reopen the tab
     - the library lists every story
     - a never-opened story opens
     - a word lookup shows kanji
   - The results go in Completion Notes.

## Tasks / Subtasks

- [x] **Task 1: Workbox config** (AC: 1, 2)
  - [x] In `apps/web/vite.config.ts`, replace the `// workbox: intentionally left at plugin defaults …` comment with the `workbox` block from *VitePWA changes*. Add `showMaximumFileSizeToCacheInBytesWarning: true`.
  - [x] Add `'**/e2e-pwa/**'` to `test.exclude`.
  - [x] Delete `apps/web/dist/`, then run `pnpm build` from the repo root.
  - [x] Paste the `PWA v2.0.0` summary block (entry count and KiB) into Completion Notes. Expect about 49 entries and about 3,900 KiB.
  - [x] Inspect `dist/sw.js`:
    - The `precacheAndRoute([...])` list holds the AC2 files, with exactly one `manifest.webmanifest` entry and one entry per icon.
    - The `NavigationRoute` is bound to `/index.html` with `denylist:[/^\/_vercel\//]`.
    - `skipWaiting()` appears only inside the `SKIP_WAITING` message handler.
- [x] **Task 2: `vercel.json` header and guard test** (AC: 3)
  - [x] Add the `headers` entry from *vercel.json*.
  - [x] Create `apps/web/src/__tests__/vercelConfig.test.ts` (node environment). It reads `../../../../vercel.json` relative to `__tests__`, i.e. the repo root, and asserts:
    - the `/sw.js` header is `Cache-Control: no-cache`
    - `rewrites` deep-equals `[{ source: '/(.*)', destination: '/index.html' }]`
    - `buildCommand` and `outputDirectory` are unchanged
- [x] **Task 3: Playwright PWA config and scripts** (AC: 4, 5)
  - [x] Create `apps/web/playwright.pwa.config.ts`. See *Playwright PWA config*.
  - [x] Add `"playwright.pwa.config.ts"` to `include` in `apps/web/tsconfig.node.json`.
  - [x] Add the `test:e2e:pwa` script to `apps/web/package.json`.
  - [x] Add `test-results-pwa/` and `playwright-report-pwa/` to the root `.gitignore`, next to the existing `playwright-report/` and `test-results/` lines, and to `ignorePatterns` in `apps/web/.eslintrc.cjs`.
- [x] **Task 4: Precache spec** (AC: 2)
  - [x] Create `apps/web/e2e-pwa/precache.spec.ts`. It is a build-output check that uses no `page` fixture, so no browser is launched. See *Precache spec*.
  - [x] Mutation-check it:
    - Temporarily narrow `globPatterns` (drop `json`), rebuild, and confirm the spec fails and names the missing story files.
    - Restore the globs.
- [x] **Task 5: Offline spec** (AC: 4)
  - [x] Create `apps/web/e2e-pwa/offline.spec.ts`, containing the five scenarios (a)–(e), a shared `primeServiceWorker()` helper and the network assertions. See *Offline spec*.
  - [x] Copy the upload helper pattern from `e2e/file-upload.spec.ts`, and read the fixture from `../e2e/fixtures/valid-optional-absent.json`. Do **not** import from `e2e/`: a cross-suite import would make the default suite's files part of this suite.
  - [x] Mutation-check the suite:
    - Temporarily remove `navigateFallback` (or add `globIgnores: ['**/stories/*.json']`), rebuild, and confirm the relevant scenarios fail.
    - Restore the config.
- [x] **Task 6: CI** (AC: 5)
  - [x] Add the two steps in *CI steps* after the `Build` step in `.github/workflows/ci.yml`. Do not change any existing step.
- [x] **Task 7: Docs** (AC: 6)
  - [x] `docs/architecture-web.md`:
    - Add a new `## Offline & Service Worker` section after *Data Architecture*.
    - Add an `e2e-pwa/` table to *E2E Tests*.
    - Update the `vercel.json` snippet under *Deployment* and add a sentence on the `sw.js` header.
  - [x] `docs/development-guide.md`:
    - Add a `### PWA / Offline Tests` subsection under *Testing*, after *E2E Tests*.
    - Add step 9 to *CI Pipeline*.
    - Leave the *PWA icons* subsection from se4-1 as it is.
  - [x] Resolve the se4-2 item in `_bmad-output/implementation-artifacts/deferred-work.md`: add "→ resolved in se4-2" with one line on how it was resolved. See *Deferred item from se4-1*.
- [x] **Task 8: Verify** (AC: 4, 7)
  - [x] Run `pnpm test:e2e:pwa` from `apps/web`, and paste the pass summary into Completion Notes. *(Run with the identical config on port 4174 because 4173 was occupied; RT accepted this on 2026-11-08. CI runs the committed config.)*
  - [x] Manual browser check (CLAUDE.md requires one): `pnpm preview`, then Chrome on `localhost:4173`:
    - DevTools → Application → Cache storage lists the `workbox-precache-v2-…` cache with the stories, `vocab.json` and fonts.
    - Network → Offline, then reload, then open a story, then tap a word.
    - Then use "Clear site data" for `localhost:4173`.
  - [x] Regression gates: `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit` and `pnpm test:e2e` (all four browser projects).
  - [x] Ask RT for the real-device spot checks (AC7), and record the results. *(Android Chrome passed; iOS Safari not checked and accepted at risk by RT on 2026-11-08. See Completion Notes.)*

### Review Findings

_Code review 2026-11-08 (Blind Hunter, Edge Case Hunter, Acceptance Auditor). The audit found no AC violations. The AC7 real-device checks were then recorded: Android Chrome passed, and iOS Safari is accepted at risk._

- [x] [Review][Patch] **The precache spec does not check that the precache is complete.** Workbox drops any file over 2 MiB with only a build-log warning. Nothing compares the files in `dist/` that match the globs against the precache list. As a result:
  - a JS chunk or PNG that grows past 2 MiB disappears offline, and every test, including the budget, still passes
  - "all JS and CSS" (AC2) is not enforced
  - a story in a subfolder of `public/stories/`, or a manifest `filename` whose case differs from the file, goes unchecked
  - the font check counts four `noto-sans-jp-*.woff2` files without asserting japanese/latin × 400/600
  
  Fix:
  - Walk `dist/` recursively. Assert that every file matching the glob extensions, except `sw.js` and `workbox-*.js`, is in the precache.
  - Assert that every manifest `filename` is in the precache as `stories/<filename>`.
  - Match the four font names explicitly.
  - Compute the budget from the files on disk.
  
  [apps/web/e2e-pwa/precache.spec.ts:298-345]
- [x] [Review][Patch] **The offline tests can fail at random when a request still in flight is aborted.** Two cases:
  - In scenario (e), the reader loader starts `initKanji()` without awaiting it. `page.goto(uploadedUrl)` can abort that `kanji-data.json` fetch, and the abort is recorded as an offline failure (`net::ERR_ABORTED`).
  - In priming, the library cards render only after the async manifest fetch, so `document.fonts.ready` can resolve before the Japanese font loads have started. The next reload or goto then aborts them.
  
  Fix:
  - Wait for the library cards to be visible before awaiting `fonts.ready`.
  - In (e), wait for the `kanji-data.json` response before going offline.
  
  [apps/web/e2e-pwa/offline.spec.ts:127-140, 234-241]
- [x] [Review][Patch] **The offline network checks can pass without proving anything, and they miss some failures.** Gaps:
  - Nothing asserts that the data files were actually requested while offline.
  - `assertServedOffline()` runs straight after the last UI assertion, so a request that fails later is never seen. Scenario (d) never waits for `kanji-data.json`.
  - A 4xx/5xx response is not caught.
  - JS, CSS and font responses are not checked with `fromServiceWorker()`.
  
  Fix: make `assertServedOffline(expectedPaths)` poll until each expected data path has been served by the worker, record same-origin responses with status ≥ 400, and apply the `fromServiceWorker()` check to every same-origin response.
  
  [apps/web/e2e-pwa/offline.spec.ts:147-174]
- [x] [Review][Patch] **No test checks the claim that precached JSON beats the navigation fallback.** `deferred-work.md` says this is "enforced by `e2e-pwa/precache.spec.ts`", and `architecture-web.md` makes the same claim. The spec only regex-matches the `NavigationRoute`; nothing opens `/vocab.json` directly. Fix: add an offline scenario that does a hard navigation to `/vocab.json` and to a story file, and asserts a JSON response served by the worker. [apps/web/e2e-pwa/offline.spec.ts]
- [x] [Review][Patch] **The docs are wrong in four places:**
  - "about 3.8 MB today" should be 3.9 MB (3,935,426 bytes; the budget is decimal).
  - The spec "fails the build" is wrong: it fails the PWA E2E CI step.
  - "per-deploy revision" is wrong. Revisions are content hashes, and consistency comes from each service-worker version installing a single manifest.
  - The *Updates* row does not mention se4-3's `UpdatePrompt`.
  
  [docs/architecture-web.md:529-536]
- [x] [Review][Patch] **Brittle test inputs give confusing errors.** Two cases:
  - When the data changes, the test crashes with a TypeError instead of naming the cause:
    - `firstWordSurface` indexes `words[-1]` when sentence 0 has no vocab key.
    - `manifest.find(...)!` returns undefined when a story ID is renamed.
  - `precache.spec.ts` reads `dist/sw.js` when the module loads, so `--list` and IDE test discovery throw ENOENT on a fresh clone.
  
  Fix: throw explicit messages, and read `sw.js` lazily with a clear "run the build first" error.
  
  [apps/web/e2e-pwa/offline.spec.ts:116-124, 204, 225; apps/web/e2e-pwa/precache.spec.ts:288]
- [x] [Review][Defer] **Playwright specs are not type-checked.** `e2e/` (already) and now `e2e-pwa/` are outside every tsconfig `include`, so `pnpm typecheck` never sees type errors in them. [apps/web/tsconfig.app.json] — deferred, pre-existing

## Dev Notes

### Scope boundary

| Item | Owner |
|---|---|
| Workbox globs, navigation fallback and denylist, budget check, `vercel.json` header, PWA Playwright suite, CI step, SW docs | **se4-2 (this story)** |
| `UpdatePrompt` toast, `beforeinstallprompt`, SettingsMenu install item, periodic `registration.update()` | se4-3 |
| `src/lib/pwa.ts`, `src/stores/pwaStore.ts`, `main.tsx` | **Do not modify.** These belong to se4-1 and se4-3. This story needs no app-code change. |

The service worker is a **transparent cache** (ADR 007): no app code changes in this story. The four fetch sites stay plain `fetch()`:
- `ReaderRoute.tsx:59` `/stories/<filename>`
- `kanjiService.ts:40`
- `vocabService.ts:14`
- `storyManifest.ts:52`

Do not add cache reads, `caches.*` or SW messaging to `src/`. Tests may read Cache Storage from `page.evaluate`, because the boundary rule covers `src/` only.

### Current state of files being modified

- **`apps/web/vite.config.ts`**
  - The `VitePWA` options are `strategies: 'generateSW'`, `registerType: 'prompt'`, `injectRegister: false`, `devOptions: { enabled: false }`, plus the manifest. Each option has a one-line rationale comment.
  - There is no `workbox` key yet, so the plugin defaults apply: `globPatterns: ['**/*.{js,css,html}']` and `navigateFallback: 'index.html'` with no denylist. The resulting `sw.js` has 9 precache entries (472.95 KiB) and `NavigationRoute(createHandlerBoundToURL("index.html"))`.
  - The `test` block: jsdom, globals, setup file, and `exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**']`.
  - **Preserve:** every existing option, the comments, `APP_DESCRIPTION` (guarded by `pwaManifest.test.ts`, which text-matches `const APP_DESCRIPTION =`), the alias and the test block.
- **`vercel.json`** (repo root)
  - Currently it holds `buildCommand`, `outputDirectory` and a single SPA rewrite.
  - Vercel serves real static files before the rewrite. This was verified in production, so `sw.js`, `manifest.webmanifest` and the JSON files need no rewrite change.
- **`apps/web/package.json`**
  - **Add** one script. Add no new dependencies: `@playwright/test` 1.59.1 is already installed.
- **`apps/web/tsconfig.node.json`**
  - It includes the four tool configs. **Add** the new Playwright config to the list.
  - `e2e/` is not type-checked by `tsc -b` (`tsconfig.app.json` includes only `src`), and `e2e-pwa/` will not be either. That matches the existing suite. Lint still covers both.
- **`.github/workflows/ci.yml`**
  - Step order: install, build-vocab, lint, typecheck, unit, Playwright browser install (chromium, firefox, webkit), E2E (`continue-on-error`, with snapshot auto-regeneration), the fail gate, upload-on-failure, then **`Build`**, which is last.
  - The new step goes **after `Build`**.
  - Leave the snapshot machinery alone. It `find`s `*-actual.png` under `apps/web/test-results`, which is one reason the PWA suite uses its own `outputDir`.
- **`apps/web/playwright.config.ts`**
  - **Unchanged.** `testDir: './e2e'` already excludes `e2e-pwa/`.
  - It uses `webServer: vite` on 5173 with no service worker. The preview server on 4173 is a separate origin, so the two suites cannot interfere.
- **`docs/architecture-web.md`** and **`docs/development-guide.md`**: see Task 7. Keep the existing tone: short sections, tables and fenced commands.

### VitePWA changes

```ts
VitePWA({
  // …existing strategies / registerType / injectRegister / devOptions / manifest unchanged…

  // A file over Workbox's 2 MiB per-file limit is otherwise dropped from the precache silently.
  showMaximumFileSizeToCacheInBytesWarning: true,
  // Whole-library precache (ADR 007, offline option "b"): app shell, fonts, dictionary data,
  // the story manifest and every story. Budget ≤ 10 MB — enforced by e2e-pwa/precache.spec.ts.
  // Large optional assets are opt-in downloads outside the precache; never widen these globs for them.
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}'],
    // Deep links (/read/:storyId) open offline; /_vercel/* (Analytics, Speed Insights) stays on the network.
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/_vercel\//],
    // Never set skipWaiting / clientsClaim: updates wait for the reader (FR47, se4-3).
  },
})
```

- **Precache order resolves the old deferred issue.** `generateSW` registers `precacheAndRoute` **before** the `NavigationRoute`. A direct navigation to a precached URL such as `/vocab.json` or `/stories/foo.json` is therefore answered by the precache, not by the SPA shell. Only unknown paths fall back to `index.html`, which matches the online SPA behaviour.
- **`'/index.html'` vs the default `'index.html'`.** Both resolve to the same absolute URL against the `/` scope, so both map to the precache key `index.html`. The AC uses `/index.html`. Check the built `NavigationRoute` once in DevTools: an offline deep link must render, not show the Chrome dino.
- **`webmanifest` and `png` in the globs.** The plugin already adds `manifest.webmanifest` and the manifest icons through `additionalManifestEntries` (see `vite-plugin-pwa/dist/index.js`, around line 90–145), and the globs now match them too.
  - Duplicate URLs with the **same** revision are harmless. Workbox only throws `add-to-cache-list-conflicting-entries` at install time when the revisions differ.
  - The precache spec asserts that no URL has conflicting revisions.
  - If a conflict does show up, add `globIgnores: ['**/manifest.webmanifest']` with a comment that the plugin injects it, and record the change in Completion Notes.
- **Expected entries.** About 49:
  - index.html, the CSS, 3 JS chunks (`index`, `virtual_pwa-register`, `workbox-window`)
  - 4 woff2 files, 7 icons and favicons, `manifest.webmanifest`
  - `vocab.json`, `kanji-data.json`, `stories/manifest.json` and 30 story files
- **Expected size.** About 3.9 MB:
  - JS 461 KB
  - woff2: 1.02 MB + 1.03 MB + 13 KB + 13 KB
  - kanji-data 529 KB, vocab 167 KB, stories 669 KB
  - icons about 15 KB
- **Per-file limit.** The largest file, `japanese-600.woff2`, is 1.03 MB, under the 2 MiB default. Do not raise `maximumFileSizeToCacheInBytes`.
- `cleanupOutdatedCaches` already defaults to `true` in vite-plugin-pwa. Leave it.

### vercel.json

```json
{
  "buildCommand": "turbo build --filter=@nihonnohon/web",
  "outputDirectory": "apps/web/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

`workbox-<hash>.js` and `assets/*` are content-hashed, so they need no header. `vercel.json` cannot hold comments, so the rationale belongs in `docs/architecture-web.md`: Vercel already sends `max-age=0, must-revalidate`, and this header pins that behaviour against future defaults.

### Playwright PWA config (`apps/web/playwright.pwa.config.ts`)

```ts
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { defineConfig, devices } from '@playwright/test'

/**
 * Offline / service-worker suite (se4-2). Runs against a production build on `vite preview`,
 * because no service worker exists under `vite` dev. Chromium only: Playwright's WebKit and
 * Firefox service worker support is too limited to be meaningful here.
 */
export default defineConfig({
  testDir: './e2e-pwa',
  // Kept apart from the default suite: CI's snapshot-mismatch detection scans test-results/.
  outputDir: './test-results-pwa',
  reporter: [['html', { outputFolder: 'playwright-report-pwa', open: 'never' }], ['list']],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Always build: the spec must exercise the sw.js it serves. `vite build` skips `tsc -b`,
    // which the typecheck step already covers. Needs vocab.json and built workspace packages.
    command: 'vite build && vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // Never reuse: a stale preview would serve an old precache.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
```

- Every test gets a fresh browser context, so each one installs its own service worker (about 4 MB from localhost, which is quick) and stays isolated. That is why `fullyParallel` is safe.
- Prerequisites: run `pnpm build` from the root once, or at least `pnpm build-vocab` plus the packages, before running locally. `vocab.json` is gitignored, and `@nihonnohon/story-loader` must have its `dist/`. CI satisfies both before the step runs.
- If port 4173 is taken (a manual `pnpm preview` is still running), `--strictPort` fails loudly. That is intended.

### Precache spec (`apps/web/e2e-pwa/precache.spec.ts`)

This is a Playwright test with **no `page` fixture**, so no browser is launched. It reads the build output that `webServer` just produced.

- Read `dist/sw.js`.
- Locate the array passed to `precacheAndRoute(`. Extract every `url:"…"` and `revision:"…"|null` pair.
  - The output is minified, with unquoted keys, so it is not JSON. A regex over that substring is fine.
  - Assert that the extracted list has more than 40 entries. This makes the test fail loudly if the plugin's output format changes.
- **Required URLs:**
  - `index.html`, `vocab.json`, `kanji-data.json`, `stories/manifest.json`
  - every file in `public/stories/*.json`, enumerated with `readdirSync`, not hard-coded, so a new story is covered automatically
  - `favicon.ico`, `favicon.svg`, `apple-touch-icon-180x180.png`, `manifest.webmanifest`
  - exactly four `assets/noto-sans-jp-*.woff2` entries
- **Forbidden:** any `.woff` URL that is not `.woff2`.
- **No conflicting duplicates:** group the entries by URL, and assert that each URL has a single distinct revision.
- **Budget:** sum `statSync(join(DIST, url)).size` over the unique URLs, and assert the total is ≤ 10,000,000 bytes. Put the total in the assertion message so the log shows the current figure.
- **Navigation route:** assert that `sw.js` contains `createHandlerBoundToURL("/index.html")` and the `/^\/_vercel\//` denylist. Match loosely, for example with a regex tolerant of whitespace, because the output is minified.
- Use the same path pattern as `e2e/file-upload.spec.ts`: `dirname(fileURLToPath(import.meta.url))`, because Playwright specs run as ESM.

### Offline spec (`apps/web/e2e-pwa/offline.spec.ts`)

```ts
/** Loads `/` online, waits for the SW to activate (precache complete), then reloads so it controls the page. */
async function primeServiceWorker(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}
```

- `navigator.serviceWorker.ready` resolves only once a worker is **active**. Workbox activates only after every precache entry has been fetched, so a resolved `ready` means the whole library is cached.
- If `ready` never resolves (registration failed), the test times out. That is the right failure.
- Registration starts after `load` and a dynamic import, so do not assert on the registration earlier than this.
- Remember the se4-1 lesson: waiting for `controllerchange` on the first visit hangs forever in prompt mode. Reload instead.

**Scenarios.** Each is its own `test()` that calls `primeServiceWorker` first, then `await context.setOffline(true)`:

- **(a) Library offline.**
  - `page.reload()`.
  - Read `public/stories/manifest.json` with `fs`.
  - Assert `page.locator('a[href^="/read/"]')` `toHaveCount(manifest.length)`. Do not use title text, because two stories can share similar titles.
  - Spot-check one title with `getByText`.
- **(b) Never-opened story.**
  - From the library, click *A New Student in Class*.
  - Expect the URL to match `/read/genki-i-ch1-classroom-introduction`.
  - Expect the word button 学生 to be visible. WordToken's `aria-label` is the plain surface, so `getByRole('button', { name: '学生' })` works.
  - Priming loads only `/` and the library's `stories/manifest.json`. `vocab.json`, `kanji-data.json` and this story file reach the page for the first time offline, so the precache must serve them.
- **(c) Lookup offline.** Continue from (b) in the same test, or repeat its steps.
  - Click 学生.
  - `getByLabel('Word lookup panel')` should contain "student" (vocab id 38).
  - `getByLabel('Kanji breakdown').locator('> div')` should have count 2 and contain "study" and "life". These come from the `kw` field of `kanji-data.json` for 学 and 生. The selector pattern comes from `e2e/infopanel-layout.spec.ts:110`.
  - Kanji data loads asynchronously after first paint (`ReaderRoute` loader, `initKanji()` is not awaited), so use auto-retrying `expect`s, never a one-shot read.
- **(d) Hard deep link.**
  - `page.goto('/read/genki-i-ch23-ramen-story')`, or any manifest story other than the one opened in (b). Read its title from the manifest.
  - Assert the InfoPanel shows that title, which is the idle state, and that at least one word button is visible.
- **(e) Uploaded story.**
  - While **online**, after priming: upload `valid-optional-absent.json` with the filechooser helper, wait for the URL `/read/<uuid>`, and save `page.url()`.
  - `setOffline(true)`, then `page.goto(savedUrl)`.
  - Expect the button `こんにちは` to be visible.
  - The loader looks in the precached manifest first, then falls back to IndexedDB (`ReaderRoute.tsx` loader, path 2).

### Offline network assertions

These go into every offline scenario, as a small helper that registers listeners right after `setOffline(true)`:

```ts
const failed: string[] = []
const notFromSw: string[] = []
page.on('requestfailed', (req) => {
  const url = new URL(req.url())
  if (url.origin === new URL(page.url()).origin && !url.pathname.startsWith('/_vercel/')) failed.push(url.pathname)
})
page.on('response', (res) => {
  const { pathname } = new URL(res.url())
  const isData = /^\/(vocab|kanji-data)\.json$|^\/stories\//.test(pathname) || res.request().isNavigationRequest()
  if (isData && !res.fromServiceWorker()) notFromSw.push(pathname)
})
// …scenario…
expect(failed, 'same-origin requests failed offline (missing from precache?)').toEqual([])
expect(notFromSw, 'responses that bypassed the service worker').toEqual([])
```

- **Why both:**
  - `context.setOffline(true)` alone cannot show **where** a response came from.
  - `fromServiceWorker()` proves the precache answered.
  - `requestfailed` catches anything left out of the precache, such as a font, an icon or a lazily loaded chunk.
- `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` 404 even online under `vite preview` (they exist only on Vercel; see se4-1 Completion Notes), and fail offline. Exclude them, and do **not** assert "no console errors".
- If a request fails only because the test navigated away (Chromium can report `net::ERR_ABORTED`), filter on `req.failure()?.errorText !== 'net::ERR_ABORTED'`. Do this only if it actually happens, and note it.

### CI steps

Add these after `- name: Build`:

```yaml
      # Offline / service-worker suite against a production build (se4-2). Chromium only;
      # the browser is installed by the step above. Not part of `pnpm test:e2e`.
      - name: PWA offline E2E (Chromium)
        run: pnpm --filter @nihonnohon/web test:e2e:pwa

      - name: Upload PWA test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-pwa-test-results
          path: apps/web/test-results-pwa/
          if-no-files-found: ignore
```

- `CI=true` is set by GitHub Actions, so `forbidOnly` and `retries: 2` apply.
- If the default E2E gate fails, later steps are skipped, which is fine.
- Do not add `test:e2e:pwa` to `turbo.json`. The root `pnpm test:e2e` (turbo) must keep running only the default suite.

### Docs content

- **`architecture-web.md` → `## Offline & Service Worker`.** Short paragraphs or a table covering:
  - vite-plugin-pwa `generateSW` with `registerType: 'prompt'`
  - registration only in `src/lib/pwa.ts`, in production only
  - the transparent-cache rule
  - the precache list (shell, fonts, `vocab.json`, `kanji-data.json`, the story manifest and every story), with per-deploy revisions that keep a story and its vocab consistent
  - the navigation fallback and `/_vercel/` denylist
  - the budget of ≤ 10 MB, about 4 MB today, enforced by `e2e-pwa/precache.spec.ts`. If the budget is exceeded, move `stories/*.json` to runtime `CacheFirst`.
  - large optional assets: opt-in downloads outside the precache
  - updates wait for the reader (se4-3 adds `UpdatePrompt`)
  - a link to ADR 007
- **`architecture-web.md` → Data Architecture.** Add one line noting that items 1–4 are precached, so they are offline after the first visit.
- **`architecture-web.md` → E2E table.** Add a second table for `apps/web/e2e-pwa/`: `precache.spec.ts` checks the build output and budget; `offline.spec.ts` checks offline reload, unseen story, lookup, deep link and uploaded story. Note that it runs on Chromium only against `vite preview`.
- **`development-guide.md` → `### PWA / Offline Tests`:**
  - Explain that `pnpm dev` has no service worker, by design.
  - Manual check: `pnpm build` (root), then `pnpm preview` in `apps/web`, then open `http://localhost:4173`, then DevTools → Application → Service workers (activated) and Cache storage, then reload once so the page is controlled, then Network → Offline, then reload and browse.
  - Automated check: `pnpm test:e2e:pwa` from `apps/web`, Chromium only, which builds and serves on its own.
  - **Clean up afterwards**: Application → Storage → "Clear site data" for `localhost:4173`. Otherwise the old worker keeps serving a previous build.

### Deferred item from se4-1

`deferred-work.md` → *Favicons outside the precache; navigation fallback has no denylist (for se4-2)*. This story resolves it:
- The favicons are now covered by the `png`, `svg` and `ico` globs.
- The `/_vercel/` denylist is added.
- Direct navigation to a precached JSON file is answered by the precache route, which is registered before the `NavigationRoute`.

Mark the entry resolved, and leave the se4-3 item in place.

### Testing standards (project-context.md)

- New Playwright specs use the `*.spec.ts` naming and the SPDX header. Keep `test.use()` at the top level only; this story should not need it.
- Do not add pixel snapshots (`feedback_visual_regression_tests`).
- The node-environment Vitest test starts with `// @vitest-environment node`. Follow the `readFileSync(join(__dirname, …))` pattern from `pwaManifest.test.ts`.
- `pnpm test:e2e` needs chromium, firefox, webkit and mobile-safari installed. `pnpm test:e2e:pwa` needs only chromium.
- No layout is measured, so the Windows DPI and WebKit hyphenation quirks in memory do not apply.

### Risks and gotchas

- **Stale preview service worker.** A manual `pnpm preview` session leaves a worker registered on `localhost:4173` in your everyday Chrome profile. Playwright uses fresh contexts, so it is unaffected, but your manual checks are not. Clear site data after every manual check.
- **First-visit cost.** Every visitor now downloads about 4 MB in the background after the `load` event. That is accepted in the epic. Do not use `immediate: true` to speed it up (se4-1 rule).
- **Deployment.** Per RT's decision of 2026-11-08, supp-epic-4 goes to `main` only as a whole. This story merges to `dev`. Say so in the PR description.
- **Real devices need HTTPS.** Service workers only run on `localhost` or HTTPS. Use the Vercel preview deployment of the PR or branch for the iOS and Android checks, not a LAN IP.

### Project structure notes

- New files:
  - `apps/web/playwright.pwa.config.ts`
  - `apps/web/e2e-pwa/precache.spec.ts`
  - `apps/web/e2e-pwa/offline.spec.ts`
  - `apps/web/src/__tests__/vercelConfig.test.ts`
- `e2e-pwa/` sits next to `e2e/`, as the epic's *Components Affected* table specifies.
- The upload fixture is reused from `e2e/fixtures/` by **file path**, not by import.
- Comments follow `feedback_comment_style`: a succinct docstring on each helper, and block comments that label each scenario. Do not narrate.

### Previous story intelligence (se4-1)

- **Facts to rely on:**
  - vite-plugin-pwa **2.0.0**, workbox-window 7.4.1, Vite 5.4, Playwright 1.59.1
  - `sw.js` sits at the dist root with scope `/`
  - the manifest's `id` is `/`
- **Facts from the se4-1 debug log:**
  - In prompt mode the first load is never controlled; a reload is required.
  - A new transitive dependency can leave a stale `.pnpm` symlink locally (the `tsup`/`jiti` episode). If `pnpm build` suddenly fails to find a package binary, run a root `pnpm install`.
- **Review lessons:**
  - Guard tests should not be bypassable. This is why the precache spec enumerates `public/stories` instead of hard-coding names, and why the offline spec checks `fromServiceWorker()` instead of trusting `setOffline`.
  - Assert the whole contract, not a sample of it.
- **Recent commits:**
  - `fcaf04f` (se4-1 review patches)
  - `e9f3704` (se4-1)
  - `1d6195f` (epic planning, which already amended the PRD, architecture, UX spec and project-context)
  - No other work touches `vite.config.ts`, `vercel.json` or CI.

### References

- [Source: _bmad-output/planning-artifacts/supp-epic-4-pwa.md#Story se4-2] — ACs and notes
- [Source: _bmad-output/planning-artifacts/supp-epic-4-pwa.md#Design Decisions] — globs, budget, Vercel, native-wrapper constraints
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-08.md#4.2] — architecture rows A3/A4 (offline caching, offline E2E)
- [Source: docs/adr/007-pwa-offline.md] — decision and constraints
- [Source: _bmad-output/project-context.md#PWA & Offline] — enforceable rules
- [Source: _bmad-output/implementation-artifacts/se4-1-web-manifest-icons-and-sw-registration.md] — Debug Log and Completion Notes (build summary, first-load control, `/_vercel` 404s)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#se4-1] — favicon and denylist item
- [Source: apps/web/src/routes/ReaderRoute.tsx#loader] — manifest → story fetch → IndexedDB fallback
- [Source: apps/web/e2e/file-upload.spec.ts] — upload helper pattern
- [Source: apps/web/e2e/infopanel-layout.spec.ts:110] — Kanji breakdown cell selector
- [Source: apps/web/node_modules/vite-plugin-pwa/dist/index.js] — manifest and icon `additionalManifestEntries`; `showMaximumFileSizeToCacheInBytesWarning` defaults to `false`
- [Source: playwright.dev/docs/service-workers] — `serviceWorkers` option, `response.fromServiceWorker()`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (`claude-opus-5-5`)

### Debug Log References

- **Port 4173 was already in use.** An orphaned `vite preview --port 4173 --strictPort` (started 13:57, likely left over from the se4-1 verification) holds the port. Stopping it was not permitted in this session. All PWA-suite runs therefore used a temporary `playwright.pwa.tmp.config.ts`, which imported the real config and overrode only the port (4174). That file has been deleted. The committed config is unchanged and still targets 4173.
- **The first offline run hit font aborts.** Scenarios (a) and (d) failed the request-failure check on `noto-sans-jp-*-400.woff2 (net::ERR_ABORTED)`. The font *is* precached: the precache spec and Cache Storage both confirm it. These were font loads from the online page that were still in flight when the test reloaded or navigated. Rather than filter out `ERR_ABORTED`, which could hide real failures, `primeServiceWorker()` now awaits `document.fonts.ready` before going offline. The suite then passed 36/36 with `--repeat-each=3`.
- **Duplicate precache URLs.** The four manifest-referenced files (`pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `manifest.webmanifest`) appear twice. The plugin injects them and the new globs also match them. Their revisions are identical, so Workbox caches each once: Cache Storage holds 50 entries. The Dev Notes rule this harmless, and `precache.spec.ts` guards against conflicting revisions. No `globIgnores` was added.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **AC1, Workbox config:**
  - `vite.config.ts` sets `globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}']`, `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/_vercel\//]` and `showMaximumFileSizeToCacheInBytesWarning: true`.
  - It sets no `skipWaiting`, `clientsClaim` or `runtimeCaching`.
  - In the built `sw.js`, `self.skipWaiting()` appears only in the `SKIP_WAITING` message handler, and `clientsClaim` does not appear.
  - The route is `NavigationRoute(createHandlerBoundToURL("/index.html"),{denylist:[/^\/_vercel\//]})`.
  - `e2e-pwa/**` is added to Vitest's `test.exclude`.
- **AC2, precache:** a clean `pnpm build` from the root printed:
  ```
  PWA v2.0.0
  mode      generateSW
  precache  54 entries (3843.19 KiB)
  files generated
    dist/sw.js
    dist/workbox-2fbc6a65.js
  ```
  - The 54 entries are 50 unique URLs (see Debug Log). Their deduplicated size is **3,935,426 bytes**, against a budget of 10,000,000.
  - The precache contains the shell, the CSS, 3 JS chunks, the 4 `.woff2` files (no `.woff`), 7 icons/favicons, `manifest.webmanifest`, `vocab.json`, `kanji-data.json`, `stories/manifest.json` and all 30 stories.
  - `e2e-pwa/precache.spec.ts` (8 tests) enforces all of this.
  - Red/green: against the plugin-default globs, 6 of 8 tests failed and named every missing story file. This also served as the "drop `json`" mutation check. After the config change, all 8 pass.
- **AC3, `vercel.json`:**
  - Added `headers: [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }]`. The rewrite and build settings are unchanged.
  - `vercelConfig.test.ts` (3 tests, node environment) was written first and seen failing on the missing header.
- **AC4, offline E2E:**
  - `playwright.pwa.config.ts` runs Chromium only, with `vite build && vite preview --port 4173 --strictPort`, no server reuse, `outputDir: test-results-pwa` and the HTML report in `playwright-report-pwa`.
  - `e2e-pwa/offline.spec.ts` covers scenarios (a)–(e), each primed online (`serviceWorker.ready`, then reload, then controller check, then `document.fonts.ready`) before `setOffline(true)`.
  - Every scenario asserts that the data responses and the navigation are `fromServiceWorker()`, and that no same-origin request fails apart from `/_vercel/*`.
  - Scenario (d)'s expected word is read from the story file (the first word with a vocab key, ruby stripped), because the reader has no `<main>` landmark to scope a generic selector.
  - Mutation checks:
    - `navigateFallback: null` made (d) and (e) fail.
    - `globIgnores: ['**/stories/genki-*.json']` made (b)+(c) and (d) fail, along with the precache spec.
    - The config was restored each time, and `git diff` confirmed it.
  - Final run: **12 passed** (8 precache + 4 offline). Before that, a `--repeat-each=3` run passed 36/36.
- **Browser check (Chromium via Playwright, against `vite preview`):**
  - After priming, Cache Storage held one cache, `workbox-precache-v2-http://localhost:4174/`, with **50** entries, including `vocab.json`, `kanji-data.json`, every story and all 4 woff2 files.
  - Offline, a direct navigation to `/vocab.json` returned `200 application/json` from the service worker, and `/stories/genki-i-ch6-tanaka-letter.json` also returned JSON. This confirms the se4-1 deferred item is fixed. `/credits` returned the shell (`text/html`) from the service worker.
  - The offline library, story, lookup and kanji flow is what `offline.spec.ts` exercises.
  - Each Playwright context is fresh, so no site data was left behind.
- **AC5, separation and CI:**
  - The `test:e2e:pwa` script runs the new suite.
  - The default suite still passes 124, with 36 skips, the same as before; it does not collect `e2e-pwa/`.
  - Vitest excludes `e2e-pwa/`.
  - The CI steps "PWA offline E2E (Chromium)" and "Upload PWA test results on failure" are added after `Build`; YAML validated, CRLF line endings preserved.
  - The output folders are gitignored and lint-ignored.
  - Nothing was added to `turbo.json`.
- **AC6, docs:**
  - `architecture-web.md` gains: a tech-stack row; a new *Offline & Service Worker* section covering generation, registration, the transparent cache, the precache, consistency, the navigation fallback, updates, the budget and the large-asset rule; a note under *Data Architecture*; an `e2e-pwa` table; and the updated `vercel.json` snippet with the header rationale.
  - `development-guide.md` gains a *PWA / Offline Tests* subsection (automated run, manual Chrome steps, cleanup) and CI step 9.
  - `deferred-work.md` marks the se4-1 item as resolved.
- **AC7, regressions:**
  - `pnpm typecheck` passed 7/7, and `pnpm run lint` is clean.
  - `pnpm run test:unit`: story-loader 34, story-generator 280, web 290 across 27 files, including the 3 new `vercelConfig` tests.
  - `pnpm test:e2e`: 124 passed, with 36 skips (the existing linux-only pixel baselines).
  - No existing spec or `playwright.config.ts` was changed.
- **RT decisions (2026-11-08):**
  1. The 4174 run of the PWA suite is accepted in place of a 4173 run (the only difference is the port; CI runs the committed config).
  2. The story moves to review with the real-device spot checks (iOS Safari, Android Chrome, AC7) still open, as a gate before `done`. RT will do them on the Vercel preview after pushing; record the results at code review.
  3. **AC7 real-device results (recorded at code review, 2026-11-08):**
     - **Android Chrome: passed.** RT ran the offline checks on the deployed preview and is happy with the results. The screenshot shows *A New Student in Class* rendered in the reader, with ruby.
     - **iOS Safari: not checked.** No iPhone was available. RT accepted this at risk and closed the story. The gap is tracked in `deferred-work.md`.

### File List

**New**
- `apps/web/playwright.pwa.config.ts`
- `apps/web/e2e-pwa/precache.spec.ts`
- `apps/web/e2e-pwa/offline.spec.ts`
- `apps/web/src/__tests__/vercelConfig.test.ts`

**Modified**
- `apps/web/vite.config.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.node.json`
- `apps/web/.eslintrc.cjs`
- `.gitignore`
- `vercel.json`
- `.github/workflows/ci.yml`
- `docs/architecture-web.md`
- `docs/development-guide.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/se4-2-offline-library-precache-and-offline-e2e.md`

### Change Log

- 2026-11-08: Implemented se4-2:
  - whole-library Workbox precache with a `/index.html` navigation fallback and `/_vercel/` denylist
  - `sw.js` no-cache header in `vercel.json`, with a guard test
  - Chromium-only offline Playwright suite against `vite preview` (precache build-output spec and offline spec), plus a CI step
  - service worker and offline-testing docs
  - the se4-1 deferred item resolved
  - Status → review. Real-device checks remain open as a gate before `done` (RT decision).
- 2026-11-08: Code review. No AC violations. All 6 patch findings applied:
  - `precache.spec.ts`:
    - checks precache completeness against every globbed `dist/` file (catches files over 2 MiB that Workbox drops)
    - checks every manifest `filename` is precached
    - asserts the four font faces by name
    - sizes the budget from disk
    - reads `sw.js` lazily
  - `offline.spec.ts`:
    - waits for the library cards and fonts before going offline, and for `kanji-data.json` in (e)
    - `assertServedOffline(expected)` polls until the expected paths have been served by the worker, and checks every same-origin response for error statuses and service-worker origin
    - new scenario (f): direct navigation to precached JSON
    - clearer errors when the test data changes
  - Docs corrected: 3.9 MB, "fails the PWA E2E step", content-hash revisions, `UpdatePrompt` note.
  - PWA suite 15/15 passed (port 4174, same temp-config workaround), and `--repeat-each=3` on the offline spec passed 15/15.
  - Mutation check: `maximumFileSizeToCacheInBytes: 600_000` made the completeness test fail and name both dropped fonts. Restored.
  - Lint clean.
  - One item deferred: E2E specs are not type-checked.
  - Status stays `review` until the AC7 real-device checks are recorded.
- 2026-11-08: AC7 recorded. Android Chrome passed. iOS Safari was not checked and is accepted at risk (RT). Status → done.
