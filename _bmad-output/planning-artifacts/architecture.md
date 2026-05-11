---
stepsCompleted: ["step-01-init", "step-02-context", "step-03-starter", "step-04-decisions", "step-05-patterns", "step-06-structure", "step-07-validation", "step-08-complete"]
lastStep: 8
status: complete
completedAt: "2026-05-11"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
workflowType: 'architecture'
project_name: 'nihonnohon'
user_name: 'RT'
date: '2026-05-10'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

44 FRs across 7 categories (Story Discovery · Story Loading · Reading · Word Lookup · Reading Aids & Display · Story Authoring Format · Application & Platform), with the following v1 scoping decisions applied:

- **Word lookup** is direct key-based lookup against bundled data files — no dictionary bundle, no morphological analysis, no de-inflection. Words in story sentences carry explicit vocabulary key IDs referencing the Genki vocabulary data.
- **Offline capability** is explicitly out of scope for v1. The app is a hosted web page requiring an internet connection to access. Offline support is deferred to future mobile app iterations.
- **Multilingual support** is architecturally preserved (story format language field, ruby label derived from language field, loader architecture is language-agnostic) but not implemented in v1. Japanese / Genki is the first-class v1 experience.
- **Advanced dictionary** (JMdict, KANJIDIC2, de-inflection) is deferred to a future iteration, likely coinciding with dedicated mobile app development.
- **Example stories at v1 launch:** 1 story (reduced from 5). The AI story authoring tool (see external dependency below) must produce one valid, renderable story before v1 can ship.

**Non-Functional Requirements:**

- **Performance:** Word tap → lookup popup appears with no perceptible delay. Direct key lookup against an in-memory map is O(1); the ≤100ms target is trivially achievable with this data architecture. Ruby/spacing/size toggles instant. Local story file load ≤ 1s for typical sizes. Initial page load optimised — data files (Genki vocabulary + kanji data) are small.
- **Accessibility:** WCAG 2.1 AA contrast throughout; ≥3 text size settings; Escape dismisses info panel focus; keyboard scrolling in panel; no colour-only state encoding.
- **Compatibility:** Last 2 major versions of Chrome, Firefox, Safari, Edge on mobile and desktop; touch on iOS Safari and Android Chrome; single responsive layout (no separate mobile site).
- **Maintainability:** External-contribution-ready codebase; test coverage on important and testable features; story format schema versioned with one loader per schema version; data attribution for Genki vocabulary source in Credits/About.

**Scale & Complexity:**

- Primary domain: Frontend SPA (static, no backend, no complex data engineering)
- Complexity level: **Low** (simplified data architecture removes the hardest technical problems from v1 scope; this is a well-understood SPA build)
- Estimated architectural components: ~8–10 UI components + vocabulary lookup service + kanji lookup service + story loader (versioned) + story validator

### Architectural Decisions Made at Context Stage

| Decision | Resolution | Rationale |
|---|---|---|
| Dictionary data | Genki vocabulary CSV (row-indexed by explicit `id` column) + kanji data file (JSON object keyed by literal kanji character); no JMdict/KANJIDIC2 | Eliminates bundle size risk, de-inflection complexity, and build pipeline; lookup is O(1) key fetch |
| Story word linkage | Parallel `vocab_keys` array in sentence data, alongside `words` and `ruby` arrays; items are `integer \| null`; `null` = no vocabulary entry for that token | Direct reference to vocabulary entry by row ID; punctuation tokens use `null`; no runtime lookup by string |
| Parallel array invariant | `words`, `ruby`, and `vocab_keys` arrays MUST have equal length per sentence; parser throws on mismatch | Prevents silent misalignment at render time; validated at load, not at render |
| Sentence ID field | Each sentence carries a stable unique `id` field within the story | Required for stable React keys and AI authoring tool correction/regeneration flows; cheaper to add at schema v1 than in a future bump |
| Offline capability | Not supported in v1 | Web app requires internet to load; offline deferred to future mobile apps |
| Story format versioning | `schema_version` field in story JSON (string enum, e.g. `"1"`); one versioned loader module per supported schema version; new schema version requires a new loader | Explicit forward-compatibility model; loader dispatch via version-keyed registry, not if/else chains |
| Schema version format | Integer-as-string (e.g. `"1"`, `"2"`); no minor/patch subdivision | Avoids `1` vs `"1"` parse ambiguity; every schema change that nihonnohon cares about gets a new version and a new loader |
| StoryModel | Internal reader representation is version-agnostic; loaders are responsible for transforming versioned story JSON into StoryModel; no schema-version-specific logic outside the loader layer | Decouples reader components from schema evolution |
| Language scope | Japanese (Genki I/II) first-class in v1; multilingual architecture preserved but not implemented | Delivers primary use case without foreclosing future expansion |
| Advanced dictionary | Deferred | Out of v1 scope; revisited with mobile app development |
| v1 story count | 1 story | Decouples v1 reader completion from authoring tool timeline; RT can use the app as soon as one valid story exists |
| AI story authoring tool | Separate project (out of scope for nihonnohon); built by RT using a commercial LLM API (e.g. Gemini); translates English stories → simplified Japanese at target Genki difficulty → encodes as story JSON; a v1 soft dependency (1 story required) | Removes manual word-segmentation and ruby-annotation burden; validates schema as a machine-generation target |

### Technical Constraints & Dependencies

**Data files (v1):**

- **Genki vocabulary CSV:** Each row is a vocabulary entry with an explicit `id` column (numerical, permanent, never reordered or reused). The app loads this at startup into an in-memory map keyed by `id`. Row IDs are immutable once assigned — the CSV is append-only. Column schema must be documented and frozen before authoring tool development begins.
- **Kanji data file:** JSON object keyed by literal kanji character (e.g. `{"食": {"meaning": "eat", "on": "ショク", "kun": "た.べる"}, ...}`). Loaded into an in-memory JS object/Map at startup. O(1) lookup by character. Scope (Genki kanji, joyo kanji, or other) to be decided; stories using a kanji outside the file degrade gracefully (kanji breakdown section not shown for that character).

**Story format:**

- Open JSON spec, versioned via `schema_version` string field.
- Sentence data contains three parallel arrays, all of equal length: `words` (Japanese text segments, `minLength: 1`), `ruby` (hiragana reading annotations per word, `string | null`), `vocab_keys` (Genki vocabulary `id` per word, `integer | null`).
- Each sentence carries a unique `id` field (stable within the story).
- Optional per-sentence `translation` field (English string).
- Story-level fields: `keywords` array (`{word, hiragana, translation}`), `grammar` array (strings), `vocab_supplement` array (`{word, hiragana, translation}`), `difficulty` label, `language` field, `title`, `description`.
- Audio link fields present in schema (stored, not played in v1).

**JSON Schema file:**

- Location: `/schemas/story.v1.json` in nihonnohon repo root.
- This is the machine-readable source of truth for both nihonnohon (loader validation) and the AI authoring tool (generation target and output validation).
- Must use `"additionalProperties": false` at every object node to prevent silent field drift.
- CI validates all story fixture files against the schema.
- Must exist and be reviewed before AI authoring tool development begins.

**Versioned loader architecture:**

```
/src/loaders/
  index.js    ← dispatch: reads schema_version, delegates to correct loader module
  v1.js       ← AJV validation against story.v1.json + transform to StoryModel
```

- Loader dispatch via version-keyed registry (`const LOADERS = { "1": loadV1 }`).
- Each loader: validate (AJV) → transform to version-agnostic StoryModel → return StoryModel or throw LoaderError.
- Unrecognised schema version → LoaderError with user-facing message naming the unsupported version.
- LoaderError at file upload → inline error message with link to format spec (not a crash or silent failure).

