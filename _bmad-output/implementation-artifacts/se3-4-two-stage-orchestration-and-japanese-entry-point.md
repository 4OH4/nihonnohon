# Story se3.4: Two-Stage Orchestration and Japanese Entry Point (backend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **story author**,
I want `generate()` to run **Stage 1 (produce Japanese)** then **Stage 2 (analyse Japanese)** —
skipping Stage 1 for a pasted, finished Japanese story — and to accept **`path_mode="C"`** with an
**optional target difficulty** (`chapter="unspecified"`),
so that a finished Japanese story can be enriched and formatted, and English/Japanese full-story
inputs can opt out of Genki-chapter simplification.

## Context

This is the **integration story of supp-epic-3** (Staged Generation Pipeline). The two prompt
builders it wires together already exist and are unit-tested:

- **se3-1** extracted the shared streamer `_stream_llm`
  ([`agent.py:518-612`](../../apps/story-generator-backend/src/story_generator/agent.py#L518-L612)).
- **se3-2** added the Stage-1 producer `build_japanese_production_prompt`
  ([`agent.py:165-255`](../../apps/story-generator-backend/src/story_generator/agent.py#L165-L255)).
- **se3-3** added the Stage-2 analyser `build_japanese_analysis_prompt`
  ([`agent.py:263-348`](../../apps/story-generator-backend/src/story_generator/agent.py#L263-L348)).

**This story does the wiring.** It rewrites the body of `generate()`
([`agent.py:614-804`](../../apps/story-generator-backend/src/story_generator/agent.py#L614-L804)) to
call the two new prompts in sequence instead of the single fused `build_system_prompt`, adds the
`path_mode="C"` branch and the `chapter="unspecified"` sentinel, and sets the `difficulty` label
conditionally. The `(segments, story_meta) → build_enriched_story → validate → RUN_FINISHED` seam
([`agent.py:754-804`](../../apps/story-generator-backend/src/story_generator/agent.py#L754-L804)) is
**unchanged**; Stage 3 (deterministic enrichment) and the v2 wire format are **untouched**.

> **This is NOT a purely additive story.** Wiring in two stages **removes the fused
> `build_system_prompt` from the `generate()` call path**, which means several **existing** Path A /
> Path B-phase-2 tests break and must be updated (they feed one canned response and assert on one
> captured prompt — see "The regression the dev MUST handle" below). This is the single biggest risk
> in the story. Read that section before writing code.

Full epic:
[`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(§"New pipeline (two ordered calls, shared analysis)"; §"Target-difficulty reframing"; §"Routing and
call counts"; §"Parameter model: `path_mode="C"` + `chapter="unspecified"` sentinel"; Story se3-4).

### The routing matrix `generate()` must implement (from the epic)

| `path_mode` | target (`chapter`) | `source_is_japanese` | Stage 1 | Stage 2 | `difficulty` | Gemini calls |
|---|---|---|---|---|---|---|
| **A** English story | `Genki I Ch.N` | `False` | translate EN→JA(Ch.N) | analyse vs Ch.1..N | `Genki I Ch.N` | 2 |
| **A** English story | `unspecified` | `False` | translate EN→JA natural | analyse vs **full** set | `Unspecified` | 2 |
| **B** phase 2 (draft) | `Genki I Ch.N` | `False` | translate EN→JA(Ch.N) | analyse vs Ch.1..N | `Genki I Ch.N` | 2 |
| **C** Japanese story | `Genki I Ch.N` | `True` | **simplify** JA→JA(Ch.N) | analyse vs Ch.1..N | `Genki I Ch.N` | 2 |
| **C** Japanese story | `unspecified` (frozen) | `True` | **SKIPPED** | analyse **pasted JA** vs full | `Unspecified` | **1** |

Path B phase 1 (topic→English, `_generate_proposal`) is **unchanged** and still runs before any of
this. "Unspecified" is only offered for full-story inputs (A and C); B is out of scope here (its
frontend gating is se3-5).

## Acceptance Criteria

1. **AC1 — `target_chapter` derived by guarding the sentinel before `_parse_chapter`**
   In `generate()`, after `RUN_STARTED` + early-cancel
   ([`agent.py:636-641`](../../apps/story-generator-backend/src/story_generator/agent.py#L636-L641))
   and the unchanged Path-B-phase-1 branch
   ([`agent.py:644-656`](../../apps/story-generator-backend/src/story_generator/agent.py#L644-L656)),
   `target_chapter: int | None` is computed as: **if `chapter == "unspecified"` → `None`**, else
   `_parse_chapter(chapter)` (keep the existing `try/except ValueError → ERROR GENERATION_FAILED`
   wrapper at [`agent.py:678-682`](../../apps/story-generator-backend/src/story_generator/agent.py#L678-L682)).
   The sentinel comparison is exact-string (`chapter == "unspecified"`); a real chapter string parses
   exactly as today.

2. **AC2 — Path C + Unspecified skips Stage 1 (frozen Japanese)**
   When `path_mode == "C"` **and** `target_chapter is None`, **Stage 1 is not called**;
   `japanese_text = input_text` (the pasted Japanese) is passed straight to Stage 2. Exactly **one**
   Gemini call is made (Stage 2 only). The Stage-2 analysis prompt embeds the pasted Japanese
   verbatim, so the finished story's per-sentence `japanese` reproduces the pasted input
   character-for-character (guaranteed downstream by the se3-3 echo prompt + the enrichment
   join-invariant, not by `generate()`).

3. **AC3 — Path C + target runs Stage 1 as JA→JA simplification**
   When `path_mode == "C"` **and** `target_chapter` is set, Stage 1 calls
   `build_japanese_production_prompt(self._vocab_data, self._grammar_data, source=input_text,
   source_is_japanese=True, target_chapter=target_chapter, steering_instructions=...)` (simplify),
   then Stage 2 analyses Stage 1's Japanese output. Two Gemini calls.

4. **AC4 — Paths A and B-phase-2 run Stage 1 as EN→JA translation**
   For `path_mode` in {A, B-phase-2}, the source is resolved exactly as today —
   `source_text = english_draft if (path_mode == "B" and english_draft) else input_text`
   ([`agent.py:660`](../../apps/story-generator-backend/src/story_generator/agent.py#L660)) — and Stage 1
   calls `build_japanese_production_prompt(..., source=source_text, source_is_japanese=False,
   target_chapter=target_chapter, ...)` (translate; natural when `target_chapter is None`,
   constrained to Ch.1..N when set). Stage 2 then analyses the result. Two Gemini calls.

5. **AC5 — Stage failure short-circuits (Stage-1 failure never reaches Stage 2)**
   Each stage's `_stream_llm` terminal outcome is mapped exactly as today: `timeout → ERROR TIMEOUT`,
   `error → ERROR GENERATION_FAILED`, `cancelled → RUN_CANCELLED`, plus the empty-output guard
   (`raw == "" → ERROR GENERATION_FAILED`) and the JSON-parse guard
   (`JSONDecodeError → ERROR GENERATION_FAILED`). **A Stage-1 failure emits its error/cancel event and
   `return`s immediately — Stage 2 is not invoked.** A Stage-2 failure behaves exactly as the fused
   path does today. Both stages forward pass-through `AGENT_STATUS` (thought) events via `_stream_llm`.

6. **AC6 — Stage 1 output is parsed as `{"japanese": "..."}`**
   Stage 1 runs with `json_output=True`; its accumulated text is `json.loads`-parsed and
   `japanese_text = parsed.get("japanese", "")` is extracted. A missing/empty `japanese` value is a
   Stage-1 failure → `ERROR GENERATION_FAILED` (do **not** proceed to Stage 2). (The Stage-1 prompt
   returns minimal JSON `{"japanese": "<full story text>"}` — se3-2,
   [`agent.py:250-252`](../../apps/story-generator-backend/src/story_generator/agent.py#L250-L252).)

7. **AC7 — Seam preserved; `difficulty` label is conditional**
   On a successful Stage 2, `segments = raw.get("sentences") or []` and
   `story_meta = {k: v for k, v in raw.items() if k != "sentences"}` are built exactly as today
   ([`agent.py:754-755`](../../apps/story-generator-backend/src/story_generator/agent.py#L754-L755)),
   then passed **unchanged** to `pipeline.build_enriched_story(segments, story_meta)`
   ([`agent.py:771`](../../apps/story-generator-backend/src/story_generator/agent.py#L771)) → `validate`
   ([`agent.py:782`](../../apps/story-generator-backend/src/story_generator/agent.py#L782)) →
   `TEXT_MESSAGE_CHUNK` + `RUN_FINISHED(resultType="story")`. The **only** change to the seam is:
   `story_meta["difficulty"] = f"Genki I Ch.{target_chapter}"` when `target_chapter` is set, and
   `"Unspecified"` when `target_chapter is None`.

8. **AC8 — Empty-source guard still fires before any Gemini call**
   The resolved source (English/draft for A/B2, Japanese `input_text` for C) is checked with
   `.strip()` and, if blank, an `ERROR` with code `GENERATION_FAILED` is emitted **before any Gemini
   call** (preserve the guard at
   [`agent.py:669-675`](../../apps/story-generator-backend/src/story_generator/agent.py#L669-L675); its
   message may be generalised to mention Path C). This must hold for the frozen Path-C case too (blank
   pasted Japanese → error, zero Gemini calls).

9. **AC9 — `main.py` accepts `pathMode=C` and `chapter=unspecified` with no new query param**
   `GET /run_sse` accepts `pathMode=C` and/or `chapter=unspecified` and passes them through to
   `agent.generate(...)` unchanged. **Verify no `main.py` change is required** for `/run_sse`:
   `path_mode` and `chapter` are already free-form `str` query params
   ([`main.py:178,177`](../../apps/story-generator-backend/src/story_generator/main.py#L177-L178)) and
   `/run_sse` does **not** call `_parse_chapter` at the HTTP layer (only the unrelated
   `_generate_topic_suggestion` does — [`main.py:256-258`](../../apps/story-generator-backend/src/story_generator/main.py#L256-L258)).
   If, after inspection, no code change is needed, record that explicitly in the completion notes
   rather than inventing one.

10. **AC10 — The fused `build_system_prompt` is removed from the `generate()` call path**
    `generate()` no longer calls `build_system_prompt`. Because that function is then dead, **delete
    `build_system_prompt`** ([`agent.py:78-157`](../../apps/story-generator-backend/src/story_generator/agent.py#L78-L157))
    **and its three obsolete tests** (`test_system_prompt_includes_cumulative_vocab_up_to_chapter`,
    `test_system_prompt_has_simplified_format`, `test_system_prompt_includes_grammar_for_chapter` —
    [`tests/test_agent.py:167-253`](../../apps/story-generator-backend/tests/test_agent.py#L167-L253)).
    Their coverage is subsumed by se3-2's `test_production_prompt_*` and se3-3's `test_analysis_prompt_*`,
    which test the two replacement prompts directly. Do **not** delete the shared helpers
    `_cumulative_vocab_block`, `_cumulative_grammar_block`, `_GRAMMAR_DIST_HINTS`, or
    `_WORD_SEGMENTATION_RULES` — the two stage prompts still use them
    (`_GRAMMAR_DIST_HINTS` becomes unused → see AC13).

11. **AC11 — New two-stage orchestration tests**
    New tests in `tests/test_agent.py` cover, using the injection seam (no `GEMINI_API_KEY`):
    - **two-stage ordering** for A / B-phase-2 / C-with-target: Stage 1 is called then Stage 2 (two
      Gemini calls); the first captured prompt is the production prompt, the second is the analysis
      prompt; `RUN_FINISHED(resultType="story")`;
    - **Stage-1 failure short-circuits Stage 2**: a Stage-1 error/timeout emits the mapped ERROR and
      Stage 2 is **never called** (exactly one Gemini call);
    - **C-frozen**: `path_mode="C"`, `chapter="unspecified"` → **exactly one** Gemini call (Stage 1
      skipped), that call's prompt is the analysis prompt and embeds the pasted Japanese verbatim,
      `RUN_FINISHED(resultType="story")`;
    - **C-with-target**: `path_mode="C"`, `chapter="Genki I Ch.6"` → Stage 1 prompt says "simplify"
      (JA source), two calls, story finishes;
    - **A-unspecified**: `path_mode="A"`, `chapter="unspecified"` → the Stage-1 production prompt
      contains **no** `"beyond Chapter"` / `"Vocabulary available"` constraint (natural translation);
    - **empty-JA guard**: `path_mode="C"`, blank `input_text` → `ERROR GENERATION_FAILED`, zero
      Gemini calls;
    - **difficulty label**: `"Unspecified"` when no target, `f"Genki I Ch.{n}"` when set — asserted by
      capturing `story_meta` in the mock pipeline (see Dev Notes → "Asserting `difficulty` and the
      seam").

12. **AC12 — Existing regression tests updated to the two-stage shape, all green**
    Every existing Path A / Path B-phase-2 test that drives `generate()` to `RUN_FINISHED` is updated
    to supply a **two-response** stream (Stage-1 `{"japanese": "..."}` then Stage-2 seam JSON) and its
    prompt assertions retargeted (Stage-1 prompt = `captured[0]`, Stage-2 prompt = `captured[1]`), or
    retired per AC10. `pytest tests/` is fully green. Path B **phase 1** tests, `_stream_llm` streaming
    /timeout/thought/cancel tests, `_parse_chapter`, `enrichment`, `validator`, and `main.py`
    suggest-topic tests remain **unchanged** and pass.

13. **AC13 — `grammar_distribution` / `target_word_count` behaviour is consciously reconciled**
    The fused prompt consumed `grammar_distribution` (via `_GRAMMAR_DIST_HINTS`); neither Stage-1 nor
    Stage-2 prompt takes it. **Keep `generate()`'s `grammar_distribution` and `target_word_count`
    parameters** (wire compatibility — `main.py` still passes them, and `target_word_count` is used by
    Path B phase 1). Do **not** invent new plumbing for `grammar_distribution` into the stage prompts
    in this story; it is simply unused on the produce/analyse paths now. Note this explicitly in the
    completion notes so it is a recorded decision, not an accidental drop.

14. **AC14 — Scope fence: no new modules, no schema/enrichment change, ADK deferred**
    Changes are confined to `agent.py` (rewrite `generate()`, delete `build_system_prompt`) and
    `tests/test_agent.py` (+ possibly `main.py` if AC9 finds a genuine gap). No change to
    `enrichment.py`, `validator.py`, the v2 wire format, `_stream_llm`,
    `build_japanese_production_prompt`, or `build_japanese_analysis_prompt`. No `google-adk` import
    (ADK stays deferred for the whole epic). No frontend change (that is se3-5).

## Tasks / Subtasks

- [x] **Task 1: Derive `target_chapter` with the `"unspecified"` sentinel** (AC: 1)
  - [x] In `generate()`, after the Path-B-phase-1 branch, compute `target_chapter: int | None`:
        `None` when `chapter == "unspecified"`, else `_parse_chapter(chapter)` inside the existing
        `try/except ValueError → ERROR GENERATION_FAILED` block. Remove the now-misleading
        `chapter_int` name in favour of `target_chapter`.
  - [x] Keep the empty-source guard **before** this (it must fire with zero Gemini calls) — decide
        ordering so both AC1 and AC8 hold (empty-source check, then sentinel/parse, is fine).

- [x] **Task 2: Resolve the source and the `source_is_japanese` flag per path** (AC: 2, 3, 4)
  - [x] `source_text = english_draft if (path_mode == "B" and english_draft) else input_text` (keep
        the existing expression — it already yields `input_text` for Path C).
  - [x] `source_is_japanese = (path_mode == "C")`.
  - [x] Determine the Stage-1-skip condition: `skip_stage1 = (path_mode == "C" and target_chapter is None)`.
  - [x] Update the log line to name Path C and the target (or `Unspecified`).

- [x] **Task 3: Extract a private JSON-stage helper (recommended) and run Stage 1** (AC: 5, 6)
  - [x] Added the private async generator `_run_json_stage` wrapping `_stream_llm`: yields pass-through
        `AGENT_STATUS`, maps terminal outcomes to `ERROR`/`RUN_CANCELLED`, guards empty output + the
        cancel-on-completion re-check, `json.loads` the text, and yields one terminal control dict
        `{"__stage__": "ok", "data": <dict>}` or the error event + `{"__stage__": "failed"}`.
  - [x] Stage 1 (unless `skip_stage1`): builds `build_japanese_production_prompt(...)` and runs it
        through the helper (`activity="Convert to Japanese"`); failure terminal → `return`
        (short-circuit); success → `japanese_text = data.get("japanese", "")`, blank → `ERROR
        GENERATION_FAILED` + `return`.
  - [x] When `skip_stage1`: `japanese_text = input_text` (no Gemini call).

- [x] **Task 4: Run Stage 2 and preserve the seam** (AC: 5, 7)
  - [x] Builds `build_japanese_analysis_prompt(...)` and runs it through the helper
        (`activity="Analyse Japanese"`); failure terminal → `return`.
  - [x] Builds `segments` / `story_meta` from the parsed Stage-2 dict exactly as before.
  - [x] Sets `story_meta["difficulty"] = f"Genki I Ch.{target_chapter}"` if `target_chapter is not
        None` else `"Unspecified"`.
  - [x] Enrichment-pipeline guard, `build_enriched_story`, `validate`, `TEXT_MESSAGE_CHUNK`, and
        `RUN_FINISHED` blocks left unchanged.
  - [x] The "cancel arrived exactly as the stream completed" re-check is folded into `_run_json_stage`
        (runs after each stage).

- [x] **Task 5: Delete the fused prompt and its obsolete tests** (AC: 10)
  - [x] Deleted `build_system_prompt`.
  - [x] Deleted the three `test_system_prompt_*` tests (replaced with a one-line note).
  - [x] `_cumulative_vocab_block`, `_cumulative_grammar_block`, `_WORD_SEGMENTATION_RULES` remain (still
        used by the stage prompts). `_GRAMMAR_DIST_HINTS` was unused after the deletion and was removed;
        its doc comment updated. `grep` confirms no stragglers.

- [x] **Task 6: `main.py` verification** (AC: 9)
  - [x] Inspected `/run_sse`: `pathMode`/`chapter` are already free-form `str` query params passed
        straight to `agent.generate(...)`; no HTTP-layer `_parse_chapter`. **No change required.**

- [x] **Task 7: Tests — new two-stage coverage + regression updates** (AC: 11, 12, 13)
  - [x] Added `make_sequenced_stream_client([...])` (queued per-call responses + prompt capture, asserts
        on over-call) and `RecordingEnrichmentPipeline` (records the seam inputs).
  - [x] Added the new tests under a `# Two-stage orchestration (se3-4)` banner.
  - [x] Updated every existing Path A / Path B-phase-2 finish-to-`RUN_FINISHED` test to a two-response
        sequence.
  - [x] `pytest tests/` → **84 passed** (~2 min due to the pre-existing timeout test).

## Dev Notes

### Current `generate()` shape you are rewriting (verified line anchors)

The body from
[`agent.py:658-804`](../../apps/story-generator-backend/src/story_generator/agent.py#L658-L804) is one
fused call today. Preserve the **prologue** (RUN_STARTED `:636`, early cancel `:639`, Path-B-phase-1
dispatch `:644`) and the **epilogue** (pipeline guard `:759`, enrich `:771`, validate `:782`, finish
`:800`) — only the middle (source guard → parse → fused prompt → single stream → seam-difficulty)
becomes the two-stage flow. The `_parse_chapter` helper
([`agent.py:393-398`](../../apps/story-generator-backend/src/story_generator/agent.py#L393-L398)) is
reused as-is; only its **caller** changes (guard the sentinel first).

### Recommended `_run_json_stage` helper (prevents triplicated boilerplate)

Both stages need: forward `AGENT_STATUS` events → map `_stream_llm`'s terminal dict to
`ERROR`/`RUN_CANCELLED` → guard empty output → `json.loads`. That is exactly the block at
[`agent.py:696-751`](../../apps/story-generator-backend/src/story_generator/agent.py#L696-L751) today.
Extract it once so Stage 1 and Stage 2 share it (the proposal path stays plain-text and keeps its own
handling). Suggested signature and terminal protocol (match the se3-1 `__stream__` idiom):

```python
async def _run_json_stage(
    self, *, prompt: str, activity: str, temperature: float,
    cancel_event, run_id: str,
):
    """Run one JSON Gemini stage via _stream_llm.

    Yields pass-through AGENT_STATUS dicts, then on failure yields the mapped
    ERROR/RUN_CANCELLED event followed by {"__stage__": "failed"}; on success
    yields exactly {"__stage__": "ok", "data": <parsed dict>}.
    Callers forward AGENT_STATUS, break on the __stage__ dict, and `return`
    immediately when it is "failed".
    """
    raw = ""
    async for ev in self._stream_llm(
        contents=prompt, json_output=True, activity=activity,
        temperature=temperature, cancel_event=cancel_event, run_id=run_id,
    ):
        if "__stream__" not in ev:
            yield ev            # pass-through AGENT_STATUS
            continue
        outcome = ev["__stream__"]
        if outcome == "timeout":
            yield {"type": "ERROR", "code": "TIMEOUT",
                   "message": "This took longer than expected — your inputs are preserved. Try again."}
            yield {"__stage__": "failed"}; return
        if outcome == "error":
            yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": ev["message"]}
            yield {"__stage__": "failed"}; return
        if outcome == "cancelled":
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            yield {"__stage__": "failed"}; return
        raw = ev["text"]; break
    # cancel that landed exactly as the stream completed
    if cancel_event and cancel_event.is_set():
        yield {"type": "RUN_CANCELLED", "runId": run_id}
        yield {"__stage__": "failed"}; return
    if not raw:
        yield {"type": "ERROR", "code": "GENERATION_FAILED",
               "message": "Gemini returned no content. Check safety filters or prompt length."}
        yield {"__stage__": "failed"}; return
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": f"Response is not valid JSON: {exc}"}
        yield {"__stage__": "failed"}; return
    yield {"__stage__": "ok", "data": data}
```

Then `generate()` calls it twice. Caller idiom:

```python
# --- Stage 1: produce Japanese (skipped for frozen Path C) ---
if skip_stage1:
    japanese_text = input_text
else:
    prod_prompt = build_japanese_production_prompt(
        self._vocab_data, self._grammar_data, source=source_text,
        source_is_japanese=source_is_japanese, target_chapter=target_chapter,
        steering_instructions=steering_instructions,
    )
    stage1_data = None
    async for ev in self._run_json_stage(prompt=prod_prompt, activity="Convert to Japanese",
                                         temperature=temperature, cancel_event=cancel_event, run_id=run_id):
        if "__stage__" not in ev:
            yield ev; continue
        if ev["__stage__"] == "failed":
            return                     # AC5: short-circuit — Stage 2 never runs
        stage1_data = ev["data"]; break
    japanese_text = (stage1_data or {}).get("japanese", "")
    if not japanese_text.strip():
        yield {"type": "ERROR", "code": "GENERATION_FAILED",
               "message": "Stage 1 produced no Japanese text."}
        return

# --- Stage 2: analyse Japanese ---
ana_prompt = build_japanese_analysis_prompt(
    self._grammar_data, japanese_text, target_chapter=target_chapter,
    steering_instructions=steering_instructions,
)
raw_response = None
async for ev in self._run_json_stage(prompt=ana_prompt, activity="Analyse Japanese",
                                     temperature=temperature, cancel_event=cancel_event, run_id=run_id):
    if "__stage__" not in ev:
        yield ev; continue
    if ev["__stage__"] == "failed":
        return
    raw_response = ev["data"]; break

segments = raw_response.get("sentences") or []
story_meta = {k: v for k, v in raw_response.items() if k != "sentences"}
story_meta["difficulty"] = f"Genki I Ch.{target_chapter}" if target_chapter is not None else "Unspecified"
# ...unchanged pipeline guard / build_enriched_story / validate / RUN_FINISHED...
```

> This helper is a **suggested** structure, not a mandated AC. If you keep the two blocks inline
> instead, you must still satisfy AC5 (Stage-1 failure returns before Stage 2) and forward
> `AGENT_STATUS` from both stages. Do **not** modify `_stream_llm` (AC14) — build on top of it.

### The regression the dev MUST handle (this is where stories usually fail)

`make_mock_stream_client(text)`
([`tests/test_agent.py:72-84`](../../apps/story-generator-backend/tests/test_agent.py#L72-L84)) returns
the **same** `text` on **every** call. Today Path A makes one call, so feeding it
`simplified_fixture_json` (the seam) works. **After this story Path A makes two calls:** Stage 1 would
receive `simplified_fixture_json`, `.get("japanese")` → `None` → Stage-1 "no Japanese" failure →
`RUN_FINISHED` never emitted → the test breaks. Every finish-to-`RUN_FINISHED` test must instead feed a
**sequence**: a Stage-1 `{"japanese": "..."}` response, then the Stage-2 seam JSON.

Add this helper (records call count + prompts, returns the i-th queued response):

```python
def make_sequenced_stream_client(responses: list[str], capture_list: list | None = None):
    """Return an async stream client that yields responses[0], responses[1], … on successive calls.

    Raises AssertionError if called more times than responses provided — so a test that expects
    exactly one call (frozen Path C, or Stage-1 short-circuit) fails loudly if Stage 2 is wrongly run.
    """
    calls = {"n": 0}
    async def _stream(model, contents, config):
        i = calls["n"]; calls["n"] += 1
        if capture_list is not None:
            capture_list.append(contents)
        assert i < len(responses), f"unexpected Gemini call #{i+1} (only {len(responses)} queued)"
        text = responses[i]
        async def _gen():
            yield make_chunk([make_part(text, thought=False)])
        return _gen()
    return _stream
```

**Existing tests to update** (feed a 2-item sequence `[STAGE1_JA, simplified_fixture_json]` and, where
they assert on a captured prompt, index `captured[0]` = Stage-1 production prompt, `captured[1]` =
Stage-2 analysis prompt):

- `test_events_emitted_in_order` (`:128`), `test_run_started_echoes_run_id` (`:151`),
  `test_path_a_unchanged_with_new_params` (`:825`), `test_path_b_phase2_emits_story` (`:765`)
  — swap to a 2-response sequence.
- `test_agent_status_emitted_for_thought_chunks` (`:558`), `test_no_agent_status_when_no_thoughts`
  (`:584`), `test_empty_thought_text_not_emitted` (`:599`), `test_none_candidates_chunks_skipped`
  (`:620`) — these craft custom streams; make the custom stream return the Stage-1 JSON on call 1 and
  the seam on call 2 (or set the thought part on Stage 1 and the seam on Stage 2 — pick whichever keeps
  the assertion meaningful; the AGENT_STATUS-ordering assertion still holds as long as a thought is
  emitted before the first `TEXT_MESSAGE_CHUNK`).
- `test_streaming_timeout_yields_error` (`:641`) — the slow stream fires on the **first** call
  (Stage 1); still yields `TIMEOUT`. Fine as-is if it only needs one call to time out; verify it does
  not require a Stage-2 response.
- `test_validation_failure_emits_error_not_finished` (`:459`),
  `test_path_b_phase2_validation_failure_emits_error` (`:792`) — need a valid Stage-1 `{"japanese"}`
  then a Stage-2 seam whose enrichment yields the bad story; the `MockEnrichmentPipeline` still returns
  the injected bad story, so feed `[STAGE1_JA, simplified_fixture_json]`.
- `test_invalid_json_response_emits_error` (`:495`), `test_none_response_emits_error` (`:512`) — these
  make **one** call and assert `GENERATION_FAILED`. With two stages the failure now happens at
  **Stage 1** (call 1), which is still `GENERATION_FAILED` — so a single-response client that returns
  the bad payload on call 1 keeps them green (Stage 2 never runs). Confirm the code short-circuits.
- `test_cancel_before_gemini_call` (`:532`) — pre-set cancel, zero Gemini calls; unaffected.
- **Delete** `test_system_prompt_includes_cumulative_vocab_up_to_chapter`,
  `test_system_prompt_has_simplified_format`, `test_system_prompt_includes_grammar_for_chapter`
  (`:167-253`) per AC10 — their subject (`build_system_prompt`) is gone; se3-2/se3-3 unit tests cover
  the replacements. If you want to keep an end-to-end "the right prompt reached Gemini" assertion,
  fold it into the new two-stage-ordering test (assert `"Vocabulary available"`/`beyond Chapter` in
  `captured[0]` and `"particles"`/`'"words"'` in `captured[1]`).

`STAGE1_JA` can be any minimal valid JSON string, e.g.
`'{"japanese": "けんじさんはとうきょうのだいがく一年生です。"}'`.

### Asserting `difficulty` and the seam (AC7, AC11)

`MockEnrichmentPipeline.build_enriched_story(segments, story_meta)`
([`tests/test_agent.py:29-31`](../../apps/story-generator-backend/tests/test_agent.py#L29-L31)) ignores
its args and returns a canned story. To assert the `difficulty` label and the segments passed to the
seam, extend the mock to **record** its inputs:

```python
class RecordingEnrichmentPipeline(MockEnrichmentPipeline):
    def build_enriched_story(self, segments, story_meta):
        self.last_segments = segments
        self.last_story_meta = story_meta
        return self._story
```

Then assert `pipeline.last_story_meta["difficulty"] == "Unspecified"` (or `"Genki I Ch.6"`). This is
the correct seam to check — `generate()` sets `difficulty`, then hands `(segments, story_meta)` to the
pipeline verbatim.

### `source_is_japanese` and the routing — the one-line facts

- `source_is_japanese = (path_mode == "C")` — only Path C feeds Japanese into Stage 1.
- `skip_stage1 = (path_mode == "C" and target_chapter is None)` — the **only** frozen case.
- `source_text` keeps the existing expression; it already equals `input_text` for Path C (no
  `english_draft`), so no special-casing is needed for C's source.
- Path B **phase 1** (`path_mode == "B" and topic`) returns before any of this — do not touch it.

### Behavioural nuances / gotchas

- **Guard order (AC1 vs AC8):** the empty-source guard must run with **zero** Gemini calls; the
  sentinel/parse must produce `None` for `"unspecified"` (not raise). Put the empty-source check
  before the chapter derivation, or ensure both run before Stage 1 — either order satisfies both ACs.
  Do **not** route `"unspecified"` into `_parse_chapter` (it would raise `ValueError` and wrongly emit
  `GENERATION_FAILED`).
- **`target_chapter <= 0`:** se3-3 deferred lower-bound handling to this story. `_parse_chapter`
  already rejects non-numeric via `ValueError`; a caller passing `Ch.0`/negatives is not a real UI
  path (frontend offers Ch.1..N or Unspecified — se3-5). No extra lower-bound guard is required here,
  but do not pass `0` as a "no target" signal — **`None` is the only no-target sentinel** (`0` would
  make `_cumulative_grammar_block` emit `(none)`; see se3-3 review note).
- **Frozen `japanese` fidelity is the prompt's job, not `generate()`'s.** `generate()` only forwards
  `input_text` to Stage 2; the "character-for-character" guarantee comes from the se3-3 echo prompt +
  the enrichment join-invariant ([`enrichment.py:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L366-L374)).
  Your unit test asserts **Stage 1 was skipped** (one call) and the analysis prompt embeds the pasted
  text — not byte-equality of the final story (the mock pipeline returns a canned story).
- **Two calls share the wall-clock budget.** `_stream_llm` applies `generation_timeout_s` to **each**
  stage independently (it starts a fresh deadline per call). That matches the epic's note; no change
  needed, but be aware a test with `generation_timeout_s=0.01` will fail at Stage 1.
- **`activity` labels** feed the `llm_perf` log only (not user-facing). Use distinct labels
  ("Convert to Japanese", "Analyse Japanese") so the two calls are separable in perf logs.
- **AGENT_STATUS ordering (all-paths contract):** thought events from both stages must be forwarded
  and must precede the final `TEXT_MESSAGE_CHUNK`. The helper forwards them; keep it that way.

### Code style (project-context.md §Comments; se3-1/se3-2/se3-3 precedent)

- `from __future__ import annotations` is already present
  ([`agent.py:2`](../../apps/story-generator-backend/src/story_generator/agent.py#L2)) — keep `int | None`
  hints.
- Succinct docstring on any new helper; block comments labelling the major sections of the rewritten
  `generate()` (target-chapter derivation / source resolution / Stage 1 / Stage 2 / seam). Do not
  narrate obvious mechanics.
- Match the existing f-string / event-dict idioms; reuse the exact ERROR/RUN_CANCELLED shapes already
  in the file so downstream consumers are unaffected.

### Project Structure Notes

- Source change: **`apps/story-generator-backend/src/story_generator/agent.py`** only (rewrite
  `generate()`; add the JSON-stage helper; delete `build_system_prompt`). Possibly
  `apps/story-generator-backend/src/story_generator/main.py` **iff** AC9 finds a real gap (expected:
  none).
- Test change: **`apps/story-generator-backend/tests/test_agent.py`** (add sequenced-stream helper +
  recording pipeline + new two-stage tests; update existing Path A/B2 tests; delete the three
  `test_system_prompt_*` tests).
- No new modules, no new dependencies, no fixture change (reuse `simplified_segments.json` for the
  Stage-2 seam response, [`tests/fixtures/simplified_segments.json`](../../apps/story-generator-backend/tests/fixtures/simplified_segments.json)),
  no `enrichment.py` / `validator.py` / schema change. ADK stays deferred — no `google-adk` import.
- Runtime: `pytest` needs no `GEMINI_API_KEY` (injection seam). Run from
  `apps/story-generator-backend`. The suite takes ~2 min due to the pre-existing timeout test.

### References

- [Source: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)]
  — Story se3-4 ACs; §"New pipeline (two ordered calls)"; §"Target-difficulty reframing"; §"Routing and
  call counts"; §"Parameter model: `path_mode='C'` + `chapter='unspecified'` sentinel"; Risks
  ("two LLM calls per produced path", "chapter='unspecified' sentinel must be guarded before
  `_parse_chapter`").
- [Source: [`agent.py:614-804`](../../apps/story-generator-backend/src/story_generator/agent.py#L614-L804)]
  — the `generate()` body being rewritten: prologue `:636-656`, source `:660`, empty guard `:669-675`,
  chapter parse `:678-682`, fused prompt call `:683-690`, single stream `:696-722`, cancel re-check
  `:725-727`, empty guard `:730-737`, json.loads `:742-751`, seam `:754-756`, epilogue `:759-804`.
- [Source: [`agent.py:518-612`](../../apps/story-generator-backend/src/story_generator/agent.py#L518-L612)]
  — `_stream_llm` (se3-1): terminal `__stream__` dict protocol the JSON-stage helper wraps. Do not modify.
- [Source: [`agent.py:165-255`](../../apps/story-generator-backend/src/story_generator/agent.py#L165-L255)]
  — `build_japanese_production_prompt` (se3-2): Stage-1 signature, `source_is_japanese`/`target_chapter`
  semantics, minimal `{"japanese": ...}` output.
- [Source: [`agent.py:263-348`](../../apps/story-generator-backend/src/story_generator/agent.py#L263-L348)]
  — `build_japanese_analysis_prompt` (se3-3): Stage-2 signature; echoes JA verbatim; emits the seam.
- [Source: [`agent.py:393-398`](../../apps/story-generator-backend/src/story_generator/agent.py#L393-L398)]
  — `_parse_chapter`: reused unchanged; only its caller guards the sentinel first.
- [Source: [`agent.py:78-157`](../../apps/story-generator-backend/src/story_generator/agent.py#L78-L157)]
  — `build_system_prompt`: the fused prompt to delete (AC10).
- [Source: [`main.py:173-224`](../../apps/story-generator-backend/src/story_generator/main.py#L173-L224)]
  — `/run_sse`: `chapter`/`path_mode` are free-form `str` query params, passed straight to
  `agent.generate`; no HTTP-layer `_parse_chapter` (AC9 — verify, likely no change).
- [Source: [`enrichment.py:341`, guard `:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L341-L374)]
  — `build_enriched_story` inputs + the join-invariant (why frozen fidelity is a prompt guarantee).
- [Source: [`validator.py:23-26`](../../apps/story-generator-backend/src/story_generator/validator.py#L23-L26)]
  — required top-level fields the seam must carry (`id/title/title_ja/language/description/sentences`);
  `language`/`schema_version` are injected by enrichment, `difficulty` by `generate()`.
- [Source: [`tests/test_agent.py:23-95`](../../apps/story-generator-backend/tests/test_agent.py#L23-L95)]
  — `MockEnrichmentPipeline`, `_collect`, `make_mock_stream_client`, `make_capturing_stream_client`,
  `make_chunk`/`make_part`: the test primitives to extend (sequenced client, recording pipeline).
- [Source: [`tests/test_agent.py:167-253`](../../apps/story-generator-backend/tests/test_agent.py#L167-L253)]
  — the three `test_system_prompt_*` tests to delete (AC10).
- [Source: [`tests/test_agent.py:261-456`](../../apps/story-generator-backend/tests/test_agent.py#L261-L456)]
  — se3-2/se3-3 `test_production_prompt_*` / `test_analysis_prompt_*`: the direct prompt-builder tests
  that now cover what the deleted fused tests did.
- [Source: [`tests/fixtures/simplified_segments.json`](../../apps/story-generator-backend/tests/fixtures/simplified_segments.json)]
  — the Stage-2 seam response fixture to reuse.
- [Source: [`_bmad-output/implementation-artifacts/se3-3-stage-2-universal-japanese-analysis-prompt.md`](se3-3-stage-2-universal-japanese-analysis-prompt.md)]
  — predecessor; §"The routing matrix this prompt serves" and the deferred notes handing chapter/input
  validation to **this** story.
- [Source: `_bmad-output/project-context.md` §Comments; §Story Format] — docstring/comment style; the
  seam/schema invariants (snake_case wire, no schema logic outside loader) this story must not violate.

## What does NOT belong in this story

- **No frontend change** — the "Japanese story" tab, the "Unspecified" chapter option, the `PathMode`
  type widening, and session persistence are **se3-5**.
- **No eval-harness wiring** (`eval/run_eval.py`) — that is the optional **se3-6**.
- **No change to `build_japanese_production_prompt` or `build_japanese_analysis_prompt`** — they are
  frozen (se3-2/se3-3); this story only calls them. If a prompt seems wrong, file it, do not edit here.
- **No change to `_stream_llm`, `enrichment.py`, `validator.py`, or the v2 wire format / schema.**
- **No `google-adk` import** — ADK stays deferred for the whole epic; the `_produce`/`_analyse` seam
  is plain Python.
- **No new `simplify` boolean and no new query parameter** — the optional target rides the existing
  `chapter` field via the `"unspecified"` sentinel, and Path C rides the existing `inputText`.
- **No re-plumbing of `grammar_distribution` into the stage prompts** — it is simply unused on the
  produce/analyse paths now (AC13); keep the param for wire compatibility.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `pytest tests/test_agent.py -q` → 51 passed (~2 min).
- `pytest tests/ -q` (full backend suite) → 84 passed (~2 min). No regressions.

### Completion Notes List

- **Two-stage wiring done.** `generate()` now runs Stage 1 (`build_japanese_production_prompt`) then
  Stage 2 (`build_japanese_analysis_prompt`) via a new private helper `_run_json_stage`, which
  extracts the terminal-outcome mapping + empty guard + cancel-on-completion re-check + `json.loads`
  boilerplate so both stages share it. The `(segments, story_meta) → build_enriched_story → validate →
  RUN_FINISHED` seam is unchanged apart from the conditional `difficulty` label.
- **Routing implemented per the matrix:** `source_is_japanese = (path_mode == "C")`;
  `skip_stage1 = (path_mode == "C" and target_chapter is None)`. Frozen Path C sets
  `japanese_text = input_text` with **zero** Stage-1 Gemini calls; all other story paths make two.
- **Sentinel guarded before `_parse_chapter`** (AC1): `chapter == "unspecified"` → `target_chapter =
  None`; a real chapter string parses exactly as before. Empty-source guard runs first, so blank input
  errors with zero Gemini calls (AC8), including the frozen Path-C case.
- **AC5 short-circuit:** a Stage-1 failure (timeout/error/cancel/empty/JSON-parse) emits the mapped
  event and `return`s before Stage 2 is built — verified by `test_stage1_failure_short_circuits_stage2`
  and `test_stage1_empty_japanese_is_failure` (both assert exactly one Gemini call).
- **AC9 — no `main.py` change required.** `/run_sse` already declares `chapter` and `path_mode` as
  free-form `str` query params ([`main.py:177-178`](../../apps/story-generator-backend/src/story_generator/main.py#L177-L178))
  and passes them straight to `agent.generate(...)`; no HTTP-layer `_parse_chapter` (only the unrelated
  suggest-topic helper parses chapters). `pathMode=C` and `chapter=unspecified` flow through untouched.
- **AC10 — `build_system_prompt` deleted** along with its three `test_system_prompt_*` tests. Their
  coverage is subsumed by the se3-2 `test_production_prompt_*` and se3-3 `test_analysis_prompt_*` unit
  tests plus the new two-stage-ordering test (which asserts the production prompt reaches Gemini as
  `captured[0]` and the analysis prompt as `captured[1]`).
- **AC13 — `grammar_distribution` consciously reconciled.** `generate()` still accepts
  `grammar_distribution` and `target_word_count` for wire compatibility (`main.py` passes both;
  `target_word_count` is used by Path B phase 1). Neither stage prompt consumes `grammar_distribution`
  now, so it is simply unused on the produce/analyse paths — **no new plumbing was added**. The
  now-dead `_GRAMMAR_DIST_HINTS` table (only `build_system_prompt` used it) was removed as dead code;
  `grep` confirms no remaining references in `story_generator/` (the standalone `spike.py` keeps its
  own independent copy and is untouched).
- **Scope fence held (AC14):** changes confined to `agent.py` and `tests/test_agent.py`. No change to
  `main.py`, `enrichment.py`, `validator.py`, the v2 wire format, `_stream_llm`, or the two frozen
  stage-prompt builders. No `google-adk` import; no frontend change.

### File List

- `apps/story-generator-backend/src/story_generator/agent.py` — modified: rewrote `generate()` as the
  two-stage (produce → analyse) flow with the `"unspecified"` sentinel, `source_is_japanese`/
  `skip_stage1` routing, and the conditional `difficulty` label; added the `_run_json_stage` helper;
  deleted `build_system_prompt` and the dead `_GRAMMAR_DIST_HINTS` table; updated the shared
  `_WORD_SEGMENTATION_RULES` doc comment.
- `apps/story-generator-backend/tests/test_agent.py` — modified: added `make_sequenced_stream_client`,
  `RecordingEnrichmentPipeline`, and `STAGE1_JA`; added the `# Two-stage orchestration (se3-4)` test
  section (ordering, Stage-1 short-circuit, empty-Japanese, frozen Path C, Path C simplify, Path A
  unspecified, empty-input guard, difficulty label); updated the existing Path A / Path B-phase-2
  finish tests and the AGENT_STATUS thought tests to two-response sequences; removed the three
  `test_system_prompt_*` tests.

## Change Log

| Date | Change |
|------|--------|
| 2026-07-12 | se3-4 implemented: two-stage `generate()` orchestration + Japanese (Path C) entry point with optional target difficulty; `build_system_prompt` removed; tests updated (84 passing). Status → review. |

## Review Findings

_Code review (bmad-code-review) — 2026-07-12. Three parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. **All 14 ACs verified PASS** and the scope fence (AC14 / "What does NOT belong") held. The items below are robustness findings outside the ACs._

- [x] [Review][Patch] **FIXED (2026-07-12 re-review).** Malformed-but-valid Gemini JSON crashes the async generator with an uncaught `AttributeError` — no terminal ERROR event, so the SSE stream dies mid-flight and the client hangs [apps/story-generator-backend/src/story_generator/agent.py:731] — `{"japanese": null}` (or any non-string value) makes `(stage1_data or {}).get("japanese", "").strip()` call `.strip()` on `None`; independently, a top-level non-object from `json.loads` in `_run_json_stage` ([agent.py:597](../../apps/story-generator-backend/src/story_generator/agent.py#L597)) is passed through as `data` and escapes to `raw_response.get("sentences")`/`.items()` at [agent.py:765-766](../../apps/story-generator-backend/src/story_generator/agent.py#L765-L766). Every other failure mode here emits a clean `GENERATION_FAILED`; this one did not. **Fix applied (coordinated, additive — does not violate AC6):** added an `isinstance(data, dict)` guard in `_run_json_stage` after `json.loads` (emits `GENERATION_FAILED` + `{"__stage__": "failed"}`, closing both non-dict crash paths for Stage 1 and Stage 2 at once); guarded the extracted `japanese` value with `isinstance(..., str)` before `.strip()`; added `test_stage1_null_japanese_is_failure` (`{"japanese": null}`) and `test_stage_nondict_json_is_failure` (top-level JSON array). Full suite **86 passed** (was 84). Independently re-confirmed by a fresh 3-layer review (Blind + Edge + Auditor all converged); Auditor re-verified all 14 ACs still PASS.
- [x] [Review][Defer] Unknown `path_mode` (not A/B/C) silently treated as Path A (EN→JA) [apps/story-generator-backend/src/story_generator/agent.py:665] — deferred, pre-existing (fall-through predates this change; `pathMode` is a frontend-controlled query param; no AC requires rejection).
- [x] [Review][Defer] Non-string/`None` `chapter` bypasses the `ValueError` guard → `AttributeError` [apps/story-generator-backend/src/story_generator/agent.py:684] — deferred, pre-existing (unreachable via HTTP: `main.py` declares `chapter: str` as a required `Query` → 422 first).

_Dismissed as noise (3): `raw_response` `dict | None` deref is not reachable (the helper always yields a terminal `__stage__` event before the seam, and the container shape is covered by the patch's dict-guard); `skip_stage1` using `input_text` rather than `source_text` is spec-mandated (AC2 / Dev Notes) and equal to `source_text` for Path C; the docstring `AGENT_STATUS` listing is cosmetic (Path B2 is documented as "as Path A")._
