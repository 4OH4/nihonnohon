# Story se3-1: Shared LLM Streamer Extraction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **backend developer**,
I want the duplicated Gemini streaming / deadline / cancel / logging boilerplate extracted into one
`_stream_llm` helper on `StoryGeneratorAgent`,
so that Stage 1, Stage 2, and the existing proposal path share one tested streamer and adding new
prompts (se3-2, se3-3) does not triple the boilerplate.

## Context

This is the **first story of supp-epic-3** (Staged Generation Pipeline). It is a **pure refactor
with no behavioural change** — it does not add prompts, paths, or parameters. Its only job is to
collapse the two near-identical stream loops in `agent.py` into one reusable async helper so the
later prompt stories drop into a clean seam. The existing streaming/timeout/thought/cancel/Path-B
tests in `tests/test_agent.py` are the **regression net** and must all pass unchanged.

Full epic: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(Design Decision "Extract the shared LLM streamer first"; Story se3-1).

## Acceptance Criteria

1. **AC1 — Single streamer helper exists**
   A single async helper on `StoryGeneratorAgent` — signature
   `_stream_llm(self, *, contents, json_output: bool, activity: str, temperature: float, cancel_event, run_id)`
   — owns **all** of the following (today duplicated between `agent.py:366-447` and `agent.py:571-646`):
   - Building `GenerateContentConfig` with `response_mime_type="application/json"` **only when**
     `json_output=True` (omitted otherwise), the given `temperature`, and
     `ThinkingConfig(thinking_budget=THINKING_BUDGET, include_thoughts=True)`
   - The `time.monotonic()` wall-clock deadline and the initial
     `asyncio.wait_for(stream(GEMINI_MODEL, contents, config), timeout=max(deadline - now, 0))`
     (mirroring `agent.py:383-388`)
   - The mid-stream deadline re-check (`if time.monotonic() > deadline: raise asyncio.TimeoutError()`)
     and mid-stream cancel check (`agent.py:393-394`)
   - The candidates/content/parts walk and thought-part → `AGENT_STATUS` emission, including the
     empty/whitespace-thought suppression (`agent.py:402-408`)
   - The `_perf_logger` (`llm_perf`) log line keyed by the `activity` string, for every terminal
     outcome (ok / timeout / error)

2. **AC2 — Terminal control-dict protocol**
   `_stream_llm` is an async generator that yields pass-through `AGENT_STATUS` event dicts and then
   **exactly one** terminal control dict as its final item, one of:
   - `{"__stream__": "ok", "text": <raw accumulated non-thought text>}`
   - `{"__stream__": "timeout"}`
   - `{"__stream__": "error", "message": <str(exc)>}`
   - `{"__stream__": "cancelled"}` (mid-stream cancel detected)

   Callers iterate, forward every `AGENT_STATUS`, and `break` on the first dict carrying a
   `"__stream__"` key.

3. **AC3 — JSON generation path refactored**
   The JSON generation path in `generate()` (`agent.py:366-447`) calls `_stream_llm(...,
   json_output=True, activity="Convert to Japanese", temperature=temperature, ...)`, translates the
   terminal dict to the existing AG-UI events, and retains its downstream steps unchanged: empty-output
   guard, `json.loads`, the `(segments, story_meta)` seam, enrichment, validate, `RUN_FINISHED`.

4. **AC4 — Proposal path refactored**
   `_generate_proposal()` (`agent.py:571-646`) calls `_stream_llm(..., json_output=False,
   activity="Generate story in English", temperature=temperature, ...)`, translates the terminal
   dict, and retains its downstream steps: strip, empty guard, `RUN_FINISHED(resultType="proposal")`.

5. **AC5 — No duplicated streaming boilerplate remains**
   After the refactor, no streaming / deadline / initial-`wait_for` / mid-stream-cancel /
   thought-walk / perf-log code is duplicated between the two paths — it exists once, in `_stream_llm`.

