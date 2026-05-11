---
stepsCompleted: ["step-01-extract-requirements", "step-01-user-confirmed", "step-02-epics-approved", "step-03-epic1-stories", "step-03-epic2-stories", "step-03-epic3-stories", "step-03-epic4-stories", "step-04-final-validation"]
status: complete
completedAt: "2026-05-11"
totalEpics: 4
totalStories: 18
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# nihonnohon - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for nihonnohon, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Story Discovery**
FR1: Reader can browse all available stories in a library view
FR2: Reader can filter the story library by learning source (e.g. Genki I, Genki II, JLPT)
FR3: Reader can filter the story library by difficulty level within a selected learning source (e.g. Genki chapter, JLPT level)
FR4: Reader can view story metadata (title, difficulty label, description) for each story before opening it
FR5: Stories with a missing or unrecognised difficulty label are displayed in the library with a blank difficulty field, without error or omission

**Story Loading**
FR6: Reader can open a story from the built-in library to begin reading
FR7: Reader can load a story from a locally stored file on their device
FR8: The app validates uploaded story files against the story format spec on load
FR9: The app displays a user-legible error message when an uploaded file fails validation, including a link to the format spec documentation
FR10: The app continues to function normally when optional story fields are absent

**Reading**
FR11: Reader can view all sentences of a story as a continuous, scrollable document with each sentence on a new line
FR12: Reader can toggle display of sentence-level English translations on or off; when on, the translation appears beneath its corresponding Japanese sentence
FR13: The app renders each word in a sentence as a distinct, individually selectable element
FR14: The app renders vocabulary supplement entries for terms the story author has defined, when those terms are not covered by the app dictionary

**Word Lookup**
FR15: Reader can select a word to open a lookup in the info panel for that word
FR16: The word lookup panel displays the English translation(s) for the selected word
FR17: The word lookup panel displays the hiragana reading for the selected word
FR18: The word lookup panel displays a kanji component breakdown for the selected word
FR19: When a word has no dictionary entry, no lookup is displayed — the tap/click is ignored silently
FR20: When a word appears in the story's vocabulary supplement, the supplement entry is displayed and takes precedence over the app dictionary
FR21: Reader can dismiss the word lookup info panel focus via the Escape key
FR22: Reader can scroll through the word lookup panel content using keyboard navigation

**Reading Aids & Display**
FR23: Reader can toggle ruby character annotations on or off
FR24: When ruby display is on, the app renders ruby annotations above words where annotations are present in the story data
FR25: Reader can toggle inter-word spacing on or off
FR26: Reader can adjust the text size in the reader view

**Story Authoring Format**
FR27: Story authors can define a complete story using the open, documented JSON format spec
FR28: Story authors can segment a sentence into words using a parallel word array in the sentence data; each sentence may also include an optional `translation` field (string) containing the English translation of that sentence
FR29: Story authors can provide ruby character annotations per word using a parallel ruby array (the array is optional per sentence; each element within it is optional per word)
FR30: Story authors can include a story-level vocabulary supplement — an array of `{word, hiragana, translation}` entries for terms not covered by the app dictionary
FR31: Story authors can specify a difficulty label using either a Genki chapter reference (e.g. "Genki I Ch.6") or a JLPT level (e.g. "N4")
FR32: Story authors can specify the language of a story using a language field (e.g. "Japanese"); the app uses this field to set language-specific UI labels (e.g. the ruby character toggle displays ルビ for Japanese stories)
FR33: Story authors can include optional per-sentence audio link fields in the story data (stored but not played in v1)
FR34: The story format spec is published as a standalone document, usable by third-party authors without the app
FR38: Story authors can include a keyword vocabulary list — an array of `{word, hiragana, translation}` entries for words the story is designed to teach (e.g. chapter vocabulary); uses the same schema as the vocabulary supplement
FR39: Story authors can include grammar learning points — an array of strings, each describing a grammar pattern used in the story

**Application & Platform**
FR35: The app is accessible via modern web browser on both mobile and desktop devices
FR36: The app displays dictionary data attribution for the Genki vocabulary source in a Credits or About section
FR37: The app provides basic discoverability metadata (title, description) on the library/landing page
FR40: Reader can view a unified vocabulary panel for the current story, combining keyword vocabulary list and vocabulary supplement entries
FR41: Reader can tap a word in the vocabulary panel to open the word lookup in the info panel
FR42: Reader can view grammar learning points for the current story
FR43: On wide viewports (≥ 1024px), vocabulary and grammar panels display alongside the story text in a two-column layout with Vocabulary/Grammar tabs
FR44: On narrow viewports (< 1024px), story text, vocabulary panel, and grammar panel are accessible via tabs (Story | Vocabulary | Grammar)

### NonFunctional Requirements

**Performance**
NFR1: Word tap → lookup panel updates with no perceptible delay (target: under 100ms from tap to panel display)
NFR2: Ruby character toggle and inter-word spacing toggle apply instantly — no visible re-render delay
NFR3: Text size adjustment applies instantly without page reload or content reflow flash
NFR4: Local story file loading completes in under 1 second for typical story sizes (estimated under 100KB per story)
NFR5: Initial page load is optimised — data files (Genki vocabulary + kanji data) are small; target a time-to-interactive that does not feel slow on a standard broadband connection; initial bundle ≤ 150KB gzipped
NFR6: The app remains fully functional once loaded, regardless of network state

**Accessibility**
NFR7: Text contrast between foreground and background meets WCAG 2.1 AA in all views
NFR8: User-adjustable text size in the reader view supports at least three distinct size settings (small / medium / large)
NFR9: The word lookup panel is dismissible via the Escape key
NFR10: The word lookup panel supports keyboard scrolling when content exceeds the visible area
NFR11: The app does not rely on colour alone to convey information

**Compatibility**
NFR12: The app is fully functional in the last two major versions of Chrome, Firefox, Safari, and Edge on both desktop and mobile
NFR13: Touch interactions (tap to select word, tap to dismiss panel) function correctly on iOS Safari and Android Chrome
NFR14: The app layout is responsive and usable across mobile and desktop viewport sizes without a separate mobile site

**Maintainability**
NFR15: The codebase is written in a way that supports contribution by external developers — clear structure, consistent conventions, and no unexplained magic
NFR16: Important and testable features have automated test coverage (Vitest unit tests + Playwright e2e)
NFR17: The story format spec is versioned — breaking changes to the format are identified as such and documented
NFR18: Genki vocabulary data source attribution is displayed in the shipped app (CreditsRoute)

### Additional Requirements

