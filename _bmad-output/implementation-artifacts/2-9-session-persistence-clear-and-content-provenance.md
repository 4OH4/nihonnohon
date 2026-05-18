# Story 2.9: Session Persistence, Clear & Content Provenance

Status: done

## Story

As a content author,
I want my session automatically saved and restored when I reopen the tool, and a single Clear action to start fresh,
so that I never lose work and can always reset to a clean state.

## Acceptance Criteria

**AC1 — useSession writes SessionState to localStorage:**
Given any store state change,
when `useSession.ts` handles it,
then `SessionState` (with `version: 1`) is written to localStorage on phase transition or 300ms debounce on input change; write failures are caught silently without blocking the tool.

**AC2 — Session hydration on page load:**
Given the page loads and a session is present in localStorage,
when `useSession` hydrates,
then:
- version mismatch or parse error → full reset to defaults, no banner shown
- stale phases (`generating`, `cancelling`, `downloading`) with `outputJson` present → restore to `output-clean`; show banner
- stale phases with no `outputJson` → restore to `idle` with inputs pre-filled; show banner if inputs non-empty
- `outputIsDirty: true` + `outputJson` → restore to `output-dirty`; show banner
- `outputIsDirty: false` + `outputJson` → restore to `output-clean`; show banner
- `phase === 'idle'` with no inputs and no output → restore silently, no banner

**AC3 — SessionRestoreBanner:**
Given a non-idle session was restored,
when `SessionRestoreBanner` renders,
then it appears at the top of `InputPanel` (above the collapsed/expanded content): "Restored from previous session · Clear"; Clear link calls `store.clear()`; banner disappears on the first input edit (any change to story textarea, chapter selector, or steering instructions).

**AC4 — clear() resets everything:**
Given `clear()` is called from any phase,
when it executes,
then all store state resets to defaults; localStorage session is cleared; no confirmation shown; `InputSection` re-expands if collapsed (existing behaviour — `clear()` sets `phase: 'idle'`).

**AC5 — Content provenance note:**
Given `InputPanel` is rendered with the form expanded (not collapsed),
when the story textarea is visible,
then a one-line content provenance note appears below the story textarea: "English source material must be original or appropriately licensed."

**AC6 — useSession mounted in AuthoringTool:**
Given `useSession` is implemented,
when `AuthoringTool.tsx` renders,
then `useSession()` is called once at the root (alongside `useAgUiRun()`), so the hook is active for the lifetime of the app.

**AC7 — Tests pass:**
Given all hooks and components are implemented,
when `pnpm test:unit` and `pnpm typecheck` are run,
then:
- `useSession.test.ts`: version mismatch → `useSession` resets to defaults and shows no banner; stale `generating` phase with `outputJson` → restores to `output-clean` and sets `sessionRestored: true`; stale `generating` phase without `outputJson` → restores to `idle` with inputs pre-filled; `outputIsDirty: true` + `outputJson` → restores to `output-dirty`; write to localStorage called on phase change; write skipped on parse error
- `InputPanel.test.tsx`: `SessionRestoreBanner` visible when `sessionRestored: true`; clicking Clear calls `store.clear()`; editing story textarea clears `sessionRestored`; provenance note "English source material must be original or appropriately licensed." is visible in the expanded form
- no regressions in existing tests

## Tasks / Subtasks