**External dependency — AI Story Authoring Tool:**

- Separate project, built and maintained by RT independently of nihonnohon.
- Consumes: `/schemas/story.v1.json` (generation target + output validation) and the Genki vocabulary CSV (to map generated Japanese words to vocab key IDs).
- Produces: valid story JSON conforming to schema version `"1"`, with all three parallel arrays populated by the model.
- **v1 soft dependency:** 1 valid, renderable story required before v1 can ship.
- Schema changes must be coordinated between both projects before the version is bumped.

**Browser matrix:** Last 2 major versions of Chrome, Firefox, Safari, Edge; iOS Safari is primary mobile constraint.

**Tech stack (decided in UX phase):** Tailwind CSS + Radix UI / shadcn/ui. Custom components for Japanese-specific rendering.

**Licence:** App licence (MIT or Apache 2.0) to be confirmed compatible with the licence of the Genki vocabulary source data before v1 release.

### Cross-Cutting Concerns Identified

1. **Vocabulary data access:** Genki vocabulary CSV loaded into an in-memory map at startup; accessed by integer row ID on every word tap. Single shared service — not re-loaded per component. Graceful degradation when a `vocab_keys` ID has no corresponding CSV entry (treat as `null`).

2. **Kanji data access:** Kanji data file (JSON object) loaded into an in-memory map keyed by kanji character; accessed during word lookup to render kanji breakdown. Separate from vocabulary access. Stories using kanji outside the file degrade gracefully (breakdown section omitted for that character).

3. **Story format contract:** The JSON Schema file (`/schemas/story.v1.json`) is the shared contract between: the versioned loader, the file upload validator, the reader renderer, the vocabulary/grammar panels, and the external AI story authoring tool. Schema changes increment the version and require a new loader and coordination with the authoring tool. `additionalProperties: false` enforced throughout to prevent silent drift.

4. **Responsive layout orchestration:** Single `lg: 1024px` breakpoint. Below: tab-based layout (Story | Vocabulary | Grammar); above: two-column (story left, vocabulary/grammar panel right). Scroll position in story preserved when switching tabs. InfoPanel persists across all modes.

5. **InfoPanel state:** Single source of truth for the currently-selected word lookup result. Accessible from: story reader word tap, vocabulary panel word tap, and desktop two-column word tap in either column. State management approach (React context, lightweight store, or equivalent) to be decided in the component architecture step.

6. **Accessibility / focus management:** WCAG 2.1 AA is a named NFR; focus management (Escape to dismiss, keyboard navigation in panel, WordToken keyboard triggers) is a cross-cutting concern affecting InfoPanel, WordToken, ToolBar, and tab navigation. Radix UI primitives handle the hardest cases; custom components specify their own accessibility requirements.

7. **Language extensibility hooks:** Ruby label derived from story `language` field (not hardcoded). Vocabulary and kanji lookup services abstracted behind interfaces that do not assume Japanese-specific structure. Not implemented beyond Japanese in v1.

### Development Milestone Sequence

**Milestone 1 — Minimum Viable Reader:** RT can do reading practice with one real Japanese story.
Required: story rendering (one hard-coded story), word tap → reading + Genki definition in InfoPanel, sentence navigation. Nothing else required to meet this milestone.

**Milestone 2 — Full v1 Feature Surface:** All 44 FRs complete, including story library, local file upload, vocabulary/grammar panels, toolbar toggles, responsive layout, Credits/About.

**v1 Ship Condition:** Milestone 2 complete + 1 valid story produced by AI authoring tool passes schema validation and renders correctly.

---

## Starter Template Evaluation

### Primary Technology Domain

Frontend SPA (v1) within a monorepo structured to accommodate a community backend and Capacitor mobile wrapper in future iterations.

### Monorepo Tool Selection

| Tool | Verdict |
|---|---|
| **Turborepo + pnpm workspaces** | Selected — minimal config (~20 lines), immediate build caching, solo-developer appropriate, TypeScript-native |
| Nx | Rejected — enterprise-grade governance features not needed; 2+ hours of config overhead for a solo developer |
| pnpm workspaces only | Viable but no task caching or parallel build orchestration; Turborepo adds this with negligible overhead |

### Starter Options Considered

| Option | Verdict |
|---|---|
| `npx create-turbo@latest` + Vite web app | Selected — standard Turborepo scaffold, then add Vite + React + shadcn/ui |
| Next.js | Rejected — SSR/hybrid conventions, no benefit for a pure client-side SPA |
| Astro | Rejected — SSG/islands model conflicts with interactive SPA state requirements |

### Monorepo Structure

```
nihonnohon/                          ← repo root
├── apps/
│   ├── web/                         ← Vite + React SPA
│   │   ├── src/
│   │   │   ├── components/          ← UI components (WordToken, InfoPanel, etc.)
│   │   │   └── services/            ← vocab & kanji lookup services
│   │   ├── public/                  ← static assets: Genki CSV, kanji data, stories
│   │   ├── ios/                     ← Capacitor iOS (added in mobile iteration)
│   │   ├── android/                 ← Capacitor Android (added in mobile iteration)
│   │   └── vite.config.ts
│   └── api/                         ← Future: community story-sharing backend
├── packages/
│   ├── schema/                      ← @nihonnohon/schema
│   │   ├── schemas/story.v1.json    ← JSON Schema (source of truth for all consumers)
│   │   └── src/types.ts             ← TypeScript story type definitions
│   ├── story-loader/                ← @nihonnohon/story-loader
│   │   └── src/
│   │       ├── index.ts             ← version-keyed loader dispatch
│   │       ├── v1.ts                ← v1 loader: AJV validation + StoryModel transform
│   │       └── model.ts             ← StoryModel interface (version-agnostic)
│   ├── typescript-config/           ← Shared tsconfig bases
│   └── eslint-config/               ← Shared ESLint config
├── turbo.json
├── package.json                     ← workspace root (private: true)
└── pnpm-workspace.yaml
```

**Package dependency graph:**

```
apps/web      → @nihonnohon/schema, @nihonnohon/story-loader
apps/api      → @nihonnohon/schema, @nihonnohon/story-loader  (future)
story-loader  → @nihonnohon/schema
schema        → (no internal dependencies)
```

**Why this split:**
- `@nihonnohon/schema` — JSON Schema files + TypeScript types; pure definitions, no runtime logic; consumed by web, future API, and referenced by the external AI authoring tool
- `@nihonnohon/story-loader` — versioned loaders + StoryModel + AJV validation; runtime logic consumed by web app (at file upload + library load) and future API (server-side story upload validation)
- Vocabulary/kanji lookup services stay in `apps/web/src/services/` — they are browser-runtime concerns (in-memory maps from static files) not shared with the API
- `apps/web` accommodates Capacitor natively when the mobile iteration arrives — `ios/`, `android/`, and `capacitor.config.ts` are added to this app without restructuring the monorepo

### Initialization Commands

```bash
npx create-turbo@latest nihonnohon   # scaffold monorepo, select pnpm
cd nihonnohon
# Remove default apps; scaffold web app:
cd apps && npm create vite@latest web -- --template react-ts
cd web && npx shadcn@latest init
# Create packages/schema and packages/story-loader as empty TS packages
# Wire up pnpm-workspace.yaml and turbo.json pipeline
```

**Note:** Monorepo initialisation and web app scaffold is the first implementation story.

### Architectural Decisions Provided by Starter

**Language & Runtime:** TypeScript throughout — strict mode in all packages and apps.

**Package Manager:** pnpm — workspace-aware, fast, disk-efficient; required by Turborepo for optimal monorepo support.

