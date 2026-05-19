# Story 3.4: Story Length Settings & Path B Session Restore

Status: done

## Story

As a content author,
I want to set a target story length when generating from a topic and have my Path B session restore correctly when I reopen the tool,
so that I can control the scope of generated stories and pick up where I left off.

## Acceptance Criteria

**AC1 — Story length numeric input enabled for all presets in Path B:**
Given the user is in "Generate from topic" mode and the SettingsPanel is open,
when any preset (Short/Medium/Long) is selected,
then the numeric word-count input is enabled and shows the preset's word count; typing a new value in the numeric input (max 1000) implicitly selects Custom and updates `targetWordCount`; the three preset buttons and numeric input remain interactive while `pathMode === 'B'`.

**AC2 — Story length controls dimmed in Path A:**
Given the user is in "Convert a story" mode,
when the SettingsPanel is open,
then story length controls are dimmed (38% opacity) and non-interactive; the hint "Available in Generate from topic mode" is shown; no `target_word_count` is sent to the backend.

**AC3 — `target_word_count` wired into Path B phase 1 SSE request:**
Given the user is in Path B mode with a `targetWordCount > 0` in the store,
when `useAgUiRun` constructs the SSE URL for phase 1 (topic present, no englishDraft),
then `target_word_count` is included as a query param; the backend's `/run_sse` endpoint accepts and forwards `target_word_count` to the agent; `build_proposal_prompt()` uses it to set the target length in the prompt (e.g. "Write a story of approximately N words"); when `targetWordCount === 0` or Path A, the param is omitted and the prompt uses the default length hint.

**AC4 — Path B proposal session restores to `proposal` phase:**
Given a Path B session is in `proposal` state (English draft present in `proposalText`) when the tab is closed,
when the user reopens the tool,
then `useSession` restores `phase → 'proposal'`, `proposalText` is in the store (textarea shows the draft), "Convert to Japanese" is active and the topic and chapter are also restored; `hasContent` includes `proposalText !== null`; the session restore banner appears.

**AC5 — Stale generating phase in Path B restores to idle with inputs:**
Given a Path B session is in a `generating` phase when the tab is closed,
when the user reopens the tool,
then the stale `generating` phase is treated as crashed and restored to `idle` (no `outputJson`); topic and chapter are pre-filled; no stuck spinner; this is the existing behaviour (no change needed, but must be verified via test).

**AC6 — Tests pass:**
Given all changes are implemented,
when `pnpm test:unit`, `pnpm typecheck`, and `make test` (backend) run,
then: `useSession.test.ts` covers AC4 and AC5; `useAgUiRun.test.ts` covers `target_word_count` in URL (AC3); backend `test_agent.py` covers `build_proposal_prompt` with `target_word_count`; no regressions; `pnpm typecheck` clean.

## Tasks / Subtasks

- [x] AC1: Fix `SettingsPanel.tsx` — numeric input enabled for all presets in Path B
  - [x] Change `disabled={!lengthEnabled || storyLengthPreset !== 'custom'}` → `disabled={!lengthEnabled}` on the word-count `<input>`
  - [x] Verify typing still calls `setTargetWordCount` (which internally switches preset to 'custom')
- [x] AC3 (frontend): Update `useAgUiRun.ts` — wire `target_word_count` into SSE URL
  - [x] Extract `targetWordCount = storedInputs?.targetWordCount ?? 0` from storedInputs
  - [x] When `pathMode === 'B'` and `targetWordCount > 0`: `params.set('target_word_count', String(targetWordCount))`
- [x] AC3 (backend): Update `main.py` — accept `target_word_count` query param
  - [x] Add `target_word_count: int = Query(0, alias="target_word_count")` to `/run_sse`
  - [x] Pass `target_word_count` to `agent.generate()`
- [x] AC3 (backend): Update `agent.py` — use `target_word_count` in proposal prompt
  - [x] Add `target_word_count: int = 0` to `generate()` signature
  - [x] Pass `target_word_count` through to `_generate_proposal()`
  - [x] Add `target_word_count: int = 0` to `_generate_proposal()` signature
  - [x] Pass `target_word_count` to `build_proposal_prompt()`
  - [x] Add `target_word_count: int = 0` to `build_proposal_prompt()` signature
  - [x] Use it in the prompt: when non-zero, replace `~150-300 words` with `approximately {target_word_count} words`
