# Story se2-5: Story Library Re-enrichment

Status: review

## Story

As a **developer**,
I want a script that adds `pos` and `dictionary_form` to `vocab_supplement` entries in
existing committed story files,
So that older stories benefit from enriched metadata without needing full regeneration.

## Acceptance Criteria

1. **AC1 — Script enriches entries lacking `pos`**
   - `apps/story-generator-backend/scripts/re-enrich-vocab.py` reads each `vocab_supplement`
     entry in a story JSON file; for entries that already have `pos` set, skips them; for
     entries without `pos`, calls `EnrichmentPipeline.enrich_sentence([word], None)` to get
     `pos_code` and `dictionary_form`, and writes them back when non-empty; all other fields
     (`key`, `word`, `hiragana`, `translation`) are unchanged

2. **AC2 — All stories pass loader validation after script**
   - After running the script against all committed story files, all stories pass
     `loadStory()` validation (TypeScript loader, AJV schema); no `vocab_supplement` entry
     has its `translation`, `word`, `hiragana`, or `key` field changed

3. **AC3 — Stories with no `vocab_supplement` are unchanged**
   - If a story file has no `vocab_supplement` array or it is empty, the file is not modified

4. **AC4 — `manifest.json` is not modified**
   - The script only processes `*.json` files that are NOT `manifest.json`

---

## Tasks / Subtasks

- [x] Task 1: Create `apps/story-generator-backend/scripts/re-enrich-vocab.py`

- [x] Task 2: Run the script against all committed story files in `apps/web/public/stories/`

- [x] Task 3: Run `pnpm test:unit` in `apps/web` and `packages/story-loader` to confirm all
      stories still pass loader validation

- [x] Task 4: Confirm no `manifest.json` was modified

---

## Dev Notes

### Script overview

The script is a standalone CLI tool. It:
1. Initialises `EnrichmentPipeline` once (takes ~1–2 s)
2. Globs all `*.json` files in the target directory, excluding `manifest.json`
3. For each file, enriches any `vocab_supplement` entries that lack `pos`
4. Writes modified files back in-place (preserving JSON indentation=2, ensure_ascii=False)

Run from repo root:
```
python3 apps/story-generator-backend/scripts/re-enrich-vocab.py
# or with explicit path:
python3 apps/story-generator-backend/scripts/re-enrich-vocab.py apps/web/public/stories
```

### File structure

```
apps/story-generator-backend/
  scripts/
    kill_ports.py          ← existing script (reference for style)
    re-enrich-vocab.py     ← NEW
```

No `__init__.py` needed in `scripts/` — it is not a package.

### sys.path setup

The script lives in `scripts/` which is NOT under `src/`, so `story_generator` is not
importable without a sys.path insertion. Mirror the pattern from `conftest.py`:

```python
import sys
from pathlib import Path

_BACKEND_SRC = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(_BACKEND_SRC))
```

With this, `from story_generator.enrichment import EnrichmentPipeline` works.

### CSV and stories paths

The Genki CSV lives at `resources/genki1vocab.csv` relative to repo root.
Repo root is 3 levels up from the script (`scripts/ → story-generator-backend/ → apps/ → repo root`):

```python
_REPO_ROOT = Path(__file__).parent.parent.parent.parent
_GENKI_CSV = _REPO_ROOT / "resources" / "genki1vocab.csv"
_DEFAULT_STORIES_DIR = _REPO_ROOT / "apps" / "web" / "public" / "stories"
```

Verify with `parents` indexing:
- `Path(__file__).parents[0]` = `.../scripts/`
- `Path(__file__).parents[1]` = `.../story-generator-backend/`
- `Path(__file__).parents[2]` = `.../apps/`
- `Path(__file__).parents[3]` = repo root (`nihonnohon/`)

So `_REPO_ROOT = Path(__file__).parents[3]`.

### Enrichment call pattern

For each `vocab_supplement` entry without `pos`:

```python
results = pipeline.enrich_sentence([entry["word"]], None)
enriched = results[0]  # always exactly one result for one input word
pos_code = enriched["pos_code"]       # e.g. "n", "v5", "" (empty = unknown)
dict_form = enriched["dictionary_form"]  # e.g. "ベンチ", "食べる"

if pos_code:
    entry["pos"] = pos_code
if dict_form:
    entry["dictionary_form"] = dict_form
```

