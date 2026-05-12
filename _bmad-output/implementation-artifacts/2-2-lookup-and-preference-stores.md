# Story 2.2: Lookup & Preference Stores

Status: done

## Story

As a **reader**,
I want word selections and reading preferences to be reliably tracked and persisted,
so that my chosen reading settings survive page reloads without any manual configuration.

## Acceptance Criteria

**AC1 — `useLookupStore` lookup transitions**

Given `useLookupStore` is fully implemented
When `lookup(word, entry, sentenceId)` is called with a valid `VocabEntry`
Then `lookupState` transitions to `{ status: 'found', word, entry }`; `selectedSentenceId` is set to `sentenceId`

When `lookup(word, null, sentenceId)` is called (entry is null)
Then `lookupState` transitions to `{ status: 'not-found', word }`; `selectedSentenceId` is still set to `sentenceId` (the tap registers even with no entry)

**AC2 — `useLookupStore` selectSentence**

Given `selectSentence(sentenceId)` is called
When executed
Then `selectedSentenceId` is updated to the new value; `lookupState` resets to `{ status: 'idle' }`

**AC3 — `useLookupStore` reset**

Given `_reset()` is called (test-only)
When executed
Then all store state returns to initial values; `afterEach(() => useLookupStore.getState()._reset())` is present in every test file using this store

**AC4 — `lookupStore.test.ts`**

Given `apps/web/src/__tests__/lookupStore.test.ts`
When run
Then covers all five state transitions: idle → found; idle → not-found; found → found (new word tap); found → idle (selectSentence); not-found → idle (selectSentence)
And confirms `selectedSentenceId` is set in both found and not-found cases

**AC5 — `usePreferenceStore` persistence**

Given `usePreferenceStore` is fully implemented with Zustand `persist`
When the app loads after a previous session where preferences were changed
Then `rubyVisible`, `spacingVisible`, `transVisible`, `textSize`, `activeTab` are all restored from localStorage key `nihonnohon-preferences`; defaults: `rubyVisible: true`, `spacingVisible: false`, `transVisible: false`, `textSize: 'medium'`, `activeTab: 'story'`

**AC6 — `preferenceStore.test.ts`**

Given `apps/web/src/__tests__/preferenceStore.test.ts`
When run
Then `beforeEach(() => localStorage.clear())` plus in-memory state reset are present; tests cover: a changed preference is written to localStorage; individual setters update only their own field; `textSize` correctly accepts `'small' | 'medium' | 'large'`

## Tasks / Subtasks

- [x] Task 1: Complete `lookupStore.ts` implementation (AC1, AC2, AC3)
  - [x] Implement `lookup(word, entry, sentenceId)` — sets `lookupState` to `found` or `not-found`; always sets `selectedSentenceId`
  - [x] Implement `selectSentence(sentenceId)` — sets `selectedSentenceId`; resets `lookupState` to `{ status: 'idle' }`
  - [x] Confirm `reset()` and `_reset()` already work (they do — already call `set(initialState)`)

- [x] Task 2: Write `lookupStore.test.ts` (AC4)
  - [x] Create `apps/web/src/__tests__/lookupStore.test.ts`
  - [x] Test: idle → found (lookup with valid VocabEntry)
  - [x] Test: idle → not-found (lookup with null entry)
  - [x] Test: found → found (second word tap replaces first)
  - [x] Test: found → idle (selectSentence resets lookupState)
  - [x] Test: not-found → idle (selectSentence resets lookupState)
  - [x] Test: `selectedSentenceId` is set in both found and not-found cases
  - [x] `afterEach(() => useLookupStore.getState()._reset())` present

- [x] Task 3: Add setters to `preferenceStore.ts` (AC5)
  - [x] Add actions to `PreferenceStoreState`: `setRubyVisible`, `setSpacingVisible`, `setTransVisible`, `setTextSize`, `setActiveTab`
  - [x] Add `partialize` option to `persist` so only the five state fields are written to localStorage (not functions)
  - [x] All six fields and five setters must compile with no TypeScript errors

- [x] Task 4: Write `preferenceStore.test.ts` (AC6)
  - [x] Create `apps/web/src/__tests__/preferenceStore.test.ts`
  - [x] `beforeEach` resets both localStorage AND in-memory state to defaults
  - [x] Test: setting `rubyVisible: false` writes to `localStorage.getItem('nihonnohon-preferences')`
  - [x] Test: setting one field doesn't change other fields
  - [x] Test: `setTextSize` accepts all three values without error

- [x] Task 5: Verify tests pass
  - [x] Run `pnpm test:unit` in `apps/web` — all tests pass including existing `buildVocab`, `vocabService`, `kanjiService`

