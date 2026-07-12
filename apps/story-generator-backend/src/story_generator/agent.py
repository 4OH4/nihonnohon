"""Story generation agent with injectable Gemini client — M1 (Path A) and M3 (Path B)."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import AsyncGenerator

from story_generator.data_loader import GrammarData, VocabData
from story_generator.validator import validate

logger = logging.getLogger(__name__)
_perf_logger = logging.getLogger("llm_perf")

GEMINI_MODEL = "gemini-2.5-flash"
THINKING_BUDGET = 16384  # thinking tokens; caps pre-generation reasoning at ~2 minutes


# ---------------------------------------------------------------------------
# Prompt construction — adapted from spike.py
# ---------------------------------------------------------------------------

#: Grammar distribution hint text keyed by the 3-position slider value
_GRAMMAR_DIST_HINTS: dict[int, str] = {
    0: "Use a limited set of grammar patterns — keep the sentence structures simple and repetitive.",
    1: "Balance the grammar patterns — use a moderate variety that fits naturally.",
    2: "Use as many grammar patterns from the list as you can, fitting them naturally into the story.",
}


def _cumulative_vocab_block(vocab_data: VocabData, chapter: int) -> str:
    """Format the cumulative Ch.1–N vocabulary list as prompt lines.

    Shared by the fused system prompt and the Stage-1 production prompt so the two
    never diverge. Output is one ``  {id} | {hiragana}{ (kanji)} | {translation}`` line
    per entry, or ``  (none)`` when the range is empty.
    """
    vocab_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for entry in vocab_data.by_chapter.get(ch, []):
            kanji_part = f" ({entry.kanji})" if entry.kanji else ""
            vocab_lines.append(f"  {entry.id} | {entry.hiragana}{kanji_part} | {entry.translation}")

    return "\n".join(vocab_lines) if vocab_lines else "  (none)"


def _cumulative_grammar_block(grammar_data: GrammarData, chapter: int) -> str:
    """Format the cumulative Ch.1–N grammar points as prompt lines.

    Shared by the fused system prompt and the Stage-1 production prompt. Output is one
    ``  [Ch{ch} {point}] {title}: {summary}`` line per point, or ``  (none)`` when empty.
    """
    grammar_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for gp in grammar_data.by_chapter.get(ch, []):
            grammar_lines.append(f"  [Ch{ch} {gp.point}] {gp.title}: {gp.summary}")

    return "\n".join(grammar_lines) if grammar_lines else "  (none)"


def build_system_prompt(
    vocab_data: VocabData,
    grammar_data: GrammarData,
    chapter: int,
    english_source: str,
    steering_instructions: str = "",
    grammar_distribution: int = 1,
) -> str:
    """Build the Gemini prompt with cumulative Ch.1–N vocab and grammar."""
    # Cumulative curriculum blocks up to this chapter
    vocab_block = _cumulative_vocab_block(vocab_data, chapter)
    grammar_block = _cumulative_grammar_block(grammar_data, chapter)

    grammar_dist_text = _GRAMMAR_DIST_HINTS.get(grammar_distribution, _GRAMMAR_DIST_HINTS[1])
    steering_block = (
        f"\n## Additional Instructions\n\n{steering_instructions.strip()}\n"
        if steering_instructions.strip()
        else ""
    )
    difficulty = f"Genki I Ch.{chapter}"

    return f"""You are a Japanese language curriculum expert generating a graded reader story for learners studying with the Genki I textbook up to Chapter {chapter}.

## Task

Adapt the English source story below into a short Japanese graded reader story. The story must be calibrated to Genki I Chapter {chapter} — use ONLY the vocabulary and grammar patterns listed below.

## English Source Story

{english_source.strip()}

## Curriculum Constraints

### Vocabulary available (cumulative Ch.1–{chapter})
Format: ID | hiragana (kanji) | English meaning
{vocab_block}

### Grammar patterns available (cumulative Ch.1–{chapter})
{grammar_block}

## Grammar Distribution

{grammar_dist_text}
{steering_block}
## Word Segmentation Rules