- **Starter template:** `npx create-turbo@latest` monorepo scaffold with pnpm workspaces is the first implementation step; Vite + React + TypeScript SPA in `apps/web`; shadcn/ui and Tailwind CSS wired into `apps/web`
- **Monorepo package: `@nihonnohon/schema`** — `packages/schema/` package containing `schemas/story.v1.json` (JSON Schema source of truth with `additionalProperties: false` at all nodes) and `packages/schema/src/types.ts` (canonical TypeScript type definitions: `StoryModel`, `VocabEntry`, `KanjiEntry`, `LookupState`, `SentenceModel`, `VocabSupplementEntry`); built via `tsup` producing CJS + ESM with exports map; `SCHEMA_CHANGELOG.md` required
- **Monorepo package: `@nihonnohon/story-loader`** — `packages/story-loader/` package containing versioned loader dispatch (`index.ts`), v1 loader (`v1.ts`: AJV v8 validation of snake_case wire format FIRST, then transform to `StoryModel`), and `LoaderError` class with codes `UNSUPPORTED_VERSION | SCHEMA_INVALID | PARSE_FAILED`; built via `tsup`; AJV v8 CommonJS import chain must be validated in Vite/ESM pipeline
- **Vocabulary build pipeline:** `scripts/build-vocab.ts` preprocesses `scripts/data/genki-vocab.csv` (append-only, stable row IDs) → `apps/web/public/vocab.json` (gitignored, always regenerated); Turborepo `build-vocab` task with `cache: true`; `apps/web` dev and build depend on `build-vocab`
- **Kanji data file:** `apps/web/public/kanji-data.json` — committed static JSON object keyed by literal kanji character; loaded into in-memory Map at startup via `kanjiService.ts`; graceful degradation when kanji not in file
- **Story manifest:** `apps/web/public/stories/manifest.json` — fetched at startup via React Router loader; entries: `{id, filename, title, titleJa, difficulty, language, description}`; permanent slug IDs (e.g. `genki-i-ch6-tanaka-letter`); adding stories requires no code change
- **State management:** Two separate Zustand stores — `useLookupStore` (discriminated union `LookupState`: idle/found/not-found + `selectedSentenceId`) and `usePreferenceStore` (persisted via Zustand `persist` middleware: `rubyVisible`, `spacingVisible`, `transVisible`, `textSize`, `activeTab`); lookup store never imports from preference store and vice versa
- **Routing:** React Router v6 with two routes: `/` (library) and `/read/:storyId`; React Router loaders own all async data fetching (not useEffect or store actions); `vercel.json` SPA rewrite required
- **Local file persistence:** Client-generated UUID + IndexedDB storage via `indexedDbService.ts`; `/read/:uuid` route resolves IndexedDB first, then manifest; UUID-not-found state renders helpful error message with link to library
- **SettingsMenu component:** Radix UI Popover triggered by ⚙ icon in ToolBar; contains spacing toggle + text size controls (A− / A / A+); ToolBar itself contains: ルビ toggle · Trans toggle · ⚙ icon
- **CreditsRoute:** `routes/CreditsRoute.tsx` for Genki vocabulary source attribution (FR36 / NFR18)
- **CI/CD:** GitHub Actions pipeline — lint → typecheck → test:unit → test:e2e → build on every PR; Vercel GitHub integration for deployment; `test:unit` (Vitest) and `test:e2e` (Playwright) are separate pipeline tasks
- **Testing:** Vitest + `@testing-library/react` for unit tests (co-located `__fixtures__/` directories); Playwright for e2e (Chromium + Firefox + WebKit + iPhone 14 device); golden path + error paths + accessibility (axe-core) + visual regression (toggle states)
- **Import boundaries:** `eslint-plugin-boundaries` in shared `packages/eslint-config/` enforces layered imports; `packages/` never imports from `apps/`; `apps/web` imports compiled package outputs only
- **Font loading:** Noto Sans JP (web font, subsetted for Genki kanji range) + Inter for UI text; system CJK fallback; `font-ja` defined as Tailwind `fontFamily` extension
- **Three ADRs:** `docs/adr/001-monorepo-turborepo.md`, `002-json-schema-over-zod.md`, `003-story-generator-out-of-scope.md`
- **`apps/story-generator/` placeholder:** Python project placeholder in repo (out of scope for nihonnohon dev stories); `apps/api/` placeholder for future community backend
- **Ruby rendering rule:** `<ruby>/<rt>` with `visibility: hidden` toggle (never `display: none`) to preserve line height; `white-space: nowrap` on word token spans; `ruby-position: over; ruby-align: center` on ruby containers
- **Wire format convention:** Story JSON uses `snake_case`; TypeScript internal types use `camelCase`; transformation occurs ONLY in `packages/story-loader/src/v1.ts` after AJV validation passes
- **Supplement matching:** `vocabService` checks `StoryModel.vocabSupplement` by exact token string match — no morphological normalisation

### UX Design Requirements