- [x] AC1+AC2+AC4: Create `src/hooks/useSession.ts`
  - [ ] Define `SESSION_KEY = 'nihonnohon-sg-session'` constant
  - [ ] Define `SessionState` interface: `{ version: 1; phase: Phase; inputText: string; chapterTarget: string; steeringInstructions: string; pathMode: 'A' | 'B'; temperature: number; grammarDist: 0 | 1 | 2; outputJson: string | null; outputIsDirty: boolean }`
  - [ ] On mount (`useEffect(() => {...}, [])`): read localStorage silently; parse JSON; validate `version === 1`; on any error/mismatch → return without setting any state; map stale phases (`generating`, `cancelling`, `downloading`) → `output-clean` if `outputJson` else `idle`; batch-set store state via `useAuthoringStore.setState({...})`; call `useAuthoringStore.getState()._setSessionRestored(true)` if `outputJson !== null` or `inputText !== ''` or `chapterTarget !== ''`
  - [ ] Set up subscription (`useAuthoringStore.subscribe()`): when phase is `idle` AND `outputJson === null` AND `inputText === ''` AND `chapterTarget === ''` AND `steeringInstructions === ''` AND `!outputIsDirty` → `localStorage.removeItem(SESSION_KEY)` (catches silently); otherwise: schedule debounced write (300ms); immediate write on phase change; write `JSON.stringify({ version: 1, phase, inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist, outputJson, outputIsDirty })` to `localStorage.setItem(SESSION_KEY, ...)` silently on failure
  - [ ] Return `unsubscribe` from subscribe in `useEffect` cleanup
  - [ ] Debounce pattern: use a `debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)` for input-change debounce; clear it in cleanup; phase changes write immediately (compare prev and current phase)

- [x] AC3: Add `sessionRestored` and `_setSessionRestored` to `authoringStore.ts`
  - [x] Add `sessionRestored: boolean` to `AuthoringStore` interface
  - [x] Add `_setSessionRestored: (v: boolean) => void` to interface
  - [x] Add `sessionRestored: false` to `defaultState`
  - [x] Add `_setSessionRestored(v) { set({ sessionRestored: v }) }` to store implementation

- [x] AC3: Update `src/components/InputPanel.tsx` — `SessionRestoreBanner` + banner dismissal + provenance note
  - [x] Read `sessionRestored`, `_setSessionRestored`, `clear` from store
  - [x] Render `SessionRestoreBanner` at top of section (above collapsed/expanded content)
  - [x] Dismiss banner (`_setSessionRestored(false)`) in `handleInputChange`, `handleChapterChange`, steering `onChange`
  - [x] Content provenance note below story textarea

- [x] AC6: Update `src/components/AuthoringTool.tsx` — mount `useSession()`
  - [x] Import `useSession` from `@/hooks/useSession`
  - [x] Call `useSession()` alongside `useAgUiRun()`

- [x] AC7: Create `src/__tests__/useSession.test.ts`
  - [x] 18 tests covering: no-op when no session, version mismatch, invalid JSON, output-clean/dirty restore, stale phase mapping (generating/cancelling/downloading + output/no-output), idle-empty no banner, temperature/grammarDist/pathMode restore, subscription writes on phase change, clears localStorage on clear()

- [x] AC7: Update `src/__tests__/InputPanel.test.tsx` — SessionRestoreBanner + provenance note
  - [x] Banner visible/invisible, Clear button, textarea dismissal, chapter dismissal, provenance note

- [x] AC7: Run `pnpm test:unit` and `pnpm typecheck` from `apps/story-generator`

### Review Findings