Split each Japanese sentence into surface word tokens following these rules:
1. Verb stems stay attached to their polite endings: 食べます is one token, 行きます is one token
2. Particles are separate tokens: は、を、に、で、へ、が、と、も、の are each a single token
3. Punctuation is separate: 。and 、are each a single token
4. Honorifics attached to names stay attached: たろうさん is one token
5. The words array joined (no spaces) must exactly equal the japanese string

## Output Format

Respond with a single JSON object matching this exact structure:

{{
  "id": "<kebab-case identifier embedding difficulty and topic, e.g. genki-i-ch{chapter}-topic>",
  "title": "<English story title>",
  "title_ja": "<Japanese story title>",
  "description": "<1-2 sentence English description of the story>",
  "grammar": ["<grammar pattern string 1>", "<grammar pattern string 2>", ...],
  "sentences": [
    {{
      "english": "<English translation of this sentence>",
      "japanese": "<full Japanese sentence with no spaces>",
      "words": ["<surface word 1>", "<surface word 2>", ...],
      "grammar": [<0-based index into story-level grammar array>, ...]
    }}
  ]
}}

## Rules

1. **sentence.grammar**: List the 0-based indices into the story-level `grammar` array for patterns used in that sentence.

2. **id field**: Must be suitable as a filename (kebab-case, no spaces, no special characters except hyphens).

3. **Vocabulary discipline**: Only use vocabulary from the provided list. Do not introduce vocabulary beyond Chapter {chapter}.

4. **words array**: Plain surface forms only — no furigana brackets. Joined words must exactly equal the japanese field.

