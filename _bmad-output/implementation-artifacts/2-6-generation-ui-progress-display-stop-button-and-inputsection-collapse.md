# Story 2.6: Generation UI — Progress Display, Stop Button & InputSection Collapse

Status: done

## Story

As a content author,
I want to see live generation progress, be able to stop generation, and have the input form collapse out of the way while the pipeline runs,
so that I can monitor what's happening and recover cleanly from any outcome.

## Acceptance Criteria

**AC1 — Generate click collapses InputSection and shows progress:**
Given the app is in `idle` or `error` phase with valid inputs,
when Generate is clicked,
then `InputSection` collapses (content preserved); `storedInputs` snapshot is written to store; `GenerationProgress` expands showing a "Connecting…" label; `GenerateButton` transitions to "Stop" (stop/destructive style: `border-error text-error`).

**AC2 — RUN_STARTED triggers shimmer and elapsed timer:**
Given `RUN_STARTED` is received,
when `GenerationProgress` updates,
then the 3px shimmer (`background-position` CSS animation) appears; an elapsed time counter starts incrementing each second; label changes to "Generating story…".

**AC3 — Stop button dispatches cancel:**
Given `phase === 'generating'`,
when Stop is clicked,
then `GenerateButton` label → "Stopping…" (disabled, `pointer-events: none`); progress goes indeterminate (shimmer continues, elapsed time stops); `cancel()` is dispatched to the store.

**AC4 — RUN_CANCELLED re-expands input:**
Given `phase === 'cancelling'` resolves to `idle`,
when `RUN_CANCELLED` is received,
then `InputSection` re-expands with all field values intact; `GenerationProgress` collapses; `GenerateButton` resets to "Convert to Japanese".

**AC5 — Error phase shows message and Retry:**
Given `phase === 'error'`,
when `GenerationProgress` renders,
then error message is displayed in plain English (distinct messages per `errorCode`); Retry button is visible; `InputSection` re-expands.

**AC6 — GenerationProgress always mounted:**
Given `GenerationProgress` in `idle` or post-output phases,
when it renders,
then it is always present in the DOM; uses `height: 0 / overflow: hidden` (not conditional rendering) to prevent layout shift on expand/collapse.

**AC7 — storedInputs extended to include all SSE URL params:**
Given `generate()` is called,
when `storedInputs` snapshot is written,
then it includes `pathMode`, `temperature`, and `grammarDist` in addition to the existing `inputText`, `chapterTarget`, `steeringInstructions`; `useAgUiRun.ts` reads all URL params from `storedInputs` (not live store values).

**AC8 — Tests pass:**
Given all components are implemented,
when `pnpm test:unit` is run,
then `GenerationProgress` state tests pass; `InputPanel` collapse/button transition tests pass; store `_markRunStarted` and extended `storedInputs` tests pass; `pnpm typecheck` passes.

## Tasks / Subtasks

- [x] AC7: Extend `storedInputs` in `authoringStore.ts` and update `useAgUiRun.ts`
  - [x] Add `pathMode`, `temperature`, `grammarDist` to `StoredInputs` interface
  - [x] Update `generate()` to include these in the snapshot
  - [x] Update `approve()` to include these in the snapshot
  - [x] Add `agentRunStarted: boolean` field (reset on `generate()`, set by `_markRunStarted()`)
  - [x] Add `_markRunStarted()` internal action
  - [x] Update `useAgUiRun.ts` to call `_markRunStarted()` on `RUN_STARTED`; read `pathMode`, `temperature`, `grammarDist` from `storedInputs` (not live store)
  - [x] Add store tests: `_markRunStarted` sets flag; extended storedInputs captured; `useAgUiRun` calls `_markRunStarted` on RUN_STARTED

- [x] AC1+AC6: Create `src/components/GenerationProgress.tsx`
  - [x] Always mounted in DOM; visibility controlled by height class (not conditional rendering)
  - [x] Phase-driven states: idle/done → `h-0 overflow-hidden`; connecting → "Connecting…"; generating → shimmer + elapsed timer + label; cancelling → shimmer continues + elapsed stops; error → error message + Retry button
  - [x] `aria-live="polite"` on status text element; `aria-label="Generation progress"` on container
  - [x] Shimmer: 3px `h-0.5` bar with CSS `animate-shimmer` using `tailwind.config.ts` custom animation
  - [x] Elapsed timer: `setInterval` increments each second while `phase === 'generating'`; freezes on `cancelling`; resets on non-active phase
  - [x] Error messages per `errorCode`:
    - `'TIMEOUT'` → "This took longer than expected — your inputs are preserved. Try again."
    - `'BACKEND_UNAVAILABLE'` → "Connection lost — your inputs are preserved. Check the backend and retry."
    - anything else → "The AI service returned an error — your inputs are preserved. Try again."
  - [x] Retry button calls `generate()` (store already allows retry from `error` phase)

