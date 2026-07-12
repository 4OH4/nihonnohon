# Story se1-5: Story Generator Backend — v2 Output Format

Status: done

## Story

As a **story generator**,
I want the backend agent to produce `story.v2.json`-compliant output with inline furigana annotations,
so that newly generated stories use per-kanji furigana from the start.

## Acceptance Criteria

1. **AC1 — System prompt produces v2 format**
   - `build_system_prompt()` output template uses `"schema_version": "2"`
   - Describes the `漢字[よみ]` inline annotation syntax
   - Includes worked examples of all four annotation patterns:
     - Jukujikun (whole-word): `大人[おとな]`
     - Kanji block + okurigana: `肌寒[はだざむ]い`
     - Separate kanji with interleaved kana: `付[つ]け加[くわ]える`
     - Single kanji: `私[わたし]`
   - Makes no mention of a `ruby` parallel array anywhere in the prompt
   - Still requires `words` and `vocab_keys` arrays of equal length per sentence

2. **AC2 — Validator checks bracket syntax, removes ruby length check**
   - `validator.py` validates each word string for well-formed bracket syntax:
     - A `[` must be followed by `]` (no unclosed brackets)
     - A `[` must be immediately preceded by at least one kanji character
   - The parallel `ruby`-array length check is removed
   - The `words` / `vocab_keys` length parity check is preserved

3. **AC3 — `test_validator.py` covers bracket validation**
   - Well-formed annotated word passes (e.g. `"学生[がくせい]"`)
   - Malformed bracket (unclosed `[`) fails with a clear message
   - `[` not preceded by kanji fails with a clear message
   - Unannotated plain word passes (e.g. `"は"`)
   - Empty string handled gracefully (no crash)

4. **AC4 — `test_agent.py` mock fixtures updated to v2**
   - `tests/fixtures/valid_story.json` uses `schema_version: "2"`, no `ruby` field,
     and `words` entries use inline `漢字[よみ]` annotations where appropriate
   - Tests that previously checked v1-format validation failures are updated
     to use `vocab_keys` mismatches or bracket syntax errors instead of `ruby` mismatches
   - New test: captured prompt contains `schema_version: "2"` and annotation examples;
     does NOT contain `"ruby"`

5. **AC5 — `test_contract.py` validates against v2 schema**
   - Existing contract test passes once fixture is updated to v2 format
   - `loadStory()` validates the fixture against `story.v2.json` via AJV (implicit, no code change needed)

---

## Tasks / Subtasks

