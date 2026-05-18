# Story 3.2: Topic Input, Suggest-Topic Button & Mode Activation

Status: done

## Story

As a content author,
I want to switch to "Generate from topic" mode, type or suggest a topic, and trigger story generation from it,
So that I can start Path B from a topic description without any additional setup.

## Acceptance Criteria

**AC1 — ModeToggle activates Path B UI:**
Given the user clicks "Generate from topic" in `ModeToggle`,
when Path B activates,
then the story textarea is replaced by `TopicTextarea`; chapter selector and `ScopeChip` remain; story length controls in `SettingsPanel` are already active (done in hotfix eb1c8a9); `steeringInstructions` collapsible remains; `pathMode` in store updates to `'B'`.

**AC2 — Suggest a topic (empty field):**
Given `TopicTextarea` is rendered with an empty topic field,
when the "✦ Suggest a topic" button is clicked,
then the button transitions to a spinner (`aria-busy="true"`, `pointer-events: none`) without unmounting; `POST /suggest-topic` fires with `{ chapter: currentChapter }` payload; on response the textarea is populated and the button resets; on error a local toast "Could not fetch suggestion" appears for 4 seconds and the button resets.

**AC3 — Replace topic (has content):**
Given `TopicTextarea` already has content,
when the "Replace topic" button is clicked,
then a `SuggestConfirm` strip appears inline below the textarea; Generate button is disabled while the strip is visible.

**AC4 — SuggestConfirm strip:**
Given `SuggestConfirm` strip is visible,
when it renders,
then `role="alert"` on the strip container; `accent-subtle` background + `accent` border; message: "Replace your current topic with a suggested one?"; [Yes, replace] fires the suggest-topic request (same flow as AC2) and dismisses the strip; [Cancel] dismisses the strip without firing; focus moves to [Yes, replace] button on appearance; Escape key triggers [Cancel] from anywhere while the strip is visible.

**AC5 — 300ms debounce on suggest button:**
Given the suggest button is clicked rapidly,
when multiple clicks occur within 300ms,
then only one request is sent; the button remains in spinner state until the request resolves.

**AC6 — Mode switch with dirty output shows inline warning:**
Given the user has `outputIsDirty === true`,
when they click the other mode in `ModeToggle`,
then an inline warning strip appears below the toggle: "Switching mode will discard your edited output."; [Switch anyway] calls `setPathMode()` and dismisses the strip; [Cancel] dismisses without switching; mode does not change until the user confirms.

**AC7 — Store: topicText field and Path B generate snapshot:**
Given `topicText` and `targetWordCount` exist in the store,
when `generate()` is called in Path B mode,
then `storedInputs` includes `topicText` and `targetWordCount`; `useAgUiRun` includes `topic` in the SSE URL query params when `pathMode === 'B'` and `topicText` is non-empty.

**AC8 — Session persistence includes topicText:**
Given `topicText` is set in the store,
when `useSession` writes/restores,
then `topicText` is persisted to and restored from localStorage; `hasContent` check includes `topicText !== ''`.

**AC9 — Tests pass:**
Given all components and hooks are updated,
when `pnpm test:unit` and `pnpm typecheck` run,
then: `TopicTextarea.test.tsx` covers empty-state suggest, replace flow, error toast, debounce, SuggestConfirm focus + Escape; `ModeToggle.test.tsx` covers dirty-warning strip appear, switch anyway, cancel; `InputPanel.test.tsx` covers Path B renders TopicTextarea, Path B pre-flight validation checks topicText, button label "Generate" in Path B; `authoringStore.test.ts` covers `storedInputs.topicText` set on generate(); `useSession.test.ts` covers topicText persisted/restored; no regressions; `pnpm typecheck` clean.

## Tasks / Subtasks

- [x] AC7+AC8: Update `authoringStore.ts`
  - [x] Add `topicText: string` to `AuthoringStore` interface and `defaultState`
  - [x] Add `setTopicText: (v: string) => void` action
  - [x] Extend `StoredInputs` interface: add `topicText?: string`, `englishDraft?: string`, `targetWordCount?: number`
  - [x] Update `generate()` to include `topicText` and `targetWordCount` in snapshot
  - [x] Update `approve()` to include `englishDraft: proposalText ?? ''` in snapshot
  - [x] Ensure `clear()` / `_reset()` resets `topicText: ''`
