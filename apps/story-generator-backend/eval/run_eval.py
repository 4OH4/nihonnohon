"""Benchmark harness for word segmentation, dictionary form, and ruby accuracy.

The system under test is treated as a black box: a callable that receives the frozen
Japanese input (a full story's Japanese text, joined across its gold sentences) and
returns a list of word annotations. This keeps the benchmark architecture-agnostic — it
makes no assumption that segmentation and enrichment are separate steps.

Because the benchmark input (``ja``) is fixed, the system's output and the gold are
both partitions of the *identical* string, so they can be aligned by character offset.
That lets us score segmentation independently of dictionary-form / ruby accuracy.

Usage:
    python run_eval.py                       # default gold, SudachiPy baseline adapter
    python run_eval.py eval/gold/foo.json    # explicit gold file
    python run_eval.py eval/gold/            # directory of gold files, aggregated
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Make the story_generator package (and this dir's `adapters` package) importable when run directly
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from story_generator.enrichment import has_kanji  # noqa: E402

from adapters import ADAPTERS, Adapter  # noqa: E402

#: POS codes whose tokens are content words worth a dictionary-form score.
_CONTENT_POS = {"n", "v1", "v5", "v-irr", "adj-i", "adj-na", "adv", "pron", "conj"}


# ---------------------------------------------------------------------------
# Alignment
# ---------------------------------------------------------------------------


def _spans(words: list[dict]) -> dict[tuple[int, int], dict]:
    """Map each word to its (start, end) character span over the reconstructed sentence."""
    out: dict[tuple[int, int], dict] = {}
    pos = 0
    for w in words:
        surface = w["surface"]
        out[(pos, pos + len(surface))] = w
        pos += len(surface)
    return out


def _internal_boundaries(words: list[dict]) -> set[int]:
    """Return the set of internal cut offsets (excludes 0 and the final offset)."""
    bounds: set[int] = set()
    pos = 0
    for w in words[:-1]:
        pos += len(w["surface"])
        bounds.add(pos)
    return bounds


def _sentence_exact_match(
    pred_spans: dict[tuple[int, int], dict], gold_words: list[dict], start: int, end: int
) -> bool:
    """True iff pred_spans exactly tiles [start, end) with matching surfaces, in order.

    Derived purely from character-offset spans over the whole story's predicted output —
    no reliance on the adapter's own returned sentence boundaries.
    """
    pos = start
    for gw in gold_words:
        span = (pos, pos + len(gw["surface"]))
        pw = pred_spans.get(span)
        if pw is None or pw["surface"] != gw["surface"]:
            return False
        pos = span[1]
    return pos == end


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def score(story: dict, adapter: Adapter) -> dict:
    """Call the adapter once with the whole story's Japanese text and score it against gold.

    Returns derived rates plus `per_sentence` (offset-sliced diagnostic breakdown) and
    `counts` (raw counts, consumed by aggregate() for cross-story micro-averaging).
    """
    full_ja = "".join(s["ja"] for s in story["sentences"])
    pred_words = adapter(full_ja)  # ONE call for the whole story
    pred_spans = _spans(pred_words)
    pb = _internal_boundaries(pred_words)

    flat_gold_words = [w for s in story["sentences"] for w in s["words"]]
    gold_spans = _spans(flat_gold_words)  # absolute offsets across the story
    gb = _internal_boundaries(flat_gold_words)

    counts = {
        "b_tp": len(gb & pb), "b_fp": len(pb - gb), "b_fn": len(gb - pb),
        "dict_total": 0, "dict_aligned": 0, "dict_correct": 0,
        "ruby_total": 0, "ruby_aligned": 0, "ruby_correct": 0,
        "sent_exact": 0,
    }
    for span, gw in gold_spans.items():
        pw = pred_spans.get(span)  # None → boundary mismatch (segmentation error)
        if gw.get("pos") in _CONTENT_POS:
            counts["dict_total"] += 1
            if pw is not None:
                counts["dict_aligned"] += 1
                counts["dict_correct"] += int(pw.get("dict") == gw["dict"])
        if has_kanji(gw["surface"]):
            counts["ruby_total"] += 1
            if pw is not None:
                counts["ruby_aligned"] += 1
                counts["ruby_correct"] += int(pw.get("ruby") == gw["ruby"])

    # Per-sentence breakdown (offset-sliced from the whole-story pred_spans) + sentence_exact_match
    per_sentence: list[dict] = []
    offset = 0
    for s in story["sentences"]:
        start, end = offset, offset + len(s["ja"])
        offset = end
        exact = _sentence_exact_match(pred_spans, s["words"], start, end)
        counts["sent_exact"] += int(exact)
        s_dict_ok = sum(
            1 for span, gw in gold_spans.items()
            if start <= span[0] < end and gw.get("pos") in _CONTENT_POS
            and (pw := pred_spans.get(span)) is not None and pw.get("dict") == gw["dict"]
        )
        s_ruby_ok = sum(
            1 for span, gw in gold_spans.items()
            if start <= span[0] < end and has_kanji(gw["surface"])
            and (pw := pred_spans.get(span)) is not None and pw.get("ruby") == gw["ruby"]
        )
        per_sentence.append({"id": s["id"], "seg_exact": exact, "dict_ok": s_dict_ok, "ruby_ok": s_ruby_ok})

    result = _derive_rates(counts, len(story["sentences"]))
    result["per_sentence"] = per_sentence
    result["counts"] = counts  # raw counts, consumed by aggregate()
    return result


def _derive_rates(counts: dict, n_sentences: int) -> dict:
    """Derive precision/recall/F1/accuracy rates from raw counts.

    Shared by score() (one story's counts) and aggregate() (summed across stories) so
    that multi-story metrics are always a proper micro-average, never an average of rates.
    """
    def rate(n: int, d: int) -> float:
        return n / d if d else 0.0

    seg_p = rate(counts["b_tp"], counts["b_tp"] + counts["b_fp"])
    seg_r = rate(counts["b_tp"], counts["b_tp"] + counts["b_fn"])
    return {
        "n_sentences": n_sentences,
        "segmentation": {
            "boundary_precision": seg_p,
            "boundary_recall": seg_r,
            "boundary_f1": rate(2 * seg_p * seg_r, seg_p + seg_r),
            "sentence_exact_match": rate(counts["sent_exact"], n_sentences),
        },
        "dictionary_form": {
            "accuracy_strict": rate(counts["dict_correct"], counts["dict_total"]),      # seg miss = wrong
            "accuracy_aligned": rate(counts["dict_correct"], counts["dict_aligned"]),   # boundary-matched only
            "n_content_words": counts["dict_total"],
        },
        "ruby": {
            "accuracy_strict": rate(counts["ruby_correct"], counts["ruby_total"]),
            "accuracy_aligned": rate(counts["ruby_correct"], counts["ruby_aligned"]),
            "n_kanji_words": counts["ruby_total"],
        },
    }


def aggregate(per_story_results: list[tuple[str, dict]]) -> dict:
    """Sum raw counts across stories BEFORE computing rates, plus a per_story breakdown.

    Summing counts first (rather than averaging each story's rates) keeps multi-story
    metrics a proper micro-average — stories with more sentences/content-words correctly
    carry more weight. A single-story call reproduces score()'s own numbers exactly, since
    summing one story's counts is a no-op.
    """
    total_counts = {k: 0 for k in ("b_tp", "b_fp", "b_fn", "dict_total", "dict_aligned",
                                     "dict_correct", "ruby_total", "ruby_aligned",
                                     "ruby_correct", "sent_exact")}
    total_n_sentences = 0
    per_story: dict[str, dict] = {}
    for story_id, r in per_story_results:
        for k in total_counts:
            total_counts[k] += r["counts"][k]
        total_n_sentences += r["n_sentences"]
        per_story[story_id] = r

    result = _derive_rates(total_counts, total_n_sentences)
    result["per_story"] = per_story
    return result


# ---------------------------------------------------------------------------
# Run provenance
# ---------------------------------------------------------------------------


def _git_commit() -> str:
    """Return the current HEAD commit hash, or "unknown" if git is unavailable.

    Never raises — a missing git binary or a non-repo directory must not fail the run.
    Uncommitted changes are ignored; HEAD is recorded regardless.
    """
    repo_root = Path(__file__).resolve().parents[3]
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return "unknown"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _sanitize_for_filename(value: str) -> str:
    """Replace characters unsafe in filenames (notably reserved on Windows) with "-"."""
    return re.sub(r'[\\/:*?"<>|]', "-", value)


def _resolve_gold_files(gold_arg: Path, parser: argparse.ArgumentParser) -> list[Path]:
    """Resolve the `gold` CLI argument to a sorted list of gold JSON files.

    A single file is returned as-is; a directory is glob'd non-recursively for `*.json`,
    matching the flat `gold/<id>.json` convention documented in the README.
    """
    if not gold_arg.exists():
        parser.error(f"gold path not found: {gold_arg}")
    if gold_arg.is_dir():
        files = sorted(gold_arg.glob("*.json"))
        if not files:
            parser.error(f"gold directory contains no *.json files: {gold_arg}")
        return files
    return [gold_arg]


def _print_report(gold_id: str, adapter_name: str, results: dict) -> None:
    """Print a human-readable metrics summary."""
    seg = results["segmentation"]
    dct = results["dictionary_form"]
    rby = results["ruby"]
    print(f"\n=== Eval: {gold_id}  |  adapter: {adapter_name} ({results['n_sentences']} sentences) ===\n")
    print("Segmentation")
    print(f"  boundary P / R / F1   : {seg['boundary_precision']:.3f} / {seg['boundary_recall']:.3f} / {seg['boundary_f1']:.3f}")
    print(f"  sentence exact match  : {seg['sentence_exact_match']:.3f}")
    print("Dictionary form")
    print(f"  accuracy (strict)     : {dct['accuracy_strict']:.3f}  over {dct['n_content_words']} content words")
    print(f"  accuracy (aligned)    : {dct['accuracy_aligned']:.3f}  (boundary-matched tokens only)")
    print("Ruby")
    print(f"  accuracy (strict)     : {rby['accuracy_strict']:.3f}  over {rby['n_kanji_words']} kanji words")
    print(f"  accuracy (aligned)    : {rby['accuracy_aligned']:.3f}  (boundary-matched tokens only)")

    per_story = results["per_story"]
    if len(per_story) == 1:
        # Single-story run: keep the familiar per-sentence breakdown.
        (story_result,) = per_story.values()
        print("\nPer-sentence (seg exact | dict ok | ruby ok):")
        for ps in story_result["per_sentence"]:
            flag = "Y" if ps["seg_exact"] else "n"
            print(f"  {ps['id']}: seg {flag}  dict {ps['dict_ok']}  ruby {ps['ruby_ok']}")
    else:
        # Multi-story run: a compact one-line-per-story summary instead.
        print("\nPer-story (boundary F1 | sentence exact | dict aligned | ruby aligned):")
        for story_id, r in per_story.items():
            s_seg, s_dct, s_rby = r["segmentation"], r["dictionary_form"], r["ruby"]
            print(
                f"  {story_id}: F1 {s_seg['boundary_f1']:.3f}  exact {s_seg['sentence_exact_match']:.3f}"
                f"  dict {s_dct['accuracy_aligned']:.3f}  ruby {s_rby['accuracy_aligned']:.3f}"
            )
    print()


def main(argv: list[str] | None = None) -> int:
    """Parse CLI args, run the chosen adapter, print the report, and archive the run."""
    default_gold = Path(__file__).resolve().parent / "gold" / "eval-genki6-daily-life.json"
    default_out_dir = Path(__file__).resolve().parent / "results"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "gold", nargs="?", type=Path, default=default_gold,
        help="Path to a gold JSON file, or a directory of gold JSON files to aggregate",
    )
    parser.add_argument(
        "--adapter", choices=list(ADAPTERS), default="sudachi-baseline", help="System-under-test adapter"
    )
    parser.add_argument("--out-dir", type=Path, default=default_out_dir, help="Directory for result files")
    args = parser.parse_args(argv)

    gold_files = _resolve_gold_files(args.gold, parser)

    # Build only the chosen adapter — never construct gemini-analysis unless selected (AC5, AC7).
    # Neither adapter is story-dependent (gemini-analysis always targets chapter=None, matching
    # the "Unspecified" Path-C UI config — see eval/adapters/gemini_analysis.py), so one adapter
    # is built once and reused across every story in the run.
    factory = ADAPTERS[args.adapter]
    adapter = factory()
    if args.adapter == "sudachi-baseline":
        model = None
    else:
        from story_generator.agent import GEMINI_MODEL

        model = GEMINI_MODEL

    started_at = datetime.now(timezone.utc)
    per_story_results: list[tuple[str, dict]] = []
    all_raw_records: list[dict] = []
    seen_story_ids: set[str] = set()
    story_id = None

    for gold_path in gold_files:
        story = json.loads(gold_path.read_text(encoding="utf-8"))
        if "sentences" not in story:
            parser.error(f"gold file missing 'sentences' key: {gold_path}")
        story_id = story.get("id", gold_path.stem)
        if story_id in seen_story_ids:
            parser.error(f"duplicate story id {story_id!r} across gold files (in {gold_path})")
        seen_story_ids.add(story_id)

        # Capture the single whole-story call as score() consumes the adapter — one call per
        # story total, not per sentence. A story's failure (bad LLM JSON, empty response, etc.)
        # is recorded as an empty output rather than aborting the whole run, so a partial
        # benchmark is never lost.
        captured: list[list[dict]] = []

        def _capturing(ja: str, _adapter=adapter, _story_id=story_id) -> list[dict]:
            try:
                out = _adapter(ja)
            except Exception as exc:  # noqa: BLE001 - one bad story must not abort the whole run
                print(
                    f"  ! adapter failed on story {_story_id!r} (recording empty output): {exc}",
                    file=sys.stderr,
                )
                out = []
            captured.append(out)
            return out

        result = score(story, _capturing)
        assert len(captured) == 1, (
            f"score() must call the adapter exactly once per gold story ({story_id}); "
            f"got {len(captured)}"
        )
        per_story_results.append((story_id, result))

        # Offset-bucket the single whole-story predicted output into per-sentence raw records.
        # A predicted word is assigned to whichever gold sentence's range its start offset falls
        # within — this is a read-only grouping for raw.json readability, not a re-split of the
        # adapter's output; any word whose span straddles a gold sentence boundary is itself
        # visible diagnostic signal.
        pred_words = captured[0]
        pred_spans = _spans(pred_words)
        offset = 0
        for s in story["sentences"]:
            start, end = offset, offset + len(s["ja"])
            offset = end
            sentence_pred_words = [pw for span, pw in pred_spans.items() if start <= span[0] < end]
            all_raw_records.append({
                "story_id": story_id, "id": s["id"], "ja": s["ja"], "words": sentence_pred_words,
            })

    aggregated = aggregate(per_story_results)
    n_stories = len(gold_files)
    gold_id = story_id if n_stories == 1 else f"{args.gold.name}[{n_stories} stories]"
    gold_path_value = str(gold_files[0]) if n_stories == 1 else [str(p) for p in gold_files]

    run_meta = {
        "started_at": started_at.isoformat(),
        "adapter": args.adapter,
        "adapter_module": factory.__module__,
        "git_commit": _git_commit(),
        "gold_id": gold_id,
        "gold_path": gold_path_value,
        "n_sentences": aggregated["n_sentences"],
        "model": model,
    }

    _print_report(gold_id, args.adapter, aggregated)

    # Write the raw SUT output and the metrics as a timestamped, provenance-tagged pair.
    args.out_dir.mkdir(parents=True, exist_ok=True)
    ts = started_at.strftime("%Y%m%dT%H%M%SZ")
    stem = f"{ts}__{_sanitize_for_filename(gold_id)}__{args.adapter}"
    raw_path = args.out_dir / f"{stem}__raw.json"
    metrics_path = args.out_dir / f"{stem}__metrics.json"
    if raw_path.exists() or metrics_path.exists():
        # Same-second collision (e.g. scripted/batch runs) — disambiguate rather than overwrite.
        stem = f"{stem}-{uuid.uuid4().hex[:6]}"
        raw_path = args.out_dir / f"{stem}__raw.json"
        metrics_path = args.out_dir / f"{stem}__metrics.json"

    raw_path.write_text(
        json.dumps({"run": run_meta, "results": all_raw_records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    metrics_path.write_text(
        json.dumps({"run": run_meta, "metrics": aggregated}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {raw_path}")
    print(f"Wrote {metrics_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