- [x] [Review][Patch] Pending debounced write dropped on unmount — if user edits a field then closes the tab within 300ms, the last change is lost; flush the pending write synchronously in cleanup [useSession.ts]
- [x] [Review][Patch] `hasContent` omits `steeringInstructions` — a session with only steering instructions restores silently with no banner; add `session.steeringInstructions !== ''` to `hasContent` [useSession.ts]
- [x] [Review][Patch] `outputIsDirty: true` with `outputJson: null` restored as-is — inconsistent state; if `outputJson` is null, sanitize `outputIsDirty` to `false` on restore [useSession.ts]
- [x] [Review][Patch] Missing test: steering instructions edit clears `sessionRestored` — AC3 explicitly lists it; the production code is correct but no test covers it [InputPanel.test.tsx]
- [x] [Review][Defer] `sessionRestored` not cleared by SettingsPanel changes (temperature/grammarDist/pathMode) — banner persists after settings edit; minor UX; not worth the complexity for v1 [InputPanel.tsx]
- [x] [Review][Defer] `parsed as SessionState` skips field-level type validation — invalid `grammarDist`/`temperature` from corrupted localStorage accepted silently; v1 acceptable (single-user tool, self-written sessions) [useSession.ts]
- [x] [Review][Defer] `localStorage.setItem` quota exception silently swallowed — no user notification on write failure; accepted per spec (graceful degradation) [useSession.ts]
- [x] [Review][Defer] `prevPhase` not reset on remount — Strict Mode double-invoke causes a phase gap; dev-only concern; no production impact [useSession.ts]
- [x] [Review][Defer] Stale debounce races phase-change write — JS event queue race between timer callback and phase-change cancel; practically impossible; acceptable for v1 [useSession.ts]
- [x] [Review][Defer] `isClearedState` doesn't check `temperature`/`grammarDist` — custom settings lost after clear; correct behaviour (settings are inputs, not session content) [useSession.ts]
- [x] [Review][Defer] AC4 indirect localStorage clear — `clear()` removes session via subscription, not directly; only fails if `useSession` is unmounted when `clear()` is called, which cannot happen in the current UI [authoringStore.ts]
- [x] [Review][Defer] Debounce ref in React Strict Mode — timer ID reuse concern in Strict Mode double-invoke; dev-only; low impact [useSession.ts]
- [x] [Review][Defer] AC7 immediate-write timing test missing — test verifies side-effect (localStorage content) rather than timing; acceptable coverage for v1 [useSession.test.ts]
- [x] [Review][Defer] Whitespace-only `inputText` not in `isClearedState` — whitespace input is a valid edit; acceptable behaviour [useSession.ts]

## Dev Notes

### `SessionState` and storage key

```typescript
const SESSION_KEY = 'nihonnohon-sg-session'

interface SessionState {
  version: 1
  phase: Phase
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
  outputJson: string | null
  outputIsDirty: boolean
}
```

Not stored in session (no need — derived or ephemeral): `runId`, `storedInputs`, `agentRunStarted`, `proposalText`, `proposalApproved`, `errorCode`, `errorMessage`, `validationErrors`, `downloadToastId`, `sessionRestored`.

### Phase mapping on restore

```typescript
const STALE_PHASES = new Set(['generating', 'cancelling', 'downloading'])

function mapRestoredPhase(session: SessionState): Phase {
  if (STALE_PHASES.has(session.phase)) {
    return session.outputJson ? 'output-clean' : 'idle'
  }
  return session.phase  // idle, output-clean, output-dirty, error, proposal — restore as-is
}
```

### `useSession` full implementation outline

```typescript
export function useSession(): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // — Mount: hydrate from localStorage —
  useEffect(() => {
    let session: SessionState | null = null
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (
        typeof parsed !== 'object' || parsed === null ||
        (parsed as Record<string, unknown>).version !== 1
      ) return
      session = parsed as SessionState
    } catch {
      return
    }

    const restoredPhase = mapRestoredPhase(session)

    // Batch state update — one atomic write to the store
    useAuthoringStore.setState({
      phase: restoredPhase,
      inputText: session.inputText,
      chapterTarget: session.chapterTarget,
      steeringInstructions: session.steeringInstructions,
      pathMode: session.pathMode,
      temperature: session.temperature,
      grammarDist: session.grammarDist,
      outputJson: session.outputJson,
      outputIsDirty: session.outputIsDirty,
    })

    // Show banner if there's anything meaningful restored
    const hasContent = session.outputJson !== null ||
      session.inputText !== '' || session.chapterTarget !== ''
    if (hasContent) {
      useAuthoringStore.getState()._setSessionRestored(true)
    }
  }, [])  // runs once on mount

  // — Subscription: persist on store changes —
  useEffect(() => {
    const write = (state: ReturnType<typeof useAuthoringStore.getState>) => {
      const isClearedState = (
        state.phase === 'idle' &&
        state.outputJson === null &&
        state.inputText === '' &&
        state.chapterTarget === '' &&
        state.steeringInstructions === '' &&
        !state.outputIsDirty
      )
      if (isClearedState) {
        try { localStorage.removeItem(SESSION_KEY) } catch {}
        return
      }
      const sessionState: SessionState = {
        version: 1,
        phase: state.phase,
        inputText: state.inputText,
        chapterTarget: state.chapterTarget,
        steeringInstructions: state.steeringInstructions,
        pathMode: state.pathMode,
        temperature: state.temperature,
        grammarDist: state.grammarDist,
        outputJson: state.outputJson,
        outputIsDirty: state.outputIsDirty,
      }
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessionState)) } catch {}
    }

    let prevPhase = useAuthoringStore.getState().phase

    const unsub = useAuthoringStore.subscribe((state) => {
      const phaseChanged = state.phase !== prevPhase
      prevPhase = state.phase

      if (phaseChanged) {
        // Write immediately on phase transitions
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
        write(state)
      } else {
        // Debounce for input-only changes
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => write(state), 300)
      }
    })

    return () => {
      unsub()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return
}
```

