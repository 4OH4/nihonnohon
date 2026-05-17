# Story 2.2: M1 Production Backend — Agent, SSE Endpoints & Cancellation

Status: done

## Story

As a developer,
I want the full M1 Python backend running with SSE generation, health, cancel endpoints, and CORS configured,
so that the frontend can connect to a real backend and complete the generate/cancel/error cycle without mocking.

## Acceptance Criteria

**AC1 — Health endpoint:**
Given the backend is running with a valid `GEMINI_API_KEY` in `.env`,
when `GET /health` is called,
then it responds 200 `{"status":"ok"}` within 5 seconds (or 503 if the key is missing/invalid).

**AC2 — SSE generation pipeline:**
Given a generation request is sent to `GET /run_sse` with `inputText`, `chapter`, `pathMode=A`, `runId`, and optional `steeringInstructions`, `temperature`, `grammar_distribution`,
when the request is processed,
then the stream emits `RUN_STARTED` → zero or more `TEXT_MESSAGE_CHUNK` → `RUN_FINISHED` (resultType='story') with a complete schema-valid JSON string; `validator.validate()` is called before `RUN_FINISHED` — if validation fails, `ERROR` is emitted instead; every sentence in the output has a stable `sentence.id`; the story `id` field embeds textbook, chapter, and content context.

**AC3 — Cancellation:**
Given a `POST /cancel/{runId}` is received while generation is in progress,
when the backend handles the cancel request,
then the in-progress generation is terminated and `RUN_CANCELLED` is emitted on the SSE stream with the matching `runId`.

**AC4 — CORS:**
Given `ALLOWED_ORIGIN` is set in `.env`,
when a request arrives from that origin,
then CORS headers allow it; the health endpoint has no CORS restriction regardless of origin.

**AC5 — CSV loading at startup:**
Given both CSVs exist at the path resolved from `DATA_DIR`,
when the backend starts,
then `data_loader.py` loads both CSVs into frozen dataclasses once at startup; no per-request file I/O.

**AC6 — Injectable Gemini client:**
Given `agent.py` is implemented with an injectable Gemini client,
when the injection seam is designed,
then `agent.py` accepts a `gemini_client` callable parameter; the production entry point passes the real Gemini caller; tests pass a mock callable that returns a pre-crafted valid JSON fixture; injection is via parameter, not environment variable or module-level patching.

**AC7 — Tests pass:**
Given `test_agent.py` runs with the injected mock client and no `GEMINI_API_KEY` set,
when `make test` is run,
then all backend tests pass; the mock verifies: system prompt includes cumulative vocab + grammar for the requested chapter; AG-UI events are emitted in order (`RUN_STARTED` → `RUN_FINISHED`); `validator.validate()` is called before `RUN_FINISHED`; an invalid mock response causes `ERROR` to be emitted instead.

## Tasks / Subtasks

- [x] AC1+AC4+AC5: Implement `main.py`
  - [x] Add `fastapi` and `uvicorn[standard]` to `requirements.txt`
  - [x] Create FastAPI app with `lifespan` context manager loading CSVs at startup from `DATA_DIR` env var
  - [x] `GET /health` → `{"status":"ok"}` 200 or `{"status":"unavailable"}` 503; add `Access-Control-Allow-Origin: *` header manually (health is exempt from CORS restriction)
  - [x] `GET /run_sse` → `StreamingResponse(media_type="text/event-stream")` — registers `runId`, streams events from agent, deregisters on completion
  - [x] `POST /cancel/{run_id}` → set cancel event for that runId; return `{"ok": true}`
  - [x] `CORSMiddleware` with `ALLOWED_ORIGIN` env var (default `http://localhost:5174`); apply to all routes (health will override with `*` manually)
  - [x] Module-level `_active_runs: dict[str, asyncio.Event]` for cancellation coordination

