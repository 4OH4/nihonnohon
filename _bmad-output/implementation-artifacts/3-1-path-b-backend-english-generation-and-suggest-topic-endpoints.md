# Story 3.1: Path B Backend — English Generation & Suggest-Topic Endpoints

Status: done

## Story

As a developer,
I want the backend extended with a Path B generation flow and a lightweight suggest-topic endpoint,
So that the frontend can trigger English story generation and topic suggestions without changing the existing M1 pipeline contract.

## Acceptance Criteria

**AC1 — Two-phase SSE contract:**
Given Path B uses two separate SSE lifecycle phases,
when the frontend is in "Generate from topic" mode,
then Path B requires **two separate `GET /run_sse` requests** — each is a complete SSE lifecycle (RUN_STARTED → RUN_FINISHED | ERROR); the frontend opens a fresh SSE connection for each phase; the two requests are not multiplexed on a single stream.

**AC2 — Path B phase 1: English proposal generation:**
Given the first `GET /run_sse` request with `pathMode=B`, `topic`, and `chapter` params,
when the backend processes it,
then the agent generates an English story proposal using a single Gemini call; `RUN_FINISHED` is emitted with `resultType: 'proposal'` and `content` set to the English story text (plain prose, not JSON); the SSE stream closes after this `RUN_FINISHED`.

**AC3 — Path B phase 2: Japanese conversion:**
Given the second `GET /run_sse` request with `pathMode=B`, `englishDraft`, and `chapter` params,
when the backend processes it,
then the M1 single-call pipeline converts the English draft to a Japanese story (identical to Path A but using `englishDraft` as the source text); `RUN_FINISHED` is emitted with `resultType: 'story'`; output passes all structural checks; schema contract identical to Path A.

**AC4 — `POST /suggest-topic` endpoint:**
Given `POST /suggest-topic` is called with `{ "chapter": "Genki I Ch.5" }`,
when the backend handles it,
then it returns `{ "topic": "<single-sentence topic string>" }` calibrated to that chapter within 10 seconds (NFR14); a 2-second per-session cooldown is enforced server-side; the endpoint is separate from the generation pipeline and does not emit AG-UI events.

**AC5 — Backend tests pass without GEMINI_API_KEY:**
Given `test_agent.py` Path B tests,
when `make test` is run without `GEMINI_API_KEY`,
then mock verifies:
- Path B phase 1 emits `RUN_STARTED` → `RUN_FINISHED` with `resultType: 'proposal'` and plain-text `content`
- Path B phase 2 emits `RUN_STARTED` → `RUN_FINISHED` with `resultType: 'story'` and schema-valid JSON
- suggest-topic returns a plausible string
- all existing Path A tests continue to pass
- `make test` exit code 0

## Tasks / Subtasks

- [x] AC2: Implement Path B phase 1 (English proposal) in `agent.py`
  - [x] Add `build_proposal_prompt(chapter, topic, steering)` function — single Gemini call, returns plain English story prose
  - [x] Branch `generate()` on `path_mode == 'B'` and presence of `topic` vs `english_draft` to route to phase 1 or 2
  - [x] Phase 1 emits `RUN_FINISHED` with `resultType: 'proposal'` and plain-text `content`
- [x] AC3: Implement Path B phase 2 (Japanese conversion) in `agent.py`
  - [x] Phase 2 reuses existing `build_system_prompt()` with `english_draft` as the source text — no new prompt function needed
  - [x] Phase 2 follows the full M1 path: validate → emit `RUN_FINISHED` with `resultType: 'story'`
- [x] AC1+AC3: Update `main.py` `/run_sse` endpoint to accept new query params
  - [x] Add `topic: str = Query("", alias="topic")` and `english_draft: str = Query("", alias="englishDraft")`
  - [x] Pass both to `agent.generate()`
- [x] AC4: Implement `POST /suggest-topic` in `main.py`
  - [x] Add `SuggestTopicRequest` Pydantic model `{ chapter: str }`
  - [x] Add `_suggest_topic_cooldowns: dict[str, float]` module-level dict for per-session cooldown tracking
  - [x] Enforce 2s cooldown via `time.monotonic()`; return 429 on violation
  - [x] Inject Gemini call (same pattern as agent — injectable for tests)
  - [x] Return `{ "topic": "<string>" }` within 10s timeout
- [x] AC5: Write `test_agent.py` Path B tests
  - [x] `test_path_b_phase1_emits_proposal()` — mock client returns plain text; verify `RUN_FINISHED` with `resultType: 'proposal'`
  - [x] `test_path_b_phase2_emits_story()` — mock client returns valid JSON fixture; verify `RUN_FINISHED` with `resultType: 'story'` and validation called
  - [x] `test_path_b_phase2_validation_failure_emits_error()` — confirm validation gate applies to phase 2
  - [x] Add `test_suggest_topic` (see suggest-topic test guidance in Dev Notes)

## Dev Notes

### Architecture Overview

This story extends the existing M1 backend (`agent.py`, `main.py`) to support two additional flows:

