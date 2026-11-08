# Story se4-1: Web Manifest, Icons and Service Worker Registration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **reader**,
I want to install Nihon no Hon to my home screen and launch it like an app,
So that the reader is one tap away and opens without browser chrome.

Implements PRD **FR45** and lays the groundwork for FR46/FR47 (se4-2, se4-3). Epic:
`_bmad-output/planning-artifacts/supp-epic-4-pwa.md`. Decision record: `docs/adr/007-pwa-offline.md`.

## Acceptance Criteria

1. **AC1: Build emits the PWA files**
   - `vite-plugin-pwa` is configured in `apps/web/vite.config.ts` (`generateSW`, `registerType: 'prompt'`, `injectRegister: false`, `devOptions.enabled: false`).
   - `pnpm build` writes `apps/web/dist/sw.js`, a `workbox-<hash>.js` runtime file and `manifest.webmanifest`.
   - The build log prints the plugin summary line with precache entry count and size.
   - `manifest.webmanifest` contains exactly the *Web manifest* fields in the epic: name and short_name "Nihon no Hon"; description identical to the `index.html` meta description; `start_url` `/`; `scope` `/`; `display` `standalone`; `theme_color` and `background_color` `#FDF6E3`; `lang` `en`; icons 192, 512 and 512 `purpose: maskable`. An `id: '/'` field is allowed and recommended.

2. **AC2: Icon set is generated from one source SVG**
   - `apps/web/pwa-assets.config.ts` plus a `generate-pwa-assets` script produce, in `apps/web/public/`:
     - `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`
     - `maskable-icon-512x512.png`
     - `apple-touch-icon-180x180.png` (this is the "180×180 apple-touch-icon" in the epic)
     - `favicon.ico`
   - The source is `apps/web/public/favicon.svg`: 本 in `paper-text` on a full-bleed `paper-bg` square, with an `accent` rule beneath. It is drawn with SVG paths, not `<text>`.
   - In the maskable icon, every glyph and rule pixel lies inside the central safe-zone circle (radius 40% of the icon width).
   - The generated PNGs are committed. They are not regenerated during `pnpm build`.

3. **AC3: HTML shell**
   - `apps/web/index.html` has `<meta name="theme-color" content="#FDF6E3">`, favicon links (`.ico` and `.svg`), `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">`, and `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style` meta tags.
   - The built `dist/index.html` contains `<link rel="manifest" href="/manifest.webmanifest">`, injected by the plugin. Do not hand-write this link in the source `index.html`.
   - The built `dist/index.html` has **no** injected `registerSW.js` script.

4. **AC4: One guarded registration point**
   - `apps/web/src/lib/pwa.ts` exports `registerServiceWorker()`, called once from `main.tsx`.
   - It returns immediately unless `import.meta.env.PROD` is true. Only then does it dynamically import `virtual:pwa-register` and call `registerSW`.
   - Its `onNeedRefresh`, `onOfflineReady` and returned `updateSW` handle are written to a new `usePwaStore` (`src/stores/pwaStore.ts`) for se4-3.
   - No other file under `apps/web/src/` references `navigator.serviceWorker` or imports `virtual:pwa-register`. A unit test enforces this.

5. **AC5: Installable in Chrome**
   - After `pnpm build`, run `pnpm preview` (from `apps/web`) and open `http://localhost:4173` in Chrome.
   - DevTools → Application → Manifest shows the manifest with no installability errors. Warnings about missing screenshots for the richer install UI are acceptable.
   - Service workers shows `sw.js` as **activated and is running**.
   - Installing (omnibox install icon or ⋮ → Cast, save and share → Install page as app) opens the app in a standalone window with no browser chrome. The library renders there.

6. **AC6: No regressions**
   - `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit` (in `apps/web`) and `pnpm test:e2e` (in `apps/web`) all pass.
   - The existing E2E specs are unchanged. There is no service worker under `vite` dev, because `devOptions` is disabled and the guard keeps the import out of dev.

7. **AC7: Unit tests**
   - `pwa.test.ts`:
     - The guard is a no-op outside production: `registerSW` is not called and the store is unchanged.
     - With `PROD` stubbed true, `registerSW` is called once. Its callbacks update `usePwaStore`, and the returned handle is stored.
   - `pwaStore.test.ts` covers the initial state, the setters and `_reset`.
   - `serviceWorkerBoundary.test.ts` (node environment) fails if any `src/` file other than `lib/pwa.ts` mentions `navigator.serviceWorker` or `virtual:pwa-register`.

## Tasks / Subtasks

- [x] **Task 1: Dependencies** (AC: 1, 2)
  - [x] From `apps/web`: `pnpm add -D vite-plugin-pwa@^2.0.0 @vite-pwa/assets-generator@^2.0.0 workbox-window@^7.4.1`
  - [x] Confirm `sharp` (pulled in by the assets generator) installed its prebuilt Windows binary. If pnpm reports an ignored build script for `sharp` and the generator then fails, add `sharp: true` under `allowBuilds:` in the root `pnpm-workspace.yaml`, next to `esbuild: true`.
