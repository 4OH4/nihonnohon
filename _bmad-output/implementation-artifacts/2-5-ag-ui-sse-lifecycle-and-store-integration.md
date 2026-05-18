# Story 2.5: AG-UI SSE Lifecycle & Store Integration

Status: done

## Story

As a developer,
I want the `useAgUiRun` hook to manage the full SSE lifecycle — event mapping, timeouts, and cancellation — wired to the Zustand store,
so that all generation trigger and error recovery behaviour is tested in isolation before any UI components are built on top of it.

## Acceptance Criteria

**AC1 — SSE URL contains all required query params:**
Given `generate()` is dispatched from `idle` or `error` phase with inputs set,
when `useAgUiRun` initiates,
then `createEventSource` is called with a URL containing all required query params: `runId`, `inputText`, `chapter`, `pathMode`, `temperature`, `grammar_distribution`; `steeringInstructions` is only appended when non-empty.

**AC2 — RUN_STARTED clears first-event timeout:**
Given the SSE connection is open and the first-event timer is running,
when `RUN_STARTED` is received,
then the 3-second first-event timeout is cancelled (no error fires after the event).

**AC3 — RUN_FINISHED (story) commits buffer and transitions phase:**
Given `TEXT_MESSAGE_CHUNK` events have accumulated in the hook buffer,
when `RUN_FINISHED` (resultType='story') is received,
then `_setOutputJson` is called with the fully assembled buffer content and `phase → 'output-clean'`.

**AC4 — RUN_FINISHED (proposal) transitions to proposal phase:**
Given an M3 Path B generation is running,
when `RUN_FINISHED` (resultType='proposal') is received,
then `_setProposalText` is called with the assembled buffer and `phase → 'proposal'`.

**AC5 — RUN_CANCELLED transitions to idle with inputs preserved:**
Given a cancel has been issued,
when `RUN_CANCELLED` is received,
then `phase → 'idle'`; `runId → null`; all input fields remain unchanged.

**AC6 — 3-second first-event timeout triggers health check:**
Given no `RUN_STARTED` arrives within 3 seconds of the SSE connection opening,
when the first-event timeout fires and the health check fails,
then `_setError('BACKEND_UNAVAILABLE', '...')` is called and `phase → 'error'`.

**AC7 — 60-second generation timeout:**
Given no `RUN_FINISHED` has been received,
when 60 seconds elapse from connection open,
then `_setError('TIMEOUT', 'This took longer than expected — your inputs are preserved. Try again.')` is called and `phase → 'error'`.

**AC8 — Unexpected stream close transitions to error:**
Given the SSE stream closes without a preceding `RUN_FINISHED`,
when `onerror` fires,
then `_setError('BACKEND_UNAVAILABLE', '...')` is called and `phase → 'error'`.

**AC9 — Cancel dispatches POST and transitions to cancelling:**
Given the user calls `cancel()` while in generating phase,
when `useAgUiRun` handles the state change,
then `phase → 'cancelling'` and `POST /cancel/{runId}` is sent with the correct body `{ "type": "CANCEL", "runId": "..." }`.

**AC10 — ERROR event transitions to error phase:**
Given a `ERROR` event arrives from the backend,
when `useAgUiRun` processes it,
then `_setError(code, message)` is called and `phase → 'error'`.

**AC11 — All tests pass:**
Given the expanded test suite is run,
when `pnpm test:unit` is executed,
then all tests pass with no regressions; `pnpm typecheck` passes.

## Tasks / Subtasks

- [x] AC1+AC2+AC3+AC4+AC5+AC6+AC7+AC8+AC9+AC10: Expand `src/__tests__/useAgUiRun.test.ts`
  - [x] AC1: URL params test — verify factory called with correct URL including all required params
  - [x] AC1: steeringInstructions omitted when empty, included when set
  - [x] AC2: RUN_STARTED cancels first-event timeout (no error fires after 3s when RUN_STARTED received first)
  - [x] AC3: RUN_FINISHED (story) — buffer assembled across TEXT_MESSAGE_CHUNKs, committed to outputJson (already exists from Story 2.1 — verify it still passes)
  - [x] AC4: RUN_FINISHED (proposal) — calls _setProposalText, phase → proposal
  - [x] AC5: RUN_CANCELLED — phase → idle, inputs (inputText, chapterTarget) preserved
  - [x] AC6: 3s first-event timeout with failing health check — phase → error with BACKEND_UNAVAILABLE
  - [x] AC7: 60s generation timeout — phase → error with TIMEOUT code and exact error message
  - [x] AC8: onerror fires without prior RUN_FINISHED — phase → error with BACKEND_UNAVAILABLE
  - [x] AC9: cancel() → POST /cancel/{runId} with correct body
  - [x] AC10: ERROR event → phase → error with correct code/message
  - [x] AC11: Run `pnpm test:unit` — all pass; `pnpm typecheck` — no errors

