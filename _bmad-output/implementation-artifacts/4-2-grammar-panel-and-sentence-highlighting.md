# Story 4.2: Grammar Panel & Sentence Highlighting

Status: done

## Story

As a **reader**,
I want to see the grammar points used in the story with relevant points highlighted when I select a sentence,
so that I can understand which grammar patterns apply to each sentence as I read.

## Acceptance Criteria

**AC1 — Grammar point list**

Given a story with a non-empty `grammar` array (`StoryModel.grammar: string[]`)
When `GrammarPanel` renders
Then each grammar point string is displayed as a list item; all points render at equal visual weight when no sentence is selected

**AC2 — Empty state**

Given `StoryModel.grammar` is an empty array (or the story has no grammar field — degrades to empty array)
When `GrammarPanel` renders
Then shows `"No grammar notes for this story."` in `muted` colour, centred; no list items rendered

**AC3 — No sentence selected**

Given `selectedSentenceId` in `useLookupStore` is `null`
When `GrammarPanel` renders
Then all grammar points display at equal visual weight — no highlighting, no `muted` dimming; base `paper-text` styling

**AC4 — Sentence selected with matching grammar indices**

Given a sentence is selected (e.g. `s3`) whose `SentenceModel.grammar` is `[0, 2]` (indices into `StoryModel.grammar`)
When `GrammarPanel` renders
Then grammar points at indices 0 and 2 receive `accent-subtle` background + `accent` border; all other points render in `muted`

**AC5 — Sentence selected with empty grammar indices**

Given a sentence is selected whose `SentenceModel.grammar` is `[]`
When `GrammarPanel` renders
Then all grammar points render in `muted` — none are highlighted; this is correct, not an error state

**AC6 — GrammarPanel.test.tsx coverage**

Given `GrammarPanel.test.tsx`
When run
Then covers:
- all points equal visual weight when no sentence selected
- correct indices highlighted when a sentence with non-empty grammar is selected
- all `muted` when selected sentence has `grammar: []`
- empty state message when `StoryModel.grammar` is empty
- `SentenceModel.grammar` (number[]) never used as the points list — only as index selectors
- `afterEach(() => act(() => useLookupStore.getState()._reset()))` present

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/src/components/GrammarPanel.tsx` (AC1–AC5)
  - [x] Accept props: `grammar: string[]`, `sentences: SentenceModel[]`
  - [x] Read `selectedSentenceId` from `useLookupStore` (single selector, not full store)
  - [x] Derive active sentence's grammar indices: find sentence matching `selectedSentenceId`, read its `grammar: number[]`
  - [x] Render empty state when `grammar.length === 0`
  - [x] When no sentence selected: all items with base styling (no highlight, no muted)
  - [x] When sentence selected: highlighted items get `bg-accent-subtle border border-accent`; non-highlighted items get `text-muted`
  - [x] Use `cn()` for class composition; do NOT use raw string concatenation

- [x] Task 2: Create `apps/web/src/__tests__/GrammarPanel.test.tsx` (AC6)
  - [x] Follow the `VocabItem.test.tsx` pattern — see Dev Notes for exact test shape
  - [x] Test: renders all grammar points when no sentence selected
  - [x] Test: no highlight and no muted class when no sentence selected
  - [x] Test: correct indices highlighted; others muted when sentence with `grammar: [0, 2]` selected
  - [x] Test: all items muted when selected sentence has `grammar: []`
  - [x] Test: empty state message when grammar array is empty
  - [x] `afterEach(() => act(() => useLookupStore.getState()._reset()))` present

- [x] Task 3: Verify
  - [x] `pnpm test:unit` from `apps/web` — all 152 existing tests pass; new GrammarPanel tests pass (157 total)
  - [x] `pnpm typecheck` from repo root — 0 errors

### Review Findings

- [x] [Review][Patch] AC3: `<li>` items missing `text-paper-text` base class — spec requires explicit paper-text token on base (no-selection) state, not just CSS inheritance [apps/web/src/components/GrammarPanel.tsx:39]
- [x] [Review][Patch] AC3/AC6: No-selection test only checks absence of highlight/muted classes but never asserts `text-paper-text` is present [apps/web/src/__tests__/GrammarPanel.test.tsx:33]
- [x] [Review][Defer] Out-of-bounds SentenceModel.grammar indices silently mute all items [apps/web/src/components/GrammarPanel.tsx:17] — deferred, data validation belongs in loader layer; architecture explicitly forbids UI re-validation
- [x] [Review][Defer] Stale selectedSentenceId (ID not in sentences prop) causes unexpected all-muted state [apps/web/src/components/GrammarPanel.tsx:15] — deferred, parent integration responsibility (Story 4.3); cannot occur in correct usage
- [x] [Review][Defer] Empty-string grammar point renders an invisible list item [apps/web/src/components/GrammarPanel.tsx:32] — deferred, data quality constraint belongs in schema/loader layer

## Dev Notes

### Critical type distinction — do not confuse these two

```typescript
StoryModel.grammar: string[]    // the list of grammar point descriptions (what GrammarPanel displays)
SentenceModel.grammar: number[] // indices into StoryModel.grammar for the selected sentence
```

`SentenceModel.grammar` is NEVER displayed directly — it only tells GrammarPanel which indices to highlight. The text comes exclusively from `StoryModel.grammar[index]`.

### GrammarPanel — complete implementation shape

```tsx
import { useLookupStore } from '@/stores/lookupStore'
import type { SentenceModel } from '@nihonnohon/schema'
import { cn } from '@/lib/utils'

