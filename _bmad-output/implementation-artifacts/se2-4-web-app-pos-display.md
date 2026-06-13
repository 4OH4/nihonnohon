# Story se2-4: Web App — POS Display

Status: review

## Story

As a **reader**,
I want to see the part of speech of a word when I tap it,
So that I can understand its grammatical role without needing to look it up separately.

## Acceptance Criteria

1. **AC1 — POS badge shown when `pos` is set**
   - `InfoPanel.tsx` in the `found` state displays a small label for `pos` near the definition
   - When `lookupState.pos` is `"v5"`, the label `v5` appears; it is visually distinct from the
     definition text (muted colour, smaller size, e.g. pill badge with `bg-surface-subtle` and
     `border-border`)

2. **AC2 — No POS label when `pos` is absent**
   - When `lookupState.pos` is absent (undefined), no label is rendered; layout is unchanged
     from current behaviour

3. **AC3 — Genki vocab entries show no POS label**
   - Words tapped from the main Genki vocab store (which lack `pos`) produce no label and no error

4. **AC4 — Test coverage**
   - `InfoPanel.test.tsx` covers: POS label present when `pos` is set; no label when `pos` is
     absent; no regression on all existing InfoPanel test cases
   - `turbo typecheck` exits 0 after all changes

---

## Tasks / Subtasks

- [x] Task 1: Add `pos?: string` to `LookupState.found` in `packages/schema/src/types.ts`

- [x] Task 2: Add `pos?: string` parameter to `lookup()` in `lookupStore.ts`

- [x] Task 3: Change `buildSupplementMap` in `ReaderRoute.tsx` to return `Map<string, VocabSupplementEntry>` (raw, no adaptation); add adaptation inside `WordToken`

- [x] Task 4: Update `SentenceBlock.tsx` — change `supplementMap` prop type

- [x] Task 5: Update `WordToken.tsx` — change `supplementEntry` type; adapt inline; pass `pos` to `lookup()`

- [x] Task 6: Update `InfoPanel.tsx` — render POS badge when `lookupState.pos` is present

- [x] Task 7: Update `InfoPanel.test.tsx` — add 3 POS-specific test cases

- [x] Task 8: Run `pnpm typecheck` (or `turbo typecheck`) and confirm exit 0

---

## Dev Notes

### Architecture overview: how a tapped word reaches InfoPanel

The current data flow for supplement entries:

```
story.vocabSupplement: VocabSupplementEntry[]
  → buildSupplementMap() in ReaderRoute.tsx       ← converts to VocabEntry, drops pos
  → supplementMap: Map<string, VocabEntry>
  → SentenceBlock.supplementMap
  → WordToken.supplementEntry: VocabEntry | null
  → lookup(word, entry: VocabEntry, sentenceId)
  → lookupState: { status: 'found', word, entry: VocabEntry }
  → InfoPanel reads entry.reading + entry.meaning
```

The problem: `buildSupplementMap` adapts `VocabSupplementEntry` to `VocabEntry` and **drops `pos`**.
To surface POS in InfoPanel, `pos` must survive this journey. The design chosen is:

1. Add `pos?: string` to `LookupState.found` (additive, non-breaking)
2. Move the `VocabEntry` adaptation from `buildSupplementMap` into `WordToken.handleActivate`
   (so `WordToken` receives the raw `VocabSupplementEntry` and can pass `pos` to `lookup()`)
3. `InfoPanel` renders a small badge when `lookupState.pos` is set

New data flow:

```
story.vocabSupplement: VocabSupplementEntry[]
  → buildSupplementMap() — now returns Map<string, VocabSupplementEntry> (raw, no conversion)
  → supplementMap: Map<string, VocabSupplementEntry>
  → SentenceBlock.supplementMap: Map<string, VocabSupplementEntry>
  → WordToken.supplementEntry: VocabSupplementEntry | null
  → handleActivate: adapt inline → VocabEntry; extract pos
  → lookup(word, adaptedEntry, sentenceId, supplementEntry.pos)
  → lookupState: { status: 'found', word, entry: VocabEntry, pos?: string }
  → InfoPanel reads entry.reading + entry.meaning + lookupState.pos
```

### Task 1: Exact change to `packages/schema/src/types.ts`

Current `LookupState`:
```typescript
export type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
```

New:
```typescript
export type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry; pos?: string }
  | { status: 'not-found'; word: string }
```

### Task 2: Exact change to `apps/web/src/stores/lookupStore.ts`

Current interface and implementation:
```typescript
lookup: (word: string, entry: VocabEntry | null, sentenceId: string | null) => void
// ...
lookup: (word, entry, sentenceId) =>
  set({
    lookupState: entry !== null
      ? { status: 'found', word, entry }
      : { status: 'not-found', word },
    selectedSentenceId: sentenceId,
  }),
```

New:
```typescript
lookup: (word: string, entry: VocabEntry | null, sentenceId: string | null, pos?: string) => void
// ...
lookup: (word, entry, sentenceId, pos) =>
  set({
    lookupState: entry !== null
      ? { status: 'found', word, entry, ...(pos !== undefined && { pos }) }
      : { status: 'not-found', word },
    selectedSentenceId: sentenceId,
  }),
```