## Dev Notes

### lookupStore.ts — current state and what changes

The skeleton already has the correct interface, `initialState`, and working `reset`/`_reset`. Only `lookup` and `selectSentence` are stubs. The complete implementation is:

```ts
lookup: (word, entry, sentenceId) =>
  set({
    lookupState: entry !== null
      ? { status: 'found', word, entry }
      : { status: 'not-found', word },
    selectedSentenceId: sentenceId,
  }),

selectSentence: (sentenceId) =>
  set({
    selectedSentenceId: sentenceId,
    lookupState: { status: 'idle' },
  }),
```

**Critical:** `selectedSentenceId` is set to `sentenceId` in BOTH the `found` AND `not-found` branches of `lookup`. A tap on a word with no dictionary entry still selects the sentence (and the highlight is shown). Do not skip `selectedSentenceId` on `not-found`.

Do not add `useShallow` or any selector logic to the store itself — that's a component consumption concern.

### preferenceStore.ts — adding setters and partialize

The current skeleton has all five state fields wired but no actions. Add actions and use `partialize` to keep functions out of localStorage:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferenceStoreState {
  rubyVisible: boolean
  spacingVisible: boolean
  transVisible: boolean
  textSize: 'small' | 'medium' | 'large'
  activeTab: 'story' | 'vocabulary' | 'grammar'
  setRubyVisible: (v: boolean) => void
  setSpacingVisible: (v: boolean) => void
  setTransVisible: (v: boolean) => void
  setTextSize: (size: 'small' | 'medium' | 'large') => void
  setActiveTab: (tab: 'story' | 'vocabulary' | 'grammar') => void
}

