# Story se2-2: Updated Generation Pipeline

Status: done

## Story

As a **story author**,
I want the generation backend to use the Python enrichment pipeline to produce
`words[]`, `vocab_keys[]`, and `vocab_supplement[]`,
So that these arrays are always consistent and the parallel array invariant is guaranteed
by construction rather than by LLM reliability.

## Acceptance Criteria

1. **AC1 — Simplified system prompt**
   - `build_system_prompt` in `agent.py` no longer contains furigana annotation rules,
     `vocab_keys` format instructions, `vocab_supplement` instructions, or bracket annotation examples
   - Instructs Gemini to return simplified JSON: top-level metadata + `sentences` as an array of
     `{"english": "...", "japanese": "...", "words": [...], "grammar": [...]}` objects
   - Specifies word segmentation rules: verb stems attached to polite endings, particles separate,
     punctuation separate, さん/くん attached to names

2. **AC2 — `build_enriched_story` on `EnrichmentPipeline`**
   - `EnrichmentPipeline.build_enriched_story(segments, story_meta)` exists and returns a complete
     story dict (schema_version "2") with `words[]`, `vocab_keys[]`, `vocab_supplement[]` populated
   - Takes `segments: list[dict]` (each has `english`, `japanese`, `words`, optional `grammar`)
     and `story_meta: dict` (has `id`, `title`, `title_ja`, `description`, `grammar`, `difficulty`)

3. **AC3 — Genki vocab key assignment**
   - When a word's `dictionary_form` matches a Genki entry, `vocab_keys[i]` is set to the
     Genki row ID (1–1172); no supplemental entry is created for this word

4. **AC4 — Supplemental key assignment**
   - A content word with no Genki match gets a new entry in `vocab_supplement` with `key ≥ 10000`,
     `word` (original surface), `hiragana` (reading), `translation` (gloss), `pos`, `dictionary_form`
   - `vocab_keys[i]` is set to that key

5. **AC5 — Supplemental key reuse**
   - Same non-Genki word appearing in multiple sentences reuses the same key; entry added only once

6. **AC6 — Null assignment for particles and punctuation**
   - Particle (pos_code="prt") or punctuation (pos_code="") token → `vocab_keys[i]` is `null`;
     no entry is added to `vocab_supplement`

7. **AC7 — Word boundary validation**
   - If `"".join(segment["words"]) != segment["japanese"].replace(" ", "")`, the pipeline raises
     a `ValueError` identifying the mismatched sentence
   - The agent catches this and emits `ERROR` with code `GENERATION_FAILED`

8. **AC8 — Agent wires enrichment pipeline**
   - `StoryGeneratorAgent.__init__` accepts an optional `enrichment_pipeline` parameter for injection
   - In `main.py` lifespan, `EnrichmentPipeline` is instantiated once with the Genki CSV path
     and passed to `StoryGeneratorAgent` via the `enrichment_pipeline` kwarg
   - `main.py` imports and instantiates `EnrichmentPipeline` conditionally: only when SudachiPy is
     installed; if import fails, `enrichment_pipeline` is `None` and the agent falls back to an error

9. **AC9 — `validator.py` unchanged**
   - `PARALLEL_ARRAY_MISMATCH` error path remains; furigana bracket validation still runs on `words[]`

10. **AC10 — Tests pass with updated fixtures**
    - `tests/test_agent.py` uses new-format mock data (simplified Gemini response + mock pipeline)
    - All existing tests pass; prompt-content test updated to verify new requirements

---

## Tasks / Subtasks

- [ ] Task 1: Extend `enrichment.py` with Genki ID index and `build_enriched_story`
  - [ ] Add `load_genki_key_index(csv_path) -> tuple[dict[str, int], dict[str, int]]`
  - [ ] In `EnrichmentPipeline.__init__`, call `load_genki_key_index` for `_kanji_id_index` / `_kana_id_index`
  - [ ] Add `_lookup_genki_id(self, dictionary_form) -> int | None` private method
  - [ ] Add `build_enriched_story(self, segments, story_meta) -> dict` method