6. **AC6 — Terminal → AG-UI event mapping preserved exactly**
   Each caller maps the terminal dict to the **same** events emitted today:
   - `"timeout"` → `{"type": "ERROR", "code": "TIMEOUT", "message": "This took longer than expected — your inputs are preserved. Try again."}`
   - `"error"` → `{"type": "ERROR", "code": "GENERATION_FAILED", "message": <message>}`
   - `"cancelled"` → `{"type": "RUN_CANCELLED", "runId": run_id}`
   - `"ok"` → proceed with the path-specific downstream handling of `text`

7. **AC7 — Regression net passes unchanged**
   `pytest tests/test_agent.py` passes with **no edits to existing test assertions** — specifically
   the streaming, timeout (`test_streaming_timeout_yields_error`), thought-chunk
   (`test_agent_status_emitted_for_thought_chunks`, `test_no_agent_status_when_no_thoughts`,
   `test_empty_thought_text_not_emitted`), `None`-candidates
   (`test_none_candidates_chunks_skipped`), empty-response (`test_none_response_emits_error`),
   cancel (`test_cancel_before_gemini_call`), and Path-B phase-1 (`test_path_b_phase1_*`) and
   phase-2 (`test_path_b_phase2_*`) tests all pass. The full suite (`pytest tests/`) also passes.

## Tasks / Subtasks

- [x] Task 1: Add `_stream_llm` async helper to `StoryGeneratorAgent` (AC: 1, 2)
  - [x] Place it near `_get_stream_caller` (`agent.py:259`), before `generate()`
  - [x] Build `config` via `from google.genai import types as genai_types`; include
        `response_mime_type="application/json"` only when `json_output` is True
  - [x] Set `t0 = time.perf_counter()` and `deadline = time.monotonic() + self._generation_timeout_s`
        at entry
  - [x] Wrap the initial `stream(...)` call in `asyncio.wait_for` with the remaining budget
  - [x] Reproduce the async-for loop verbatim: deadline re-check, mid-stream cancel `break`,
        candidates/content/parts walk, thought → `yield {"type": "AGENT_STATUS", ...}` (skip empty),
        non-thought → accumulate into a local `parts: list[str]`
  - [x] On normal loop exit: emit the "ok" `_perf_logger` line (activity, run_id, elapsed_ms,
        `response_chars=len(raw)`, status="ok"); if the loop was exited by mid-stream cancel, yield
        `{"__stream__": "cancelled"}` and return instead
  - [x] `yield {"__stream__": "ok", "text": raw}` where `raw = "".join(parts)`
  - [x] `except asyncio.TimeoutError`: emit timeout `_perf_logger` line; `yield {"__stream__": "timeout"}`
  - [x] `except Exception as exc`: emit error `_perf_logger` line; `yield {"__stream__": "error", "message": str(exc)}`

- [x] Task 2: Refactor the JSON path in `generate()` to consume `_stream_llm` (AC: 3, 6)
  - [x] Replace `agent.py:366-447` with a loop over `self._stream_llm(contents=prompt,
        json_output=True, activity="Convert to Japanese", temperature=temperature,
        cancel_event=cancel_event, run_id=run_id)`
  - [x] Forward every `AGENT_STATUS`; on the `"__stream__"` dict, `break` and dispatch per AC6
  - [x] Keep the post-"ok" downstream flow exactly as today: empty-`raw_json` guard
        (`agent.py:455-462`), `json.loads` + `JSONDecodeError` guard, the `segments`/`story_meta`
        seam (`agent.py:488-491`), pipeline guard, `build_enriched_story`, `validate`, `RUN_FINISHED`

- [x] Task 3: Refactor `_generate_proposal()` to consume `_stream_llm` (AC: 4, 6)
  - [x] Replace `agent.py:571-646` with a loop over `self._stream_llm(contents=prompt,
        json_output=False, activity="Generate story in English", temperature=temperature,
        cancel_event=cancel_event, run_id=run_id)`
  - [x] Keep the post-"ok" flow: `proposal_text = text.strip()`, empty guard,
        `RUN_FINISHED(resultType="proposal")`

