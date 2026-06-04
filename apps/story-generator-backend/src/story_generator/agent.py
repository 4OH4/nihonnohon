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


def build_system_prompt(
    vocab_data: VocabData,
    grammar_data: GrammarData,
    chapter: int,
    english_source: str,
    steering_instructions: str = "",
    grammar_distribution: int = 1,
) -> str:
    """Build the Gemini prompt with cumulative Ch.1–N vocab and grammar."""
    # Cumulative vocab entries up to this chapter
    vocab_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for entry in vocab_data.by_chapter.get(ch, []):
            kanji_part = f" ({entry.kanji})" if entry.kanji else ""
            vocab_lines.append(f"  {entry.id} | {entry.hiragana}{kanji_part} | {entry.translation}")

    vocab_block = "\n".join(vocab_lines) if vocab_lines else "  (none)"

    # Cumulative grammar points up to this chapter
    grammar_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for gp in grammar_data.by_chapter.get(ch, []):
            grammar_lines.append(f"  [Ch{ch} {gp.point}] {gp.title}: {gp.summary}")

    grammar_block = "\n".join(grammar_lines) if grammar_lines else "  (none)"

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
## Inline Furigana Annotation

Words containing kanji MUST be annotated using inline `漢字[よみ]` syntax.
The reading goes in square brackets immediately after the kanji character(s).
Non-kanji characters (hiragana, katakana, punctuation) between or after annotated
blocks are bare text — do not annotate them.

**Four annotation patterns:**

| Pattern | Word | Annotated form |
|---|---|---|
| Single kanji | 私 | `私[わたし]` |
| Kanji block + okurigana | 肌寒い | `肌寒[はだざむ]い` |
| Separate kanji with interleaved kana | 付け加える | `付[つ]け加[くわ]える` |
| Jukujikun (whole-word reading) | 大人 | `大人[おとな]` |

Words that are pure hiragana, katakana, or punctuation: write them as plain strings with no brackets.

## Output Format

Respond with a single JSON object matching this exact structure:

{{
  "schema_version": "2",
  "id": "<kebab-case identifier embedding difficulty and topic, e.g. genki-i-ch{chapter}-topic>",
  "title": "<English story title>",
  "title_ja": "<Japanese story title>",
  "language": "ja",
  "description": "<1-2 sentence English description of the story>",
  "difficulty": "{difficulty}",
  "grammar": ["<grammar pattern string 1>", "<grammar pattern string 2>", ...],
  "vocab_supplement": [
    {{"key": <integer starting at 10000>, "word": "<word>", "hiragana": "<reading>", "translation": "<English>"}}
  ],
  "sentences": [
    {{
      "id": "s01",
      "words": ["<word1 with inline annotation if kanji>", "<word2>", ...],
      "vocab_keys": [<vocab_id or null>, <vocab_id or null>, ...],
      "translation": "<English translation of this sentence>",
      "grammar": [<index into story-level grammar array>, ...]
    }}
  ]
}}

## Critical Rules

1. **Parallel arrays**: `words` and `vocab_keys` MUST have the SAME LENGTH for every sentence. This is a hard requirement — mismatched lengths will fail validation.

2. **vocab_keys values**:
   - Use the integer ID from the vocabulary list above if the token matches a listed word
   - Use `null` (JSON null, no quotes) for particles, punctuation, conjunctions, or any token not in the vocabulary list
   - Supplemental vocabulary (words needed but NOT in the list) must appear in `vocab_supplement` with a unique integer `key` starting at 10000, and that same key used in `vocab_keys`

3. **Annotation format**: Words containing kanji MUST use inline `漢字[よみ]` syntax as described above. The `[` bracket must immediately follow the kanji character(s) it annotates.

4. **sentence.id**: Use "s01", "s02", etc.

5. **sentence.grammar**: List the 0-based indices into the story-level `grammar` array for patterns used in that sentence.

6. **id field**: Must be suitable as a filename (kebab-case, no spaces, no special characters except hyphens).

7. **Vocabulary discipline**: Only use vocabulary from the provided list or `vocab_supplement`. Do not introduce vocabulary beyond Chapter {chapter} without adding it to `vocab_supplement`.

