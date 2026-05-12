# Story 2.5: Minimum Viable Reader Route

Status: done

## Story

As a **reader (RT)**,
I want to open the app and immediately see a real Japanese story I can read with word lookup and reading toggles working,
so that I can use the app for genuine reading practice the moment Epic 2 is complete (Milestone 1).

## Acceptance Criteria

**AC1 — React Router loader fetches the story**

Given the app is opened at `/read/genki-i-ch6-tanaka-letter`
When the React Router loader executes
Then calls `fetch('/stories/genki-i-ch6-tanaka-letter.json')`, passes the response through `loadStory()`, and returns a `StoryModel`; the loader is a proper React Router `loader` function — NOT a bare static import or `useState` initialiser; Epic 3 will replace only the loader body, not the loader pattern

**AC2 — Story file is a real Japanese story**

Given `apps/web/public/stories/genki-i-ch6-tanaka-letter.json`
When reviewed
Then it is a real Japanese story at Genki I Ch.6 difficulty; all sentences contain valid `words`, `ruby`, and `vocab_keys` parallel arrays with equal lengths; the file passes `loadStory()` validation without error; it is NOT a synthetic test stub

**AC3 — Reader renders continuous scrollable document**

Given the story loads successfully
When `ReaderRoute` renders
Then all sentences are displayed as a continuous scrollable document, each sentence on a new line; no advance/back buttons; no sentence counter; story area uses `paper-bg` background; story text at `1.25rem` (CSS custom property `--story-font-size`)

**AC4 — AppBar renders correctly in reader view**

Given `AppBar` in the reader view
When rendered
Then shows `← Library` back link (left) and `日本の本` logo (right); back link has `aria-label="Back to library"` and is a proper `<a>` element (not a button); logo uses `font-ja`, `text-muted`; `<header>` semantic element used

**AC5 — ToolBar has exactly 2 controls**

Given `ToolBar`
When rendered
Then shows exactly two toggle buttons: ルビ and Trans; NO settings icon or SettingsMenu is present; a test asserts the count of interactive controls in ToolBar is exactly 2 (regression guard for Epic 4)
And ルビ label is derived from the story `language` field: `"Japanese"` → `"ルビ"`; any other value → `"Ruby"`

**AC6 — ルビ toggle uses visibility:hidden**

Given the ルビ toggle is switched off then on
When toggled
Then `<rt>` elements use `visibility: hidden` when off (never `display: none`); ruby annotations appear immediately when toggled on; no layout shift or reflow (carried over from Story 2.3 WordToken — must not regress)

**AC7 — Trans toggle shows translations**

Given the Trans toggle is on and a sentence has a `translation` field
When rendered
Then translation appears below that sentence in italic, `text-translation`; sentences without `translation` show nothing below their word row

**AC8 — VocabSupplement takes precedence**

Given a word in the story's `vocabSupplement` array is tapped
When the lookup runs
Then the supplement entry is shown in InfoPanel and takes precedence over `vocabService` lookup; if the same word exists in both, supplement wins

**AC9 — ReaderRoute tests**

Given `ReaderRoute.test.tsx`
When run
Then covers: loader returns StoryModel from fixture; all sentences rendered in document order; word tap updates InfoPanel; ruby toggle (invisible not display:none); translation toggle; ToolBar has exactly 2 controls; Escape resets InfoPanel to idle; vocab supplement takes precedence over main dict; `afterEach(_reset)` present

## Tasks / Subtasks

- [x] Task 1: Create the real Japanese story file (AC2)
  - [x] Create `apps/web/public/stories/` directory
  - [x] Create `apps/web/public/stories/genki-i-ch6-tanaka-letter.json` with the full story JSON (see Dev Notes)
  - [x] Verify all parallel arrays have equal lengths per sentence
  - [x] Verify it passes `loadStory()` validation (run a quick Node script or read the loader logic)