## Dev Notes

### Files modified in this story

**Modified (tests only):**
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` — expand from 1 test to full suite

**No implementation changes needed:** `useAgUiRun.ts` is fully implemented from Story 2.1 (patched in code review). This story is test coverage only.

### The hook is already complete — do NOT modify useAgUiRun.ts

The hook was fully implemented in Story 2.1 and patched in its code review. Key behaviors already in place:
- `storedInputs` snapshot (not live fields) used for SSE URL — P1 patch from 2.1 review
- `bufferRef.current` only (no `|| parsed.content` fallback) — P4 patch
- Cancel `.catch` checks current phase before calling `_setError` — P2 patch
- First-event timeout `.catch` re-checks `phaseRef.current` after async health fetch — P7 patch

The only file to touch in this story is the test file.

### Current test file state

`src/__tests__/useAgUiRun.test.ts` currently has exactly 1 test (from Story 2.1):
- `RUN_FINISHED (story) commits assembled buffer and transitions to output-clean`

Story 2.5 adds ~11 more tests covering all remaining ACs.

### MockEventSource class (already in test file — DO NOT redefine)

```typescript
class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  private _closed = false

  close() { this._closed = true }
  isClosed() { return this._closed }

  /** Fire a message event with JSON-serialised data. */
  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}
```

**Do NOT redefine MockEventSource** — it already exists at the top of the test file. Add new `describe` blocks after the existing one.

### Test setup pattern (mirrors Story 2.1)

```typescript
describe('useAgUiRun — <feature>', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useAuthoringStore.getState()._reset()
  })

  it('...', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

    // Set inputs then trigger generation (sets storedInputs snapshot)
    useAuthoringStore.getState().setInputText('A story about Tanaka.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()

    renderHook(() => useAgUiRun(factory))
    // factory is now called; mockEs has onmessage/onerror assigned
    ...
  })
})
```

### AC1 — URL param verification

```typescript
it('factory called with URL containing all required params', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('A story about Tanaka.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  expect(factory).toHaveBeenCalledTimes(1)
  const url = factory.mock.calls[0][0] as string
  const params = new URLSearchParams(url.split('?')[1])

  expect(params.get('inputText')).toBe('A story about Tanaka.')
  expect(params.get('chapter')).toBe('Genki I Ch.6')
  expect(params.get('pathMode')).toBe('A')
  expect(params.get('temperature')).toBe('1')
  expect(params.get('grammar_distribution')).toBe('1')
  // runId must be present and truthy
  expect(params.get('runId')).toBeTruthy()
})

it('steeringInstructions omitted from URL when empty', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('A story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.3')
  // leave steeringInstructions empty (default '')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  const url = factory.mock.calls[0][0] as string
  const params = new URLSearchParams(url.split('?')[1])
  expect(params.has('steeringInstructions')).toBe(false)
})