Return ONLY the JSON object. No markdown, no code fences, no explanation.
"""


# ---------------------------------------------------------------------------
# Stage 1 — Japanese production prompt
# ---------------------------------------------------------------------------


def build_japanese_production_prompt(
    vocab_data: VocabData,
    grammar_data: GrammarData,
    source: str,
    *,
    source_is_japanese: bool,
    target_chapter: int | None,
    steering_instructions: str = "",
) -> str:
    """Build the Stage-1 prompt that produces plain Japanese prose only.

    Stage 1 translates (EN→JA) or simplifies (JA→JA) into a Japanese prose blob and
    nothing else — no segmentation, gloss, grammar tags, furigana, or metadata (all of
    which are Stage 2's job). The output is the minimal JSON ``{"japanese": "..."}`` so
    produced and pasted Japanese reach Stage 2 in the identical shape (a Japanese string).

    ``target_chapter`` is an already-parsed ``int | None`` (chapter-string parsing and the
    ``"unspecified"`` sentinel live in se3-4); ``None`` means no Genki constraint.
    """
    steering_block = (
        f"\n## Additional Instructions\n\n{steering_instructions.strip()}\n"
        if steering_instructions.strip()
        else ""
    )

    # Task framing — the verb differs by source language. A Japanese source is
    # *simplified/rewritten*, never "translated"; an English source is translated.
    if source_is_japanese:
        source_heading = "Japanese Source Story"
        if target_chapter is None:
            # Defensive branch only: se3-4 skips Stage 1 entirely for frozen Japanese,
            # so this pairing is never reached in production. Echo the input unchanged.
            task = "Return the Japanese source story below exactly as given, unchanged."
        else:
            task = (
                f"Rewrite the Japanese source story below, simplifying it so it uses ONLY "
                f"the Genki I vocabulary and grammar patterns available up to Chapter "
                f"{target_chapter} (listed below). Preserve the original meaning and events; "
                f"do not add new content."
            )
    else:
        source_heading = "English Source Story"
        if target_chapter is None:
            task = (
                "Translate the English source story below into natural Japanese prose at a "
                "natural difficulty level — there is no vocabulary or grammar restriction."
            )
        else:
            task = (
                f"Translate the English source story below into Japanese, calibrated to Genki I "
                f"Chapter {target_chapter} — use ONLY the vocabulary and grammar patterns listed "
                f"below. Produce a faithful translation brought down to that level."
            )

    # Curriculum constraint block — assembled only when a target chapter is set.
    if target_chapter is None:
        constraints_block = ""
    else:
        vocab_block = _cumulative_vocab_block(vocab_data, target_chapter)
        grammar_block = _cumulative_grammar_block(grammar_data, target_chapter)
        constraints_block = f"""
## Curriculum Constraints

### Vocabulary available (cumulative Ch.1–{target_chapter})
Format: ID | hiragana (kanji) | English meaning
{vocab_block}

### Grammar patterns available (cumulative Ch.1–{target_chapter})
{grammar_block}

**Vocabulary discipline:** Only use vocabulary from the provided list. Do not introduce vocabulary beyond Chapter {target_chapter}.
"""

    return f"""You are a Japanese language expert producing Japanese prose for a graded reader.

## Task

{task}
{constraints_block}
## {source_heading}

{source.strip()}
{steering_block}
## Output Format

Respond with a single JSON object containing ONLY the Japanese story text as one string:

{{"japanese": "<full Japanese story text>"}}

Return ONLY that JSON object. Do NOT split the text into words, do NOT add furigana, readings, or English glosses, and do NOT include a title, description, id, grammar tags, or any per-sentence structure — just the plain Japanese prose. No markdown, no code fences, no explanation.
"""


# ---------------------------------------------------------------------------
# Path B — English proposal prompt
# ---------------------------------------------------------------------------


def build_proposal_prompt(
    chapter: int,
    topic: str,
    steering_instructions: str = "",
    target_word_count: int = 0,
) -> str:
    """Build the Gemini prompt for Path B phase 1: topic → English story proposal."""
    steering_block = (
        f"\n## Additional Instructions\n\n{steering_instructions.strip()}\n"
        if steering_instructions.strip()
        else ""
    )
    length_hint = f"approximately {target_word_count} words" if target_word_count > 0 else "~150–300 words"
    return f"""You are a creative writing assistant helping to generate source material for a Japanese graded reader aimed at Genki I Chapter {chapter} learners.

## Task

Write an English story of {length_hint} based on the topic below. The story will later be translated into Japanese, so:
- Keep the vocabulary and concepts within reach of an early Japanese learner (simple daily life themes)
- Use clear, concrete scenes and actions that translate naturally
- Avoid idioms, cultural references, or complex abstractions that resist translation

## Topic

{topic.strip()}
{steering_block}
## Output Format

Return only the English story as plain prose. No title, no JSON, no markdown, no code fences. Just the story text.
"""


# ---------------------------------------------------------------------------
# Chapter parsing
# ---------------------------------------------------------------------------


def _parse_chapter(chapter_str: str) -> int:
    """Extract integer from 'Genki I Ch.8' → 8."""
    try:
        return int(chapter_str.split("Ch.")[1])
    except (IndexError, ValueError) as exc:
        raise ValueError(f"Cannot parse chapter number from: {chapter_str!r}") from exc


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def _coerce_string_nulls(story_dict: dict) -> None:
    """Replace string "null" with None in vocab_keys arrays, in-place.

    Gemini occasionally emits ["null"] instead of [null] despite explicit prompt
    instructions. The string form passes JSON parsing but breaks validation and the reader.
    """
    for sentence in story_dict.get("sentences") or []:
        if not isinstance(sentence, dict):
            continue
        arr = sentence.get("vocab_keys")
        if isinstance(arr, list):
            sentence["vocab_keys"] = [None if v == "null" else v for v in arr]


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class StoryGeneratorAgent:
    """M1 story generation agent.

    Args:
        vocab_data: Loaded vocabulary reference data.
        grammar_data: Loaded grammar reference data.
        gemini_client: Optional injectable callable ``(model, contents, config) → response``
            for the blocking path (used by _generate_topic_suggestion only).
            If None, a real ``genai.Client`` is created lazily.
        gemini_stream_client: Optional injectable async callable
            ``async (model, contents, config) → AsyncIterable[chunk]`` for all generation
            paths. If None, a real streaming client is created lazily. Pass a mock for tests.
    """

    def __init__(
        self,
        vocab_data: VocabData,
        grammar_data: GrammarData,
        gemini_client=None,
        gemini_stream_client=None,
        enrichment_pipeline=None,
        generation_timeout_s: float = 55.0,
    ) -> None:
        self._vocab_data = vocab_data
        self._grammar_data = grammar_data
        self._gemini_client = gemini_client  # None → real client on first call
        self._gemini_stream_client = gemini_stream_client  # None → real stream client on first call
        self._enrichment_pipeline = enrichment_pipeline  # None → real pipeline injected by main.py
        self._generation_timeout_s = generation_timeout_s

    def _get_caller(self):
        """Return the Gemini generate_content callable (cached after first call)."""
        if self._gemini_client is not None:
            return self._gemini_client
        # P4: use .get() so a missing key raises RuntimeError with a clear message
        # rather than leaking the env-var name via bare KeyError
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
        from google import genai

        client = genai.Client(api_key=api_key)

        def _call(model, contents, config):
            return client.models.generate_content(
                model=model, contents=contents, config=config
            )

        # P3: cache so subsequent generate() calls reuse the same client
        self._gemini_client = _call
        return _call

    def _get_stream_caller(self):
        """Return async streaming callable ``async (model, contents, config) → AsyncIterable[chunk]``.

        Awaiting the callable returns an async iterable of GenerateContentResponse chunks.
        Thought parts (part.thought == True) carry thinking-token text; non-thought parts
        carry the model's actual output.
        """
        if self._gemini_stream_client is not None:
            return self._gemini_stream_client
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
        from google import genai

        client = genai.Client(api_key=api_key)

        async def _stream(model, contents, config):
            # generate_content_stream is a coroutine returning an async iterable.
            # Confirmed: await the call, then iterate the result (SDK issue #226).
            return await client.aio.models.generate_content_stream(
                model=model, contents=contents, config=config
            )

        self._gemini_stream_client = _stream
        return _stream

    def _log_llm_perf(
        self, activity: str, run_id: str, t0: float, response_chars: int, status: str
    ) -> None:
        """Emit one llm_perf log line for a completed or failed stream, keyed by activity."""
        _perf_logger.info(
            "",
            extra={
                "activity": activity,
                "run_id": run_id,
                "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                "response_chars": response_chars,
                "status": status,
            },
        )

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

        Owns the GenerateContentConfig, the monotonic wall-clock deadline and initial
        ``asyncio.wait_for``, the mid-stream cancel check, thought-part → AGENT_STATUS
        emission, and the llm_perf log line keyed by ``activity``. Thought parts are emitted
        as pass-through ``AGENT_STATUS`` events; non-thought parts accumulate into the raw text.

        The final yielded item is exactly one terminal control dict, one of:
        ``{"__stream__": "ok", "text": <raw>}``, ``{"__stream__": "timeout"}``,
        ``{"__stream__": "error", "message": <str>}``, or ``{"__stream__": "cancelled"}``.
        Callers forward every AGENT_STATUS and break on the first dict carrying ``__stream__``.
        """
        # Stream chunks under a wall-clock deadline; accumulate non-thought text.
        # Config construction stays inside the try so an SDK import / bad-config failure
        # surfaces as a clean "error" terminal rather than aborting the stream.
        t0 = time.perf_counter()
        parts: list[str] = []
        cancelled = False
        try:
            from google.genai import types as genai_types

            # Build the generation config — response_mime_type is the only path difference.
            config_kwargs = dict(
                temperature=temperature,
                thinking_config=genai_types.ThinkingConfig(
                    thinking_budget=THINKING_BUDGET,
                    include_thoughts=True,  # required to receive thought parts in stream chunks
                ),
            )
            if json_output:
                config_kwargs["response_mime_type"] = "application/json"
            config = genai_types.GenerateContentConfig(**config_kwargs)

            stream = self._get_stream_caller()
            logger.debug("Streaming %s for %r (timeout=%ss, thinking_budget=%s)",
                         GEMINI_MODEL, activity, self._generation_timeout_s, THINKING_BUDGET)
            deadline = time.monotonic() + self._generation_timeout_s
            # Guard the initial SDK call with the remaining time budget (P-review-2)
            chunks = await asyncio.wait_for(
                stream(GEMINI_MODEL, contents, config),
                timeout=max(deadline - time.monotonic(), 0),
            )
            async for chunk in chunks:
                if time.monotonic() > deadline:
                    raise asyncio.TimeoutError()
                # Honour cancel mid-stream rather than waiting for the full stream (P-review-1)
                if cancel_event and cancel_event.is_set():
                    cancelled = True
                    break
                # candidates can be None on some SDK versions (SDK issue #226)
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

        # Terminal control dict — cancelled short-circuits before the ok perf log.
        if cancelled:
            yield {"__stream__": "cancelled"}
            return

        raw = "".join(parts)
        # No "ok" perf line for empty (safety-filtered) output — the caller turns it into
        # GENERATION_FAILED, so logging it as a success would double-count the run.
        if raw:
            self._log_llm_perf(activity, run_id, t0, len(raw), "ok")
        yield {"__stream__": "ok", "text": raw}

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
        target_word_count: int = 0,
        cancel_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Yield AG-UI event dicts per ADR-004.

        Path A:  RUN_STARTED → [TEXT_MESSAGE_CHUNK] → RUN_FINISHED(story)  or  ERROR/RUN_CANCELLED
        Path B1: RUN_STARTED → [TEXT_MESSAGE_CHUNK] → RUN_FINISHED(proposal)  or  ERROR/RUN_CANCELLED
        Path B2: identical to Path A but uses english_draft as source text
        """
        # Emit RUN_STARTED immediately so the frontend's 3-second first-event timeout is satisfied
        yield {"type": "RUN_STARTED", "runId": run_id}

        # Check cancel before expensive Gemini call
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        # Route Path B phase 1 (topic → English proposal) before chapter parsing
        if path_mode == "B" and topic:
            logger.info("Path B phase 1 — run_id=%s chapter=%s topic=%.60r", run_id, chapter, topic)
            async for event in self._generate_proposal(
                run_id=run_id,
                chapter=chapter,
                topic=topic,
                steering_instructions=steering_instructions,
                temperature=temperature,
                target_word_count=target_word_count,
                cancel_event=cancel_event,
            ):
                yield event
            return

        # Path A and Path B phase 2 both go through the Japanese story pipeline.
        # Phase 2 uses english_draft as the source text; Path A uses input_text.
        source_text = english_draft if (path_mode == "B" and english_draft) else input_text

        logger.info(
            "Path %s generation — run_id=%s chapter=%s temp=%.1f grammar_dist=%s",
            "B2" if path_mode == "B" else "A",
            run_id, chapter, temperature, grammar_distribution,
        )

        # Guard: reject empty source before the expensive Gemini call
        if not source_text.strip():
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": "No source text provided. Supply inputText (Path A) or englishDraft (Path B phase 2).",
            }
            return

        # P1: catch ValueError so a bad chapter string yields ERROR instead of breaking the stream
        try:
            chapter_int = _parse_chapter(chapter)
        except ValueError as exc:
            yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": str(exc)}
            return
        prompt = build_system_prompt(
            self._vocab_data,
            self._grammar_data,
            chapter_int,
            source_text,
            steering_instructions,
            grammar_distribution,
        )
        logger.debug("Prompt (%d chars):\n%s", len(prompt), prompt)

        # Stream from Gemini via the shared streamer — thought parts arrive as pass-through
        # AGENT_STATUS events; the terminal control dict carries the accumulated JSON or a failure.
        raw_json = ""
        async for ev in self._stream_llm(
            contents=prompt,
            json_output=True,
            activity="Convert to Japanese",
            temperature=temperature,
            cancel_event=cancel_event,
            run_id=run_id,
        ):
            if "__stream__" not in ev:
                yield ev
                continue
            outcome = ev["__stream__"]
            if outcome == "timeout":
                yield {
                    "type": "ERROR",
                    "code": "TIMEOUT",
                    "message": "This took longer than expected — your inputs are preserved. Try again.",
                }
                return
            if outcome == "error":
                yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": ev["message"]}
                return
            if outcome == "cancelled":
                yield {"type": "RUN_CANCELLED", "runId": run_id}
                return
            raw_json = ev["text"]
            break

        # Honour a cancel that arrived exactly as the stream completed
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        # Guard against empty output (safety filter or all-thought response)
        if not raw_json:
            logger.warning("run_id=%s Gemini returned no content (safety filter?)", run_id)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": "Gemini returned no content. Check safety filters or prompt length.",
            }
            return

        logger.debug("Response (%d chars):\n%s", len(raw_json), raw_json[:2000])

        # Parse simplified Gemini JSON response
        try:
            raw_response = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.error("run_id=%s invalid JSON from Gemini: %s", run_id, exc)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": f"Response is not valid JSON: {exc}",
            }
            return

        # Extract sentences (segments) and story metadata from simplified response
        segments = raw_response.get("sentences") or []
        story_meta = {k: v for k, v in raw_response.items() if k != "sentences"}
        story_meta["difficulty"] = f"Genki I Ch.{chapter_int}"

        # Guard: enrichment pipeline must be available
        pipeline = self._enrichment_pipeline
        if pipeline is None:
            logger.error("run_id=%s enrichment pipeline not initialised", run_id)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": "Enrichment pipeline not initialised — SudachiPy may not be installed.",
            }
            return

        # Enrich deterministically: furigana, vocab_keys, vocab_supplement all built by Python
        try:
            story_dict = pipeline.build_enriched_story(segments, story_meta)
        except Exception as exc:  # noqa: BLE001
            logger.warning("run_id=%s enrichment failed: %s", run_id, exc)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": str(exc),
            }
            return

        # Validate assembled story — PARALLEL_ARRAY_MISMATCH here is a pipeline bug, not LLM error
        result = validate(story_dict)
        if not result.valid:
            errors_str = "; ".join(e.message for e in result.errors[:3])
            logger.warning("run_id=%s validation failed: %s", run_id, errors_str)
            yield {
                "type": "ERROR",
                "code": "VALIDATION_ERROR",
                "message": f"Generated story failed validation: {errors_str}",
            }
            return

        story_id = story_dict.get("id", "unknown")
        sentences = story_dict.get("sentences", [])
        logger.info("run_id=%s generation complete — id=%r sentences=%d", run_id, story_id, len(sentences))

        # Stream enriched JSON as a single chunk then finish
        enriched_json = json.dumps(story_dict, ensure_ascii=False)
        yield {"type": "TEXT_MESSAGE_CHUNK", "delta": enriched_json}
        yield {
            "type": "RUN_FINISHED",
            "resultType": "story",
            "content": enriched_json,
        }

    async def _generate_proposal(
        self,
        *,
        run_id: str,
        chapter: str,
        topic: str,
        steering_instructions: str,
        temperature: float,
        target_word_count: int = 0,
        cancel_event: asyncio.Event | None,
    ) -> AsyncGenerator[dict, None]:
        """Path B phase 1: topic → English story proposal.

        Emits TEXT_MESSAGE_CHUNK + RUN_FINISHED(resultType='proposal') on success.
        """
        # Check cancel before any work
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        # P1: catch ValueError from bad chapter string
        try:
            chapter_int = _parse_chapter(chapter)
        except ValueError as exc:
            yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": str(exc)}
            return

        prompt = build_proposal_prompt(chapter_int, topic, steering_instructions, target_word_count)
        logger.debug("Proposal prompt (%d chars):\n%s", len(prompt), prompt)

        # Stream from Gemini via the shared streamer — plain-text output (json_output=False).
        raw_text = ""
        async for ev in self._stream_llm(
            contents=prompt,
            json_output=False,
            activity="Generate story in English",
            temperature=temperature,
            cancel_event=cancel_event,
            run_id=run_id,
        ):
            if "__stream__" not in ev:
                yield ev
                continue
            outcome = ev["__stream__"]
            if outcome == "timeout":
                yield {
                    "type": "ERROR",
                    "code": "TIMEOUT",
                    "message": "This took longer than expected — your inputs are preserved. Try again.",
                }
                return
            if outcome == "error":
                yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": ev["message"]}
                return
            if outcome == "cancelled":
                yield {"type": "RUN_CANCELLED", "runId": run_id}
                return
            raw_text = ev["text"]
            break

        # Honour a cancel that arrived exactly as the stream completed
        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        proposal_text = raw_text.strip()
        if not proposal_text:
            logger.warning("run_id=%s Gemini returned no proposal (safety filter?)", run_id)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": "Gemini returned no content. Check safety filters or prompt length.",
            }
            return

        logger.info("run_id=%s proposal complete (%d chars)", run_id, len(proposal_text))
        logger.debug("Proposal text:\n%s", proposal_text)
        yield {"type": "TEXT_MESSAGE_CHUNK", "delta": proposal_text}
        yield {"type": "RUN_FINISHED", "resultType": "proposal", "content": proposal_text}