1. **Path B phase 1** — topic → English proposal (new `build_proposal_prompt` + new `generate()` branch)
2. **Path B phase 2** — English draft → Japanese story (reuses existing M1 path; `english_draft` replaces `input_text`)
3. **Suggest-topic** — new `POST /suggest-topic` endpoint with per-session cooldown

The M1 Path A pipeline is **untouched**. All changes are additive.

### `agent.py` Changes

#### Routing logic in `generate()`

The method signature already accepts `path_mode: str = "A"`. Add two new keyword-only params:

```python
async def generate(
    self,
    *,
    run_id: str,
    input_text: str = "",       # Path A source story; Path B phase 2 english_draft
    chapter: str,
    path_mode: str = "A",
    topic: str = "",             # NEW — Path B phase 1 topic description
    english_draft: str = "",     # NEW — Path B phase 2 English draft from proposal
    steering_instructions: str = "",
    temperature: float = 1.0,
    grammar_distribution: int = 1,
    cancel_event: asyncio.Event | None = None,
) -> AsyncGenerator[dict, None]:
```

Route inside `generate()`:
- `path_mode == "A"` → M1 path (use `input_text` as source; unchanged)
- `path_mode == "B"` and `topic` is non-empty → Phase 1 (English proposal)
- `path_mode == "B"` and `english_draft` is non-empty → Phase 2 (Japanese conversion using `english_draft` as source)

Phase 2 reuses `build_system_prompt(...)` with `english_draft` as the `english_source` parameter — **no code duplication**.

#### `build_proposal_prompt()`

New function. Single Gemini call that generates a short English story prose (NOT JSON) from a topic:

```python
def build_proposal_prompt(
    chapter: int,
    topic: str,
    steering_instructions: str = "",
) -> str:
    """Build prompt for English story proposal from topic (Path B phase 1)."""
```

Prompt instructions:
- Generate a short English story (~150-300 words) suitable for translation to Japanese at Genki I Ch.{chapter}
- Topic: {topic}
- Story should use vocabulary and concepts that map to the Genki chapter's curriculum
- Output: Plain English prose only — no JSON, no markdown, no code fences
- Include optional steering if provided

Phase 1 does NOT validate the output as JSON. It emits `RUN_FINISHED` with the raw text as `content`.

#### Phase 1 event sequence

```
RUN_STARTED → TEXT_MESSAGE_CHUNK* → RUN_FINISHED(resultType='proposal', content=<english text>)
```

Note: `TEXT_MESSAGE_CHUNK` is optional — proposal may be returned as a single block. If Gemini returns streaming chunks, accumulate and emit as one `TEXT_MESSAGE_CHUNK` then `RUN_FINISHED` (consistent with M1 pattern). **Do not validate proposal text as JSON.**

### `main.py` Changes

#### `/run_sse` endpoint — new query params

Add alongside existing params:
```python
topic: str = Query("", alias="topic"),
english_draft: str = Query("", alias="englishDraft"),
```

Pass to `agent.generate(topic=topic, english_draft=english_draft)`.

#### `POST /suggest-topic` endpoint

```python
class SuggestTopicRequest(BaseModel):
    chapter: str

@app.post("/suggest-topic")
async def suggest_topic(request: SuggestTopicRequest) -> dict:
    ...
```

**Cooldown tracking:** Use `_suggest_topic_cooldowns: dict[str, float] = {}` at module level (keyed by chapter string for simplicity in v1 — not per-authenticated-user since there is no auth). Return HTTP 429 with `{ "error": "cooldown" }` if last call for that chapter was within 2 seconds.

**Injection seam for tests:** Accept an optional `gemini_client` override via a module-level setter or constructor parameter on a `SuggestTopicAgent` helper class. For v1, a simple approach: the endpoint calls a `_suggest_topic_impl(chapter, gemini_client=None)` helper that follows the same injectable pattern as `StoryGeneratorAgent`.

**Timeout:** `asyncio.wait_for(..., timeout=9.0)` — leave 1s margin before NFR14's 10s limit.

**Response:** `{ "topic": "<single sentence>" }` — the Gemini prompt instructs: "Return only a single sentence describing a story topic suitable for Genki I Chapter N learners. No punctuation at the end."

### CORS

The existing CORS middleware already covers `POST` requests via `allow_methods=["GET", "POST", "OPTIONS"]`. `/suggest-topic` is covered automatically.

### Testing Pattern

For `POST /suggest-topic`, the endpoint needs its own mock injection. Simplest approach that doesn't break existing patterns: extract a `_generate_topic_suggestion(chapter: str, gemini_client=None) -> str` module-level function. Tests call it directly with a mock client:

```python
def test_suggest_topic_returns_string(vocab_data, grammar_data):
    from story_generator.main import _generate_topic_suggestion
    result = _generate_topic_suggestion(
        "Genki I Ch.5",
        gemini_client=lambda model, contents, config: SimpleNamespace(text="Ken goes to the library.")
    )
    assert isinstance(result, str)
    assert len(result) > 0
```

For Path B tests in `test_agent.py`:
- Phase 1 mock client returns a plain text string (not JSON)
- Phase 2 mock client returns the same `fixture_json` used by existing tests
- Assert `resultType` in the `RUN_FINISHED` event