interface GrammarPanelProps {
  grammar: string[]
  sentences: SentenceModel[]
}

/** Displays story grammar points, highlighting those used in the currently selected sentence. */
export function GrammarPanel({ grammar, sentences }: GrammarPanelProps) {
  const selectedSentenceId = useLookupStore(s => s.selectedSentenceId)

  // Derive grammar indices for the selected sentence (SentenceModel.grammar: number[])
  const activeSentence = selectedSentenceId !== null
    ? (sentences.find(s => s.id === selectedSentenceId) ?? null)
    : null
  const highlightedIndices = new Set(activeSentence?.grammar ?? [])

  if (grammar.length === 0) {
    return (
      <div className="flex justify-center items-center p-4">
        <p className="text-muted text-center text-sm">No grammar notes for this story.</p>
      </div>
    )
  }

  return (
    <ul className="p-4 space-y-2">
      {grammar.map((point, i) => {
        const isHighlighted = selectedSentenceId !== null && highlightedIndices.has(i)
        const isMuted = selectedSentenceId !== null && !highlightedIndices.has(i)

        return (
          <li
            key={i}
            className={cn(
              'px-3 py-2 rounded text-sm',
              isHighlighted && 'bg-accent-subtle border border-accent',
              isMuted && 'text-muted',
            )}
          >
            {point}
          </li>
        )
      })}
    </ul>
  )
}
```

### GrammarPanel — no lookup action, read-only store access

`GrammarPanel` is purely display-driven. It only reads `selectedSentenceId` from the store — it never calls `lookup`, `selectSentence`, or any mutating action. Do NOT add an onClick handler to grammar list items (they are not interactive).

### How selectedSentenceId gets set (for test setup)

`selectedSentenceId` is set by either:
- User tapping a `SentenceBlock` → calls `selectSentence(sentenceId)` → lookupState resets to idle, selectedSentenceId updated
- User tapping a `WordToken` → calls `lookup(word, entry, sentenceId)` → both lookupState and selectedSentenceId updated

In tests, use `useLookupStore.setState({ selectedSentenceId: 's3' })` to directly set the value without triggering side effects on `lookupState`. This is cleaner than calling `selectSentence` (which unnecessarily resets lookupState) or `lookup` (which requires a VocabEntry).

### GrammarPanel.test.tsx — complete test file shape

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GrammarPanel } from '@/components/GrammarPanel'
import { useLookupStore } from '@/stores/lookupStore'
import type { SentenceModel } from '@nihonnohon/schema'

const grammar = ['Grammar point A', 'Grammar point B', 'Grammar point C']

const sentences: SentenceModel[] = [
  { id: 's1', words: ['word'], ruby: [null], vocabKeys: [null], translation: null, grammar: [] },
  { id: 's2', words: ['word'], ruby: [null], vocabKeys: [null], translation: null, grammar: [0, 2] },
]

afterEach(() => {
  act(() => { useLookupStore.getState()._reset() })
})

describe('GrammarPanel', () => {
  it('renders all grammar points', () => {
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    expect(screen.getByText('Grammar point A')).toBeInTheDocument()
    expect(screen.getByText('Grammar point B')).toBeInTheDocument()
    expect(screen.getByText('Grammar point C')).toBeInTheDocument()
  })

  it('shows empty state when grammar array is empty', () => {
    render(<GrammarPanel grammar={[]} sentences={sentences} />)
    expect(screen.getByText('No grammar notes for this story.')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('renders all items without highlight or muted when no sentence selected', () => {
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    items.forEach(item => {
      expect(item).not.toHaveClass('bg-accent-subtle')
      expect(item).not.toHaveClass('text-muted')
    })
  })

  it('highlights correct indices and mutes others when sentence with grammar is selected', () => {
    act(() => { useLookupStore.setState({ selectedSentenceId: 's2' }) })
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    // s2 has grammar: [0, 2]
    expect(items[0]).toHaveClass('bg-accent-subtle')
    expect(items[0]).toHaveClass('border-accent')
    expect(items[1]).toHaveClass('text-muted')
    expect(items[1]).not.toHaveClass('bg-accent-subtle')
    expect(items[2]).toHaveClass('bg-accent-subtle')
    expect(items[2]).toHaveClass('border-accent')
  })

  it('mutes all items when selected sentence has grammar: []', () => {
    act(() => { useLookupStore.setState({ selectedSentenceId: 's1' }) })
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    items.forEach(item => {
      expect(item).toHaveClass('text-muted')
      expect(item).not.toHaveClass('bg-accent-subtle')
    })
  })
})
```

