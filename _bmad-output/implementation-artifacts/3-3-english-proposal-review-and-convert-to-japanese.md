# Story 3.3: English Proposal Review & Convert to Japanese

Status: done

## Story

As a content author,
I want to review and edit the generated English story proposal before converting it to Japanese,
so that I can steer the content before committing to the full generation pipeline.

## Acceptance Criteria

**AC1 — Proposal phase renders ProposalPanel:**
Given the user clicks Generate in Path B mode with a topic and chapter set,
when the backend returns `RUN_FINISHED` with `resultType: 'proposal'`,
then `phase → 'proposal'`; a `ProposalPanel` section appears showing the English draft in an editable textarea; a "Convert to Japanese" primary button and a "Regenerate" secondary button are present; `InputSection` collapses (content preserved); `englishDraft` is snapshotted into `storedInputs` when approve() is called and is persisted through that action.

**AC2 — Proposal textarea is freely editable:**
Given `phase === 'proposal'`,
when the user edits the English draft freely,
then edits are captured in the store via `setProposalText`; there is no dirty-state warning for the proposal (editing is expected and encouraged); "Convert to Japanese" remains active as long as the textarea is non-empty; "Convert to Japanese" is disabled (aria-disabled) when the textarea is empty.

**AC3 — Convert to Japanese flow:**
Given the user clicks "Convert to Japanese",
when the action fires,
then no separate confirmation is shown (click is the commitment gesture); `approve()` is called from the store; `phase → 'generating'`; a new `runId` is assigned; the current `proposalText` is snapshotted as `storedInputs.englishDraft`; `useAgUiRun` opens a second `/run_sse` SSE connection with `pathMode=B` and `englishDraft` as a query param; `englishDraft` must NOT be cleared on any error from this point.

**AC4 — Japanese conversion error restores to proposal (not error):**
Given Japanese conversion fails (timeout or `ERROR` event from the second SSE),
when `_setError` is called by `useAgUiRun`,
then `proposalApproved === true` causes `phase → 'proposal'` (not `'error'`); `errorCode` and `errorMessage` remain in the store; ProposalPanel shows an inline error note so the author knows the conversion failed; `proposalText` is unchanged (the draft is intact); clicking "Convert to Japanese" again retries the conversion with the same draft; `useSession` treats the 'proposal' phase as stale (restored to idle on next page load, until Story 3.4 makes it fully restorable).

**AC5 — Regenerate restarts Path B phase 1:**
Given the user clicks "Regenerate" from `proposal` state,
when the action fires,
then `generate()` is called (allowed from proposal phase); `proposalApproved → false`; `proposalText → null`; `phase → 'generating'`; a new `runId` is assigned; the Path B phase 1 SSE request fires with the current `topicText` and `chapter`; the previous English draft is replaced when the new `RUN_FINISHED(resultType='proposal')` arrives.

**AC6 — InputPanel collapses during proposal phase:**
Given `phase === 'proposal'`,
when `InputPanel` renders,
then the full input form collapses (same as during generating/cancelling); the collapsed summary row shows mode label, chapter, and topic text (Path B) or inputText (Path A); "Edit inputs" ghost button re-expands without clearing content.

**AC7 — Tests pass:**
Given all components and hooks are updated,
when `pnpm test:unit` and `pnpm typecheck` run,
then: `ProposalPanel.test.tsx` covers all ACs above; `authoringStore.test.ts` covers `_setError` → proposal restore + `generate()` from proposal + `approve()` clears errors; `useSession.test.ts` covers 'proposal' treated as stale; `InputPanel.test.tsx` covers collapse during proposal; no regressions; `pnpm typecheck` clean.

## Tasks / Subtasks

- [x] AC5+store: Update `authoringStore.ts` (AC3, AC4, AC5)
  - [x] Add `setProposalText: (v: string) => void` public action
  - [x] Modify `_setError` to check `proposalApproved`: if true → `phase: 'proposal'` (not 'error'), keep errorCode/errorMessage in store
  - [x] Modify `generate()` to allow from `'proposal'` phase: add 'proposal' to allowed phases, reset `proposalApproved: false`, clear `proposalText: null`, reset `errorCode: null, errorMessage: null`
- [x] AC4: Update `useSession.ts`
  - [x] Add `'proposal'` to `STALE_PHASES` set (degraded to idle/output-clean until Story 3.4 makes it fully restorable)
