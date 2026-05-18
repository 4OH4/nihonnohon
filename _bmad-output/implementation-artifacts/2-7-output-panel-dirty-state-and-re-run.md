# Story 2.7: Output Panel, Dirty State & Re-run

Status: done

## Story

As a content author,
I want to review the generated story JSON, edit it in place, and re-run generation from my original inputs,
so that I have full control over the output before committing to download.

## Acceptance Criteria

**AC1 — OutputPanel expands on RUN_FINISHED:**
Given `RUN_FINISHED` (resultType='story') is received,
when `useAgUiRun` processes it,
then `_setOutputJson(content)` is called with the fully assembled JSON buffer; `phase → 'output-clean'`; `GenerationProgress` collapses (existing behaviour); `OutputPanel` expands and displays the JSON.

**AC2 — JsonOutput renders with monospace line numbers:**
Given `OutputPanel` is visible,
when `outputJson` is set,
then `JsonOutput` renders the JSON in a monospace (`font-mono`) display with a line-number gutter (44px, `user-select: none`); `min-h-[300px]` with internal `overflow-y: auto`; the gutter shows sequential line numbers.

**AC3 — First edit latches dirty state:**
Given the user makes any edit to the output textarea after `output-clean` is reached,
when the first `onChange` fires,
then `_markDirty()` is called; `phase → 'output-dirty'`; an "Unsaved edits" indicator is visible; `outputIsDirty` does NOT reset even if the user reverts the text manually (one-way latch — resets only via `clear()` or completed `rerun()`/`generate()`).

**AC4 — Re-run from clean fires immediately:**
Given `phase === 'output-clean'`,
when Re-run is clicked,
then `rerun()` is called on the store; generation fires from `storedInputs` (not from the current textarea value); `outputJson` is cleared; `OutputPanel` collapses while generating; `outputIsDirty` resets to false.

**AC5 — Re-run from dirty shows RerunWarning:**
Given `phase === 'output-dirty'`,
when Re-run is clicked,
then a `RerunWarning` strip appears inline below Re-run with the text "Re-running will replace your edits."; two buttons: [Discard my edits and Re-run] (Stop/Destructive style) and [Cancel]; `role="alert"`; React state-driven (never `window.confirm`); confirm calls `rerun()`; cancel dismisses without action; pressing Escape also dismisses.

**AC6 — Store tests for phase transitions:**
Given `authoringStore.test.ts`,
when `_markDirty()` is called from `output-clean`,
then `phase → 'output-dirty'`; when `rerun()` is called from `output-dirty`, `phase → 'generating'`; when `rerun()` is called from `output-clean`, `phase → 'generating'`; `storedInputs` is preserved unchanged by `rerun()`; `outputJson → null` on `rerun()`; `generate()` from `error` phase now clears `outputJson → null` (deferred fix); all tests pass.

**AC7 — Tests pass:**
Given all components are implemented,
when `pnpm test:unit` is run and `pnpm typecheck` is run,
then OutputPanel display/collapse tests pass; JsonOutput edit and dirty-state tracking tests pass; RerunWarning show/dismiss/confirm tests pass; store `rerun()` tests pass; no regressions in existing tests.

## Tasks / Subtasks

- [x] AC6: Add `rerun()` to `authoringStore.ts` and fix `generate()` from error
  - [x] Add `rerun: () => void` to `AuthoringStore` interface
  - [x] Implement `rerun()`: valid only from `output-clean | output-dirty`; keep existing `storedInputs`; set `{ phase: 'generating', runId: crypto.randomUUID(), outputJson: null, outputIsDirty: false, errorCode: null, errorMessage: null, agentRunStarted: false }`
  - [x] Fix `generate()` from `error`: add `outputJson: null` to the set() call (deferred item from Story 2.1 — now visible with OutputPanel wired up)
  - [x] Add `rerun` to `authoringStore.ts` store tests: `rerun()` from `output-clean → generating`; `rerun()` from `output-dirty → generating`; `rerun()` preserves `storedInputs`; `rerun()` clears `outputJson`; `rerun()` no-op from `idle`; `generate()` from `error` now clears `outputJson`