- [x] AC8: Update `useSession.ts`
  - [x] Add `topicText: string` to `SessionState` interface
  - [x] Persist `topicText` in the `write()` function
  - [x] Restore `topicText` in the mount hydration effect
  - [x] Add `topicText !== ''` to `hasContent` check
- [x] AC7: Update `useAgUiRun.ts`
  - [x] Extract `topicText` and `englishDraft` from `storedInputs`
  - [x] When `pathMode === 'B'` and `topicText` non-empty: add `topic` param to URL
  - [x] When `pathMode === 'B'` and `englishDraft` non-empty: add `englishDraft` param to URL
  - [x] (Note: `target_word_count` URL param deferred to Story 3.4 when backend also handles it)
- [x] AC1+AC3: Create `TopicTextarea.tsx` component
  - [x] Textarea bound to `topicText` store field (use `setTopicText` via store)
  - [x] Overlay button: "✦ Suggest a topic" when empty, "Replace topic" when has content
  - [x] Local state: `isSuggesting: boolean`, `showConfirm: boolean`, `toastText: string | null`
  - [x] `doSuggest()` helper: POST /suggest-topic, populate on success, toast on error
  - [x] Debounce ref: 300ms guard on button clicks (AC5)
  - [x] `SuggestConfirm` strip: rendered inline below textarea when `showConfirm`
  - [x] Focus management: focus [Yes, replace] button on strip appearance
  - [x] Escape keydown on document dismisses `showConfirm`
- [x] AC1+AC6: Update `ModeToggle.tsx`
  - [x] Add `outputIsDirty = useAuthoringStore(s => s.outputIsDirty)` subscription
  - [x] Local state: `pendingMode: 'A' | 'B' | null`
  - [x] When tab clicked and `outputIsDirty && target !== currentMode`: set `pendingMode` instead of calling `setPathMode()` immediately
  - [x] Render inline warning strip (below tablist) when `pendingMode !== null`
  - [x] [Switch anyway] → `setPathMode(pendingMode)` + `setPendingMode(null)`
  - [x] [Cancel] → `setPendingMode(null)`
- [x] AC1+AC3: Update `InputPanel.tsx`
  - [x] Read `pathMode` and `topicText` from store
  - [x] When `pathMode === 'B'`: render `<TopicTextarea>` in place of story textarea
  - [x] When `pathMode === 'B'`: pre-flight validation checks `topicText.trim() !== ''` (hint on field)
  - [x] When `pathMode === 'B'`: Generate button label → "Generate"
  - [x] When `pathMode === 'A'`: Generate button label → "Convert to Japanese" (unchanged)
  - [x] `sessionRestored` also dismissed on `topicText` change
  - [x] Disable Generate button when `showConfirm` is true in `TopicTextarea` (pass `isConfirmOpen` prop or handle via store — see Dev Notes)
- [x] AC9: Write/update tests
  - [x] `TopicTextarea.test.tsx` (NEW) — see test guidance in Dev Notes
  - [x] `ModeToggle.test.tsx` — add dirty-warning tests
  - [x] `InputPanel.test.tsx` — add Path B rendering tests
  - [x] `authoringStore.test.ts` — add `storedInputs.topicText` test
  - [x] `useSession.test.ts` — add topicText persist/restore tests
  - [x] Run `pnpm test:unit` and `pnpm typecheck` — all pass

## Dev Notes

### Already Done (hotfix eb1c8a9 — do NOT redo):
- `storyLengthPreset`, `targetWordCount`, `setStoryLengthPreset`, `setTargetWordCount` in store
- `useSession` persist/restore for `storyLengthPreset` + `targetWordCount`
- `SettingsPanel` story length active when `pathMode === 'B'`

### Store: `topicText` and `StoredInputs` extension

Add to `AuthoringStore` interface and `defaultState`:
```typescript
topicText: string   // Path B topic input (separate from inputText which is Path A)
```

