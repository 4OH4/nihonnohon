# Story 4.1: Vocabulary Panel & VocabItem

Status: done

## Story

As a **reader**,
I want to browse the story's vocabulary list and tap any word to look it up in the info panel,
So that I can review the story's key vocabulary without having to find each word in the text.

## Acceptance Criteria

**AC1 — Unified vocabulary list**

Given a story with `keywords` and/or `vocabSupplement` entries
When the vocabulary panel (`VocabPanel`) is rendered
Then it shows a single combined list — `keywords` entries first, then `vocabSupplement` entries; if both arrays are absent or empty, displays `"No vocabulary defined for this story."` in `muted` colour, centred

**AC2 — VocabItem rendering**

Given a `VocabItem` entry in the vocabulary panel
When rendered
Then shows:
- word (large, Noto Sans JP, `lang="ja"`, `font-ja`)
- hiragana reading (smaller, `muted`, Noto Sans JP, `lang="ja"`, `font-ja`)
- English translation (normal, `paper-text`)
- default state: no background
- hover state: `accent-subtle` background
- active state (word currently shown in InfoPanel): `accent-subtle` background, persists while InfoPanel shows that entry

**AC3 — VocabItem tap triggers lookup**

Given a `VocabItem` is tapped
When the tap event fires
Then calls `useLookupStore.lookup(entry.word, entry, null)`;
`InfoPanel` updates with the entry's translation, hiragana, and kanji breakdown;
`selectedSentenceId` is set to `null` — no sentence is highlighted when lookup originates from the vocab panel

**AC4 — VocabItem.test.tsx coverage**

Given `VocabItem.test.tsx`
When run
Then covers:
- all three fields rendered (word, reading, translation)
- tap triggers `lookup` with correct args including `sentenceId: null`
- active state: `accent-subtle` bg applied when `lookupState.status === 'found'` and `lookupState.word === entry.word`
- active state absent when a different word is in `lookupState`
- `afterEach(() => useLookupStore.getState()._reset())` present

## Tasks / Subtasks

- [x] Task 1: Update `apps/web/src/stores/lookupStore.ts` — broaden `sentenceId` type (AC3)
  - [x] Change `lookup: (word: string, entry: VocabEntry | null, sentenceId: string) => void` to `sentenceId: string | null`
  - [x] Update the implementation's `set(...)` call — `selectedSentenceId` is already typed `string | null`, so only the interface changes
  - [x] **Do NOT** update existing lookupStore tests — all existing callers pass `string`, which is still valid

- [x] Task 2: Create `apps/web/src/components/VocabPanel.tsx` (AC1)
  - [x] Accept props: `keywords: VocabSupplementEntry[] | undefined`, `vocabSupplement: VocabSupplementEntry[]`
  - [x] Build combined `VocabEntry[]` list: keywords first, then supplement, each converted to `VocabEntry` with negative sequential `id` values (see Dev Notes)
  - [x] Render each entry as a `VocabItem`
  - [x] Render empty state `"No vocabulary defined for this story."` when combined list is empty
  - [x] Empty state: `muted` colour, centred text

- [x] Task 3: Create `apps/web/src/components/VocabItem.tsx` (AC2, AC3)
  - [x] Accept props: `entry: VocabEntry`
  - [x] Read `useLookupStore` for `lookup` action and active-state detection
  - [x] Display: word (`lang="ja"`, `font-ja`, large), reading (`lang="ja"`, `font-ja`, `muted`, smaller), translation
  - [x] Active state: `accent-subtle` bg when `lookupState.status === 'found' && lookupState.word === entry.word`
  - [x] Hover state: `accent-subtle` bg
  - [x] `onClick`: call `lookup(entry.word, entry, null)`
  - [x] Make the row keyboard-accessible: `role="button"`, `tabIndex={0}`, `onKeyDown` fires on Enter + Space
  - [x] Use `cn()` from `@/lib/utils` for class merging

- [x] Task 4: Create `apps/web/src/__tests__/VocabItem.test.tsx` (AC4)
  - [x] Follow the WordToken test pattern (see Dev Notes for exact pattern)
  - [x] Test: all fields rendered (word, reading, translation)
  - [x] Test: tap calls `lookup` with `(entry.word, entry, null)`
  - [x] Test: active state when `lookupState.word === entry.word` and status is `found`
  - [x] Test: no active state when a different word is in `lookupState`
  - [x] `afterEach(() => act(() => useLookupStore.getState()._reset()))` present

- [x] Task 5: Run tests and verify
  - [x] `pnpm test:unit` — all existing tests still pass; new VocabItem tests pass
  - [x] `pnpm typecheck` — 0 errors across all packages

### Review Findings

