"""Benchmark harness for word segmentation, dictionary form, and ruby accuracy.

The system under test is treated as a black box: a callable that receives a frozen
Japanese sentence and returns a list of word annotations. This keeps the benchmark
architecture-agnostic — it makes no assumption that segmentation and enrichment are
separate steps.

Because the benchmark input (``ja``) is fixed, the system's output and the gold are
both partitions of the *identical* string, so they can be aligned by character offset.
That lets us score segmentation independently of dictionary-form / ruby accuracy.

Usage:
    python run_eval.py                       # default gold, SudachiPy baseline adapter
    python run_eval.py eval/gold/foo.json    # explicit gold file
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Callable

# Make the story_generator package importable when run directly
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from story_generator.enrichment import has_kanji  # noqa: E402

#: Adapter contract — given a Japanese sentence, return one dict per word token.
#: Each dict must carry: surface, dict, ruby; pos is optional (used only for scoping).
Adapter = Callable[[str], list[dict]]

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


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def score(gold: dict, adapter: Adapter) -> dict:
    """Run the adapter over every gold sentence and accumulate metrics.

    Returns a dict of aggregate counts and derived rates.
    """
    # Segmentation (micro-averaged boundary P/R/F1 + per-sentence exact match)
    b_tp = b_fp = b_fn = 0
    sent_exact = 0

    # Dictionary form and ruby — split into "strict" (segmentation miss counts against)
    # and "aligned" (scored only where the span boundary matched gold).
    dict_total = dict_aligned = dict_correct = 0
    ruby_total = ruby_aligned = ruby_correct = 0

    per_sentence: list[dict] = []

    for s in gold["sentences"]:
        gold_words = s["words"]
        pred_words = adapter(s["ja"])

        # --- segmentation ---
        gb = _internal_boundaries(gold_words)
        pb = _internal_boundaries(pred_words)
        b_tp += len(gb & pb)
        b_fp += len(pb - gb)
        b_fn += len(gb - pb)
        exact = [w["surface"] for w in gold_words] == [w["surface"] for w in pred_words]
        sent_exact += int(exact)

        # --- dictionary form + ruby, via span alignment ---
        pred_spans = _spans(pred_words)
        s_dict_ok = s_ruby_ok = 0
        for (span, gw) in _spans(gold_words).items():
            pw = pred_spans.get(span)  # None → boundary mismatch (segmentation error)

            if gw.get("pos") in _CONTENT_POS:
                dict_total += 1
                if pw is not None:
                    dict_aligned += 1
                    if pw.get("dict") == gw["dict"]:
                        dict_correct += 1
                        s_dict_ok += 1

            if has_kanji(gw["surface"]):
                ruby_total += 1
                if pw is not None:
                    ruby_aligned += 1
                    if pw.get("ruby") == gw["ruby"]:
                        ruby_correct += 1
                        s_ruby_ok += 1

        per_sentence.append({
            "id": s["id"],
            "seg_exact": exact,
            "dict_ok": s_dict_ok,
            "ruby_ok": s_ruby_ok,
        })

    def rate(n: int, d: int) -> float:
        return n / d if d else 0.0

    seg_p = rate(b_tp, b_tp + b_fp)
    seg_r = rate(b_tp, b_tp + b_fn)
    return {
        "n_sentences": len(gold["sentences"]),
        "segmentation": {
            "boundary_precision": seg_p,
            "boundary_recall": seg_r,
            "boundary_f1": rate(2 * seg_p * seg_r, seg_p + seg_r),
            "sentence_exact_match": rate(sent_exact, len(gold["sentences"])),
        },
        "dictionary_form": {
            "accuracy_strict": rate(dict_correct, dict_total),      # seg miss = wrong
            "accuracy_aligned": rate(dict_correct, dict_aligned),   # boundary-matched only
            "n_content_words": dict_total,
        },
        "ruby": {
            "accuracy_strict": rate(ruby_correct, ruby_total),
            "accuracy_aligned": rate(ruby_correct, ruby_aligned),
            "n_kanji_words": ruby_total,
        },
        "per_sentence": per_sentence,
    }


# ---------------------------------------------------------------------------
# Reference adapter — SudachiPy end-to-end baseline (no LLM, no API key)
# ---------------------------------------------------------------------------


def make_sudachi_baseline_adapter() -> Adapter:
    """Build a JA→annotations adapter using SudachiPy for BOTH segmentation and enrichment.

    This is a reference baseline only — the production system currently segments with the
    LLM, not SudachiPy — but it runs offline and exercises the harness end to end.
    """
    import sudachipy

    from story_generator.enrichment import EnrichmentPipeline

    genki_csv = Path(__file__).resolve().parents[3] / "resources" / "genki1vocab.csv"
    pipeline = EnrichmentPipeline(genki_csv_path=genki_csv)
    tokenizer = pipeline._tokenizer  # reuse the loaded tokenizer

    def adapter(ja: str) -> list[dict]:
        # Segment with SudachiPy split mode C, then enrich each surface token.
        surfaces = [m.surface() for m in tokenizer.tokenize(ja, sudachipy.SplitMode.C)]
        enriched = pipeline.enrich_sentence(surfaces, seen_dict_forms=None)
        return [
            {
                "surface": surf,
                "dict": e["dictionary_form"],
                "ruby": e["annotated"],
                "pos": e["pos_code"],
            }
            for surf, e in zip(surfaces, enriched)
        ]

    return adapter


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


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
    print("\nPer-sentence (seg exact | dict ok | ruby ok):")
    for ps in results["per_sentence"]:
        flag = "Y" if ps["seg_exact"] else "n"
        print(f"  {ps['id']}: seg {flag}  dict {ps['dict_ok']}  ruby {ps['ruby_ok']}")
    print()


def main(argv: list[str]) -> int:
    """Load a gold file, run the chosen adapter, print metrics."""
    default_gold = Path(__file__).resolve().parent / "gold" / "eval-genki6-daily-life.json"
    gold_path = Path(argv[1]) if len(argv) > 1 else default_gold
    gold = json.loads(gold_path.read_text(encoding="utf-8"))

    adapter = make_sudachi_baseline_adapter()
    results = score(gold, adapter)
    _print_report(gold.get("id", gold_path.stem), "sudachi-baseline", results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