Extend `StoredInputs`:
```typescript
interface StoredInputs {
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
  topicText?: string       // Path B phase 1: snapshot of topic at generate() time
  englishDraft?: string    // Path B phase 2: snapshot of proposalText at approve() time
  targetWordCount?: number // Path B: snapshot of word count target
}
```

Update `generate()`:
```typescript
generate() {
  const { phase, inputText, chapterTarget, steeringInstructions, pathMode,
          temperature, grammarDist, topicText, targetWordCount } = get()
  if (phase !== 'idle' && phase !== 'error') return
  set({
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputJson: null,
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,
    storedInputs: {
      inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist,
      topicText,       // included for Path B SSE URL
      targetWordCount, // included for Path B (Story 3.4 will wire it to URL)
    },
  })
},
```

Update `approve()` to include `englishDraft`:
```typescript
approve() {
  const { phase, inputText, chapterTarget, steeringInstructions, pathMode,
          temperature, grammarDist, topicText, targetWordCount, proposalText } = get()
  if (phase !== 'proposal') return
  set({
    proposalApproved: true,
    phase: 'generating',
    runId: crypto.randomUUID(),
    outputIsDirty: false,
    errorCode: null,
    errorMessage: null,
    agentRunStarted: false,
    storedInputs: {
      inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist,
      topicText,
      targetWordCount,
      englishDraft: proposalText ?? '',  // Path B phase 2 SSE param
    },
  })
},
```

### `useAgUiRun.ts` URL Construction

After extracting `pathMode` and other existing params, add:
```typescript
const topicText    = storedInputs?.topicText    ?? ''
const englishDraft = storedInputs?.englishDraft ?? ''

// Path B params — add to query string
if (pathMode === 'B') {
  if (topicText)     params.set('topic', topicText)
  if (englishDraft)  params.set('englishDraft', englishDraft)
  // target_word_count deferred to Story 3.4 when backend also accepts it
}
```

The existing `inputText` param is still set (it is `""` for Path B phase 1, which the backend now accepts as optional). No code duplication.

### `TopicTextarea.tsx` Implementation

The component owns all suggest-topic UI state locally (isSuggesting, showConfirm, toast). It does NOT write suggest state to the global store — this is ephemeral UI state.

**Props interface:**
```typescript
interface TopicTextareaProps {
  hint?: boolean  // show error border when pre-flight validation fires
  disabled?: boolean
  onConfirmOpen?: (open: boolean) => void  // notifies InputPanel that confirm strip is open
}
```

The component reads `topicText`, `chapterTarget`, `setTopicText` from the store directly (to avoid prop drilling).

**Suggest-topic flow:**
```typescript
const doSuggest = async () => {
  if (isSuggesting) return  // debounce guard
  setIsSuggesting(true)
  try {
    const res = await fetch('/suggest-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter: chapterTarget }),
    })
    if (!res.ok) throw new Error('Request failed')
    const data = await res.json() as { topic: string }
    setTopicText(data.topic)
  } catch {
    setToastText('Could not fetch suggestion')
    setTimeout(() => setToastText(null), 4000)
  } finally {
    setIsSuggesting(false)
  }
}
```

**Debounce (300ms):** Use a `useRef<ReturnType<typeof setTimeout> | null>` to prevent rapid-fire clicks:
```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleSuggestClick = () => {
  if (isSuggesting) return
  if (debounceRef.current) return  // within debounce window
  debounceRef.current = setTimeout(() => { debounceRef.current = null }, 300)
  if (topicText) {
    setShowConfirm(true)
  } else {
    doSuggest()
  }
}
```

**Position of overlay button:** UX-DR8 specifies `position: relative` wrapper + `<textarea>` with `padding-bottom: 40px` + button `position: absolute; bottom: 8px; right: 8px`.