- [x] [Review][Patch] Space bar handler missing `e.preventDefault()` — pressing Space on a scrollable page both triggers lookup AND scrolls the page; standard ARIA practice for `role="button"` requires `e.preventDefault()` on Space [apps/web/src/components/VocabItem.tsx:22]
- [x] [Review][Defer] `isActive` matches on `word` string only — if two entries share the same word string (homophone across keywords/supplement), both render as active simultaneously [apps/web/src/components/VocabItem.tsx:9] — deferred, author-controlled data makes collision extremely unlikely
- [x] [Review][Defer] `lesson: 'supplement'` assigned to keyword entries — `toVocabEntries` labels all converted entries as `'supplement'` regardless of source; no downstream code branches on this field today [apps/web/src/components/VocabPanel.tsx:11] — deferred, no downstream impact
- [x] [Review][Defer] Two `useLookupStore` selectors in one component — `lookup` and `lookupState` are separate `useLookupStore()` calls, causing two re-renders per store update [apps/web/src/components/VocabItem.tsx:7-8] — deferred, micro-optimisation, no functional impact
- [x] [Review][Defer] No `aria-label` on `role="button"` div — screen readers concatenate all three child spans; explicit label would be cleaner [apps/web/src/components/VocabItem.tsx:17] — deferred, no explicit spec requirement, text content is intelligible
- [x] [Review][Defer] Empty or whitespace-only `word` field would pass silently to lookup — `toVocabEntries` applies no guard; downstream InfoPanel renders an empty heading [apps/web/src/components/VocabPanel.tsx:5] — deferred, schema/loader responsibility

## Dev Notes

### lookupStore type change

The `lookup` action signature must accept `sentenceId: string | null` so VocabPanel lookups do not highlight any sentence:

```typescript
// Before (lookupStore.ts line 7):
lookup: (word: string, entry: VocabEntry | null, sentenceId: string) => void

// After:
lookup: (word: string, entry: VocabEntry | null, sentenceId: string | null) => void
```

The implementation body is unchanged — `selectedSentenceId` is already `string | null`. The `set(...)` call already writes `selectedSentenceId: sentenceId`, so null flows through correctly.

**Existing callers (WordToken, lookupStore tests):** all pass `string` values. `string` is assignable to `string | null`, so no callsite changes are needed and no existing tests break.

### VocabEntry conversion (VocabPanel internal)

VocabPanel must convert `VocabSupplementEntry[]` (from story data) to `VocabEntry[]` (for lookup store compatibility). Use the same pattern as `buildSupplementMap` in `ReaderRoute.tsx` (that function is not exported — do not import from there):

```typescript
// VocabPanel — internal helper, not exported
function toVocabEntries(items: VocabSupplementEntry[], idOffset: number): VocabEntry[] {
  return items.map((e, i) => ({
    id: -(idOffset + i + 1),
    word: e.word,
    reading: e.hiragana,
    meaning: e.translation,
    lesson: 'supplement',
  }))
}
```

Combine them sequentially, keywords first:

```typescript
const keywordEntries = toVocabEntries(keywords ?? [], 0)
const supplementEntries = toVocabEntries(vocabSupplement, keywordEntries.length)
const combined = [...keywordEntries, ...supplementEntries]
```

Using sequential negative IDs ensures each entry has a unique `id` within the list (required by the `VocabEntry` type and for React keys). The negative range prevents collisions with real vocab entries (which have positive IDs from `vocab.json`).

### VocabItem — active state detection

VocabItem reads from the lookup store to determine if it is currently active (i.e., the word it represents is currently displayed in the InfoPanel):

```typescript
const lookupState = useLookupStore((s) => s.lookupState)
const isActive = lookupState.status === 'found' && lookupState.word === entry.word
```

Do NOT import `usePreferenceStore` in VocabItem — it has no preference-driven behaviour.

### VocabItem — complete implementation shape

```tsx
export function VocabItem({ entry }: { entry: VocabEntry }) {
  const lookup = useLookupStore((s) => s.lookup)
  const lookupState = useLookupStore((s) => s.lookupState)
  const isActive = lookupState.status === 'found' && lookupState.word === entry.word

  const handleActivate = () => {
    lookup(entry.word, entry, null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleActivate() }}
      className={cn(
        'flex flex-col px-3 py-2 cursor-pointer rounded',
        isActive ? 'bg-accent-subtle' : 'hover:bg-accent-subtle',
      )}
    >
      <span className="font-ja text-paper-text text-base" lang="ja">{entry.word}</span>
      <span className="font-ja text-muted text-sm" lang="ja">{entry.reading}</span>
      <span className="text-paper-text text-sm">{entry.meaning}</span>
    </div>
  )
}
```

Adjust class sizes to match UX-DR9 ("word large", "hiragana reading smaller, muted"). The `text-base` / `text-sm` ratio is sufficient for v1.

### VocabPanel — integration with ReaderRoute (IMPORTANT)