- [x] **Task 2: Icon source and generator** (AC: 2)
  - [x] Create `apps/web/public/favicon.svg`. See *Icon source SVG* below for a starting design that already fits the safe zone.
  - [x] Create `apps/web/pwa-assets.config.ts`. See *Assets generator config*.
  - [x] Add the script `"generate-pwa-assets": "pwa-assets-generator"` to `apps/web/package.json`.
  - [x] Add `"pwa-assets.config.ts"` to the `include` array in `apps/web/tsconfig.node.json`.
  - [x] Run `pnpm generate-pwa-assets` from `apps/web`. Inspect every PNG by eye, and check the maskable icon at https://maskable.app/ or with the circle overlay in DevTools → Application → Manifest → "Show only the minimum safe area for maskable icons".
  - [x] Commit the generated files. Nothing in `public/` is gitignored except `vocab.json`.
- [x] **Task 3: Configure VitePWA** (AC: 1, 3, 6)
  - [x] Add `VitePWA({...})` to `plugins` in `apps/web/vite.config.ts`. See *VitePWA config*.
  - [x] Add `"vite-plugin-pwa/client"` to `compilerOptions.types` in `apps/web/tsconfig.app.json`. This repo has no `vite-env.d.ts`, so the types array is where the client types go.
- [x] **Task 4: HTML shell** (AC: 3)
  - [x] Add the tags listed in *index.html additions* to `apps/web/index.html`. Keep the existing meta description unchanged, because the manifest copies it.
- [x] **Task 5: Store and registration** (AC: 4)
  - [x] Create `apps/web/src/stores/pwaStore.ts`. See *pwaStore*.
  - [x] Create `apps/web/src/lib/pwa.ts`. See *registerServiceWorker*.
  - [x] In `apps/web/src/main.tsx`, call `void registerServiceWorker()` after `ReactDOM.createRoot(...).render(...)`. Keep the existing font-import comment block and imports unchanged.
- [x] **Task 6: Unit tests** (AC: 7)
  - [x] `apps/web/src/__tests__/pwaStore.test.ts`
  - [x] `apps/web/src/__tests__/pwa.test.ts`
  - [x] `apps/web/src/__tests__/serviceWorkerBoundary.test.ts`
- [x] **Task 7: Build and browser verification** (AC: 1, 3, 5)
  - [x] Delete the stale `apps/web/dist/` first.
  - [x] Run `pnpm build` from the repo root. Capture the `PWA v2.x.x` summary block from the log and paste it into the Completion Notes.
  - [x] Inspect `dist/`. Check that `sw.js`, `workbox-*.js` and `manifest.webmanifest` exist and that the manifest has the AC1 fields. Check that `dist/index.html` has the manifest link and no `registerSW.js`.
  - [x] Run `pnpm preview` from `apps/web`, then do the Chrome checks in AC5, including installing and launching standalone. Uninstall afterwards.
  - [x] **Clean up after testing.** In DevTools → Application → Storage, use "Clear site data" for `localhost:4173`. Otherwise the service worker keeps serving the old build to later preview sessions. Port 5173 is a different origin and is not affected.
- [x] **Task 8: Regression gates** (AC: 6)
  - [x] Run `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit` (in `apps/web`) and `pnpm test:e2e` (in `apps/web`, with all four browser projects installed).
- [x] **Task 9: Developer guide note** (AC: 2)
  - [x] Add a short "PWA icons" subsection to `docs/development-guide.md`: the source is `public/favicon.svg`, run `pnpm generate-pwa-assets` in `apps/web`, then commit the PNGs. se4-2 adds the full service worker and offline testing docs; do not write those here.

### Review Findings

Code review 2026-11-08: commit `e9f3704` vs `1d6195f`; Blind Hunter, Edge Case Hunter and Acceptance Auditor. All seven ACs are met.

