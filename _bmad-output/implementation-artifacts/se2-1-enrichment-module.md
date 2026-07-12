# Story se2-1: Enrichment Module

Status: done

## Story

As a **developer**,
I want a tested `EnrichmentPipeline` class in `enrichment.py`,
so that furigana generation, vocabulary lookup, and POS classification are encapsulated,
deterministic, and independently testable before being wired into the generation pipeline.

## Acceptance Criteria

1. **AC1 — `EnrichmentPipeline` class construction**
   - `apps/story-generator-backend/src/story_generator/enrichment.py` exports an `EnrichmentPipeline` class
   - Constructor: `__init__(self, genki_csv_path: Path) -> None`
   - Initialises SudachiPy `Dictionary` and calls `.create()` once at construction; both are stored as instance attributes
   - Loads the Genki vocab index from `genki_csv_path` once at construction; stores as two lookup dicts (`_kanji_index`, `_kana_index`)
   - Initialises a `Jamdict` instance once at construction; stored as instance attribute
   - No lazy initialisation — all three resources are ready after `__init__` returns

2. **AC2 — `enrich_sentence` signature and return shape**
   - `enrich_sentence(self, words: list[str], seen_dict_forms: set[str] | None = None) -> list[dict]`
   - Returns one dict per word containing keys: `annotated`, `dictionary_form`, `reading`, `pos_code`
   - If a gloss is found: also includes `gloss` (str) and `gloss_source` (`"genki"` or `"jmdict"`)
   - If no gloss: `gloss` and `gloss_source` are absent from the dict (not present as `None`)
   - `seen_dict_forms=None` → annotate every kanji word on every occurrence
   - `seen_dict_forms=set()` → annotate only the first occurrence of each dictionary form; the set is updated in-place so the caller can pass the same set across multiple `enrich_sentence` calls for a full story

3. **AC3 — Okurigana stripping**
   - `食べます` → `annotated = "食[た]べます"` (only the kanji `食` is bracketed; `べます` is bare)
   - `起きて` → `annotated = "起[お]きて"`
   - `帰った` → `annotated = "帰[かえ]った"`
   - `勉強する` → `annotated = "勉強[べんきょう]する"` (all-kanji stem; する is bare)
   - `朝ごはん` → `annotated = "朝[あさ]ごはん"` (mixed: only kanji morpheme `朝` gets bracket)
   - Pure kana words (e.g. `は`, `を`, `です`) → `annotated` equals the surface unchanged

4. **AC4 — First-occurrence furigana suppression**
   - When `seen_dict_forms` is a set and `食べる` is in it before `食べた` is processed, `食べた` returns `annotated = "食べた"` with no brackets
   - When `seen_dict_forms` is `None`, both occurrences get furigana

5. **AC5 — POS codes**
   - Suru-verb compound e.g. `勉強します` → `dictionary_form = "勉強する"`, `pos_code = "v-irr"`
   - Godan verb e.g. `飲みます` → `pos_code = "v5"`
   - Ichidan verb e.g. `食べます` → `pos_code = "v1"`
   - i-adjective e.g. `おいしい` → `pos_code = "adj-i"`
   - na-adjective e.g. `きれい` → `pos_code = "adj-na"` (形状詞 in SudachiPy)
   - Particle e.g. `は` → `pos_code = "prt"`
   - Noun e.g. `大学` → `pos_code = "n"`

6. **AC6 — Gloss lookup**
   - Word whose `dictionary_form` matches a Genki CSV entry (kanji or kana column) → `gloss` is the Genki English definition, `gloss_source = "genki"`
   - Word not in Genki but in JMdict → `gloss` is the first gloss of the first sense of the first entry, `gloss_source = "jmdict"`
   - Short all-kana word ≤ 2 characters not in Genki → no JMdict lookup; `gloss` absent

7. **AC7 — `requirements.txt` updated**
   - `apps/story-generator-backend/requirements.txt` includes `sudachipy`, `sudachidict-core`, `jamdict`, `jamdict-data-fix`

8. **AC8 — Tests pass**
   - `apps/story-generator-backend/tests/test_enrichment.py` covers all cases in AC3–AC6
   - `pytest` exits 0 (tests skip gracefully if `sudachipy` is not installed via `pytest.importorskip`)