**Build Orchestration:** Turborepo — task caching, parallel builds, dependency-aware pipeline. `turbo build` builds all packages in dependency order; `turbo dev` starts all dev servers in parallel.

**Styling Solution:** Tailwind CSS + shadcn/ui (in `apps/web`); nihonnohon design tokens defined as Tailwind theme extensions.

**Build Output:** `apps/web` produces a static `dist/` folder — deployable to Vercel, Netlify, GitHub Pages, or Cloudflare Pages with no server required.

**Testing:** Vitest (added in first implementation story) — Vite-native, works identically in both `apps/web` and `packages/*`.

**Code Quality:** Shared ESLint config + Prettier via `packages/eslint-config` and `packages/typescript-config` — consistent conventions across all packages and apps.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- State management approach — drives component design and InfoPanel shared state
- Routing and URL model — determines shareability and navigation architecture
- Story ID stability contract — determines shareability and bookmark reliability
- Vocab data build pipeline — determines data import structure and Turborepo config

**Important Decisions (Shape Architecture):**
- Local file upload persistence model (UUID + IndexedDB)
- Hosting platform and CI/CD pipeline
- Testing strategy — unit + e2e scope
- packages/schema build approach

**Deferred Decisions (Post-v1):**
- API design (community backend)
- Authentication
- Capacitor mobile configuration
- Per-story SEO meta tags (technically enabled by permanent IDs; implementation deferred)

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Story library manifest | `apps/web/public/stories/manifest.json` — fetched at startup via React Router `loader`; entries: `id` (permanent slug), `filename`, `title`, `titleJa`, `difficulty`, `language`, `description` | Adding stories requires no code change; permanent IDs enable shareable URLs |
| Story ID format | Human-readable slug (e.g. `genki-i-ch6-tanaka-letter`) — permanent once assigned, never reused | Shareable in links, readable in URL bar, descriptive when posted to social/community |
| Story ID stability contract | Permanent once assigned — same model as Genki vocabulary CSV row IDs | Bookmarked and shared URLs remain valid indefinitely |
| Route resolution order | (1) Manifest lookup by ID → fetch from `public/stories/`; (2) IndexedDB lookup by UUID → load local content; (3) Neither → "story not found" state with link to library | Single `/read/:storyId` route pattern handles both library and local upload stories |
| Local file upload persistence | UUID (client-generated) + IndexedDB — content stored keyed by UUID; `/read/:uuid` route works identically to library stories; refresh and in-session navigation survive; local URLs are not shareable by design | Clean user model; avoids sessionStorage loss on refresh; integrates naturally with the unified route pattern |
| Vocabulary data loading | Preprocess Genki CSV → typed JSON at build time via `scripts/build-vocab.ts`; output: `apps/web/src/data/vocab.json` (gitignored — always regenerated) | Eliminates runtime CSV parsing; fully typed; no Papa Parse dependency |
| Vocab pipeline Turborepo config | `"build-vocab"` task with `"inputs": ["scripts/build-vocab.ts", "data/genki.csv"]`, `"outputs": ["apps/web/src/data/vocab.json"]`, `"cache": true`; `apps/web` `dev` and `build` tasks declare `"dependsOn": ["build-vocab"]`; output sorted deterministically by stable key | Correct Turborepo caching; prevents stale data from committed derived artifacts |
| Kanji data | `apps/web/public/kanji-data.json` — JSON object keyed by literal kanji character; loaded into in-memory Map at startup | O(1) lookup; no build step needed |
| Session persistence | Zustand `persist` middleware on preference store only; persisted: ruby toggle, spacing toggle, trans toggle, text size, active mobile tab | Preferences survive page reload; separate from lookup store to enable clean unit testing |
| Schema validation | AJV v8 in `@nihonnohon/story-loader`; validate AJV import chain in Vite/ESM pipeline before writing validation logic (AJV v8 is CommonJS — may require `createRequire` shim) | Current major version; JSON Schema Draft-07; TypeScript-native |

### Frontend Architecture