- [x] AC1+AC2+AC3: Create `src/components/JsonOutput.tsx`
  - [x] Props: `value: string`, `onChange: (v: string) => void`
  - [x] Renders a two-column layout: line-number gutter (`<div>`, `user-select: none`, 44px width) + `<textarea>` (monospace, `font-mono`, `resize-none`, `overflow-y-auto`)
  - [x] Line-number gutter: compute line count from `value.split('\n').length`; render one `<div>` per line with the 1-based number; gutter scroll syncs with textarea scroll via `onScroll` ref
  - [x] Wrapper: `border border-border rounded-md overflow-hidden min-h-[300px] flex flex-col bg-surface-subtle`
  - [x] Inner scroll container: `flex flex-1 overflow-y-auto` so both gutter and textarea scroll together
  - [x] `<textarea>`: `flex-1 font-mono text-xs p-2 resize-none bg-transparent text-paper-text focus-visible:outline-none`; fires `onChange` on every keystroke
  - [x] `aria-label="Generated story JSON"` on the textarea

- [x] AC1+AC4+AC5: Create `src/components/OutputPanel.tsx`
  - [x] Always mounted in DOM; visible when `phase === 'output-clean' || phase === 'output-dirty'`; uses `h-0 overflow-hidden` when not in output phase (matching GenerationProgress pattern)
  - [x] Local state: `editedValue: string | null` — initialised from `outputJson` when phase enters `output-clean`; `null` when collapsed
  - [x] Local state: `showRerunWarning: boolean` — drives `RerunWarning` display
  - [x] On `phase === 'output-clean'` entry: reset `editedValue = outputJson`; reset `showRerunWarning = false`
  - [x] `JsonOutput` receives `editedValue ?? ''` as `value`; `onChange` calls `store._markDirty()` and updates `editedValue`
  - [x] Dirty indicator: `{outputIsDirty && <span className="text-xs text-muted">Unsaved edits</span>}` rendered next to Re-run button
  - [x] Re-run button: Secondary style (`bg-surface border border-border text-muted hover:text-paper-text`); when clicked — if `phase === 'output-dirty'`, set `showRerunWarning = true`; if `phase === 'output-clean'`, call `store.rerun()` directly
  - [x] `RerunWarning` strip: rendered inline below Re-run button; `role="alert"`; amber strip (`bg-accent-subtle border border-accent rounded-md p-3`); text "Re-running will replace your edits."; [Discard my edits and Re-run] Stop/Destructive style button calls `store.rerun()` + `setShowRerunWarning(false)`; [Cancel] calls `setShowRerunWarning(false)`; focus moves to confirm button on appearance; Escape key dismisses
  - [x] Section label: `aria-label="Generated story output"`
  - [x] `aria-label="Generation progress"` container uses `mt-4` top margin when expanded (matching adjacent section spacing)
  - [x] Implement `useEffect` to sync `editedValue` from `outputJson` when phase transitions to `output-clean` (new run complete)
  - [x] Implement `useEffect` to reset `showRerunWarning = false` when phase leaves output phases (e.g. user starts new generate)

- [x] AC1: Mount `OutputPanel` in `src/components/AuthoringTool.tsx`
  - [x] Import and replace `{/* Story 2.7: OutputPanel */}` comment with `<OutputPanel />`

- [x] AC7: Write `src/__tests__/OutputPanel.test.tsx`
  - [x] `OutputPanel` has `h-0` class when phase is idle
  - [x] `OutputPanel` does not have `h-0` when phase is `output-clean`
  - [x] Displays `JsonOutput` (textarea with `aria-label="Generated story JSON"`) after `_setOutputJson()`
  - [x] First textarea change calls `_markDirty()` (phase → `output-dirty`)
  - [x] "Unsaved edits" text visible when `outputIsDirty`
  - [x] Re-run button visible in `output-clean`; clicking calls `rerun()` (phase → `generating`)
  - [x] Re-run button in `output-dirty`: clicking shows `RerunWarning` (text "Re-running will replace your edits." visible)
  - [x] RerunWarning [Discard my edits and Re-run] button calls `rerun()` (phase → `generating`)
  - [x] RerunWarning [Cancel] button hides the warning without changing phase
  - [x] Re-run from `output-clean` does NOT show RerunWarning

