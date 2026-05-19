# Story Supp-1: Gemini Thinking Tokens as Live Status Text

Status: done

## Story

As a content author,
I want to see a live status hint while the story is being generated,
so that the "Generating story…" wait feels less opaque and I know the model is actively working.

## Acceptance Criteria

**AC1 — AGENT_STATUS events emitted during all generation paths:**
Given the backend receives a `/run_sse` request for Path A, Path B phase 1, or Path B phase 2,
when Gemini streams thinking tokens before producing its output,
then the backend emits one or more `AGENT_STATUS` events (per ADR-004) for each non-empty
thought chunk before emitting `TEXT_MESSAGE_CHUNK` / `RUN_FINISHED`; no `AGENT_STATUS` events
are emitted when the model produces no thought tokens.

**AC2 — Status hint displayed in GenerationProgress:**
Given the `generating` phase is active and `agentRunStarted` is true,
when one or more `AGENT_STATUS` events have arrived,
then `GenerationProgress` shows the main label "Generating story…" on the primary text line
and the most recent hint on a separate, visually subordinate line (smaller, muted text,
prefixed "Thinking: "); the hint is word-boundary-truncated to ≤ 80 characters (cut at
the last word boundary before the limit, appending "…"); if no `AGENT_STATUS` has arrived,
no hint line is rendered; the elapsed timer and shimmer are unaffected.

**AC3 — Status hint clears on completion, error, and cancel:**
Given the status hint is visible,
when `RUN_FINISHED`, `ERROR`, or `RUN_CANCELLED` arrives,
then `agentStatus` in the store is reset to `null` so no stale hint carries over to the
next run.

**AC4 — Hint visible during Path B phase 1 (English proposal generation):**
Given a Path B phase 1 (topic → English proposal) request is in flight,
when Gemini streams thinking tokens before producing the English text,
then `AGENT_STATUS` events are emitted by the backend and the "Thinking: " hint is visible
in `GenerationProgress` the same as AC2; the accumulated non-thought parts form the English
proposal text; no regression to existing proposal flow or session restore.

**AC5 — Existing tests pass; new tests cover the AGENT_STATUS path:**
Given all changes are implemented,
when `pnpm test:unit`, `pnpm typecheck`, and `make test` (backend) run,
then: all pre-existing `test_agent.py` tests that exercised Path A, B1, or B2 have been
migrated to inject via `gemini_stream_client=make_mock_stream_client(fixture_json)` (the
old `gemini_client=` param is not used for any generation path test); new tests cover: backend
AGENT_STATUS emission when thought parts are present, no AGENT_STATUS when no thoughts,
`useAgUiRun` dispatches `_setAgentStatus`; `GenerationProgress` renders hint with "Thinking: "
prefix and word-boundary truncation; store resets `agentStatus` to `null` on `generate()`,
`RUN_FINISHED`, `ERROR`, and `RUN_CANCELLED`.

## Tasks / Subtasks