### `authoringStore.ts` additions

**To `AuthoringStore` interface:**
```typescript
sessionRestored: boolean
_setSessionRestored: (v: boolean) => void
```

**To `defaultState`:**
```typescript
sessionRestored: false,
```

**To store implementation:**
```typescript
_setSessionRestored(v) { set({ sessionRestored: v }) },
```

`sessionRestored` resets to `false` automatically when `clear()` calls `set({ ...defaultState })`. No explicit call needed.

### `InputPanel.tsx` additions

**New store subscriptions (add to existing selector list):**
```typescript
const sessionRestored      = useAuthoringStore(s => s.sessionRestored)
const _setSessionRestored  = useAuthoringStore(s => s._setSessionRestored)
const clear                = useAuthoringStore(s => s.clear)
```

**`handleInputChange` update:**
```typescript
const handleInputChange = (v: string) => {
  setInputText(v)
  if (hints.story && v.trim() !== '') setHints(h => ({ ...h, story: false }))
  if (sessionRestored) _setSessionRestored(false)
}
```

**`handleChapterChange` update:**
```typescript
const handleChapterChange = (v: string) => {
  setChapterTarget(v)
  if (hints.chapter && v !== '') setHints(h => ({ ...h, chapter: false }))
  if (sessionRestored) _setSessionRestored(false)
}
```

**Steering `onChange` update:**
```typescript
onChange={e => {
  setSteeringInstructions(e.target.value)
  if (sessionRestored) _setSessionRestored(false)
}}
```

**`SessionRestoreBanner` JSX** — placed at the top of the `<section>` return, before `{isCollapsed && ...}`:
```tsx
{sessionRestored && (
  <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm">
    <span className="text-muted">Restored from previous session</span>
    <span aria-hidden="true">·</span>
    <button
      type="button"
      onClick={clear}
      className="text-accent hover:text-accent/80 focus-visible:ring-2 ring-accent outline-none rounded"
    >
      Clear
    </button>
  </div>
)}
```

**Content provenance note** — added inside the `{!isCollapsed && (...)}` block, immediately after the `{hints.story && <p>...}` hint block (still inside the first `<div>` for the textarea, after the error hint):
```tsx
<p className="text-xs text-muted mt-1">
  English source material must be original or appropriately licensed.
</p>
```

### `AuthoringTool.tsx` change

```typescript
// BEFORE:
import { useAgUiRun } from '@/hooks/useAgUiRun'
// ...
export function AuthoringTool() {
  useAgUiRun()

// AFTER:
import { useAgUiRun } from '@/hooks/useAgUiRun'
import { useSession } from '@/hooks/useSession'
// ...
export function AuthoringTool() {
  useAgUiRun()
  useSession()
```

### Test patterns for `useSession.test.ts`

`useSession` is a hook that runs side effects via `useEffect`. Testing pattern: render a minimal component, set localStorage before render, then assert store state after render.