| Decision | Choice | Rationale |
|---|---|---|
| State management | **Zustand** — two separate `create()` calls: `useLookupStore` (lookup state) and `usePreferenceStore` (persisted preferences) | Separate stores enable independent unit testing with no localStorage side effects; `persist` middleware on preference store only |
| Lookup state shape | Discriminated union: `{ status: 'idle' \| 'found' \| 'not-found', word?: string, result?: VocabEntry }` | Eliminates indeterminate null state between `selectedWord` set and result received; enables precise state-transition assertions in tests |
| InfoPanel idle state | When `status: 'idle'` — InfoPanel displays story title, difficulty label, and language metadata (not blank) | Matches UX spec "persistent panel" behaviour; blank panel is "broken panel" UX |
| Mobile tab state | Active tab (Story / Vocabulary / Grammar) stored in `usePreferenceStore` — persisted across sessions | Users who prefer the Grammar tab stay on Grammar as they navigate between words |
| Routing | **React Router v6** — two routes: `/` (library) and `/read/:storyId` | Sufficient for this route surface; well-known, simpler than TanStack Router at two routes |
| Story shareability | Library story URLs (`/read/genki-i-ch6-tanaka-letter`) are fully shareable — permanent IDs mean links remain valid indefinitely | Enables teacher-student sharing, community links, bookmarks |
| `vercel.json` SPA rewrite | Required: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` | Without this, `/read/:storyId` returns 404 on hard refresh in production |
| Component architecture | Per UX spec: WordToken, InfoPanel, KanjiBreakdown, SentenceBlock, AppBar, ToolBar, StoryCard, DifficultyBadge, VocabItem; Radix UI Tabs and Select for accessible primitives | Fully documented in UX specification |
| Story content caching | React Router `loader` functions for manifest and story fetches; manifest fetch failure handled at loader level with explicit error boundary | Avoids refetching on back-navigation; loading and error states designed from day one |
| `packages/schema` build | `tsup` build step producing CJS + ESM outputs with `exports` map | Raw TypeScript across package boundaries requires `tsx`/`ts-node` in every consumer; compiled output is cleaner and portable |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | **Vercel** — zero config for Vite SPA; automatic preview deployments per PR; native Turborepo support; CDN out of the box | Free tier sufficient; no manual deployment steps |
| CI/CD | **GitHub Actions** — pipeline: lint → type-check → test → build on every PR; Vercel GitHub integration deploys on merge to main | Free for public repos; GHA owns quality gates, Vercel owns deployment |
| Bundle size budget | Target ≤ 150KB gzipped initial bundle; bundle analyser step in CI | Enforces mobile-first performance; catches dependency bloat before it ships |
| Font loading | Noto Sans JP (web font, subset for Genki kanji range) + `Inter` for UI text + system CJK fallback | Consistent Japanese text rendering across devices; specified in UX design system |

### Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | **Vitest** + `@testing-library/react` | Loader validation; vocab/kanji lookup services; parallel array invariants; discriminated union state transitions; component rendering with mock data |
| E2e | **Playwright** (Chromium + Firefox + WebKit) | Golden path; error paths; accessibility (axe-core); visual regression (toHaveScreenshot for toggle states); manifest fetch failure; localStorage persistence across reload; iPhone 14 viewport |

**Playwright golden path:** User opens app → sees story in library → taps story card → reader loads → reads a sentence → taps a word → InfoPanel updates with translation + reading → taps a second word → InfoPanel updates → navigates back to library.

**Playwright error paths:** Invalid story file upload; unsupported schema version; manifest fetch failure; story ID not found; UUID not found (local upload expired).

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffold + `@nihonnohon/schema` package with `tsup` build (story.v1.json + TypeScript types)
2. `@nihonnohon/story-loader` package (AJV v8 — verify ESM import chain first — + v1 loader + StoryModel)
3. Vocabulary build script (`scripts/build-vocab.ts`) + Turborepo pipeline wiring
4. `apps/web` scaffold (Vite + React + TypeScript + shadcn/ui + React Router v6 + `vercel.json`)
5. Zustand stores (`useLookupStore` + `usePreferenceStore`) with discriminated union lookup state
6. Core UI components: WordToken, InfoPanel (with idle state), SentenceBlock — **Milestone 1 target**
7. Story library manifest + StoryCard + library view + React Router `loader` with error boundary
8. Local file upload flow (UUID generation + IndexedDB storage)
9. Vocabulary/grammar panels + responsive layout (lg breakpoint)
10. ToolBar toggles + text size adjustment
11. Playwright e2e suite (golden path + error paths + accessibility + visual regression)

**Cross-Component Dependencies:**
- `@nihonnohon/story-loader` depends on `@nihonnohon/schema` (compiled via `tsup`)
- `useLookupStore` is the shared state layer between WordToken, InfoPanel, VocabItem, and KanjiBreakdown
- Vocabulary build script must complete before `apps/web` dev server starts (Turborepo `dependsOn`)
- React Router `loader` at `/read/:storyId` orchestrates manifest lookup → IndexedDB fallback → not-found state
- Story manifest must be populated before library view renders meaningful content

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
nihonnohon/                              ← monorepo root
├── .github/
│   └── workflows/
│       └── ci.yml                       ← lint → typecheck → test:unit → test:e2e → build
├── docs/
│   └── adr/                             ← Architecture Decision Records
│       ├── 001-monorepo-turborepo.md
│       ├── 002-json-schema-over-zod.md
│       └── 003-story-generator-out-of-scope.md
├── apps/
│   ├── web/                             ← Vite + React SPA (@nihonnohon/web)
│   │   ├── e2e/                         ← Playwright end-to-end tests
│   │   │   ├── __fixtures__/
│   │   │   │   ├── valid-story-v1.json
│   │   │   │   ├── valid-story-v1-minimal.json      ← 1 sentence, 1 word, no optional fields
│   │   │   │   ├── invalid-missing-sentences.json
│   │   │   │   ├── invalid-empty-sentences-array.json
│   │   │   │   ├── invalid-malformed.json            ← unparseable JSON
│   │   │   │   └── unsupported-schema-version.json
│   │   │   ├── golden-path.spec.ts      ← library → reader → word lookup → back
│   │   │   ├── file-upload.spec.ts      ← valid + invalid + unsupported + malformed + wrong MIME
│   │   │   ├── error-states.spec.ts     ← manifest failure, story not found, UUID expired
│   │   │   └── accessibility.spec.ts    ← axe-core + visual regression (toggle states)
│   │   ├── public/
│   │   │   ├── stories/
│   │   │   │   ├── manifest.json        ← story library index (permanent slugs)
│   │   │   │   └── genki-i-ch6-tanaka-letter.json   ← v1 example story
│   │   │   ├── kanji-data.json          ← kanji lookup data (committed; keyed by character)
│   │   │   └── vocab.json               ← Genki vocab (gitignored; generated by build-vocab)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AppBar.tsx           ← FR35: back link + logo
│   │   │   │   ├── AppBar.test.tsx
│   │   │   │   ├── DifficultyBadge.tsx  ← FR4, FR5: difficulty pill; absent when field missing
│   │   │   │   ├── DifficultyBadge.test.tsx
│   │   │   │   ├── InfoPanel.tsx        ← FR15–21: idle / found / not-found states
│   │   │   │   ├── InfoPanel.test.tsx
│   │   │   │   ├── KanjiBreakdown.tsx   ← FR18: kanji character + meaning row
│   │   │   │   ├── KanjiBreakdown.test.tsx
│   │   │   │   ├── SentenceBlock.tsx    ← FR11–13: sentence + translation + selection highlight
│   │   │   │   ├── SentenceBlock.test.tsx
│   │   │   │   ├── StoryCard.tsx        ← FR1, FR4: library card
│   │   │   │   ├── StoryCard.test.tsx
│   │   │   │   ├── ToolBar.tsx          ← FR23–26: ruby / spaces / trans toggles + text size
│   │   │   │   ├── ToolBar.test.tsx
│   │   │   │   ├── VocabItem.tsx        ← FR40, FR41: vocabulary panel row
│   │   │   │   └── VocabItem.test.tsx
│   │   │   ├── routes/
│   │   │   │   ├── LibraryRoute.tsx     ← FR1–10: library view + loader + error boundary
│   │   │   │   ├── LibraryRoute.test.tsx
│   │   │   │   ├── ReaderRoute.tsx      ← FR11–44: reader + loader + error boundary
│   │   │   │   └── ReaderRoute.test.tsx
│   │   │   ├── services/
│   │   │   │   ├── vocabService.ts      ← fetch('/vocab.json') → in-memory Map + lookupVocab()
│   │   │   │   ├── vocabService.test.ts
│   │   │   │   ├── kanjiService.ts      ← fetch('/kanji-data.json') → in-memory Map + lookupKanji()
│   │   │   │   ├── kanjiService.test.ts
│   │   │   │   ├── indexedDbService.ts  ← FR7: UUID generation + IndexedDB CRUD for local uploads
│   │   │   │   └── indexedDbService.test.ts
│   │   │   ├── stores/
│   │   │   │   ├── lookupStore.ts       ← LookupState discriminated union + selectedSentenceId
│   │   │   │   ├── lookupStore.test.ts
│   │   │   │   ├── preferenceStore.ts   ← persisted: toggles + textSize + activeTab
│   │   │   │   └── preferenceStore.test.ts
│   │   │   ├── utils/
│   │   │   │   ├── storyManifest.ts     ← manifest fetch + type guard
│   │   │   │   ├── storyManifest.test.ts
│   │   │   │   └── textSize.ts          ← TEXT_SIZE_VALUES + --story-font-size values
│   │   │   ├── types.ts                 ← app-local types (ManifestEntry, etc.) — never imported by packages
│   │   │   ├── router.tsx               ← React Router RouterProvider + route definitions
│   │   │   ├── App.tsx                  ← root component
│   │   │   └── main.tsx                 ← React root mount + store initialisation
│   │   ├── components.json              ← shadcn/ui registry config
│   │   ├── index.html                   ← Vite entry point
│   │   ├── package.json
│   │   ├── playwright.config.ts         ← baseURL, webServer, testDir, devices (iPhone 14)
│   │   ├── tailwind.config.ts           ← design tokens: paper-bg, accent, font-ja, etc.
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json            ← @/* → ./src/* path alias
│   │   ├── tsconfig.node.json
│   │   └── vite.config.ts               ← @/* alias + vitest config
│   ├── api/                             ← Future: community backend (placeholder)
│   │   └── package.json
│   └── story-generator/                 ← AI story authoring tool — OUT OF SCOPE (placeholder)
│       ├── README.md                    ← purpose, contract, validation instructions, do-nots
│       ├── pyproject.toml
│       ├── requirements.txt             ← Google ADK + dependencies (placeholder)
│       ├── .python-version
│       ├── .gitignore
│       ├── src/
│       │   └── story_generator/
│       │       ├── __init__.py
│       │       ├── main.py              ← entry point (placeholder)
│       │       └── validator.py         ← validates output against story.v1.json (placeholder)
│       └── tests/
│           └── __init__.py
├── packages/
│   ├── schema/                          ← @nihonnohon/schema
│   │   ├── README.md                    ← SCHEMA IS VERSIONED — change contract, not just field
│   │   ├── SCHEMA_CHANGELOG.md          ← version history: what changed, which loader supports it
│   │   ├── schemas/
│   │   │   └── story.v1.json            ← JSON Schema — source of truth for all consumers
│   │   ├── src/
│   │   │   ├── types.ts                 ← StoryModel, VocabEntry, KanjiEntry, LookupState, etc.
│   │   │   └── index.ts                 ← package entry point
│   │   ├── package.json                 ← exports map pointing at dist/
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts               ← builds CJS + ESM with exports map
│   ├── story-loader/                    ← @nihonnohon/story-loader
│   │   ├── README.md                    ← loader contract: which version → which loader; what LoaderError is NOT
│   │   ├── src/
│   │   │   ├── index.ts                 ← loadStory() dispatch + LoaderError class
│   │   │   ├── index.test.ts
│   │   │   ├── v1.ts                    ← AJV validation + snake_case→camelCase transform
│   │   │   ├── v1.test.ts
│   │   │   └── __fixtures__/
│   │   │       ├── valid-v1.json
│   │   │       ├── valid-v1-minimal.json           ← 1 sentence, no optional fields
│   │   │       ├── invalid-schema.json
│   │   │       ├── invalid-empty-sentences.json
│   │   │       ├── invalid-malformed.json           ← unparseable — tests JSON.parse throw
│   │   │       └── invalid-sentence-missing-id.json ← valid outer structure, broken sentence object
│   │   ├── package.json                 ← exports map pointing at dist/
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── typescript-config/               ← shared tsconfig bases
│   │   ├── base.json
│   │   ├── react-library.json
│   │   └── package.json
│   └── eslint-config/                   ← shared ESLint + Prettier + import boundary rules
│       ├── index.js                     ← base config with eslint-plugin-boundaries
│       ├── react.js                     ← React + JSX rules
│       └── package.json
├── scripts/
│   ├── build-vocab.ts                   ← Genki CSV → apps/web/public/vocab.json (gitignored output)
│   └── data/
│       └── genki-vocab.csv              ← source Genki vocabulary (committed; append-only; stable row IDs)
├── .env.example                         ← documented env vars (no secrets)
├── .gitignore                           ← includes apps/web/public/vocab.json
├── CONTRIBUTING.md                      ← Turborepo workflow, pnpm commands, package conventions
├── package.json                         ← workspace root (private: true); turbo + tsx in devDependencies
├── pnpm-workspace.yaml                  ← apps/web, apps/api, packages/* (story-generator excluded)
├── turbo.json
├── vercel.json                          ← SPA rewrite + rootDirectory: apps/web
└── README.md
```

