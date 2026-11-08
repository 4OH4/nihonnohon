---
generated: 2026-05-13
scan_level: deep
part: web
project_type: web
---

# Architecture — Web App (`apps/web`)

## Executive Summary

The web app is a React 18 SPA with three routes: a story library, a story reader, and a credits page. Its core interaction is word-level vocabulary lookup: users tap a Japanese word token to see its meaning, reading, and kanji breakdown in a persistent info panel.

The app is static — it fetches vocabulary and kanji dictionaries once at startup, loads stories from a manifest of JSON files, and stores locally uploaded stories in IndexedDB. There is no backend API.

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.3.1 |
| Build tool | Vite | 5.3.0 |
| Language | TypeScript | 5.5.0 (strict) |
| Module system | ESM (`"type": "module"`) | — |
| Routing | react-router-dom | 6.24.0 |
| State management | Zustand | 4.5.4 |
| Styling | Tailwind CSS | 3.4.0 |
| UI primitives | Radix UI Popover | ^1.1.15 |
| CSS utilities | clsx + tailwind-merge (`cn()`) | — |
| Story loading | @nihonnohon/story-loader | workspace |
| Types | @nihonnohon/schema | workspace |
| Unit testing | Vitest + @testing-library/react | 3.0.0 |
| E2E testing | Playwright + axe-core | 1.44.0 |
| Accessibility | @axe-core/playwright | ^4.11.3 |
| PWA / offline | vite-plugin-pwa (Workbox `generateSW`) | 2.0.0 |

---

## Architecture Pattern

**Component-based SPA with a loader-per-route pattern.**

- React Router v6's `loader` functions handle async data fetching (vocabulary init, story loading) before the route component renders.
- Zustand stores manage cross-component state (lookup state, user preferences).
- Services use a module-level singleton pattern for one-time data initialisation.
- No server-side rendering; the app is deployed as a static site on Vercel.

---

## Routes

| Path | Component | Loader | Error Element |
|------|-----------|--------|---------------|
| `/` | `LibraryRoute` | `loader()` → `fetchManifest()` | `LibraryError` |
| `/read/:storyId` | `ReaderRoute` | `loader()` → vocab+kanji init + story fetch | `ReaderError` |
| `/credits` | `CreditsRoute` | — | `LibraryError` |

### LibraryRoute (`/`)

- Fetches `manifest.json` via `loader()`
- Renders a filterable list of `StoryCard` components
- Provides source and chapter difficulty filters (derived from `ManifestEntry.difficulty`)
- Handles local file upload: reads via `FileReader`, validates with `loadStory()`, stores in IndexedDB, navigates to `/read/:uuid`

### ReaderRoute (`/read/:storyId`)

- Parallel-initialises vocab and kanji data services via `loader()`
- Looks up the story by `storyId` in the manifest first, then falls back to IndexedDB
- Renders the full reader: `InfoPanel`, `ToolBar`, `SentenceBlock` list, and side panels
- Responsive: two-column layout on desktop (`lg:`), tabbed layout on mobile

### CreditsRoute (`/credits`)

- Static attribution page for Genki vocabulary data and kanjiapi.dev

---

## State Management

### `lookupStore` (Zustand, non-persistent)

Tracks which word is currently selected and the lookup result.

| State | Type | Description |
|-------|------|-------------|
| `lookupState` | `LookupState` | Discriminated union: idle / found / not-found |
| `selectedSentenceId` | `string \| null` | ID of the currently highlighted sentence |

Key actions: `lookup(word, entry, sentenceId)`, `selectSentence(sentenceId)`, `reset()`

### `preferenceStore` (Zustand, persisted to `localStorage`)

Persisted key: `nihonnohon-preferences`

| State | Type | Default |
|-------|------|---------|
| `rubyMode` | `'all' \| 'supplement' \| 'none'` | `'supplement'` |
| `spacingVisible` | `boolean` | `false` |
| `transVisible` | `boolean` | `false` |
| `textSize` | `'small' \| 'medium' \| 'large'` | `'medium'` |
| `activeTab` | `'story' \| 'vocabulary' \| 'grammar'` | `'story'` |

---

## Services

| Service | File | Pattern | Data |
|---------|------|---------|------|
| Vocabulary | `vocabService.ts` | Singleton, lazy-init | `/vocab.json` → `Map<number, VocabEntry>` |
| Kanji | `kanjiService.ts` | Singleton, lazy-init | `/kanji-data.json` → `Map<string, KanjiEntry>` |
| IndexedDB | `indexedDbService.ts` | Lazy connection | `nihonnohon-local-stories` / `stories` object store |

Both vocab and kanji services share a single in-flight `Promise` for concurrent callers — subsequent calls during the initial fetch wait for the same promise rather than creating additional requests.

---

## Component Hierarchy (Reader)

```
ReaderRoute
├── AppBar (reader variant — "← Library" link)
├── InfoPanel (lookup result or story metadata)
├── ToolBar (ruby toggle, translation toggle, SettingsMenu)
├── [story column]
│   └── SentenceBlock (×n)
│       └── WordToken (×m per sentence)
├── [desktop right panel]
│   ├── VocabPanel
│   │   └── VocabItem (×n)
│   └── GrammarPanel
└── [mobile bottom tab bar]
```