- [x] AC7: Run `pnpm test:unit` and `pnpm typecheck` from `apps/story-generator`

### Review Findings

- [x] [Review][Patch] `editedValue` not synced to `store.outputJson` — edits are local state only; `save()` in Story 2.8 would save unedited original [OutputPanel.tsx, authoringStore.ts]
- [x] [Review][Defer] UX-DR5 deviation: JS gutter + textarea used instead of `<pre>` + CSS counter-increment; story spec explicitly specced this approach; redesign deferred [JsonOutput.tsx]
- [x] [Review][Defer] `rerun()` does not clear `proposalApproved` — pre-existing on `generate()` too; Story 4.x scope [authoringStore.ts:131]
- [x] [Review][Defer] Single-frame `editedValue = null` before first useEffect on output-clean entry — imperceptible; tests pass via act() [OutputPanel.tsx:29]
- [x] [Review][Defer] Latent stale `editedValue` after rerun if future phases break invariant — non-triggerable with current phase machine [OutputPanel.tsx]
- [x] [Review][Defer] Escape keydown attached to document without stopPropagation — OutputPanel not inside any modal; no parent Escape handler exists [OutputPanel.tsx:52]
- [x] [Review][Defer] Double `_setOutputJson` in output-clean could re-sync editedValue — RUN_FINISHED is terminal; unreachable in production [OutputPanel.tsx:29]

## Dev Notes

### Store: `rerun()` action

**Add to `AuthoringStore` interface:**
```typescript
rerun: () => void
```

**Implementation:**
```typescript
rerun() {
  const { phase, storedInputs } = get()
  if (phase !== 'output-clean' && phase !== 'output-dirty') return
  if (!storedInputs) return  // guard — storedInputs must exist if in output phase
  set({
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputJson: null,          // clear stale output while regenerating
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,
    // storedInputs preserved — same snapshot reused for the SSE URL params
  })
},
```

**`rerun()` does NOT update `storedInputs`** — the existing snapshot is reused. `useAgUiRun` reads from `storedInputs` for all SSE URL params, so the same backend call is made.

**Fix `generate()` from error (deferred item from Story 2.1):**
Add `outputJson: null` to the `set()` call in `generate()` (already has errorCode, errorMessage, outputIsDirty):
```typescript
generate() {
  // ...guard unchanged...
  set({
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputJson: null,     // NEW: clear stale output so OutputPanel collapses on retry
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,
    storedInputs: { inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist },
  })
},
```

### OutputPanel: phase-driven visibility

Same pattern as `GenerationProgress` — always mounted, `h-0 overflow-hidden` when not in output phase:

```tsx
const OUTPUT_PHASES = new Set(['output-clean', 'output-dirty'])

const isVisible = OUTPUT_PHASES.has(phase)

return (
  <section
    aria-label="Generated story output"
    className={cn(!isVisible && 'h-0 overflow-hidden')}
  >
    {isVisible && (
      <>
        <JsonOutput value={editedValue ?? ''} onChange={handleChange} />
        {/* Re-run button row */}
        {/* RerunWarning strip */}
      </>
    )}
  </section>
)
```

**Note on conditional rendering inside:** Because the container uses `h-0 overflow-hidden` (not conditional rendering) for layout stability, the content inside CAN be conditionally rendered — the parent container is always in the DOM. The `{isVisible && ...}` guard ensures `editedValue` state doesn't need to be meaningful when hidden.

### OutputPanel: local state design