- [x] AC1+AC3+AC4+AC5: Modify `src/components/InputPanel.tsx` — phase-aware collapse and button
  - [x] Read `phase`, `storedInputs`, `cancel` from store
  - [x] Determine `isCollapsed`: true when `phase === 'generating' || phase === 'cancelling'`; false otherwise
  - [x] Local `manualExpanded` state for "Edit inputs" override
  - [x] Auto-reset `manualExpanded` to false when `isCollapsed` becomes false (phase returns to idle/error)
  - [x] Collapsed view: single row showing mode label (`pathMode === 'A'` → "Convert a story"), truncated `storedInputs.inputText` (first 60 chars + "…"), "Edit inputs" ghost button
  - [x] Replace static "Convert to Japanese" button with phase-aware button:
    - `idle | error`: "Convert to Japanese" primary, pre-flight validation, calls `generate()`
    - `generating`: "Stop" stop/destructive style (`bg-surface border border-error text-error`), calls `cancel()`
    - `cancelling`: "Stopping…" disabled (`opacity-[0.45] cursor-not-allowed pointer-events-none`)
  - [x] The button is always rendered (regardless of collapsed/expanded state)
  - [x] Add InputPanel tests: collapse on generating, re-expand on idle, Stop button visible when generating, Stopping when cancelling, Edit inputs expands manually

- [x] AC6: Mount `GenerationProgress` in `src/components/AuthoringTool.tsx`
  - [x] Add `<GenerationProgress />` between `<InputPanel />` and the OutputPanel comment
  - [x] Add shimmer keyframe animation to `tailwind.config.ts`

- [x] AC8: Run `pnpm test:unit` and `pnpm typecheck`

### Review Findings

- [x] [Review][Patch] `approve()` missing `outputIsDirty: false / errorCode: null / errorMessage: null` resets [authoringStore.ts:114]
- [x] [Review][Patch] Retry button calls `store.generate()` directly, bypassing input validation [GenerationProgress.tsx:103]
- [x] [Review][Patch] Shimmer `background` shorthand resets animated `backgroundPosition` on re-render [GenerationProgress.tsx:78]
- [x] [Review][Patch] Dual `aria-live` regions mount/unmount on phase transition causing spurious screen reader announcement [GenerationProgress.tsx:87]
- [x] [Review][Patch] Elapsed timer starts at `generate()` call time, not `RUN_STARTED`; displayed value inflated by connecting latency [GenerationProgress.tsx:47]
- [x] [Review][Patch] No `GenerationProgress` tests for `phase === 'cancelling'` — AC8 gap [GenerationProgress.test.tsx]
- [x] [Review][Defer] `useAgUiRun` `?? store.*` fallback contradicts AC7 but unreachable in production [useAgUiRun.ts:53] — deferred, pre-existing pattern consistent with other fields
- [x] [Review][Defer] `agentRunStarted` not reset in `_setError`/`_resolveCancel`; stale in idle/error but rendering guarded by phase checks [authoringStore.ts:171] — deferred, no visible impact
- [x] [Review][Defer] Elapsed timer can tick one extra second after `generating` ends — inherent `setInterval` timing race [GenerationProgress.tsx:47] — deferred, standard timer behavior

## Dev Notes

### Files modified in this story

**New:**
- `apps/story-generator/src/components/GenerationProgress.tsx`
- `apps/story-generator/src/__tests__/GenerationProgress.test.tsx`