Only write the field when non-empty — absent `pos`/`dictionary_form` is valid per schema.
Do NOT write `pos: ""` — the UI shows no badge for absent pos, but `""` (falsy) would also
work due to the `{lookupState.pos && ...}` guard in InfoPanel; still, prefer absence.

### JSON serialisation

Use `json.dumps(data, ensure_ascii=False, indent=2)` followed by a trailing newline
(`"\n"`) when writing, to match the format of the existing story files. Confirm the
existing files use 2-space indentation before writing.

Use UTF-8 encoding for both read and write.

### Skip conditions

An entry should be skipped (left unchanged) when:
- `"pos" in entry` evaluates True (even if the value is empty string — don't re-analyse)
- `entry.get("pos") is not None` is an equivalent guard

Use `"pos" in entry` as the canonical check.

### Dry-run and progress output

Print a summary line per file:
```
genki-i-ch1-classroom-introduction.json: 8 entries enriched, 0 skipped
genki-i-ch23-cats-many-stories.json: 12 entries enriched, 0 skipped
...
Done. 29 files processed, 243 entries enriched.
```

A `--dry-run` flag is optional but not required by the AC.

### Validating results after running

After running the script, run the unit tests that exercise the loader:

```bash
# From packages/story-loader — exercises AJV schema validation on fixture JSON
pnpm test:unit

# From apps/web — exercises any story-loading integration tests
pnpm test:unit
```

The TypeScript `loadV2` function will throw a `LoaderError` if any `vocab_supplement`
entry has a malformed `pos` or `dictionary_form` value — these are unconstrained string
fields in the schema, so any string is valid, but the tests will catch any file corruption.

### What NOT to do

- Do NOT re-enrich entries that already have `pos` — the key `"pos"` present (any value)
  means skip. This is important: re-running the script must be idempotent.
- Do NOT modify `key`, `word`, `hiragana`, or `translation` fields.
- Do NOT modify `manifest.json`.
- Do NOT call `build_enriched_story` — that method builds a whole story from segments.
  The right method is `enrich_sentence([word], None)`.
- Do NOT add `"gloss"` or `"gloss_source"` to the JSON entries — those are internal to the
  enrichment pipeline, not part of the story JSON schema.
- Do NOT change the order of keys in the JSON objects — preserve the key order from the
  original file; appending `pos` and `dictionary_form` at the end of each entry object is
  fine.

### Files to create / modify

| File | Action |
|------|--------|
| `apps/story-generator-backend/scripts/re-enrich-vocab.py` | **CREATE** — re-enrichment script |
| `apps/web/public/stories/*.json` (29 story files) | **MODIFY** — add `pos` + `dictionary_form` to `vocab_supplement` entries |

`manifest.json` and `kill_ports.py` are **NOT** modified.

### Existing scripts reference

`apps/story-generator-backend/scripts/kill_ports.py` uses plain stdlib only and is short —
follow its style (no argument parser library needed unless the AC requires it, which it
doesn't for the current scope).

### Comment style

Follow the project feedback: succinct docstrings for module and functions (one-liner),
block comments for major sections. See `enrichment.py` for reference.

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-04. Script created at `apps/story-generator-backend/scripts/re-enrich-vocab.py`.
Runs standalone from repo root; inserts `src/` into sys.path to import `EnrichmentPipeline` without
pip install. Calls `enrich_sentence([word], None)` per entry (single-word, no furigana suppression),
writes `pos` and `dictionary_form` only when non-empty. Entries already bearing `pos` are skipped —
idempotent on re-runs. Script ran against all 29 committed story files: 566 entries enriched, 12 left
without `pos` because SudachiPy returned empty pos_code (schema allows absence). `manifest.json`
untouched. All 34 story-loader tests and 179 web app tests pass with no regressions.

### File List

- `apps/story-generator-backend/scripts/re-enrich-vocab.py` — CREATED: re-enrichment script
- `apps/web/public/stories/*.json` (29 files) — MODIFIED: `pos` and `dictionary_form` added to
  `vocab_supplement` entries

### Change Log

- 2026-06-04: Created re-enrich-vocab.py script; ran against 29 story files, enriching 566
  vocab_supplement entries with `pos` and `dictionary_form` from EnrichmentPipeline
