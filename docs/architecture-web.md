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
| `rubyVisible` | `boolean` | `true` |
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
| `SettingsMenu.test.tsx` | Popover, text size, spacing |
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

---

## Deployment

Deployed on Vercel from `rootDirectory: apps/web`.

`vercel.json`:
```json
{
  "rootDirectory": "apps/web",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The SPA rewrite ensures all paths (e.g. `/read/story-id`) return `index.html` and React Router handles client-side navigation.

---

## Path Alias

`@/` resolves to `apps/web/src/` — configured in `vite.config.ts`. Use it for all intra-app imports. Never use `../../` relative paths when `@/` applies.
