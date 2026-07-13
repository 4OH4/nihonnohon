"""Reference adapter — SudachiPy end-to-end baseline (no LLM, no API key).

Moved verbatim from ``run_eval.py`` (se3-6, AC1) — only the ``resources`` path depth was
re-verified for this module's new location one directory deeper.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable


def make_sudachi_baseline_adapter() -> "Callable[[str], list[dict]]":
    """Build a JA→annotations adapter using SudachiPy for BOTH segmentation and enrichment.

    This is a reference baseline only — the production system currently segments with the
    LLM, not SudachiPy — but it runs offline and exercises the harness end to end.
    """
    import sudachipy

    from story_generator.enrichment import EnrichmentPipeline

    genki_csv = Path(__file__).resolve().parents[4] / "resources" / "genki1vocab.csv"
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