### Key Structural Decisions

**`vocab.json` in `public/` (not `src/data/`):** Both vocab and kanji data are fetched at runtime via `fetch('/vocab.json')` and `fetch('/kanji-data.json')` in their respective services. Neither is statically imported — no Turborepo build output needs to resolve before Vite starts. `vocab.json` is gitignored (generated); `kanji-data.json` is committed (static source data).

**`apps/story-generator/` excluded from pnpm workspace:** Python runtime; not part of the Node.js dependency graph. `pnpm-workspace.yaml` lists only `apps/web`, `apps/api`, `packages/*`.

**`apps/web/src/types.ts` is app-local only:** Types needed by `packages/` live in `packages/schema/src/types.ts`. No package imports from `apps/web/` — that would invert the dependency direction.

**`eslint-config` includes `eslint-plugin-boundaries`:** Enforces the layered import rules (components → stores → services, never backwards; `apps/web` imports compiled package outputs only) as machine-checked constraints, not conventions.

### Turborepo Pipeline

```json
{
  "tasks": {
    "build-vocab": {
      "inputs": ["scripts/build-vocab.ts", "scripts/data/genki-vocab.csv"],
      "outputs": ["apps/web/public/vocab.json"],
      "cache": true
    },
    "build": {
      "dependsOn": ["^build", "build-vocab"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build", "build-vocab"],
      "persistent": true,
      "cache": false
    },
    "typecheck": { "dependsOn": ["^build"] },
    "test:unit": { "dependsOn": ["^build", "build-vocab"] },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {}
  }
}
```

`test:unit` (Vitest) and `test:e2e` (Playwright) are separate pipeline tasks — prevents port collisions from Playwright's `webServer` launch conflicting with Vitest's process on CI.

`packages/story-loader#build` is a transitive dependency of `apps/web#build` via `"^build"` — Turborepo resolves this automatically from the package dependency graph.

### Requirements to Structure Mapping

| FR Category | Primary Files |
|---|---|
| Story Discovery (FR1–5) | `routes/LibraryRoute.tsx`, `components/StoryCard.tsx`, `components/DifficultyBadge.tsx`, `public/stories/manifest.json` |
| Story Loading (FR6–10) | `routes/ReaderRoute.tsx` (loader), `services/indexedDbService.ts`, `packages/story-loader/src/` |
| Reading (FR11–14) | `components/SentenceBlock.tsx`, `components/WordToken.tsx`, `stores/lookupStore.ts` |
| Word Lookup (FR15–22) | `components/InfoPanel.tsx`, `components/KanjiBreakdown.tsx`, `services/vocabService.ts`, `services/kanjiService.ts` |
| Reading Aids (FR23–26) | `components/ToolBar.tsx`, `stores/preferenceStore.ts`, `utils/textSize.ts` |
| Story Authoring Format (FR27–34, FR38–39) | `packages/schema/schemas/story.v1.json`, `packages/schema/src/types.ts`, `packages/story-loader/src/v1.ts` |
| Application & Platform (FR35–37, FR40–44) | `components/AppBar.tsx`, `routes/LibraryRoute.tsx`, `tailwind.config.ts`; grammar tab in `routes/ReaderRoute.tsx` driven by `stores/lookupStore.ts` |

### Architectural Boundaries

**Format boundary:** `packages/story-loader/src/v1.ts` is the only code that knows the story JSON wire format. Everything upstream receives only `StoryModel`.

**Data boundary:** `vocabService` and `kanjiService` own the in-memory Maps. No component accesses `vocab.json` or `kanji-data.json` directly.

**State boundary:** `lookupStore` and `preferenceStore` are the only shared state. React Router `loader` functions own all async data fetching.

**Package boundary:** `apps/web` imports from compiled `@nihonnohon/*` package outputs only — enforced by `eslint-plugin-boundaries`.

**Schema boundary:** `packages/schema/schemas/story.v1.json` is the contract between nihonnohon (loader) and the AI story authoring tool (generator). Any change that could break a loader reading previously written data requires a new schema version file and a new loader.

### Data Flow

```
User taps word
  → WordToken onClick
  → useLookupStore.lookup(word, vocabKey, sentenceId)
  → vocabService.lookupVocab(vocabKey) → VocabEntry | null
  → lookupState: 'found' | 'not-found'
  → InfoPanel renders result or "No entry for [word]"
  → SentenceBlock: selectedSentenceId match → bg-accent-subtle highlight
  → GrammarPanel: sentence.grammar indices → highlights matching grammar points

User opens story from library
  → ReaderRoute loader
  → fetch manifest.json → find storyId
  → fetch /stories/{filename}.json
  → loadStory(rawJson) → v1 loader → AJV validate → transform → StoryModel
  → route data → ReaderRoute renders

User uploads local file
  → LibraryRoute file input → File API
  → loadStory(rawJson) → validate → StoryModel
  → indexedDbService.saveStory(uuid, rawJson)
  → navigate('/read/:uuid')
  → ReaderRoute loader → IndexedDB hit → loadStory() → StoryModel

Both vocab and kanji data
  → fetched once at app startup in their respective services
  → loaded into in-memory Maps
  → available synchronously for all subsequent lookups
```