- [x] AC1+AC2+AC3+AC4+AC5: Create `ProposalPanel.tsx`
  - [x] Always mounted; `height: 0 / overflow: hidden` outside proposal phase
  - [x] Editable `<textarea>` bound to `proposalText` via `setProposalText`
  - [x] Primary "Convert to Japanese" button → calls `approve()`; disabled when textarea empty
  - [x] Secondary "Regenerate" button → calls `generate()`
  - [x] Inline error note when `errorCode` is set (conversion failed state)
  - [x] `aria-label="English story proposal"` on section
- [x] AC6: Update `InputPanel.tsx`
  - [x] Add `'proposal'` to the `isGeneratingOrCancelling` check (rename to include proposal)
  - [x] Update collapsed summary to show `topicText` in Path B (currently only shows `inputText`)
- [x] AC1: Update `AuthoringTool.tsx`
  - [x] Import and render `<ProposalPanel />` between `<GenerationProgress />` and `<OutputPanel />`
- [x] AC7: Write/update tests
  - [x] `ProposalPanel.test.tsx` (NEW) — see test guidance in Dev Notes
  - [x] `authoringStore.test.ts` — add `_setError`→proposal, `generate()`-from-proposal, `approve()` clears errors
  - [x] `useSession.test.ts` — add 'proposal' treated as stale
  - [x] `InputPanel.test.tsx` — add collapse during proposal phase
  - [x] Run `pnpm test:unit` and `pnpm typecheck` — all pass

## Dev Notes

### Current state machine (must understand before touching)

`authoringStore.ts` currently has `Phase = 'idle' | 'generating' | 'cancelling' | 'output-clean' | 'output-dirty' | 'downloading' | 'error' | 'proposal'`. The `'proposal'` phase is already in the discriminated union and `_setProposalText()` already transitions to it. What's missing is the UI that renders in proposal phase.

Key existing store actions:
- `_setProposalText(v)` — sets `proposalText`, `phase: 'proposal'`, `runId: null` (called by `useAgUiRun` on `RUN_FINISHED` resultType='proposal')
- `approve()` — reads `proposalText`, creates `storedInputs.englishDraft`, sets `proposalApproved: true`, `phase: 'generating'`, new `runId` — ALREADY IMPLEMENTED
- `generate()` — only allows from `idle` and `error` currently — NEEDS to allow from `proposal` too

### `authoringStore.ts` — Three targeted changes

**1. Add `setProposalText` public action** (new action for ProposalPanel textarea `onChange`):
```typescript
setProposalText: (v: string) => void
```
Implementation: `setProposalText: (v) => set({ proposalText: v })`

Add to the `AuthoringStore` interface and the store implementation.

**2. Modify `_setError` to restore to `proposal` when `proposalApproved === true`:**

```typescript
_setError(code, message) {
  const { proposalApproved } = get()
  if (proposalApproved) {
    // Error during Japanese conversion — restore to proposal so draft is preserved
    set({ phase: 'proposal', errorCode: code, errorMessage: message, runId: null })
  } else {
    set({ phase: 'error', errorCode: code, errorMessage: message, runId: null })
  }
},
```

Why: The epics spec says "generating → proposal (error/timeout — restores draft)". `proposalApproved` is set to `true` by `approve()` and stays true until `generate()` resets it (Regenerate flow) or `clear()` resets the whole store.

**3. Modify `generate()` to allow from `proposal` phase:**

```typescript
generate() {
  const { phase, inputText, topicText, chapterTarget, steeringInstructions, pathMode,
          temperature, grammarDist, targetWordCount } = get()
  // Allow from idle, error, AND proposal (Regenerate from proposal phase)
  if (phase !== 'idle' && phase !== 'error' && phase !== 'proposal') return
  set({
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputJson: null,
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,
    proposalApproved: false,  // reset so _setError won't restore to proposal on new flow
    proposalText: null,       // clear stale draft; new proposal will be set by _setProposalText
    storedInputs: {
      inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist,
      topicText,
      targetWordCount,
    },
  })
},
```

Note: `storedInputs` snapshot for Regenerate does NOT include `englishDraft` — this is Path B phase 1, so `useAgUiRun` will send `topic` param (not `englishDraft`). The existing `useAgUiRun` URL construction already handles this correctly: `if (topicText) params.set('topic', topicText)` runs when `pathMode === 'B'` and no `englishDraft` is in storedInputs.