```tsx
<div className="relative">
  <textarea
    id="topic-input"
    value={topicText}
    onChange={e => { setTopicText(e.target.value); if (hint && e.target.value) clearHint(); }}
    className={cn(
      'w-full min-h-[120px] resize-none px-3 py-2 pb-10 text-sm border rounded-md',
      'bg-surface-subtle text-paper-text',
      'focus-visible:ring-2 ring-accent outline-none transition-colors',
      hint ? 'border-error' : 'border-border',
    )}
    placeholder="Describe the topic or setting for your story…"
    disabled={disabled}
  />
  <button
    type="button"
    aria-busy={isSuggesting}
    disabled={isSuggesting || disabled}
    onClick={handleSuggestClick}
    style={{ pointerEvents: isSuggesting || disabled ? 'none' : 'auto' }}
    className={cn(
      'absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-xs rounded border',
      'transition-colors',
      topicText
        ? 'border-accent text-accent hover:bg-accent/10'
        : 'border-border text-muted hover:text-paper-text hover:border-border',
    )}
  >
    {isSuggesting
      ? <span aria-label="Loading…" className="animate-spin inline-block">⟳</span>
      : topicText ? 'Replace topic' : '✦ Suggest a topic'
    }
  </button>
</div>
```

**SuggestConfirm strip** (rendered below the wrapper div):
```tsx
{showConfirm && (
  <div
    role="alert"
    className="mt-2 flex items-center gap-2 rounded-md border border-accent bg-accent-subtle px-3 py-2 text-sm"
  >
    <span className="flex-1 text-paper-text">Replace your current topic with a suggested one?</span>
    <button ref={confirmRef} type="button" onClick={handleConfirmReplace}
      className="text-accent hover:text-accent/80 font-medium focus-visible:ring-2 ring-accent outline-none rounded">
      Yes, replace
    </button>
    <button type="button" onClick={() => { setShowConfirm(false); onConfirmOpen?.(false) }}
      className="text-muted hover:text-paper-text focus-visible:ring-2 ring-accent outline-none rounded">
      Cancel
    </button>
  </div>
)}
```

**Focus management on SuggestConfirm appearance:**
```typescript
useEffect(() => {
  if (showConfirm) confirmRef.current?.focus()
}, [showConfirm])

// Escape dismisses
useEffect(() => {
  if (!showConfirm) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setShowConfirm(false); onConfirmOpen?.(false) }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [showConfirm])
```

### `InputPanel.tsx` — disabling Generate while SuggestConfirm is open

The cleanest approach without adding global store state: pass `onConfirmOpen` prop callback from `InputPanel` to `TopicTextarea`. `InputPanel` holds local state `isConfirmOpen: boolean`.

```typescript
// In InputPanel:
const [isConfirmOpen, setIsConfirmOpen] = useState(false)

// When rendering TopicTextarea:
<TopicTextarea
  hint={hints.topic}
  onConfirmOpen={setIsConfirmOpen}
/>

// Disable generate button:
const isGenerateDisabled = !canGenerate || backendStatus === 'unavailable' || isConfirmOpen
```

### `InputPanel.tsx` — Path B validation and button label

The `handleGenerate` function needs to branch by `pathMode`:
```typescript
const handleGenerate = () => {
  if (pathMode === 'A') {
    const missingStory   = inputText.trim() === ''
    const missingChapter = chapterTarget === ''
    if (missingStory || missingChapter) {
      setHints({ story: missingStory, chapter: missingChapter, topic: false })
      return
    }
  } else {
    const missingTopic   = topicText.trim() === ''
    const missingChapter = chapterTarget === ''
    if (missingTopic || missingChapter) {
      setHints({ story: false, chapter: missingChapter, topic: missingTopic })
      return
    }
  }
  setHints({ story: false, chapter: false, topic: false })
  generate()
}
```

Extend `ValidationHints`:
```typescript
interface ValidationHints {
  story: boolean
  chapter: boolean
  topic: boolean  // NEW
}
```

Generate button label:
```tsx
{pathMode === 'A' ? 'Convert to Japanese' : 'Generate'}
```

### `ModeToggle.tsx` — Dirty warning

```typescript
const outputIsDirty = useAuthoringStore(s => s.outputIsDirty)
const [pendingMode, setPendingMode] = useState<'A' | 'B' | null>(null)
const confirmRef = useRef<HTMLButtonElement>(null)

// Focus on confirm when warning appears
useEffect(() => {
  if (pendingMode !== null) confirmRef.current?.focus()
}, [pendingMode])

const handleModeClick = (mode: 'A' | 'B') => {
  if (mode === pathMode) return
  if (outputIsDirty) {
    setPendingMode(mode)
  } else {
    setPathMode(mode)
  }
}
```