- [x] Task 1: Update `build_system_prompt()` in `agent.py` (AC1)
  - [x] Change `"schema_version": "1"` → `"schema_version": "2"` in the output format template
  - [x] Remove the `"ruby": [...]` line from the sentence template
  - [x] Add an "Inline furigana annotation" section before the Output Format block that explains the `漢字[よみ]` syntax and shows all four examples
  - [x] Remove `ruby` from the parallel arrays rule in Critical Rules (rule #1)
  - [x] Replace Critical Rule #3 (ruby values) with an "Annotation format" rule describing inline `漢字[よみ]` usage
  - [x] Update `_coerce_string_nulls()` — remove `"ruby"` from the coercion loop; update docstring

- [x] Task 2: Update `validator.py` (AC2)
  - [x] Add a helper `_is_kanji(ch: str) -> bool` using Unicode ranges `一-鿿`, `㐀-䶿`, `豈-﫿`
  - [x] Add `_validate_word_annotation(word: str) -> str | None` that returns an error message for:
    - unclosed bracket: `[` in word with no matching `]` after it
    - bracket not preceded by kanji: `[` whose preceding character is not in the kanji range
    - returns `None` for well-formed or unannotated words
  - [x] In `validate()`, inside the per-sentence loop, call `_validate_word_annotation()` for each word in `words`; append a `ValidationError(code="VALIDATION_ERROR", ...)` for each failure
  - [x] Remove the `ruby` length check block entirely (lines 88–101 in current `validator.py`)
  - [x] Keep the `vocab_keys` length check unchanged

- [x] Task 3: Update `tests/fixtures/valid_story.json` (AC4, AC5)
  - [x] Change `"schema_version"` from `"1"` to `"2"`
  - [x] For each sentence, remove the `"ruby"` field entirely
  - [x] For each word that had a non-null ruby reading: fold the reading into the word string as inline annotation
    - Pattern: `"食べる"` with `ruby: "たべる"` → `"食[た]べる"` (kanji portion only)
    - Use whole-word annotation for multi-kanji words where per-kanji split is ambiguous:
      e.g. `"一年生"` with `ruby: "いちねんせい"` → `"一年生[いちねんせい]"` (jukujikun-style)
    - Words that were pure hiragana/katakana/punctuation with `ruby: null` → leave unchanged (no annotation needed)
  - [x] Verify the updated fixture has `words` and `vocab_keys` of equal length per sentence

- [x] Task 4: Update `tests/test_validator.py` (AC3)
  - [x] Add `test_validate_well_formed_annotation_passes` — story with `"words": ["学生[がくせい]"]` and `"vocab_keys": [42]` passes
  - [x] Add `test_validate_malformed_bracket_unclosed_fails` — word `"食[た"` fails with `code="VALIDATION_ERROR"` and message containing the word
  - [x] Add `test_validate_bracket_not_preceded_by_kanji_fails` — word `"は[な]"` (non-kanji before bracket) fails
  - [x] Add `test_validate_plain_word_passes` — word `"は"` passes (no bracket, no error)
  - [x] Add `test_validate_empty_string_word_handled` — `"words": [""]` with `"vocab_keys": [null]` — no crash; fails schema but not via bracket check

- [x] Task 5: Update `tests/test_agent.py` (AC4)
  - [x] Update `test_validation_failure_emits_error_not_finished`:
    - Remove `"ruby": ["r1"]` (length mismatch); switch to `vocab_keys` mismatch:
      `"words": ["a", "b"], "vocab_keys": [None]` (length 1 ≠ 2)
    - Remove `"schema_version": "1"` → change to `"2"` (v2 fixture)
  - [x] Update `test_path_b_phase2_validation_failure_emits_error` the same way
  - [x] Add `test_system_prompt_contains_v2_format_instructions` — capture prompt for Ch.3; assert:
    - `'"schema_version": "2"'` appears in the prompt
    - `"大人[おとな]"` (or another annotation example) appears in the prompt
    - `"ruby"` does NOT appear in the prompt (case-insensitive for the word "ruby", not Japanese characters)

- [x] Task 6: Verify (AC5)
  - [x] Run `pytest` from `apps/story-generator-backend` — all tests must pass
  - [x] Optionally run `test_contract.py` (requires node + built story-loader dist)

### Review Findings

- [x] [Review][Patch] Prompt uses `食[た]べる` for kanji+okurigana example instead of spec-required `肌寒[はだざむ]い`; the spec example shows a multi-kanji block, `食べる` only shows single kanji [`agent.py` — `build_system_prompt`]
- [x] [Review][Patch] Critical Rule #3 says "Never use a separate `ruby` array" — AC1 requires NO mention of ruby in prompt [`agent.py` — `build_system_prompt` rule 3]
- [x] [Review][Patch] `_KANJI_RE` omits CJK Extension B (U+20000–U+2A6DF); valid annotations on rare supplementary-plane kanji would be incorrectly rejected [`validator.py` — `_KANJI_RE`]
- [x] [Review][Defer] Empty reading `食[]` passes — `[` has matching `]` but reading is empty; spec rules only check closure and kanji-precedes [`validator.py` `_validate_word_annotation`] — deferred, outside spec scope
- [x] [Review][Defer] Orphan `]` (e.g. `食た]`) and nested brackets not detected; validator iterates `[` only [`validator.py` `_validate_word_annotation`] — deferred, beyond spec requirements; parser handles gracefully
- [x] [Review][Defer] No `schema_version` gate on bracket check — v1 stories would be validated with v2 rules [`validator.py` `validate()`] — deferred, backend only validates freshly generated v2 output; v1 words never contain `[`
- [x] [Review][Defer] String `"null"` in `words` array not coerced — same Gemini hallucination that `ruby`/`vocab_keys` coercion guards against [`agent.py` `_coerce_string_nulls`] — deferred, pre-existing gap not in story scope; `words` coercion was never handled
- [x] [Review][Defer] Only first malformed `[` per word reported; subsequent errors in same word silently skipped [`validator.py` `_validate_word_annotation`] — deferred, diagnostic quality only; story is still correctly rejected
- [x] [Review][Defer] Agent truncates `ValidationResult.errors` to first 3 in ERROR event [`agent.py` ~L507] — deferred, pre-existing behavior not introduced by se1-5
- [x] [Review][Defer] Bracket-not-preceded-by-kanji test asserts word in message but not the explanatory phrase — coverage adequately verifies rejection [`tests/test_validator.py`] — deferred, behavior correct; additional assertion is improvement only

---

## Dev Notes

### Architecture Context

This is story 5 of supp-epic-1 (furigana rework). The upstream story:
- **se1-1**: Created `parseInlineRuby()` and `story.v2.json` schema in `packages/schema`
- Stories se1-2, se1-3, se1-4 updated the loader and web UI — no dependency for se1-5

The backend is a standalone Python service in `apps/story-generator-backend/`. It has NO TypeScript dependency. The only cross-language dependency is `test_contract.py` which calls `loadStory()` from the built story-loader CJS package to verify the fixture round-trips cleanly.

### Current State of Files to Change

**`agent.py` — `build_system_prompt()` (lines 33–141)**

The output format block in the system prompt string currently reads:

```
"schema_version": "1",
...
"sentences": [
  {
    "id": "s01",
    "words": ["<word1>", "<word2>", ...],
    "ruby": ["<reading1 or null>", "<reading2 or null>", ...],
    "vocab_keys": [<vocab_id or null>, ...],
    ...
  }
]
```

Critical Rule #1 says: "`words`, `ruby`, and `vocab_keys` MUST have the SAME LENGTH"
Critical Rule #3 says: ruby values — provide hiragana, use null for non-kanji tokens

These need rewriting. The new sentence template is:

```
{
  "id": "s01",
  "words": ["<word1 with optional inline annotation>", ...],
  "vocab_keys": [<vocab_id or null>, ...],
  "translation": "...",
  "grammar": [...]
}
```

And the new furigana rule is: words containing kanji MUST use `漢字[よみ]` inline annotation syntax — the reading appears in square brackets after the kanji character(s).

**`agent.py` — `_coerce_string_nulls()` (lines 199–212)**

Currently iterates over `("ruby", "vocab_keys")`. With v2, the generated output never has a `ruby` field. Change the tuple to just `("vocab_keys",)` and update the docstring.

**`validator.py` (lines 1–128)**

The key block to remove is lines 89–101:
```python
ruby = sentence.get("ruby")
# ...
if ruby is not None and len(ruby) != n:
    errors.append(...)
```

The new bracket check iterates over each word in `words` and calls a helper.

**`tests/fixtures/valid_story.json`**

Convert all sentences. Example conversions from current v1 format:

| Sentence | Word | v1 ruby | v2 inline word |
|---|---|---|---|
| s01 | `だいがく` | `"だいがく"` | `"だいがく"` (already hiragana — no change) |
| s01 | `一年生` | `"いちねんせい"` | `"一年生[いちねんせい]"` |
| s03 | `けいざい` | `"けいざい"` | `"けいざい"` (hiragana — no change) |
| s04 | `にほん` | `"にほん"` | `"にほん"` (hiragana — no change) |
| s04 | `行きます` | `"いきます"` | `"行[い]きます"` |
| s05 | `読む` | `"よむ"` | `"読[よ]む"` |
| s05 | `漢字` | `"かんじ"` | `"漢字[かんじ]"` |
| s06 | `食べます` | `"たべます"` | `"食[た]べます"` |
| s09 | `二人` | `"ふたり"` | `"二人[ふたり]"` (jukujikun — whole-word) |
| s09 | `日本語` | `"にほんご"` | `"日本語[にほんご]"` |

Words that were already hiragana with `ruby: null` remain plain strings. Words with kanji where the ruby was the reading of the whole kanji block become `kanji[reading]`. When the reading spans kanji + okurigana, split at the kanji/okurigana boundary.

**Important:** `vocab_keys` arrays remain identical — only `words` strings and removal of `ruby` field changes.

### New Annotation Section for System Prompt

Add before the `## Output Format` section:

```
## Inline Furigana Annotation

Words containing kanji MUST be annotated using inline `漢字[よみ]` syntax.
The reading goes in square brackets immediately after the kanji character(s).
Non-kanji characters (hiragana, katakana, punctuation) between or after annotated
blocks are bare text — do not annotate them.

**Four patterns:**

| Pattern | Word | Annotated form |
|---|---|---|
| Jukujikun (whole-word) | 大人 | `大人[おとな]` |
| Kanji block + okurigana | 食べる | `食[た]べる` |
| Separate kanji, interleaved kana | 付け加える | `付[つ]け加[くわ]える` |
| Single kanji | 私 | `私[わたし]` |

Words that are pure hiragana, katakana, or punctuation: write them as plain strings
with no brackets.
```

### Bracket Annotation Validator Logic

```python
import re
_KANJI_RE = re.compile(r'[一-鿿㐀-䶿豈-﫿]')

def _is_kanji(ch: str) -> bool:
    return bool(_KANJI_RE.match(ch))

def _validate_word_annotation(word: str) -> str | None:
    """Return error message if annotation syntax is malformed, else None."""
    if '[' not in word:
        return None
    for i, ch in enumerate(word):
        if ch == '[':
            # Must be preceded by a kanji character
            if i == 0 or not _is_kanji(word[i - 1]):
                return f"word {word!r}: '[' at position {i} not preceded by a kanji character"
            # Must be closed
            rest = word[i + 1:]
            if ']' not in rest:
                return f"word {word!r}: '[' at position {i} is not closed"
    return None
```

Then in `validate()`, inside the per-sentence loop after the `id` check:

```python
words = sentence.get("words") or []
for word_str in words:
    if isinstance(word_str, str):
        msg = _validate_word_annotation(word_str)
        if msg:
            errors.append(ValidationError(
                code="VALIDATION_ERROR",
                message=f"sentence[{i}] (id={sentence.get('id', '?')}): {msg}",
                sentence_index=i,
            ))
```

### Updated Bad-Story Fixture for test_agent.py

Tests that currently use `"ruby": ["r1"]` to trigger a parallel-array mismatch need to use a different failure trigger. Switch to `vocab_keys` mismatch:

```python
bad_story = json.dumps({
    "schema_version": "2",
    "id": "test",
    "title": "Test",
    "title_ja": "テスト",
    "language": "ja",
    "description": "test",
    "sentences": [
        {
            "id": "s01",
            "words": ["a", "b"],
            "vocab_keys": [None],   # length 1 ≠ words length 2
        }
    ],
})
```

### Comment Style

Per project feedback: exported functions/components get a succinct one-line docstring. Major code sections within a function get a `# comment`. No multi-line comment blocks.

### File Header

All Python files start with a module docstring (first line of file), not a copyright header (Python convention differs from TypeScript in this project).

### Files to Change

| File | Change |
|------|--------|
| `apps/story-generator-backend/src/story_generator/agent.py` | `build_system_prompt()`: v2 template + annotation instructions; `_coerce_string_nulls()`: remove ruby |
| `apps/story-generator-backend/src/story_generator/validator.py` | Add bracket check; remove ruby length check |
| `apps/story-generator-backend/tests/test_validator.py` | Add 4–5 bracket validation tests |
| `apps/story-generator-backend/tests/test_agent.py` | Update bad-story fixtures; add prompt v2 assertion test |
| `apps/story-generator-backend/tests/fixtures/valid_story.json` | Convert to v2 format |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `apps/story-generator-backend/tests/test_contract.py` | No code changes needed; passes once fixture is v2 |
| `apps/story-generator-backend/src/story_generator/models.py` | Auto-generated v1 Pydantic model; used only by `spike.py` |
| `apps/story-generator-backend/src/story_generator/main.py` | HTTP endpoints not affected |
| `apps/story-generator-backend/src/story_generator/data_loader.py` | No change |
| All TypeScript packages and `apps/web` | v2 support already implemented in se1-1 through se1-4 |

### References

- Epic: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-5 section
- v2 JSON schema: `packages/schema/schemas/story.v2.json`
- ADR: `docs/adr/005-inline-furigana-format.md`
- Current agent.py: `apps/story-generator-backend/src/story_generator/agent.py`
- Current validator.py: `apps/story-generator-backend/src/story_generator/validator.py`
- Current test_validator.py: `apps/story-generator-backend/tests/test_validator.py`
- Current test_agent.py: `apps/story-generator-backend/tests/test_agent.py`
- Current fixture: `apps/story-generator-backend/tests/fixtures/valid_story.json`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Updated `build_system_prompt()` in `agent.py`: output template uses `schema_version: "2"`, added "Inline Furigana Annotation" section with all four annotation patterns and examples, removed `ruby` array from sentence template, updated Critical Rules (rule 1 now references `words`/`vocab_keys` only; rule 3 describes inline annotation format).
- Updated `_coerce_string_nulls()` in `agent.py`: removed `ruby` from coercion loop; now only coerces `vocab_keys`.
- Updated `validator.py`: added `_is_kanji()` helper (CJK Unicode ranges), `_validate_word_annotation()` checking for unclosed brackets and brackets not preceded by kanji; wired into per-sentence loop; removed `ruby` parallel-array length check; preserved `vocab_keys` parity check.
- Updated `tests/fixtures/valid_story.json` to v2: `schema_version: "2"`, all `ruby` fields removed, kanji words annotated inline (e.g. `行[い]きます`, `漢字[かんじ]`, `週末[しゅうまつ]`, `二人[ふたり]`, `日本語[にほんご]`).
- Updated `tests/test_validator.py`: added 6 bracket-validation tests (well-formed, multiple annotations, plain word, unclosed bracket, non-kanji prefix, empty string); added `_minimal_story()` helper; updated existing tests to use `schema_version: "2"`.
- Updated `tests/test_agent.py`: replaced `ruby` array mismatch in 2 bad-story fixtures with `vocab_keys` mismatch; added `test_system_prompt_contains_v2_format_instructions`.
- Full test suite: 40 tests pass, 0 failures.

### File List

- `apps/story-generator-backend/src/story_generator/agent.py`
- `apps/story-generator-backend/src/story_generator/validator.py`
- `apps/story-generator-backend/tests/fixtures/valid_story.json`
- `apps/story-generator-backend/tests/test_validator.py`
- `apps/story-generator-backend/tests/test_agent.py`
