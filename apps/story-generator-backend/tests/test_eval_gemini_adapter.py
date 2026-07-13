"""Offline unit test for the eval harness's gemini-analysis adapter (se3-6).

No GEMINI_API_KEY, no network: drives ``make_gemini_analysis_adapter`` with an injected fake
``agent`` (duck-typing ``StoryGeneratorAgent._run_stage2_analysis``) returning canned Stage-2
JSON, and a fake ``pipeline`` (SudachiPy-independent).

Import approach: ``eval/adapters/`` sits outside the ``story_generator`` package by design
(AC13 keeps the eval harness self-contained), so this test adds ``eval/`` to ``sys.path``
and imports the adapter module directly — the same mechanism ``run_eval.py`` itself uses.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

EVAL_DIR = Path(__file__).parents[1] / "eval"
sys.path.insert(0, str(EVAL_DIR))

from adapters.gemini_analysis import make_gemini_analysis_adapter  # noqa: E402
from run_eval import _git_commit  # noqa: E402

#: Canned Stage-2 response: two sentences, exercising the cross-sentence flatten.
_CANNED_STAGE2_DATA = json.loads(
    json.dumps(
        {
            "id": "x",
            "title": "x",
            "sentences": [
                {
                    "english": "I get up.",
                    "japanese": "私は起きます。",
                    "words": ["私", "は", "起きます", "。"],
                    "grammar": [],
                },
                {
                    "english": "Good morning.",
                    "japanese": "おはよう。",
                    "words": ["おはよう", "。"],
                    "grammar": [],
                },
            ],
        }
    )
)


class FakeAgent:
    """Injectable fake — duck-types StoryGeneratorAgent's _run_stage2_analysis seam.

    Records every kwarg it's called with, so tests can assert the adapter drives the real
    seam with the exact parity-critical arguments (target_chapter=None, temperature, etc.)
    instead of a bespoke, possibly-drifted prompt/config.
    """

    def __init__(self, data: dict | None = None, fail: bool = False) -> None:
        self.data = data
        self.fail = fail
        self.calls: list[dict] = []

    async def _run_stage2_analysis(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": "boom"}
            yield {"__stage__": "failed"}
            return
        yield {"__stage__": "ok", "data": self.data}


class FakeEnrichmentPipeline:
    """Injectable fake — returns one canned per-word dict per input word, no SudachiPy."""

    def __init__(self) -> None:
        self.calls: list[tuple[list[str], object]] = []

    def enrich_sentence(self, words: list[str], seen_dict_forms=None) -> list[dict]:
        self.calls.append((words, seen_dict_forms))
        return [
            {
                "annotated": f"{w}[ruby]",
                "dictionary_form": f"{w}-dict",
                "reading": w,
                "pos_code": "n",
            }
            for w in words
        ]


def test_gemini_adapter_flattens_enriches_and_orders() -> None:
    """(a) flattens words across sentences, (b) maps enrich_sentence's result, (c) preserves order."""
    fake_pipeline = FakeEnrichmentPipeline()
    fake_agent = FakeAgent(data=_CANNED_STAGE2_DATA)
    adapter = make_gemini_analysis_adapter(agent=fake_agent, pipeline=fake_pipeline)

    result = adapter("私は起きます。おはよう。")

    expected_words = ["私", "は", "起きます", "。", "おはよう", "。"]
    assert [r["surface"] for r in result] == expected_words

    # enrich_sentence is called exactly once, with the flattened words and seen_dict_forms=None
    # (canonical per-word ruby — matches the gold convention, no first-occurrence suppression).
    assert fake_pipeline.calls == [(expected_words, None)]

    for word, r in zip(expected_words, result):
        assert r["dict"] == f"{word}-dict"
        assert r["ruby"] == f"{word}[ruby]"
        assert r["pos"] == "n"


def test_gemini_adapter_drives_stage2_with_parity_critical_args() -> None:
    """The adapter must call the real Stage-2 seam with target_chapter=None and temperature=1.0.

    target_chapter=None is what matches the "Unspecified" Path-C UI config — the only choice
    that leaves the pasted Japanese unmodified (any real chapter runs Stage 1's JA->JA rewrite
    first). A regression here would silently reintroduce the grammar-block/segmentation drift
    this adapter was rewritten to eliminate. Temperature is not passed at all — it's fixed inside
    ``_run_stage2_analysis`` at ``STAGE2_TEMPERATURE``, so there's nothing to assert parity on here.
    """
    fake_agent = FakeAgent(data=_CANNED_STAGE2_DATA)
    adapter = make_gemini_analysis_adapter(agent=fake_agent, pipeline=FakeEnrichmentPipeline())

    adapter("私は起きます。おはよう。")

    assert fake_agent.calls == [{
        "japanese_text": "私は起きます。おはよう。",
        "target_chapter": None,
        "steering_instructions": "",
        "cancel_event": None,
        "run_id": "eval",
    }]


def test_gemini_adapter_raises_on_stage2_failure() -> None:
    fake_agent = FakeAgent(fail=True)
    adapter = make_gemini_analysis_adapter(agent=fake_agent, pipeline=FakeEnrichmentPipeline())

    with pytest.raises(RuntimeError, match="Stage-2 analysis failed"):
        adapter("私は起きます。")


def test_git_commit_returns_str_and_never_raises() -> None:
    """_git_commit() returns a non-empty string ("unknown" is an acceptable fallback)."""
    commit = _git_commit()
    assert isinstance(commit, str)
    assert commit