Warning strip (rendered below the tablist div):
```tsx
{pendingMode !== null && (
  <div role="alert" className="mt-2 flex items-center gap-2 rounded-md border border-accent
    bg-accent-subtle px-3 py-2 text-sm">
    <span className="flex-1 text-paper-text">Switching mode will discard your edited output.</span>
    <button ref={confirmRef} type="button"
      onClick={() => { setPathMode(pendingMode); setPendingMode(null) }}
      className="text-accent font-medium hover:text-accent/80 focus-visible:ring-2 ring-accent outline-none rounded">
      Switch anyway
    </button>
    <button type="button" onClick={() => setPendingMode(null)}
      className="text-muted hover:text-paper-text focus-visible:ring-2 ring-accent outline-none rounded">
      Cancel
    </button>
  </div>
)}
```

### Test Guidance for `TopicTextarea.test.tsx`

Mock `fetch` with `vi.stubGlobal('fetch', vi.fn(...))` or `vi.fn()` on the global.

Key tests:
- Renders textarea with placeholder
- Renders "✦ Suggest a topic" button when topicText is empty
- Renders "Replace topic" button when topicText is non-empty
- Suggest button click (empty): calls `POST /suggest-topic`, populates textarea on success
- Suggest button click (has content): shows SuggestConfirm strip
- SuggestConfirm [Yes, replace]: fires request
- SuggestConfirm [Cancel]: dismisses without request
- SuggestConfirm Escape: dismisses without request
- SuggestConfirm: focus moves to [Yes, replace] on appearance
- Error: toast "Could not fetch suggestion" appears on fetch error
- Debounce: second click within 300ms does not fire second request

For debounce test: use `vi.useFakeTimers()` + `vi.runAllTimers()` / `vi.advanceTimersByTime(300)`.

### Test Guidance for `ModeToggle.test.tsx`

Existing tests must still pass. Add:
- When `outputIsDirty: true` and user clicks other mode → `pendingMode !== null` → warning strip visible
- [Switch anyway] → calls `setPathMode()`, strip dismissed
- [Cancel] → strip dismissed, `pathMode` unchanged
- When `outputIsDirty: false` → no strip, mode switches immediately

### Existing test breakage risk

`InputPanel.test.tsx` tests that check the story textarea (`#input-text`) will still pass since `pathMode` defaults to `'A'`. Path B tests need to first `useAuthoringStore.getState().setPathMode('B')`.

`ModeToggle.test.tsx` — existing test "updates pathMode when tab clicked" still passes (no dirty output by default). New tests add dirty scenarios.

### `useSession` test changes

Add to `useSession.test.ts`:
- `topicText: 'some topic'` in stored session → restored to store on hydration
- `topicText` written to localStorage when store changes

### API Contract Note

`POST /suggest-topic` endpoint is at `/suggest-topic` (no Vite proxy needed — the backend is at port 8000 and the proxy in `vite.config.ts` must forward `/suggest-topic` to port 8000).

**Check `vite.config.ts` and add `/suggest-topic` to the proxy config if it's not already there!**

Current proxy in `vite.config.ts` forwards `/run_sse`, `/cancel`, `/health`. This story requires adding `/suggest-topic` to that list.

### References