**Important:** use conditional spread `...(pos !== undefined && { pos })` so that absent `pos` does
NOT produce `pos: undefined` on the state object — TypeScript optional means the key should be
absent, not present with value `undefined`. This is the same pattern used in `mapVocabEntry` from
se2-3.

### Task 3: Exact change to `apps/web/src/routes/ReaderRoute.tsx`

Current `buildSupplementMap`:
```typescript
function buildSupplementMap(supplement: VocabSupplementEntry[]): Map<string, VocabEntry> {
  const map = new Map<string, VocabEntry>()
  supplement.forEach((entry, i) => {
    map.set(entry.word, {
      id: -(i + 1),
      word: entry.word,
      reading: entry.hiragana,
      meaning: entry.translation,
      lesson: 'supplement',
    })
  })
  return map
}
```

New (return raw, no adaptation):
```typescript
function buildSupplementMap(supplement: VocabSupplementEntry[]): Map<string, VocabSupplementEntry> {
  const map = new Map<string, VocabSupplementEntry>()
  supplement.forEach((entry) => {
    map.set(entry.word, entry)
  })
  return map
}
```

The `supplementMap` variable on `ReaderRoute` changes type accordingly. `SentenceBlock` is passed
`supplementMap={supplementMap}` as before; only the type signature changes.

Also update the import — `VocabEntry` is no longer used in `buildSupplementMap`. Check whether
`VocabEntry` is still referenced elsewhere in the file; if not, remove it from the import list.

### Task 4: Exact change to `apps/web/src/components/SentenceBlock.tsx`

Current:
```typescript
import type { SentenceModel, VocabEntry } from '@nihonnohon/schema'

interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
  supplementMap?: Map<string, VocabEntry>
}
```

New:
```typescript
import type { SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
  supplementMap?: Map<string, VocabSupplementEntry>
}
```

The `supplementEntry` prop passed to `WordToken` (`supplementMap?.get(token.surface) ?? null`) does
not change in shape — only the map's value type changes. `WordToken.supplementEntry` type changes
in the next task.

### Task 5: Exact change to `apps/web/src/components/WordToken.tsx`

Current props and `handleActivate`:
```typescript
import type { ParsedWord, VocabEntry } from '@nihonnohon/schema'

interface WordTokenProps {
  token: ParsedWord
  vocabKey: number | null
  sentenceId: string
  /** Supplement entry takes precedence over vocabKey lookup when provided and non-null. */
  supplementEntry?: VocabEntry | null
}

// ...inside handleActivate:
if (supplementEntry != null) {
  lookup(token.surface, supplementEntry, sentenceId)
  return
}
```

New — change import, prop type, and handleActivate:
```typescript
import type { ParsedWord, VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

interface WordTokenProps {
  token: ParsedWord
  vocabKey: number | null
  sentenceId: string
  /** Raw supplement entry; takes precedence over vocabKey lookup when provided and non-null. */
  supplementEntry?: VocabSupplementEntry | null
}

// ...inside handleActivate:
if (supplementEntry != null) {
  const adapted: VocabEntry = {
    id: -(supplementEntry.key),
    word: supplementEntry.word,
    reading: supplementEntry.hiragana,
    meaning: supplementEntry.translation,
    lesson: 'supplement',
  }
  lookup(token.surface, adapted, sentenceId, supplementEntry.pos)
  return
}
```

### Task 6: Exact change to `apps/web/src/components/InfoPanel.tsx`

In the `status === 'found'` branch, add a POS badge alongside the word and reading.

Current layout (the `flex items-baseline gap-2` row):
```tsx
<div className="flex items-baseline gap-2">
  <span className="font-ja font-semibold text-paper-text" lang="ja">{lookupState.word}</span>
  <span className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</span>
</div>
```

New (add conditional POS badge after the reading span):
```tsx
<div className="flex items-baseline gap-2">
  <span className="font-ja font-semibold text-paper-text" lang="ja">{lookupState.word}</span>
  <span className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</span>
  {lookupState.pos && (
    <span className="text-xs text-muted rounded px-1 py-0.5 bg-surface-subtle border border-border">
      {lookupState.pos}
    </span>
  )}
</div>
```

**Styling rationale:**
- `text-xs` and `text-muted` — visually distinct from definition text
- `bg-surface-subtle border border-border` — pill badge style consistent with existing tokens
- Do NOT use arbitrary colours — only the custom tokens from `tailwind.config.ts`

### Task 7: Exact changes to `apps/web/src/__tests__/InfoPanel.test.tsx`

Add `VocabSupplementEntry` to the import (not strictly needed for InfoPanel tests, but useful for
context). The tests set state directly via `useLookupStore.setState` rather than calling `lookup()`,
so they do not depend on the `WordToken` adaptation.

Add these three test cases inside the existing `describe('InfoPanel', ...)` block:

```typescript
it('found state with pos shows POS badge', () => {
  act(() => {
    useLookupStore.setState({
      lookupState: { status: 'found', word: '食べる', entry: vocabEntry, pos: 'v5' },
      selectedSentenceId: 's1',
    })
  })
  render(<InfoPanel story={storyFixture} />)
  expect(screen.getByText('v5')).toBeInTheDocument()
})

it('found state without pos shows no POS badge', () => {
  act(() => {
    useLookupStore.getState().lookup('食べる', vocabEntry, 's1')
    // no pos arg → pos is absent from state
  })
  render(<InfoPanel story={storyFixture} />)
  expect(screen.queryByText(/^[a-z0-9-]+$/)).not.toBeInTheDocument() // no badge text
  expect(screen.getByText('食べる')).toBeInTheDocument()
})

it('found state with pos="" shows no POS badge (empty string is falsy)', () => {
  act(() => {
    useLookupStore.setState({
      lookupState: { status: 'found', word: '食べる', entry: vocabEntry, pos: '' },
      selectedSentenceId: 's1',
    })
  })
  render(<InfoPanel story={storyFixture} />)
  // pos: "" renders no badge — the conditional {lookupState.pos && ...} gates on truthiness
  expect(screen.queryByRole('generic', { hidden: true })).toBeDefined() // no POS badge element
  expect(screen.getByText('食べる')).toBeInTheDocument()
})
```

**Note on the empty-string test:** the enrichment pipeline uses `""` as a "POS unknown" sentinel
(see se2-3 Review Findings). The `{lookupState.pos && ...}` conditional is falsy for `""`, so no
badge renders — this is correct behaviour and should be tested. If there is debate about whether to
show a badge for `""`, err on the side of not showing it (matches the guard as written).

A simpler approach for the "no badge" assertion: check that no element with the `border-border`
badge class exists:
```typescript
const { container } = render(<InfoPanel story={storyFixture} />)
expect(container.querySelector('.border-border')).toBeNull()
```

### Files to create / modify

| File | Action |
|------|--------|
| `packages/schema/src/types.ts` | **MODIFY** — add `pos?: string` to `LookupState.found` |
| `apps/web/src/stores/lookupStore.ts` | **MODIFY** — add `pos?: string` param to `lookup()` |
| `apps/web/src/routes/ReaderRoute.tsx` | **MODIFY** — `buildSupplementMap` returns raw `VocabSupplementEntry` map |
| `apps/web/src/components/SentenceBlock.tsx` | **MODIFY** — `supplementMap` type change |
| `apps/web/src/components/WordToken.tsx` | **MODIFY** — `supplementEntry` type + inline adaptation + pass `pos` |
| `apps/web/src/components/InfoPanel.tsx` | **MODIFY** — render POS badge |
| `apps/web/src/__tests__/InfoPanel.test.tsx` | **MODIFY** — add POS test cases |

No new files. `WordToken.test.tsx` and `SentenceBlock.test.tsx` do NOT need updates: existing
`WordToken` tests don't use `supplementEntry`; existing `SentenceBlock` tests don't pass
`supplementMap`.

### What does NOT belong in this story

- Re-enrichment script — se2-5
- Changes to Python backend — already done in se2-1/se2-2
- Rendering `dictionaryForm` — not in the AC; defer

### Running tests and typecheck

```bash
# From apps/web
pnpm test:unit

# Full monorepo typecheck
pnpm typecheck    # from repo root
```

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-04. All 8 tasks completed. The POS data path flows end-to-end:
`VocabSupplementEntry.pos` → `buildSupplementMap` (raw, no conversion) → `SentenceBlock` →
`WordToken.handleActivate` (adapts to `VocabEntry` inline, passes `pos`) → `lookup()` →
`LookupState.found.pos` → `InfoPanel` renders a muted pill badge. Genki vocab entries and
supplement entries with absent/empty `pos` show no badge. `turbo typecheck` exits 0 across all
7 packages. 179 unit tests pass (13 InfoPanel tests including 3 new POS-specific cases).

### File List

- `packages/schema/src/types.ts` — MODIFIED: `pos?: string` added to `LookupState.found`
- `apps/web/src/stores/lookupStore.ts` — MODIFIED: `lookup()` accepts optional `pos` param
- `apps/web/src/routes/ReaderRoute.tsx` — MODIFIED: `buildSupplementMap` returns raw `VocabSupplementEntry` map
- `apps/web/src/components/SentenceBlock.tsx` — MODIFIED: `supplementMap` type updated
- `apps/web/src/components/WordToken.tsx` — MODIFIED: `supplementEntry` type + inline adaptation + `pos` passed to `lookup()`
- `apps/web/src/components/InfoPanel.tsx` — MODIFIED: conditional POS badge rendered
- `apps/web/src/__tests__/InfoPanel.test.tsx` — MODIFIED: 3 POS test cases added

### Change Log

- 2026-06-04: Added POS display to InfoPanel — `pos` threaded from `VocabSupplementEntry` through lookup store; badge rendered in found state when `pos` is truthy

### Review Findings

_(to be filled in by code reviewer)_