---

## Design System

Custom Tailwind tokens defined in `tailwind.config.ts`:

| Token | Hex | Use |
|-------|-----|-----|
| `paper-bg` | `#FDF6E3` | Page background (warm cream) |
| `paper-text` | `#1C1C1C` | Primary text (near-black) |
| `surface` | `#FFFFFF` | Card and panel background |
| `surface-subtle` | `#F5F5F0` | Subtle dividers |
| `accent` | `#C8A85A` | Active states, borders (warm gold) |
| `accent-subtle` | `#F5EDD6` | Active backgrounds (light gold) |
| `muted` | `#6B6B6B` | Secondary text, inactive elements |
| `border` | `#E0D8C8` | Component borders |
| `error` | `#C0392B` | Error messages |
| `translation` | `#4A7B9D` | Translation text (steel blue) |

Font: `font-ja` → Noto Sans JP. Must be applied to all Japanese text nodes.

CSS custom properties: Used for `--story-font-size` (CSS variable on the story container). Both the assignment (`style={{ '--story-font-size': ... }}`) and the consumption (`fontSize: 'var(--story-font-size)'`) are required and must be tested together.

---

## Data Architecture

See [data-models.md](./data-models.md) for full type definitions.

Runtime data pipeline:
1. `vocab.json` — loaded once by `vocabService`, O(1) lookup by numeric ID
2. `kanji-data.json` — loaded once by `kanjiService`, O(1) lookup by kanji character
3. `stories/manifest.json` — loaded by `LibraryRoute` loader on every library visit
4. `stories/*.json` — loaded per-reader-navigation, validated by `loadStory()`
5. IndexedDB — local story storage, accessed by UUID