UX-DR1: Persistent top InfoPanel — fixed height (~110–140px), never hidden or removed; resting state shows story title + difficulty label + language metadata; lookup state shows: selected word (Japanese) → English translation (large, 1.125rem) → hiragana reading → KanjiBreakdown row; content swap is immediate (no animation); `aria-live="polite"` + `aria-label="Word lookup panel"`; layout stable — no shift on word tap
UX-DR2: WordToken component — renders single author-segmented word with optional ruby `<ruby>/<rt>` annotation above; states: default (plain text on paper-bg), hover (accent-subtle bg), active (accent-subtle bg + 2px accent bottom border); `role="button"`, `tabindex="0"`, `aria-label` with word text; Enter AND Space trigger lookup; tap silently ignored if word has no dictionary or supplement entry; `white-space: nowrap`; `lang="ja"` on all Japanese text elements
UX-DR3: KanjiBreakdown component — horizontal row of kanji character + meaning label pairs; hidden when looked-up word has no kanji; max 4–5 kanji visible before horizontal scroll within row; each kanji: character large above, meaning label small below
UX-DR4: SentenceBlock component — flex-wrap container of WordTokens + optional translation line (italic, colour #4A7B9D, 0.8em relative to story text size); selected sentence (matching `selectedSentenceId`) receives `bg-accent-subtle` (#F5EDD6) highlight via 100ms colour transition; `role="group"`, `aria-label="Sentence N"`; sentence container tap calls `selectSentence(sentenceId)` which resets lookupState to idle
UX-DR5: AppBar component — reader view: back link (← Library) left + 日本の本 logo right; library view: logo only; back link is `<a>` with `aria-label="Back to library"`; logo uses Noto Sans JP, muted colour, ~15px; `<header>` semantic element
UX-DR6: ToolBar component — left group: ルビ toggle + Trans toggle + ⚙ settings icon (Radix Popover → SettingsMenu); toggle buttons use `accent-subtle` bg + `accent` border when on, `surface` bg + `border` border when off; ルビ label derived from story `language` field (Japanese → ルビ, fallback → "Ruby"); SettingsMenu (Radix Popover) contains: Spaces toggle + A− / A / A+ text size buttons; A button resets to medium (1.25rem)
UX-DR7: StoryCard component — library list item: English title (bold, 1rem) + Japanese title (Noto Sans JP, muted, smaller) + DifficultyBadge + description excerpt (1–2 lines); default state: `border` border; hover state: `accent` border; tapping opens ReaderRoute for that story
UX-DR8: DifficultyBadge component — rounded pill: `accent-subtle` bg + `accent` border + small text; content: "Genki I · Ch.6" or "JLPT N4"; not rendered at all when difficulty is absent (not an empty badge); `aria-label` with full difficulty string
UX-DR9: VocabItem component — vocabulary panel row: word (large, Noto Sans JP, `lang="ja"`) + hiragana reading (smaller, muted, Noto Sans JP) + English translation; default state: plain; hover + active state: `accent-subtle` bg; tap triggers same word lookup as WordToken → InfoPanel updates; active state persists while InfoPanel shows this word's entry
UX-DR10: Two-level difficulty filter — source selector (Genki I / Genki II / JLPT / All) using Radix Select + associated `<label>`; chapter/level selector updates options based on selected source; "All sources" hides/disables chapter selector; library updates immediately on each selection (no Apply button); active filter controls: `accent-subtle` bg + `accent` border; no-results empty state: "No stories found for this selection." + two actions: reset filter and load from device; empty state text in `muted` colour, no illustration
UX-DR11: Responsive layout — single `lg` (1024px) breakpoint; below lg: single column — InfoPanel fixed top + ToolBar below + scrollable story area + Story/Vocabulary/Grammar bottom tab bar; above lg: two-column — InfoPanel spans full width + story left column (max-width ~65ch) + Vocabulary/Grammar right panel (with Vocabulary/Grammar tabs); story scroll position preserved when switching mobile tabs and returning; bottom tab bar: active tab has `accent` bottom border + `paper-text` label; inactive: `muted` text; tab content switches immediately
UX-DR12: Colour system design tokens as Tailwind theme extensions — `paper-bg: #FDF6E3`, `paper-text: #1C1C1C`, `surface: #FFFFFF`, `surface-subtle: #F5F5F0`, `accent: #C8A85A`, `accent-subtle: #F5EDD6`, `muted: #6B6B6B`, `border: #E0D8C8`, `error: #C0392B`; reading area background is `paper-bg`; UI chrome (InfoPanel, library cards) uses `surface`
UX-DR13: Typography system — Inter (system-ui fallback) for all UI/English text; Noto Sans JP (subsetted web font) + system CJK fallback for Japanese story text; `font-ja` Tailwind fontFamily extension; type scale: story text 1.25rem (medium default, user-adjustable via CSS custom property `--story-font-size`), ruby annotations 0.6em relative to word token, InfoPanel translation 1.125rem, InfoPanel hiragana/kanji labels 0.875rem, library UI 1rem, captions/labels 0.75rem; `lang="ja"` on every element rendering Japanese text
UX-DR14: Continuous scrollable document reading model — all sentences displayed simultaneously, each on a new line; no advance/back buttons; no sentence counter; reading area is a scrollable container (`overflow-y: auto`); use `dvh` dynamic viewport units for story area height on iOS Safari (`calc(100dvh - [panel] - [toolbar] - [tabbar])`)
UX-DR15: File upload UX — "Load a story from your device" CTA at bottom of library story list; triggers platform native file picker; on valid file: reader view loads immediately; on invalid file: inline error below upload trigger (not a modal), human-readable message ("This doesn't look like a valid Nihon no Hon story") + specific hint where possible + link to format spec; error text colour: `error` (#C0392B); error dismissible by tapping elsewhere or selecting a library story; optional missing fields never block loading
UX-DR16: Graceful degradation for missing optional story fields — no `ruby` array: words render without annotations, ルビ toggle has no visible effect; no `translation`: nothing shown below that sentence when Trans is on; no `keywords`: vocabulary panel shows supplement entries only, or empty state if both absent; no `grammar`: grammar panel shows empty state ("No grammar notes for this story."); no `difficulty`: DifficultyBadge not rendered; no `language`: ルビ label falls back to "Ruby"
UX-DR17: Grammar panel — list of story-level grammar point strings; when a sentence is selected (`selectedSentenceId`), grammar points indexed in `SentenceModel.grammar` are highlighted (`accent-subtle` bg + `accent` border); non-applicable points rendered in `muted`; if no sentence selected, all points at equal visual weight; empty state: "No grammar notes for this story." in `muted`, centred
UX-DR18: Touch target sizing — all interactive elements meet 44×44px minimum tap target; WordTokens for single kanji characters must be padded beyond the visible character bounds to meet the minimum; tap target on long compound resolves to nearest word boundary

### FR Coverage Map

FR1: Epic 3 — Library browse: all stories visible in library view
FR2: Epic 3 — Filter by learning source (Genki I/II, JLPT)
FR3: Epic 3 — Filter by difficulty level within selected source
FR4: Epic 3 — Story metadata (title, difficulty, description) on library cards
FR5: Epic 3 — Missing difficulty displayed as blank, not error
FR6: Epic 3 — Open story from built-in library
FR7: Epic 3 — Load story from local device file
FR8: Epic 3 — Validate uploaded story against format spec
FR9: Epic 3 — User-legible validation error with spec link
FR10: Epic 3 — App continues normally when optional story fields absent
FR11: Epic 2 — Continuous scrollable document, each sentence on new line
FR12: Epic 2 — Translation toggle (Trans button); translation beneath sentence when on
FR13: Epic 2 — Each word rendered as distinct, individually selectable element
FR14: Epic 2 — Vocabulary supplement entries rendered for author-defined terms
FR15: Epic 2 — Word tap → info panel shows lookup result
FR16: Epic 2 — Info panel displays English translation(s)
FR17: Epic 2 — Info panel displays hiragana reading
FR18: Epic 2 — Info panel displays kanji component breakdown
FR19: Epic 2 — No-entry tap ignored silently; info panel not updated
FR20: Epic 2 — Vocab supplement takes precedence over app dictionary
FR21: Epic 2 — Escape key resets info panel to resting state
FR22: Epic 2 — Info panel keyboard-scrollable when content exceeds visible area
FR23: Epic 2 — Ruby character toggle (ルビ button)
FR24: Epic 2 — Ruby annotations rendered above words when toggle is on
FR25: Epic 4 — Word spacing toggle (in SettingsMenu)
FR26: Epic 4 — Text size adjustment A−/A/A+ (in SettingsMenu)
FR27: Epic 1 — Story JSON format spec: complete story definition
FR28: Epic 1 — Parallel word array + optional translation field per sentence
FR29: Epic 1 — Optional parallel ruby array per sentence; optional per word
FR30: Epic 1 — Story-level vocab supplement: {word, hiragana, translation}[]
FR31: Epic 1 — Difficulty label: Genki chapter or JLPT level
FR32: Epic 1 — Language field drives language-specific UI labels (e.g. ルビ)
FR33: Epic 1 — Optional per-sentence audio link fields (stored, not played in v1)
FR34: Epic 1 — Story format spec published as standalone open document
FR35: Epic 3 — App functional in last 2 major versions of all target browsers
FR36: Epic 4 — CreditsRoute: Genki vocabulary source attribution
FR37: Epic 3 — Basic SEO meta (title, description) on library/landing page
FR38: Epic 1 — Keyword vocab list: {word, hiragana, translation}[] in schema
FR39: Epic 1 — Grammar learning points: string[] in schema
FR40: Epic 4 — Unified vocabulary panel (keywords + supplement combined)
FR41: Epic 4 — Tap word in vocab panel → info panel lookup
FR42: Epic 4 — Grammar learning points panel
FR43: Epic 4 — Wide viewport (≥1024px): two-column layout, Vocabulary/Grammar tabs in right panel
FR44: Epic 4 — Narrow viewport (<1024px): Story/Vocabulary/Grammar tab navigation

## Epic List

### Epic 1: Project Foundation & Story Format Contract
The development environment is production-ready and the story.v1.json schema is the verified, open contract — a standalone artifact community authors and the AI authoring tool can use immediately. All shared packages build and publish correctly. CI is green.

**Implementation note:** Split into 5 stories with explicit dependency order: (1.1) monorepo init, (1.2) @nihonnohon/schema, (1.3) @nihonnohon/story-loader, (1.4) apps/web scaffold, (1.5) monorepo pipeline + CI. Story 1.1 is the prerequisite for all others; 1.2→1.3 are sequential; 1.4 and 1.5 can proceed after 1.2. Include Playwright infrastructure setup (install, config, one smoke test) in story 1.4 so CI runs Playwright from day one.

**Also covers:** Turborepo + pnpm monorepo scaffold; vocab build pipeline (Genki CSV → vocab.json, Turborepo-cached); apps/web scaffold (Vite + React + TypeScript + Tailwind + shadcn/ui + React Router v6 + vercel.json); Zustand store skeletons (with spacing, textSize, activeTab slots reserved in preferenceStore so Epic 4 is additive); design tokens in tailwind.config.ts; GitHub Actions CI pipeline; ADRs; CONTRIBUTING.md; apps/story-generator/ + apps/api/ placeholders (with README defining their contract).

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR38, FR39

---

### Epic 2: Minimum Viable Reader (Milestone 1)
RT can sit down with one Japanese story and do reading practice. Tap any word → the persistent info panel instantly shows its translation, hiragana reading, and kanji breakdown. Ruby annotations and sentence translations can be toggled. Sentence selection highlights the active sentence. This is the app's core value proposition, fully working.

**Implementation note:** ReaderRoute uses a React Router loader from day one — `loader: () => fixture` — not a bare import or useState initialiser. This keeps Epic 3's work additive (replacing the loader body) rather than structural. The fixture story (genki-i-ch6-tanaka-letter.json) must be a real, readable Japanese story at a specific difficulty level — not a synthetic test stub. Story text defaults to 1.25rem (20px, per design system) which is readable without the text-size toggle. ToolBar ships with ruby + trans toggles only; AC explicitly asserts no settings control is present (regression guard for Epic 4). All services (vocabService, kanjiService) must have genuine behaviour coverage in unit tests — not tautological vi.mock stubs.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24

---

### Epic 3: Story Library & File Access
Users can discover stories in the built-in library, filter by their exact learning level (Genki chapter / JLPT level), open any story, and load community stories from their own device with full validation and user-friendly error messages. The app is a complete end-to-end experience with proper routing.

**Implementation note:** Epic 3 replaces the fixture loader body in ReaderRoute with the full manifest-lookup → IndexedDB-fallback → not-found logic; the ReaderRoute component itself does not change structurally. Every story touching ReaderRoute must explicitly state which existing test cases are preserved, superseded, or added. indexedDbService unit tests must cover the service contract (CRUD, UUID generation, not-found path) against real in-memory IndexedDB — not shallow mocks.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR35, FR37

---

### Epic 4: Vocabulary, Grammar, Layout Polish & v1 Complete
Users have full reading support — a vocabulary panel, a grammar notes panel with sentence-level highlighting, word spacing and text size controls, a fully responsive layout (side-by-side on desktop, tabs on mobile), and a Credits page. The full Playwright e2e suite (golden path + error paths + axe-core accessibility + visual regression) closes out v1.

**Implementation note:** SettingsMenu (Radix Popover) adds spacing toggle + text size controls to the ToolBar; preferenceStore already has these slots from Epic 1, so this is purely UI wiring. ReaderRoute is extended for the final time: panels, tab navigation, two-column layout. Playwright e2e suite covers: golden path, file upload (valid/invalid/unsupported/malformed), error states (manifest failure, story not found, UUID expired), accessibility (axe-core), visual regression (toggle states), iPhone 14 viewport.

**FRs covered:** FR25, FR26, FR36, FR40, FR41, FR42, FR43, FR44

---

## Epic 1: Project Foundation & Story Format Contract

The development environment is production-ready and the story.v1.json schema is the verified, open contract — a standalone artifact community authors and the AI authoring tool can use immediately. All shared packages build correctly. CI is green.

### Story 1.1: Monorepo Initialization

As a **developer**,
I want the Turborepo + pnpm monorepo scaffolded with all package directories in place,
So that every subsequent story has a valid, installable repository to build on.

**Acceptance Criteria:**

**Given** `npx create-turbo@latest nihonnohon` is run with pnpm selected as the package manager
**When** scaffold completes
**Then** repo root contains `turbo.json`, `package.json` (private: true), `pnpm-workspace.yaml`, and `.gitignore`; default scaffold apps are removed or replaced with project-specific stubs

**Given** `pnpm-workspace.yaml`
**When** reviewed
**Then** lists: `apps/web`, `apps/api`, `packages/*`; `apps/story-generator` is explicitly excluded (Python runtime, not a Node.js package)

**Given** the package directories are created
**When** reviewed
**Then** the following exist as valid, installable TS package stubs (each with `package.json`, `tsconfig.json`, and an empty `src/index.ts`): `packages/schema/`, `packages/story-loader/`, `packages/typescript-config/`, `packages/eslint-config/`; `apps/web/` exists as a stub; `apps/api/` exists with a minimal `package.json` placeholder

**Given** `pnpm install` is run from repo root
**When** complete
**Then** exits 0; all workspace packages are symlinked correctly; no peer dependency errors

**Given** the repo is in its initial state
**When** `git status` is checked
**Then** all files are committed to an initial commit; `.gitignore` excludes `node_modules/`, `dist/`, `apps/web/public/vocab.json`

---

### Story 1.2: Schema Package & Story Format Contract

As a **story author**,
I want a versioned JSON schema (`story.v1.json`) with matching TypeScript types,
So that I can author story files with tooling validation and the app has a published, machine-readable contract it shares with the AI authoring tool.

**Acceptance Criteria:**

**Given** the monorepo is set up with pnpm workspaces
**When** `packages/schema` is built via `tsup`
**Then** CJS + ESM outputs are produced in `dist/` with the canonical exports map (`import` and `require` entries with `.d.mts`/`.d.ts` types); `@nihonnohon/schema` is importable in `apps/web` with full TypeScript type resolution

**Given** `packages/schema/schemas/story.v1.json` exists
**When** a valid story fixture is checked against it
**Then** validation passes; `"additionalProperties": false` is enforced at every object node; unrecognised fields at root or in nested objects cause validation failure

**Given** `story.v1.json`
**When** reviewed
**Then** root-level required fields are: `schema_version` (string, enum: ["1"]), `id` (string, minLength: 1), `title` (string), `title_ja` (string), `language` (string), `description` (string), `sentences` (array, minItems: 1); optional root fields include: `difficulty` (string|null), `keywords` (array of `{word, hiragana, translation}`), `grammar` (string[]), `vocab_supplement` (array of `{word, hiragana, translation}`), `metadata` (object)
**And** each sentence object requires: `id` (string, minLength: 1), `words` (string[], each minLength: 1); optionally: `ruby` (array of string|null), `vocab_keys` (array of integer|null), `translation` (string), `audio_url` (string)

**Given** `packages/schema/src/types.ts`
**When** reviewed
**Then** it defines exactly: `StoryModel`, `SentenceModel`, `VocabSupplementEntry`, `VocabEntry`, `KanjiEntry`, and the `LookupState` discriminated union (`{ status: 'idle' } | { status: 'found'; word: string; entry: VocabEntry } | { status: 'not-found'; word: string }`) — matching the architecture's canonical definitions; no local redefinition of these types exists anywhere else in the codebase

**Given** `SCHEMA_CHANGELOG.md` in `packages/schema/`
**When** reviewed
**Then** it documents schema version `"1"` with its initial field list; version `"1"` is the only entry

**Given** CI runs on a PR
**When** the pipeline executes
**Then** all story fixture files in `packages/story-loader/src/__fixtures__/` are validated against `story.v1.json`; any fixture that is supposed to be valid passes; any fixture that is supposed to be invalid fails at validation

---

### Story 1.3: Story Loader Package

As a **developer**,
I want a versioned story loader that validates story JSON against the schema and transforms it to a type-safe `StoryModel`,
So that every story consumer receives validated, version-agnostic data with clear, typed errors on failure.

**Acceptance Criteria:**

**Given** `packages/story-loader/src/index.ts` exports `loadStory(rawJson: unknown): StoryModel` and the `LoaderError` class
**When** called with valid schema version `"1"` JSON
**Then** returns a correctly transformed `StoryModel` with all snake_case wire fields converted to camelCase (`schema_version` → `schemaVersion`, `title_ja` → `titleJa`, `vocab_keys` → `vocabKeys`); this transformation occurs ONLY in `v1.ts`, nowhere else in the codebase

**Given** AJV v8 validates in `v1.ts`
**When** validation runs
**Then** AJV validates the snake_case wire format BEFORE any transformation begins; a partially-transformed object is never passed to AJV

**Given** a sentence with mismatched parallel array lengths (e.g. `words` has 3 items, `ruby` has 2)
**When** `loadStory()` is called
**Then** throws `LoaderError('SCHEMA_INVALID', message)` where the message identifies the offending sentence `id`

**Given** a story with an unrecognised `schema_version` value (e.g. `"99"`)
**When** `loadStory()` is called
**Then** throws `LoaderError('UNSUPPORTED_VERSION', message)` naming the unsupported version

**Given** input that is not parseable JSON
**When** `loadStory()` is called
**Then** throws `LoaderError('PARSE_FAILED', message)`

**Given** all test fixtures in `packages/story-loader/src/__fixtures__/`
**When** `turbo test:unit` runs
**Then** all pass: `valid-v1.json` → StoryModel returned; `valid-v1-minimal.json` (1 sentence, no optional fields) → StoryModel returned; `invalid-schema.json` → SCHEMA_INVALID; `invalid-empty-sentences.json` → SCHEMA_INVALID; `invalid-malformed.json` → PARSE_FAILED; `invalid-sentence-missing-id.json` → SCHEMA_INVALID; `unsupported-schema-version.json` → UNSUPPORTED_VERSION

**Given** `tsup` builds the package
**When** build completes
**Then** `@nihonnohon/schema` is in `dependencies` (not `devDependencies`) of `packages/story-loader` so tsup treats it as external; CJS + ESM outputs produced with canonical exports map; package is consumable from `apps/web` as `@nihonnohon/story-loader`

---

### Story 1.4: Web App Scaffold

As a **developer**,
I want the `apps/web` SPA scaffold running with React Router, Tailwind design tokens, and Zustand store skeletons,
So that all subsequent stories build on a consistent, type-safe foundation without re-doing infrastructure.

**Acceptance Criteria:**

**Given** `turbo dev` is run from repo root
**When** the dev server starts
**Then** the app loads at localhost without console errors; routes `/` and `/read/:storyId` both render placeholder content without crashing

**Given** `turbo build` is run
**When** build completes
**Then** `apps/web/dist/` contains a deployable static bundle; exit code 0; AJV v8 CommonJS import chain is confirmed working in the Vite/ESM build (no build error from AJV, verifying Story 1.3's assumption)

**Given** `apps/web/tailwind.config.ts`
**When** reviewed
**Then** theme extends with all nine design tokens: `paper-bg: #FDF6E3`, `paper-text: #1C1C1C`, `surface: #FFFFFF`, `surface-subtle: #F5F5F0`, `accent: #C8A85A`, `accent-subtle: #F5EDD6`, `muted: #6B6B6B`, `border: #E0D8C8`, `error: #C0392B`; `fontFamily.ja` set to `['Noto Sans JP', 'system-ui', 'sans-serif']`; Noto Sans JP is loaded as a web font in `index.html`

**Given** `apps/web/src/stores/lookupStore.ts`
**When** reviewed
**Then** skeleton defines the `LookupState` discriminated union, `selectedSentenceId: string | null`, and stub functions `lookup`, `selectSentence`, `reset`, `_reset`; compiles with no TypeScript errors

**Given** `apps/web/src/stores/preferenceStore.ts`
**When** reviewed
**Then** skeleton defines all six persisted fields: `rubyVisible: boolean`, `spacingVisible: boolean`, `transVisible: boolean`, `textSize: 'small' | 'medium' | 'large'`, `activeTab: 'story' | 'vocabulary' | 'grammar'`; Zustand `persist` middleware is wired; compiles with no TypeScript errors
**And** all six fields are present in the skeleton so Epic 4 stories are purely additive UI wiring

**Given** `vercel.json` at repo root
**When** reviewed
**Then** contains: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

**Given** `tsconfig.app.json` and `vite.config.ts`
**When** reviewed
**Then** both define `@/*` → `./src/*` path alias; `import { useLookupStore } from '@/stores/lookupStore'` resolves correctly; TypeScript strict mode is enabled; `turbo typecheck` exits 0 across all packages

---

### Story 1.5: Monorepo Pipeline, CI & Project Scaffolding

As a **developer or external contributor**,
I want the full Turborepo pipeline, GitHub Actions CI, and project documentation in place,
So that every PR is automatically verified and the project is ready for open-source contribution from day one.

**Acceptance Criteria:**

**Given** `turbo.json` at repo root
**When** reviewed
**Then** defines all required tasks: `build-vocab` (inputs: build-vocab.ts + genki-vocab.csv, outputs: apps/web/public/vocab.json, cache: true); `build` (dependsOn: ^build, build-vocab); `dev` (dependsOn: ^build, build-vocab, persistent: true, cache: false); `typecheck` (dependsOn: ^build); `test:unit` (dependsOn: ^build, build-vocab); `test:e2e` (dependsOn: build, cache: false); `lint` (no dependsOn)

**Given** `scripts/build-vocab.ts` runs with `scripts/data/genki-vocab.csv` present
**When** `turbo build-vocab` executes
**Then** generates `apps/web/public/vocab.json` as a sorted, deterministic JSON array of `VocabEntry` objects; every entry has `id: number`, `word: string`, `reading: string`, `meaning: string`, `lesson: string`; `vocab.json` is listed in `.gitignore`; a unit test validates a sample output matches the `VocabEntry` shape

**Given** `.github/workflows/ci.yml`
**When** a PR is submitted
**Then** pipeline runs in order: `pnpm install` → `turbo lint` → `turbo typecheck` → `turbo test:unit` → `turbo test:e2e` → `turbo build`; all steps must pass; `test:unit` and `test:e2e` are separate pipeline tasks (no Vite/Playwright port collision)

**Given** Playwright is configured in `apps/web/playwright.config.ts`
**When** `turbo test:e2e` runs
**Then** config includes `baseURL`, `webServer` config, `testDir: 'e2e/'`, and `devices` including `'iPhone 14'`; `e2e/smoke.spec.ts` passes — it asserts the app loads at `/` with HTTP 200 and the page `<title>` is non-empty; CI runs this smoke test on every PR

**Given** `apps/story-generator/README.md`
**When** reviewed
**Then** documents: purpose (AI story authoring tool, separate project, out of nihonnohon scope), contract (consumes `story.v1.json` + `genki-vocab.csv`, produces valid schema version `"1"` JSON), and validation instructions; `apps/story-generator/src/story_generator/validator.py` exists as a documented stub

**Given** `docs/adr/` directory
**When** reviewed
**Then** contains three ADRs with consistent structure (title, status: Accepted, context, decision, consequences): `001-monorepo-turborepo.md`, `002-json-schema-over-zod.md`, `003-story-generator-out-of-scope.md`

**Given** `CONTRIBUTING.md` at repo root
**When** reviewed
**Then** covers: first-time setup (`pnpm install`), dev workflow (`turbo dev`), test commands, package conventions ("Where does code go?" table from architecture), and the schema version bump contract

**Given** `pnpm install && turbo build` from repo root
**When** complete
**Then** exits 0; `turbo test:unit` exits 0; CI smoke test passes on a clean checkout

---

## Epic 2: Minimum Viable Reader (Milestone 1)

RT can sit down with one Japanese story and do reading practice. Tap any word → the persistent info panel instantly shows its translation, hiragana reading, and kanji breakdown. Ruby annotations and sentence translations can be toggled. Sentence selection highlights the active sentence.

### Story 2.1: Vocabulary & Kanji Data Services

As a **reader**,
I want word lookups to return instantly from locally loaded data,
So that tapping any word in a story feels immediate with no network dependency during reading.

**Acceptance Criteria:**

**Given** `apps/web/public/kanji-data.json` is committed to the repo
**When** reviewed
**Then** it is a JSON object keyed by literal kanji character (e.g. `{"食": {"meaning": "eat", "onYomi": ["ショク"], "kunYomi": ["た.べる"]}, ...}`); every entry matches the `KanjiEntry` type from `@nihonnohon/schema`

**Given** `apps/web/src/services/vocabService.ts`
**When** the app starts
**Then** `fetch('/vocab.json')` is called once; the result is loaded into an in-memory `Map<number, VocabEntry>` keyed by integer `id`; subsequent calls to `lookupVocab(id: number): VocabEntry | null` are synchronous O(1) lookups; `null` is returned when `id` has no entry

**Given** `vocabService.test.ts`
**When** run
**Then** covers: lookup returns correct `VocabEntry` for a known id; lookup returns `null` for an unknown id; the in-memory map is populated from a fixture JSON and not re-fetched on subsequent calls; tests do not use `vi.mock` to stub the return value of `lookupVocab` itself

**Given** `apps/web/src/services/kanjiService.ts`
**When** the app starts
**Then** `fetch('/kanji-data.json')` is called once; loaded into an in-memory `Map<string, KanjiEntry>` keyed by literal kanji character; `lookupKanji(char: string): KanjiEntry | null` is synchronous; `null` returned for characters not in the file

**Given** `kanjiService.test.ts`
**When** run
**Then** covers: lookup returns correct `KanjiEntry` for a known character; returns `null` for an unknown character; tests use a fixture map, not a mock of the service function itself

**Given** a word containing multiple kanji characters (e.g. `食べる`)
**When** `lookupKanji` is called for each character individually
**Then** returns `KanjiEntry` for `食`; returns `null` for hiragana characters `べ` and `る` (graceful degradation — no kanji entry for non-kanji tokens)

---

### Story 2.2: Lookup & Preference Stores

As a **reader**,
I want word selections and reading preferences to be reliably tracked and persisted,
So that my chosen reading settings survive page reloads without any manual configuration.

**Acceptance Criteria:**

**Given** `useLookupStore` is fully implemented
**When** `lookup(word, entry, sentenceId)` is called with a valid `VocabEntry`
**Then** `lookupState` transitions to `{ status: 'found', word, entry }`; `selectedSentenceId` is set to `sentenceId`

**Given** `lookup()` is called with `entry: null`
**When** executed
**Then** `lookupState` transitions to `{ status: 'not-found', word }`; `selectedSentenceId` is set to `sentenceId`

**Given** `selectSentence(sentenceId)` is called
**When** executed
**Then** `selectedSentenceId` is updated to the new value; `lookupState` resets to `{ status: 'idle' }`

**Given** `_reset()` is called
**When** executed (test-only)
**Then** all store state returns to initial values without touching `localStorage`; `afterEach(() => useLookupStore.getState()._reset())` is present in every test file using this store

**Given** `lookupStore.test.ts`
**When** run
**Then** covers all state transitions: idle → found; idle → not-found; found → found (new word tap); found → idle (selectSentence); not-found → idle (selectSentence)

**Given** `usePreferenceStore` is fully implemented with Zustand `persist`
**When** the app loads after a previous session where preferences were changed
**Then** `rubyVisible`, `spacingVisible`, `transVisible`, `textSize`, `activeTab` are all restored from `localStorage`; defaults are: `rubyVisible: true`, `spacingVisible: false`, `transVisible: false`, `textSize: 'medium'`, `activeTab: 'story'`

**Given** `preferenceStore.test.ts`
**When** run
**Then** `beforeEach(() => localStorage.clear())` is present in every test using this store; tests cover: a changed preference persists across simulated reload; individual setters update only their own field; `textSize` correctly cycles through `'small' | 'medium' | 'large'`

---

### Story 2.3: WordToken & SentenceBlock Components

As a **reader**,
I want each Japanese word displayed as a tappable element with an optional ruby annotation above it,
So that I can select any word to look it up and optionally reveal its reading without disrupting the text layout.

**Acceptance Criteria:**

**Given** a `WordToken` with a ruby annotation and `rubyVisible: true`
**When** rendered
**Then** uses `<ruby lang="ja">` with `<rt>` containing the annotation; when `rubyVisible` is false, `<rt>` has class `invisible` (CSS `visibility: hidden`); `display: none` is never used on `<rt>`; line height is preserved regardless of toggle state; `white-space: nowrap` applied to the word span

**Given** a `WordToken`
**When** rendered
**Then** has `role="button"`, `tabIndex={0}`, `aria-label` containing the word text; `lang="ja"` on all Japanese text elements; `onClick` calls `lookup(word, entry, sentenceId)`; `onKeyDown` fires lookup on both `Enter` AND `Space`

**Given** a `WordToken` where the word has no vocabulary entry (`vocabKey` is `null` or `lookupVocab` returns `null`)
**When** tapped or activated via keyboard
**Then** the tap is ignored silently — `lookup` is NOT called; the info panel is not updated; no visual error is shown

**Given** a `WordToken` that is currently the active lookup word
**When** rendered
**Then** shows `accent-subtle` background + 2px `accent` bottom border; a non-active token shows no tint or border on default; hover state shows `accent-subtle` background only

**Given** a `SentenceBlock` with `spacingVisible: false`
**When** rendered
**Then** word tokens have `gap-x-0`; with `spacingVisible: true`, `gap-x-2` with `transition-[gap] duration-150`; transition is CSS-only with no JS re-render

**Given** a `SentenceBlock` whose `sentence.id` matches `selectedSentenceId` in `useLookupStore`
**When** rendered
**Then** the container has `bg-accent-subtle` with `transition-colors duration-100`; non-selected sentences have no background tint; container has `role="group"` and `aria-label="Sentence N"`; clicking the container (not a word token) calls `selectSentence(sentence.id)`

**Given** a `SentenceBlock` with `transVisible: true` and a `translation` field on the sentence
**When** rendered
**Then** translation text appears below the word row in italic, colour `#4A7B9D`, `font-size: 0.8em` relative to story text size; if `translation` is absent, nothing is rendered below the word row

**Given** `WordToken.test.tsx` and `SentenceBlock.test.tsx`
**When** run
**Then** cover: ruby toggle (invisible not display:none); Enter and Space keyboard triggers; silent ignore for null vocabKey; active word styling; sentence selection highlight; spacing gap toggle; translation conditional rendering; `afterEach(_reset)` present

---

### Story 2.4: InfoPanel & KanjiBreakdown Components

As a **reader**,
I want a persistent panel at the top of the reader that shows story context at rest and word lookup results instantly on tap,
So that looking up a word never moves or obscures the text I'm reading.

**Acceptance Criteria:**

**Given** no word has been tapped (`lookupState.status === 'idle'`)
**When** `InfoPanel` renders
**Then** displays story title, difficulty label (blank if absent), and language; panel is never blank or hidden; fixed height ~110–140px; `overflow-y: auto`

**Given** `lookupState.status === 'found'`
**When** `InfoPanel` renders
**Then** shows: selected word in Japanese (Noto Sans JP, `lang="ja"`), English translation at 1.125rem, hiragana reading at 0.875rem, and `KanjiBreakdown` row; content swap is immediate — no animation or transition delay

**Given** `lookupState.status === 'not-found'`
**When** `InfoPanel` renders
**Then** shows `"No entry for [word]"` in `muted` colour; no error styling, no icon; panel height unchanged; this is informational, not an error state

**Given** `InfoPanel`
**When** rendered
**Then** has `aria-live="polite"` and `aria-label="Word lookup panel"`

**Given** the Escape key is pressed
**When** the key event fires on the document or panel
**Then** `useLookupStore.reset()` is called; `lookupState` returns to `{ status: 'idle' }`; panel displays story context again

**Given** a looked-up word containing kanji characters (e.g. `食べ`)
**When** `KanjiBreakdown` renders
**Then** displays a horizontal row; each kanji with a `KanjiEntry` shows the character large above its English meaning label below; hiragana/katakana characters are skipped silently; at most 4–5 kanji items visible before horizontal scroll

**Given** a looked-up word with no kanji (e.g. `たべる`)
**When** `KanjiBreakdown` renders
**Then** the component renders nothing; no empty row or placeholder is shown

**Given** `InfoPanel.test.tsx` and `KanjiBreakdown.test.tsx`
**When** run
**Then** cover: all three InfoPanel states; idle state shows story metadata; Escape resets to idle; found state with kanji word shows KanjiBreakdown; found state with hiragana-only word hides KanjiBreakdown; not-found state shows muted message; `afterEach(_reset)` present

---

### Story 2.5: Minimum Viable Reader Route

As a **reader (RT)**,
I want to open the app and immediately see a real Japanese story I can read with word lookup and reading toggles working,
So that I can use the app for genuine reading practice the moment Epic 2 is complete (Milestone 1).

**Acceptance Criteria:**

**Given** the app is opened at `/read/genki-i-ch6-tanaka-letter`
**When** the React Router loader executes
**Then** calls `fetch('/stories/genki-i-ch6-tanaka-letter.json')`, passes the response through `loadStory()`, and returns a `StoryModel`; the loader is a proper React Router `loader` function — NOT a bare static import or `useState` initialiser; Epic 3 will replace only the loader body, not the loader pattern

**Given** `apps/web/public/stories/genki-i-ch6-tanaka-letter.json`
**When** reviewed
**Then** is a real Japanese story at Genki I Ch.6 difficulty; all sentences contain valid `words`, `ruby`, and `vocab_keys` parallel arrays with equal lengths; the file passes `loadStory()` validation without error; it is NOT a synthetic test stub

**Given** the story loads successfully
**When** `ReaderRoute` renders
**Then** all sentences are displayed as a continuous scrollable document, each sentence on a new line; no advance/back buttons; no sentence counter; story area uses `paper-bg` background; story text at `1.25rem` (medium default from `TEXT_SIZE_VALUES`)

**Given** `AppBar` in the reader view
**When** rendered
**Then** shows `← Library` back link (left) and `日本の本` logo (right); back link has `aria-label="Back to library"` and is a proper `<a>` element; logo uses Noto Sans JP, `muted` colour; `<header>` semantic element used

**Given** `ToolBar`
**When** rendered
**Then** shows exactly two toggle buttons: ルビ and Trans; NO settings icon or SettingsMenu is present; a test asserts the count of interactive controls in ToolBar is exactly 2 (regression guard for Epic 4)
**And** ルビ label is derived from the story `language` field: `"Japanese"` → `"ルビ"`; any other value → `"Ruby"`

**Given** the ルビ toggle is switched off then on
**When** toggled
**Then** `<rt>` elements use `visibility: hidden` when off (never `display: none`); ruby annotations appear immediately when toggled on; no layout shift or reflow

**Given** the Trans toggle is on and a sentence has a `translation` field
**When** rendered
**Then** translation appears below that sentence in italic, `#4A7B9D`; sentences without `translation` show nothing below their word row

**Given** a word in the story's `vocabSupplement` array is tapped
**When** the lookup runs
**Then** the supplement entry is shown in InfoPanel and takes precedence over `vocabService` lookup; if the same word exists in both, supplement wins

**Given** `ReaderRoute.test.tsx`
**When** run
**Then** covers: loader returns StoryModel from fixture; all sentences rendered in document order; word tap updates InfoPanel; ruby toggle (invisible not display:none); translation toggle; ToolBar has exactly 2 controls; Escape resets InfoPanel to idle; vocab supplement takes precedence; existing ACs from this test file are explicitly preserved through future Epic 3 and 4 modifications

---

## Epic 3: Story Library & File Access

Users can discover stories in the built-in library, filter by their exact learning level, open any story, and load community stories from their own device with full validation and user-friendly error messages.

### Story 3.1: Story Manifest, StoryCard & DifficultyBadge

As a **reader**,
I want to see all available stories in a library with their title, difficulty label, and description,
So that I can quickly identify stories matched to my current learning level before opening one.

**Acceptance Criteria:**

**Given** `apps/web/public/stories/manifest.json`
**When** reviewed
**Then** is a JSON array; each entry has: `id` (permanent slug), `filename`, `title`, `titleJa`, `difficulty` (string or absent), `language`, `description`; the genki-i-ch6 story from Epic 2 has an entry; adding a new story requires only appending an entry — no code change

**Given** a `StoryCard` with a story that has a `difficulty` value
**When** rendered
**Then** shows English title (bold), Japanese title (Noto Sans JP, `muted`, smaller), `DifficultyBadge`, and description excerpt (1–2 lines max); hover state applies `accent` border; the card navigates to `/read/:id` on tap

**Given** a `DifficultyBadge` with a difficulty string
**When** rendered
**Then** is a rounded pill with `accent-subtle` background, `accent` border, small text; content matches the difficulty string (e.g. `"Genki I Ch.6"` or `"JLPT N4"`); has `aria-label` with the full difficulty string

**Given** a `StoryCard` where `difficulty` is absent or `null`
**When** rendered
**Then** `DifficultyBadge` is NOT rendered — no empty pill, no placeholder text

**Given** `StoryCard.test.tsx` and `DifficultyBadge.test.tsx`
**When** run
**Then** cover: all metadata fields rendered; hover styling; navigation to `/read/:id`; badge present when difficulty exists; badge absent when difficulty missing; `aria-label` on badge

---

### Story 3.2: Library Route & Difficulty Filter

As a **reader**,
I want to filter the story library by learning source and chapter or JLPT level,
So that I can find stories calibrated to exactly where I am in my studies without scrolling through irrelevant content.

**Acceptance Criteria:**

**Given** the app is opened at `/`
**When** `LibraryRoute` loads via its React Router `loader`
**Then** `manifest.json` is fetched once; all stories are displayed as `StoryCard` components; if the manifest fetch fails, an `ErrorBoundary` renders a user-friendly message with a retry option

**Given** the library page
**When** rendered
**Then** `<main>` semantic element wraps the story list; `<title>` and `<meta name="description">` are set for basic SEO; the nihonnohon logo is prominent in the library header

**Given** a source is selected in the source filter (Radix `Select` with associated `<label>`)
**When** the selection changes
**Then** the library immediately narrows to stories matching that source; the chapter/level dropdown updates its options to valid chapters for the selected source; no "Apply" button required

**Given** both source and chapter filters are set
**When** applied
**Then** only stories matching both criteria are shown; library updates immediately

**Given** `"All"` is selected as the source
**When** rendered
**Then** chapter/level dropdown is hidden or disabled; all stories are shown

**Given** the active filter combination matches no stories
**When** rendered
**Then** shows `"No stories found for this selection."` in `muted` colour; two action options: reset filter and `"Load a story from your device"`

**Given** `LibraryRoute.test.tsx`
**When** run
**Then** covers: manifest loaded and stories rendered; source filter narrows results; chapter filter further narrows; all-sources shows all; empty state with reset action; manifest fetch failure triggers error boundary; `utils/storyManifest.ts` type guard unit-tested separately

---

### Story 3.3: Full Story Loading & Routing

As a **reader**,
I want story URLs to be permanent and shareable, and the reader to load any library story by its ID,
So that I can bookmark or share a link to a specific story and it will always work.

**Acceptance Criteria:**

**Given** the user navigates to `/read/genki-i-ch6-tanaka-letter`
**When** the `ReaderRoute` loader executes
**Then** looks up the ID in the manifest; fetches the story file; passes through `loadStory()`; returns the `StoryModel`; the `ReaderRoute` component is structurally unchanged from Epic 2 — only the loader body is replaced
**And** `ReaderRoute.test.tsx` explicitly states: all Epic 2 ACs preserved; the fixture-fetch AC superseded; new ACs added: manifest lookup, not-found state, error boundary

**Given** a story ID not found in the manifest
**When** the loader runs
**Then** `ErrorBoundary` renders `"Story not found."` with a link back to the library

**Given** the `vercel.json` SPA rewrite
**When** a user hard-refreshes at `/read/genki-i-ch6-tanaka-letter`
**Then** the app loads correctly — no 404 from Vercel

**Given** `router.tsx`
**When** reviewed
**Then** defines two routes: `/` with `LibraryRoute` (manifest loader + error boundary) and `/read/:storyId` with `ReaderRoute` (story loader + error boundary); `RouterProvider` wraps the app

**Given** `utils/storyManifest.ts`
**When** reviewed
**Then** exports `fetchManifest()` and type guard `isManifestEntry(obj): obj is ManifestEntry`; unit tests cover the type guard with valid and invalid inputs

---

### Story 3.4: Local File Upload & Validation

As a **reader**,
I want to load a story JSON file from my device and read it exactly like a built-in library story,
So that I can use community-authored stories without them needing to be in the built-in library.

**Acceptance Criteria:**

**Given** a `"Load a story from your device"` trigger at the bottom of the library list
**When** tapped
**Then** opens the platform native file picker (`<input type="file" accept=".json">`); no custom file-picker UI

**Given** a valid story JSON file is selected
**When** read and passed to `loadStory()`
**Then** a UUID is generated client-side; raw JSON stored in IndexedDB via `indexedDbService.saveStory(uuid, rawJson)`; user navigated to `/read/:uuid`

**Given** the user navigates to `/read/:uuid`
**When** the `ReaderRoute` loader runs
**Then** manifest finds no match; `indexedDbService.getStory(uuid)` returns the stored JSON; `loadStory()` called; story renders identically to a library story
**And** `ReaderRoute.test.tsx` updated: preserved ACs from Story 3.3 listed explicitly; new ACs added: IndexedDB hit path, UUID not-found path

**Given** the UUID is opened on a different device or after storage is cleared
**When** IndexedDB returns nothing
**Then** `ErrorBoundary` renders: `"This story isn't available — it may have been loaded on another device or the data was cleared."` with a link to the library

**Given** an invalid story file is selected (missing required field)
**When** `loadStory()` throws `LoaderError('SCHEMA_INVALID', ...)`
**Then** inline error appears below upload trigger (not a modal): `"This doesn't look like a valid Nihon no Hon story."` + specific AJV hint + `"View the story format documentation"` link; error colour `#C0392B`; dismissed by tapping elsewhere or selecting a library story

**Given** an unsupported schema version file
**When** `loadStory()` throws `LoaderError('UNSUPPORTED_VERSION', ...)`
**Then** inline error: `"This story uses a format version this app doesn't support."` + spec link

**Given** a file that is not valid JSON
**When** `loadStory()` throws `LoaderError('PARSE_FAILED', ...)`
**Then** inline error: `"This file couldn't be read as a story."` + spec link

**Given** a story file with absent optional fields (no `difficulty`, no `ruby` arrays)
**When** loaded
**Then** story renders normally; `DifficultyBadge` not shown; ruby toggle has no visible effect; no error

**Given** `indexedDbService.test.ts`
**When** run
**Then** covers: save and retrieve round-trip; `getStory` returns `null` for unknown UUID; uses real in-memory IndexedDB (e.g. `fake-indexeddb`) — not a `vi.mock` stub of the service

---

## Epic 4: Vocabulary, Grammar, Layout Polish & v1 Complete

Users have full reading support — a vocabulary panel, a grammar notes panel with sentence-level highlighting, word spacing and text size controls, a fully responsive layout, and a Credits page. The full Playwright e2e suite closes out v1.

### Story 4.1: Vocabulary Panel & VocabItem

As a **reader**,
I want to browse the story's vocabulary list and tap any word to look it up in the info panel,
So that I can review the story's key vocabulary without having to find each word in the text.

**Acceptance Criteria:**

**Given** a story with `keywords` and/or `vocabSupplement` entries
**When** the vocabulary panel is displayed
**Then** shows a unified list combining both sources — `keywords` first, then `vocabSupplement` entries; if neither exists, shows `"No vocabulary defined for this story."` in `muted`, centred

**Given** a `VocabItem` in the vocabulary panel
**When** rendered
**Then** shows word (large, Noto Sans JP, `lang="ja"`), hiragana reading (smaller, `muted`, Noto Sans JP, `lang="ja"`), English translation; default: no background; hover: `accent-subtle` background; active (currently in InfoPanel): `accent-subtle` background, persists while that entry is displayed

**Given** a `VocabItem` is tapped
**When** the tap event fires
**Then** calls `lookup(word, entry, sentenceId=null)`; `InfoPanel` updates with translation, hiragana, and kanji breakdown; `selectedSentenceId` set to `null` (no sentence highlighted when lookup is from vocab panel)

**Given** `VocabItem.test.tsx`
**When** run
**Then** covers: all fields rendered; tap triggers lookup and InfoPanel update; active state persists when this word is in `lookupState`; `afterEach(_reset)` present

---

### Story 4.2: Grammar Panel & Sentence Highlighting

As a **reader**,
I want to see the grammar points used in the story with relevant points highlighted when I select a sentence,
So that I can understand which grammar patterns apply to each sentence as I read.

**Acceptance Criteria:**

**Given** a story with a `grammar` array (strings)
**When** the grammar panel is displayed
**Then** each grammar point is shown as a list item; if absent or empty, shows `"No grammar notes for this story."` in `muted`, centred

**Given** no sentence is selected (`selectedSentenceId` is `null`)
**When** the grammar panel renders
**Then** all grammar points display at equal visual weight — no highlighting, no dimming

**Given** a sentence is selected that has `grammar: [0, 2]` (indices into `StoryModel.grammar`)
**When** the grammar panel renders
**Then** grammar points at indices 0 and 2 receive `accent-subtle` background + `accent` border; all other points render in `muted`

**Given** a sentence is selected that has `grammar: []`
**When** the grammar panel renders
**Then** all points render in `muted` — none highlighted; this is correct, not an error

**Given** grammar panel tests
**When** run
**Then** cover: equal weight when no sentence selected; correct indices highlighted; no highlights when `grammar: []`; empty state message; `SentenceModel.grammar` (number[]) never confused with `StoryModel.grammar` (string[])

---

### Story 4.3: Responsive Layout & SettingsMenu

As a **reader**,
I want to control word spacing and text size, and on desktop see story and panels side by side,
So that I can customise my reading comfort and make full use of screen real estate on larger devices.

**Acceptance Criteria:**

**Given** `SettingsMenu` (Radix Popover, ⚙ icon in `ToolBar`)
**When** opened
**Then** contains: Spaces toggle (controls `spacingVisible`) and three text size buttons A−, A, A+; A− → `textSize: 'small'` (1rem); A → `textSize: 'medium'` (1.25rem, reset); A+ → `textSize: 'large'` (1.5rem)
**And** `ToolBar` now has exactly three controls: ルビ toggle, Trans toggle, ⚙ icon; the Epic 2 regression guard test is updated to assert 3 controls

**Given** `textSize` changes in `preferenceStore`
**When** applied
**Then** `--story-font-size` CSS custom property on the story container updates to the corresponding `TEXT_SIZE_VALUES` value; change is instant; no page reload; `utils/textSize.ts` exports `TEXT_SIZE_VALUES` as a const

**Given** a viewport narrower than `lg` (< 1024px)
**When** `ReaderRoute` renders
**Then** single-column layout: InfoPanel fixed top (full width), ToolBar below, scrollable story area with `dvh` height; bottom tab bar shows `Story | Vocabulary | Grammar`; active tab: `accent` bottom border + `paper-text` label; inactive: `muted` text

**Given** the user switches from `Story` to `Vocabulary` tab on mobile
**When** tab changes
**Then** vocab panel replaces story content; InfoPanel and ToolBar remain in place; scroll position in story area is preserved and restored when switching back

**Given** a viewport at or wider than `lg` (≥ 1024px)
**When** `ReaderRoute` renders
**Then** two-column layout: InfoPanel spans full width; story text left column (max-width ~65ch); Vocabulary/Grammar tabs in right panel; no bottom tab bar

**Given** `ReaderRoute.test.tsx` updated for Epic 4
**When** run
**Then** lists all preserved ACs from Story 3.4; new ACs: SettingsMenu opens with spacing + size controls; text size CSS property updates; narrow viewport tab bar present; wide viewport two-column layout; tab switching preserves scroll position

---

### Story 4.4: Credits, SEO Polish & Playwright E2E Suite

As a **reader and open-source contributor**,
I want the app to credit its data sources and the full test suite to verify every critical path automatically,
So that the project meets its open-source obligations and ships with confidence.

**Acceptance Criteria:**

**Given** `routes/CreditsRoute.tsx` linked from the library footer or AppBar
**When** visited
**Then** displays attribution for the Genki vocabulary data source (name + licence terms) and the kanji data file source; layout is clean; `<title>` is set appropriately

**Given** `e2e/golden-path.spec.ts`
**When** run
**Then** covers: open app → library loads → tap story card → reader loads → read sentence → tap word → InfoPanel updates → tap second word → InfoPanel updates → navigate back to library; runs on desktop and iPhone 14 viewport

**Given** `e2e/file-upload.spec.ts`
**When** run
**Then** covers: valid story → reader loads; invalid story (missing field) → inline error with spec link; unsupported schema version → inline error; malformed JSON → inline error; optional-fields-absent story → reader loads normally

**Given** `e2e/error-states.spec.ts`
**When** run
**Then** covers: manifest fetch failure → error boundary; story ID not in manifest → "Story not found" + library link; UUID not in IndexedDB → "not available" message + library link

**Given** `e2e/accessibility.spec.ts`
**When** run
**Then** axe-core passes with no violations on: library view, reader (idle InfoPanel), reader (found InfoPanel), vocabulary panel, grammar panel; visual regression snapshots pass for: ruby toggle on/off, Trans toggle on/off, Spaces toggle on/off, InfoPanel idle/found/not-found states

**Given** `turbo test:e2e`
**When** run
**Then** all specs pass on Chromium, Firefox, and WebKit; iPhone 14 viewport tests pass

**Given** all 44 FRs
**When** the complete story set is reviewed
**Then** every FR maps to at least one story with at least one testable AC; no FR is orphaned