```typescript
const [editedValue, setEditedValue] = useState<string | null>(null)
const [showRerunWarning, setShowRerunWarning] = useState(false)

const phase         = useAuthoringStore(s => s.phase)
const outputJson    = useAuthoringStore(s => s.outputJson)
const outputIsDirty = useAuthoringStore(s => s.outputIsDirty)
const rerun         = useAuthoringStore(s => s.rerun)
const _markDirty    = useAuthoringStore(s => s._markDirty)

// Sync editedValue when a new generation completes (phase enters output-clean)
useEffect(() => {
  if (phase === 'output-clean') {
    setEditedValue(outputJson)
    setShowRerunWarning(false)
  }
}, [phase, outputJson])

// Reset warning when leaving output phases
useEffect(() => {
  if (!OUTPUT_PHASES.has(phase)) {
    setShowRerunWarning(false)
  }
}, [phase])

const handleChange = (v: string) => {
  setEditedValue(v)
  _markDirty()  // one-way latch — safe to call multiple times
}

const handleRerun = () => {
  if (phase === 'output-dirty') {
    setShowRerunWarning(true)
  } else {
    rerun()
  }
}

const handleConfirmRerun = () => {
  setShowRerunWarning(false)
  rerun()
}
```

### JsonOutput: line-number gutter approach

Use a two-column layout: a `<div>` gutter for line numbers + `<textarea>` for content. Both sit inside a shared scrolling container.

```tsx
interface JsonOutputProps {
  value: string
  onChange: (v: string) => void
}

export function JsonOutput({ value, onChange }: JsonOutputProps) {
  const lineCount = value.split('\n').length
  const gutterRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden min-h-[300px] flex bg-surface-subtle">
      {/* Line-number gutter */}
      <div
        ref={gutterRef}
        className="w-11 shrink-0 overflow-hidden select-none text-right font-mono text-xs text-muted bg-surface border-r border-border py-2"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="px-2 leading-5">{i + 1}</div>
        ))}
      </div>
      {/* Editable content */}
      <textarea
        aria-label="Generated story JSON"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        className="flex-1 font-mono text-xs p-2 resize-none bg-transparent text-paper-text focus-visible:outline-none leading-5 overflow-y-auto"
      />
    </div>
  )
}
```

**Note:** Gutter scroll sync is one-directional (textarea drives gutter). This is correct — the gutter has `overflow: hidden` so it never independently scrolls. The `min-h-[300px]` is on the wrapper.

### RerunWarning strip

Inline amber strip, React state-driven. Focus management: use `autoFocus` on the destructive confirm button.

```tsx
{showRerunWarning && (
  <div
    role="alert"
    className="mt-2 flex flex-col gap-2 rounded-md border border-accent bg-accent-subtle p-3"
  >
    <p className="text-sm text-paper-text">Re-running will replace your edits.</p>
    <div className="flex gap-2">
      <button
        type="button"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        onClick={handleConfirmRerun}
        className={cn(
          'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          'bg-surface border border-error text-error hover:bg-error/10',
          'focus-visible:ring-2 ring-accent outline-none',
        )}
      >
        Discard my edits and Re-run
      </button>
      <button
        type="button"
        onClick={() => setShowRerunWarning(false)}
        className={cn(
          'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
          'bg-surface border border-border text-muted hover:text-paper-text',
          'focus-visible:ring-2 ring-accent outline-none',
        )}
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Escape key dismissal:** Add a `useEffect` that listens for `keydown` with `key === 'Escape'` while `showRerunWarning` is true:
```typescript
useEffect(() => {
  if (!showRerunWarning) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setShowRerunWarning(false)
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [showRerunWarning])
```

### Re-run button

Secondary style per UX-DR17. Shown inside the expanded OutputPanel, above/beside dirty indicator:

```tsx
<div className="mt-3 flex items-center gap-3">
  <button
    type="button"
    onClick={handleRerun}
    className={cn(
      'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
      'bg-surface border border-border text-muted hover:text-paper-text',
      'focus-visible:ring-2 ring-accent outline-none',
    )}
  >
    Re-run
  </button>
  {outputIsDirty && (
    <span className="text-xs text-muted">Unsaved edits</span>
  )}
</div>
```

### AuthoringTool.tsx change

Replace the placeholder comment:
```tsx
// BEFORE:
{/* Story 2.7: OutputPanel */}

// AFTER:
import { OutputPanel } from './OutputPanel'
// ...
<OutputPanel />
```

### Test patterns

**authoringStore.test.ts additions** — add a new `describe` block:
```typescript
describe('authoringStore — rerun()', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })

  it('transitions from output-clean to generating', () => {
    useAuthoringStore.getState()._setOutputJson('{}')  // enters output-clean
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('transitions from output-dirty to generating', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('preserves storedInputs snapshot unchanged', () => {
    useAuthoringStore.getState().setInputText('Original story')
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setOutputJson('{}')
    const before = useAuthoringStore.getState().storedInputs
    useAuthoringStore.getState().setInputText('Changed story')  // live input changes
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().storedInputs).toEqual(before)
  })

  it('clears outputJson on rerun', () => {
    useAuthoringStore.getState()._setOutputJson('{"test":true}')
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().outputJson).toBeNull()
  })

  it('resets outputIsDirty on rerun', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })

  it('is a no-op from idle', () => {
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('assigns a new runId each time', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState().rerun()
    const id1 = useAuthoringStore.getState().runId
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState().rerun()
    const id2 = useAuthoringStore.getState().runId
    expect(id1).not.toBe(id2)
  })
})