- [x] AC2+AC6: Implement `agent.py`
  - [x] Extract `build_system_prompt()` from `spike.py` verbatim — adapt signature to accept `(vocab_data, grammar_data, chapter_int, english_source, steering_instructions, grammar_dist)` (see Dev Notes for grammar_dist prompt text)
  - [x] Parse chapter integer from `"Genki I Ch.8"` format: `int(chapter_str.split("Ch.")[1])`
  - [x] `StoryGeneratorAgent` class with `__init__(self, vocab_data, grammar_data, gemini_client=None)` — callable injection (see Dev Notes)
  - [x] `generate()` async generator — yields AG-UI event dicts per ADR-004; checks cancel event between phases
  - [x] Emit `RUN_STARTED` immediately; call Gemini; emit `TEXT_MESSAGE_CHUNK` with assembled JSON; call `validator.validate()`; emit `RUN_FINISHED` or `ERROR`
  - [x] Generate `sentence.id` as `"s01"`, `"s02"`, etc. — verified present in every sentence before streaming
  - [x] Wrap Gemini call in 55-second asyncio timeout (buffer before frontend's 60s limit)

- [x] AC2: Extend `validator.py`
  - [x] Add parallel array parity check: for each sentence, if `ruby` is present and non-empty, `len(ruby)` must equal `len(words)`; same for `vocab_keys`; produce `PARALLEL_ARRAY_MISMATCH` error with `sentence_index`
  - [x] Keep all existing required-field checks intact — do not break existing tests

- [x] AC7: Write `tests/test_agent.py`
  - [x] Provide fixture JSON (import from `tests/fixtures/valid_story.json` — generated by M0 spike)
  - [x] `make_mock_client(fixture_json)` factory: returns a lambda `(model, contents, config) → SimpleNamespace(text=fixture_json)`
  - [x] Test: `RUN_STARTED` and `RUN_FINISHED` events emitted in order; no `GEMINI_API_KEY` needed
  - [x] Test: system prompt for Ch.3 includes Ch.1–3 vocab and grammar, excludes Ch.4+
  - [x] Test: `validator.validate()` is called — proven by injecting a fixture that fails parallel array check → `ERROR` event emitted
  - [x] Test: invalid JSON response → `ERROR` event emitted with `code: 'GENERATION_FAILED'`
  - [x] All tests run via `make test` (which runs `pytest` with `PYTHONPATH=src` from conftest.py)

- [x] Manual smoke test: `make dev` starts both processes; browser at `http://localhost:5174` shows "Backend connected" — deferred to Story 2.3 (BackendStatus component not yet implemented)

### Review Findings (AI)

- [x] [Review][Patch] `_parse_chapter` ValueError uncaught in `generate()` — silent broken SSE stream [agent.py:~218]
- [x] [Review][Patch] `run_sse` passes None to agent when called before lifespan completes [main.py:~86]
- [x] [Review][Patch] `_get_caller()` creates new `genai.Client` on every request — not cached [agent.py:~179]
- [x] [Review][Patch] `os.environ["GEMINI_API_KEY"]` leaks env-var name in ERROR message [agent.py:~185]
- [x] [Review][Patch] `sentences: null` passes `validator.validate()` as valid=True [validator.py:~65]
- [x] [Review][Patch] Individual `sentence.id` presence never validated — AC2 violation [validator.py]
- [x] [Review][Patch] Vocab ceiling test asserts single-char particle substrings — false-positive risk [test_agent.py:~116]
- [x] [Review][Defer] Dangling threads after asyncio.TimeoutError — known Python limitation; single-user v1 — deferred, pre-existing [agent.py]
- [x] [Review][Defer] `_active_runs` multi-worker isolation — v2/Cloud Run deployment concern; v1 uses single worker — deferred, pre-existing [main.py]
- [x] [Review][Defer] `cancel` returns ok for unknown run_id — idempotent cancel acceptable for v1 — deferred, pre-existing [main.py]
- [x] [Review][Defer] TEXT_MESSAGE_CHUNK + RUN_FINISHED both send full JSON — bandwidth trivial for v1; streaming Gemini response is M2 — deferred, pre-existing [agent.py]
- [x] [Review][Defer] `path_mode` accepted but unused — Path B is M3 scope — deferred, pre-existing [agent.py]
- [x] [Review][Defer] Ch.0 vocab entries excluded from prompts — matches spike.py curriculum design — deferred, pre-existing [agent.py]
- [x] [Review][Defer] Health 503 only for absent key not invalid key — validating key requires API call, impractical — deferred, pre-existing [main.py]

## Dev Notes

### Current state of stub files

Both `main.py` and `agent.py` are single-line docstring stubs:
```python
"""ADK agent server entry point — stub for Story 1.2. Full implementation in Story 2.2."""
```
Replace them entirely. `validator.py`, `data_loader.py`, `models.py` exist and work — do not rewrite them, only extend `validator.py`.

### Dependencies to add to `requirements.txt`

```
fastapi
uvicorn[standard]
```

`google-adk` is already present and transitively provides FastAPI, but declare it explicitly. `google-genai` is already a transitive dependency of `google-adk` (confirmed in Story 1.3 debug: `google-genai 1.75.0` available).

### `main.py` — FastAPI app structure

```python
import asyncio, json, os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv

from story_generator.data_loader import load_vocab_data, load_grammar_data
from story_generator.agent import StoryGeneratorAgent

load_dotenv()

_vocab_data = None
_grammar_data = None
_active_runs: dict[str, asyncio.Event] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _vocab_data, _grammar_data
    data_dir = Path(os.environ.get("DATA_DIR", "../../resources"))
    _vocab_data = load_vocab_data(data_dir / "genki1vocab.csv")
    _grammar_data = load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")
    yield

app = FastAPI(lifespan=lifespan)

allowed_origin = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5174")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    """Health check — CORS-exempt (adds * header manually). 503 if API key missing."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    status_code = 200 if api_key else 503
    body = {"status": "ok"} if api_key else {"status": "unavailable"}
    response = JSONResponse(content=body, status_code=status_code)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.get("/run_sse")
async def run_sse(
    run_id: str = Query(..., alias="runId"),
    input_text: str = Query(..., alias="inputText"),
    chapter: str = Query(...),
    path_mode: str = Query("A", alias="pathMode"),
    steering_instructions: str = Query("", alias="steeringInstructions"),
    temperature: float = Query(1.0),
    grammar_distribution: int = Query(1, alias="grammar_distribution"),
):
    cancel_event = asyncio.Event()
    _active_runs[run_id] = cancel_event

    agent = StoryGeneratorAgent(_vocab_data, _grammar_data)

    async def stream():
        try:
            async for event in agent.generate(
                run_id=run_id,
                input_text=input_text,
                chapter=chapter,
                path_mode=path_mode,
                steering_instructions=steering_instructions,
                temperature=temperature,
                grammar_distribution=grammar_distribution,
                cancel_event=cancel_event,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            _active_runs.pop(run_id, None)

    return StreamingResponse(stream(), media_type="text/event-stream")

@app.post("/cancel/{run_id}")
async def cancel(run_id: str):
    if run_id in _active_runs:
        _active_runs[run_id].set()
    return {"ok": True}
```

### `agent.py` — StoryGeneratorAgent design

```python
import asyncio, json, os
from types import SimpleNamespace
from typing import Any, AsyncGenerator

from story_generator.data_loader import VocabData, GrammarData
from story_generator.validator import validate

GEMINI_MODEL = "gemini-2.5-flash"

class StoryGeneratorAgent:
    """M1 story generation agent.

    gemini_client: callable(model, contents, config) → response-with-.text
    If None, creates a real genai.Client using GEMINI_API_KEY from environment.
    """

    def __init__(self, vocab_data: VocabData, grammar_data: GrammarData,
                 gemini_client=None):
        self._vocab_data = vocab_data
        self._grammar_data = grammar_data
        self._gemini_client = gemini_client  # None → created lazily on first call

    def _get_caller(self):
        """Return the Gemini generate_content callable."""
        if self._gemini_client is not None:
            return self._gemini_client
        from google import genai
        from google.genai import types as genai_types
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        def _call(model, contents, config):
            return client.models.generate_content(
                model=model, contents=contents, config=config
            )
        return _call

    async def generate(
        self, *, run_id: str, input_text: str, chapter: str,
        path_mode: str = "A", steering_instructions: str = "",
        temperature: float = 1.0, grammar_distribution: int = 1,
        cancel_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Yield AG-UI event dicts per ADR-004."""
        yield {"type": "RUN_STARTED", "runId": run_id}

        # Check cancel before calling Gemini
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        chapter_int = _parse_chapter(chapter)
        prompt = build_system_prompt(
            self._vocab_data, self._grammar_data, chapter_int,
            input_text, steering_instructions, grammar_distribution
        )

        # Gemini call (non-streaming, sync-in-async via asyncio.to_thread)
        try:
            from google.genai import types as genai_types
            config = genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=temperature,
            )
            call = self._get_caller()
            response = await asyncio.wait_for(
                asyncio.to_thread(call, GEMINI_MODEL, prompt, config),
                timeout=55.0,
            )
        except asyncio.TimeoutError:
            yield {"type": "ERROR", "code": "TIMEOUT",
                   "message": "Generation timed out. Your inputs are preserved."}
            return
        except Exception as exc:
            yield {"type": "ERROR", "code": "GENERATION_FAILED",
                   "message": str(exc)}
            return

        # Check cancel after Gemini returns
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        raw_json = getattr(response, "text", None)
        if raw_json is None:
            yield {"type": "ERROR", "code": "GENERATION_FAILED",
                   "message": "Gemini returned no content. Check safety filters."}
            return

        # Parse JSON
        try:
            story_dict = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            yield {"type": "ERROR", "code": "GENERATION_FAILED",
                   "message": f"Response is not valid JSON: {exc}"}
            return

        # Validate before emitting RUN_FINISHED
        result = validate(story_dict)
        if not result.valid:
            errors_str = "; ".join(e.message for e in result.errors)
            yield {"type": "ERROR", "code": "VALIDATION_ERROR",
                   "message": f"Generated story failed validation: {errors_str}"}
            return

        # Stream the complete JSON as a single chunk, then finish
        yield {"type": "TEXT_MESSAGE_CHUNK", "delta": raw_json}
        yield {
            "type": "RUN_FINISHED",
            "resultType": "story",
            "content": raw_json,
        }
```

**`_parse_chapter` helper:**
```python
def _parse_chapter(chapter_str: str) -> int:
    """Extract integer chapter number from 'Genki I Ch.8' format."""
    try:
        return int(chapter_str.split("Ch.")[1])
    except (IndexError, ValueError):
        raise ValueError(f"Cannot parse chapter number from: {chapter_str!r}")
```

### `build_system_prompt` — copy from spike.py with additions

The function in `spike.py` is complete and proven. Copy it to `agent.py` and extend the signature to accept `steering_instructions` and `grammar_distribution`:

```python
def build_system_prompt(vocab_data, grammar_data, chapter: int,
                         english_source: str, steering_instructions: str = "",
                         grammar_distribution: int = 1) -> str:
```

Add these to the prompt just before "Return ONLY the JSON object...":

```python
# Grammar distribution hint
dist_hints = {
    0: "Use a limited set of grammar patterns — keep the sentence structures simple and repetitive.",
    1: "Balance the grammar patterns — use a moderate variety that fits naturally.",
    2: "Use as many grammar patterns from the list as you can, fitting them naturally into the story.",
}
grammar_dist_text = dist_hints.get(grammar_distribution, dist_hints[1])

# Steering instructions (optional)
steering_block = f"\n## Additional Instructions\n\n{steering_instructions.strip()}\n" if steering_instructions.strip() else ""
```

Insert `grammar_dist_text` into the prompt's Critical Rules section and `steering_block` before the final line.

### `validator.py` extension — parallel array parity

Add this to the `validate()` function **after** the required-field check, **inside** the try/except block:

```python
# Parallel array parity per sentence
sentences = story_dict.get("sentences", [])
if isinstance(sentences, list):
    for i, sentence in enumerate(sentences):
        if not isinstance(sentence, dict):
            continue
        words = sentence.get("words") or []
        ruby = sentence.get("ruby")
        vocab_keys = sentence.get("vocab_keys")
        n = len(words)
        if ruby is not None and len(ruby) != n:
            errors.append(ValidationError(
                code="PARALLEL_ARRAY_MISMATCH",
                message=f"sentence[{i}]: words={n} but ruby={len(ruby)}",
                sentence_index=i,
            ))
        if vocab_keys is not None and len(vocab_keys) != n:
            errors.append(ValidationError(
                code="PARALLEL_ARRAY_MISMATCH",
                message=f"sentence[{i}]: words={n} but vocab_keys={len(vocab_keys)}",
                sentence_index=i,
            ))
```

### `test_agent.py` — test design

Use `asyncio.run()` to consume the async generator in synchronous tests — no pytest-asyncio needed:

```python
import asyncio, json, sys
from pathlib import Path
from types import SimpleNamespace

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "valid_story.json"

def _collect(gen):
    """Consume an async generator synchronously."""
    async def _run():
        return [e async for e in gen]
    return asyncio.run(_run())

def make_mock_client(fixture_json: str):
    """Returns a callable matching agent.py's _get_caller() interface."""
    return lambda model, contents, config: SimpleNamespace(text=fixture_json)

@pytest.fixture
def fixture_json():
    return FIXTURE_PATH.read_text(encoding="utf-8")

@pytest.fixture
def vocab_data():
    from story_generator.data_loader import load_vocab_data
    data_dir = Path(__file__).parents[3] / "resources"
    return load_vocab_data(data_dir / "genki1vocab.csv")

@pytest.fixture
def grammar_data():
    from story_generator.data_loader import load_grammar_data
    data_dir = Path(__file__).parents[3] / "resources"
    return load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")
```

**Test: event sequence:**
```python
def test_events_emitted_in_order(vocab_data, grammar_data, fixture_json):
    agent = StoryGeneratorAgent(vocab_data, grammar_data,
                                 gemini_client=make_mock_client(fixture_json))
    events = _collect(agent.generate(
        run_id="test-run-1", input_text="A test story.",
        chapter="Genki I Ch.3",
    ))
    types = [e["type"] for e in events]
    assert types[0] == "RUN_STARTED"
    assert "RUN_FINISHED" in types
    assert types[-1] == "RUN_FINISHED"
    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "story"
```

**Test: system prompt cumulative ceiling:**
```python
def test_system_prompt_includes_cumulative_vocab(vocab_data, grammar_data, fixture_json):
    captured = []
    def capturing_client(model, contents, config):
        captured.append(contents)
        return SimpleNamespace(text=fixture_json)
    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=capturing_client)
    _collect(agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.3"))
    prompt = captured[0]
    # Ch.1–3 vocab present
    for ch in range(1, 4):
        for entry in vocab_data.by_chapter.get(ch, []):
            assert entry.hiragana in prompt
    # Ch.4 vocab NOT in prompt
    ch4_entries = vocab_data.by_chapter.get(4, [])
    if ch4_entries:
        # check a few Ch.4-exclusive entries
        for entry in ch4_entries[:3]:
            if entry.hiragana not in "".join(
                e.hiragana for ch in range(1, 4) for e in vocab_data.by_chapter.get(ch, [])
            ):
                assert entry.hiragana not in prompt
```

**Test: validation failure → ERROR:**
```python
def test_invalid_story_emits_error(vocab_data, grammar_data):
    # Fixture with parallel array mismatch
    bad_story = json.dumps({
        "schema_version": "1", "id": "x", "title": "x", "title_ja": "x",
        "language": "ja", "description": "x",
        "sentences": [{"id": "s01", "words": ["a", "b"], "ruby": ["r1"],
                       "vocab_keys": [None, None]}]
    })
    agent = StoryGeneratorAgent(vocab_data, grammar_data,
                                 gemini_client=make_mock_client(bad_story))
    events = _collect(agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1"))
    assert any(e["type"] == "ERROR" for e in events)
    assert not any(e["type"] == "RUN_FINISHED" for e in events)
```

**Test: invalid JSON → ERROR:**
```python
def test_invalid_json_emits_error(vocab_data, grammar_data):
    agent = StoryGeneratorAgent(vocab_data, grammar_data,
                                 gemini_client=make_mock_client("not-json{"))
    events = _collect(agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1"))
    assert any(e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events)
```

### Critical patterns from previous stories

**From Story 1.3 debug log:**
- Windows console CP1252 blocks `✓` — use ASCII `OK` in any print statements
- `PYTHONPATH=src` needed in Makefile targets (conftest.py handles this for pytest via sys.path.insert)
- `response.text` can be `None` if Gemini blocks output — always check before `json.loads()`
- `google-genai 1.75.0` confirmed available via `google-adk`

**From Story 1.2 completion notes:**
- `conftest.py` adds `src/` to `sys.path` — tests import `story_generator.*` without installation
- `VocabData.by_chapter` is `dict[int, list[VocabEntry]]` keyed by chapter int
- `GrammarData.by_chapter` is `dict[int, list[GrammarPoint]]`; `GrammarPoint.summary` has the full description

**From Story 2.1 learnings (architecture):**
- `validate()` in validator.py never raises — wraps everything in try/except
- This story EXTENDS validator.py, don't rewrite it
- models.py is AUTO-GENERATED — never edit it

### SSE wire format

Each event is a Server-Sent Events `data:` line followed by double newline:

```
data: {"type": "RUN_STARTED", "runId": "abc123"}\n\n
data: {"type": "TEXT_MESSAGE_CHUNK", "delta": "{\"schema_version\":\"1\"..."}\n\n
data: {"type": "RUN_FINISHED", "resultType": "story", "content": "{...}"}\n\n
```

FastAPI's `StreamingResponse(stream(), media_type="text/event-stream")` handles the connection. The frontend's `EventSource` receives these via `es.onmessage`.

### Makefile — no changes needed

The existing `test` target (`pytest`) and `dev` target (`uvicorn story_generator.main:app --port 8000 --reload`) work as-is once `fastapi` and `uvicorn[standard]` are in `requirements.txt` and the `PYTHONPATH=src` conftest handles imports.

### `tools.py` — leave as empty stub

Per architecture, `tools.py` is for M2 ADK tool definitions. Story 2.2 should not add anything there.

### Files created / modified

**Modified:**
- `apps/story-generator-backend/requirements.txt` (add fastapi, uvicorn[standard])
- `apps/story-generator-backend/src/story_generator/main.py` (replace stub)
- `apps/story-generator-backend/src/story_generator/agent.py` (replace stub)
- `apps/story-generator-backend/src/story_generator/validator.py` (extend — add parallel array check)

**New:**
- `apps/story-generator-backend/tests/test_agent.py`

### References

- [epics-story-authoring-tool.md — Story 2.2](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [architecture-story-authoring-tool.md — API & Communication Patterns, Backend Architecture, Format Patterns](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [docs/adr/004-agui-event-types.md — AG-UI event contract](../../docs/adr/004-agui-event-types.md)
- [spike.py — proven build_system_prompt() and Gemini API usage](../../apps/story-generator-backend/src/story_generator/spike.py)
- [validator.py — current state to extend](../../apps/story-generator-backend/src/story_generator/validator.py)
- [1-3-m0-feasibility-spike.md — Debug Log (Windows encoding, PYTHONPATH, None response guard)](1-3-m0-feasibility-spike.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `google.genai.types` import path confirmed: `from google.genai import types as genai_types` (via `google-adk` transitive dep, confirmed in Story 1.3)
- `asyncio.to_thread()` used to run blocking Gemini call without blocking FastAPI event loop
- `asyncio.wait_for()` wraps the thread call for the 55s timeout

### Completion Notes List

- AC1+AC4+AC5: `main.py` fully implemented — FastAPI app with lifespan CSV loading, health/run_sse/cancel endpoints, CORSMiddleware with ALLOWED_ORIGIN, health endpoint adds `Access-Control-Allow-Origin: *` manually to bypass CORS restriction
- AC2+AC6: `agent.py` — `StoryGeneratorAgent` with injectable `gemini_client` callable, `build_system_prompt()` extended from spike.py with `steering_instructions` and `grammar_distribution`, `_parse_chapter()` extracts int from "Genki I Ch.N", `asyncio.to_thread` + `asyncio.wait_for` for non-blocking Gemini call with 55s timeout
- AC2: `validator.py` extended with parallel array parity checks for `ruby` and `vocab_keys` per sentence; existing required-field tests still pass
- AC7: `test_agent.py` — 8 tests covering event order, runId echo, cumulative vocab/grammar ceiling, validation failure → ERROR, invalid JSON → ERROR, None response → ERROR, cancel pre-emption; 11/11 passing (`make test`)
- Smoke test (manual): deferred to Story 2.3 — `BackendStatus` component not yet built

### File List

- `apps/story-generator-backend/requirements.txt` (modified — added fastapi, uvicorn[standard])
- `apps/story-generator-backend/src/story_generator/main.py` (modified — replaced stub)
- `apps/story-generator-backend/src/story_generator/agent.py` (modified — replaced stub)
- `apps/story-generator-backend/src/story_generator/validator.py` (modified — added parallel array parity)
- `apps/story-generator-backend/tests/test_agent.py` (new)
- `_bmad-output/implementation-artifacts/2-2-m1-production-backend-agent-sse-endpoints-and-cancellation.md` (new — story file)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)