it('steeringInstructions included in URL when set', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('A story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.3')
  useAuthoringStore.getState().setSteeringInstructions('Use simple sentences.')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  const url = factory.mock.calls[0][0] as string
  const params = new URLSearchParams(url.split('?')[1])
  expect(params.get('steeringInstructions')).toBe('Use simple sentences.')
})
```

### AC2 — RUN_STARTED cancels first-event timeout

```typescript
it('RUN_STARTED cancels first-event timeout so no error fires at 3s', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  // RUN_STARTED arrives before 3s timeout
  act(() => {
    mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
  })

  // Advance past the 3s window — no error should fire
  act(() => {
    vi.advanceTimersByTime(5_000)
  })

  expect(useAuthoringStore.getState().phase).toBe('generating')
  expect(useAuthoringStore.getState().errorCode).toBeNull()
})
```

### AC4 — RUN_FINISHED (proposal)

```typescript
it('RUN_FINISHED (proposal) calls _setProposalText and transitions to proposal', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: 'English draft' })
    mockEs.emit({ type: 'RUN_FINISHED', resultType: 'proposal', content: '' })
  })

  expect(useAuthoringStore.getState().proposalText).toBe('English draft')
  expect(useAuthoringStore.getState().phase).toBe('proposal')
})
```

### AC5 — RUN_CANCELLED preserves inputs

```typescript
it('RUN_CANCELLED transitions to idle and preserves inputs', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('My story text.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.8')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.emit({ type: 'RUN_CANCELLED', runId: useAuthoringStore.getState().runId })
  })

  const state = useAuthoringStore.getState()
  expect(state.phase).toBe('idle')
  expect(state.runId).toBeNull()
  expect(state.inputText).toBe('My story text.')
  expect(state.chapterTarget).toBe('Genki I Ch.8')
})
```

### AC6 — 3s first-event timeout with failing health check

**CRITICAL**: The first-event timeout callback is `async` (it `await`s `fetch`). Use `vi.advanceTimersByTimeAsync` (Vitest 3.x) to advance time AND flush the resulting async microtasks. Plain `vi.advanceTimersByTime` advances timers synchronously but does not flush the async callback body.

```typescript
it('3s first-event timeout fires health check and sets BACKEND_UNAVAILABLE when health fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  // Advance timers + flush the async fetch rejection
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000)
  })

  expect(useAuthoringStore.getState().phase).toBe('error')
  expect(useAuthoringStore.getState().errorCode).toBe('BACKEND_UNAVAILABLE')
})
```

**Note**: `vi.advanceTimersByTimeAsync` is available in Vitest 3.x (project uses Vitest 3.0.0). It advances time AND resolves all micro-tasks triggered by the timers, making it the correct choice for `async setTimeout` callbacks.

**Note on AbortSignal.timeout**: The hook wraps the health fetch with `AbortSignal.timeout(5_000)`. In the test, the stubbed fetch rejects immediately, so the AbortSignal's 5s real-timer never fires. This is safe.

### AC7 — 60s generation timeout

```typescript
it('60s generation timeout sets TIMEOUT error with correct message', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  // Receive RUN_STARTED to cancel the 3s first-event timeout
  act(() => {
    mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
  })

  // Advance past 60s generation timeout
  act(() => {
    vi.advanceTimersByTime(60_000)
  })

  const state = useAuthoringStore.getState()
  expect(state.phase).toBe('error')
  expect(state.errorCode).toBe('TIMEOUT')
  expect(state.errorMessage).toBe('This took longer than expected — your inputs are preserved. Try again.')
})
```

### AC8 — Unexpected stream close

```typescript
it('unexpected stream close (onerror without RUN_FINISHED) sets BACKEND_UNAVAILABLE', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.onerror?.({} as Event)
  })

  const state = useAuthoringStore.getState()
  expect(state.phase).toBe('error')
  expect(state.errorCode).toBe('BACKEND_UNAVAILABLE')
  expect(state.errorMessage).toContain('Connection lost')
})
```

### AC8 — Stream close AFTER RUN_FINISHED is a no-op

```typescript
it('onerror after RUN_FINISHED does NOT override the output-clean phase', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.emit({ type: 'RUN_FINISHED', resultType: 'story', content: '' })
    mockEs.onerror?.({} as Event)  // fires after completion
  })

  expect(useAuthoringStore.getState().phase).toBe('output-clean')
})
```

### AC9 — Cancel dispatches POST

```typescript
it('cancel() dispatches POST /cancel/{runId} with correct body', () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)

  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  const { runId } = useAuthoringStore.getState()
  renderHook(() => useAgUiRun(factory))

  act(() => {
    useAuthoringStore.getState().cancel()
  })

  expect(useAuthoringStore.getState().phase).toBe('cancelling')
  expect(fetchMock).toHaveBeenCalledWith(
    `/cancel/${runId}`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'CANCEL', runId }),
    }),
  )
})
```

### AC10 — ERROR event

```typescript
it('ERROR event transitions to error with correct code and message', () => {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

  useAuthoringStore.getState().setInputText('Story.')
  useAuthoringStore.getState().setChapterTarget('Genki I Ch.1')
  useAuthoringStore.getState().generate()

  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.emit({ type: 'ERROR', code: 'GENERATION_FAILED', message: 'LLM call failed' })
  })

  const state = useAuthoringStore.getState()
  expect(state.phase).toBe('error')
  expect(state.errorCode).toBe('GENERATION_FAILED')
  expect(state.errorMessage).toBe('LLM call failed')
})
```

### Test structure plan

Add the following `describe` blocks after the existing one in `useAgUiRun.test.ts`:

1. `'useAgUiRun — SSE URL construction'` — AC1 tests (3 tests)
2. `'useAgUiRun — RUN_STARTED handling'` — AC2 (1 test)
3. `'useAgUiRun — proposal flow'` — AC4 (1 test)
4. `'useAgUiRun — RUN_CANCELLED'` — AC5 (1 test)
5. `'useAgUiRun — first-event timeout'` — AC6 (1 test, async)
6. `'useAgUiRun — generation timeout'` — AC7 (1 test)
7. `'useAgUiRun — stream close'` — AC8 (2 tests)
8. `'useAgUiRun — cancellation POST'` — AC9 (1 test)
9. `'useAgUiRun — ERROR event'` — AC10 (1 test)

Total: ~12 new tests + 1 existing = **~13 tests** in the file.

### Store fields used (all exist — no store changes needed)

- `setSteeringInstructions` — already on store from Story 2.1
- `_setProposalText` — already on store (proposal phase support)
- `proposalText` — already on store

### Patterns from previous stories

**From Story 2.1 (existing test pattern):** `vi.useFakeTimers()` + `renderHook()` + `act(() => { mockEs.emit(...) })` — use this exact pattern. Do NOT use `waitFor` — it uses real setTimeout which conflicts with fake timers.

**From Story 2.3 (BackendStatus tests):** `vi.stubGlobal('fetch', vi.fn()...)` for mocking fetch. Must be in `beforeEach`/test body, not module-level.

**From Story 2.1 (act() warning):** The known Zustand/React 18 act() warning for store subscription re-renders is a false positive — tests pass correctly. Document but do not attempt to suppress.

**`vi.advanceTimersByTimeAsync`:** Vitest 3.x async timer advancement. Use in `async` tests wrapped in `await act(async () => { ... })` to correctly flush the async callback body of the first-event timeout.

### References

- [epics-story-authoring-tool.md — Story 2.5](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [docs/adr/004-agui-event-types.md — event contract](../../../../docs/adr/004-agui-event-types.md)
- [architecture-story-authoring-tool.md — useAgUiRun contract](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [2-1 story — useAgUiRun implementation, MockEventSource, P1-P7 patches](./)

### Review Findings

- [x] [Review][Patch] `vi.stubGlobal('fetch')` not restored by `vi.restoreAllMocks()` — add `vi.unstubAllGlobals()` to afterEach in AC6 and AC9 describe blocks [useAgUiRun.test.ts]
- [x] [Review][Patch] AC6 health-fail test verifies error state but not that `/health` was actually fetched — capture mock and add call assertion [useAgUiRun.test.ts]
- [x] [Review][Defer] AC2 timer-cleared assertion is indirect (negative outcome only) — proving clearTimeout was called requires complex scaffolding not worth the overhead for v1
- [x] [Review][Defer] AC4 proposal path uses single-chunk emission — multi-chunk proposal test would be stronger but same buffer mechanism is tested in the story path
- [x] [Review][Defer] AC9 cancel test does not verify mockEs.close() is called — cancel lifecycle cleanup verified by hook teardown logic, not directly tested
- [x] [Review][Defer] No test for re-renders with a changed createEventSource factory — old ES cleanup on factory change
- [x] [Review][Defer] No test for hook with store in non-generating phase on mount (guard path)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- AC1: 4 tests — URL contains all required params, steeringInstructions omitted when empty, included when set, runId matches store.
- AC2: 1 test — RUN_STARTED clears 3s timer so no error fires at 5s.
- AC3: 1 test (existing from Story 2.1) — buffer assembled from chunks, committed on RUN_FINISHED story.
- AC4: 1 test — RUN_FINISHED proposal → proposalText set, phase → proposal.
- AC5: 2 tests — RUN_CANCELLED → phase idle, runId null; inputs preserved.
- AC6: 2 tests — 3s timeout + health fail → BACKEND_UNAVAILABLE; health success → no error.
- AC7: 1 test — 60s timeout → TIMEOUT code with exact message.
- AC8: 2 tests — onerror without RUN_FINISHED → BACKEND_UNAVAILABLE; onerror after RUN_FINISHED → no-op.
- AC9: 1 test — cancel() → POST /cancel/{runId} with correct body.
- AC10: 2 tests — ERROR event → correct code/message; runId cleared.
- AC11: 61/61 tests passing, typecheck clean.
- Used `setupGenerating` shared helper to reduce boilerplate across describe blocks.
- Used `vi.advanceTimersByTimeAsync` (Vitest 3.x) for AC6 async timer tests.

### File List

- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` (modified — expanded from 1 to 16 tests)
- `_bmad-output/implementation-artifacts/2-5-ag-ui-sse-lifecycle-and-store-integration.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)
