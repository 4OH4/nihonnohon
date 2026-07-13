"""Unit tests for the eval harness's scoring/aggregation/CLI-helper logic.

No GEMINI_API_KEY, no network — everything here drives ``run_eval``'s pure functions or
``main()`` with a fake in-process adapter. Import approach matches
``test_eval_gemini_adapter.py``: ``eval/`` is added to ``sys.path`` so ``run_eval`` (which
sits outside the ``story_generator`` package by design) can be imported directly.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

EVAL_DIR = Path(__file__).parents[1] / "eval"
sys.path.insert(0, str(EVAL_DIR))

import run_eval  # noqa: E402
from run_eval import (  # noqa: E402
    _derive_rates,
    _resolve_gold_files,
    _sanitize_for_filename,
    aggregate,
    score,
)


# ---------------------------------------------------------------------------
# score() — single whole-story call, including a boundary-straddling prediction
# ---------------------------------------------------------------------------


def _stub_story() -> dict:
    """A 3-sentence story: s1 is a clean kanji word, s2+s3 get merged by the predicted adapter."""
    return {
        "id": "stub-story",
        "sentences": [
            {"id": "s01", "ja": "空", "words": [
                {"surface": "空", "dict": "空", "ruby": "空[そら]", "pos": "n"},
            ]},
            {"id": "s02", "ja": "いう", "words": [
                {"surface": "いう", "dict": "いう", "ruby": "いう", "pos": "n"},
            ]},
            {"id": "s03", "ja": "えお", "words": [
                {"surface": "えお", "dict": "えお", "ruby": "えお", "pos": "n"},
            ]},
        ],
    }


def test_score_straddling_prediction_hand_computed() -> None:
    """A predicted word spanning the s02/s03 boundary is scored, not silently dropped."""
    story = _stub_story()

    def stub_adapter(full_ja: str) -> list[dict]:
        assert full_ja == "空いうえお"
        return [
            {"surface": "空", "dict": "空", "ruby": "空[そら]", "pos": "n"},
            {"surface": "いうえ", "dict": "いうえ", "ruby": "いうえ", "pos": "n"},  # straddles s02/s03
            {"surface": "お", "dict": "お", "ruby": "お", "pos": "n"},
        ]

    result = score(story, stub_adapter)

    assert result["counts"] == {
        "b_tp": 1, "b_fp": 1, "b_fn": 1,
        "dict_total": 3, "dict_aligned": 1, "dict_correct": 1,
        "ruby_total": 1, "ruby_aligned": 1, "ruby_correct": 1,
        "sent_exact": 1,
    }
    assert result["segmentation"]["boundary_precision"] == pytest.approx(0.5)
    assert result["segmentation"]["boundary_recall"] == pytest.approx(0.5)
    assert result["segmentation"]["boundary_f1"] == pytest.approx(0.5)
    assert result["segmentation"]["sentence_exact_match"] == pytest.approx(1 / 3)
    assert result["dictionary_form"]["accuracy_strict"] == pytest.approx(1 / 3)
    assert result["dictionary_form"]["accuracy_aligned"] == pytest.approx(1.0)
    assert result["ruby"]["accuracy_strict"] == pytest.approx(1.0)
    assert result["ruby"]["accuracy_aligned"] == pytest.approx(1.0)

    assert result["per_sentence"] == [
        {"id": "s01", "seg_exact": True, "dict_ok": 1, "ruby_ok": 1},
        {"id": "s02", "seg_exact": False, "dict_ok": 0, "ruby_ok": 0},
        {"id": "s03", "seg_exact": False, "dict_ok": 0, "ruby_ok": 0},
    ]


def test_score_calls_adapter_exactly_once_with_full_story_text() -> None:
    calls: list[str] = []

    def stub_adapter(full_ja: str) -> list[dict]:
        calls.append(full_ja)
        return [{"surface": full_ja, "dict": full_ja, "ruby": full_ja, "pos": "n"}]

    story = {
        "id": "s",
        "sentences": [
            {"id": "s01", "ja": "あい", "words": [{"surface": "あい", "dict": "あい", "ruby": "あい", "pos": "n"}]},
            {"id": "s02", "ja": "うえ", "words": [{"surface": "うえ", "dict": "うえ", "ruby": "うえ", "pos": "n"}]},
        ],
    }
    score(story, stub_adapter)
    assert calls == ["あいうえ"]


# ---------------------------------------------------------------------------
# aggregate() — proper micro-average, not average-of-rates
# ---------------------------------------------------------------------------


def test_aggregate_micro_averages_not_average_of_rates() -> None:
    # Story A: precision 8/10=0.8, recall 8/8=1.0
    counts_a = {
        "b_tp": 8, "b_fp": 2, "b_fn": 0,
        "dict_total": 10, "dict_aligned": 10, "dict_correct": 5,
        "ruby_total": 0, "ruby_aligned": 0, "ruby_correct": 0,
        "sent_exact": 2,
    }
    result_a = _derive_rates(counts_a, n_sentences=2)
    result_a["counts"] = counts_a

    # Story B: precision 1/1=1.0, recall 1/2=0.5
    counts_b = {
        "b_tp": 1, "b_fp": 0, "b_fn": 1,
        "dict_total": 2, "dict_aligned": 2, "dict_correct": 2,
        "ruby_total": 0, "ruby_aligned": 0, "ruby_correct": 0,
        "sent_exact": 0,
    }
    result_b = _derive_rates(counts_b, n_sentences=1)
    result_b["counts"] = counts_b

    aggregated = aggregate([("story-a", result_a), ("story-b", result_b)])

    # Naive average-of-rates would give precision (0.8+1.0)/2 = 0.9 — wrong.
    # Micro-average: total_tp=9, total_fp=2 -> 9/11.
    assert aggregated["segmentation"]["boundary_precision"] == pytest.approx(9 / 11)
    assert aggregated["segmentation"]["boundary_recall"] == pytest.approx(9 / 10)
    assert aggregated["dictionary_form"]["accuracy_strict"] == pytest.approx(7 / 12)
    assert aggregated["segmentation"]["sentence_exact_match"] == pytest.approx(2 / 3)
    assert aggregated["n_sentences"] == 3
    assert set(aggregated["per_story"]) == {"story-a", "story-b"}
    assert aggregated["per_story"]["story-a"] is result_a
    assert aggregated["per_story"]["story-b"] is result_b


def test_aggregate_single_story_matches_score_output() -> None:
    """Aggregating a single story reproduces its own numbers exactly (summing is a no-op)."""
    story = _stub_story()

    def stub_adapter(full_ja: str) -> list[dict]:
        return [{"surface": s["ja"], "dict": s["ja"], "ruby": s["ja"], "pos": "n"} for s in story["sentences"]]

    solo = score(story, stub_adapter)
    aggregated = aggregate([("stub-story", solo)])

    assert aggregated["segmentation"] == solo["segmentation"]
    assert aggregated["dictionary_form"] == solo["dictionary_form"]
    assert aggregated["ruby"] == solo["ruby"]
    assert aggregated["n_sentences"] == solo["n_sentences"]
    assert aggregated["per_story"] == {"stub-story": solo}


# ---------------------------------------------------------------------------
# _resolve_gold_files
# ---------------------------------------------------------------------------


def test_resolve_gold_files_single_file(tmp_path: Path) -> None:
    import argparse

    gold_file = tmp_path / "one.json"
    gold_file.write_text("{}", encoding="utf-8")
    parser = argparse.ArgumentParser()

    assert _resolve_gold_files(gold_file, parser) == [gold_file]


def test_resolve_gold_files_directory_sorted(tmp_path: Path) -> None:
    import argparse

    gold_dir = tmp_path / "gold"
    gold_dir.mkdir()
    for name in ("c.json", "a.json", "b.json"):
        (gold_dir / name).write_text("{}", encoding="utf-8")
    (gold_dir / "not-json.txt").write_text("ignored", encoding="utf-8")
    parser = argparse.ArgumentParser()

    resolved = _resolve_gold_files(gold_dir, parser)

    assert [p.name for p in resolved] == ["a.json", "b.json", "c.json"]


def test_resolve_gold_files_empty_directory_raises(tmp_path: Path) -> None:
    import argparse

    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    parser = argparse.ArgumentParser()

    with pytest.raises(SystemExit):
        _resolve_gold_files(empty_dir, parser)


def test_resolve_gold_files_missing_path_raises(tmp_path: Path) -> None:
    import argparse

    parser = argparse.ArgumentParser()

    with pytest.raises(SystemExit):
        _resolve_gold_files(tmp_path / "does-not-exist.json", parser)


# ---------------------------------------------------------------------------
# _sanitize_for_filename
# ---------------------------------------------------------------------------


def test_sanitize_for_filename_replaces_reserved_characters() -> None:
    assert _sanitize_for_filename(r'a:b/c\d*e?f"g<h>i|j') == "a-b-c-d-e-f-g-h-i-j"


def test_sanitize_for_filename_leaves_safe_characters_untouched() -> None:
    assert _sanitize_for_filename("normal-name_123") == "normal-name_123"


# ---------------------------------------------------------------------------
# main() — per-story error resilience across a multi-file batch
# ---------------------------------------------------------------------------


def _write_gold_story(path: Path, story_id: str, ja: str, surface: str) -> None:
    path.write_text(
        json.dumps({
            "id": story_id,
            "sentences": [{
                "id": "s01", "ja": ja,
                "words": [{"surface": surface, "dict": surface, "ruby": surface, "pos": "n"}],
            }],
        }, ensure_ascii=False),
        encoding="utf-8",
    )


def test_main_story_error_resilience(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """A story whose adapter call raises contributes all-miss counts, others are unaffected."""
    gold_dir = tmp_path / "gold"
    gold_dir.mkdir()
    stories = [
        ("story1", "あい"),
        ("story2", "うえ"),  # this one's adapter call raises
        ("story3", "おか"),
    ]
    for story_id, ja in stories:
        _write_gold_story(gold_dir / f"{story_id}.json", story_id, ja, ja)

    def fake_factory(*, target_chapter=None):
        def adapter(ja: str) -> list[dict]:
            if ja == "うえ":
                raise RuntimeError("boom")
            return [{"surface": ja, "dict": ja, "ruby": ja, "pos": "n"}]
        return adapter

    monkeypatch.setitem(run_eval.ADAPTERS, "fake-error-adapter", fake_factory)
    out_dir = tmp_path / "results"

    exit_code = run_eval.main(
        [str(gold_dir), "--adapter", "fake-error-adapter", "--out-dir", str(out_dir)]
    )
    assert exit_code == 0

    err = capsys.readouterr().err
    assert "adapter failed on story 'story2'" in err

    (metrics_path,) = out_dir.glob("*__metrics.json")
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))["metrics"]

    assert metrics["per_story"]["story1"]["segmentation"]["sentence_exact_match"] == pytest.approx(1.0)
    assert metrics["per_story"]["story3"]["segmentation"]["sentence_exact_match"] == pytest.approx(1.0)

    story2 = metrics["per_story"]["story2"]
    assert story2["segmentation"]["sentence_exact_match"] == pytest.approx(0.0)
    assert story2["counts"]["b_tp"] == 0
    assert story2["counts"]["dict_aligned"] == 0
    assert story2["counts"]["ruby_aligned"] == 0

    (raw_path,) = out_dir.glob("*__raw.json")
    raw_records = json.loads(raw_path.read_text(encoding="utf-8"))["results"]
    story2_record = next(r for r in raw_records if r["story_id"] == "story2")
    assert story2_record["words"] == []