---

## Implementation Patterns & Consistency Rules

### Where Does Code Go? (Decision Table)

| I am writing… | It goes in… |
|---|---|
| `snake_case` → `camelCase` transform for story JSON | `packages/story-loader/src/v1.ts` only |
| TypeScript types shared across packages | `packages/schema/src/types.ts` |
| TypeScript types local to the web app | `apps/web/src/types.ts` |
| Vocab or kanji lookup logic | `apps/web/src/services/` |
| A Zustand store slice | `apps/web/src/stores/` |
| A React component | `apps/web/src/components/` |
| A route-level component | `apps/web/src/routes/` |
| A one-off utility (pure, no side effects) | `apps/web/src/utils/` |
| Test fixtures and mock data | `__fixtures__/` directory co-located with test file |

---

### Naming Patterns

**File naming:**

| Artefact | Convention | Example |
|---|---|---|
| React component | `PascalCase.tsx` | `WordToken.tsx` |
| Custom hook | `usePascalCase.ts` | `useVocabLookup.ts` |
| Service / utility | `camelCase.ts` | `vocabService.ts` |
| Test file | `[filename].test.ts(x)` co-located | `WordToken.test.tsx` |
| Store | `camelCaseStore.ts` | `lookupStore.ts` |

**Code naming:**

| Construct | Convention | Example |
|---|---|---|
| Component | `PascalCase` | `WordToken`, `InfoPanel` |
| Hook | `use` + `PascalCase` | `useLookupStore` |
| Store export | `use` + `PascalCase` + `Store` | `useLookupStore`, `usePreferenceStore` |
| Service function | `camelCase` verb-noun | `lookupVocab`, `lookupKanji` |
| TypeScript type / interface | `PascalCase` | `StoryModel`, `VocabEntry` |
| Constant | `UPPER_SNAKE_CASE` | `SCHEMA_VERSION_UNSUPPORTED` |
| CSS design token | `kebab-case` Tailwind extension | `paper-bg`, `accent-subtle` |

**Story JSON wire format: `snake_case`. TypeScript internal types: `camelCase`.**
The v1 loader in `packages/story-loader/src/v1.ts` is the only place this transformation occurs. No other layer performs it.

```json
// Wire format (story JSON file):
{ "schema_version": "1", "title_ja": "たなかさんのてがみ", "vocab_keys": [42, null, 7] }
```
```ts
// StoryModel (TypeScript internal):
{ schemaVersion: "1", titleJa: "たなかさんのてがみ", vocabKeys: [42, null, 7] }
```

**Story ID format:** `kebab-case` permanent slug, assigned once, never changed. Example: `genki-i-ch6-tanaka-letter`. Route param always named `:storyId`.

**No re-export barrel `index.ts` files.** Files with actual logic may use `index.ts`; files that only re-export other modules are prohibited. Import the source file directly.

---

### Canonical Type Definitions

Defined once in `packages/schema/src/types.ts`. No agent redefines locally.

```ts
// Vocab entry — from Genki CSV:
interface VocabEntry {
  id: number
  word: string
  reading: string
  meaning: string
  lesson: string        // e.g. "Genki I Ch.6"
  notes?: string        // optional author annotation — additional context about the word
}

// Kanji entry — from kanji data file:
interface KanjiEntry {
  character: string
  meaning: string
  onYomi: string[]
  kunYomi: string[]
}

// StoryModel — version-agnostic internal representation:
interface StoryModel {
  schemaVersion: string
  id: string
  title: string
  titleJa: string
  language: string
  difficulty: string | null
  description: string
  keywords: VocabSupplementEntry[]
  grammar: string[]              // grammar point descriptions — StoryModel level
  vocabSupplement: VocabSupplementEntry[]
  sentences: SentenceModel[]
  metadata: Record<string, unknown>  // extensible key-value store; currently unused; defaults to {}
}

interface SentenceModel {
  id: string
  words: string[]
  ruby: (string | null)[]
  vocabKeys: (number | null)[]
  translation: string | null
  grammar: number[]              // indices into StoryModel.grammar[]; [] if no grammar points apply
}

interface VocabSupplementEntry {
  word: string
  hiragana: string
  translation: string
}

// CRITICAL NAMING DISTINCTION — agents must not conflate:
// StoryModel.grammar   → string[]   — the grammar point description text
// SentenceModel.grammar → number[]  — indices referencing StoryModel.grammar entries

// Lookup state — discriminated union, no nullable shape:
type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
```

**`LoaderError` — canonical class in `packages/story-loader/src/index.ts`:**

```ts
export class LoaderError extends Error {
  constructor(
    public readonly code:
      | 'UNSUPPORTED_VERSION'
      | 'SCHEMA_INVALID'
      | 'PARSE_FAILED',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LoaderError'
  }
}
```

---

### State Management Patterns

**Two stores, strictly separated:**

```ts
// lookupStore.ts — never imports from preferenceStore.ts
// preferenceStore.ts — never imports from lookupStore.ts
```

**Lookup store — includes sentence selection:**

```ts
interface LookupStore {
  lookupState: LookupState
  selectedSentenceId: string | null
  lookup: (word: string, entry: VocabEntry | null, sentenceId: string) => void
  selectSentence: (sentenceId: string) => void
  reset: () => void
  _reset: () => void   // test-only — resets all state without localStorage side effects
}
```

- **Word tap** → `lookup(word, entry, sentenceId)` — updates both `lookupState` and `selectedSentenceId`
- **Sentence container tap** → `selectSentence(sentenceId)` — updates `selectedSentenceId`, resets `lookupState` to `{ status: 'idle' }`

**Preference store — persisted keys:** `rubyVisible`, `spacingVisible`, `transVisible`, `textSize ('small' | 'medium' | 'large')`, `activeTab ('story' | 'vocabulary' | 'grammar')`.

**Test isolation:**

```ts
// Every test using useLookupStore:
afterEach(() => useLookupStore.getState()._reset())

// Every test using usePreferenceStore:
beforeEach(() => localStorage.clear())
```

**Selector pattern — `useShallow` for object selections:**

```ts
// ✅ Object selection:
const { word, entry } = useLookupStore(useShallow((s) => ({ word: s.word, entry: s.entry })))
// ✅ Primitive selection (no useShallow needed):
const status = useLookupStore((s) => s.lookupState.status)
```

**Async story loading — React Router `loader`, not `useEffect` or store actions:**

```ts
// apps/web/src/routes/ReaderRoute.tsx
export async function loader({ params }: LoaderFunctionArgs): Promise<StoryModel> {
  // 1. Manifest lookup by storyId
  // 2. IndexedDB lookup by UUID
  // 3. throw new LoaderError('PARSE_FAILED', ...) → caught by ErrorBoundary
}
```

Store actions handle synchronous state updates only. Data fetching lives exclusively in React Router loaders.

---

### Japanese Text Rendering Patterns

**`lang="ja"` on every element rendering Japanese text. No exceptions.**

**`font-ja` — defined in `tailwind.config.ts`:**

```ts
theme: { extend: { fontFamily: { ja: ['Noto Sans JP', 'system-ui', 'sans-serif'] } } }
```

**Ruby annotations — `<ruby>/<rt>` with `visibility: hidden` toggle (never `display: none`):**

```tsx
// ✅ Correct — visibility: hidden preserves line height, prevents reflow:
<ruby lang="ja" className="font-ja">
  {word}
  <rt className={cn('text-ruby', !rubyVisible && 'invisible')}>{reading}</rt>
</ruby>

// ❌ Never display: none — collapses <rt> space, causes paragraph reflow
// ❌ Never CSS-simulated ruby
```