---

## Tasks / Subtasks

- [x] Task 1: Update `requirements.txt` (AC7)
  - [x] Append `sudachipy`, `sudachidict-core`, `jamdict`, `jamdict-data-fix` to `apps/story-generator-backend/requirements.txt`

- [x] Task 2: Create `enrichment.py` (AC1–AC6)
  - [x] Copy all shared utilities from the prototype into `enrichment.py` as module-level helpers (see Dev Notes — they are already validated):
    - `_KANJI_RE`, `has_kanji()`, `_is_kana()`, `kata_to_hira()`
    - `_AUXILIARY_POS`, `_CONTENT_POS`, `_ALL_KANA_RE`
    - `_POS_MAP`
    - `_annotate_morpheme()` (okurigana stripping)
    - `_derive_dictionary_form()`, `_dominant_pos()`, `_pos_code()`
    - `load_genki_index()`, `lookup_genki()`
    - `lookup_gloss()`
  - [x] Write `EnrichmentPipeline.__init__(self, genki_csv_path: Path)`
  - [x] Write `EnrichmentPipeline.enrich_sentence(self, words, seen_dict_forms)` composing the helpers
  - [x] Add module docstring and succinct docstrings on the class and public method

- [x] Task 3: Write `tests/test_enrichment.py` (AC8)
  - [x] `pytest.importorskip("sudachipy")` at module top; tests skip cleanly if not installed
  - [x] Module-scoped fixture: one `EnrichmentPipeline(genki_csv_path=...)` shared across all tests
  - [x] Test cases as specified in AC3–AC6 (see Dev Notes for exact cases)

---

## Dev Notes

### Reference implementation — read this first

`apps/story-generator-backend/dev/tokenize_prototype.py` is a **fully working end-to-end prototype** of all enrichment logic. The prototype is validated and correct. The task is to **lift the functions out of the prototype and encapsulate them in `EnrichmentPipeline`** — do not rewrite logic from scratch.

Every module-level function in the prototype (`_annotate_morpheme`, `_derive_dictionary_form`, `_pos_code`, etc.) should move into `enrichment.py` as-is (or with minor clean-up for style). Only the `translate_and_segment()` Gemini call and `main()` belong to later stories — do not include them.

### Exact `enrich_sentence` return shape

```python
# Word WITH gloss:
{
    "annotated": "食[た]べます",
    "dictionary_form": "食べる",
    "reading": "たべます",
    "pos_code": "v1",
    "gloss": "to eat",
    "gloss_source": "genki",  # or "jmdict"
}

# Word WITHOUT gloss (particle, short kana, etc.):
{
    "annotated": "は",
    "dictionary_form": "は",
    "reading": "は",
    "pos_code": "prt",
    # gloss and gloss_source intentionally absent
}
```

No `pos` field (the verbose Japanese major-POS string from SudachiPy) — only `pos_code` is in the return dict.

### Gloss decision logic

Only add a gloss if the word's dominant POS is in `_CONTENT_POS` (名詞, 動詞, 形容詞, 形状詞, 副詞, 接続詞, 感動詞, 代名詞). Otherwise skip dictionary lookup entirely — don't check Genki or JMdict for particles/auxiliaries. This mirrors the prototype's `if w["pos"] in _CONTENT_POS:` guard.

Short kana skip: `len(dictionary_form) <= 2 and _ALL_KANA_RE.match(dictionary_form)` → skip JMdict. This is inside `lookup_gloss()` — keep it there.

### `seen_dict_forms` semantics

The set is updated in-place inside `enrich_sentence`. A word is added to `seen_dict_forms` **only if it actually contains kanji** (tested with `has_kanji(word)` on the original surface, before annotation). Pure-kana words are not tracked. This prevents particles and kana words from bloating the seen set.

```python
# Simplified inner loop inside enrich_sentence:
if seen_dict_forms is not None and dict_form in seen_dict_forms:
    annotated = word  # subsequent occurrence: plain surface
else:
    annotated = "".join(_annotate_morpheme(...) for m in morphemes)
    if seen_dict_forms is not None and has_kanji(word):
        seen_dict_forms.add(dict_form)
```