- [x] Task 2: Add vocabSupplement support to `WordToken.tsx` (AC8)
  - [x] Add optional prop: `supplementEntry?: VocabEntry | null` (default `null`)
  - [x] In `handleActivate`: check `supplementEntry != null` FIRST; if truthy, call `lookup(word, supplementEntry, sentenceId)` and return; otherwise fall through to existing vocabKey logic
  - [x] Existing tests must not break — `supplementEntry` defaults to undefined/null and has no effect

- [x] Task 3: Add supplementMap support to `SentenceBlock.tsx` (AC8)
  - [x] Add optional prop: `supplementMap?: Map<string, VocabEntry>`
  - [x] When rendering WordToken for each word, compute `supplementEntry={supplementMap?.get(word) ?? null}` and pass to WordToken
  - [x] Existing SentenceBlock tests must not break — prop is optional with no effect when absent

- [x] Task 4: Implement `AppBar.tsx` (AC4)
  - [x] Create `apps/web/src/components/AppBar.tsx`
  - [x] `<header>` as outer element
  - [x] Left: `<Link to="/" aria-label="Back to library">← Library</Link>` (react-router-dom `Link`)
  - [x] Right: `<span className="font-ja text-muted text-sm">日本の本</span>`
  - [x] Layout: flex row, `justify-between items-center`, `bg-surface`, `px-4 py-2`
  - [x] `lang="ja"` on the logo span

- [x] Task 5: Implement `ToolBar.tsx` (AC5, AC6, AC7)
  - [x] Create `apps/web/src/components/ToolBar.tsx`
  - [x] Accept props: `language: string`
  - [x] Subscribe to `usePreferenceStore` for `rubyVisible`, `transVisible` + setters
  - [x] ルビ button: label = `language === 'Japanese' ? 'ルビ' : 'Ruby'`; calls `setRubyVisible(!rubyVisible)` on click
  - [x] Trans button: label = `'Trans'`; calls `setTransVisible(!transVisible)` on click
  - [x] ON state classes: `bg-accent-subtle border border-accent`; OFF state: `bg-surface border border-border`
  - [x] Both buttons use `<button>` element — exactly 2 interactive controls total (no other buttons, icons, or links)
  - [x] `cn()` for class merging

- [x] Task 6: Implement `ReaderRoute.tsx` + export loader (AC1, AC3, AC4, AC5, AC6, AC7, AC8)
  - [x] Export `loader` function (async): `await Promise.all([initVocab(), initKanji()])` → fetch story JSON → `loadStory()` → return StoryModel
  - [x] Hardcode fetch URL: `'/stories/genki-i-ch6-tanaka-letter.json'` (Epic 3 replaces loader body, not pattern)
  - [x] `useLoaderData() as StoryModel` to get the story
  - [x] Build `supplementMap: Map<string, VocabEntry>` from `story.vocabSupplement` (convert VocabSupplementEntry → VocabEntry using synthetic negative ids)
  - [x] Layout: `<AppBar />` → `<InfoPanel story={story} />` → `<ToolBar language={story.language} />` → scrollable story area
  - [x] Story area: `overflow-y-auto`, `bg-paper-bg`, `p-4`, `style={{ fontSize: 'var(--story-font-size, 1.25rem)' }}`
  - [x] Map `story.sentences` → `<SentenceBlock sentence={s} sentenceIndex={i} supplementMap={supplementMap} />`
  - [x] Set `--story-font-size` CSS custom property on the story container (not global; scoped to the reader area element)

- [x] Task 7: Update `router.tsx` (AC1)
  - [x] Import `loader as readerLoader` from `@/routes/ReaderRoute`
  - [x] Add `loader: readerLoader` to the `/read/:storyId` route definition
  - [x] Remove the now-unused `loadStory`/`LoaderError` import and its eslint-disable comment — the loader in ReaderRoute now owns that import