**Ruby container rules — applied to sentence container:**

```css
ruby { ruby-position: over; ruby-align: center; }
.word-token { white-space: nowrap; }   /* prevents mid-token line break */
```

**Word tokens — `<span role="button">` with both `Enter` and `Space`:**

```tsx
<span
  role="button"
  tabIndex={0}
  aria-label={word}
  lang="ja"
  className="font-ja cursor-pointer ..."
  onClick={() => lookup(word, entry, sentenceId)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') lookup(word, entry, sentenceId)
  }}
>
  {word}
</span>
// ❌ Never omit Space from onKeyDown — required by WCAG
```

**Spacing toggle — CSS `gap` with 150ms transition (reflow accepted):**

```tsx
<div className={cn(
  'flex flex-wrap transition-[gap] duration-150',
  spacingVisible ? 'gap-x-2' : 'gap-x-0'
)}>
  {words.map(/* WordToken */)}
</div>
```

**Text size — CSS custom property `--story-font-size`:**

```tsx
<div style={{ '--story-font-size': TEXT_SIZE_VALUES[textSize] } as React.CSSProperties}
     className="text-[length:var(--story-font-size)]">

const TEXT_SIZE_VALUES = {
  small: '1rem', medium: '1.25rem', large: '1.5rem',
} as const
```

---

### Sentence Selection Patterns

**SentenceBlock — selected state and subtle highlight:**

```tsx
// isSelected derived from: selectedSentenceId === sentence.id
<div
  role="group"
  aria-label={`Sentence ${sentenceIndex + 1}`}
  onClick={() => selectSentence(sentence.id)}
  className={cn(
    'py-2 px-1 rounded transition-colors duration-100',
    isSelected && 'bg-accent-subtle'   // #F5EDD6 — very subtle warm tint; orientation, not emphasis
  )}
>
  {sentence.words.map(/* WordToken — word tap calls lookup(..., sentence.id) */)}
</div>
```

**Grammar tab — highlight grammar points for selected sentence:**

```tsx
// Derived before render:
// const selectedSentence = story.sentences.find(s => s.id === selectedSentenceId)
// const applicableIndices = selectedSentence?.grammar ?? null

{story.grammar.map((point, index) => (
  <div
    key={index}
    className={cn(
      'p-2 rounded text-sm',
      applicableIndices?.includes(index)
        ? 'bg-accent-subtle border border-accent'   // applies to selected sentence
        : 'text-muted'                              // does not apply
    )}
  >
    {point}
  </div>
))}
// If no sentence selected: all grammar points render at equal weight (no highlighting)
// If sentence selected with grammar: [] — no highlights (correct — none apply to this sentence)
```

---

### InfoPanel State Patterns

| `lookupState.status` | InfoPanel displays |
|---|---|
| `'idle'` | Story title + difficulty label + language |
| `'found'` | Word → translation → hiragana reading → KanjiBreakdown |
| `'not-found'` | "No entry for [word]" in `muted` colour |

"No entry" is not an error — no error styling, no icon. Confirms tap registered, explains the gap.

---

### Data Access Patterns

```ts
// ✅ Always via service layer:
import { lookupVocab } from '@/services/vocabService'   // returns VocabEntry | null
import { lookupKanji } from '@/services/kanjiService'   // returns KanjiEntry | null

// null = entry not found → caller handles (LookupState 'not-found' or omit KanjiBreakdown)
// LoaderError = infrastructure failure → propagates to error boundary
// These are distinct failure modes — never conflate them
```

---

### Error Handling Patterns

```
LoaderError('UNSUPPORTED_VERSION') → React Router ErrorBoundary → message + link to library
LoaderError('SCHEMA_INVALID')      → inline error below upload trigger + link to format spec
LoaderError('PARSE_FAILED')        → inline error below upload trigger
null from vocabService             → lookupState { status: 'not-found' } → "No entry for [word]"
null from kanjiService             → KanjiBreakdown section not rendered
```

---

### CSS / Styling Patterns

```tsx
// ✅ Tailwind utilities only:
<div className="bg-paper-bg text-paper-text p-4 rounded-md" />

// ✅ CSS custom properties for dynamic values only:
style={{ '--story-font-size': '1.25rem' } as React.CSSProperties}

// ❌ No custom CSS classes outside tailwind.config.ts token definitions
// ❌ No inline style={{ }} for anything other than CSS custom properties
```

---

### Import Patterns

```ts
// Cross-package — package name:
import { StoryModel, VocabEntry } from '@nihonnohon/schema'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'

// Intra-app — @/ alias:
import { WordToken } from '@/components/WordToken'
import { useLookupStore } from '@/stores/lookupStore'

// Path aliases defined in tsconfig.app.json AND vite.config.ts:
// "@/*" → ["./src/*"]
```

---

### Enforcement Guidelines

**All agents MUST:**
- Use `snake_case` for story JSON wire format; `camelCase` for TypeScript internal types
- Import `StoryModel`, `VocabEntry`, `KanjiEntry`, `LookupState` from `@nihonnohon/schema` — never redefine locally
- Distinguish `StoryModel.grammar: string[]` (descriptions) from `SentenceModel.grammar: number[]` (indices)
- Use `visibility: hidden` / `invisible` (never `display: none`) to hide `<rt>` elements
- Fire `onKeyDown` on both `Enter` AND `Space` for all word token handlers
- Apply `white-space: nowrap` to word token spans
- Return `null` from service functions for missing entries; throw `LoaderError` for infrastructure failures
- Call `afterEach(() => useLookupStore.getState()._reset())` in tests using the lookup store
- Call `beforeEach(() => localStorage.clear())` in tests using the preference store
- Place all async data fetching in React Router `loader` functions — not `useEffect`, not store actions
- Co-locate `__fixtures__/` directories with their test files

**Anti-patterns:**
```
❌ import from '../../packages/schema/src/types'       — use @nihonnohon/schema
❌ <rt style={{ display: 'none' }}>                    — use invisible (visibility: hidden)
❌ onKeyDown: e.key === 'Enter' only                   — Space is required
❌ StoryModel.grammar used as number[]                 — it is string[]; SentenceModel.grammar is number[]
❌ fetch inside useEffect for story data               — use React Router loader
❌ LookupState as { word: string | null, ... }         — use discriminated union
❌ import vocabData from '@/data/vocab.json'           — use vocabService
❌ creating re-export barrel index.ts files            — import source files directly
```

---

## Architecture Validation Results

### Validation Amendments Applied

The following were resolved during the final validation round:

**Scope amendments:**
- Vocabulary panel + grammar panel → **Milestone 2** (not M1). M1 is the minimum needed for RT to do reading practice: story renders, word tap → InfoPanel lookup, sentence selection, ruby + translation toggles, file upload.
- ToolBar restructured: ruby toggle + translation toggle remain in ToolBar; spacing toggle + text size controls move to a `SettingsMenu` component (Radix UI Popover, triggered by ⚙ icon). `preferenceStore` keys unchanged; only control placement changes. New component: `components/SettingsMenu.tsx`.
- `routes/CreditsRoute.tsx` added to project structure for FR36/NFR18 (Genki vocabulary source attribution).

**Portfolio quality defined concretely:**
- Clean code with comments where the WHY is non-obvious
- Well-functioning UI verified across the browser matrix
- Reasonable test coverage: unit tests on loaders, services, and store transitions; E2E golden path + critical error paths

**Technical contracts made explicit:**