Return ONLY the JSON object. No markdown, no code fences, no explanation.
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
        generation_timeout_s: float = 55.0,
    ) -> None:
        self._vocab_data = vocab_data
        self._grammar_data = grammar_data
        self._gemini_client = gemini_client  # None → real client on first call
        self._gemini_stream_client = gemini_stream_client  # None → real stream client on first call
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

        # Stream from Gemini — thought parts become AGENT_STATUS events; content parts
        # accumulate into raw_json. Wall-clock deadline replaces asyncio.wait_for.
        t0 = time.perf_counter()
        try:
            from google.genai import types as genai_types

            config = genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=temperature,
                thinking_config=genai_types.ThinkingConfig(
                    thinking_budget=THINKING_BUDGET,
                    include_thoughts=True,  # required to receive thought parts in stream chunks
                ),
            )
            stream = self._get_stream_caller()
            logger.debug("Streaming %s (timeout=%ss, thinking_budget=%s)",
                         GEMINI_MODEL, self._generation_timeout_s, THINKING_BUDGET)

            raw_json_parts: list[str] = []
            deadline = time.monotonic() + self._generation_timeout_s
            # Guard the initial SDK call with the remaining time budget (P-review-2)
            chunks = await asyncio.wait_for(
                stream(GEMINI_MODEL, prompt, config),
                timeout=max(deadline - time.monotonic(), 0),
            )
            async for chunk in chunks:
                if time.monotonic() > deadline:
                    raise asyncio.TimeoutError()
                # Honour cancel mid-stream rather than waiting for the full stream (P-review-1)
                if cancel_event and cancel_event.is_set():
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
                        raw_json_parts.append(getattr(part, "text", None) or "")

            raw_json = "".join(raw_json_parts)
            elapsed_ms = (time.perf_counter() - t0) * 1000
        except asyncio.TimeoutError:
            _perf_logger.info(
                "",
                extra={
                    "activity": "Convert to Japanese",
                    "run_id": run_id,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                    "response_chars": 0,
                    "status": "timeout",
                },
            )
            logger.warning("run_id=%s timed out after %ss", run_id, self._generation_timeout_s)
            yield {
                "type": "ERROR",
                "code": "TIMEOUT",
                "message": "This took longer than expected — your inputs are preserved. Try again.",
            }
            return
        except Exception as exc:  # noqa: BLE001
            _perf_logger.info(
                "",
                extra={
                    "activity": "Convert to Japanese",
                    "run_id": run_id,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                    "response_chars": 0,
                    "status": "error",
                },
            )
            logger.error("run_id=%s Gemini call failed: %s", run_id, exc)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": str(exc),
            }
            return

        # Check cancel after stream completes
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

        _perf_logger.info(
            "",
            extra={
                "activity": "Convert to Japanese",
                "run_id": run_id,
                "elapsed_ms": round(elapsed_ms),
                "response_chars": len(raw_json),
                "status": "ok",
            },
        )
        logger.debug("Response (%d chars):\n%s", len(raw_json), raw_json[:2000])

        # Parse JSON
        try:
            story_dict = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.error("run_id=%s invalid JSON from Gemini: %s", run_id, exc)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": f"Response is not valid JSON: {exc}",
            }
            return

        # Coerce string "null" → None in ruby and vocab_keys arrays.
        # Gemini occasionally outputs ["null"] instead of [null] despite prompt
        # instructions; fix silently before validation so it never reaches the client.
        _coerce_string_nulls(story_dict)

        # Validate before streaming — emit ERROR instead of RUN_FINISHED on failure
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

        # Stream complete JSON as a single chunk then finish
        yield {"type": "TEXT_MESSAGE_CHUNK", "delta": raw_json}
        yield {
            "type": "RUN_FINISHED",
            "resultType": "story",
            "content": raw_json,
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

        # Stream from Gemini — same pattern as the JSON path but plain text accumulation.
        t0 = time.perf_counter()
        try:
            from google.genai import types as genai_types

            # Plain text output — no response_mime_type for the proposal
            config = genai_types.GenerateContentConfig(
                temperature=temperature,
                thinking_config=genai_types.ThinkingConfig(
                    thinking_budget=THINKING_BUDGET,
                    include_thoughts=True,
                ),
            )
            stream = self._get_stream_caller()
            logger.debug("Streaming %s for English proposal (timeout=%ss)", GEMINI_MODEL, self._generation_timeout_s)

            proposal_parts: list[str] = []
            deadline = time.monotonic() + self._generation_timeout_s
            # Guard the initial SDK call with the remaining time budget (P-review-2)
            chunks = await asyncio.wait_for(
                stream(GEMINI_MODEL, prompt, config),
                timeout=max(deadline - time.monotonic(), 0),
            )
            async for chunk in chunks:
                if time.monotonic() > deadline:
                    raise asyncio.TimeoutError()
                # Honour cancel mid-stream rather than waiting for the full stream (P-review-1)
                if cancel_event and cancel_event.is_set():
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
                        proposal_parts.append(getattr(part, "text", None) or "")

            elapsed_ms = (time.perf_counter() - t0) * 1000
        except asyncio.TimeoutError:
            _perf_logger.info(
                "",
                extra={
                    "activity": "Generate story in English",
                    "run_id": run_id,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                    "response_chars": 0,
                    "status": "timeout",
                },
            )
            logger.warning("run_id=%s proposal timed out", run_id)
            yield {
                "type": "ERROR",
                "code": "TIMEOUT",
                "message": "This took longer than expected — your inputs are preserved. Try again.",
            }
            return
        except Exception as exc:  # noqa: BLE001
            _perf_logger.info(
                "",
                extra={
                    "activity": "Generate story in English",
                    "run_id": run_id,
                    "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                    "response_chars": 0,
                    "status": "error",
                },
            )
            logger.error("run_id=%s proposal Gemini call failed: %s", run_id, exc)
            yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": str(exc)}
            return

        if cancel_event and cancel_event.is_set():
            yield {"type": "RUN_CANCELLED", "runId": run_id}
            return

        proposal_text = "".join(proposal_parts).strip()
        if not proposal_text:
            logger.warning("run_id=%s Gemini returned no proposal (safety filter?)", run_id)
            yield {
                "type": "ERROR",
                "code": "GENERATION_FAILED",
                "message": "Gemini returned no content. Check safety filters or prompt length.",
            }
            return

        _perf_logger.info(
            "",
            extra={
                "activity": "Generate story in English",
                "run_id": run_id,
                "elapsed_ms": round(elapsed_ms),
                "response_chars": len(proposal_text),
                "status": "ok",
            },
        )
        logger.info("run_id=%s proposal complete (%d chars)", run_id, len(proposal_text))
        logger.debug("Proposal text:\n%s", proposal_text)
        yield {"type": "TEXT_MESSAGE_CHUNK", "delta": proposal_text}
        yield {"type": "RUN_FINISHED", "resultType": "proposal", "content": proposal_text}