### `useSession.ts` — Add 'proposal' to STALE_PHASES

```typescript
const STALE_PHASES = new Set<Phase>(['generating', 'cancelling', 'downloading', 'proposal'])
```

Why: Without `proposalText` in the `SessionState` schema (that's Story 3.4), restoring to `proposal` would show an empty textarea. Treat as crashed: restore to `output-clean` if `outputJson` present, else `idle`. Story 3.4 will add `proposalText` to `SessionState` and remove `'proposal'` from STALE_PHASES.

### `ProposalPanel.tsx` — New component

**Location:** `apps/story-generator/src/components/ProposalPanel.tsx`

**Always mounted; height:0 outside proposal phase** (same DOM-always-present pattern as GenerationProgress and OutputPanel).

```tsx
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'

/**
 * English proposal review panel for Path B.
 *
 * Always mounted; height:0/overflow:hidden outside proposal phase.
 * Provides editable English draft, Convert to Japanese, and Regenerate actions.
 */
export function ProposalPanel() {
  const phase          = useAuthoringStore(s => s.phase)
  const proposalText   = useAuthoringStore(s => s.proposalText)
  const errorCode      = useAuthoringStore(s => s.errorCode)
  const errorMessage   = useAuthoringStore(s => s.errorMessage)
  const setProposalText = useAuthoringStore(s => s.setProposalText)
  const approve        = useAuthoringStore(s => s.approve)
  const generate       = useAuthoringStore(s => s.generate)

  const isVisible = phase === 'proposal'
  const textValue = proposalText ?? ''
  const canConvert = textValue.trim() !== ''

  return (
    <section
      aria-label="English story proposal"
      className={cn('mt-4 overflow-hidden', !isVisible && 'h-0')}
    >
      {isVisible && (
        <div className="space-y-3">
          <div>
            <label htmlFor="proposal-text" className="block text-sm font-medium text-paper-text mb-1">
              English story proposal
            </label>
            <p className="text-xs text-muted mb-2">
              Review and edit the English story below, then convert it to Japanese.
            </p>
            <textarea
              id="proposal-text"
              value={textValue}
              onChange={e => setProposalText(e.target.value)}
              className={cn(
                'w-full min-h-[200px] max-h-[500px] overflow-y-auto resize-none',
                'px-3 py-2 text-sm border border-border rounded-md',
                'bg-surface-subtle text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none transition-colors',
              )}
            />
          </div>

          {/* Inline error note when a previous conversion attempt failed */}
          {errorCode && (
            <p role="alert" className="text-xs text-error">
              {errorMessage ?? 'Conversion failed — your draft is preserved. Try again.'}
            </p>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={!canConvert}
              aria-disabled={!canConvert}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-accent text-white hover:bg-accent/90',
                'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
                !canConvert && 'opacity-[0.45] cursor-not-allowed pointer-events-none',
              )}
            >
              Convert to Japanese
            </button>

            <button
              type="button"
              onClick={generate}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-surface border border-border text-muted hover:text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none',
              )}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
```

### `AuthoringTool.tsx` — Mount ProposalPanel

Add `ProposalPanel` import and mount it between `GenerationProgress` and `OutputPanel`:

```tsx
import { ProposalPanel } from './ProposalPanel'

// In JSX:
<GenerationProgress />
<ProposalPanel />
<OutputPanel />
```

### `InputPanel.tsx` — Collapse during proposal phase

The `isGeneratingOrCancelling` variable currently drives collapse. Extend it:

```typescript
const isCollapsedPhase = phase === 'generating' || phase === 'cancelling' || phase === 'proposal'
const isCollapsed = isCollapsedPhase && !manualExpanded
```

Also update the collapsed summary to show `topicText` for Path B:

```tsx
{/* Collapsed summary row */}
{isCollapsed && (
  <div className="flex items-center gap-3 py-1 text-sm flex-wrap">
    <span className="text-muted shrink-0">
      {storedInputs?.pathMode === 'B' ? 'Generate from topic' : 'Convert a story'}
    </span>
    {storedInputs?.chapterTarget && (
      <span className="text-muted shrink-0">· {storedInputs.chapterTarget}</span>
    )}
    {/* Path B: show topic; Path A: show inputText */}
    {storedInputs?.pathMode === 'B' ? (
      storedInputs?.topicText && (
        <span className="text-paper-text truncate flex-1 min-w-0">
          {storedInputs.topicText.length > 60
            ? storedInputs.topicText.slice(0, 60) + '…'
            : storedInputs.topicText}
        </span>
      )
    ) : (
      storedInputs?.inputText && (
        <span className="text-paper-text truncate flex-1 min-w-0">
          {storedInputs.inputText.length > 60
            ? storedInputs.inputText.slice(0, 60) + '…'
            : storedInputs.inputText}
        </span>
      )
    )}
    <button
      type="button"
      onClick={() => setManualExpanded(true)}
      className={cn(
        'text-accent text-sm hover:text-accent/80 shrink-0',
        'focus-visible:ring-2 ring-accent outline-none rounded',
      )}
    >
      Edit inputs
    </button>
  </div>
)}
```

Also: the Generate/Stop/Stopping buttons should NOT show during `proposal` phase. Update the phase conditions:

```tsx
{(phase === 'idle' || phase === 'error') && (
  <button ... > Convert to Japanese / Generate </button>
)}
{phase === 'generating' && ( <Stop button> )}
{phase === 'cancelling' && ( <Stopping… button> )}
```

`'proposal'` is NOT in any of these conditions, so no Generate button shows in proposal phase. The ProposalPanel has its own action buttons. This is correct — no changes needed to the button conditions if they only check 'idle' and 'error'.

**CRITICAL:** Also update `useEffect` that resets `manualExpanded`:
```typescript
// Auto-reset manual expansion when no longer in collapsed phases
useEffect(() => {
  if (!isCollapsedPhase) setManualExpanded(false)
}, [isCollapsedPhase])
```

### `useAgUiRun.ts` — No changes needed

The existing hook already handles all required behavior:
- `RUN_FINISHED` with `resultType === 'proposal'` → calls `_setProposalText(bufferRef.current)` ✓
- `ERROR` event → calls `_setError(code, message)` ✓
- When `_setError` is modified to restore to `proposal` on `proposalApproved === true`, the hook behavior is correct without any changes ✓
- `approve()` creates new `storedInputs.englishDraft` and new `runId` → `useAgUiRun` opens new SSE with `englishDraft` param ✓

### `selectCanGenerate` selector — No change needed

`selectCanGenerate = (s) => s.phase === 'idle' || s.phase === 'error'`

The InputPanel's Generate button uses this selector. During `'proposal'` phase, the input form is collapsed and the Generate button is not shown. The ProposalPanel's Regenerate button calls `generate()` directly without checking this selector. No change required.

### Test Guidance for `ProposalPanel.test.tsx`

Standard pattern: `render()` + `act()` + store manipulation. See `OutputPanel.test.tsx` for reference.

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { ProposalPanel } from '../components/ProposalPanel'
import { useAuthoringStore } from '../stores/authoringStore'

describe('ProposalPanel', () => {
  beforeEach(() => { useAuthoringStore.getState()._reset() })
  afterEach(() => { useAuthoringStore.getState()._reset() })
```

**Key tests to write:**

1. Not visible when phase is 'idle': render → section has `h-0` class (or textarea not in document)
2. Visible when phase is 'proposal': call `_setProposalText('Hello world')` in act → textarea appears with value
3. Textarea is editable: fireEvent.change → `useAuthoringStore.getState().proposalText` updates
4. "Convert to Japanese" calls approve: spy on store's `approve`, click → approve called
5. "Convert to Japanese" disabled when empty: `_setProposalText('')` → button has `aria-disabled="true"`
6. "Regenerate" calls generate: spy on store's `generate`, click → generate called
7. Error note shown when errorCode set and phase is proposal: set `phase: 'proposal'` + `errorCode: 'TIMEOUT'` + `errorMessage: 'Timed out'` → error note visible
8. Error note NOT shown when errorCode is null: normal proposal → no error paragraph

**How to force proposal phase in tests** (since `_setProposalText` is the canonical way):
```typescript
act(() => {
  useAuthoringStore.getState()._setProposalText('My proposal text')
})
```
This sets `phase: 'proposal'` and `proposalText`.

**To test error note**: Direct store manipulation since there's no test-facing action that sets both proposal phase and error:
```typescript
act(() => {
  useAuthoringStore.getState()._setProposalText('Draft')
  useAuthoringStore.setState({ errorCode: 'TIMEOUT', errorMessage: 'Timed out' })
})
```

### Test Guidance for `authoringStore.test.ts`

Add to the existing authoringStore test suite:

```typescript
describe('_setError with proposalApproved', () => {
  it('goes to error phase when proposalApproved is false', () => {
    const { generate, _setError } = useAuthoringStore.getState()
    act(() => { generate() })  // idle → generating, proposalApproved: false
    act(() => { _setError('TIMEOUT', 'msg') })
    expect(useAuthoringStore.getState().phase).toBe('error')
  })

  it('restores to proposal phase when proposalApproved is true', () => {
    // Set up: put store in proposal phase, then approve, then simulate error
    act(() => { useAuthoringStore.getState()._setProposalText('draft') })
    act(() => { useAuthoringStore.getState().approve() })
    // proposalApproved is now true, phase is 'generating'
    act(() => { useAuthoringStore.getState()._setError('TIMEOUT', 'msg') })
    expect(useAuthoringStore.getState().phase).toBe('proposal')
    expect(useAuthoringStore.getState().errorCode).toBe('TIMEOUT')
    expect(useAuthoringStore.getState().proposalText).toBe('draft') // draft preserved
  })
})

describe('generate() from proposal phase', () => {
  it('transitions proposal → generating and resets proposalApproved', () => {
    act(() => { useAuthoringStore.getState()._setProposalText('draft') })
    expect(useAuthoringStore.getState().phase).toBe('proposal')
    act(() => {
      const s = useAuthoringStore.getState()
      s.setChapterTarget('Genki I Ch.5')
      s.setTopicText('My topic')
      s.setPathMode('B')
      s.generate()
    })
    const st = useAuthoringStore.getState()
    expect(st.phase).toBe('generating')
    expect(st.proposalApproved).toBe(false)
    expect(st.proposalText).toBeNull()
    expect(st.runId).not.toBeNull()
  })
})
```

### Test Guidance for `useSession.test.ts`

Add test that 'proposal' phase is treated as stale:

```typescript
it('treats proposal phase as stale — restores to idle when no outputJson', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    version: 1, phase: 'proposal', inputText: 'hi', topicText: 'topic',
    chapterTarget: 'Genki I Ch.5', steeringInstructions: '', pathMode: 'B',
    temperature: 1.0, grammarDist: 1, storyLengthPreset: 'medium', targetWordCount: 600,
    outputJson: null, outputIsDirty: false,
  }))
  renderHook(() => useSession())
  expect(useAuthoringStore.getState().phase).toBe('idle')
})
```

### Test Guidance for `InputPanel.test.tsx`

Add test for proposal phase collapse:

```typescript
it('collapses when phase is proposal', () => {
  act(() => {
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
    useAuthoringStore.getState().setTopicText('My topic')
    useAuthoringStore.getState().setPathMode('B')
    useAuthoringStore.getState()._setProposalText('English draft')
  })
  render(<InputPanel />)
  // Full form not visible; collapsed summary visible
  expect(screen.queryByRole('textbox', { name: /english story/i })).not.toBeInTheDocument()
  expect(screen.getByText('Edit inputs')).toBeInTheDocument()
})
```

### Critical Regression Risk

**GenerationProgress stays hidden during proposal phase** — `ACTIVE_PHASES = new Set(['generating', 'cancelling', 'error'])` does NOT include 'proposal'. This is correct. Do not add 'proposal' to ACTIVE_PHASES.

**OutputPanel stays hidden during proposal phase** — `OUTPUT_PHASES = new Set(['output-clean', 'output-dirty'])` does NOT include 'proposal'. Correct.

**`approve()` already implemented correctly** — Do not modify `approve()` logic. It correctly snapshots `proposalText` into `storedInputs.englishDraft` and sets `proposalApproved: true`.

**`useAgUiRun` buffer handling** — `bufferRef.current` accumulates `TEXT_MESSAGE_CHUNK` deltas during phase 2 generation. On `RUN_FINISHED(resultType='story')`, `_setOutputJson(bufferRef.current)` is called. This is already correct — buffer is reset to `''` at the start of each SSE connection open. No changes needed to useAgUiRun.

**`generate()` from proposal via `selectCanGenerate` selector** — `selectCanGenerate` checks `idle | error` only. ProposalPanel's Regenerate button calls `generate()` directly; it does NOT use `selectCanGenerate` as a disabled gate. This is intentional — the button is always enabled in proposal phase. If you want to disable it during proposal (e.g., while generating), note that during generating phase, the ProposalPanel is hidden (height: 0), so the button is irrelevant.

### References

- [Source: epics-story-authoring-tool.md — Story 3.3 acceptance criteria]
- [Source: architecture-story-authoring-tool.md — State machine, ProposalPanel.tsx listed in FR map]
- [Source: apps/story-generator/src/stores/authoringStore.ts — approve(), _setError(), _setProposalText() current implementations]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — RUN_FINISHED proposal handling + _setError call]
- [Source: apps/story-generator/src/hooks/useSession.ts — STALE_PHASES, SessionState interface]
- [Source: apps/story-generator/src/components/AuthoringTool.tsx — mount point for ProposalPanel]
- [Source: apps/story-generator/src/components/InputPanel.tsx — isGeneratingOrCancelling collapse logic]
- [Source: apps/story-generator/src/components/OutputPanel.tsx — always-mounted DOM pattern reference]
- [Source: apps/story-generator/src/components/GenerationProgress.tsx — height:0 pattern reference]

### Review Findings

- [x] [Review][Patch] P1: `proposalApproved` not reset in `_setOutputJson()` — after a successful Japanese conversion, `proposalApproved` remains `true`; a subsequent `rerun()` or `generate()` then fails, causing `_setError` to incorrectly restore to `proposal` phase instead of `error` [authoringStore.ts:273]
- [x] [Review][Defer] D1: "Convert to Japanese" not disabled when backend unavailable — ProposalPanel doesn't check `backendStatus`; inconsistent with InputPanel's Generate button guard; acceptable for v1 since error recovery works correctly [ProposalPanel.tsx:60]
- [x] [Review][Defer] D2: Collapsed summary shows nothing for proposal phase if `storedInputs` is null — only reachable via direct store manipulation; normal UX flow always populates `storedInputs` before entering proposal [InputPanel.tsx:125]
- [x] [Review][Defer] D3: `useSession` discards `proposalText` silently when restoring stale proposal phase — intentional until Story 3.4 adds `proposalText` to `SessionState` [useSession.ts:9]
- [x] [Review][Defer] D4: "Regenerate" button lacks distinguishing `aria-label` from InputPanel's "Generate" button — low a11y gap, deferred to accessibility pass [ProposalPanel.tsx:75]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 251/251 tests pass (239 existing + 12 new). TypeScript clean.
- `ProposalPanel.tsx` (NEW): always-mounted, height:0 outside proposal phase. Editable textarea via `setProposalText`. "Convert to Japanese" (approve, disabled when empty). "Regenerate" (generate from proposal). Inline error note when `errorCode` set.
- `authoringStore.ts`: added `setProposalText` public action; modified `_setError` to restore `phase: 'proposal'` when `proposalApproved === true`; extended `generate()` to allow from proposal phase, resetting `proposalApproved: false` and `proposalText: null`.
- `useSession.ts`: added 'proposal' to STALE_PHASES so incomplete session restores gracefully to idle/output-clean until Story 3.4 adds proposalText persistence.
- `InputPanel.tsx`: extended collapse logic to include proposal phase; updated collapsed summary to show topicText for Path B.
- `AuthoringTool.tsx`: mounted ProposalPanel between GenerationProgress and OutputPanel.

### File List

- `apps/story-generator/src/stores/authoringStore.ts`
- `apps/story-generator/src/hooks/useSession.ts`
- `apps/story-generator/src/components/ProposalPanel.tsx` (NEW)
- `apps/story-generator/src/components/InputPanel.tsx`
- `apps/story-generator/src/components/AuthoringTool.tsx`
- `apps/story-generator/src/__tests__/ProposalPanel.test.tsx` (NEW)
- `apps/story-generator/src/__tests__/authoringStore.test.ts`
- `apps/story-generator/src/__tests__/useSession.test.ts`
- `apps/story-generator/src/__tests__/InputPanel.test.tsx`
- `_bmad-output/implementation-artifacts/3-3-english-proposal-review-and-convert-to-japanese.md`
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml`