- [x] AC4: Update `useSession.ts` — full Path B proposal session restore
  - [x] Add `proposalText: string | null` to `SessionState` interface
  - [x] Remove `'proposal'` from `STALE_PHASES`
  - [x] In mount hydration: restore `proposalText` with null-safe fallback; if `phase === 'proposal'` but `proposalText` is null/empty → remap to idle
  - [x] Add `proposalText` to the `useAuthoringStore.setState()` hydration call
  - [x] Update `hasContent` check: include `proposalText !== null`
  - [x] Update write function: include `proposalText: state.proposalText`
- [x] AC6: Write/update tests
  - [x] `useSession.test.ts` — proposal phase restore, proposal phase with null proposalText falls back to idle
  - [x] `useAgUiRun.test.ts` — target_word_count included in URL when non-zero in Path B
  - [x] `test_agent.py` (backend) — `build_proposal_prompt` with `target_word_count` includes word count in prompt
  - [x] Run `pnpm test:unit`, `pnpm typecheck`, `make test` — all pass

## Dev Notes

### Current State (what already exists)

**Story length UI (SettingsPanel.tsx) — ALREADY DONE** in hotfix eb1c8a9:
- Short (300w) / Medium (600w) / Long (1000w) / Custom presets: ✓
- Preset buttons switch preset + populate targetWordCount: ✓
- Custom numeric input (max 1000): ✓
- Dimmed + hint when pathMode = 'A': ✓

The ONE fix needed (AC1): make the numeric input enabled for all presets (not just 'custom') so the user can type directly to switch to Custom mode.

**`targetWordCount` in storedInputs — ALREADY DONE** in Story 3.2:
```typescript
// authoringStore.ts: generate() snapshot already includes:
storedInputs: {
  ...
  targetWordCount, // Path B: snapshot at generate() time
}
```
The `useAgUiRun.ts` comment says `// target_word_count deferred to Story 3.4 when backend also accepts it`. This story wires it up.

**proposalText in session — DEFERRED in Story 3.3**: `useSession.ts` currently has `'proposal'` in `STALE_PHASES`. This story removes it and adds `proposalText` to `SessionState`.

---

### Task 1: `SettingsPanel.tsx` — one-line fix

Current (line ~163):
```tsx
disabled={!lengthEnabled || storyLengthPreset !== 'custom'}
```

Change to:
```tsx
disabled={!lengthEnabled}
```

Why: `setTargetWordCount(v)` internally calls `set({ storyLengthPreset: 'custom', targetWordCount: ... })`, so typing directly in the input auto-selects Custom. The preset constraint on the input was overly restrictive.

The `onChange` handler is already correct:
```tsx
onChange={e => {
  const v = parseInt(e.target.value, 10)
  if (!isNaN(v) && v > 0) setTargetWordCount(v)
}}
```

---

### Task 2: `useAgUiRun.ts` — add target_word_count to URL

In the Path B params block (after existing topic/englishDraft lines):
```typescript
const targetWordCount = storedInputs?.targetWordCount ?? 0

// In the Path B params block:
if (pathMode === 'B') {
  if (topicText)    params.set('topic', topicText)
  if (englishDraft) params.set('englishDraft', englishDraft)
  if (targetWordCount > 0) params.set('target_word_count', String(targetWordCount))
}
```

`targetWordCount` is extracted alongside `topicText` and `englishDraft` from `storedInputs` at the top of the effect.

---

### Task 3: Backend `main.py` — accept target_word_count

Add one parameter to the `/run_sse` handler:
```python
target_word_count: int = Query(0, alias="target_word_count"),
```

Pass it through:
```python
async for event in agent.generate(
    ...existing params...,
    target_word_count=target_word_count,
):
```

---

### Task 4: Backend `agent.py` — propagate to prompt

**`build_proposal_prompt()` signature update:**
```python
def build_proposal_prompt(
    chapter: int,
    topic: str,
    steering_instructions: str = "",
    target_word_count: int = 0,
) -> str:
```