- [ ] Task 2: Simplify `build_system_prompt` in `agent.py`
  - [ ] Remove furigana annotation rules section and all bracket examples
  - [ ] Remove Critical Rules 1 (parallel arrays), 2 (annotation format), 3 (vocab_keys), 5 (vocab_supplement)
  - [ ] Keep Critical Rules about sentence id format and grammar indices (still Gemini's responsibility)
  - [ ] Replace full story output format with simplified format (no `vocab_keys`, no `vocab_supplement`, no `ruby`)
  - [ ] Add word segmentation rules section
  - [ ] Keep vocab list and grammar list (Gemini still needs them for curriculum compliance)

- [ ] Task 3: Wire enrichment pipeline into `StoryGeneratorAgent`
  - [ ] Add `enrichment_pipeline=None` parameter to `__init__`
  - [ ] In `generate()`: after parsing Gemini JSON, extract `segments` and `story_meta`
  - [ ] Call `pipeline.build_enriched_story(segments, story_meta)` to get `story_dict`
  - [ ] Catch `ValueError` from word boundary validation → emit `GENERATION_FAILED` ERROR
  - [ ] Pass `story_dict` (not `raw_json`) to `validate()` and to `RUN_FINISHED`
  - [ ] Emit `RUN_FINISHED` with `json.dumps(story_dict)` as both delta and content

- [ ] Task 4: Update `main.py` lifespan to instantiate pipeline
  - [ ] Import `EnrichmentPipeline` inside lifespan (guarded try/except for missing SudachiPy)
  - [ ] Instantiate `EnrichmentPipeline(genki_csv_path)` once at startup; store in module-level `_enrichment_pipeline`
  - [ ] Pass `enrichment_pipeline=_enrichment_pipeline` to `StoryGeneratorAgent` in `/run_sse`

- [ ] Task 5: Create `tests/fixtures/simplified_segments.json`
  - [ ] Write the simplified fixture matching the new Gemini output format

- [ ] Task 6: Update `tests/test_agent.py`
  - [ ] Add `MockEnrichmentPipeline` class with `build_enriched_story` returning the full story fixture
  - [ ] Add `simplified_fixture_json` fixture loading `simplified_segments.json`
  - [ ] Update all test helpers to use `simplified_fixture_json` for stream client + `MockEnrichmentPipeline`
  - [ ] Update `test_system_prompt_contains_v2_format_instructions` → check new prompt requirements
  - [ ] Ensure `test_cancel_before_gemini_call` still works (no pipeline needed for that path)

---

## Dev Notes

### Reference: se2-1 output

`apps/story-generator-backend/src/story_generator/enrichment.py` is the completed se2-1 module.
Key interfaces already available:
- `EnrichmentPipeline(genki_csv_path: Path)` — initialises SudachiPy, Genki CSV, Jamdict
- `EnrichmentPipeline.enrich_sentence(words, seen_dict_forms=None) -> list[dict]`
  Returns: `[{"annotated", "dictionary_form", "reading", "pos_code", "gloss"?, "gloss_source"?}]`
- Module-level `load_genki_index`, `lookup_genki`, `lookup_gloss`, `has_kanji`, `_CONTENT_POS`, etc.

### Task 1: `load_genki_key_index` and `build_enriched_story`

**`load_genki_key_index`** — same structure as `load_genki_index` but stores row ID instead of definition:

```python
def load_genki_key_index(csv_path: Path) -> tuple[dict[str, int], dict[str, int]]:
    """Parse genki1vocab.csv into kanji and kana row-ID indexes.

    Returns (kanji_id_index, kana_id_index) mapping headword → integer row ID (1–1172).
    """
    kanji_id_index: dict[str, int] = {}
    kana_id_index: dict[str, int] = {}
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            row_id = int(row[0])
            kanji = row[2].strip().lstrip("〜")
            for reading in row[1].split(";"):
                reading = reading.strip().lstrip("〜")
                if reading and reading not in kana_id_index:
                    kana_id_index[reading] = row_id
            if kanji and kanji not in kanji_id_index:
                kanji_id_index[kanji] = row_id
    return kanji_id_index, kana_id_index
```

In `__init__`, add after `load_genki_index`:
```python
self._kanji_id_index, self._kana_id_index = load_genki_key_index(genki_csv_path)
```

Private method:
```python
def _lookup_genki_id(self, dictionary_form: str) -> int | None:
    return self._kanji_id_index.get(dictionary_form) or self._kana_id_index.get(dictionary_form)
```
(IDs are 1–1172, never 0, so `or` chain is safe.)

**`build_enriched_story` vocab key logic:**

```python
# Vocab key assignment constants — determines which pos_codes need a vocab entry
_CONTENT_POS_CODES = {"n", "v1", "v5", "v-irr", "adj-i", "adj-na", "adv", "pron", "conj"}
```

For each word in each sentence:
1. `genki_id = self._lookup_genki_id(enriched["dictionary_form"])` — if found, use it
2. Elif `enriched["pos_code"] in ("prt", "")` → `None` (particles, punctuation, auxiliaries)
3. Elif `enriched["pos_code"] in _CONTENT_POS_CODES` → supplemental key (create or reuse)
4. Else → `None` (suffixes, prefixes not in Genki)

**`build_enriched_story` supplemental entry structure:**
```python
{
    "key": supp_key,           # int ≥ 10000
    "word": original_surface,  # from segment["words"][i], NOT the annotated form
    "hiragana": enriched["reading"],
    "translation": enriched.get("gloss", ""),
    "pos": enriched["pos_code"],
    "dictionary_form": enriched["dictionary_form"],
}
```

**Word boundary validation:**
```python
joined = "".join(segment["words"])
expected = segment["japanese"].replace(" ", "")
if joined != expected:
    raise ValueError(
        f"Sentence {i + 1}: joined words {joined!r} != japanese {expected!r}"
    )
```
Raise before calling `enrich_sentence` for that segment.

**Sentence ID generation:** `f"s{i + 1:02d}"` (1-indexed, 2 digits: s01, s02, …)

**`translation` field:** each sentence's translation comes from `segment["english"]`

**`grammar` field on each sentence:** pass through `segment.get("grammar", [])` unchanged

**`build_enriched_story` output structure:**
```python
{
    "schema_version": "2",
    "id": story_meta["id"],
    "title": story_meta["title"],
    "title_ja": story_meta["title_ja"],
    "language": "ja",
    "description": story_meta["description"],
    "difficulty": story_meta["difficulty"],
    "grammar": story_meta.get("grammar", []),
    "vocab_supplement": vocab_supplement,  # list built during processing
    "sentences": [
        {
            "id": "s01",
            "words": [r["annotated"] for r in enriched_results],
            "vocab_keys": [key or None for key in assigned_keys],
            "translation": segment["english"],
            "grammar": segment.get("grammar", []),
        },
        ...
    ]
}
```

Use a shared `seen_dict_forms: set[str] = set()` passed to every `enrich_sentence` call for
first-occurrence furigana suppression across the full story.

Keep `supp_key_map: dict[str, int]` keyed by `dictionary_form` for cross-sentence key reuse.

### Task 2: New simplified `build_system_prompt` output format

Ask Gemini for this structure (no `vocab_keys`, no `vocab_supplement`, no `ruby`, no furigana):

```
{
  "id": "<kebab-case, e.g. genki-i-ch{chapter}-topic>",
  "title": "<English story title>",
  "title_ja": "<Japanese story title>",
  "description": "<1-2 sentence English description>",
  "grammar": ["<grammar pattern string>", ...],
  "sentences": [
    {
      "english": "<English translation of this sentence>",
      "japanese": "<full Japanese sentence, no spaces>",
      "words": ["<surface word 1>", "<surface word 2>", ...],
      "grammar": [<0-based index into story-level grammar array>, ...]
    }
  ]
}
```

**Word segmentation rules to include in the prompt:**
```
## Word Segmentation Rules

Split each Japanese sentence into surface word tokens following these rules:
1. Verb stems stay attached to their polite endings: 食べます (one token), 行きます (one token)
2. Particles are separate tokens: は、を、に、で、へ、が、と、も、の are each a single token
3. Punctuation is separate: 。and 、are each a single token
4. Honorifics attached to names stay attached: たろうさん、はなこさん (one token each)
5. The words array joined must exactly reconstruct the japanese string (no spaces)
```

**Remove from prompt:**
- Entire "## Inline Furigana Annotation" section and its table
- All Critical Rules (old 1–7) except the id/sentence-id format rules
- The `vocab_supplement` instructions and examples
- The `vocab_keys` instructions

**Keep in prompt:**
- Vocab list block (LLM needs it for curriculum compliance)
- Grammar list block (LLM needs it for grammar distribution)
- Grammar distribution hint
- Steering block
- Output format instruction: "Return ONLY the JSON object. No markdown, no code fences."

### Task 3: `generate()` flow after parsing simplified response

After `json.loads(raw_json)` succeeds, the flow becomes:

```python
raw_response = json.loads(raw_json)

# Extract segments and story_meta from simplified Gemini response
segments = raw_response.pop("sentences", [])
story_meta = {**raw_response, "difficulty": f"Genki I Ch.{chapter_int}"}

# Enrich via Python pipeline
pipeline = self._enrichment_pipeline
if pipeline is None:
    yield {"type": "ERROR", "code": "GENERATION_FAILED",
           "message": "Enrichment pipeline not initialised."}
    return
try:
    story_dict = pipeline.build_enriched_story(segments, story_meta)
except ValueError as exc:
    logger.warning("run_id=%s word boundary mismatch: %s", run_id, exc)
    yield {"type": "ERROR", "code": "GENERATION_FAILED", "message": str(exc)}
    return

# Validate assembled story
result = validate(story_dict)
if not result.valid:
    ...emit VALIDATION_ERROR...

# Emit
enriched_json = json.dumps(story_dict, ensure_ascii=False)
yield {"type": "TEXT_MESSAGE_CHUNK", "delta": enriched_json}
yield {"type": "RUN_FINISHED", "resultType": "story", "content": enriched_json}
```

Remove `_coerce_string_nulls` call from the generate() flow (no longer relevant — the simplified
response has no `vocab_keys` arrays to coerce). Keep the function in the module in case it is useful.

The `perf_logger` call should still happen after streaming, using `len(raw_json)` (Gemini response size).

### Task 4: `main.py` lifespan update

```python
# Module-level slot — populated at startup
_enrichment_pipeline = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _vocab_data, _grammar_data, _enrichment_pipeline  # noqa: PLW0603
    data_dir = Path(os.environ.get("DATA_DIR", "../../resources"))
    from story_generator.data_loader import load_grammar_data, load_vocab_data
    _vocab_data = load_vocab_data(data_dir / "genki1vocab.csv")
    _grammar_data = load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")
    try:
        from story_generator.enrichment import EnrichmentPipeline
        _enrichment_pipeline = EnrichmentPipeline(data_dir / "genki1vocab.csv")
        logger.info("EnrichmentPipeline initialised")
    except ImportError:
        logger.warning("SudachiPy not installed — enrichment pipeline unavailable")
    yield
```

In `/run_sse`:
```python
agent = StoryGeneratorAgent(
    _vocab_data, _grammar_data,
    enrichment_pipeline=_enrichment_pipeline,
    generation_timeout_s=_GENERATION_TIMEOUT_S,
)
```

### Task 5: `tests/fixtures/simplified_segments.json`

This fixture represents what Gemini returns with the new simplified prompt — same story as
`valid_story.json` but without furigana brackets, without `vocab_keys`, without `vocab_supplement`.
Surface word strings are plain (no `[...]` annotation). Metadata is unchanged.

```json
{
  "id": "genki-i-ch8-kenji-student-life",
  "title": "Kenji's Student Life",
  "title_ja": "けんじさんの 学生生活",
  "description": "This story introduces Kenji ...",
  "grammar": ["Defining Identity (X は Y です)", ...],
  "sentences": [
    {
      "english": "Kenji is a first-year university student in Tokyo.",
      "japanese": "けんじさんはとうきょうのだいがく一年生です。",
      "words": ["けんじさん", "は", "とうきょう", "の", "だいがく", "一年生", "です", "。"],
      "grammar": [0, 1]
    },
    ...
  ]
}
```

The `japanese` field must be the sentence with no spaces; `words` joined must equal it.
Create this file to cover enough sentences so test_agent.py works end-to-end with the mock pipeline.

### Task 6: `tests/test_agent.py` updates

**Add `MockEnrichmentPipeline`:**
```python
class MockEnrichmentPipeline:
    """Injectable mock — returns a pre-built story dict without calling SudachiPy."""
    def __init__(self, story_dict: dict):
        self._story = story_dict

    def build_enriched_story(self, segments: list, story_meta: dict) -> dict:
        return self._story
```

**Add fixtures:**
```python
SIMPLIFIED_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "simplified_segments.json"

@pytest.fixture(scope="module")
def simplified_fixture_json() -> str:
    return SIMPLIFIED_FIXTURE_PATH.read_text(encoding="utf-8")
```

**Update test helpers** — all tests that call `agent.generate()` must also pass a `MockEnrichmentPipeline`:
```python
# Pattern for most tests:
agent = StoryGeneratorAgent(
    vocab_data, grammar_data,
    gemini_stream_client=make_mock_stream_client(simplified_fixture_json),
    enrichment_pipeline=MockEnrichmentPipeline(json.loads(fixture_json)),
)
```

**Update `test_system_prompt_contains_v2_format_instructions`** — rename to
`test_system_prompt_has_simplified_format` and assert:
- `"漢字[よみ]"` is NOT in the prompt (no furigana instructions)
- `"vocab_keys"` is NOT in the prompt
- `"vocab_supplement"` is NOT in the prompt
- `"words"` IS in the prompt (segmentation output field)
- Segmentation rule text IS present (e.g. `"particles are separate"` or similar)

The existing test `test_system_prompt_includes_cumulative_vocab_up_to_chapter` remains valid —
vocab lines still appear in the new prompt.

**`test_cancel_before_gemini_call`** — keep as-is; cancel fires before Gemini is called so no
pipeline is invoked. No change needed.

**`test_validation_failure_emits_error_not_finished`** — this test bypasses the enrichment step
(the mock stream client returns bad JSON that would fail validation). In the new flow, the mock
pipeline's `build_enriched_story` returns the bad story dict directly, so the test pattern changes:
the "bad story" must now be the return value of the mock pipeline, not the raw Gemini response:

```python
bad_story = {  # returned by mock pipeline
    "schema_version": "2", "id": "test", ...
    "sentences": [{"id": "s01", "words": ["a", "b"], "vocab_keys": [None]}]  # length mismatch
}
# simplified input (minimal valid JSON for Gemini to return)
simplified_input = json.dumps({"id": "test", "title": "T", "title_ja": "T",
    "description": "x", "grammar": [], "sentences": []})
agent = StoryGeneratorAgent(
    vocab_data, grammar_data,
    gemini_stream_client=make_mock_stream_client(simplified_input),
    enrichment_pipeline=MockEnrichmentPipeline(bad_story),
)
```

### Files to create / modify

| File | Action |
|------|--------|
| `apps/story-generator-backend/src/story_generator/enrichment.py` | **MODIFY** — add `load_genki_key_index`, extend `__init__`, add `_lookup_genki_id`, add `build_enriched_story` |
| `apps/story-generator-backend/src/story_generator/agent.py` | **MODIFY** — simplify prompt, add pipeline injection, update `generate()` flow |
| `apps/story-generator-backend/src/story_generator/main.py` | **MODIFY** — instantiate pipeline in lifespan, pass to agent |
| `apps/story-generator-backend/tests/fixtures/simplified_segments.json` | **CREATE** — new simplified Gemini response fixture |
| `apps/story-generator-backend/tests/test_agent.py` | **MODIFY** — add mock pipeline, update fixtures and tests |

### What does NOT belong in this story

- TypeScript / schema changes — those are se2-3
- `InfoPanel.tsx` POS display — se2-4
- Re-enrichment script — se2-5
- Any changes to `validator.py` (no functional change; only external behaviour changes as noted)

### Running the tests

```bash
cd apps/story-generator-backend
pytest tests/test_agent.py -v          # no SudachiPy needed
pytest tests/test_enrichment.py -v    # requires SudachiPy; skip-safe
pytest tests/ -v                       # full suite
```

`test_agent.py` must not require SudachiPy — the `MockEnrichmentPipeline` prevents any import.

### Code style (from project context and se2-1)

- `from __future__ import annotations` at top of each modified file (already present)
- Succinct docstring on `build_enriched_story`; block comments on major processing sections
- No inline comments narrating obvious code

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-04. `build_enriched_story` added to `EnrichmentPipeline` with shared
`seen_dict_forms` set across sentences for first-occurrence furigana. Vocab key assignment
uses a new `load_genki_key_index` + `_lookup_genki_id` pair; supplemental keys start at
10000 and are reused by `dict_form` key. Word boundary validation raises `ValueError` caught
by the agent. `build_system_prompt` stripped of all furigana/vocab_keys instructions;
segmentation rules added. All 32 agent tests and 23 enrichment tests pass; no SudachiPy
required for `test_agent.py`. Full suite: 55/55 passing.

### File List

- `apps/story-generator-backend/src/story_generator/enrichment.py` — MODIFIED (add `load_genki_key_index`, extend `__init__`, add `_lookup_genki_id` + `build_enriched_story`)
- `apps/story-generator-backend/src/story_generator/agent.py` — MODIFIED (simplified prompt, `enrichment_pipeline` injection, updated `generate()` flow)
- `apps/story-generator-backend/src/story_generator/main.py` — MODIFIED (pipeline init in lifespan, inject into agent)
- `apps/story-generator-backend/tests/fixtures/simplified_segments.json` — CREATED
- `apps/story-generator-backend/tests/test_agent.py` — MODIFIED (`MockEnrichmentPipeline`, updated fixtures, renamed prompt test)

### Change Log

- 2026-06-04: Implemented `build_enriched_story` on `EnrichmentPipeline`; simplified Gemini prompt; wired pipeline into agent and main.py; updated test fixtures

### Review Findings

- [x] [Review][Decision] AC3 vs AC6 conflict for Genki-listed particles — resolved: Genki ID wins; particles in the Genki CSV receive their row ID so the reader can look them up. Current behaviour retained, no code change.

- [x] [Review][Patch] Add length assertion before `zip(words_raw, enriched_results)` to catch tokenisation mismatches [enrichment.py:build_enriched_story]

- [x] [Review][Patch] Catch non-ValueError exceptions from `build_enriched_story` in agent.py to prevent hanging SSE streams [agent.py:generate()]

- [x] [Review][Patch] Replace `raw_response.pop("sentences", [])` with explicit `.get()` to avoid fragile mutation-before-spread ordering [agent.py:generate()]

- [x] [Review][Patch] Move `_CONTENT_POS_CODES` set to module level instead of re-creating on every `build_enriched_story` call [enrichment.py]

- [x] [Review][Defer] `_lookup_genki_id` uses `or` chain which would misclassify row ID 0 as not-found — safe with IDs 1–1172 but latent; pre-existing pattern in lookup_genki [enrichment.py:_lookup_genki_id]

- [x] [Review][Defer] `vocab_supplement` translation is `""` when neither Genki nor JMdict returns a gloss — design limitation of enrichment pipeline, not fixable without external data [enrichment.py:build_enriched_story]

- [x] [Review][Defer] `valid_story.json` fixture lacks `pos` and `dictionary_form` fields on vocab_supplement entries — pre-existing, se2-3 will address schema; se2-4 will address display

- [x] [Review][Defer] `supp_key_counter` starts at 10000; theoretical collision if Genki CSV ever exceeds 9999 rows — not realistic with current 1172-row contract

- [x] [Review][Defer] `感動詞` (interjection) has pos_code="" from `_pos_code`, falling into null branch despite being in `_CONTENT_POS` — pre-existing design decision, rare in graded readers

- [x] [Review][Defer] `load_genki_key_index` calls `int(row[0])` without header-row guard — pre-existing pattern shared with `load_genki_index`; CSV has no header