describe('authoringStore — generate() from error clears outputJson (deferred fix)', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })

  it('clears outputJson when retrying from error phase', () => {
    useAuthoringStore.getState()._setOutputJson('{"old":true}')
    // Simulate error:
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().outputJson).toBeNull()
  })
})
```

**OutputPanel.test.tsx** — test pattern (matching GenerationProgress.test.tsx style):
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { OutputPanel } from '../components/OutputPanel'
import { useAuthoringStore } from '../stores/authoringStore'

describe('OutputPanel', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })
  afterEach(() => { useAuthoringStore.getState()._reset() })

  it('has h-0 class when phase is idle', () => {
    const { container } = render(<OutputPanel />)
    const section = container.querySelector('[aria-label="Generated story output"]')
    expect(section).toHaveClass('h-0')
  })

  it('does not have h-0 when phase is output-clean', () => {
    useAuthoringStore.getState()._setOutputJson('{"test":true}')
    const { container } = render(<OutputPanel />)
    const section = container.querySelector('[aria-label="Generated story output"]')
    expect(section).not.toHaveClass('h-0')
  })

  it('shows textarea with outputJson content', () => {
    useAuthoringStore.getState()._setOutputJson('{"key":"value"}')
    render(<OutputPanel />)
    const ta = screen.getByLabelText(/generated story json/i)
    expect(ta).toHaveValue('{"key":"value"}')
  })

  it('calls _markDirty on textarea change', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    render(<OutputPanel />)
    const ta = screen.getByLabelText(/generated story json/i)
    fireEvent.change(ta, { target: { value: '{edited}' } })
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
  })

  it('shows "Unsaved edits" when outputIsDirty', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    expect(screen.getByText('Unsaved edits')).toBeInTheDocument()
  })

  it('Re-run from output-clean calls rerun() directly without warning', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('Re-run from output-dirty shows RerunWarning', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/re-running will replace your edits/i)).toBeInTheDocument()
  })

  it('RerunWarning Discard button calls rerun() and hides warning', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: /discard my edits/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('RerunWarning Cancel hides warning and keeps output-dirty', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
  })
})
```

### Key patterns from previous stories

**Always-mounted visibility pattern (from GenerationProgress, Story 2.6):**
```tsx
<section
  aria-label="..."
  className={cn(!isVisible && 'h-0 overflow-hidden')}
>
```
Use `h-0 overflow-hidden` for collapse (not `hidden` or `display: none`). Content inside can be conditionally rendered.

**Store selector granularity (from Stories 2.3–2.6):** Subscribe to individual fields — `useAuthoringStore(s => s.phase)`, `useAuthoringStore(s => s.outputJson)` — not the whole store.

**Button styles (from UX-DR17):**
- Secondary (Re-run): `bg-surface border border-border text-muted hover:text-paper-text`
- Stop/Destructive (Discard and Re-run): `bg-surface border border-error text-error hover:bg-error/10`
- Cancel: Secondary style