### SudachiPy split mode

Use `sudachipy.SplitMode.C` (longest compound units). This keeps `勉強します` as a single `sudachipy.tokenize()` call returning two morphemes (`勉強` + `します`), letting `_derive_dictionary_form` detect the suru-verb compound pattern.

### Constructor `genki_csv_path` default

The prototype uses a hardcoded path relative to `__file__`. The production class must accept the path as an argument. Do NOT hardcode a default — `main.py` will pass `Path(os.environ.get("DATA_DIR", "../../resources")) / "genki1vocab.csv"` when instantiating.

### Genki CSV column order

The CSV parser in `load_genki_index()` uses:
- `row[0]`: row ID (not used in this function, but other callers need it)
- `row[1]`: kana reading(s) separated by `;`
- `row[2]`: kanji headword (may be empty; strip leading `〜`)
- `row[3]`: English definition

This matches the existing `data_loader.py` which also reads the same CSV. Check `data_loader.py` for column assumptions if in doubt.

### `lookup_gloss` JMdict return

Return only the first gloss string of the first sense of the first entry — `result.entries[0].senses[0].gloss[0]` (as a `str`, not a list). If the result is empty, return `None` (or an empty list). The caller in `enrich_sentence` should check truthiness and build the dict accordingly.

Actually looking at the prototype: `return [str(g) for g in result.entries[0].senses[0].gloss]` — it returns a list. Adjust `enrich_sentence` to take the first element: `gloss = glosses[0] if glosses else None`.

### Test module structure

```python
# tests/test_enrichment.py
sudachipy = pytest.importorskip("sudachipy")  # skip entire module if not installed

import pytest
from pathlib import Path
from story_generator.enrichment import EnrichmentPipeline

GENKI_CSV = Path(__file__).parents[3] / "resources" / "genki1vocab.csv"

@pytest.fixture(scope="module")
def pipeline():
    return EnrichmentPipeline(genki_csv_path=GENKI_CSV)

def test_okurigana_taberu(pipeline):
    result = pipeline.enrich_sentence(["食べます"])
    assert result[0]["annotated"] == "食[た]べます"
    assert result[0]["pos_code"] == "v1"

# ... etc. for all required test cases
```

Use `scope="module"` to pay the SudachiPy dictionary startup cost (~1-2 seconds) only once per test run.

### Test cases required (AC8)

These are the exact scenarios the AC specifies:

| Test | Input | Expected `annotated` / `pos_code` |
|------|-------|-------------------------------------|
| Okurigana — ichidan | `食べます` (食べる) | `食[た]べます`, `v1` |
| Okurigana — ichidan | `起きて` (起きる) | `起[お]きて` |
| Okurigana — godan | `帰った` (帰る) | `帰[かえ]った`, `v5` |
| All-kanji | `勉強` | `勉強[べんきょう]` |
| Mixed morpheme | `朝ごはん` | `朝[あさ]ごはん`, `n` |
| First-occurrence suppression ON | `食べます` twice, shared set | 1st: annotated with furigana; 2nd: plain `食べます` |
| First-occurrence suppression OFF | `食べます` twice, `seen=None` | Both annotated with furigana |
| Suru-verb POS | `勉強します` | `pos_code = "v-irr"`, `dictionary_form = "勉強する"` |
| Godan POS | `飲みます` (飲む) | `pos_code = "v5"` |
| Ichidan POS | `食べます` (食べる) | `pos_code = "v1"` |
| i-adj POS | `おいしい` | `pos_code = "adj-i"` |
| na-adj POS | `きれいな` or `好きです` | `pos_code = "adj-na"` |
| Genki hit | a word definitely in Genki CSV | `gloss_source = "genki"` |
| JMdict fallback | a kanji word NOT in Genki | `gloss_source = "jmdict"` |
| Short kana skip | `に` | no `gloss` key in result |

For Genki hit test, use `食べる` (to eat) which is in Genki I Ch.6. For JMdict test, use `眠る` (to sleep) which is not in Genki I.

### Files to create/modify