### Fixture data — story has real grammar entries

The committed story fixture (`apps/web/public/stories/genki-i-ch6-tanaka-letter.json`) has:
```json
"grammar": [
  "Verb ます-form: polite present/future tense",
  "Time expressions with に (at [specific time])",
  "Expressing sequence with てから (after doing; and then)"
]
```

And sentence `s3` has `"grammar": [0, 1]`. Use synthetic fixture data in unit tests (as above) — not the real story file.

### VocabPanel parallel — same isolation boundary

**Do NOT integrate GrammarPanel into `ReaderRoute.tsx` in this story.** Story 4.3 owns the responsive layout integration (two-column desktop, tab bar mobile). GrammarPanel is created and tested in isolation, exactly as VocabPanel was in Story 4.1.

### File locations (new files only)

```
apps/web/src/
  components/
    GrammarPanel.tsx    ← NEW — feature component, PascalCase, named export
  __tests__/
    GrammarPanel.test.tsx  ← NEW
```

No modifications to any existing file are required for this story.

### What this story does NOT include

- Integration into `ReaderRoute` layout — Story 4.3 scope
- VocabPanel or VocabItem — already done in Story 4.1 (do not re-implement)
- SettingsMenu, spacing toggle, text size controls — Story 4.3 scope
- Responsive layout (tabs, two-column) — Story 4.3 scope
- Playwright E2E tests — Story 4.4 scope
- Any changes to `WordToken`, `SentenceBlock`, `InfoPanel`, `ToolBar`, `lookupStore`, `preferenceStore`, or route files

### Project structure compliance

- `GrammarPanel.tsx` in `apps/web/src/components/` (feature component, NOT in `ui/`)
- Named export `GrammarPanel`, PascalCase filename matching export
- Test file in `apps/web/src/__tests__/GrammarPanel.test.tsx`
- Import `cn` from `@/lib/utils`, NOT raw string concatenation
- Import types from `@nihonnohon/schema`, NOT re-declared locally

### Comments convention for this project

Write a succinct JSDoc docstring for the exported `GrammarPanel` function. Add inline comments only for non-obvious logic (e.g., the index-based highlighting derivation is worth a short comment). Do not narrate mechanics.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `GrammarPanel.tsx`: reads `selectedSentenceId` from `useLookupStore` via a single selector; derives a `Set<number>` of highlighted indices from the active sentence's `SentenceModel.grammar: number[]`; renders `StoryModel.grammar: string[]` with per-item highlight/mute logic; empty state for zero-length grammar array. No changes to any existing file.
- Created `GrammarPanel.test.tsx`: 5 tests covering all ACs — render list, empty state, no-selection equal weight, selection highlights correct indices + mutes others, selection with empty grammar indices mutes all. All 157 tests pass (152 pre-existing + 5 new). 0 TypeScript errors.

### File List

- `apps/web/src/components/GrammarPanel.tsx` (NEW)
- `apps/web/src/__tests__/GrammarPanel.test.tsx` (NEW)