**`_reset()` in test setup (from Story 2.6):** Always call `useAuthoringStore.getState()._reset()` in `beforeEach` AND `afterEach` to avoid test pollution.

**`_markDirty()` is already in the store** — it's a one-way latch from `output-clean → output-dirty`. Calling it from `output-dirty` is a no-op. This means `onChange` can safely call `_markDirty()` on every keystroke.

### What is explicitly NOT in this story scope

- **Validation errors on JsonOutput** — `ValidationErrorList` is Story 2.8 scope
- **Save & Download button** — Story 2.8 scope
- **StatsBar** — Story 2.8 scope
- **Session persistence** — Story 2.9 scope
- **Clear button** — Story 2.9 scope (store `clear()` already exists but no UI wired)
- **`AGENT_STATUS` events and M2 agent status line** — Story 3.2 scope
- **Error-line highlighting in JsonOutput (red tint on invalid lines)** — validation is Story 2.8; JsonOutput in this story shows no error state
- **Copy to clipboard affordance on JsonOutput** — not required by this story's ACs

### References

- [epics-story-authoring-tool.md — Story 2.7 ACs](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [ux-design-specification — UX-DR5 (JsonOutput), UX-DR12 (RerunWarning), UX-DR17 (button hierarchy), UX-DR19 (inline confirmation)](../../_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md)
- [2-6 story — GenerationProgress always-mounted pattern, shimmer animation](./2-6-generation-ui-progress-display-stop-button-and-inputsection-collapse.md)
- [deferred-work.md — generate() from error doesn't clear outputJson (Story 2.1 deferred)](./deferred-work.md)
- [authoringStore.ts — _markDirty(), _setOutputJson(), outputIsDirty, storedInputs](../../apps/story-generator/src/stores/authoringStore.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `rerun()` public action to `authoringStore.ts`: transitions from `output-clean | output-dirty` to `generating`, reusing existing `storedInputs` snapshot; clears `outputJson`, resets `outputIsDirty` and `agentRunStarted`.
- Fixed deferred item from Story 2.1: `generate()` from `error` phase now clears `outputJson: null` so the OutputPanel collapses when retrying after a failed generation.
- Created `JsonOutput.tsx`: two-column layout with JS-computed line-number gutter (scroll-synced to textarea) and `<textarea>` with `font-mono`; `aria-label="Generated story JSON"`.
- Created `OutputPanel.tsx`: always-mounted with `h-0 overflow-hidden` collapse (matching GenerationProgress pattern); local `editedValue` state synced from `outputJson` on `output-clean` entry; `showRerunWarning` state drives inline RerunWarning strip; Escape key dismisses warning; focus moves to confirm button on appearance.
- Updated `AuthoringTool.tsx`: replaced `{/* Story 2.7: OutputPanel */}` placeholder with `<OutputPanel />`.
- Code review: added `_editOutputJson(v)` store action (transitions output-clean → output-dirty + updates outputJson; updates outputJson only when already output-dirty); replaced `_markDirty()` call in OutputPanel.handleChange with `_editOutputJson(v)` so user edits are persisted to the store for Story 2.8 download.
- 113 unit tests pass; typecheck clean.

### File List

- apps/story-generator/src/stores/authoringStore.ts (modified — added rerun(), fixed generate() from error)
- apps/story-generator/src/components/JsonOutput.tsx (new)
- apps/story-generator/src/components/OutputPanel.tsx (new)
- apps/story-generator/src/components/AuthoringTool.tsx (modified — mount OutputPanel)
- apps/story-generator/src/__tests__/OutputPanel.test.tsx (new)
- apps/story-generator/src/__tests__/authoringStore.test.ts (modified — rerun(), _editOutputJson(), and generate()-from-error tests)

## Change Log

- 2026-05-18: Story 2.7 implemented — OutputPanel, JsonOutput, RerunWarning, rerun() store action, generate()-from-error outputJson fix (Date: 2026-05-18)
- 2026-05-18: Code review patch applied — added _editOutputJson() store action to sync user edits to outputJson; updated OutputPanel.handleChange and tests (Date: 2026-05-18)