- [x] AC1: Backend — switch all generation paths to async streaming (AC: #1, #4)
  - [x] Add `gemini_stream_client` parameter to `StoryGeneratorAgent.__init__`
  - [x] Add `_get_stream_caller()` method — returns async generator callable
  - [x] Replace blocking call in Path A/B2 branch with wall-clock-deadline streaming loop
  - [x] Replace blocking call in `_generate_proposal` (Path B1) with the same streaming loop
  - [x] Add `thinking_config=ThinkingConfig(thinking_budget=THINKING_BUDGET, include_thoughts=True)` to `GenerateContentConfig` in both branches
  - [x] Yield `AGENT_STATUS` for `part.thought == True` chunks in both branches; accumulate non-thought parts
  - [x] Validate perf-logger output unchanged in both branches: still logs elapsed_ms and response_chars
- [x] AC1: Update ADR-004 — remove "M2 only" qualifier from `AGENT_STATUS` (AC: #1)
- [x] AC2/AC3: Store — add `agentStatus` field and `_setAgentStatus` action (AC: #2, #3)
  - [x] Add `agentStatus: string | null` to `AuthoringStore` interface
  - [x] Add `_setAgentStatus(msg: string | null): void` to interface
  - [x] Implement: `set({ agentStatus: msg })`
  - [x] Reset to `null` in `generate()`, `_setOutputJson()`, `_setError()`,
        `_setProposalText()`, `_resolveCancel()`
- [x] AC2/AC4: Hook — handle `AGENT_STATUS` in `useAgUiRun` (AC: #2, #4)
  - [x] Add `| { type: 'AGENT_STATUS'; message: string }` to `AgUiEvent` union
  - [x] Add `_setAgentStatus` to destructured store actions
  - [x] Add `case 'AGENT_STATUS': _setAgentStatus(parsed.message); break` to switch
  - [x] Add 500 ms debounce before dispatching to store (prevents rapid `aria-live` announcements)
- [x] AC2: UI — render status hint in `GenerationProgress` (AC: #2)
  - [x] Read `agentStatus` from store
  - [x] Add `truncateHint()` helper using word-boundary truncation (not hard char slice)
  - [x] Render hint as a separate subordinate line: `text-xs text-muted`, prefixed "Thinking: "
  - [x] Only render the hint line when `agentStatus !== null && phase === 'generating' && agentRunStarted`
- [x] AC5: Tests (AC: #5)
  - [x] Backend `test_agent.py` — AGENT_STATUS emitted from thought chunks
  - [x] Backend `test_agent.py` — no AGENT_STATUS when mock yields no thought parts
  - [x] `useAgUiRun.test.ts` — AGENT_STATUS sets agentStatus in store
  - [x] `GenerationProgress.test.tsx` (or existing snapshot) — hint shown and truncated
  - [x] `authoringStore.test.ts` — agentStatus resets on completion, error, cancel

## Dev Notes

### Current State

**Backend generation (Path A/B2) — `agent.py` lines 322–412:**

The current implementation is a single blocking call:
```python
config = genai_types.GenerateContentConfig(
    response_mime_type="application/json",
    temperature=temperature,
)
call = self._get_caller()
response = await asyncio.wait_for(
    asyncio.to_thread(call, GEMINI_MODEL, prompt, config),
    timeout=self._generation_timeout_s,
)
raw_json = getattr(response, "text", None)
```

The injectable seam is `self._gemini_client`: a `(model, contents, config) → response` sync callable.
Tests inject via `gemini_client=lambda model, contents, config: SimpleNamespace(text=fixture_json)`.

**Path B phase 1 (`_generate_proposal`) is also converted to async streaming** — same
pattern as the JSON path. The accumulated non-thought parts form the English proposal text
(plain string, no `json.loads`). The same `_get_stream_caller()` and wall-clock deadline
loop are reused; the only differences are the `GenerateContentConfig` (no
`response_mime_type`) and how the accumulated parts are used downstream.

**`_generate_proposal` thinking note:** The proposal path has no `ThinkingConfig` set, so
Gemini 2.5 Flash may think silently. That thinking is not currently captured. This story
does NOT convert `_generate_proposal` to streaming — doing so would require a separate
injection seam and is deferred. AC4 is satisfied because the hook already handles
`AGENT_STATUS` after the hook changes.

**Store — `authoringStore.ts`:**
- `agentRunStarted: boolean` already exists (resets in `generate()`)
- `agentStatus` does not exist yet — add alongside `agentRunStarted`
- Reset pattern: look at how `agentRunStarted` is reset in `generate()` at line ~171 and
  reset `agentStatus: null` in the same locations

**Hook — `useAgUiRun.ts` lines 6–12:**
Current `AgUiEvent` union has 5 variants. Add a 6th. The `_setAgentStatus` action must be
destructured from `store` alongside the other actions (line ~44–49).

**GenerationProgress — current label logic (lines 70–77):**
```tsx
if (phase === 'generating') {
  statusLabel = agentRunStarted ? 'Generating story…' : 'Connecting…'
} else if (phase === 'cancelling') {
  statusLabel = 'Stopping…'
} else {
  statusLabel = ''
}
```
Expand the `agentRunStarted` branch to incorporate the hint.

---

### Task 1: Backend streaming + thought extraction

#### 1a. New injection seam

Add a second injectable to `StoryGeneratorAgent.__init__`:

```python
def __init__(
    self,
    vocab_data: VocabData,
    grammar_data: GrammarData,
    gemini_client=None,          # existing: (model, contents, config) → response
    gemini_stream_client=None,   # new: async callable (model, contents, config) → AsyncIterator[chunk]
    generation_timeout_s: float = 55.0,
) -> None:
    self._vocab_data = vocab_data
    self._grammar_data = grammar_data
    self._gemini_client = gemini_client
    self._gemini_stream_client = gemini_stream_client
    self._generation_timeout_s = generation_timeout_s
```

#### 1b. `_get_stream_caller()` — production async streaming

```python
def _get_stream_caller(self):
    """Return async streaming callable (model, contents, config) → AsyncIterator[chunk]."""
    if self._gemini_stream_client is not None:
        return self._gemini_stream_client
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
    from google import genai

    client = genai.Client(api_key=api_key)

    async def _stream(model, contents, config):
        # generate_content_stream is a coroutine returning an async iterable — await
        # the call, then iterate the result. Confirmed via SDK issue #226.
        response = await client.aio.models.generate_content_stream(
            model=model, contents=contents, config=config
        )
        async for chunk in response:
            yield chunk

    # Cache on _gemini_stream_client so subsequent calls reuse the same client
    self._gemini_stream_client = _stream
    return _stream
```

#### 1c. Replace the blocking call in the Path A/B2 branch

Replace lines ~322–354 (the `asyncio.wait_for` block through `raw_json = ...`):

```python
# Call Gemini with streaming to capture thinking tokens as AGENT_STATUS events
from google.genai import types as genai_types

config = genai_types.GenerateContentConfig(
    response_mime_type="application/json",
    temperature=temperature,
    thinking_config=genai_types.ThinkingConfig(
        thinking_budget=THINKING_BUDGET,
        include_thoughts=True,   # required to receive thought parts in stream chunks
    ),
)
stream = self._get_stream_caller()
logger.debug("Streaming %s (timeout=%ss, thinking_budget=%s)",
             GEMINI_MODEL, self._generation_timeout_s, THINKING_BUDGET)

raw_json_parts: list[str] = []
deadline = time.monotonic() + self._generation_timeout_s
t0 = time.perf_counter()

try:
    # generate_content_stream is a coroutine — await it, then iterate the async iterable
    response = await stream(GEMINI_MODEL, prompt, config)
    async for chunk in response:
        if time.monotonic() > deadline:
            raise asyncio.TimeoutError()
        # candidates can be None on some SDK versions (see SDK issue #226)
        candidates = getattr(chunk, 'candidates', None) or []
        if not candidates:
            continue
        content = getattr(candidates[0], 'content', None)
        if not content:
            continue
        for part in getattr(content, 'parts', []):
            if getattr(part, 'thought', False):
                thought_text = (getattr(part, 'text', None) or '').strip()
                if thought_text:
                    yield {"type": "AGENT_STATUS", "message": thought_text}
            else:
                raw_json_parts.append(getattr(part, 'text', None) or '')
    raw_json = ''.join(raw_json_parts)
    elapsed_ms = (time.perf_counter() - t0) * 1000
except asyncio.TimeoutError:
    # ... same timeout handling as before ...
```

Add the module-level constant near the top of `agent.py` (alongside `GEMINI_MODEL`):
```python
THINKING_BUDGET = 16384  # thinking tokens; caps pre-JSON reasoning at ~2 minutes
```

The `asyncio.TimeoutError`, `Exception` catch blocks and the `_perf_logger.info(...)` call
that follow are **unchanged** — copy them verbatim from the existing code. The `raw_json`
variable name is preserved so all downstream code (safety-filter guard, `json.loads`,
validation, `TEXT_MESSAGE_CHUNK` emit) is untouched.

#### 1d. Chunk part access — defensive pattern

The google-genai SDK chunk shape varies by version. Prefer the defensive attribute access
shown above (`getattr`) over direct indexing. Also guard `candidates` being empty:
```python
candidates = getattr(chunk, 'candidates', [])
if not candidates:
    continue
content = getattr(candidates[0], 'content', None)
if not content:
    continue
for part in getattr(content, 'parts', []):
    ...
```

#### 1e. `_generate_proposal` streaming — what differs from the JSON path

The streaming loop body is identical. The differences are:

1. **Config** — no `response_mime_type`:
   ```python
   config = genai_types.GenerateContentConfig(
       temperature=temperature,
       thinking_config=genai_types.ThinkingConfig(
           thinking_budget=THINKING_BUDGET,
           include_thoughts=True,
       ),
   )
   ```

2. **Accumulation** — parts are plain text, not JSON fragments:
   ```python
   proposal_parts: list[str] = []
   # ... same streaming loop ...
   # non-thought parts:
   proposal_parts.append(getattr(part, 'text', None) or '')
   # ...
   proposal_text = ''.join(proposal_parts)
   ```

3. **No `json.loads`** — `proposal_text` is used directly (already plain prose).

4. **Safety-filter guard** — same pattern: if `proposal_text` is empty/None after the
   loop, yield an `ERROR` event (mirrors the existing `raw_json is None` guard).

Everything else — `RUN_STARTED` already emitted by the caller, wall-clock deadline,
perf logger, `asyncio.TimeoutError` handler — is identical to the JSON path.

#### 1f. Timeout mechanism — why this replaces asyncio.wait_for

`asyncio.wait_for` wraps a coroutine or future; it cannot cancel a running async generator
mid-iteration. The wall-clock deadline approach (`time.monotonic() > deadline` per chunk)
is idiomatic for streaming and directly fixes the deferred issue in `deferred-work.md`:
"Dangling threads on asyncio.TimeoutError: asyncio.to_thread threads can't be cancelled."
This story eliminates `asyncio.to_thread` entirely for the JSON path.

---

### Task 2: ADR-004 update

In `docs/adr/004-agui-event-types.md`, line 95–109:

Change the heading from:
```
#### `AGENT_STATUS` *(M2 only)*
```
to:
```
#### `AGENT_STATUS`
```

Update the description body:

```
Emitted zero or more times during generation to surface a live status hint to the author.
Each event replaces the previous status message — the frontend displays only the most recent
value. In M1, these events carry Gemini thinking-token text emitted during the pre-JSON
reasoning phase (Path A and Path B phase 2 only). In M2, they will additionally carry
ReAct agent step messages.
```

In the `useAgUiRun` event mapping table, update the AGENT_STATUS row:
```
| `AGENT_STATUS` | update `agentStatus` in store; `GenerationProgress` appends truncated hint |
```

---

### Task 3: Store changes (`authoringStore.ts`)

**Interface addition** — add after `agentRunStarted`:
```typescript
/** Latest AGENT_STATUS message from the backend; null when not generating or cleared. */
agentStatus: string | null
_setAgentStatus: (msg: string | null) => void
```

**Implementation** — in the `create(...)` body:

Initial state:
```typescript
agentStatus: null,
```

Action:
```typescript
_setAgentStatus: (msg) => set({ agentStatus: msg }),
```

**Reset in `generate()`** — add alongside the `agentRunStarted: false` reset:
```typescript
agentStatus: null,
```

**Reset in `_setOutputJson()`**, `_setError()`, `_setProposalText()`, `_resolveCancel()` —
add `agentStatus: null` to each `set({...})` call. Find these by searching for
`agentRunStarted` resets — they already exist in `_setError` and `_resolveCancel`.
Check `_setOutputJson` and `_setProposalText` — `agentRunStarted` may not be reset there
(it transitions on phase, not on these actions); add `agentStatus: null` regardless.

---

### Task 4: Hook changes (`useAgUiRun.ts`)

**Type union** — add after the last variant (line 11):
```typescript
| { type: 'AGENT_STATUS'; message: string }
```

**Destructure** — add `_setAgentStatus` to the destructured store actions (line ~44):
```typescript
const {
  runId,
  storedInputs,
  _setOutputJson,
  _setProposalText,
  _setError,
  _resolveCancel,
  _markRunStarted,
  _setAgentStatus,   // add
} = store
```

**Switch case** — add before (or after) `case 'RUN_STARTED'`. Debounce dispatches to
avoid rapid `aria-live` announcements when thinking chunks arrive in quick succession:
```typescript
case 'AGENT_STATUS': {
  if (agentStatusTimerRef.current) clearTimeout(agentStatusTimerRef.current)
  agentStatusTimerRef.current = setTimeout(() => {
    _setAgentStatus(parsed.message)
  }, 500)
  break
}
```

Add `agentStatusTimerRef` alongside the other refs at the top of the hook:
```typescript
const agentStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Add it to `clearTimers()`:
```typescript
const clearTimers = () => {
  if (firstEventRef.current)    clearTimeout(firstEventRef.current)
  if (genTimeoutRef.current)    clearTimeout(genTimeoutRef.current)
  if (agentStatusTimerRef.current) clearTimeout(agentStatusTimerRef.current)
}
```

---

### Task 5: `GenerationProgress.tsx` UI changes

**Store read** — add after the existing `agentRunStarted` read:
```tsx
const agentStatus = useAuthoringStore(s => s.agentStatus)
```

**Truncation helper** — add as a module-level pure function. Cuts at the last word
boundary before the limit rather than splitting mid-word:
```tsx
function truncateHint(msg: string, max = 80): string {
  if (msg.length <= max) return msg
  const cut = msg.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}
```

**Status label** — the main `statusLabel` logic is unchanged; `agentRunStarted` branch
stays `'Generating story…'`. The hint is rendered as a separate element, not appended
to the label:
```tsx
if (phase === 'generating') {
  statusLabel = agentRunStarted ? 'Generating story…' : 'Connecting…'
}
```

**Hint element** — add below the existing `<span aria-live="polite">` row, inside the
`<div className="flex items-center justify-between">` wrapper or as a new row below it:
```tsx
{agentRunStarted && agentStatus && phase === 'generating' && (
  <p className="text-xs text-muted truncate">
    Thinking: {truncateHint(agentStatus)}
  </p>
)}
```

The hint is outside the `aria-live="polite"` span intentionally — the debounce in the
hook (see Task 4) already limits announcement frequency; the `<p>` element is
non-announcing by default, so screen readers won't double-fire.

---

### Task 6: Tests

#### Backend `test_agent.py`

The existing `make_mock_client` returns a sync `(model, contents, config) → SimpleNamespace(text=json)`.
Existing tests remain unchanged — they inject via `gemini_client=`, which is the blocking path.
The new streaming path is injected via `gemini_stream_client=`.

**Mock chunk helper:**
```python
from types import SimpleNamespace

def make_part(text: str, thought: bool = False):
    return SimpleNamespace(text=text, thought=thought)

def make_chunk(parts: list):
    content = SimpleNamespace(parts=parts)
    candidate = SimpleNamespace(content=content)
    return SimpleNamespace(candidates=[candidate])

async def make_stream_client(chunks: list):
    """Returns a stream callable that yields the given chunks."""
    async def _stream(model, contents, config):
        for chunk in chunks:
            yield chunk
    return _stream
```

**Test: AGENT_STATUS emitted for thought chunks:**
```python
import asyncio

def test_agent_status_emitted_for_thought_chunks(vocab_data, grammar_data, fixture_json):
    """AGENT_STATUS events are yielded for thought parts; RUN_FINISHED follows."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream(model, contents, config):
        yield make_chunk([make_part("Planning the structure…", thought=True)])
        yield make_chunk([make_part(fixture_json, thought=False)])

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream
    )
    events = _collect(
        agent.generate(run_id="t1", input_text="A story.", chapter="Genki I Ch.3")
    )
    types = [e["type"] for e in events]
    assert "AGENT_STATUS" in types
    status_events = [e for e in events if e["type"] == "AGENT_STATUS"]
    assert status_events[0]["message"] == "Planning the structure…"
    # AGENT_STATUS must appear before TEXT_MESSAGE_CHUNK
    assert types.index("AGENT_STATUS") < types.index("TEXT_MESSAGE_CHUNK")


def test_no_agent_status_when_no_thoughts(vocab_data, grammar_data, fixture_json):
    """No AGENT_STATUS emitted when all stream parts are non-thought content."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream(model, contents, config):
        yield make_chunk([make_part(fixture_json, thought=False)])

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream
    )
    events = _collect(
        agent.generate(run_id="t2", input_text="A story.", chapter="Genki I Ch.3")
    )
    assert all(e["type"] != "AGENT_STATUS" for e in events)


def test_empty_thought_text_not_emitted(vocab_data, grammar_data, fixture_json):
    """AGENT_STATUS is not emitted for thought parts with empty/whitespace text."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream(model, contents, config):
        yield make_chunk([make_part("   ", thought=True)])  # whitespace only
        yield make_chunk([make_part(fixture_json, thought=False)])

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream
    )
    events = _collect(
        agent.generate(run_id="t3", input_text="A story.", chapter="Genki I Ch.3")
    )
    assert all(e["type"] != "AGENT_STATUS" for e in events)


def test_streaming_timeout_yields_error(vocab_data, grammar_data, fixture_json):
    """asyncio.TimeoutError during streaming yields an ERROR event, not a crash."""
    import asyncio
    from story_generator.agent import StoryGeneratorAgent

    async def slow_stream(model, contents, config):
        yield make_chunk([make_part("Thinking…", thought=True)])
        await asyncio.sleep(120)  # will never be reached — deadline fires first
        yield make_chunk([make_part(fixture_json, thought=False)])

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data,
        gemini_stream_client=slow_stream,
        generation_timeout_s=0.01,  # immediate timeout
    )
    events = _collect(
        agent.generate(run_id="t4", input_text="A story.", chapter="Genki I Ch.3")
    )
    error = next((e for e in events if e["type"] == "ERROR"), None)
    assert error is not None
    assert error["code"] == "TIMEOUT"
```

**Required migration of existing Path A/B2 tests:**

After this story, the Path A/B2 JSON generation path reads from `_get_stream_caller()`,
not `_get_caller()`. Any existing test that injects via `gemini_client=` and calls
`agent.generate()` without a `topic=` (i.e., exercises Path A or Path B phase 2) will
no longer reach its mock — the test will hang or call the real API.

**Every such test must be migrated.** The canonical helper is:
```python
def make_mock_stream_client(fixture_json: str):
    """Drop-in streaming replacement for make_mock_client — no thoughts, one content chunk."""
    async def _stream(model, contents, config):
        # _get_stream_caller awaits this, so the mock must be a coroutine returning an
        # async iterable. An async generator satisfies both constraints.
        response = await asyncio.sleep(0) or None  # yield control, then fall through
        yield make_chunk([make_part(fixture_json, thought=False)])
    return _stream
```

Simpler — since `_get_stream_caller` wraps the callable and calls `await stream(...)`,
the mock must itself be an `async def` that can be `await`-ed and then iterated.
An async generator function is both awaitable (returns a coroutine) and async-iterable.
Use it like this:

```python
# Before:
agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json))

# After:
agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json))
```

Path B phase 1 (`_generate_proposal`) is also converted — existing tests that inject via
`gemini_client=` and supply `topic=` must also be migrated to `gemini_stream_client=`.
After this story **no test uses `gemini_client=`** for any `agent.generate()` call.

#### `useAgUiRun.test.ts`

```typescript
describe('useAgUiRun — AGENT_STATUS', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })
  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('AGENT_STATUS sets agentStatus in store', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: 'r1' })
      mockEs.emit({ type: 'AGENT_STATUS', message: 'Planning the structure…' })
    })

    expect(useAuthoringStore.getState().agentStatus).toBe('Planning the structure…')
  })

  it('AGENT_STATUS replaces previous status', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: 'r1' })
      mockEs.emit({ type: 'AGENT_STATUS', message: 'First thought' })
      mockEs.emit({ type: 'AGENT_STATUS', message: 'Second thought' })
    })

    expect(useAuthoringStore.getState().agentStatus).toBe('Second thought')
  })

  it('agentStatus resets to null on RUN_FINISHED', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: 'r1' })
      mockEs.emit({ type: 'AGENT_STATUS', message: 'Thinking…' })
      mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: '{"id":"x"}' })
      mockEs.emit({ type: 'RUN_FINISHED', resultType: 'story', content: '' })
    })

    expect(useAuthoringStore.getState().agentStatus).toBeNull()
  })

  it('agentStatus resets to null on ERROR', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: 'r1' })
      mockEs.emit({ type: 'AGENT_STATUS', message: 'Thinking…' })
      mockEs.emit({ type: 'ERROR', code: 'GENERATION_FAILED', message: 'oops' })
    })

    expect(useAuthoringStore.getState().agentStatus).toBeNull()
  })
})
```

#### `authoringStore.test.ts`

Add to the existing generate/reset describe block:

```typescript
it('generate() resets agentStatus to null', () => {
  const store = useAuthoringStore.getState()
  store.setInputText('Some text')
  store.setChapterTarget('Genki I Ch.3')
  // Manually set agentStatus to simulate a previous run
  store._setAgentStatus('Old hint')
  store.generate()
  expect(store.agentStatus).toBeNull()
})
```

#### `GenerationProgress.test.tsx` (or create if absent)

If `GenerationProgress` has an existing test, add:

```typescript
it('renders hint paragraph with "Thinking: " prefix when agentStatus is set', () => {
  useAuthoringStore.setState({
    phase: 'generating',
    agentRunStarted: true,
    agentStatus: 'Planning the structure…',
  })
  render(<GenerationProgress />)
  expect(screen.getByText('Generating story…')).toBeInTheDocument()
  expect(screen.getByText('Thinking: Planning the structure…')).toBeInTheDocument()
})

it('word-boundary-truncates long hint', () => {
  // 'word '.repeat(20) = 100 chars; should cut at last word boundary before 80
  useAuthoringStore.setState({
    phase: 'generating',
    agentRunStarted: true,
    agentStatus: 'word '.repeat(20).trim(),
  })
  render(<GenerationProgress />)
  const hint = screen.getByText(/^Thinking: /)
  // Must not exceed "Thinking: " (10) + 80 chars displayed + "…"
  expect(hint.textContent!.length).toBeLessThanOrEqual(10 + 80 + 1)
  expect(hint.textContent).toMatch(/…$/)
  // Must not cut mid-word — the char before "…" should not be in the middle of "word"
  expect(hint.textContent).toMatch(/\s…$|^Thinking: word(?: word)*…$/)
})

it('does not render hint paragraph when agentStatus is null', () => {
  useAuthoringStore.setState({
    phase: 'generating',
    agentRunStarted: true,
    agentStatus: null,
  })
  render(<GenerationProgress />)
  expect(screen.getByText('Generating story…')).toBeInTheDocument()
  expect(screen.queryByText(/^Thinking:/)).toBeNull()
})
```

---

### Critical Regressions to Verify

1. **All existing `test_agent.py` tests** that inject via `gemini_client=make_mock_client(...)`
   exercise Path B1 proposal (`_generate_proposal`) only OR must be migrated to
   `gemini_stream_client=`. Audit every test that calls `agent.generate(...)` with a
   `gemini_client` mock and confirm whether it exercises Path A/B2 or Path B1 — migrate
   Path A/B2 tests to the streaming seam.

2. **`agentRunStarted` deferred issue** (`deferred-work.md`): "`agentRunStarted` not reset in
   `_setError`/`_resolveCancel`". This story adds `agentStatus: null` to those same locations.
   Do not add `agentRunStarted: false` there as well — that is a separate deferred item and
   intentionally not in scope here.

3. **Perf logger** — the `_perf_logger.info(...)` call logs `elapsed_ms` and `response_chars`.
   After switching to streaming, `elapsed_ms` is still computed from `t0 = time.perf_counter()`
   (set before the stream loop) and `time.perf_counter() - t0` after the loop. `response_chars`
   uses `len(raw_json)`. Both are correct with the refactored code.

4. **`asyncio.TimeoutError` handling** — the existing `except asyncio.TimeoutError:` block
   that yields an `ERROR` event must remain. The wall-clock deadline raises this same exception
   type, so the handler fires correctly.

5. **`thinking_budget` and total latency** — with `THINKING_BUDGET = 16384`, Gemini 2.5 Flash
   is allowed up to ~2 minutes of pre-reasoning, with the remaining ~2 minutes of the 240s
   total timeout available for JSON output. The model will not always consume the full budget;
   monitor the perf logger for the first few live runs and adjust `THINKING_BUDGET` if
   elapsed_ms regularly approaches 220s+.

---

### Project Structure Notes

Files to modify:
- `apps/story-generator-backend/src/story_generator/agent.py` — streaming path + injection seam
- `apps/story-generator-backend/tests/test_agent.py` — new tests + migrate existing tests to stream seam
- `docs/adr/004-agui-event-types.md` — remove M2-only qualifier
- `apps/story-generator/src/stores/authoringStore.ts` — `agentStatus` field + action
- `apps/story-generator/src/hooks/useAgUiRun.ts` — `AGENT_STATUS` variant + handler
- `apps/story-generator/src/components/GenerationProgress.tsx` — hint rendering
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` — new AGENT_STATUS tests
- `apps/story-generator/src/__tests__/authoringStore.test.ts` — `agentStatus` reset test
- `apps/story-generator/src/__tests__/GenerationProgress.test.tsx` — hint render tests (create if absent)

Files to NOT modify:
- `main.py` — no changes; AGENT_STATUS events pass through the existing `yield` loop unchanged
- `useSession.ts` — `agentStatus` is transient, should not be persisted to localStorage
- `validateStoryJson.ts` — unaffected

### References

- [Source: apps/story-generator-backend/src/story_generator/agent.py — lines 208–240 (injection seam)]
- [Source: apps/story-generator-backend/src/story_generator/agent.py — lines 322–354 (blocking Gemini call to replace)]
- [Source: apps/story-generator-backend/src/story_generator/agent.py — lines 414–436 (TEXT_MESSAGE_CHUNK emit, unchanged)]
- [Source: apps/story-generator-backend/tests/test_agent.py — lines 30–35 (make_mock_client pattern to extend)]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — lines 6–12 (AgUiEvent union)]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — lines 44–49 (store destructure)]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — lines 122–168 (onmessage switch)]
- [Source: apps/story-generator/src/stores/authoringStore.ts — lines 47–100 (AuthoringStore interface)]
- [Source: apps/story-generator/src/components/GenerationProgress.tsx — lines 70–77 (statusLabel logic)]
- [Source: docs/adr/004-agui-event-types.md — lines 95–109 (AGENT_STATUS definition)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — "Dangling threads on asyncio.TimeoutError" (this story resolves it)]
- [Source: sprint-status-story-generator.yaml — epic-4 story 4-2 (m2-progress-ui-agent-status-message-line) — this story partially implements that backlog item for M1]

### Review Findings

- [x] [Review][Patch] Cancel signal never checked inside streaming loop — both `generate()` Path A/B2 and `_generate_proposal()` Path B1 check `cancel_event.is_set()` only before and after the `async for` loop. With thinking taking up to 2 minutes, pressing Stop is ignored until the stream is exhausted. Fix: add `if cancel_event and cancel_event.is_set(): break` at the top of each loop body, after the deadline check. [agent.py — both streaming loops]
- [x] [Review][Patch] `await stream(...)` not guarded by timeout — `deadline` is computed before the call but `chunks = await stream(GEMINI_MODEL, prompt, config)` can hang indefinitely if the SDK fails to establish the connection, because the deadline is only checked inside the subsequent `async for`. Fix: `chunks = await asyncio.wait_for(stream(GEMINI_MODEL, prompt, config), timeout=max(deadline - time.monotonic(), 0))`. [agent.py — both streaming loops, before `async for`]
- [x] [Review][Patch] Missing `useAgUiRun` test: `RUN_CANCELLED` event clears `agentStatus` — AC5 requires hook-level coverage of the cancel path. Add a test that emits `AGENT_STATUS` (advance timer 500ms), then `RUN_CANCELLED`, and asserts `agentStatus` is null. [useAgUiRun.test.ts]
- [x] [Review][Patch] Missing backend test: `AGENT_STATUS` precedes `TEXT_MESSAGE_CHUNK` in Path B1 — `test_path_b_phase1_agent_status_from_thoughts` confirms message content but not ordering. Add `assert types.index("AGENT_STATUS") < types.index("TEXT_MESSAGE_CHUNK")` to that test. [test_agent.py:test_path_b_phase1_agent_status_from_thoughts]
- [x] [Review][Defer] Thought text forwarded verbatim to client with no sanitisation — React escapes HTML so XSS is not a concern; Unicode bidirectional control characters are a cosmetic edge case not worth addressing in v1. [agent.py — both streaming loops]
- [x] [Review][Defer] Hint disappears during cancelling phase — the `phase === 'generating'` guard is intentional per spec; the hint disappearing on Stop is acceptable v1 UX. [GenerationProgress.tsx:122]
- [x] [Review][Defer] API key rotation staleness in `_get_stream_caller` — pre-existing identical pattern in `_get_caller`; both cache the client on first use. Not introduced by this story. [agent.py:_get_stream_caller]
- [x] [Review][Defer] `AGENT_STATUS` yielded inside `try` — if the ASGI layer disconnects mid-stream, the `yield` raises and is caught by `except Exception`, emitting an ERROR event the client never receives. Pre-existing pattern for all `yield` statements in this function; no regression. [agent.py]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 31/31 backend tests pass; 278/278 frontend tests pass; TypeScript clean.
- `agent.py`: added `THINKING_BUDGET = 16384`, `gemini_stream_client` injection seam, `_get_stream_caller()`. Replaced blocking `asyncio.to_thread` call in Path A/B2 with async streaming loop (wall-clock deadline). Replaced blocking call in `_generate_proposal` (Path B1) with same loop. Both branches yield `AGENT_STATUS` for thought parts, accumulate non-thought parts. `include_thoughts=True` added to `ThinkingConfig`.
- `test_agent.py`: fully migrated all generation-path tests from `gemini_client=` to `gemini_stream_client=` seam. Added 10 new tests: AGENT_STATUS emission, thought filtering, None candidates guard, timeout, Path B1 thinking, and stream mock patterns.
- `authoringStore.ts`: added `agentStatus: string | null` field and `_setAgentStatus` action. Reset to `null` in `generate()`, `approve()`, `rerun()`, `_setOutputJson()`, `_setProposalText()`, `_setError()`, `_resolveCancel()`.
- `useAgUiRun.ts`: added `AGENT_STATUS` variant to `AgUiEvent` union. Added `agentStatusTimerRef` with 500ms debounce. Added to `clearTimers()`. Dispatches `_setAgentStatus` after debounce.
- `GenerationProgress.tsx`: added `truncateHint()` (word-boundary, max=80). Reads `agentStatus` from store. Renders `<p className="text-xs text-muted truncate">Thinking: {truncated}</p>` below the status row when generating + agentRunStarted + agentStatus non-null.
- `docs/adr/004-agui-event-types.md`: removed "M2 only" qualifier, updated AGENT_STATUS description and mapping table.
- Key design note: stream mocks must be `async def` functions returning an async generator (not async generator functions themselves), because `agent.py` does `chunks = await stream(...)`.

### File List

- `apps/story-generator-backend/src/story_generator/agent.py`
- `apps/story-generator-backend/tests/test_agent.py`
- `docs/adr/004-agui-event-types.md`
- `apps/story-generator/src/stores/authoringStore.ts`
- `apps/story-generator/src/hooks/useAgUiRun.ts`
- `apps/story-generator/src/components/GenerationProgress.tsx`
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts`
- `apps/story-generator/src/__tests__/authoringStore.test.ts`
- `apps/story-generator/src/__tests__/GenerationProgress.test.tsx`
- `_bmad-output/implementation-artifacts/supp-1-gemini-thinking-live-status.md`