### Current `generate()` Signature (to update, not replace)

Current in `agent.py:201`:
```python
async def generate(
    self,
    *,
    run_id: str,
    input_text: str,
    chapter: str,
    path_mode: str = "A",
    steering_instructions: str = "",
    temperature: float = 1.0,
    grammar_distribution: int = 1,
    cancel_event: asyncio.Event | None = None,
) -> AsyncGenerator[dict, None]:
```

Add `topic: str = ""` and `english_draft: str = ""` as keyword-only params. Make `input_text` default to `""` so existing callers still work.

### Event Contract (ADR-004 compliant)

`RUN_FINISHED` with `resultType: 'proposal'` is already defined in ADR-004:
```json
{ "type": "RUN_FINISHED", "resultType": "proposal", "content": "<English story proposal text>" }
```
No ADR updates required.

### Deferred Items

The deferred item from Story 2.2 ("path_mode accepted but unused") is resolved by this story.

The cooldown `_suggest_topic_cooldowns` dict is per-worker (consistent with `_active_runs` — same limitation noted in deferred-work.md). Acceptable for v1 single-user.

### Existing Tests Must Still Pass

Run `make test` after implementation. Existing tests in `test_agent.py` use `generate(input_text="...", chapter="...", run_id="...")`. The signature change (making `input_text` default to `""`) must not break these.

### References

- [Source: _bmad-output/planning-artifacts/epics-story-authoring-tool.md — Story 3.1]
- [Source: _bmad-output/story-generator-context.md — AG-UI Event Payloads, Backend section]
- [Source: docs/adr/004-agui-event-types.md — RUN_FINISHED resultType: 'proposal']
- [Source: apps/story-generator-backend/src/story_generator/agent.py — existing generate() implementation]
- [Source: apps/story-generator-backend/src/story_generator/main.py — existing /run_sse endpoint]
- [Source: apps/story-generator-backend/tests/test_agent.py — existing test patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Review Findings

- [x] [Review][Patch] P1: Empty source text silently accepted — Path A or Path B phase 2 with empty `input_text`/`english_draft` calls Gemini with a blank source [agent.py]
- [x] [Review][Patch] P2: Missing pre-call cancel check in `_generate_proposal` — cancel only checked post-Gemini-call, unlike parent `generate()` [agent.py:_generate_proposal]
- [x] [Review][Patch] P3: Empty topic guard missing — `{"topic": ""}` returned as HTTP 200 when Gemini returns empty/None [main.py:suggest_topic]
- [x] [Review][Patch] P4: No HTTP-level test for `/suggest-topic` — only helper `_generate_topic_suggestion` tested; endpoint routing/serialization untested [tests/test_agent.py]
- [x] [Review][Patch] P5: No test for bad chapter string fallback in `_generate_topic_suggestion` — ValueError silently returns chapter 1 [tests/test_agent.py]
- [x] [Review][Defer] D1: Cooldown timestamp set before Gemini call — timeout locks chapter for 2s before retry allowed [main.py] — deferred, v1 single-user; 2s retry delay acceptable
- [x] [Review][Defer] D2: Concurrent cooldown race — two simultaneous requests can both pass cooldown check [main.py] — deferred, asyncio cooperative; multi-worker limitation consistent with `_active_runs`
- [x] [Review][Defer] D3: Per-chapter vs per-session cooldown — AC4 says per-session; implementation keyed by chapter [main.py] — deferred, v1 single-user no auth; per-chapter is effective equivalent
- [x] [Review][Defer] D4: Both `topic` + `english_draft` set → phase 1 silently wins [agent.py] — deferred, two-request protocol prevents this in correct clients; v1 no guard needed
- [x] [Review][Defer] D5: Large text in GET query params for topic/english_draft [main.py] — deferred, consistent with pre-existing `inputText` GET pattern; architectural concern for future refactor
- [x] [Review][Defer] D6: NFR14 timeout boundary not unit-tested [tests/test_agent.py] — deferred, asyncio fake-clock testing out of scope for v1
- [x] [Review][Defer] D7: `_suggest_topic_cooldowns` dict never pruned [main.py] — deferred, bounded by chapter count in practice; consistent with `_active_runs` pattern

### Completion Notes List

- All 5 ACs implemented. 20/20 tests pass (8 existing + 12 new). No regressions.
- `generate()` branches on `path_mode + topic/english_draft`; Path A callers unaffected (default `""` params).
- `_generate_proposal()` private method handles phase 1 — plain text response, no JSON parsing/validation.
- Phase 2 reuses `build_system_prompt()` with `english_draft` as source — zero code duplication.
- `_generate_topic_suggestion()` module-level helper in `main.py` follows same injection pattern as agent.
- Cooldown dict `_suggest_topic_cooldowns` keyed by chapter string (per-worker limitation noted; consistent with `_active_runs`).

### File List

- `apps/story-generator-backend/src/story_generator/agent.py` — UPDATE
- `apps/story-generator-backend/src/story_generator/main.py` — UPDATE
- `apps/story-generator-backend/tests/test_agent.py` — UPDATE