- [x] Task 4: Remove now-dead duplication and verify (AC: 5, 7)
  - [x] Confirm no orphaned `raw_json_parts` / `proposal_parts` / duplicate `config` / duplicate
        deadline blocks remain
  - [x] Run `pytest tests/test_agent.py -v` then `pytest tests/ -v`; all green with no assertion edits

## Dev Notes

### The exact duplication being collapsed

The two loops in `agent.py` are near-verbatim. They differ in only four things:

| Aspect | JSON path (`generate`, `agent.py:366-447`) | Proposal path (`_generate_proposal`, `agent.py:571-646`) |
|---|---|---|
| `config.response_mime_type` | `"application/json"` | omitted (plain text) |
| Accumulator var | `raw_json_parts` | `proposal_parts` |
| perf `activity` | `"Convert to Japanese"` | `"Generate story in English"` |
| Downstream of raw text | `json.loads` → enrich → validate | `.strip()` → proposal |

Everything else — `t0`, `deadline`, initial `wait_for`, the `async for` with deadline/cancel checks,
the candidates→content→parts thought walk, and the timeout/error `_perf_logger` blocks — is identical.
The helper absorbs the identical part; the four differences become parameters (`json_output`,
`activity`) or stay in the caller (the accumulator is now internal; downstream stays put).

### Helper skeleton (target shape)

```python
async def _stream_llm(
    self,
    *,
    contents,
    json_output: bool,
    activity: str,
    temperature: float,
    cancel_event: asyncio.Event | None,
    run_id: str,
) -> AsyncGenerator[dict, None]:
    """Stream one Gemini call; yield AGENT_STATUS dicts then one terminal control dict.

    Terminal dict is one of {"__stream__": "ok"|"timeout"|"error"|"cancelled", ...}.
    Owns the config, wall-clock deadline, mid-stream cancel, thought→AGENT_STATUS
    emission, and the llm_perf log keyed by `activity`.
    """
    from google.genai import types as genai_types

    config_kwargs = dict(
        temperature=temperature,
        thinking_config=genai_types.ThinkingConfig(
            thinking_budget=THINKING_BUDGET,
            include_thoughts=True,
        ),
    )
    if json_output:
        config_kwargs["response_mime_type"] = "application/json"
    config = genai_types.GenerateContentConfig(**config_kwargs)

    t0 = time.perf_counter()
    parts: list[str] = []
    cancelled = False
    try:
        stream = self._get_stream_caller()
        deadline = time.monotonic() + self._generation_timeout_s
        chunks = await asyncio.wait_for(
            stream(GEMINI_MODEL, contents, config),
            timeout=max(deadline - time.monotonic(), 0),
        )
        async for chunk in chunks:
            if time.monotonic() > deadline:
                raise asyncio.TimeoutError()
            if cancel_event and cancel_event.is_set():
                cancelled = True
                break
            candidates = getattr(chunk, "candidates", None) or []
            if not candidates:
                continue
            content = getattr(candidates[0], "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []):
                if getattr(part, "thought", False):
                    thought_text = (getattr(part, "text", None) or "").strip()
                    if thought_text:
                        yield {"type": "AGENT_STATUS", "message": thought_text}
                else:
                    parts.append(getattr(part, "text", None) or "")
    except asyncio.TimeoutError:
        self._log_llm_perf(activity, run_id, t0, 0, "timeout")
        logger.warning("run_id=%s %s timed out after %ss", run_id, activity, self._generation_timeout_s)
        yield {"__stream__": "timeout"}
        return
    except Exception as exc:  # noqa: BLE001
        self._log_llm_perf(activity, run_id, t0, 0, "error")
        logger.error("run_id=%s %s Gemini call failed: %s", run_id, activity, exc)
        yield {"__stream__": "error", "message": str(exc)}
        return

    if cancelled:
        yield {"__stream__": "cancelled"}
        return

    raw = "".join(parts)
    self._log_llm_perf(activity, run_id, t0, len(raw), "ok")
    yield {"__stream__": "ok", "text": raw}
```