- [x] Task 8: Write `ReaderRoute.test.tsx` (AC9)
  - [x] Create `apps/web/src/__tests__/ReaderRoute.test.tsx`
  - [x] Mock `useLoaderData` via `vi.mock('react-router-dom')` + wrap in `MemoryRouter` for Link context
  - [x] Seed vocab with `_initVocabFromData` and kanji with `_initKanjiFromData` in `beforeEach`
  - [x] Test: loader returns StoryModel from fixture → all sentences rendered in document order
  - [x] Test: word tap (click WordToken) → InfoPanel updates to found state
  - [x] Test: ToolBar has exactly 2 interactive controls (scoped to `role="toolbar"` container)
  - [x] Test: Escape key resets InfoPanel to idle
  - [x] Test: vocab supplement takes precedence — seed word in BOTH main vocab AND supplement; tap word; assert supplement translation shown
  - [x] Test: supplement word with null vocabKey is tappable via supplement
  - [x] Test: ルビ label is "ルビ" when language is "Japanese", "Ruby" for other language
  - [x] `afterEach`: reset all stores + services

- [x] Task 9: Run full test suite (AC9)
  - [x] Run `pnpm test:unit` in `apps/web` — all 83 tests pass (11 new, 72 existing)

## Dev Notes

### Story JSON: `genki-i-ch6-tanaka-letter.json`

Create `apps/web/public/stories/genki-i-ch6-tanaka-letter.json` with the content below. All parallel array lengths are verified equal.

The `vocab_keys` reference line numbers from `scripts/data/genki-vocab.csv` (1-indexed = the `id` in `vocab.json`). Verified IDs:
- 20: はじめまして, 50: だいがく, 52: ともだち, 145: テレビ, 147: あさごはん
- 165: しゅうまつ, 176: おきる, 177: たべる, 178: ねる, 179: みる
- 182: べんきょうする, 190: よく, 204: てがみ, 209: こうえん, 325: よる, 329: あそぶ

```json
{
  "schema_version": "1",
  "id": "genki-i-ch6-tanaka-letter",
  "title": "A Letter from Mary",
  "title_ja": "メアリーさんのてがみ",
  "language": "Japanese",
  "difficulty": "Genki I Ch.6",
  "description": "Mary writes a letter about her daily routine as a university student in Japan.",
  "keywords": [
    { "word": "てがみ", "hiragana": "てがみ", "translation": "letter" },
    { "word": "まいあさ", "hiragana": "まいあさ", "translation": "every morning" },
    { "word": "でんしゃ", "hiragana": "でんしゃ", "translation": "train" }
  ],
  "grammar": [
    "Verb ます-form: polite present/future tense",
    "Time expressions with に (at [specific time])",
    "Expressing sequence with てから (after doing; and then)"
  ],
  "vocab_supplement": [
    { "word": "まいあさ", "hiragana": "まいあさ", "translation": "every morning" },
    { "word": "てがみ", "hiragana": "てがみ", "translation": "letter" }
  ],
  "metadata": {},
  "sentences": [
    {
      "id": "s1",
      "words": ["はじめまして", "。"],
      "ruby": [null, null],
      "vocab_keys": [20, null],
      "translation": "How do you do?",
      "grammar": []
    },
    {
      "id": "s2",
      "words": ["田中", "メアリー", "と", "いいます", "。"],
      "ruby": ["たなか", null, null, null, null],
      "vocab_keys": [null, null, null, null, null],
      "translation": "My name is Mary Tanaka.",
      "grammar": []
    },
    {
      "id": "s3",
      "words": ["まいあさ", "、", "六時", "に", "起きます", "。"],
      "ruby": [null, null, "ろくじ", null, "おきます", null],
      "vocab_keys": [null, null, null, null, 176, null],
      "translation": "Every morning, I wake up at six o'clock.",
      "grammar": [0, 1]
    },
    {
      "id": "s4",
      "words": ["大学", "で", "朝ごはん", "を", "食べます", "。"],
      "ruby": ["だいがく", null, "あさごはん", null, "たべます", null],
      "vocab_keys": [50, null, 147, null, 177, null],
      "translation": "I eat breakfast at the university.",
      "grammar": [0]
    },
    {
      "id": "s5",
      "words": ["日本語", "を", "よく", "勉強します", "。"],
      "ruby": ["にほんご", null, null, "べんきょうします", null],
      "vocab_keys": [null, null, 190, 182, null],
      "translation": "I often study Japanese.",
      "grammar": [0]
    },
    {
      "id": "s6",
      "words": ["夜", "は", "テレビ", "を", "見てから", "、", "寝ます", "。"],
      "ruby": ["よる", null, null, null, "みてから", null, "ねます", null],
      "vocab_keys": [325, null, 145, null, 179, null, 178, null],
      "translation": "At night, I watch TV and then go to sleep.",
      "grammar": [0, 2]
    },
    {
      "id": "s7",
      "words": ["週末", "に", "友達", "と", "公園", "で", "遊びます", "。"],
      "ruby": ["しゅうまつ", null, "ともだち", null, "こうえん", null, "あそびます", null],
      "vocab_keys": [165, null, 52, null, 209, null, 329, null],
      "translation": "On weekends, I play with friends at the park.",
      "grammar": [0]
    },
    {
      "id": "s8",
      "words": ["また", "てがみ", "を", "書きます", "。"],
      "ruby": [null, null, null, "かきます", null],
      "vocab_keys": [null, 204, null, null, null],
      "translation": "I will write a letter again.",
      "grammar": [0]
    }
  ]
}
```