**Prompt length hint logic:**
```python
length_hint = f"approximately {target_word_count} words" if target_word_count > 0 else "~150–300 words"
```

Replace the hardcoded `~150-300 words` in the prompt with `{length_hint}`.

**`_generate_proposal()` signature update:**
```python
async def _generate_proposal(
    self,
    *,
    run_id: str,
    chapter: str,
    topic: str,
    steering_instructions: str,
    temperature: float,
    cancel_event: asyncio.Event | None,
    target_word_count: int = 0,
) -> AsyncGenerator[dict, None]:
```

Pass `target_word_count=target_word_count` when calling `build_proposal_prompt()`.

**`generate()` method signature update:**
```python
async def generate(
    self,
    *,
    run_id: str,
    input_text: str = "",
    chapter: str,
    path_mode: str = "A",
    topic: str = "",
    english_draft: str = "",
    steering_instructions: str = "",
    temperature: float = 1.0,
    grammar_distribution: int = 1,
    cancel_event: asyncio.Event | None = None,
    target_word_count: int = 0,
) -> AsyncGenerator[dict, None]:
```

Pass `target_word_count=target_word_count` when calling `_generate_proposal()`.

---

### Task 5: `useSession.ts` — proposal restore

**Add to `SessionState` interface:**
```typescript
interface SessionState {
  version: 1
  // ...existing fields...
  proposalText: string | null   // Path B: English draft in proposal phase
}
```

**Remove 'proposal' from STALE_PHASES** (also remove the comment about Story 3.4):
```typescript
const STALE_PHASES = new Set<Phase>(['generating', 'cancelling', 'downloading'])
```

**Update `mapRestoredPhase`** to handle the null proposalText guard:
The existing `mapRestoredPhase` function maps stale phases to idle/output-clean. With 'proposal' removed from STALE_PHASES, proposal sessions will restore as-is. But we need to guard against restoring to 'proposal' when `proposalText` is null (e.g. old sessions without the field).