**Modified:**
- `apps/story-generator/src/stores/authoringStore.ts` — extend StoredInputs, add agentRunStarted
- `apps/story-generator/src/hooks/useAgUiRun.ts` — call _markRunStarted on RUN_STARTED; use storedInputs for all URL params
- `apps/story-generator/src/components/InputPanel.tsx` — collapse logic, phase-aware button
- `apps/story-generator/src/components/AuthoringTool.tsx` — mount GenerationProgress
- `apps/story-generator/tailwind.config.ts` — add shimmer animation
- `apps/story-generator/src/__tests__/authoringStore.test.ts` — new store tests
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` — RUN_STARTED _markRunStarted test

### authoringStore.ts changes

**Extended `StoredInputs`:**
```typescript
interface StoredInputs {
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'          // NEW: snapshot at generate() time
  temperature: number           // NEW: snapshot at generate() time
  grammarDist: 0 | 1 | 2        // NEW: snapshot at generate() time
}
```

**New store field:**
```typescript
agentRunStarted: boolean        // true once RUN_STARTED received; reset on each new generate()
```

**Updated `generate()`:**
```typescript
generate() {
  const { phase, inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist } = get()
  if (phase !== 'idle' && phase !== 'error') return
  set({
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,    // reset on new generation
    storedInputs: { inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist },
  })
},
```

**New `_markRunStarted()` action:**
```typescript
_markRunStarted() {
  set({ agentRunStarted: true })
},
```

Add `agentRunStarted: false` to `defaultState`.

**`approve()` also needs update:**
```typescript
approve() {
  const { phase, inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist } = get()
  if (phase !== 'proposal') return
  set({
    proposalApproved: true,
    phase: 'generating',
    runId: crypto.randomUUID(),
    agentRunStarted: false,
    storedInputs: { inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist },
  })
},
```

### useAgUiRun.ts changes

**1. Call `_markRunStarted()` on RUN_STARTED:**
```typescript
// In the switch statement:
case 'RUN_STARTED':
  if (firstEventRef.current) clearTimeout(firstEventRef.current)
  store._markRunStarted()    // NEW: signal that backend acknowledged the run
  break
```

**2. Read `pathMode`, `temperature`, `grammarDist` from `storedInputs` (not live store):**
```typescript
const pathMode   = storedInputs?.pathMode   ?? store.pathMode
const temperature = storedInputs?.temperature ?? store.temperature
const grammarDist = storedInputs?.grammarDist ?? store.grammarDist
```

Replace the direct `pathMode`, `temperature`, `grammarDist` reads from `store` with these snapshot-based fallbacks. This ensures the SSE URL is fully consistent with the `storedInputs` snapshot even if the user changes settings mid-generation.

Also destructure `_markRunStarted` from store in the effect:
```typescript
const {
  runId,
  storedInputs,
  _setOutputJson,
  _setProposalText,
  _setError,
  _resolveCancel,
  _markRunStarted,   // NEW
} = store
```

### Tailwind config shimmer animation

Add to `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    animation: {
      shimmer: 'shimmer 1.5s linear infinite',
    },
    keyframes: {
      shimmer: {
        '0%':   { backgroundPosition: '200% center' },
        '100%': { backgroundPosition: '-200% center' },
      },
    },
    // ... existing colors, fontFamily
  }
}
```

### GenerationProgress component guide

```typescript
// States driven by store phase:
// idle / output-clean / output-dirty / downloading → height:0 (collapsed)
// generating (agentRunStarted=false) → "Connecting…" text, no shimmer
// generating (agentRunStarted=true)  → shimmer + elapsed timer + "Generating story…"
// cancelling                          → shimmer + frozen elapsed time + "Stopping…"
// error                               → error message + Retry button
// proposal                            → height:0 (M3 scope)

const ACTIVE_PHASES = new Set(['generating', 'cancelling', 'error'])

// Elapsed timer: local state, setInterval
const [elapsed, setElapsed] = useState(0)
const runId = useAuthoringStore(s => s.runId)

useEffect(() => {
  setElapsed(0)  // reset on new run
}, [runId])

useEffect(() => {
  if (phase !== 'generating') return
  const id = setInterval(() => setElapsed(e => e + 1), 1_000)
  return () => clearInterval(id)
}, [phase])