A tiny `_log_llm_perf(self, activity, run_id, t0, response_chars, status)` helper that emits the
existing `_perf_logger.info("", extra={...})` shape removes the third copy of that block. Compute
`elapsed_ms = round((time.perf_counter() - t0) * 1000)` inside it. Optional but recommended — it is
the third near-identical fragment.

### Caller shape (both paths)

```python
async for ev in self._stream_llm(
    contents=prompt, json_output=True, activity="Convert to Japanese",
    temperature=temperature, cancel_event=cancel_event, run_id=run_id,
):
    if "__stream__" not in ev:
        yield ev            # pass through AGENT_STATUS
        continue
    outcome = ev["__stream__"]
    if outcome == "timeout":
        yield {"type": "ERROR", "code": "TIMEOUT",
               "message": "This took longer than expected — your inputs are preserved. Try again."}
        return
    if outcome == "error":
        yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": ev["message"]}
        return
    if outcome == "cancelled":
        yield {"type": "RUN_CANCELLED", "runId": run_id}
        return
    raw_json = ev["text"]   # outcome == "ok"; downstream continues unchanged
    break
```

The proposal caller is identical except `json_output=False`, `activity="Generate story in English"`,
and the `"ok"` branch takes `proposal_text = ev["text"].strip()`.

### Behavioural nuances to preserve (do not regress)

- **Mid-stream cancel path.** Today a mid-stream cancel `break`s the loop and falls through to the
  post-stream cancel guard (`agent.py:449-452` / `:648-650`) which emits `RUN_CANCELLED`. In the new
  design the helper detects it, yields `{"__stream__": "cancelled"}`, and the caller emits
  `RUN_CANCELLED`. Net effect identical. You may **delete** the now-redundant post-stream cancel
  guards in the callers, since the `"cancelled"` terminal covers them; the **pre-stream** cancel
  guard in `generate()` (`agent.py:310-312`) and at the top of `_generate_proposal()`
  (`agent.py:557-559`) stays — `test_cancel_before_gemini_call` exercises the `generate()` one.
- **Empty-output guard stays in the caller.** `test_none_response_emits_error` feeds a chunk whose
  text is `None`, producing `raw == ""` and an `"ok"` terminal; the caller's existing
  `if not raw_json:` guard (`agent.py:455`) / `if not proposal_text:` (`agent.py:653`) still fires
  `GENERATION_FAILED`. Do not move that check into the helper.
- **`response_mime_type` toggling is the only config difference.** Everything else in the config
  (temperature, ThinkingConfig) is identical across paths — do not accidentally diverge them.
- **`None`-text parts accumulate as `""`.** Keep `getattr(part, "text", None) or ""` for both
  thought and non-thought parts (`test_none_candidates_chunks_skipped` and
  `test_none_response_emits_error` depend on this).

### perf-logging semantics (minor, non-tested — get it right anyway)

No test asserts `_perf_logger` output, but keep it faithful:
- Today the **"ok"** perf line is emitted in the caller *after* the empty guard, so an empty response
  logs **no** "ok" line (it returns at the guard). Moving the "ok" log into `_stream_llm` means an
  empty-but-non-timeout stream now logs `status="ok", response_chars=0` *before* the caller emits
  `GENERATION_FAILED`. This is acceptable and matches AC1 ("`_stream_llm` owns the llm_perf line").
- Today the proposal "ok" line uses the **stripped** length (`len(proposal_text)`); the helper will
  log the **unstripped** `len(raw)`. Difference is trailing-whitespace only. Acceptable.
- Keep the exact `extra=` keys used today: `activity`, `run_id`, `elapsed_ms`, `response_chars`,
  `status`.

### Test contract details (from `tests/test_agent.py`)