Add a guard in the mount hydration (NOT in `mapRestoredPhase`, since mapRestoredPhase doesn't have access to the full session):

```typescript
// In the mount effect, after mapRestoredPhase:
const restoredPhase = mapRestoredPhase(session)

// Guard: proposal phase requires proposalText — else degrade to idle
const safePhase: Phase =
  restoredPhase === 'proposal' && !session.proposalText
    ? session.outputJson !== null ? 'output-clean' : 'idle'
    : restoredPhase
```

Then use `safePhase` in `useAuthoringStore.setState()`.

**Add `proposalText` to hydration setState:**
```typescript
useAuthoringStore.setState({
  phase: safePhase,
  // ...existing fields...
  proposalText: session.proposalText ?? null,
})
```

**Update `hasContent` check:**
```typescript
const hasContent =
  session.outputJson !== null ||
  session.inputText !== '' ||
  topicText !== '' ||
  session.chapterTarget !== '' ||
  session.steeringInstructions !== '' ||
  session.proposalText !== null   // include proposal draft
```

**Update write function:**
```typescript
const sessionState: SessionState = {
  version: 1,
  // ...existing fields...
  proposalText: state.proposalText,
}
```

---

### Test Guidance: `useSession.test.ts`

The `writeSession` helper should add `proposalText: null` to the base defaults (null is safe for existing tests). Add new tests:

```typescript
it('restores proposal phase when proposalText is present', () => {
  writeSession({ phase: 'proposal', proposalText: 'My English draft.', outputJson: null })
  renderHook(() => useSession())
  const st = useAuthoringStore.getState()
  expect(st.phase).toBe('proposal')
  expect(st.proposalText).toBe('My English draft.')
})

it('maps proposal phase to idle when proposalText is null', () => {
  writeSession({ phase: 'proposal', proposalText: null, outputJson: null })
  renderHook(() => useSession())
  expect(useAuthoringStore.getState().phase).toBe('idle')
})

it('maps proposal phase to output-clean when proposalText is null but outputJson present', () => {
  writeSession({ phase: 'proposal', proposalText: null, outputJson: '{"id":"x"}' })
  renderHook(() => useSession())
  expect(useAuthoringStore.getState().phase).toBe('output-clean')
})

it('proposalText triggers hasContent banner', () => {
  writeSession({ phase: 'proposal', proposalText: 'Draft.', inputText: '' })
  renderHook(() => useSession())
  expect(useAuthoringStore.getState().sessionRestored).toBe(true)
})

it('persists proposalText to session on phase change', () => {
  renderHook(() => useSession())
  act(() => { useAuthoringStore.getState()._setProposalText('My proposal.') })
  const raw = localStorage.getItem(SESSION_KEY)
  const parsed = JSON.parse(raw!)
  expect(parsed.proposalText).toBe('My proposal.')
})
```

Also update existing stale proposal tests — the two tests added in Story 3.3 (`maps stale proposal phase + outputJson → output-clean` and `maps stale proposal phase + no outputJson → idle`) are now WRONG since 'proposal' is removed from STALE_PHASES. Delete or replace those two tests with the new tests above that correctly cover the proposalText-null guard.

### Test Guidance: `useAgUiRun.test.ts`

Add to the Path B URL params describe block:

```typescript
it('includes target_word_count in URL when non-zero in Path B', () => {
  const { factory } = setupPathBGenerating('My topic.', 'Genki I Ch.5', 300)
  renderHook(() => useAgUiRun(factory))
  const url = factory.mock.calls[0][0] as string
  const params = new URLSearchParams(url.split('?')[1])
  expect(params.get('target_word_count')).toBe('300')
})

it('omits target_word_count from URL when zero', () => {
  const { factory } = setupPathBGenerating('My topic.', 'Genki I Ch.5', 0)
  renderHook(() => useAgUiRun(factory))
  const url = factory.mock.calls[0][0] as string
  expect(url).not.toContain('target_word_count')
})
```

You'll need a `setupPathBGenerating` helper that calls `store.setTargetWordCount(N)` before `generate()`. Adapt from the existing `setupGenerating` helper.

### Test Guidance: `test_agent.py` (backend)

```python
def test_build_proposal_prompt_with_target_word_count(vocab_data, grammar_data):
    """build_proposal_prompt includes target word count when non-zero."""
    from story_generator.agent import build_proposal_prompt
    prompt = build_proposal_prompt(5, "Ken goes to the library.", target_word_count=400)
    assert "400" in prompt
    assert "words" in prompt.lower()

def test_build_proposal_prompt_default_length_hint(vocab_data, grammar_data):
    """build_proposal_prompt uses default length when target_word_count=0."""
    from story_generator.agent import build_proposal_prompt
    prompt = build_proposal_prompt(5, "Ken goes to the library.", target_word_count=0)
    # Should contain the default hint, not a numeric count
    assert "150" in prompt or "300" in prompt
```

Also add a test verifying `target_word_count` flows through the generate() → _generate_proposal() → build_proposal_prompt chain:

```python
def test_path_b_phase1_passes_target_word_count(vocab_data, grammar_data):
    """target_word_count from generate() reaches build_proposal_prompt."""
    captured_contents = []
    def mock_client(model, contents, config):
        captured_contents.append(contents)
        return SimpleNamespace(text="A story.")
    
    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=mock_client)
    events = list(asyncio.run(async_collect(agent.generate(
        run_id="r1",
        chapter="Genki I Ch.5",
        path_mode="B",
        topic="Ken at the park",
        target_word_count=200,
        cancel_event=None,
    ))))
    # The prompt passed to Gemini should mention 200 words
    assert len(captured_contents) == 1
    assert "200" in captured_contents[0]
```

### Critical Regression: Updated STALE_PHASES tests

Story 3.3 added two tests that will now FAIL because 'proposal' is removed from STALE_PHASES:
- `'maps stale proposal phase + outputJson → output-clean'`
- `'maps stale proposal phase + no outputJson → idle'`

These must be REMOVED and replaced with:
- The new proposalText-null guard tests above (maps proposal + null proposalText to idle/output-clean)
- New test: proposal phase with valid proposalText restores as proposal

### Existing test for `approve()` after error-restored proposal

In `authoringStore.test.ts`, the test `'approve() after error-restored proposal clears errorCode and retries'` verifies that `storedInputs.englishDraft` is `'My draft.'`. After this story's changes, `storedInputs.englishDraft` is read from `proposalText` at `approve()` time, so this should still pass unchanged.

### Backend test: `async_collect` helper pattern

Looking at the existing `test_agent.py`, generators are collected via:
```python
events = []
async for event in agent.generate(...):
    events.append(event)
```

Run with `asyncio.run()` or the existing pytest-asyncio fixture if present. Check how existing async tests are structured in the test file.

### References

- [Source: epics-story-authoring-tool.md — Story 3.4 acceptance criteria]
- [Source: apps/story-generator/src/hooks/useSession.ts — current SessionState, STALE_PHASES, hydration logic]
- [Source: apps/story-generator/src/hooks/useAgUiRun.ts — Path B params block (lines 74–77)]
- [Source: apps/story-generator/src/components/SettingsPanel.tsx — numeric input disabled condition (line ~163)]
- [Source: apps/story-generator/src/stores/authoringStore.ts — StoredInputs.targetWordCount already present]
- [Source: apps/story-generator-backend/src/story_generator/main.py — /run_sse params (no target_word_count yet)]
- [Source: apps/story-generator-backend/src/story_generator/agent.py — build_proposal_prompt, _generate_proposal, generate signatures]
- [Source: apps/story-generator/src/__tests__/useSession.test.ts — writeSession helper, STALE_PHASES tests to update]
- [Source: apps/story-generator/src/__tests__/useAgUiRun.test.ts — Path B URL tests at line 480+]

### Review Findings

- [x] [Review][Defer] D1: No upper-bound enforcement on `target_word_count` in backend — frontend enforces max 1000 but a direct API call could pass any integer; acceptable for v1 local-only tool [main.py]
- [x] [Review][Defer] D2: `target_word_count` included in Path B phase 2 (approve flow) URL param even though backend ignores it — harmless but a clarifying comment would help [useAgUiRun.ts:75]
- [x] [Review][Defer] D3: Default length hint uses en-dash (–) not hyphen-minus (-) — cosmetic inconsistency with other prompt strings [agent.py:160]
- [x] [Review][Defer] D4: `isClearedState` check in useSession.ts does not include `topicText` — pre-existing issue not introduced by this story [useSession.ts:123]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 259/259 frontend tests pass; 25/25 backend tests pass. TypeScript clean.
- `SettingsPanel.tsx`: removed `storyLengthPreset !== 'custom'` from numeric input disabled condition — typing directly now auto-selects Custom via `setTargetWordCount`.
- `useAgUiRun.ts`: extracted `targetWordCount` from `storedInputs` and adds `target_word_count` param to Path B SSE URL when `> 0`.
- `main.py`: added `target_word_count: int = Query(0, ...)` param and passes to `agent.generate()`.
- `agent.py`: added `target_word_count: int = 0` to `generate()`, `_generate_proposal()`, and `build_proposal_prompt()`; prompt uses `approximately N words` when non-zero, default `~150–300 words` when zero.
- `useSession.ts`: added `proposalText: string | null` to `SessionState`; removed 'proposal' from `STALE_PHASES`; hydration uses `safePhase` guard (null proposalText → idle/output-clean); restores `proposalText` to store; `hasContent` includes proposalText check; write function persists `proposalText`.
- Deleted the two now-wrong Story 3.3 stale-proposal tests; replaced with 5 new proposal-restore tests covering: valid restore, null→idle, null+outputJson→output-clean, banner trigger, topicText+chapter alongside proposalText.
- Added 3 new backend tests: `build_proposal_prompt` with count, without count, and end-to-end flow through `generate()`.

### File List

- `apps/story-generator/src/components/SettingsPanel.tsx`
- `apps/story-generator/src/hooks/useAgUiRun.ts`
- `apps/story-generator/src/hooks/useSession.ts`
- `apps/story-generator/src/__tests__/useSession.test.ts`
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts`
- `apps/story-generator-backend/src/story_generator/main.py`
- `apps/story-generator-backend/src/story_generator/agent.py`
- `apps/story-generator-backend/tests/test_agent.py`
- `_bmad-output/implementation-artifacts/3-4-story-length-settings-and-path-b-session-restore.md`
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml`