**Do NOT add VocabPanel to `ReaderRoute.tsx` in this story.** The layout restructuring (tabs on mobile, two-column on desktop) is Story 4.3's responsibility. VocabPanel is a standalone component that 4.3 will mount in the correct layout slot.

In this story, VocabPanel and VocabItem are created and fully tested in isolation.

### VocabItem.test.tsx — test pattern

Follow the same `act()` + `afterEach(_reset)` pattern used in `WordToken.test.tsx`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { VocabItem } from '@/components/VocabItem'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry } from '@nihonnohon/schema'

const entry: VocabEntry = {
  id: -1,
  word: '食べ物',
  reading: 'たべもの',
  meaning: 'food',
  lesson: 'supplement',
}

afterEach(() => {
  act(() => { useLookupStore.getState()._reset() })
})

describe('VocabItem', () => {
  it('renders word, reading, and translation', () => {
    render(<VocabItem entry={entry} />)
    expect(screen.getByText('食べ物')).toBeInTheDocument()
    expect(screen.getByText('たべもの')).toBeInTheDocument()
    expect(screen.getByText('food')).toBeInTheDocument()
  })

  it('tap calls lookup with entry and sentenceId=null', () => {
    render(<VocabItem entry={entry} />)
    fireEvent.click(screen.getByRole('button'))
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'found', word: '食べ物', entry })
    expect(state.selectedSentenceId).toBeNull()
  })

  it('applies accent-subtle bg when this word is active', () => {
    act(() => { useLookupStore.getState().lookup('食べ物', entry, null) })
    const { container } = render(<VocabItem entry={entry} />)
    expect(container.firstChild).toHaveClass('bg-accent-subtle')
  })

  it('does not apply active bg when a different word is in lookupState', () => {
    const other: VocabEntry = { id: -2, word: '水', reading: 'みず', meaning: 'water', lesson: 'supplement' }
    act(() => { useLookupStore.getState().lookup('水', other, null) })
    const { container } = render(<VocabItem entry={entry} />)
    // bg-accent-subtle would only be present if this word matches — it should not
    expect(container.firstChild).not.toHaveClass('bg-accent-subtle')
  })
})
```

### VocabSupplementEntry type import

`VocabSupplementEntry` is exported from `@nihonnohon/schema`. Import it alongside `VocabEntry`:

```typescript
import type { VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'
```

### StoryModel.keywords nullability

`StoryModel.keywords` is optional — it may be `undefined` when the story has no keyword list. Always default to empty array:

```typescript
const keywordEntries = toVocabEntries(keywords ?? [], 0)
```

`StoryModel.vocabSupplement` is always an array (even if empty), matching the existing pattern in `ReaderRoute.tsx` (`buildSupplementMap(story.vocabSupplement)` with no null guard).

### Files being created (READ before touching — no existing files to read for new files)

**`apps/web/src/stores/lookupStore.ts`** — line 7 only: change `sentenceId: string` to `sentenceId: string | null`. Line 21: the `set(...)` body is unchanged.

### Project structure compliance

```
apps/web/src/
  components/
    VocabItem.tsx    ← NEW — feature component, PascalCase, named export
    VocabPanel.tsx   ← NEW — feature component, PascalCase, named export
  __tests__/
    VocabItem.test.tsx  ← NEW — tests for VocabItem (and VocabPanel behaviour)
```

### What this story does NOT include

- Integration into `ReaderRoute` layout — Story 4.3 scope
- Grammar panel — Story 4.2 scope
- SettingsMenu or responsive tabs — Story 4.3 scope
- Playwright E2E tests — Story 4.4 scope
- Any changes to `WordToken`, `SentenceBlock`, `InfoPanel`, `ToolBar`, or route files

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Updated `lookupStore.ts`: broadened `lookup` signature to `sentenceId: string | null`. No callsite changes needed — existing `string` callers remain valid. Implementation body unchanged.
- Created `VocabItem.tsx`: standalone vocab row component; reads `useLookupStore` directly for `lookup` and active-state detection; keyboard-accessible (`role="button"`, Enter+Space); uses `cn()` and design tokens.
- Created `VocabPanel.tsx`: converts `VocabSupplementEntry` → `VocabEntry` with sequential negative IDs; keywords rendered before supplement; empty state when combined list is empty.
- Created `VocabItem.test.tsx`: 13 tests covering VocabItem (7) and VocabPanel (6); all pass. VocabPanel not yet wired into ReaderRoute — that is Story 4.3's scope.
- Final counts: 152 tests pass (13 new), 0 TypeScript errors.

### File List

- `apps/web/src/stores/lookupStore.ts` (UPDATED — `sentenceId: string | null`)
- `apps/web/src/components/VocabPanel.tsx` (NEW)
- `apps/web/src/components/VocabItem.tsx` (NEW)
- `apps/web/src/__tests__/VocabItem.test.tsx` (NEW)