```typescript
import { renderHook } from '@testing-library/react'
import { act } from '@testing-library/react'
import { useSession } from '@/hooks/useSession'
import { useAuthoringStore } from '@/stores/authoringStore'

// Export SESSION_KEY from useSession for test use
import { SESSION_KEY } from '@/hooks/useSession'

const writeSession = (overrides: Partial<Record<string, unknown>> = {}) => {
  const defaults = {
    version: 1,
    phase: 'output-clean',
    inputText: 'A sample story',
    chapterTarget: 'Genki I Ch.3',
    steeringInstructions: '',
    pathMode: 'A',
    temperature: 1.0,
    grammarDist: 1,
    outputJson: '{"test":true}',
    outputIsDirty: false,
    ...overrides,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(defaults))
}

describe('useSession', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  it('no-op when no session stored', () => {
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('ignores version mismatch', () => {
    writeSession({ version: 2 })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('ignores invalid JSON', () => {
    localStorage.setItem(SESSION_KEY, 'not-json')
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('restores output-clean session with banner', () => {
    writeSession({ phase: 'output-clean', outputJson: '{}', outputIsDirty: false })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputJson).toBe('{}')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('maps stale generating phase + outputJson → output-clean', () => {
    writeSession({ phase: 'generating', outputJson: '{"old":true}', outputIsDirty: false })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('maps stale generating phase + no outputJson → idle with inputs', () => {
    writeSession({ phase: 'generating', outputJson: null, inputText: 'My story', outputIsDirty: false })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().inputText).toBe('My story')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('restores output-dirty session', () => {
    writeSession({ phase: 'output-dirty', outputJson: '{}', outputIsDirty: true })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('idle session with empty inputs → no banner', () => {
    writeSession({ phase: 'idle', outputJson: null, inputText: '', chapterTarget: '' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('writes session to localStorage on store change', async () => {
    renderHook(() => useSession())
    act(() => {
      useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    })
    // Phase change triggers immediate write
    await new Promise(r => setTimeout(r, 0))
    const stored = localStorage.getItem(SESSION_KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).outputJson).toBe('{"id":"test"}')
  })

  it('clears localStorage when store is reset to default state', async () => {
    writeSession()
    renderHook(() => useSession())
    act(() => {
      useAuthoringStore.getState().clear()
    })
    await new Promise(r => setTimeout(r, 50))  // wait for debounce/immediate write
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
```

**Note on export:** `useSession.ts` should export `SESSION_KEY` for use in tests:
```typescript
export const SESSION_KEY = 'nihonnohon-sg-session'
```

### `InputPanel.test.tsx` additions

```typescript
import { act } from '@testing-library/react'

// Existing describe block has store reset in beforeEach — add these tests:

describe('InputPanel — SessionRestoreBanner', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })
  afterEach(() => { useAuthoringStore.getState()._reset() })

  it('shows banner when sessionRestored is true', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    expect(screen.getByText(/restored from previous session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^clear$/i })).toBeInTheDocument()
  })

  it('does not show banner when sessionRestored is false', () => {
    render(<InputPanel />)
    expect(screen.queryByText(/restored from previous session/i)).not.toBeInTheDocument()
  })

  it('Clear button in banner calls store.clear()', () => {
    act(() => {
      useAuthoringStore.setState({ sessionRestored: true, inputText: 'some text' })
    })
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().inputText).toBe('')
  })

  it('editing story textarea clears sessionRestored', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('textbox', { name: /english story/i }), {
      target: { value: 'new text' },
    })
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })
})

describe('InputPanel — content provenance note', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })

  it('shows provenance note in expanded form', () => {
    render(<InputPanel />)
    expect(screen.getByText(/english source material must be original/i)).toBeInTheDocument()
  })
})
```

### What is explicitly NOT in this story scope

- **Path B / topic input** — `pathMode === 'B'` is stored in session state but Path B UI is Story 4.x
- **`proposalText` session persistence** — not in SessionState; proposal state is ephemeral (M3 scope)
- **`temperature` and `grammarDist` in SessionRestoreBanner** — not mentioned in ACs; they are persisted silently
- **`errorCode`/`errorMessage` session persistence** — errors are not stored; restored session may be `error` phase if stored, but it's restorable as `error` (the `mapRestoredPhase` function only remaps the three stale phases; `error` is kept as-is since the user may want to retry after reopening)
- **Multi-tab conflict handling** — not required for v1; tabs can diverge silently
- **`storedInputs` persistence** — not in session; after restore, Re-run will be disabled until a new `generate()` is called (correct — `storedInputs` is a generation-time snapshot)