*AJV CSP assumption:* AJV v8 uses `new Function()`, which is blocked by strict Content Security Policy. This architecture assumes no strict CSP is set on the Vercel deployment. If a CSP header is added later, migrate to AJV standalone pre-compiled validators (compile-time, not runtime).

*Package `exports` map — canonical shape for `packages/schema` and `packages/story-loader`:*
```json
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
    "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  }
}
```
`@nihonnohon/schema` must be in `dependencies` (not `devDependencies`) of `packages/story-loader` so tsup treats it as external. `moduleResolution: "bundler"` in all `tsconfig.json` files (TypeScript 5.x standard for Vite + tsup builds).

*Wire format transformation order:* AJV validates the snake_case wire format FIRST; transformation to camelCase `StoryModel` happens AFTER validation passes. Never validate a partially-transformed object.

*Supplement matching:* `vocabService` checks `StoryModel.vocabSupplement` by exact token string match — no morphological normalisation. Story authors and the AI authoring tool must key supplement entries using the exact token strings that appear in the `words` array.

*IndexedDB story-not-found error state:* When `/read/:uuid` is opened on a different device or after storage is cleared, the ReaderRoute loader finds nothing in IndexedDB and throws `LoaderError('PARSE_FAILED', ...)`. The ErrorBoundary renders: *"This story isn't available — it may have been loaded on another device or the data was cleared."* with a link back to the library.

---

### Coherence Validation ✅

All technology choices are mutually compatible. The dependency chain (`packages/schema` → `packages/story-loader` → `apps/web`) is directional with no cycles. Patterns align with stack decisions throughout. The AJV CSP assumption is documented. Wire format transformation order is specified. All naming conventions are internally consistent.

---

### Requirements Coverage ✅

**All 44 FRs architecturally supported:**

| Category | FRs | Status |
|---|---|---|
| Story Discovery | FR1–5 | ✅ LibraryRoute + StoryCard + DifficultyBadge + manifest.json |
| Story Loading | FR6–10 | ✅ ReaderRoute loader + indexedDbService + story-loader + LoaderError |
| Reading | FR11–14 | ✅ SentenceBlock + WordToken + lookupStore + vocabSupplement |
| Word Lookup | FR15–22 | ✅ InfoPanel (idle/found/not-found) + KanjiBreakdown + vocabService + kanjiService |
| Reading Aids | FR23–26 | ✅ ToolBar (ruby+trans) + SettingsMenu (spacing+size) + preferenceStore |
| Story Authoring Format | FR27–34, FR38–39 | ✅ story.v1.json + StoryModel (incl. audioUrl) + v1 loader |
| Application & Platform | FR35–37, FR40–44 | ✅ AppBar + responsive layout + CreditsRoute; vocab+grammar panels in M2 |

**All 18 NFRs architecturally supported:**

| NFR | Requirement | Architectural Support |
|---|---|---|
| NFR1 | Word lookup ≤100ms | O(1) Map lookup in vocabService; no network, no parsing at tap time |
| NFR2 | Toggle instant | CSS transitions; `visibility: hidden` preserves layout |
| NFR3 | Text size instant | CSS custom property `--story-font-size`; no re-render |
| NFR4 | File load ≤1s | AJV validation + StoryModel transform; well within target |
| NFR5 | Initial load optimised | Small static files fetched async; no large dictionary bundle |
| NFR6 | Functional once loaded | Static SPA; offline explicitly deferred to mobile iteration |
| NFR7 | WCAG 2.1 AA contrast | Design tokens verified; axe-core in Playwright suite |
| NFR8 | ≥3 text size settings | `small` / `medium` / `large` in `TEXT_SIZE_VALUES` |
| NFR9 | Escape dismisses panel | Documented in InfoPanel accessibility pattern |
| NFR10 | Keyboard scroll in panel | Documented in InfoPanel accessibility pattern |
| NFR11 | No colour-only states | Toggle uses colour + border; WordToken uses colour + border |
| NFR12 | Last 2 major browsers | Playwright: Chromium + Firefox + WebKit |
| NFR13 | Touch on iOS/Android | Playwright `devices['iPhone 14']`; touch events on WordToken |
| NFR14 | Single responsive layout | Tailwind `lg:` breakpoint; no separate mobile site |
| NFR15 | Contribution-ready | CONTRIBUTING.md; shared ESLint config; ADRs; clean structure |
| NFR16 | Test coverage | Vitest unit + Playwright E2E; co-located test files |
| NFR17 | Format versioned | `schema_version` + versioned loaders + SCHEMA_CHANGELOG.md |
| NFR18 | Dictionary attribution | CreditsRoute with Genki vocabulary source attribution |

---

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Portfolio quality target:**
- Clean code with comments where the WHY is non-obvious
- Well-functioning UI verified across the browser matrix
- Reasonable test coverage: unit tests on loaders, services, and store transitions; E2E golden path + critical error paths

**Key Strengths:**
- Clean unidirectional dependency graph; no cycles
- All 44 FRs and 18 NFRs architecturally supported
- Comprehensive implementation patterns with concrete examples and anti-patterns
- Story format versioning built in from day one with explicit migration contract
- Monorepo structured for planned future iterations without over-engineering v1
- Milestone 1 is genuinely minimal — RT can start using the app before M2 is complete

**Areas for Future Enhancement (deferred):**
- Vocabulary + grammar panels (M2)
- Audio playback (story format already accommodates `audioUrl`)
- Env/config package before `apps/api` development
- API contract (OpenAPI stub or `packages/api-client`) before backend iteration
- E2E fixture migration to `packages/fixtures/` before mobile iteration
- Per-app Vercel deploy configs when `apps/api` needs independent deployment

---

### Milestone Definitions

**Milestone 1 — Minimum Viable Reader:**
RT can sit down with one real Japanese story and do reading practice.

Required: file upload OR hardcoded story → reader view; SentenceBlock renders all sentences; WordToken tap → InfoPanel (idle/found/not-found); sentence selection highlight; ruby toggle; translation toggle; AppBar back link.

Not required for M1: story library UI, vocabulary panel, grammar panel, tab navigation (Story/Vocabulary/Grammar), SettingsMenu (spacing/size), two-column desktop layout, Credits.

**Milestone 2 — Full v1 Feature Surface:**
All 44 FRs complete: story library with difficulty filter, vocabulary + grammar panels, tab navigation (mobile) + two-column layout (desktop), SettingsMenu (spacing + text size), CreditsRoute, responsive layout verified across browser matrix.

**v1 Ship Condition:** Milestone 2 complete + 1 valid story from the AI authoring tool passes schema validation and renders correctly.

---

### Implementation Handoff

**First implementation story — Monorepo scaffold:**
```bash
npx create-turbo@latest nihonnohon   # select pnpm
cd nihonnohon
# scaffold apps/web, packages/schema, packages/story-loader
# wire pnpm-workspace.yaml, turbo.json, vercel.json
cd apps/web && npm create vite@latest . -- --template react-ts
npx shadcn@latest init
```

**AI Agent Guidelines:**
- This document is the single source of truth for all architectural questions
- Do not invent alternatives to documented decisions
- AJV validates snake_case wire format BEFORE transformation to camelCase StoryModel
- `packages/schema` and `packages/story-loader` must build (tsup) before `apps/web` Vite starts
- `turbo dev` is the only supported dev entrypoint — not `pnpm dev` in `apps/web` directly
- The schema version boundary is a contract — propose changes as a discussion, not a code change
- Supplement lookup uses exact token string matching — no morphological normalisation
- ToolBar: ruby toggle + translation toggle + settings icon (⚙) only
- SettingsMenu (Radix Popover): spacing toggle + text size controls
- Vocabulary and grammar panels are Milestone 2 — do not implement in M1 stories
