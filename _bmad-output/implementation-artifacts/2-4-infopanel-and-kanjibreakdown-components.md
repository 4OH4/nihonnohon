# Story 2.4: InfoPanel & KanjiBreakdown Components

Status: done

## Story

As a **reader**,
I want a persistent panel at the top of the reader that shows story context at rest and word lookup results instantly on tap,
so that looking up a word never moves or obscures the text I'm reading.

## Acceptance Criteria

**AC1 — InfoPanel idle state**

Given no word has been tapped (`lookupState.status === 'idle'`)
When `InfoPanel` renders
Then displays story title, difficulty label (blank/omitted if absent), and language; panel is never blank or hidden; fixed height ~110–140px; `overflow-y: auto`

**AC2 — InfoPanel found state**

Given `lookupState.status === 'found'`
When `InfoPanel` renders
Then shows: selected word in Japanese (Noto Sans JP, `lang="ja"`), English translation at `text-[1.125rem]`, hiragana reading at `text-[0.875rem]`, and `KanjiBreakdown` row; content swap is immediate — no animation or transition delay

**AC3 — InfoPanel not-found state**

Given `lookupState.status === 'not-found'`
When `InfoPanel` renders
Then shows `"No entry for [word]"` in `muted` colour; no error styling, no icon; panel height unchanged; informational tone, not an error

**AC4 — InfoPanel accessibility**

Given `InfoPanel`
When rendered
Then has `aria-live="polite"` and `aria-label="Word lookup panel"` on the panel container

**AC5 — Escape key resets to idle**

Given the Escape key is pressed anywhere on the document
When the key event fires
Then `useLookupStore.reset()` is called; `lookupState` returns to `{ status: 'idle' }`; panel displays story context again

**AC6 — KanjiBreakdown found with kanji**

Given a looked-up word containing kanji characters (e.g. `食べ`)
When `KanjiBreakdown` renders
Then displays a horizontal row; each kanji character that has a `KanjiEntry` shows the character large above its `kw` (Heisig keyword) label small below; hiragana and katakana characters are skipped silently; at most 4–5 kanji items visible before horizontal scroll within the row

**AC7 — KanjiBreakdown no kanji**

Given a looked-up word with no kanji (e.g. `たべる`) — meaning `lookupKanji` returns `null` for every character
When `KanjiBreakdown` renders
Then the component renders nothing (null); no empty row or placeholder is shown

**AC8 — Tests**

Given `InfoPanel.test.tsx` and `KanjiBreakdown.test.tsx`
When run
Then cover: idle state shows story title/difficulty/language; not-found state shows muted "No entry for" message; found state with kanji word shows KanjiBreakdown; found state with hiragana-only word renders no KanjiBreakdown; Escape resets to idle; aria-live and aria-label present; `afterEach(_reset)` present

## Tasks / Subtasks

- [x] Task 1: Implement `KanjiBreakdown.tsx` (AC6, AC7)
  - [x] Create `apps/web/src/components/KanjiBreakdown.tsx`
  - [x] Accept `word: string` prop
  - [x] Split word into individual characters with `[...word]`
  - [x] Call `lookupKanji(char)` for each character; collect non-null results
  - [x] If no entries, return `null` (render nothing)
  - [x] Render a horizontal flex row with `overflow-x-auto`; each item: kanji char large on top, `kw` label small below
  - [x] Handle `kw === null` gracefully — show `entry.m[0]` as fallback, or omit the label (do not throw)
  - [x] `lang="ja"` on each kanji character element
  - [x] Limit visible items to 4–5 via container width + overflow scroll (not by slicing the array)

- [x] Task 2: Write `KanjiBreakdown.test.tsx` (AC6, AC7, AC8)
  - [x] Create `apps/web/src/__tests__/KanjiBreakdown.test.tsx`
  - [x] Seed `_initKanjiFromData` in `beforeEach`; call `_resetKanji` in `afterEach`
  - [x] Test: kanji word renders each char with kw label
  - [x] Test: hiragana-only word renders nothing (component returns null)
  - [x] Test: mixed word (e.g. `食べる`) renders only kanji chars present in the map, skips hiragana
  - [x] Test: char with `kw === null` renders without crashing (fallback or no label)