- [Source: _bmad-output/planning-artifacts/epics-story-authoring-tool.md — Story 3.2]
- [Source: _bmad-output/story-generator-context.md — Framework rules, UX-DR8, UX-DR9, UX-DR19]
- [Source: apps/story-generator/src/stores/authoringStore.ts — current store interface]
- [Source: apps/story-generator/src/components/InputPanel.tsx — current implementation]
- [Source: apps/story-generator/src/components/OutputPanel.tsx — toast pattern reference]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — URL construction pattern]
- [Source: apps/story-generator/src/hooks/useSession.ts — current SessionState interface]
- [Source: apps/story-generator/vite.config.ts — proxy config (add /suggest-topic)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Review Findings

- [x] [Review][Patch] P1: `isConfirmOpen` stuck `true` when `TopicTextarea` unmounts with strip open — add `useEffect` in `InputPanel` resetting `isConfirmOpen` when `pathMode !== 'B'` [InputPanel.tsx]
- [x] [Review][Patch] P2: Suggest button fires `/suggest-topic` with empty `chapter` when no chapter selected — disable button when `!chapterTarget` [TopicTextarea.tsx]
- [x] [Review][Patch] P3: Typing in `TopicTextarea` does not clear `sessionRestored` banner — add `_setSessionRestored(false)` to `onChange` handler in `TopicTextarea` [TopicTextarea.tsx]
- [x] [Review][Patch] P4: No test for Path B SSE URL construction (topic/englishDraft params) in `useAgUiRun` [useAgUiRun.test.ts]
- [x] [Review][Defer] D1: `doSuggest` silently dropped if `isSuggesting` true when `handleConfirmReplace` fires — unreachable via normal UI (strip can't open while isSuggesting) [TopicTextarea.tsx] — deferred, unreachable in normal UI flow
- [x] [Review][Defer] D2: `pendingMode` stale if `outputIsDirty` clears externally while strip visible [ModeToggle.tsx] — deferred, single-user v1; external outputIsDirty reset during mode-switch confirmation is very unlikely
- [x] [Review][Defer] D3: `doSuggest` overwrites user-typed content during in-flight request (no AbortController) [TopicTextarea.tsx] — deferred, no AbortController for v1; button disabled during fetch prevents normal flow
- [x] [Review][Defer] D4: No Escape key handler on ModeToggle dirty-output warning strip [ModeToggle.tsx] — deferred, AC6 does not require Escape; inconsistency with SuggestConfirm noted
- [x] [Review][Defer] D5: Debounce blocks re-click within 300ms after Cancel on SuggestConfirm [TopicTextarea.tsx] — deferred, expected behaviour confirmed by test; UX quirk only
- [x] [Review][Defer] D6: `approve()` snapshots live `topicText` not `storedInputs.topicText` (phase-2 mismatch if topic edited mid-stream) [authoringStore.ts] — deferred, story 3.3 owns the approval flow; mismatch only if user edits topic during an active stream
- [x] [Review][Defer] D7: `aria-busy` spinner inner span label; ModeToggle confirm strip role="alert" semantics [TopicTextarea.tsx, ModeToggle.tsx] — deferred, cosmetic/a11y; `aria-busy` on button is correct per spec
- [x] [Review][Defer] D8: Path B SSE URL construction — `topic` omitted from URL if topicText empty in Path B (unreachable via UI but untested) — partially fixed by P4
- [x] [Review][Defer] D9: No AbortController; component unmount during in-flight suggest-topic fires setTopicText on stale instance [TopicTextarea.tsx] — deferred, single-user v1; accept per existing pattern

### Completion Notes List

- 217/217 tests pass (180 existing + 37 new). TypeScript clean.
- `topicText` added to store, useSession, and StoredInputs; Path B URL params wired in useAgUiRun.
- `TopicTextarea`: overlay button, SuggestConfirm strip, debounce, focus management, error toast.
- `ModeToggle`: dirty-output confirmation strip with focus management.
- `InputPanel`: Path B conditional rendering, mode-aware validation and button label.
- `vite.config.ts`: `/suggest-topic` added to dev proxy.

### File List

- `apps/story-generator/src/stores/authoringStore.ts`
- `apps/story-generator/src/hooks/useSession.ts`
- `apps/story-generator/src/hooks/useAgUiRun.ts`
- `apps/story-generator/src/components/InputPanel.tsx`
- `apps/story-generator/src/components/ModeToggle.tsx`
- `apps/story-generator/src/components/TopicTextarea.tsx`
- `apps/story-generator/vite.config.ts`
- `apps/story-generator/src/__tests__/TopicTextarea.test.tsx`
- `apps/story-generator/src/__tests__/ModeToggle.test.tsx`
- `apps/story-generator/src/__tests__/InputPanel.test.tsx`
- `apps/story-generator/src/__tests__/authoringStore.test.ts`
- `apps/story-generator/src/__tests__/useSession.test.ts`