- The stream mock is `make_mock_stream_client(text)`: an `async def _stream(model, contents, config)`
  that returns an inner async generator. `_get_stream_caller()` returns exactly this shape, so the
  helper must `await stream(...)` then `async for` the result — unchanged from today.
- `test_streaming_timeout_yields_error` sets `generation_timeout_s=0.01` and sleeps 120s mid-stream;
  the deadline re-check must fire → `"timeout"` → `TIMEOUT` ERROR.
- `test_agent_status_emitted_for_thought_chunks` asserts `AGENT_STATUS` precedes
  `TEXT_MESSAGE_CHUNK` — the helper yields `AGENT_STATUS` inline (pass-through) so ordering holds.
- `test_path_b_phase1_agent_status_from_thoughts` asserts the same ordering on the proposal path.
- No test asserts on the `"__stream__"` sentinel; it is an internal protocol between helper and caller.

### Code style (project-context.md §Comments; se2-1/se2-2 precedent)

- `from __future__ import annotations` already present at `agent.py:2` — keep it.
- Succinct docstring on `_stream_llm` (and `_log_llm_perf` if added); block comments to label the
  major sections (config build / stream loop / terminal). No narration of obvious mechanics.
- `# noqa: BLE001` on the broad `except Exception` (matches existing style at `agent.py:430,633`).

### Project Structure Notes

- Single-file change: `apps/story-generator-backend/src/story_generator/agent.py`. No new modules,
  no signature change to `generate()` or `_generate_proposal()`, no `main.py` change, no fixture
  change. This is deliberately the smallest possible seam ahead of se3-2/se3-3.
- ADK stays deferred (epic scope note) — `_stream_llm` is plain-Python; do not import `google-adk`.

### References

- [Source: `_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`] — Story se3-1,
  ACs; Design Decision "Extract the shared LLM streamer first"; Current-State Reference table
  (JSON stream loop `agent.py:366-447`, proposal loop `agent.py:571-646`).
- [Source: `apps/story-generator-backend/src/story_generator/agent.py:366-447`] — JSON stream loop.
- [Source: `apps/story-generator-backend/src/story_generator/agent.py:571-646`] — proposal stream loop.
- [Source: `apps/story-generator-backend/tests/test_agent.py`] — regression net (streaming, timeout,
  thought, cancel, Path-B phase-1/phase-2).
- [Source: `_bmad-output/project-context.md` §Comments] — docstring + block-comment style.

## What does NOT belong in this story

- **No new prompts** — `build_japanese_production_prompt` (se3-2) and
  `build_japanese_analysis_prompt` (se3-3) are separate stories.
- **No two-stage orchestration, no `path_mode="C"`, no `chapter="unspecified"`** — that is se3-4.
- **No signature or wire changes** — `generate()`, `_generate_proposal()`, and `main.py` query
  params are untouched.
- **No ADK adoption** — deferred for the whole epic.
- **No test-assertion changes** — the existing tests are the regression net; they must pass as-is.

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- Baseline (pre-change): `pytest tests/test_agent.py` → 32 passed.
- Post-refactor: `pytest tests/` → **65 passed** (agent + enrichment + validator + contract), exit 0,
  no test-assertion edits. Runtime ~125s is dominated by the pre-existing
  `test_streaming_timeout_yields_error` case (its slow mock chunk is not independently bounded — the
  wall-clock deadline is only re-checked at the top of each `async for` iteration; behaviour preserved).

### Completion Notes List

- Extracted one `_stream_llm(self, *, contents, json_output, activity, temperature, cancel_event,
  run_id)` async generator that owns the config build (`response_mime_type` toggled by `json_output`),
  the monotonic deadline + initial `asyncio.wait_for`, the mid-stream deadline/cancel checks, the
  candidates→content→parts thought walk with `AGENT_STATUS` emission, and the `llm_perf` log line.
- Added a small `_log_llm_perf(activity, run_id, t0, response_chars, status)` helper to collapse the
  third copy of the `_perf_logger.info("", extra={...})` block (ok/timeout/error now share one shape).