- [x] [Review][Decision] What `usePwaStore.reset()` should clear — `reset` and `_reset` are identical, so a public `reset()` call nulls `updateServiceWorker`, and se4-3's Reload button would then do nothing. **Resolved (RT): (a), keep the handle** → patch below.
- [x] [Review][Decision] Icon artwork: the lower bar joins both sweeps — `M204 312 H308` overlaps both sweeps, so the lower half of 本 reads as a closed triangle. **Resolved (RT): shorten the bar** → patch below.
- [x] [Review][Patch] `reset()` keeps the update handle — `reset` clears `needRefresh`/`offlineReady` only; `_reset` (test teardown) still clears everything, including `updateServiceWorker`. Update `pwaStore.test.ts` to match. [apps/web/src/stores/pwaStore.ts:417]
- [x] [Review][Patch] Shorten 本's lower bar so it stands free of the sweeps — edit `favicon.svg` (e.g. `M222 316 H290`), recheck the maskable safe zone on the generated pixels, run `pnpm generate-pwa-assets` and commit the regenerated PNGs/ICO. [apps/web/public/favicon.svg:79]
- [x] [Review][Patch] Boundary test can be bypassed and also gives false positives — it matches only the literal substrings `navigator.serviceWorker`/`virtual:pwa-register`, so `'serviceWorker' in navigator`, `navigator['serviceWorker']`, `const { serviceWorker } = navigator` and a direct `workbox-window` import all pass. It skips only the top-level `__tests__/`, so a nested or colocated test fails it, and it scans only `.ts`/`.tsx`. Fix: match any `serviceWorker` identifier plus `virtual:pwa-register` and `workbox-window`, skip every `__tests__` directory and `*.test.*` file, and scan `.js/.jsx/.mts/.cts` too. [apps/web/src/__tests__/serviceWorkerBoundary.test.ts:16]
- [x] [Review][Patch] Store docstrings misstate how the update handle behaves — (1) vite-plugin-pwa 2.0 ignores `reloadPage` in prompt mode: `updateServiceWorker(false)` still reloads, because no `onNeedReload` is passed. (2) The handle is stored as soon as registration *starts*, so a non-null handle does not mean a worker exists (failures arrive later via `onRegisterError`). Correct the `UpdateServiceWorker` and `updateServiceWorker` docs so se4-3 does not rely on either. [apps/web/src/stores/pwaStore.ts:6]
- [x] [Review][Patch] Test mocks can leak between tests — `afterEach` only calls `registerSW.mockClear()`, which leaves a queued `mockImplementationOnce` (the "boom" throw) in place. `updateSW` is never cleared, and the `console.warn` spy is restored only if every assertion before it passes. Use `registerSW.mockReset()` (Vitest 3 restores the original implementation), `updateSW.mockClear()` and `vi.restoreAllMocks()` in `afterEach`. [apps/web/src/__tests__/pwa.test.ts:149]
- [x] [Review][Patch] The real failure path is untested — the library reports async failures through `onRegisterError`, but the test only simulates a synchronous throw. Add a test that calls `options.onRegisterError(err)` and asserts `console.warn`. [apps/web/src/__tests__/pwa.test.ts:202]
- [x] [Review][Patch] No-op tests don't assert the whole store is unchanged (AC7) — the first checks only `updateServiceWorker`, and the "no SW support" test checks nothing. Assert `needRefresh`/`offlineReady`/`updateServiceWorker` all match the initial state in both. [apps/web/src/__tests__/pwa.test.ts:159]
- [x] [Review][Patch] `generateSW` is implicit (AC1) — add `strategies: 'generateSW'` so the AC can be read from the config itself. [apps/web/vite.config.ts:466]
- [x] [Review][Patch] Nothing enforces that the manifest description matches `index.html` (AC1) — only a comment keeps the two strings in step. Add a node-environment unit test asserting that the `index.html` meta description string appears verbatim in `vite.config.ts`. [apps/web/vite.config.ts:456]
- [x] [Review][Defer] No periodic update check for long-lived sessions [apps/web/src/lib/pwa.ts:21] — deferred to se4-3: client-side navigations don't trigger the browser's SW update check, so an installed app that is never relaunched never fires `onNeedRefresh`. Consider `onRegisteredSW` + an hourly `registration.update()` alongside `UpdatePrompt`.
- [x] [Review][Defer] HTML favicons not precached; navigation fallback has no denylist [apps/web/vite.config.ts:488] — deferred to se4-2: the default precache omits `favicon.ico`/`favicon.svg`/`apple-touch-icon-180x180.png`, and the default `NavigationRoute` serves the SPA shell when `/vocab.json`, `/kanji-data.json` or `/stories/*` is opened directly.

## Dev Notes

### Scope boundary: what this story does NOT do

| Item | Owner |
|---|---|
| Workbox `globPatterns` (fonts, JSON, stories), explicit `navigateFallback` / `navigateFallbackDenylist`, ≤ 10 MB budget check | se4-2 |
| `vercel.json` `/sw.js` `Cache-Control` header | se4-2 |
| `playwright.pwa.config.ts`, `e2e-pwa/`, CI job | se4-2 |
| `docs/architecture-web.md` service worker section | se4-2 |
| `UpdatePrompt` toast, `beforeinstallprompt` capture, SettingsMenu install item | se4-3 |

Leave the `workbox` block **unset**, so the plugin defaults apply. These are `globPatterns: ['**/*.{js,css,html}']`, `navigateFallback: 'index.html'` and `cleanupOutdatedCaches: true`, and the manifest icons are added to the precache automatically (`includeManifestIcons`). se4-2 replaces these values deliberately. **Never** set `skipWaiting` or `clientsClaim`. They break `registerType: 'prompt'` and the rule that the app never reloads on its own (FR47).

