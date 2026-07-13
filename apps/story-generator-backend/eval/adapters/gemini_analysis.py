"""Production-pipeline adapter — drives the real Stage-2 Gemini call via StoryGeneratorAgent.

Calls ``StoryGeneratorAgent._run_stage2_analysis`` — the exact seam ``generate()`` itself
uses for Stage 2 — so the prompt, model, and ``GenerateContentConfig`` (temperature — fixed at
``STAGE2_TEMPERATURE``, thinking budget, streaming) are byte-for-byte what production sends,
not a re-implementation (se3-6).

``target_chapter`` is always ``None``. This matches the *only* Path-C ("Japanese story") UI
configuration that leaves the pasted Japanese unmodified: choosing "Unspecified" skips Stage 1
entirely (``skip_stage1 = path_mode == "C" and target_chapter is None`` in ``agent.py``); picking
any real chapter runs Stage 1's JA→JA rewrite *first*, so Stage 2 would no longer be analysing the
frozen gold ``ja`` this harness scores against.

Enrichment (dict form / ruby / POS) then runs through ``EnrichmentPipeline.enrich_sentence`` with
``seen_dict_forms=None`` (canonical per-word, no first-occurrence suppression) — the same
enrichment layer ``sudachi-baseline`` uses and the same call the adapter always made; only Stage 2
itself is now driven through the real agent instead of a hand-built prompt + blocking call.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Callable


def make_gemini_analysis_adapter(
    *,
    agent=None,
    pipeline=None,
    grammar_data=None,
    vocab_data=None,
) -> "Callable[[str], list[dict]]":
    """Build a JA→annotations adapter that drives the real Stage-2 Gemini call.

    ``agent``, ``pipeline``, ``grammar_data``, and ``vocab_data`` are injectable seams — when
    ``None`` each is constructed lazily so importing this module, and building the
    ``sudachi-baseline`` adapter instead, never touches the network or requires
    ``GEMINI_API_KEY``. ``agent`` need only duck-type ``StoryGeneratorAgent``'s
    ``_run_stage2_analysis`` async-generator method (see ``test_eval_gemini_adapter.py``).
    """
    # Lazy imports — keep the registry import cheap and offline.
    from story_generator.data_loader import load_grammar_data, load_vocab_data
    from story_generator.enrichment import EnrichmentPipeline

    resources = Path(__file__).resolve().parents[4] / "resources"

    if grammar_data is None:
        grammar_data = load_grammar_data(resources / "Genki_grammar_for_AI_generation.csv")
    if vocab_data is None:
        vocab_data = load_vocab_data(resources / "genki1vocab.csv")
    if pipeline is None:
        pipeline = EnrichmentPipeline(resources / "genki1vocab.csv")
    if agent is None:
        agent = _build_real_agent(vocab_data, grammar_data)

    def adapter(ja: str) -> list[dict]:
        data = asyncio.run(_run_stage2(agent, ja))
        if "sentences" not in data:
            raise ValueError(f"Stage-2 analysis response missing 'sentences': {data!r}")

        # The prompt returns full-story JSON; flatten words across every returned sentence
        # rather than assuming sentences[0] — the model may split on internal punctuation.
        words = [w for s in data["sentences"] for w in s.get("words", [])]

        # Enrich directly (not build_enriched_story): no join-invariant guard, so a segmentation
        # error is measured as a boundary miss rather than crashing the run. seen_dict_forms=None:
        # the gold ruby is canonical per-word (no first-occurrence suppression).
        enriched = pipeline.enrich_sentence(words, seen_dict_forms=None)
        return [
            {
                "surface": word,
                "dict": e["dictionary_form"],
                "ruby": e["annotated"],
                "pos": e["pos_code"],
            }
            for word, e in zip(words, enriched)
        ]

    return adapter


async def _run_stage2(agent, ja: str) -> dict:
    """Drive ``agent._run_stage2_analysis`` exactly as ``generate()`` does; return its data."""
    async for ev in agent._run_stage2_analysis(
        japanese_text=ja,
        target_chapter=None,
        steering_instructions="",
        cancel_event=None,
        run_id="eval",
    ):
        if "__stage__" not in ev:
            continue  # AGENT_STATUS thought-progress events — not needed for eval
        if ev["__stage__"] == "failed":
            raise RuntimeError("Stage-2 analysis failed (see logs for the ERROR event detail)")
        return ev["data"]
    raise RuntimeError("Stage-2 analysis produced no terminal event")


def _build_real_agent(vocab_data, grammar_data):
    """Construct a real StoryGeneratorAgent, loading GEMINI_API_KEY the same way main.py does."""
    from dotenv import load_dotenv

    from story_generator.agent import StoryGeneratorAgent

    load_dotenv()
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
    return StoryGeneratorAgent(vocab_data, grammar_data)