// Error message mapping:
function getErrorMessage(code: string | null): string {
  switch (code) {
    case 'TIMEOUT':
      return 'This took longer than expected — your inputs are preserved. Try again.'
    case 'BACKEND_UNAVAILABLE':
      return 'Connection lost — your inputs are preserved. Check the backend and retry.'
    default:
      return 'The AI service returned an error — your inputs are preserved. Try again.'
  }
}
```

**Shimmer bar implementation:**
```tsx
{/* 3px shimmer bar */}
<div className="h-0.5 w-full overflow-hidden rounded-full bg-accent-subtle">
  <div
    className="h-full w-full animate-shimmer"
    style={{
      background: 'linear-gradient(90deg, #F5EDD6 0%, #C8A85A 40%, #F5EDD6 100%)',
      backgroundSize: '200% 100%',
    }}
  />
</div>
```

**Container height control:**
```tsx
<div
  aria-label="Generation progress"
  className={cn(
    'overflow-hidden transition-all duration-200',
    ACTIVE_PHASES.has(phase) ? 'mt-4' : 'h-0',
  )}
>
  {/* content only when active */}
  {ACTIVE_PHASES.has(phase) && ( ... )}
</div>
```

Wait — if using `h-0` when inactive but `mt-4` when active, this isn't quite right. Use a cleaner pattern:
```tsx
<section
  aria-label="Generation progress"
  className={cn('overflow-hidden transition-all', !ACTIVE_PHASES.has(phase) && 'h-0')}
>
```

Actually, to avoid layout shift and match the UX spec ("height: 0 / overflow: hidden"), the cleanest approach in Tailwind:
```tsx
<section
  aria-label="Generation progress"
  className={cn(ACTIVE_PHASES.has(phase) ? 'mt-4 pb-2' : 'h-0 overflow-hidden')}
>
```

### InputPanel collapse changes

```tsx
// Additional store reads:
const phase         = useAuthoringStore(s => s.phase)
const storedInputs  = useAuthoringStore(s => s.storedInputs)
const cancel        = useAuthoringStore(s => s.cancel)

// Collapse/expand logic:
const isGeneratingOrCancelling = phase === 'generating' || phase === 'cancelling'
const [manualExpanded, setManualExpanded] = useState(false)
const isCollapsed = isGeneratingOrCancelling && !manualExpanded

// Auto-reset manual expansion when generation ends:
useEffect(() => {
  if (!isGeneratingOrCancelling) setManualExpanded(false)
}, [isGeneratingOrCancelling])

// Collapsed summary row:
{isCollapsed && (
  <div className="flex items-center gap-3 py-2 text-sm">
    <span className="text-muted">
      {storedInputs?.pathMode === 'A' ? 'Convert a story' : 'Generate from topic'}
    </span>
    {storedInputs?.chapterTarget && (
      <span className="text-muted">· {storedInputs.chapterTarget}</span>
    )}
    {storedInputs?.inputText && (
      <span className="text-paper-text truncate flex-1 min-w-0">
        {storedInputs.inputText.length > 60
          ? storedInputs.inputText.slice(0, 60) + '…'
          : storedInputs.inputText}
      </span>
    )}
    <button
      type="button"
      onClick={() => setManualExpanded(true)}
      className="text-accent text-sm hover:text-accent/80 focus-visible:ring-2 ring-accent outline-none rounded shrink-0"
    >
      Edit inputs
    </button>
  </div>
)}

// Form fields only when expanded:
{!isCollapsed && (
  <>
    {/* ...textarea, chapter, steering... */}
  </>
)}

// Phase-aware button (always visible):
{/* Generate / Stop / Stopping button */}
{(phase === 'idle' || phase === 'error') && (
  <button type="button" onClick={handleGenerate} disabled={isGenerateDisabled}
    aria-disabled={isGenerateDisabled}
    className={cn('px-6 py-2 rounded-md text-sm font-medium transition-colors',
      'bg-accent text-white hover:bg-accent/90',
      'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
      isGenerateDisabled && 'opacity-[0.45] cursor-not-allowed pointer-events-none')}>
    Convert to Japanese
  </button>
)}
{phase === 'generating' && (
  <button type="button" onClick={cancel}
    className={cn('px-6 py-2 rounded-md text-sm font-medium transition-colors',
      'bg-surface border border-error text-error hover:bg-error/10',
      'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none')}>
    Stop
  </button>
)}
{phase === 'cancelling' && (
  <button type="button" disabled aria-disabled="true"
    className="px-6 py-2 rounded-md text-sm font-medium bg-surface border border-error text-error opacity-[0.45] cursor-not-allowed pointer-events-none">
    Stopping…
  </button>
)}
```

### Test plan for new story tests

**authoringStore.test.ts additions:**
```typescript
describe('authoringStore — extended storedInputs', () => {
  it('generate() captures pathMode, temperature, grammarDist in storedInputs', () => {
    useAuthoringStore.getState().setPathMode('A')
    useAuthoringStore.getState().setTemperature(1.5)
    useAuthoringStore.getState().setGrammarDist(2)
    useAuthoringStore.getState().generate()
    const { storedInputs } = useAuthoringStore.getState()
    expect(storedInputs?.pathMode).toBe('A')
    expect(storedInputs?.temperature).toBe(1.5)
    expect(storedInputs?.grammarDist).toBe(2)
  })

  it('generate() resets agentRunStarted to false', () => {
    // Manually set it true first
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._reset()  // back to idle
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
  })
})