- [x] Task 3: Implement `InfoPanel.tsx` (AC1–AC5)
  - [x] Create `apps/web/src/components/InfoPanel.tsx`
  - [x] Accept `story: StoryModel` prop (needed for idle state title/difficulty/language)
  - [x] Subscribe to `useLookupStore` for `lookupState`
  - [x] Outer container: fixed height class (e.g. `min-h-[110px] max-h-[140px]`), `overflow-y: auto`, `bg-surface`, `aria-live="polite"`, `aria-label="Word lookup panel"`
  - [x] Idle branch: render story title, difficulty (omit if null), language
  - [x] Found branch: word (`font-ja lang="ja"`), translation (`text-[1.125rem]`), reading (`text-[0.875rem]`), `<KanjiBreakdown word={lookupState.word} />`
  - [x] Not-found branch: `"No entry for {word}"` with `text-muted`
  - [x] `useEffect` for Escape listener: `document.addEventListener('keydown', handler)` → call `reset()` on `Escape`; cleanup on unmount

- [x] Task 4: Write `InfoPanel.test.tsx` (AC1–AC5, AC8)
  - [x] Create `apps/web/src/__tests__/InfoPanel.test.tsx`
  - [x] Build a `storyFixture: StoryModel` for tests
  - [x] Seed `_initKanjiFromData` so KanjiBreakdown renders in found-with-kanji tests
  - [x] Test: idle state renders story title, difficulty, and language
  - [x] Test: idle state renders without difficulty when `story.difficulty === null`
  - [x] Test: found state with kanji word renders translation and KanjiBreakdown (char present)
  - [x] Test: found state with hiragana-only word renders translation but no KanjiBreakdown content
  - [x] Test: not-found state shows muted "No entry for" message
  - [x] Test: panel has `aria-live="polite"` and `aria-label="Word lookup panel"`
  - [x] Test: pressing Escape resets to idle (simulate `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  - [x] `afterEach` resets lookupStore and preferenceStore; `_resetKanji()`

- [x] Task 5: Verify tests pass
  - [x] Run `pnpm test:unit` in `apps/web` — all tests pass including existing 54 tests from Stories 2.1/2.2/2.3

## Dev Notes

### Component Props

**`KanjiBreakdown`** receives a single `word: string` prop and handles all kanji extraction internally. Do not pass a `KanjiEntry[]` — the component owns the lookup call.

**`InfoPanel`** receives `story: StoryModel` for idle-state metadata. It reads `lookupState` directly from `useLookupStore` — no prop for lookup state.

```tsx
// KanjiBreakdown.tsx — prop shape
interface KanjiBreakdownProps { word: string }

// InfoPanel.tsx — prop shape
interface InfoPanelProps { story: StoryModel }
```

### KanjiBreakdown Implementation

Split the word string into individual Unicode characters using the spread operator (handles multi-byte chars correctly):

```tsx
import { lookupKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

export function KanjiBreakdown({ word }: KanjiBreakdownProps) {
  const entries: { char: string; entry: KanjiEntry }[] = [...word]
    .map((char) => ({ char, entry: lookupKanji(char) }))
    .filter((x): x is { char: string; entry: KanjiEntry } => x.entry !== null)

  if (entries.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto">
      {entries.map(({ char, entry }) => (
        <div key={char} className="flex flex-col items-center shrink-0">
          <span className="font-ja text-xl" lang="ja">{char}</span>
          <span className="text-xs text-muted">{entry.kw ?? entry.m[0] ?? ''}</span>
        </div>
      ))}
    </div>
  )
}
```

**`kw` can be `null`** — fall back to `entry.m[0]` or empty string. Do not crash or skip the entry.

**Do NOT deduplicate characters** — if a word contains the same kanji twice, show it twice. The horizontal scroll handles overflow naturally.

### InfoPanel Implementation

```tsx
import { useEffect } from 'react'
import { useLookupStore } from '@/stores/lookupStore'
import { KanjiBreakdown } from '@/components/KanjiBreakdown'
import type { StoryModel } from '@nihonnohon/schema'

export function InfoPanel({ story }: InfoPanelProps) {
  const lookupState = useLookupStore((s) => s.lookupState)
  const reset = useLookupStore((s) => s.reset)

  // Escape key → return to idle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') reset() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [reset])

  return (
    <div
      className="min-h-[110px] max-h-[140px] overflow-y-auto bg-surface px-4 py-3"
      aria-live="polite"
      aria-label="Word lookup panel"
    >
      {lookupState.status === 'idle' && (
        // idle branch: title, difficulty (if present), language
      )}
      {lookupState.status === 'found' && (
        // found branch: word, translation, reading, KanjiBreakdown
      )}
      {lookupState.status === 'not-found' && (
        // not-found branch: muted "No entry for {word}"
      )}
    </div>
  )
}
```

**Key constraint:** `aria-live="polite"` and `aria-label` must be on the **same outer container element**, not on inner branches. The container must always be rendered (never conditionally mounted) so the ARIA live region is established before any lookup occurs.

**No animation between states** — just conditional rendering of the three branches within the fixed-height container.

### Escape Key Testing

The Escape listener is attached to `document` via `useEffect`. In tests:

```tsx
import { act } from '@testing-library/react'

it('Escape key resets to idle', () => {
  // Put store into found state first
  act(() => {
    useLookupStore.getState().lookup('食べる', vocabEntryFixture, 's1')
  })
  render(<InfoPanel story={storyFixture} />)
  // Dispatch keydown on document
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
  expect(useLookupStore.getState().lookupState.status).toBe('idle')
})
```

### StoryModel Fixture for Tests

```ts
import type { StoryModel } from '@nihonnohon/schema'

const storyFixture: StoryModel = {
  schemaVersion: '1',
  id: 'test-story',
  title: 'Test Story',
  titleJa: 'テスト',
  language: 'Japanese',
  difficulty: 'Genki I Ch.6',
  description: 'A test story.',
  keywords: [],
  grammar: [],
  vocabSupplement: [],
  sentences: [],
  metadata: {},
}
```

Include a `difficulty: null` variant for the "no difficulty" test case.

### VocabEntry + KanjiEntry Fixtures for Tests

```ts
import type { VocabEntry, KanjiEntry } from '@nihonnohon/schema'

const vocabFixture: VocabEntry = {
  id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3',
}

// Kanji data fixture — only the kanji chars in the word need entries
const kanjiFixture: Record<string, KanjiEntry> = {
  '食': { char: '食', kw: 'eat', m: ['eat', 'food'], onY: ['ショク'], kunY: ['た.べる'] },
}
```

For hiragana-only lookup tests, seed kanji data with an empty object `{}`.

### Test Reset Pattern

```ts
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _resetKanji } from '@/services/kanjiService'

const DEFAULT_PREFS = {
  rubyVisible: true, spacingVisible: false, transVisible: false,
  textSize: 'medium' as const, activeTab: 'story' as const,
}

afterEach(() => {
  act(() => {
    useLookupStore.getState()._reset()
    usePreferenceStore.setState(DEFAULT_PREFS)
  })
  localStorage.clear()
  _resetKanji()
})
```

### Design Token Reference

| Token | Value | Use |
|---|---|---|
| `bg-surface` | #FFFFFF | InfoPanel background |
| `text-muted` | #6B6B6B | Not-found message, kanji label |
| `paper-text` | #1C1C1C | Default text |
| `font-ja` | Noto Sans JP | All Japanese text |

Translation font size: `text-[1.125rem]`
Hiragana reading font size: `text-[0.875rem]`
Kanji character size: `text-xl` (1.25rem)
Kanji label size: `text-xs` (0.75rem)

### KanjiEntry Field Usage in KanjiBreakdown

- `entry.kw` → short Heisig keyword shown **as the label** below the character in KanjiBreakdown
- `entry.m` → full meanings array shown in a future detail drill-down (NOT in this story)
- `entry.char`, `entry.onY`, `entry.kunY` → not displayed in this story's components

**Do not show `entry.m` in KanjiBreakdown** — only `entry.kw` (with `entry.m[0]` as null-fallback).

### What This Story Does NOT Include

- Wiring InfoPanel into `ReaderRoute` — that is Story 2.5
- `AppBar`, `ToolBar` — Story 2.5
- Vocab supplement precedence logic — Story 2.5
- Text size CSS property (`--story-font-size`) — Epic 4
- Kanji detail drill-down view — deferred post-v1

### Key Learnings from Story 2.3

- Wrap store state mutations in `act()` when done outside `render()` / `fireEvent` to avoid React re-render warnings
- Use `_initVocabFromData` / `_resetVocab` pattern — apply same pattern with `_initKanjiFromData` / `_resetKanji` for kanji tests
- `import { useShallow } from 'zustand/react/shallow'` for multi-value Zustand selectors; single-primitive selectors need no `useShallow`
- `@testing-library/react` is installed; `setup.ts` with jest-dom matchers is wired in `vite.config.ts`

### Project Structure Notes

**New files (CREATE):**
- `apps/web/src/components/InfoPanel.tsx`
- `apps/web/src/components/KanjiBreakdown.tsx`
- `apps/web/src/__tests__/InfoPanel.test.tsx`
- `apps/web/src/__tests__/KanjiBreakdown.test.tsx`

**Do NOT modify:** stores, services, `WordToken.tsx`, `SentenceBlock.tsx`, `router.tsx`, `ReaderRoute.tsx`, `vite.config.ts`, `package.json`.

### References

- InfoPanel ARIA + layout spec: [epics.md — Story 2.4 AC, UX-DR1]
- KanjiBreakdown layout spec: [epics.md — UX-DR3]
- `KanjiEntry` type (kw, m fields): [packages/schema/src/types.ts]
- `KanjiEntry.kw` vs `KanjiEntry.m` usage rule: [project-context.md — Language-Specific Rules]
- `lookupKanji` / `_initKanjiFromData` / `_resetKanji`: [apps/web/src/services/kanjiService.ts]
- `useLookupStore.reset()` vs `_reset()`: [apps/web/src/stores/lookupStore.ts]
- Design tokens: [apps/web/tailwind.config.ts and project-context.md — Styling (Tailwind + shadcn/ui)]
- Test reset pattern: [apps/web/src/__tests__/WordToken.test.tsx (afterEach pattern)]
- Escape key via document.addEventListener: [epics.md — Story 2.4 AC5, FR21]

### Review Findings

- [x] [Review][Decision] KanjiBreakdown scroll cap — accepted current behaviour as-is; `overflow-x-auto` is correct, words rarely exceed 4–5 kanji in practice [KanjiBreakdown.tsx:17]
- [x] [Review][Patch] Use `key={char + i}` instead of `key={i}` in KanjiBreakdown map — index key is fragile when the same character repeats (e.g. `日日`); `char + i` is stable and unique per position [KanjiBreakdown.tsx:20]
- [x] [Review][Patch] Wrap `lookupState.word` in `<span lang="ja">` in the not-found branch — the Japanese word is interpolated directly into English prose `"No entry for {word}"` with no `lang` attribute; screen readers will mispronounce it using the page's base language [InfoPanel.tsx:49]
- [x] [Review][Defer] kanjiService race: `lookupKanji` returns null if `initKanji` hasn't resolved yet — if `KanjiBreakdown` mounts before kanji data loads, breakdown silently disappears; component has no re-render trigger when map becomes available — deferred, pre-existing architecture concern [kanjiService.ts]
- [x] [Review][Defer] Empty `<span>` rendered when `kw === null` and `m` is empty array — `kw ?? m[0] ?? ''` falls back to empty string, emitting a zero-content flex child with non-zero font metrics — deferred, extremely unlikely with real kanji data, visually negligible [KanjiBreakdown.tsx:23]
- [x] [Review][Defer] `aria-live` region announces all KanjiBreakdown chip text simultaneously on lookup — no `aria-atomic` control; verbose AT readout possible for words with many kanji — deferred, future a11y enhancement [InfoPanel.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `KanjiBreakdown`: uses `[...word]` spread for Unicode-safe char iteration; filters non-kanji chars via `lookupKanji` returning null; returns React null when no kanji found; uses array index as React key (not char) to correctly handle repeated kanji; `kw ?? entry.m[0] ?? ''` fallback chain for null kw.
- `InfoPanel`: outer container always rendered (never conditionally mounted) to establish `aria-live` region before any lookup; `useEffect` attaches Escape listener to `document` with proper cleanup; three conditional branches for idle/found/not-found rendered inside fixed-height container; found branch composes `<KanjiBreakdown word={lookupState.word} />` for kanji display.
- Tests: 9 KanjiBreakdown tests + 9 InfoPanel tests = 18 new tests; all 72 tests passing (was 54). Tests that don't seed kanji data produce expected `lookupKanji called before initKanji` console.warn — these are informational, not failures; KanjiBreakdown correctly returns null in those cases.

### File List

- `apps/web/src/components/KanjiBreakdown.tsx` (new)
- `apps/web/src/components/InfoPanel.tsx` (new)
- `apps/web/src/__tests__/KanjiBreakdown.test.tsx` (new)
- `apps/web/src/__tests__/InfoPanel.test.tsx` (new)
