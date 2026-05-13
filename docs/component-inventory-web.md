---
generated: 2026-05-13
scan_level: deep
part: web
---

# Component Inventory — Web App

All React components in `apps/web/src/`. Components are `.tsx` files with named exports matching the filename. See [architecture-web.md](./architecture-web.md) for the full design system.

---

## Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `AppBar` | `components/AppBar.tsx` | Application header. `variant="library"` shows logo only; `variant="reader"` (default) shows "← Library" back link. |
| `ToolBar` | `components/ToolBar.tsx` | Reader reading controls: ruby toggle, translation toggle, settings gear icon. Reads/writes `preferenceStore`. |
| `SettingsMenu` | `components/SettingsMenu.tsx` | Radix UI Popover opened by the settings gear. Contains spacing toggle and three-button text size control (A− / A / A+). |

---

## Reader Components

| Component | File | Description |
|-----------|------|-------------|
| `InfoPanel` | `components/InfoPanel.tsx` | Fixed-height panel at the top of the reader. Shows story metadata at idle; shows word meaning, reading, and `KanjiBreakdown` when a word is selected. Dismisses on Escape key. `aria-live="polite"`. |
| `SentenceBlock` | `components/SentenceBlock.tsx` | Renders one `SentenceModel` as a row of `WordToken` components. Highlights when its sentence is selected. Shows inline translation if `transVisible` is on. |
| `WordToken` | `components/WordToken.tsx` | Single tappable Japanese word with optional ruby annotation above. Calls `lookupVocab()` (or uses supplement entry) on click/Enter/Space. Highlights when it's the active word. |
| `KanjiBreakdown` | `components/KanjiBreakdown.tsx` | Horizontal row of kanji character + Heisig keyword pairs for the selected word. Returns `null` when no recognised kanji found. |
| `GrammarPanel` | `components/GrammarPanel.tsx` | List of story grammar points. Highlights entries referenced by the currently selected sentence; mutes others. |
| `VocabPanel` | `components/VocabPanel.tsx` | Full vocabulary list: `keywords` first, then `vocabSupplement`. Shows empty state if neither is defined. |
| `VocabItem` | `components/VocabItem.tsx` | Single vocabulary entry row: Japanese word + reading + meaning. |

---

## Library Components

| Component | File | Description |
|-----------|------|-------------|
| `StoryCard` | `components/StoryCard.tsx` | Clickable library card linking to `/read/:id`. Shows title, Japanese title, difficulty badge, and two-line description. |
| `DifficultyBadge` | `components/DifficultyBadge.tsx` | Rounded pill badge for a difficulty string (e.g. "Genki I Ch.6"). Styled with `accent-subtle` background and `accent` border. |

---

## Route Components

Located in `src/routes/`:

| Component | Route | Description |
|-----------|-------|-------------|
| `LibraryRoute` | `/` | Story library: filterable grid + local file upload. Loader fetches manifest. |
| `LibraryError` | `/` (error) | Error boundary with retry button shown when the manifest fetch fails. |
| `ReaderRoute` | `/read/:storyId` | Full reader view: story text, lookup panel, vocab/grammar panels. |
| `ReaderError` | `/read/:storyId` (error) | Error boundary showing contextual message (not found, unavailable, or generic). |
| `CreditsRoute` | `/credits` | Static attribution page for Genki and kanjiapi.dev data sources. |

---

## Summary

| Category | Count |
|----------|-------|
| Layout components | 3 |
| Reader components | 7 |
| Library components | 2 |
| Route components + error elements | 5 |
| **Total** | **17** |

---

## Design Conventions

- All components use `cn()` from `@/lib/utils` for class merging — never raw string concatenation.
- Japanese text nodes always receive `lang="ja"` and `font-ja` (Noto Sans JP).
- No inline `var(--*)` CSS variable references — custom properties are set via React `style` prop on containers, consumed via Tailwind utilities.
- UI primitives (Radix Popover) live inside feature components; no separate `ui/` directory used in this project.