### Current state of files being modified

- **`apps/web/vite.config.ts`**
  - Today it has `plugins: [react()]`, the `@` alias and an inline Vitest `test` block (jsdom, globals, `setupFiles: ['./src/__tests__/setup.ts']`, excluding `e2e/`).
  - **Change:** add `VitePWA(...)` after `react()`.
  - **Preserve:** the alias and the `test` block. Vitest loads this same config, so the PWA plugin also runs under Vitest. See *Vitest and the virtual module*.
- **`apps/web/index.html`**
  - Today it has charset, viewport, `google notranslate`, the meta description ("Nihon no Hon — read Japanese stories at your level with instant word lookup and kanji breakdown.") and the title. It has no icons and no theme-color.
  - **Preserve:** `lang="en" translate="no"` and every existing tag.
- **`apps/web/src/main.tsx`**
  - Today it imports React, ReactDOM, four `@fontsource/noto-sans-jp` CSS files (with a long rationale comment), `App` and `index.css`, then renders `<React.StrictMode><App/></React.StrictMode>`.
  - **Change:** one import and one call after `render`.
  - Registration happens outside React, so StrictMode double-invocation does not apply.
- **`apps/web/tsconfig.app.json`**
  - Today: `"types": ["vitest/globals", "vite/client"]`.
  - **Change:** append `"vite-plugin-pwa/client"`. This declares the `virtual:pwa-register` module and its `RegisterSWOptions` type.
- **`apps/web/tsconfig.node.json`**
  - Today it includes `vite.config.ts`, `tailwind.config.ts` and `playwright.config.ts`.
  - **Change:** add `pwa-assets.config.ts`.
- **`apps/web/package.json`**
  - **Change:** three dev deps and one script.
  - `build` stays `tsc -b && vite build`. Do not add icon generation to it: sharp makes CI slower and more fragile, and the PNGs are committed.
- **`apps/web/src/App.tsx`**
  - **Not modified.** It already gates Vercel Analytics on `import.meta.env.PROD`. Follow the same pattern in `pwa.ts`.

### VitePWA config

```ts
import { VitePWA } from 'vite-plugin-pwa'

// inside defineConfig({ plugins: [ react(), VitePWA({...}) ] })
VitePWA({
  // Updates wait for the reader's choice (FR47); se4-3 surfaces them via UpdatePrompt.
  registerType: 'prompt',
  // Registration happens only in src/lib/pwa.ts — never an injected registerSW.js.
  injectRegister: false,
  // No service worker under `vite` dev: keeps the default Playwright suite SW-free.
  devOptions: { enabled: false },
  manifest: {
    id: '/',
    name: 'Nihon no Hon',
    short_name: 'Nihon no Hon',
    description:
      'Nihon no Hon — read Japanese stories at your level with instant word lookup and kanji breakdown.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#FDF6E3', // paper-bg token
    background_color: '#FDF6E3', // paper-bg token
    lang: 'en',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // workbox: intentionally unset in se4-1 — se4-2 owns globPatterns / navigateFallback.
})
```

- The description must match `index.html` character for character, including the em dash. If you would rather not duplicate the string, put it in a `const` at the top of `vite.config.ts` and add a comment that it mirrors `index.html`.
- `#FDF6E3` is the `paper-bg` token value in `tailwind.config.ts`. The manifest and meta tag cannot use Tailwind classes, so the hex value is correct here. The token rule applies to class names.

### index.html additions

Insert these after the existing meta description:

```html
<meta name="theme-color" content="#FDF6E3" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Nihon no Hon" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

- Running `pwa-assets-generator` also prints suggested head links. Compare them with the block above and keep the filenames consistent.
- `mobile-web-app-capable` goes alongside the Apple tag because Chrome logs a deprecation warning when it sees `apple-mobile-web-app-capable` alone.
- `status-bar-style: default` gives a light bar with dark text, which matches the light paper theme. `black-translucent` would draw the status bar over the content and needs safe-area padding, so do not use it.

### Icon source SVG

The design is fixed by the epic: 本 in `paper-text` #1C1C1C on a `paper-bg` #FDF6E3 square, with an `accent` #C8A85A rule beneath. It is drawn with paths (strokes are fine) so that rendering needs no font. Hand-drawn strokes also avoid copying font outlines.

Starting design on a 512 grid. Every stroke endpoint and every rule corner is within about 180 px of the centre (256, 256), and the safe-zone radius is 204.8 px, so this design passes AC2 when maskable padding is 0:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FDF6E3"/>
  <g fill="none" stroke="#1C1C1C" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M156 196 H356"/>                 <!-- top horizontal -->
    <path d="M256 132 V384"/>                 <!-- vertical -->
    <path d="M248 204 Q212 292 150 340"/>     <!-- left sweep -->
    <path d="M264 204 Q300 292 362 340"/>     <!-- right sweep -->
    <path d="M204 312 H308"/>                 <!-- short lower bar -->
  </g>
  <rect x="176" y="402" width="160" height="14" rx="7" fill="#C8A85A"/>  <!-- accent rule -->
</svg>
```