Items 1–4 are precached by the service worker, so after the first visit they load offline.
See [Offline & Service Worker](#offline--service-worker).

---

## Offline & Service Worker

The app is an installable PWA ([ADR 007](adr/007-pwa-offline.md)). After one online visit,
the whole app, the dictionary data and the bundled story library work with no network,
across reloads and restarts.

| Aspect | Design |
|---|---|
| Generation | **vite-plugin-pwa**, Workbox `generateSW`, configured in `vite.config.ts`. The build writes `sw.js`, a `workbox-<hash>.js` runtime and `manifest.webmanifest` |
| Registration | Only `registerServiceWorker()` in `src/lib/pwa.ts`, production builds only. No other module touches `navigator.serviceWorker`, which `serviceWorkerBoundary.test.ts` enforces. Nothing registers under `vite` dev |
| Transparent cache | App code uses plain `fetch()` and behaves the same with no service worker. It never reads Cache Storage and never messages the worker |
| Precache | `**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}`: the app shell, the four Noto Sans JP `.woff2` files, icons, `vocab.json`, `kanji-data.json`, `stories/manifest.json` and every `stories/*.json`. A new file in `public/stories/` is offline automatically |
| Consistency | Each service worker version installs one precache manifest (entries revisioned by content hash), and the active worker serves only its own manifest, so a story and the `vocab.json` it references always come from the same build |
| Navigation fallback | Navigations to non-precached paths (such as `/read/:storyId`) get the precached `/index.html`. `/_vercel/*` (Analytics, Speed Insights) is denylisted. Precached files such as `/vocab.json` are matched first, so opening one directly returns the file, not the shell |
| Updates | `registerType: 'prompt'`. A new worker waits until the reader chooses to reload; the app never reloads by itself. `UpdatePrompt` (mounted once in `App.tsx`, every route) shows a non-modal "New version available" toast above the reader's mobile tab bar when `needRefresh` is set. **Reload** calls the stored `updateServiceWorker` handle → `SKIP_WAITING` → the new worker activates → vite-plugin-pwa reloads the page once on `controlling` (the button disables after the first tap). **×** sets an in-memory `updateDismissed`, so the toast returns on the next launch (the still-waiting worker fires `waiting` again) or when a newer worker arrives. Because an installed app is resumed rather than relaunched, `src/lib/pwa.ts` also calls `registration.update()` every 60 minutes and when the document becomes visible, at most once a minute, skipping when offline or already installing. `skipWaiting` and `clientsClaim` are deliberately unset |
| Install | `initInstallPrompt()` (called from `main.tsx` before render) captures Chromium's `beforeinstallprompt`, suppresses the mini-infobar and keeps the event in `usePwaStore`; `appinstalled` clears it. The library shows a quiet "Install app" text link above "Load a story from your device" that opens the native dialog and then hides, whatever the choice. On iOS/iPadOS (Safari on any version; Chrome, Edge and Firefox on iOS 16.4+) the same spot reads "Add to Home Screen" and reveals "Tap Share, then Add to Home Screen". Nothing shows when running standalone or when the browser offers neither. The reader and `SettingsMenu` carry no install item |

**Budget.** The default precache, which every visitor downloads in the background after
first load, must stay at or under **10 MB**. It is about 3.9 MB today. `e2e-pwa/precache.spec.ts`
(the PWA E2E step in CI, not `pnpm build` itself) fails if the budget is exceeded, and also fails
if any build output the globs match is missing from the precache. That includes files over
Workbox's 2 MiB per-file limit, which the build otherwise only warns about. If the library outgrows
the budget, move `stories/*.json` from the precache to runtime `CacheFirst` caching.

**Large optional assets** (for example a future full dictionary) must be opt-in downloads
stored outside the Workbox precache, for example imported into IndexedDB. Never widen the
precache globs for them.

---

## Testing Strategy

### Unit Tests (Vitest, jsdom)

Location: `src/__tests__/`

| Test file | Covers |
|-----------|--------|
| `buildVocab.test.ts` | Vocab data integrity |
| `vocabService.test.ts` | Singleton init, O(1) lookup |
| `kanjiService.test.ts` | Singleton init, graceful missing |
| `lookupStore.test.ts` | Store transitions |
| `preferenceStore.test.ts` | Persist + reset |
| `storyManifest.test.ts` | fetchManifest, difficulty parsing |
| `indexedDbService.test.ts` | IndexedDB save/get (fake-indexeddb) |
| `WordToken.test.tsx` | Tap, active state, supplement priority |
| `SentenceBlock.test.tsx` | Spacing, translation, sentence selection |
| `InfoPanel.test.tsx` | Lookup states, Escape key |
| `KanjiBreakdown.test.tsx` | Kanji rows, missing char graceful |
| `VocabItem.test.tsx` | Vocab entry display |
| `GrammarPanel.test.tsx` | Highlight + mute on sentence select |
| `StoryCard.test.tsx` | Link, badge, description |
| `DifficultyBadge.test.tsx` | Badge render |
| `SettingsMenu.test.tsx` | Popover, text size, spacing, ruby mode cycling |
| `LibraryRoute.test.tsx` | Filter, upload, error |
| `ReaderRoute.test.tsx` | Story render, tab switching |

### E2E Tests (Playwright)

Location: `apps/web/e2e/`

| Spec | Covers |
|------|--------|
| `smoke.spec.ts` | Page loads, no JS errors |
| `golden-path.spec.ts` | Library → story → word tap → lookup |
| `file-upload.spec.ts` | Local file upload happy path and errors |
| `error-states.spec.ts` | 404, manifest failure, invalid story |
| `accessibility.spec.ts` | WCAG 2.1A/AA via axe-core |

Browsers: Chromium, Firefox, WebKit (all three required).

The default suite runs on `vite` (dev), where no service worker exists. Offline behaviour has
its own suite in `apps/web/e2e-pwa/` (`playwright.pwa.config.ts`, run with `pnpm test:e2e:pwa`).
It runs on Chromium only, against a production build served by `vite preview`:

| Spec | Covers |
|------|--------|
| `precache.spec.ts` | Build output: every story, data file, font and icon is in the precache; no conflicting revisions; ≤ 10 MB budget; navigation fallback and `/_vercel/` denylist |
| `offline.spec.ts` | Offline after one online visit: library reload, a never-opened story, word lookup with kanji breakdown, a hard deep link, an uploaded (IndexedDB) story, and a precached JSON file opened directly. It also asserts that the expected data was served by the service worker and that no same-origin request failed, errored or bypassed the worker |

---

## Deployment

Deployed on Vercel, built from the monorepo root via Turborepo.

`vercel.json`:
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

The `sw.js` header makes browsers revalidate the service worker script on every update
check, so installed apps see new deploys. Vercel already sends `max-age=0, must-revalidate`,
and the explicit header pins that behaviour against future defaults. Static files (including
`sw.js`, the web manifest and the JSON data) are served before the SPA rewrite, so the
rewrite needs no exceptions.

Building from the root (rather than setting `rootDirectory: apps/web`) lets Turbo build the
workspace packages `@nihonnohon/web` depends on before the app itself.

The SPA rewrite ensures all paths (e.g. `/read/story-id`) return `index.html` and React Router handles client-side navigation.

### Analytics

Vercel Web Analytics and Speed Insights are mounted in `App.tsx` behind
`import.meta.env.PROD`, so neither loads in the dev server or under Playwright. Both are
first-party — script and collection endpoints are served from this origin under
`/_vercel/insights` — so no third-party runtime request is introduced.

Page views on client-side navigation are tracked by the injected script patching `history`,
but the plain-React integration has no route support: each view is reported under its literal
pathname, so `/read/:storyId` yields one row per story rather than an aggregate. Passing
`route`/`path` props from inside the router's `Root` layout would parameterise this if the
dashboard noise ever outweighs the extra code.

Both products must also be enabled per-project in the Vercel dashboard; each takes effect on
the next deployment after enabling.

---

## Path Alias

`@/` resolves to `apps/web/src/` — configured in `vite.config.ts`. Use it for all intra-app imports. Never use `../../` relative paths when `@/` applies.