export const usePreferenceStore = create<PreferenceStoreState>()(
  persist(
    (set): PreferenceStoreState => ({
      rubyVisible: true,
      spacingVisible: false,
      transVisible: false,
      textSize: 'medium',
      activeTab: 'story',
      setRubyVisible: (v) => set({ rubyVisible: v }),
      setSpacingVisible: (v) => set({ spacingVisible: v }),
      setTransVisible: (v) => set({ transVisible: v }),
      setTextSize: (size) => set({ textSize: size }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'nihonnohon-preferences',
      partialize: (state) => ({
        rubyVisible: state.rubyVisible,
        spacingVisible: state.spacingVisible,
        transVisible: state.transVisible,
        textSize: state.textSize,
        activeTab: state.activeTab,
      }),
    },
  ),
)
```

`partialize` ensures only the five state fields are serialised to localStorage. Without it, Zustand would attempt to serialise the setter functions too (they serialise as `undefined`, which is harmless but noisy).

### lookupStore test pattern

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry } from '@nihonnohon/schema'

const entry: VocabEntry = {
  id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3',
}

afterEach(() => useLookupStore.getState()._reset())

describe('useLookupStore', () => {
  it('idle → found when lookup called with a valid entry', () => {
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'found', word: '食べる', entry })
    expect(state.selectedSentenceId).toBe('sent-1')
  })

  it('idle → not-found when lookup called with null entry', () => {
    useLookupStore.getState().lookup('べ', null, 'sent-2')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'not-found', word: 'べ' })
    expect(state.selectedSentenceId).toBe('sent-2') // sentence still selected
  })
  // ... etc
})
```

Note: `afterEach` at the top level (outside the `describe`) works — Vitest applies it to all tests in the file.

### preferenceStore test isolation — BOTH localStorage AND in-memory state

`localStorage.clear()` alone is not sufficient. The Zustand in-memory state persists between tests even when localStorage is cleared. Reset both:

```ts
const DEFAULT_STATE = {
  rubyVisible: true,
  spacingVisible: false,
  transVisible: false,
  textSize: 'medium' as const,
  activeTab: 'story' as const,
}

beforeEach(() => {
  localStorage.clear()
  usePreferenceStore.setState(DEFAULT_STATE)
})
```

`usePreferenceStore.setState(partialState)` merges (not replaces) state — passing all five fields fully resets the state values. The setters in the store are NOT overwritten by this (Zustand merges by default and won't replace function properties unless you pass `true` as the second argument to `setState`).

### Testing localStorage persistence (AC6 "persists across simulated reload")

Direct localStorage check (simplest):
```ts
it('writes changed preference to localStorage', () => {
  usePreferenceStore.getState().setRubyVisible(false)
  const stored = JSON.parse(localStorage.getItem('nihonnohon-preferences')!)
  expect(stored.state.rubyVisible).toBe(false)
})
```

The Zustand persist middleware writes to localStorage synchronously in jsdom (the default storage adapter is synchronous). No need to await anything.

### Store isolation rules — do NOT cross

```
lookupStore.ts  — NEVER imports from preferenceStore.ts
preferenceStore.ts — NEVER imports from lookupStore.ts
```

Both stores are shared state. They are consumed by components in later stories.

### What this story does NOT include

- `useShallow` selector usage — that's in components (Stories 2.3, 2.4)
- Calling `lookup()` from a `WordToken` — Story 2.3
- The `selectedSentenceId` driving `SentenceBlock` highlights — Story 2.3
- The vocab supplement lookup path (supplement takes precedence over `vocabService`) — Story 2.5
- `lookupVocab` / `lookupKanji` are NOT called here — the store takes a pre-resolved `VocabEntry | null`

### Project Structure Notes

**Files to UPDATE (read before modifying):**
- `apps/web/src/stores/lookupStore.ts` — complete `lookup` and `selectSentence` stubs only; preserve interface, `initialState`, `reset`, `_reset`
- `apps/web/src/stores/preferenceStore.ts` — add `PreferenceStoreState` interface with setters; add `partialize` to persist config; keep same default values

**Files to CREATE:**
- `apps/web/src/__tests__/lookupStore.test.ts`
- `apps/web/src/__tests__/preferenceStore.test.ts`

**No new packages. No changes to `@nihonnohon/schema` or `@nihonnohon/story-loader`.**

### Learnings from Story 2.1 (apply here)

- `try/finally` for any test that stubs globals or changes module-level state outside `beforeEach`/`afterEach`
- `afterEach` at describe-top-level scope is valid in Vitest and cleaner than per-describe nesting
- For the `lookup` double-found transition test, you can call `lookup()` twice — the second call replaces the first cleanly because `set({...})` replaces the top-level keys
- Both `reset()` and `_reset()` do the same thing in `lookupStore` (both call `set(initialState)`). The distinction is semantic: `reset()` is for production use; `_reset()` is the test-only convention from the architecture

### References

- `LookupState` discriminated union + `LookupStore` interface: [architecture.md — Canonical Type Definitions, State Management Patterns]
- `afterEach(_reset)` requirement: [architecture.md — Test isolation section]
- `useShallow` pattern for components (NOT stores): [architecture.md — Selector pattern]
- Store file locations: [project-context.md — Stores section]
- `persist` middleware key: [project-context.md — State Management section]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `lookupStore.ts`: `lookup` and `selectSentence` stubs replaced with full implementations. Key invariant: `selectedSentenceId` is set in both `found` and `not-found` branches of `lookup` — the sentence tap always registers. `reset`/`_reset` were already correct and untouched.
- `preferenceStore.ts`: added `PreferenceStoreState` interface with five setter actions; added `partialize` to `persist` config so only the five state fields (not functions) are written to localStorage. Skeleton default values unchanged.
- 7 new lookupStore tests cover all five state transitions plus initial state and `_reset`. `afterEach(_reset)` at file scope.
- 8 new preferenceStore tests cover defaults, all five setters, localStorage write verification, and `partialize` correctness (localStorage contains exactly 5 keys, no functions). `beforeEach` resets both localStorage and in-memory state.
- 32/32 tests pass, 0 regressions.

### File List

- `apps/web/src/stores/lookupStore.ts` (updated)
- `apps/web/src/stores/preferenceStore.ts` (updated)
- `apps/web/src/__tests__/lookupStore.test.ts` (new)
- `apps/web/src/__tests__/preferenceStore.test.ts` (new)

### Review Findings

- [x] [Review][Defer] `partialize` in `preferenceStore` manually lists all five state fields — adding a new persisted field requires remembering to update the list; silently drops persistence if missed [preferenceStore.ts:27] — deferred, v1 accepted limitation
- [x] [Review][Defer] `lookup(word, null, sentenceId)` accepts empty string `word` producing `{ status: 'not-found', word: '' }` — schema enforces `minLength:1` on `words`, so valid callers can't trigger this [lookupStore.ts:22] — deferred, loader validates upstream
- [x] [Review][Defer] `lookup(word, entry, sentenceId)` accepts empty string `sentenceId` storing `selectedSentenceId: ''` — schema enforces `minLength:1` on `sentence.id`, so valid callers can't trigger this [lookupStore.ts:24] — deferred, loader validates upstream
- [x] [Review][Defer] No `version` or migration config in `preferenceStore` `persist` options — stale `textSize` or `activeTab` values from old localStorage survive type changes silently [preferenceStore.ts:24] — deferred, migration strategy is a v2+ concern