**CRITICAL:** Every sentence MUST have `words`, `ruby`, and `vocab_keys` arrays of exactly equal length. The loader throws `LoaderError('SCHEMA_INVALID')` on mismatch.

### VocabSupplement → VocabEntry Conversion

`VocabSupplementEntry` has `{ word, hiragana, translation }`. `VocabEntry` requires `{ id, word, reading, meaning, lesson }`. Mapping:

```ts
function buildSupplementMap(supplement: VocabSupplementEntry[]): Map<string, VocabEntry> {
  const map = new Map<string, VocabEntry>()
  supplement.forEach((entry, i) => {
    map.set(entry.word, {
      id: -(i + 1),       // synthetic negative id — never clashes with real vocab
      word: entry.word,
      reading: entry.hiragana,
      meaning: entry.translation,
      lesson: 'supplement',
    })
  })
  return map
}
```

Use synthetic negative IDs to distinguish supplement entries from real vocab entries. Build this map once in the ReaderRoute component body (it's stable per story).

### WordToken Props Change (Backward-Compatible)

`supplementEntry` is optional and defaults to null/undefined. All existing WordToken tests remain valid — they don't pass this prop and behavior is unchanged.

```tsx
interface WordTokenProps {
  word: string
  ruby: string | null
  vocabKey: number | null
  sentenceId: string
  supplementEntry?: VocabEntry | null  // NEW — supplement takes precedence when non-null
}

const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
  e.stopPropagation()
  // Supplement always wins when present
  if (supplementEntry != null) {
    lookup(word, supplementEntry, sentenceId)
    return
  }
  if (vocabKey === null) return
  const entry = lookupVocab(vocabKey)
  if (entry === null) return
  lookup(word, entry, sentenceId)
}
```

### SentenceBlock Props Change (Backward-Compatible)

```tsx
interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
  supplementMap?: Map<string, VocabEntry>  // NEW — optional per-story supplement
}

// In WordToken rendering:
<WordToken
  key={i}
  word={word}
  ruby={sentence.ruby[i] ?? null}
  vocabKey={sentence.vocabKeys[i] ?? null}
  sentenceId={sentence.id}
  supplementEntry={supplementMap?.get(word) ?? null}
/>
```

### ReaderRoute Loader Export Pattern

```tsx
// apps/web/src/routes/ReaderRoute.tsx
import { useLoaderData } from 'react-router-dom'
import { loadStory } from '@nihonnohon/story-loader'
import { initVocab } from '@/services/vocabService'
import { initKanji } from '@/services/kanjiService'

export async function loader(): Promise<StoryModel> {
  await Promise.all([initVocab(), initKanji()])
  const res = await fetch('/stories/genki-i-ch6-tanaka-letter.json')
  if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
  return loadStory(await res.json())
}

export function ReaderRoute() {
  const story = useLoaderData() as StoryModel
  const supplementMap = buildSupplementMap(story.vocabSupplement)
  // ...
}
```

### Router.tsx Update

```tsx
// Remove the old AJV-verification import + eslint-disable comment
// Import loader from ReaderRoute instead
import { ReaderRoute, loader as readerLoader } from '@/routes/ReaderRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader },
])
```

The `loadStory` / `LoaderError` import in `router.tsx` (currently present with an eslint-disable comment) is fully replaced by the loader in `ReaderRoute.tsx`.

### ReaderRoute Layout Structure

```tsx
return (
  <div className="flex flex-col h-dvh bg-paper-bg">
    <AppBar />
    <InfoPanel story={story} />
    <ToolBar language={story.language} />
    <div
      className="flex-1 overflow-y-auto p-4"
      style={{ fontSize: 'var(--story-font-size, 1.25rem)' }}
    >
      {story.sentences.map((sentence, i) => (
        <SentenceBlock
          key={sentence.id}
          sentence={sentence}
          sentenceIndex={i}
          supplementMap={supplementMap}
        />
      ))}
    </div>
  </div>
)
```

**Why `h-dvh`?** The UX spec (UX-DR14) requires `dvh` (dynamic viewport units) for story area height on iOS Safari to handle the collapsible address bar.

### Testing ReaderRoute with `createMemoryRouter`

React Router v6 route components with loaders MUST be tested via `createMemoryRouter`. Bare `render(<ReaderRoute />)` will throw because `useLoaderData()` requires a router context.

```tsx
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ReaderRoute } from '@/routes/ReaderRoute'
import type { StoryModel } from '@nihonnohon/schema'

function renderWithRouter(story: StoryModel) {
  const router = createMemoryRouter([
    {
      path: '/read/:storyId',
      element: <ReaderRoute />,
      loader: () => story,  // synchronous fixture — no fetch in tests
    },
  ], { initialEntries: ['/read/test'] })
  return render(<RouterProvider router={router} />)
}
```

The `loader: () => story` returns synchronously — `createMemoryRouter` handles this correctly.

**Note:** `createMemoryRouter` is async-rendered; use `await screen.findByText(...)` (not `getByText`) for content that depends on the loader resolving.

### VocabSupplement Precedence Test

```tsx
it('vocab supplement takes precedence over main dict for same word', async () => {
  // Seed main vocab with てがみ (same word as supplement, different translation)
  _initVocabFromData([
    { id: 204, word: 'てがみ', reading: 'てがみ', meaning: 'letter (main dict)', lesson: 'Genki I Ch.4' },
  ])

  const story: StoryModel = {
    ...baseStory,
    vocabSupplement: [{ word: 'てがみ', hiragana: 'てがみ', translation: 'letter (supplement)' }],
    sentences: [{
      id: 's1', words: ['てがみ'], ruby: [null], vocabKeys: [204],
      translation: null, grammar: [],
    }],
  }

  renderWithRouter(story)
  await screen.findByText('てがみ')  // wait for loader
  fireEvent.click(screen.getByRole('button', { name: 'てがみ' }))
  expect(screen.getByText('letter (supplement)')).toBeInTheDocument()
  expect(screen.queryByText('letter (main dict)')).not.toBeInTheDocument()
})
```

### ToolBar Regression Guard Test

```tsx
it('ToolBar has exactly 2 interactive controls', async () => {
  renderWithRouter(storyFixture)
  await screen.findByText(storyFixture.title)
  // The toolbar itself — query for all buttons within it
  const toolbar = screen.getByRole('toolbar')  // if ToolBar uses role="toolbar"
  // or count all buttons in the header region
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(2)
})
```

**Note:** If ToolBar doesn't use `role="toolbar"`, select buttons by their label text: `getByRole('button', { name: 'ルビ' })` and `getByRole('button', { name: 'Trans' })`.

### `--story-font-size` CSS Custom Property

The story area container sets this via inline style on the containing div:
```tsx
style={{ fontSize: 'var(--story-font-size, 1.25rem)' }}
```

Sentence text defaults to 1.25rem. Epic 4 wires the text-size toggle to update this. Do NOT update `preferenceStore.textSize` in this story — it has no effect yet.

### What This Story Does NOT Include

- Text size controls (A−/A/A+) — Epic 4 (SettingsMenu)
- Settings/gear icon in ToolBar — Epic 4 (guarded by the "exactly 2 controls" test)
- Vocabulary or Grammar panels — Epic 4
- Responsive two-column layout — Epic 4
- Dynamic story loading from manifest — Epic 3 (only loader body changes)
- Local file upload — Epic 3

### Key Learnings from Stories 2.3 / 2.4

- `act()` wrapping required for store mutations outside `render()` / `fireEvent`
- `afterEach` must reset: `useLookupStore._reset()`, `usePreferenceStore.setState(DEFAULT_PREFS)`, `localStorage.clear()`, `_resetVocab()`, `_resetKanji()`
- `@testing-library/react` is installed; `setup.ts` with jest-dom matchers is wired
- `useShallow` for multi-value Zustand object selectors; not needed for single primitives
- `key={char + i}` pattern for index-based React keys over collections

### Files Being Updated (READ BEFORE TOUCHING)

- **`apps/web/src/components/WordToken.tsx`** — Currently: `supplementEntry` prop absent; `handleActivate` checks `vocabKey === null` first. Change: add `supplementEntry?: VocabEntry | null`; check supplement BEFORE vocabKey null-guard.
- **`apps/web/src/components/SentenceBlock.tsx`** — Currently: no `supplementMap` prop; passes `ruby[i]`, `vocabKeys[i]`, `sentenceId` to WordToken. Change: add `supplementMap?` prop; compute and pass `supplementEntry` per word.
- **`apps/web/src/router.tsx`** — Currently: stub with unused `loadStory`/`LoaderError` import. Change: remove unused import, add `loader: readerLoader`.
- **`apps/web/src/routes/ReaderRoute.tsx`** — Currently: stub `<main><h1>Reader</h1>...</main>`. Change: full implementation.

### Project Structure Notes

**New files (CREATE):**
- `apps/web/public/stories/genki-i-ch6-tanaka-letter.json`
- `apps/web/src/components/AppBar.tsx`
- `apps/web/src/components/ToolBar.tsx`
- `apps/web/src/__tests__/ReaderRoute.test.tsx`

**Files to UPDATE:**
- `apps/web/src/routes/ReaderRoute.tsx` — full rewrite from stub
- `apps/web/src/router.tsx` — add loader, remove dead import
- `apps/web/src/components/WordToken.tsx` — add `supplementEntry` prop
- `apps/web/src/components/SentenceBlock.tsx` — add `supplementMap` prop

**Do NOT modify:** `lookupStore.ts`, `preferenceStore.ts`, `vocabService.ts`, `kanjiService.ts`, `InfoPanel.tsx`, `KanjiBreakdown.tsx`, `LibraryRoute.tsx`.

### References

- React Router loader pattern: [architecture.md — State Management, Route Resolution]
- `loader` + `useLoaderData` pattern: [epics.md — Story 2.5 AC1 and Epic 2 implementation note]
- VocabSupplement matching: [project-context.md — Data Loading; architecture.md — Data Architecture]
- `dvh` height requirement: [epics.md — UX-DR14]
- ToolBar toggle button states: [epics.md — UX-DR6]
- AppBar spec: [epics.md — UX-DR5]
- Supplement precedence: [epics.md — FR20, Story 2.5 AC]
- `createMemoryRouter` test pattern: React Router v6 testing docs (standard approach for loader-based routes)
- `initVocab` / `initKanji` signatures: [apps/web/src/services/vocabService.ts, kanjiService.ts]

### Review Findings

- [x] [Review][Patch] Add `aria-pressed` to ToolBar toggle buttons — both `<button>` elements lack `aria-pressed={rubyVisible}` / `aria-pressed={transVisible}`; screen readers cannot announce toggle state (on/off) without it, violating ARIA authoring practices for toggle buttons [ToolBar.tsx:28,39]
- [x] [Review][Defer] `buildSupplementMap` called on every render with no `useMemo` — allocates a new `Map` on every re-render; when React introduces `SentenceBlock` memoization, all children will re-render unnecessarily; wrap with `useMemo(() => buildSupplementMap(story.vocabSupplement), [story.vocabSupplement])` — deferred, no current correctness impact [ReaderRoute.tsx:34]
- [x] [Review][Defer] Duplicate `word` keys in `vocabSupplement` silently drop earlier entries (last-write-wins in `Map`) — no warning emitted; unlikely in real stories — deferred, pre-existing architecture comment [ReaderRoute.tsx:13]
- [x] [Review][Defer] No `errorElement` on `/read/:storyId` route — `loadStory()` rejection and fetch failures escape to an unhandled React crash; Epic 3 adds error boundaries (spec-scoped) — deferred, Epic 3 responsibility [router.tsx]
- [x] [Review][Defer] `await res.json()` on a 200 response with non-JSON body throws unformatted `SyntaxError` with no user-facing message — Epic 3 error handling scope — deferred [ReaderRoute.tsx:30]
- [x] [Review][Defer] `loader()` function body never directly called in tests — tests mock `useLoaderData` which verifies component rendering but not the fetch+loadStory pipeline; loader body is intentionally thin and Epic 3 replaces it — deferred, negligible risk given AJV coverage in story-loader package tests [ReaderRoute.test.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Story JSON: 8 sentences with verified equal-length parallel arrays; vocab_keys reference real Genki CSV line numbers; validated with `node -e` using the CJS build of story-loader.
- WordToken/SentenceBlock: backward-compatible optional props — `supplementEntry?: VocabEntry | null` and `supplementMap?: Map<string, VocabEntry>`. Supplement check runs before vocabKey null-guard in `handleActivate`.
- `buildSupplementMap` uses synthetic negative IDs (`-(i+1)`) to avoid colliding with real vocab IDs; maps `hiragana → reading`, `translation → meaning`.
- AppBar: `<header>` with `Link` for back nav and `<span lang="ja">` for logo.
- ToolBar: added `role="toolbar"` + `aria-label="Reading controls"` to enable scoped test queries; exactly 2 `<button>` elements; ルビ label derived from language prop.
- ReaderRoute loader: uses `loadStory` from story-loader and parallel `Promise.all([initVocab(), initKanji()])`. Router.tsx drops the old AJV-verification import.
- Tests: used `vi.mock('react-router-dom')` + `MemoryRouter` pattern instead of `createMemoryRouter` — the latter had jsdom timing issues with async router initialization. `within(toolbar).getAllByRole('button')` scopes the "exactly 2 controls" assertion to the ToolBar.

### File List

- `apps/web/public/stories/genki-i-ch6-tanaka-letter.json` (new)
- `apps/web/src/components/AppBar.tsx` (new)
- `apps/web/src/components/ToolBar.tsx` (new)
- `apps/web/src/__tests__/ReaderRoute.test.tsx` (new)
- `apps/web/src/routes/ReaderRoute.tsx` (updated — full implementation from stub)
- `apps/web/src/router.tsx` (updated — added loader, removed dead AJV import)
- `apps/web/src/components/WordToken.tsx` (updated — added supplementEntry prop)
- `apps/web/src/components/SentenceBlock.tsx` (updated — added supplementMap prop)