- Refine the proportions freely, but re-check the safe zone after any change.
- RT may replace the artwork later. The workflow is to edit `favicon.svg`, then run `pnpm generate-pwa-assets` and commit the output.
- `favicon.svg` lives in `public/` for two reasons. First, `@vite-pwa/assets-generator` **writes its output into the same folder as the source image**. A source in `apps/web/pwa-assets/`, which the epic suggests as an example, would send the PNGs there instead of `public/`. Second, the file then doubles as the modern SVG favicon.

### Assets generator config (`apps/web/pwa-assets.config.ts`)

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/** Generates the PWA icon set into public/ from the single source SVG (run: pnpm generate-pwa-assets). */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The source is already a full-bleed paper-bg square with the glyph inside the safe zone,
    // so maskable/apple need no extra padding; background matches paper-bg in case of any edge.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#FDF6E3' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#FDF6E3' } },
  },
  images: ['public/favicon.svg'],
})
```

- Output from `minimal2023Preset`:
  - `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png` (transparent icons, 5% padding)
  - `favicon.ico` (48 px)
  - `maskable-icon-512x512.png`
  - `apple-touch-icon-180x180.png`
- With the preset defaults, maskable and apple icons get 30% padding on a white background. The overrides above prevent a white border around a cream icon.
- If `resizeOptions` does not apply in v2, keep `padding: 0`. A full-bleed source has no edge to fill, so the result is the same.

### pwaStore (`apps/web/src/stores/pwaStore.ts`)

Follow the store conventions in `project-context.md`: a named `export const usePwaStore = create<...>()(...)`, no default export, `_reset` alongside `reset`, and **no** `persist` (this is runtime state only).

```ts
interface PwaStoreState {
  /** A new service worker is installed and waiting (se4-3 shows UpdatePrompt). */
  needRefresh: boolean
  /** The app shell has been precached for offline use (first install). */
  offlineReady: boolean
  /** Activates the waiting SW and reloads once; null until registered (or never, outside PROD). */
  updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null
  setNeedRefresh: (v: boolean) => void
  setOfflineReady: (v: boolean) => void
  setUpdateServiceWorker: (fn: (reloadPage?: boolean) => Promise<void>) => void
  reset: () => void
  _reset: () => void
}
```

se4-3 will add install state, the deferred `beforeinstallprompt` event, to this same store. Do **not** add it here.

### registerServiceWorker (`apps/web/src/lib/pwa.ts`)

```ts
import { usePwaStore } from '@/stores/pwaStore'