| File | Action |
|------|--------|
| `apps/story-generator-backend/src/story_generator/enrichment.py` | **CREATE** |
| `apps/story-generator-backend/tests/test_enrichment.py` | **CREATE** |
| `apps/story-generator-backend/requirements.txt` | **MODIFY** — append 4 new lines |

### What does NOT belong in this story

- `build_enriched_story()` — that is se2-2's method on `EnrichmentPipeline`
- Any changes to `agent.py`, `main.py`, or `validator.py`
- `vocab_keys` assignment logic — se2-2
- Any TypeScript / schema changes — se2-3

### Running the tests

```bash
cd apps/story-generator-backend
pip install -r requirements.txt   # includes new deps
pytest tests/test_enrichment.py -v
```

Tests do not require `GEMINI_API_KEY`. All enrichment is local Python — no network calls.

### Code style

- `from __future__ import annotations` at top of each new file (consistent with existing modules)
- Succinct docstrings on `EnrichmentPipeline`, `__init__`, and `enrich_sentence`; block comments on major sections
- No inline comments narrating obvious code

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-04. All prototype logic lifted verbatim from `dev/tokenize_prototype.py` into `enrichment.py` as module-level helpers; no logic was rewritten. `EnrichmentPipeline` wraps them with a single-construction init contract. `lookup_gloss` return type changed from `list[str]` to `str | None` (first gloss only) as specified in Dev Notes. 20 new tests cover all AC3–AC6 cases; module-scoped fixture pays the SudachiPy cold-start cost once. Full suite: 62/62 passing, no regressions.

### File List

- `apps/story-generator-backend/src/story_generator/enrichment.py` — CREATED
- `apps/story-generator-backend/tests/test_enrichment.py` — CREATED
- `apps/story-generator-backend/requirements.txt` — MODIFIED (4 new deps appended)

### Change Log

- 2026-06-04: Created `EnrichmentPipeline` class with `enrich_sentence` method; added 20 integration tests; updated requirements.txt with sudachipy/jamdict deps

### Review Findings

- [x] [Review][Patch] `lookup_gloss` missing empty-senses guard — fixed: added `if not senses: return None` before `senses[0]` access [enrichment.py:~212]
- [x] [Review][Patch] Missing test: `勉強する` annotated form — fixed: added `test_okurigana_benkyousuru` asserting `勉強[べんきょう]する` [test_enrichment.py]
- [x] [Review][Patch] Missing test: cross-call `seen_dict_forms` tracking — fixed: added `test_seen_set_cross_call` with two separate `enrich_sentence` calls [test_enrichment.py]
- [x] [Review][Patch] Missing test: `lookup_gloss` short-kana guard never triggered — fixed: added `test_lookup_gloss_short_kana_guard` calling `lookup_gloss` directly [test_enrichment.py]
- [x] [Review][Defer] `_pos_code` empty `conj_type` → silent `v1` fallback — if SudachiPy returns `""` for 活用型 (e.g. dictionary-form tokens), verb is silently labelled v1; no warning or logging [enrichment.py:~146] — deferred, pre-existing design decision
- [x] [Review][Defer] `_annotate_morpheme` theoretical empty kanji_reading — if `reading_hira` is shorter than `surface` (not producible by normal SudachiPy output), `kanji_reading` becomes `""` producing `食[]べ` [enrichment.py:~51] — deferred, pre-existing, requires invalid SudachiPy output to trigger
- [x] [Review][Defer] `enrich_sentence` imports `sudachipy` inside hot method — Python caches imports so not a correctness bug; cleanup only [enrichment.py:~261] — deferred, pre-existing
- [x] [Review][Defer] `lookup_gloss` `str(Gloss)` format not verified — `str(glosses[0])` relies on Jamdict's `Gloss.__str__`; format not formally tested beyond truthiness [enrichment.py:~215] — deferred, pre-existing
- [x] [Review][Defer] `_dominant_pos` and `_derive_dictionary_form` duplicate `_AUXILIARY_POS` filtering — both independently build `content` list; latent sync hazard if `_AUXILIARY_POS` changes [enrichment.py] — deferred, pre-existing refactor candidate