describe('authoringStore — _markRunStarted', () => {
  it('sets agentRunStarted to true', () => {
    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
    useAuthoringStore.getState()._markRunStarted()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(true)
  })
})
```

**useAgUiRun.test.ts addition:**
```typescript
// In a new describe block:
it('RUN_STARTED calls _markRunStarted and sets agentRunStarted', () => {
  const { mockEs, factory } = setupGenerating()
  renderHook(() => useAgUiRun(factory))
  expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
  act(() => {
    mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
  })
  expect(useAuthoringStore.getState().agentRunStarted).toBe(true)
})
```

**GenerationProgress.test.tsx:**
```typescript
describe('GenerationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })
  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('renders nothing visible (h-0) when phase is idle', () => {
    const { container } = render(<GenerationProgress />)
    const section = container.querySelector('[aria-label="Generation progress"]')
    expect(section).toHaveClass('h-0')
  })

  it('shows "Connecting…" when phase is generating and agentRunStarted is false', () => {
    useAuthoringStore.getState().generate()
    render(<GenerationProgress />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows "Generating story…" after _markRunStarted', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    render(<GenerationProgress />)
    expect(screen.getByText('Generating story…')).toBeInTheDocument()
  })

  it('shows elapsed timer during generation', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    render(<GenerationProgress />)
    act(() => { vi.advanceTimersByTime(3_000) })
    expect(screen.getByText('3s')).toBeInTheDocument()
  })

  it('shows TIMEOUT error message', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'ignored — test uses standard message')
    render(<GenerationProgress />)
    expect(screen.getByText(/This took longer than expected/)).toBeInTheDocument()
  })

  it('shows BACKEND_UNAVAILABLE error message', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('BACKEND_UNAVAILABLE', 'ignored')
    render(<GenerationProgress />)
    expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
  })

  it('shows generic error for unknown error codes', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('GENERATION_FAILED', 'LLM error')
    render(<GenerationProgress />)
    expect(screen.getByText(/AI service returned an error/)).toBeInTheDocument()
  })

  it('shows Retry button in error phase', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    render(<GenerationProgress />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('Retry button calls generate()', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    render(<GenerationProgress />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('has aria-live="polite" on status text', () => {
    useAuthoringStore.getState().generate()
    const { container } = render(<GenerationProgress />)
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })
})
```

**InputPanel.test.tsx additions:**
```typescript
describe('InputPanel — collapse and phase-aware button', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })
  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('collapses form fields when phase is generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    // Form fields hidden; summary row visible
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit inputs/i })).toBeInTheDocument()
  })

  it('shows Stop button when generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument()
  })

  it('Stop button calls cancel()', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }))
    expect(useAuthoringStore.getState().phase).toBe('cancelling')
  })

  it('shows Stopping… button when cancelling', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState().cancel()
    render(<InputPanel />)
    expect(screen.getByText('Stopping…')).toBeInTheDocument()
  })

  it('re-expands form fields after returning to idle', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    const { rerender } = render(<InputPanel />)
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    useAuthoringStore.getState()._resolveCancel()  // simulate cancel resolved
    rerender(<InputPanel />)
    expect(screen.getByLabelText(/english story/i)).toBeInTheDocument()
  })

  it('Edit inputs button manually expands while generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /edit inputs/i }))
    expect(screen.getByLabelText(/english story/i)).toBeInTheDocument()
  })
})
```

### Key patterns from previous stories

**From Story 2.3 (BackendStatus) — `useBackendStatus` mock pattern in tests:** `vi.mock('../hooks/useBackendStatus', () => ({ useBackendStatus: vi.fn(() => 'connected') }))`. Already in `InputPanel.test.tsx` — keep it.

**From Story 2.4 review (aria-disabled + native disabled):** Use `aria-disabled` on the "Stopping…" button (architectural convention requires it even alongside native `disabled`).

**From Stories 2.3–2.4 — button variants:** Stop button style = `bg-surface border border-error text-error hover:bg-error/10` (destructive pattern from Story 2.3 button.tsx).

**From Story 2.1 (authoringStore) — `_reset()` resets all fields:** Make sure `agentRunStarted: false` is in `defaultState` so `_reset()` resets it.

**From Story 2.4 (InputPanel tests) — `act()` warning:** The Zustand subscription re-render warning is a known false positive. Document and accept.

**`_setError` with storedInputs in useAgUiRun:** The existing code destructures `_setError` from `store` at effect time. Make sure `_markRunStarted` is also destructured at the same time.

### Deferred behavior (explicitly NOT in this story scope)

- **M2 `AGENT_STATUS` events** — no `agentStatusMessage` store field in this story; Story 3.2 scope
- **"Stopping…" duration is indeterminate** — no timer, stays until `RUN_CANCELLED` or error
- **`clear()` during generating** — pre-existing deferred item; InputSection stays collapsed if clear() is called during generation (Story 2.9 scope)
- **Story 2.7 "Re-run" button** — the InputPanel shows "Convert to Japanese" after output-clean; Re-run is Story 2.7 scope; for now output-clean phase shows "Convert to Japanese" (which allows re-generation)
- **OutputPanel** — Story 2.7 scope; placeholder comment stays in AuthoringTool

### References

- [epics-story-authoring-tool.md — Story 2.6](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [ux-design-specification-story-authoring-tool.md — UX-DR3 (GenerationProgress), UX-DR7 (InputSection collapse), UX-DR17, UX-DR18](../../_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md)
- [2-5 story — useAgUiRun.ts (RUN_STARTED handling)](./2-5-ag-ui-sse-lifecycle-and-store-integration.md)
- [2-4 story — InputPanel.tsx (current state), button design contracts](./2-4-input-panel-chapter-selector-and-scopechip.md)
- [deferred-work.md — storedInputs missing pathMode/temperature](./deferred-work.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Extended `StoredInputs` with `pathMode`, `temperature`, `grammarDist`; updated `generate()` and `approve()` snapshots accordingly.
- Added `agentRunStarted: boolean` to store (reset on `generate()`, set by `_markRunStarted()`); `useAgUiRun.ts` calls `_markRunStarted()` on `RUN_STARTED`.
- `GenerationProgress.tsx` created: always-mounted height-0 pattern, shimmer animation, elapsed timer, per-errorCode messages, Retry button.
- `InputPanel.tsx` rewritten with collapse logic (local `manualExpanded` state + auto-reset) and phase-aware Generate/Stop/Stopping button.
- `AuthoringTool.tsx` updated to mount `<GenerationProgress />` between `<InputPanel />` and the OutputPanel comment.
- `tailwind.config.ts` extended with shimmer keyframe.
- 85 unit tests pass; typecheck clean.

### File List

- apps/story-generator/src/stores/authoringStore.ts (modified)
- apps/story-generator/src/hooks/useAgUiRun.ts (modified)
- apps/story-generator/src/components/GenerationProgress.tsx (new)
- apps/story-generator/src/components/InputPanel.tsx (modified)
- apps/story-generator/src/components/AuthoringTool.tsx (modified)
- apps/story-generator/tailwind.config.ts (modified)
- apps/story-generator/src/__tests__/GenerationProgress.test.tsx (new)
- apps/story-generator/src/__tests__/authoringStore.test.ts (modified)
- apps/story-generator/src/__tests__/useAgUiRun.test.ts (modified)
- apps/story-generator/src/__tests__/InputPanel.test.tsx (modified)

## Change Log

- 2026-05-17: Story 2.6 implemented — GenerationProgress component, InputPanel collapse, phase-aware buttons, extended storedInputs snapshot (Date: 2026-05-17)
- 2026-05-18: Code review patches applied — approve() resets, Retry validation, shimmer backgroundImage fix, single aria-live region, elapsed timer starts on agentRunStarted, cancelling tests added (Date: 2026-05-18)