/**
 * Registers the Workbox service worker — the app's only touch-point with
 * navigator.serviceWorker (ADR 007). No-ops outside production builds, so the
 * dev server, unit tests and a future native wrapper run without a service worker.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  try {
    // Dynamic import keeps workbox-window out of dev and out of the main chunk.
    const { registerSW } = await import('virtual:pwa-register')
    const store = usePwaStore.getState()
    const updateSW = registerSW({
      onNeedRefresh: () => store.setNeedRefresh(true),
      onOfflineReady: () => store.setOfflineReady(true),
      onRegisterError: (error) => console.warn('[pwa] service worker registration failed', error),
    })
    store.setUpdateServiceWorker(updateSW)
  } catch (error) {
    // The app must work identically without a service worker — never surface this to the reader.
    console.warn('[pwa] service worker unavailable', error)
  }
}
```

- **Why a dynamic import inside the guard:** Vite replaces `import.meta.env.PROD` with a constant. In dev the import is unreachable, so the virtual module never loads. In a production build it becomes a small separate chunk, which the precache covers.
- **Do not pass `immediate: true`.** By default Workbox registers after the `load` event, so precaching does not compete with first render. If `load` has already fired by the time the dynamic import resolves, Workbox registers straight away, so no registration is lost.
- **`registerSW` returns `updateSW(reloadPage = true)`.** In prompt mode it tells the waiting worker to skip waiting, then reloads once when that worker takes control. se4-3 calls it from the Reload button.
- **Keep the store calls via `getState()`.** This module runs outside React.
- The `'serviceWorker' in navigator` check is allowed **only here**. AC4 and the boundary test treat `lib/pwa.ts` as the single permitted file. `virtual:pwa-register` (inside the library) also touches `navigator.serviceWorker`. That is library code, not app code.

### Vitest and the virtual module

- **`PROD` in tests.**
  - Vitest runs in `mode: 'test'`, so `import.meta.env.PROD` is `false` by default and the no-op path needs no setup.
  - For the registration path, use `vi.stubEnv('PROD', true)`. Vitest 3 accepts booleans for `PROD`/`DEV`/`SSR`.
  - Call `vi.unstubAllEnvs()` in `afterEach`.
  - `import.meta.env` is a live object under Vitest, so stubbing after `pwa.ts` has been imported still works.
- **Mocking `virtual:pwa-register`.** Use `vi.hoisted` so the factory can reference the spy:
  ```ts
  const { registerSW, updateSW } = vi.hoisted(() => {
    const updateSW = vi.fn(async () => {})
    return { updateSW, registerSW: vi.fn(() => updateSW) }
  })
  vi.mock('virtual:pwa-register', () => ({ registerSW }))
  ```
  - To test the callbacks, read the options argument with `registerSW.mock.calls[0][0]`, call `onNeedRefresh()`, then assert `usePwaStore.getState().needRefresh === true`.
  - jsdom does not define `navigator.serviceWorker`. In the PROD test, add it with `Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })` and delete it in `afterEach`. Alternatively, have the guard check `navigator` in a way the test can satisfy.
- **If Vitest cannot resolve `virtual:pwa-register`,** for example because the plugin does not resolve it in serve mode:
  - Add `alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/__tests__/stubs/pwa-register.ts', import.meta.url)) }` to the `test` block in `vite.config.ts`, with a stub exporting `registerSW`.
  - `vi.mock` then intercepts the aliased path.
  - Use this only if needed, and record the choice in Completion Notes.
- **If the PWA plugin misbehaves under Vitest** (unexpected output or slow startup), the plugin supports `disable: true`. Set `disable: !!process.env['VITEST']` and rely on the alias above. Again, only if needed.
- **`serviceWorkerBoundary.test.ts`:**
  - Its first line is `// @vitest-environment node`.
  - Walk `src/` recursively with `fs.readdirSync(..., { recursive: true })` or a small walker, reading `*.ts`/`*.tsx`.
  - Skip `src/__tests__/` (the tests themselves mention the strings) and `src/lib/pwa.ts`.
  - Assert that no file contains `navigator.serviceWorker` or `virtual:pwa-register`.
  - Report offending paths in the failure message.
  - Follow the `readFileSync`/`join(__dirname, ...)` pattern in `e2eFixtureContract.test.ts`.

### Testing standards (from project-context.md)

- Unit tests go in `apps/web/src/__tests__/`, named `*.test.ts`. Vitest globals are on.
- Do not add E2E tests in this story. The service worker cannot run under `vite` dev, and the preview-server PWA suite belongs to se4-2.
- `pnpm test:e2e` needs chromium, firefox, webkit **and** the mobile-safari project. Run `pnpm exec playwright install chromium firefox webkit` first if any browser is missing.
- **Browser verification is mandatory** (CLAUDE.md). AC5 is a manual Chrome check against `pnpm preview`, not `pnpm dev`, because no service worker exists in dev. Record what you saw in Completion Notes: manifest panel state, SW status and the standalone launch.
- **Lighthouse has no PWA category any more** (removed in Lighthouse 12). Use the Application panel, not a Lighthouse score, as evidence.

### Deployment caution

`registerType: 'prompt'` with no `UpdatePrompt` (se4-3) means a deployed update sits in the "waiting" state until every tab or window of the app closes. Installed users would keep the old version across reloads until they fully quit.

**Decision (RT, 2026-11-08):** se4-1 merges into `dev` as normal. supp-epic-4 reaches `main` (production) only as a whole, once se4-2 and se4-3 are also in `dev`. Mention this in the PR description so nobody promotes `dev` to `main` partway through the epic.

### Library and version notes (checked 2026-11-08)

- **vite-plugin-pwa 2.0.0** (released 2026-10-03).
  - Peers: `vite ^3–^8` (installed Vite is 5.4.21, so it is compatible), `workbox-build ^7.4.1`, `workbox-window ^7.4.1`, `@vite-pwa/assets-generator ^1 || ^2`.
  - Requires Node ≥ 20.19. Local Node is 24.21 and CI is 22.
  - The 2.0 release has no API breaking changes beyond allowing assets-generator 2.
- **@vite-pwa/assets-generator 2.0.0** (released 2026-09-12): CLI binary `pwa-assets-generator`, reads `pwa-assets.config.ts`, depends on `sharp ^0.35`.
- **workbox-window 7.4.1:** add it as an explicit dev dependency. `virtual:pwa-register` imports `workbox-window` from the app's own module graph, and under pnpm's strict `node_modules` a transitive copy is not resolvable from `apps/web`.
- **Do not use the plugin's integrated `pwaAssets` option.** It generates icons at build time, while this project commits the PNGs and keeps `pnpm build` sharp-free.

### Project structure notes

- New files:
  - `src/lib/pwa.ts` (utilities live in `lib/`, as plain functions)
  - `src/stores/pwaStore.ts`
  - three tests in `src/__tests__/`
  - `pwa-assets.config.ts` at the `apps/web` root, next to the other tool configs
  - `public/favicon.svg` plus the generated PNGs and ICO
- Use the `@/` alias for imports (`@/stores/pwaStore`).
- Add the repository's copyright and SPDX header to every new `.ts` file:
  ```ts
  // Copyright (c) 2026 Rupert Thomas
  // SPDX-License-Identifier: MIT
  ```
- Comments follow `feedback_comment_style`: a succinct docstring on each exported function and store, and block comments that label major sections. Do not narrate.
- Deliberate variance from the epic: the icon source is `public/favicon.svg`, not `pwa-assets/icon.svg`. The epic offered that path only as an example ("e.g."), and the generator's output location forces this choice. Generated filenames follow the `minimal2023Preset` defaults (`apple-touch-icon-180x180.png`, not `apple-touch-icon.png`).

### Previous story and git intelligence

- This is the first story in supp-epic-4, so there are no prior dev notes in this epic.
- The most recent commit (`1d6195f`) is the planning commit. It updated the PRD (FR45–FR47, NFR6), architecture, UX spec, `project-context.md` (*PWA & Offline*) and ADR 007. Those documents are the source of truth above.
- Lessons from earlier epics that apply here:
  - Verify in a real browser. Store-only tests miss wiring bugs: a `needRefresh` store that nothing sets is the same "setter without consumer" class of bug.
  - Keep visual-regression snapshots out of this story (`feedback_visual_regression_tests`).
  - The WebKit and Windows DPI quirks in memory notes do not affect this story. It does no layout measurement.

### References

- [Source: _bmad-output/planning-artifacts/supp-epic-4-pwa.md#Story se4-1] — ACs and notes
- [Source: _bmad-output/planning-artifacts/supp-epic-4-pwa.md#Design Decisions] — tooling, manifest table, icons, native-wrapper constraints
- [Source: docs/adr/007-pwa-offline.md] — decision and constraints
- [Source: _bmad-output/project-context.md#PWA & Offline] — enforceable agent rules
- [Source: _bmad-output/project-context.md#State Management (Zustand)] — store conventions
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#App Install & Updates] — no install banners on first visit; update UX (se4-3)
- [Source: _bmad-output/planning-artifacts/prd.md] — FR45, FR46, FR47, NFR6
- [Source: apps/web/tailwind.config.ts] — `paper-bg` #FDF6E3, `paper-text` #1C1C1C, `accent` #C8A85A
- [Source: apps/web/src/App.tsx] — existing `import.meta.env.PROD` gating pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (`claude-opus-5-5`)

### Debug Log References

- **`pnpm build` failed after the dependency install.** `packages/schema` could not find `tsup/dist/cli-default.js`. The cause: adding `@vite-pwa/assets-generator` brought `jiti@2.7.0` into the graph, which changed `tsup`'s optional `jiti` peer resolution from 1.21.7 to 2.7.0. That gave `tsup` a new `.pnpm` store folder name and left the old symlink dangling. A root `pnpm install` relinked it. Tailwind keeps its own `jiti` 1.x. This only affects existing local checkouts; CI's clean `pnpm install --frozen-lockfile` is unaffected.
- **The first Chromium check hung.** My script waited for `controllerchange` on the first visit. In prompt mode without `clientsClaim` the first page load is never claimed, so it never fired; the page becomes controlled only after a reload. That is correct behaviour, and the script was fixed to reload after activation.

### Completion Notes List

- Ultimate context engine analysis completed: comprehensive developer guide created.
- **AC1, build:** `pnpm build` (clean `dist/`) printed:
  ```
  PWA v2.0.0
  mode      generateSW
  precache  9 entries (472.95 KiB)
  files generated
    dist/sw.js
    dist/workbox-2fbc6a65.js
  ```
  - `dist/manifest.webmanifest` has every field from the epic table plus `id: "/"`. The description matches `index.html` exactly; it comes from one `APP_DESCRIPTION` const in `vite.config.ts`, commented as a mirror of the HTML.
  - In `sw.js`, `skipWaiting()` runs only inside the `SKIP_WAITING` message handler, and `clientsClaim` is absent, so prompt mode is intact.
  - Precache entries use the plugin defaults for now (shell, JS/CSS, the registration chunks, manifest and its icons); se4-2 widens the globs.
- **AC2, icons:**
  - `public/favicon.svg` draws 本 as stroked paths, plus the accent rule, on a full-bleed paper-bg square.
  - `pnpm generate-pwa-assets` produced `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` and `favicon.ico`. All were inspected visually: the maskable and apple icons are full-bleed cream with no white border.
  - **Safe zone, measured on the generated pixels:** the farthest non-background pixel is 176.5 px from the centre against a 204.8 px limit (512 maskable), and 62.0 px against 72.0 px (180 apple). Both pass.
  - The `resizeOptions.background` override is accepted by generator v2.
- **AC3, HTML:** the theme-color, both favicon links, apple-touch-icon and the four mobile/apple meta tags are in `index.html`. The built `dist/index.html` has the plugin-injected `<link rel="manifest" href="/manifest.webmanifest">` and no `registerSW.js`.
- **AC4, registration:**
  - `src/lib/pwa.ts` has two guards: `import.meta.env.PROD` and `'serviceWorker' in navigator`.
  - Behind them it dynamically imports `virtual:pwa-register` and calls `registerSW` with default, non-immediate registration.
  - It wires `onNeedRefresh`, `onOfflineReady` and the returned `updateSW` into `usePwaStore`, which is not persisted and has `reset`/`_reset`.
  - Failures are caught and only `console.warn`ed.
  - `main.tsx` calls `void registerServiceWorker()` after render.
  - The build emits `virtual_pwa-register` (0.99 kB) and `workbox-window` (5.71 kB) as separate chunks, outside the main bundle.
- **AC5, Chrome:** run against `pnpm preview` on :4173.
  - **Automated (Playwright Chromium + CDP):**
    - `Page.getAppManifest` returned no parse errors.
    - `Page.getInstallabilityErrors` returned `[]`.
    - The service worker is `activated`; the page is controlled after a reload.
    - The library rendered all 30 manifest stories.
    - Every icon, `favicon.svg` and `sw.js` returned 200 with the correct content types.
    - The only console errors were the two expected `/_vercel/insights|speed-insights/script.js` 404s, which exist only on a Vercel deployment (see `App.tsx`).
  - **Manual (RT):** installed from Chrome. The app opened in a standalone window with no browser chrome and showed the library. RT then uninstalled it and cleared site data for localhost:4173.
- **AC6, regressions:**
  - `pnpm typecheck` passed (7/7).
  - `pnpm run lint` passed.
  - Root `pnpm run test:unit` passed: story-loader 34, story-generator 280, web 284.
  - `pnpm test:e2e` passed 124. All 36 skips are the existing linux-only pixel-baseline skips (`accessibility.spec.ts:100`).
  - No E2E spec or Playwright config changed.
- **AC7, tests:**
  - `pwaStore.test.ts` (5 tests).
  - `pwa.test.ts` (5 tests): the no-op outside PROD, the no-op without SW support, one registration in PROD storing the handle and not passing `immediate: true`, callbacks updating the store, and swallowed failures.
  - `serviceWorkerBoundary.test.ts` (2 tests, node environment).
  - All were written test-first and confirmed failing before implementation.
  - The boundary test was mutation-checked: a temporary `src/lib/zzViolation.ts` referencing `navigator.serviceWorker` made it fail, naming the file, and the file was then removed.
  - `vi.mock('virtual:pwa-register')` resolved under Vitest with the PWA plugin active, so neither the alias fallback nor `disable: VITEST` was needed.
- **Deployment:** per RT's decision (2026-11-08), this merges into `dev`, and supp-epic-4 reaches `main` only as a whole. State this in the PR description.

### File List

**New**
- `apps/web/pwa-assets.config.ts`
- `apps/web/public/favicon.svg`
- `apps/web/public/favicon.ico`
- `apps/web/public/pwa-64x64.png`
- `apps/web/public/pwa-192x192.png`
- `apps/web/public/pwa-512x512.png`
- `apps/web/public/maskable-icon-512x512.png`
- `apps/web/public/apple-touch-icon-180x180.png`
- `apps/web/src/lib/pwa.ts`
- `apps/web/src/stores/pwaStore.ts`
- `apps/web/src/__tests__/pwa.test.ts`
- `apps/web/src/__tests__/pwaStore.test.ts`
- `apps/web/src/__tests__/serviceWorkerBoundary.test.ts`

**Modified**
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/package.json`
- `apps/web/tsconfig.app.json`
- `apps/web/tsconfig.node.json`
- `pnpm-lock.yaml`
- `docs/development-guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/se4-1-web-manifest-icons-and-sw-registration.md`

### Change Log

- 2026-11-08: Implemented se4-1:
  - added vite-plugin-pwa (prompt mode, manifest, no dev SW)
  - added the generated icon set from `public/favicon.svg`
  - added the PWA meta tags to the HTML shell
  - added guarded `registerServiceWorker()` and `usePwaStore`
  - added unit tests, including a service-worker boundary test
  - added the dev-guide note on PWA icons
  - Status → review.
- 2026-11-08: Code review. Applied 9 patches: a stricter service-worker boundary test, a manifest-description guard test, PWA test cleanup and coverage of the onRegisterError failure path, accurate store docstrings, `reset()` now keeps the update handle, explicit `strategies: 'generateSW'`, and a shortened lower bar on 本 with regenerated icons (safe zone re-measured: 176.5/204.8 px). 2 items deferred to se4-2/se4-3. Status → done.
