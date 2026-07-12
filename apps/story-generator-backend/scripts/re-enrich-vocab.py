"""Add pos and dictionary_form to vocab_supplement entries in committed story JSON files.

Run from repo root:
    python3 apps/story-generator-backend/scripts/re-enrich-vocab.py
    python3 apps/story-generator-backend/scripts/re-enrich-vocab.py apps/web/public/stories
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup — make story_generator importable without pip install
# ---------------------------------------------------------------------------

_BACKEND_SRC = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(_BACKEND_SRC))

_REPO_ROOT = Path(__file__).parents[3]
_GENKI_CSV = _REPO_ROOT / "resources" / "genki1vocab.csv"
_DEFAULT_STORIES_DIR = _REPO_ROOT / "apps" / "web" / "public" / "stories"


def _enrich_file(path: Path, pipeline) -> tuple[int, int]:
    """Enrich vocab_supplement entries in a single story JSON file.

    Returns (enriched_count, skipped_count).
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    supplement: list[dict] = data.get("vocab_supplement", [])
    if not supplement:
        return 0, 0

    enriched = 0
    skipped = 0
    modified = False

    for entry in supplement:
        if "pos" in entry:
            skipped += 1
            continue

        # Enrich using EnrichmentPipeline — pass as single-word list, no furigana suppression
        results = pipeline.enrich_sentence([entry["word"]], None)
        result = results[0]

        pos_code = result["pos_code"]
        dict_form = result["dictionary_form"]

        # Only write fields that are new — avoids unnecessary rewrites on re-runs
        changed = False
        if pos_code:
            entry["pos"] = pos_code
            changed = True
        if dict_form and "dictionary_form" not in entry:
            entry["dictionary_form"] = dict_form
            changed = True
        if changed:
            modified = True
            enriched += 1

    if modified:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return enriched, skipped


def main(stories_dir: Path) -> None:
    """Enrich all story JSON files in stories_dir."""
    from story_generator.enrichment import EnrichmentPipeline

    print("Initialising EnrichmentPipeline (takes ~1–2 s)…")
    pipeline = EnrichmentPipeline(_GENKI_CSV)

    story_files = sorted(p for p in stories_dir.glob("*.json") if p.name != "manifest.json")
    if not story_files:
        print(f"No story files found in {stories_dir}")
        return

    total_enriched = 0
    total_skipped = 0

    for path in story_files:
        enriched, skipped = _enrich_file(path, pipeline)
        print(f"  {path.name}: {enriched} entries enriched, {skipped} skipped")
        total_enriched += enriched
        total_skipped += skipped

    print(
        f"\nDone. {len(story_files)} files processed, "
        f"{total_enriched} entries enriched, {total_skipped} skipped."
    )


if __name__ == "__main__":
    stories_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_STORIES_DIR
    if not stories_dir.is_dir():
        print(f"Error: {stories_dir} is not a directory", file=sys.stderr)
        sys.exit(1)
    main(stories_dir)