### Key patterns from previous stories

**Store selector granularity (Stories 2.3–2.8):** Subscribe to individual fields with granular selectors — `useAuthoringStore(s => s.sessionRestored)` — never the whole store.

**`useAuthoringStore.subscribe()` pattern (from story-generator-context):** For non-reactive side effects (localStorage writes), use the Zustand subscribe API directly rather than `useEffect` + store selectors. This avoids React render cycles for every keystroke.

**`_reset()` in test setup:** Always call `useAuthoringStore.getState()._reset()` in `beforeEach` AND `afterEach` to avoid test pollution. Also call `localStorage.clear()` in `beforeEach` for session tests.

**`useEffect(fn, [])` for one-shot mount effects:** The hydration effect runs exactly once on mount. Do not add dependencies that would re-trigger it.

**Deferred from 2-3 that Story 2.9 must NOT regress:**
- `useBackendStatus` concurrent in-flight fetch — pre-existing; not touched here
- `proposalText` not cleared on mode switch — M3 scope; not touched

### References

- [epics-story-authoring-tool.md — Story 2.9 ACs](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [story-generator-context.md — SessionState schema, ARCH-10, session hydration rules](../../_bmad-output/story-generator-context.md)
- [architecture-story-authoring-tool.md — localStorage schema, restore mapping, session write pattern](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [2-8 story — store pattern, test mocking conventions, vi.mock usage](./2-8-client-side-validation-suite-story-download-and-statsbar.md)
- [authoringStore.ts — current store interface, defaultState, clear() implementation](../../apps/story-generator/src/stores/authoringStore.ts)
- [InputPanel.tsx — current structure, handleInputChange/handleChapterChange patterns, collapse logic](../../apps/story-generator/src/components/InputPanel.tsx)
- [AuthoringTool.tsx — useAgUiRun() mount pattern to follow](../../apps/story-generator/src/components/AuthoringTool.tsx)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/hooks/useSession.ts`: mount effect hydrates store from localStorage (maps stale phases, sets sessionRestored); subscribe effect persists on phase changes (immediate) and input changes (300ms debounce); removes session when store reaches cleared/default state; exported `SESSION_KEY` for tests.
- Updated `authoringStore.ts`: added `sessionRestored: boolean` + `_setSessionRestored(v)` internal action; resets to false via `defaultState` on `clear()`.
- Updated `src/components/InputPanel.tsx`: SessionRestoreBanner at top of section; provenance note below textarea; banner dismissal (`_setSessionRestored(false)`) wired into `handleInputChange`, `handleChapterChange`, and steering `onChange`.
- Updated `src/components/AuthoringTool.tsx`: `useSession()` mounted alongside `useAgUiRun()`.
- Created `src/__tests__/useSession.test.ts`: 18 tests covering all hydration scenarios and subscription behaviour.
- Updated `src/__tests__/InputPanel.test.tsx`: 7 new tests for SessionRestoreBanner and provenance note.
- Final count: 180 tests pass across 10 test files; typecheck clean.
- Review patches applied: flush-on-unmount, steeringInstructions in hasContent, outputIsDirty sanitization, steering dismissal test.

### File List

- apps/story-generator/src/hooks/useSession.ts (new)
- apps/story-generator/src/stores/authoringStore.ts (modified — sessionRestored, _setSessionRestored)
- apps/story-generator/src/components/InputPanel.tsx (modified — SessionRestoreBanner, provenance note, banner dismissal)
- apps/story-generator/src/components/AuthoringTool.tsx (modified — useSession() mounted)
- apps/story-generator/src/__tests__/useSession.test.ts (new)
- apps/story-generator/src/__tests__/InputPanel.test.tsx (modified — SessionRestoreBanner + provenance tests)

## Change Log

- 2026-05-18: Story 2.9 implemented — useSession, SessionRestoreBanner, content provenance note, sessionRestored store field (Date: 2026-05-18)