- Terminal control-dict protocol: helper yields pass-through `AGENT_STATUS` dicts then exactly one of
  `{"__stream__": "ok"|"timeout"|"error"|"cancelled", ...}`. Both callers (JSON path in `generate()`
  and `_generate_proposal()`) forward `AGENT_STATUS`, `break` on `"__stream__"`, and map the terminal
  to the identical AG-UI events emitted before (TIMEOUT / GENERATION_FAILED / RUN_CANCELLED / proceed).
- Preserved behaviour deliberately: the empty-output guard stays in each caller (so a `None`-text
  stream still yields `GENERATION_FAILED`); `getattr(part, "text", None) or ""` retained for None-text
  parts; a belt-and-suspenders post-"ok" cancel check is kept in both callers to cover a cancel that
  arrives exactly as the stream completes (mirrors the old post-stream cancel guard).
- Minor, non-tested perf-logging shifts documented in the story Dev Notes (helper now owns the "ok"
  line, so an empty-but-non-timeout stream logs `status="ok", chars=0`; proposal "ok" logs unstripped
  length). No test asserts on `_perf_logger`.
- Pure single-file refactor: no signature changes, no `main.py` change, no fixture/test edits, no new
  dependencies, ADK untouched. `python -m ast` syntax check clean; grep confirms no orphaned
  `raw_json_parts` / `proposal_parts` / `elapsed_ms` / duplicate `config` in the callers.

### File List

- `apps/story-generator-backend/src/story_generator/agent.py` — MODIFIED (add `_log_llm_perf` +
  `_stream_llm`; refactor the JSON path in `generate()` and `_generate_proposal()` to consume the
  shared streamer; remove duplicated streaming/deadline/cancel/perf boilerplate)

### Change Log

- 2026-07-12: Extracted shared `_stream_llm` streamer (+ `_log_llm_perf`) and refactored both the
  JSON generation path and the proposal path to consume it via a terminal control-dict protocol.
  No behavioural change; full backend suite 65/65 green with no test edits.
- 2026-07-12: Addressed code review findings — 2 patches resolved (config construction moved back
  inside the `try` for graceful error handling; `if raw:` guard on the "ok" perf line). Agent suite
  32/32 green after fixes.

### Review Findings

_Adversarial code review 2026-07-12 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance
Auditor: all 7 ACs and the scope fence pass with zero violations._

- [x] [Review][Patch] Import + `GenerateContentConfig(...)` construction moved *outside* the `try` in
  `_stream_llm`, losing the graceful-error path — a `google.genai` import failure or bad config now
  escapes unhandled and aborts the SSE stream with no `ERROR` event (old code caught it →
  `GENERATION_FAILED`) [agent.py:_stream_llm] — **fixed**: moved import + config construction back
  inside the `try`.
- [x] [Review][Patch] `_stream_llm` emits a `status="ok"` llm_perf line for empty/safety-filtered
  output *before* the caller turns it into `GENERATION_FAILED`, so a failed generation is double-logged
  as both success and failure (old code returned before the "ok" log). Restore old behaviour with an
  `if raw:` guard on the "ok" perf line [agent.py:_stream_llm] — **fixed**: guarded the "ok" perf line
  with `if raw:`.
- [x] [Review][Defer] `_stream_llm` logs `status="ok"` for a cancel landing in the narrow window at
  stream completion (before the caller's post-loop cancel check) [agent.py:_stream_llm] — deferred,
  observability-only, negligible window
- [x] [Review][Defer] Underlying `chunks` async stream is not `aclose()`d on timeout/mid-stream cancel;
  reclaimed only by GC [agent.py:_stream_llm] — deferred, pre-existing pattern carried verbatim from
  both original loops
- Dismissed (1): callers read `ev["text"]` on fall-through rather than an explicit `outcome == "ok"`
  guard — no current defect (only the "ok" terminal carries `text`); speculative future-proofing.
