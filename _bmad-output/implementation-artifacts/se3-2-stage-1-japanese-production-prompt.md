# Story se3-2: Stage 1 — Japanese Production Prompt

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **story author**,
I want a Stage-1 prompt builder that produces **only Japanese prose** from an English or Japanese
source — translating (EN→JA) or simplifying (JA→JA), optionally constrained to a Genki chapter,
so that "produce the Japanese" is a single concern, cleanly decoupled from segmentation and
annotation (which is Stage 2 / se3-3).

## Context

This is the **second story of supp-epic-3** (Staged Generation Pipeline), landing on top of the
already-merged se3-1 (`_stream_llm` extraction). It is **purely additive**: it adds one new
prompt-builder function (`build_japanese_production_prompt`) plus its unit tests. It does **not**
wire the prompt into `generate()`, does **not** add `path_mode="C"`, and does **not** touch the
two-stage orchestration — all of that is se3-4.

Today the only Japanese-production prompt is the **fused** `build_system_prompt`
([`agent.py:33-130`](../../apps/story-generator-backend/src/story_generator/agent.py#L33-L130)),
which simultaneously translates, segments, glosses, and grammar-tags in one JSON call. This story
carves out the "translate/simplify to Japanese prose" concern into its own prompt so the later
two-stage pipeline can run it as Stage 1 and hand its plain-Japanese output to the Stage-2 analysis
prompt (se3-3). The fused `build_system_prompt` **stays in place and keeps working** until se3-4
replaces the orchestration — do not delete or repurpose it in this story.

Full epic: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(Design Decisions "Stage 1 output is plain Japanese prose", "Extract the shared LLM streamer first";
Story se3-2, Routing table).

## Acceptance Criteria

1. **AC1 — Function exists with the exact signature**
   A new module-level function exists in
   [`agent.py`](../../apps/story-generator-backend/src/story_generator/agent.py) that returns a
   prompt string. It takes `vocab_data`/`grammar_data` as leading positional args (matching
   `build_system_prompt`'s convention — module-level prompt builders receive the curriculum data
   objects rather than reaching for globals):
   ```python
   def build_japanese_production_prompt(
       vocab_data: VocabData,
       grammar_data: GrammarData,
       source: str,
       *,
       source_is_japanese: bool,
       target_chapter: int | None,
       steering_instructions: str = "",
   ) -> str:
   ```
   The epic states the conceptual signature as `build_japanese_production_prompt(source, *,
   source_is_japanese, target_chapter, steering_instructions)`; the `vocab_data`/`grammar_data`
   leading args are the concrete adaptation to this codebase's builder convention (they are only
   consulted when `target_chapter` is set — see AC4/AC7).

2. **AC2 — Output is Japanese prose only, minimal JSON**
   The prompt instructs the model to return **only** the Japanese story text as minimal JSON
   `{"japanese": "<full story text>"}` — and explicitly **not** to produce `words`, `english`,
   `grammar`, `vocab_keys`, `title`, `title_ja`, `description`, `id`, furigana, or any per-sentence
   segmentation. (Segmentation/annotation/metadata is Stage 2's job — se3-3.)

3. **AC3 — Segmentation & annotation instructions are absent**
   The produced prompt contains **none** of the Stage-2-only instructions: no "Word Segmentation
   Rules" block, no `"words"` array description, no `"vocab_keys"`, no `"vocab_supplement"`, no
   furigana bracket syntax (`漢字[よみ]`), no per-sentence `"english"` gloss, no `"grammar"` index
   instruction, no `id`/`title`/`title_ja`/`description` output fields.

4. **AC4 — English source + target chapter N → constrained translation**
   When `source_is_japanese=False` and `target_chapter` is an int `N`, the prompt:
   - injects the **cumulative Ch.1..N vocabulary block** (same content/format as
     [`agent.py:44-49`](../../apps/story-generator-backend/src/story_generator/agent.py#L44-L49)),
   - injects the **cumulative Ch.1..N grammar block** (same content/format as
     [`agent.py:53-57`](../../apps/story-generator-backend/src/story_generator/agent.py#L53-L57)),
   - includes the hard constraint **"do not introduce vocabulary beyond Chapter N"**
     (from [`agent.py:125`](../../apps/story-generator-backend/src/story_generator/agent.py#L125)),
   - instructs a **faithful translation** of the English source **down to that level**.

5. **AC5 — English source + no target → natural translation**
   When `source_is_japanese=False` and `target_chapter is None`, the prompt injects **no**
   vocabulary or grammar block and **no** "beyond Chapter N" constraint; it instructs a faithful
   translation at **natural difficulty** (no Genki constraint).

6. **AC6 — Japanese source + target chapter N → simplify (not translate)**
   When `source_is_japanese=True` and `target_chapter` is an int `N`, the prompt instructs the
   model to **simplify the given Japanese** to Ch.1..N vocabulary/grammar — the verb is
   **"simplify"/"rewrite"**, explicitly **not** "translate". The same cumulative Ch.1..N vocab and
   grammar blocks and the "do not introduce vocabulary beyond Chapter N" constraint are injected.

7. **AC7 — Curriculum data reuse, byte-identical vocab/grammar blocks**
   The cumulative vocab and grammar block builders are **shared** with `build_system_prompt` (do not
   copy-paste divergent loops). Extract the two cumulative loops into small module-level helpers
   (e.g. `_cumulative_vocab_block(vocab_data, chapter) -> str` and
   `_cumulative_grammar_block(grammar_data, chapter) -> str`), refactor `build_system_prompt` to call
   them, and call them from `build_japanese_production_prompt`. The helper output must be
   **byte-identical** to today's inline loops so the existing `build_system_prompt` tests
   (`test_system_prompt_includes_cumulative_vocab_up_to_chapter`,
   `test_system_prompt_includes_grammar_for_chapter`,
   `test_system_prompt_has_simplified_format`) pass **unchanged**.

8. **AC8 — Steering instructions honoured**
   A non-empty `steering_instructions` is appended as an "Additional Instructions" block using the
   **same** `steering_block` pattern as `build_system_prompt`
   ([`agent.py:60-64`](../../apps/story-generator-backend/src/story_generator/agent.py#L60-L64));
   an empty/whitespace value injects nothing.

9. **AC9 — Unit tests cover every branch**
   New tests in `tests/test_agent.py` assert:
   - vocab/grammar constraint text and "beyond Chapter N" constraint are present **only** when
     `target_chapter` is set, and **absent** when `target_chapter is None` (AC4/AC5),
   - the JA-source variant instructs to **"simplify"** (and does **not** say "translate") (AC6),
   - the EN-source variant instructs to **translate**,
   - segmentation/annotation/metadata instructions are **absent** in all variants (AC3),
   - the minimal `{"japanese": ...}` output shape is requested (AC2),
   - `steering_instructions` appears when provided and not when empty (AC8).

10. **AC10 — No regressions, scope fence holds**
    `pytest tests/` is fully green with **no edits to existing test assertions**. `generate()`,
    `_generate_proposal()`, `_stream_llm`, `main.py`, and the wire contract are **unchanged** — this
    story adds a prompt builder and its tests and refactors two private block-building loops only.

## Tasks / Subtasks

- [x] Task 1: Extract cumulative vocab/grammar block helpers (AC: 7)
  - [x] Add module-level `_cumulative_vocab_block(vocab_data: VocabData, chapter: int) -> str`
        reproducing [`agent.py:43-49`](../../apps/story-generator-backend/src/story_generator/agent.py#L43-L49)
        **exactly** (including the `"  (none)"` fallback and the `  {id} | {hiragana}{kanji_part} | {translation}` line format)
  - [x] Add module-level `_cumulative_grammar_block(grammar_data: GrammarData, chapter: int) -> str`
        reproducing [`agent.py:52-57`](../../apps/story-generator-backend/src/story_generator/agent.py#L52-L57)
        **exactly** (including the `  [Ch{ch} {gp.point}] {gp.title}: {gp.summary}` line format and `"  (none)"` fallback)
  - [x] Refactor `build_system_prompt` to call the two helpers in place of its inline loops; leave
        every other line of that function (task text, output format, rules, difficulty) untouched
  - [x] Run `pytest tests/test_agent.py -k "system_prompt"` — the three existing prompt tests must
        pass with no assertion edits (proves byte-identical extraction)

- [x] Task 2: Add `build_japanese_production_prompt` (AC: 1, 2, 3, 4, 5, 6, 8)
  - [x] Place it directly after `build_system_prompt` (before `build_proposal_prompt`), under a
        new `# Stage 1 — Japanese production prompt` section banner
  - [x] Signature per AC1 (`vocab_data, grammar_data, source, *, source_is_japanese, target_chapter, steering_instructions=""`)
  - [x] Build the `steering_block` with the existing pattern (reuse from `build_system_prompt`)
  - [x] Branch on `target_chapter is None`:
        - **None** → no vocab/grammar/constraint blocks; instruction is translate-at-natural (EN)
          or (defensively) echo/leave-as-is (JA — see Dev Note; this combination is not reached in
          production because se3-4 skips Stage 1 for frozen JA)
        - **int N** → inject `_cumulative_vocab_block(...)`, `_cumulative_grammar_block(...)`, and the
          "do not introduce vocabulary beyond Chapter {N}" constraint
  - [x] Branch on `source_is_japanese` for the task verb: **"translate this English story into
        Japanese"** vs **"simplify/rewrite this Japanese story"** — the JA branch must not use the
        word "translate"
  - [x] Instruct the minimal JSON output `{"japanese": "<full story text>"}` and explicitly forbid
        segmentation/gloss/grammar/metadata/furigana fields (AC2/AC3)
  - [x] Add a succinct docstring (project-context §Comments) and a `# section` block comment or two
        labelling the constraint-block assembly

- [x] Task 3: Unit tests (AC: 9, 10)
  - [x] Add tests to `tests/test_agent.py` using the existing `vocab_data`/`grammar_data` module
        fixtures (`tests/test_agent.py:109-120`) — no Gemini call, no `generate()`; call the builder
        directly and assert on the returned string
  - [x] Cover: EN+N (constraint present, "translate", vocab line prefix `  {id} |` present),
        EN+None (no vocab block, no "beyond Chapter" text, "natural"),
        JA+N ("simplify" present, "translate" absent, constraint present),
        absent-segmentation (`"words"`, `vocab_keys`, `漢字[よみ]`, `"english"` all absent),
        output-shape (`{"japanese"` requested), steering (present when set, absent when "")
  - [x] Run `pytest tests/ -v` — all green, no existing assertions edited

### Review Findings

_Code review 2026-07-12 (bmad-code-review, 3 layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor). Core string assembly, byte-identical helper extraction (AC7), branch coverage (AC9), and scope fences (AC10) all verified clean by all three layers. No decision-needed, no patch findings. 6 dismissed as noise/by-design (grammar-discipline asymmetry matches the fused prompt & AC; JSON-escaping is inherent design; the defensive JA+None echo branch is spec-mandated & tested; the `"translate"`/`"translation"` substring tests are currently correct; the double `.strip()` is the mandated AC8 pattern; naming `vocab_keys`/`title_ja` literally would break the AC3 absence test — intent fully met via "any per-sentence structure")._

The following are real robustness gaps deferred to **se3-4**, which owns chapter-string parsing and input validation (spec: "chapter-string parsing and the 'unspecified' sentinel live in se3-4"):

- [x] [Review][Defer] `target_chapter <= 0` produces a self-contradictory constrained prompt [`agent.py:build_japanese_production_prompt`] — deferred; se3-4 owns chapter validation. With `target_chapter=0` (or negative), the `is None` guard is skipped so the constrained path runs: `range(1, chapter+1)` is empty → both blocks render `  (none)`, yet the prompt still says "use ONLY … up to Chapter 0", "cumulative Ch.1–0", and "Do not introduce vocabulary beyond Chapter 0". No lower-bound guard. se3-4's `_parse_chapter` must guarantee `chapter >= 1` before calling this builder.
- [x] [Review][Defer] `target_chapter` beyond the highest Genki chapter silently misrepresents the ceiling [`agent.py:build_japanese_production_prompt`] — deferred; se3-4 owns chapter validation. `by_chapter.get(ch, [])` skips nonexistent chapters without error, so the prompt claims "calibrated to … Chapter 99" / "cumulative Ch.1–99" while the ceiling effectively becomes "everything." se3-4 should validate/clamp against the real chapter range.
- [x] [Review][Defer] Empty/whitespace `source` embeds a blank Source Story body [`agent.py:build_japanese_production_prompt`] — deferred; se3-4 owns input validation. `source.strip()` reduces an empty/whitespace input to `""`, producing a well-formed prompt asking Stage 1 to translate/simplify nothing (fabrication or empty `{"japanese": ""}`). se3-4 should reject an empty source before building the Stage-1 prompt.

## Dev Notes

### What Stage 1 is (and is NOT)

Stage 1 = "produce the Japanese string." Nothing else. Its entire output is a Japanese prose blob.
The downstream Stage 2 (se3-3) will take that blob and do all the segmentation, back-translation,
grammar tagging, and metadata invention. Keeping Stage 1 output as `{"japanese": "..."}` means
produced Japanese and pasted Japanese reach Stage 2 in the **identical shape** (a Japanese string) —
that is the whole point of the split (epic Design Decision "Stage 1 output is plain Japanese prose").

**Concretely, the produced prompt must NOT mention any of:** `words`, Word Segmentation Rules,
`vocab_keys`, `vocab_supplement`, furigana / `漢字[よみ]`, per-sentence `english`, `grammar` indices,
`id`, `title`, `title_ja`, `description`. Every one of those is a Stage-2 concern. AC3 + the
absence tests are the guardrail against accidentally carrying fused-prompt text over.

### The routing matrix this prompt serves (from the epic)

| Caller (in se3-4, not this story) | `source_is_japanese` | `target_chapter` | This prompt does |
|---|---|---|---|
| Path A / B-phase-2, target = Ch.N | `False` | `N` | translate EN → JA constrained to Ch.1..N |
| Path A, target = Unspecified | `False` | `None` | translate EN → JA at natural difficulty |
| Path C, target = Ch.N | `True` | `N` | **simplify** the pasted JA to Ch.1..N |
| Path C, target = Unspecified | — | — | **Stage 1 skipped entirely** (se3-4); prompt not built |

So in production, `source_is_japanese=True` is only ever paired with a real chapter. The
`source_is_japanese=True, target_chapter=None` cell is **not exercised** by se3-4 (it skips Stage 1
for frozen Japanese). Handle it defensively anyway — the safest behaviour is to instruct the model
to return the Japanese **unchanged** (echo) with no constraint — but do not over-invest; a short
guard is enough. Document this in a code comment so a future caller isn't surprised.

### Reuse target: the exact loops to extract (do not diverge them)

The vocab loop today ([`agent.py:43-49`](../../apps/story-generator-backend/src/story_generator/agent.py#L43-L49)):

```python
vocab_lines: list[str] = []
for ch in range(1, chapter + 1):
    for entry in vocab_data.by_chapter.get(ch, []):
        kanji_part = f" ({entry.kanji})" if entry.kanji else ""
        vocab_lines.append(f"  {entry.id} | {entry.hiragana}{kanji_part} | {entry.translation}")
vocab_block = "\n".join(vocab_lines) if vocab_lines else "  (none)"
```

The grammar loop today ([`agent.py:52-57`](../../apps/story-generator-backend/src/story_generator/agent.py#L52-L57)):

```python
grammar_lines: list[str] = []
for ch in range(1, chapter + 1):
    for gp in grammar_data.by_chapter.get(ch, []):
        grammar_lines.append(f"  [Ch{ch} {gp.point}] {gp.title}: {gp.summary}")
grammar_block = "\n".join(grammar_lines) if grammar_lines else "  (none)"
```

Move each verbatim into a helper returning the joined block string. `build_system_prompt` then reads
`vocab_block = _cumulative_vocab_block(vocab_data, chapter)` etc. **Byte-for-byte identical output**
is required — `test_system_prompt_includes_cumulative_vocab_up_to_chapter` asserts the exact
`  {entry.id} |` line prefix and that Ch.4-only ids are absent at Ch.3; `test_system_prompt_includes_grammar_for_chapter`
asserts each `gp.title` substring; keep the leading two-space indent and the `|`/`[Ch..]` formatting.

> **se3-3 forward-note (not this story):** Stage 2 needs a **full** cumulative Genki grammar set when
> no target is chosen. Do **not** build that here. When se3-3 needs it, it can generalise
> `_cumulative_grammar_block` (e.g. accept `chapter: int | None` where `None` → every chapter in
> `grammar_data.by_chapter`). Leaving the helper at `chapter: int` now keeps se3-2 minimal; flag the
> generalisation as se3-3's call.

### Data shapes (so references are correct)

`VocabData.by_chapter: dict[int, list[VocabEntry]]`; `VocabEntry` = `id:int, hiragana:str,
kanji:str, translation:str, chapter:int`. `GrammarData.by_chapter: dict[int, list[GrammarPoint]]`;
`GrammarPoint` = `chapter:int, point:str (e.g. "1.1"), title:str, summary:str`.
[Source: [`data_loader.py:7-40`](../../apps/story-generator-backend/src/story_generator/data_loader.py#L7-L40)]

`VocabData`/`GrammarData` are already imported at the top of `agent.py`
([`agent.py:11`](../../apps/story-generator-backend/src/story_generator/agent.py#L11)) — reuse the
import for the helper/function type hints.

### Output-shape decision: JSON `{"japanese": ...}` (not plain text)

The epic offers "minimal JSON `{"japanese": "..."}` (or plain text)". Use **JSON** as the contract:
it gives se3-4 one deterministic key to parse and matches the epic's primary phrasing. se3-4 will
run this prompt through `_stream_llm(..., json_output=True, ...)` and `json.loads` the `"japanese"`
field — but **that wiring is se3-4, not here.** This story only makes the prompt *ask for* that
shape. (Plain-text was considered — marginally more robust for a large prose blob but loses the
clean single-key seam; deferred to se3-4 if it proves flaky against the eval harness.)

### Prompt-builder unit-test pattern (match existing style)

Existing prompt tests exercise the builder **through** `generate()` with a capturing stream client
(`make_capturing_stream_client`, `tests/test_agent.py:87-95`). For se3-2 that is unnecessary and
out of scope — `build_japanese_production_prompt` is a **pure function**, so call it **directly**:

```python
def test_production_prompt_en_target_injects_constraint(vocab_data, grammar_data):
    from story_generator.agent import build_japanese_production_prompt
    prompt = build_japanese_production_prompt(
        vocab_data, grammar_data, "Ken went to the park.",
        source_is_japanese=False, target_chapter=3,
    )
    assert "beyond Chapter 3" in prompt          # constraint present
    assert "  1 |" in prompt or any(f"  {e.id} |" in prompt for e in vocab_data.by_chapter[1])
    assert "translate" in prompt.lower()
    assert "simplify" not in prompt.lower()

def test_production_prompt_en_no_target_is_natural(vocab_data, grammar_data):
    from story_generator.agent import build_japanese_production_prompt
    prompt = build_japanese_production_prompt(
        vocab_data, grammar_data, "Ken went to the park.",
        source_is_japanese=False, target_chapter=None,
    )
    assert "beyond Chapter" not in prompt        # no ceiling
    assert "Vocabulary available" not in prompt  # no vocab block header

def test_production_prompt_ja_target_says_simplify(vocab_data, grammar_data):
    from story_generator.agent import build_japanese_production_prompt
    prompt = build_japanese_production_prompt(
        vocab_data, grammar_data, "けんは こうえんに いきました。",
        source_is_japanese=True, target_chapter=3,
    )
    assert "simplify" in prompt.lower()
    assert "translate" not in prompt.lower()

def test_production_prompt_omits_stage2_instructions(vocab_data, grammar_data):
    from story_generator.agent import build_japanese_production_prompt
    prompt = build_japanese_production_prompt(
        vocab_data, grammar_data, "Ken went to the park.",
        source_is_japanese=False, target_chapter=3,
    )
    for banned in ('"words"', "vocab_keys", "vocab_supplement", "漢字[よみ]", '"english"',
                   "Word Segmentation", '"title"', '"description"'):
        assert banned not in prompt, f"Stage-2 token leaked into Stage-1 prompt: {banned}"
    assert '{"japanese"' in prompt                # minimal output shape requested
```

Fixtures `vocab_data`/`grammar_data` already exist at `tests/test_agent.py:109-120` (module scope,
loaded from `resources/genki1vocab.csv` and `resources/Genki_grammar_for_AI_generation.csv`) — reuse
them; do not add new fixtures. Match the "vocab line prefix `  {id} |`" assertion idiom used at
`tests/test_agent.py:186` so the constraint-content checks stay consistent with the fused-prompt tests.

### Header-text wording guidance (so the absence tests are robust)

To keep AC3's absence assertions clean, avoid substrings that collide with Stage-2 vocabulary. When
naming the constrained-vocab section, prefer a header like `## Curriculum Constraints` /
`### Vocabulary available (cumulative Ch.1–N)` (same as the fused prompt) — the absence tests key off
Stage-2-only tokens (`"words"`, `vocab_keys`, `漢字[よみ]`, `"english"`, "Word Segmentation"), not off
the word "vocabulary", so reusing the fused prompt's `Vocabulary available` header is fine and the
`en_no_target` test asserts that **header** is gone when unconstrained.

### Behavioural nuances to preserve

- **Do not touch `build_system_prompt`'s output** other than swapping the two loops for helper calls.
  Its task text, `## English Source Story`, `## Word Segmentation Rules`, `## Output Format`, and
  `## Rules` sections stay exactly as they are — se3-4 removes the fused prompt from the call path,
  not this story.
- **`_parse_chapter` is not called here.** `build_japanese_production_prompt` receives an already-int
  `target_chapter | None`; chapter-string parsing and the `"unspecified"` sentinel live in se3-4.
- **No `generate()` call, no streaming, no `main.py`.** If you find yourself editing `generate()` you
  are in se3-4 territory — stop.

### Code style (project-context.md §Comments; se2-1/se2-2/se3-1 precedent)

- `from __future__ import annotations` is already present at
  [`agent.py:2`](../../apps/story-generator-backend/src/story_generator/agent.py#L2) — keep it (lets
  you write `int | None` hints freely).
- Succinct docstrings on the new function and the two helpers; block comments to label major sections
  (constraint-block assembly / task framing / output format). Do not narrate obvious mechanics.
- Follow the existing f-string prompt-assembly style of `build_system_prompt`/`build_proposal_prompt`.

### Project Structure Notes

- Single-file source change plus tests:
  `apps/story-generator-backend/src/story_generator/agent.py` (add helpers + new prompt builder;
  refactor `build_system_prompt`'s two loops) and
  `apps/story-generator-backend/tests/test_agent.py` (new prompt-builder tests only).
- No new modules, no new dependencies, no `main.py`/`validator.py`/`enrichment.py` change, no fixture
  change. ADK stays deferred (epic scope note) — plain-Python only; do not import `google-adk`.
- Runtime: `pytest` needs no `GEMINI_API_KEY` (pure prompt-builder tests + injection seam elsewhere).
  Run from `apps/story-generator-backend`. Note the pre-existing
  `test_streaming_timeout_yields_error` case makes the full agent suite take ~2 min — expected.

### References

- [Source: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)]
  — Story se3-2 ACs; Design Decisions "Stage 1 output is plain Japanese prose", "Stage 2 is a single
  universal prompt" (for the Stage-1/Stage-2 boundary); Routing table (call counts per path).
- [Source: [`agent.py:33-130`](../../apps/story-generator-backend/src/story_generator/agent.py#L33-L130)]
  — `build_system_prompt`: the fused prompt this story carves from; vocab loop `:43-49`, grammar loop
  `:52-57`, steering block `:60-64`, "beyond Chapter N" constraint `:125`, segmentation rules `:90-97`.
- [Source: [`agent.py:138-167`](../../apps/story-generator-backend/src/story_generator/agent.py#L138-L167)]
  — `build_proposal_prompt`: precedent for a small, single-concern prompt builder + its steering block.
- [Source: [`data_loader.py:7-40`](../../apps/story-generator-backend/src/story_generator/data_loader.py#L7-L40)]
  — `VocabData`/`VocabEntry`/`GrammarData`/`GrammarPoint` shapes.
- [Source: [`tests/test_agent.py:109-120`](../../apps/story-generator-backend/tests/test_agent.py#L109-L120)]
  — `vocab_data`/`grammar_data` fixtures to reuse.
- [Source: [`tests/test_agent.py:167-253`](../../apps/story-generator-backend/tests/test_agent.py#L167-L253)]
  — existing `build_system_prompt` tests (the byte-identical-extraction regression net) and the
  `  {id} |` assertion idiom.
- [Source: [`_bmad-output/implementation-artifacts/se3-1-shared-llm-streamer-extraction.md`](se3-1-shared-llm-streamer-extraction.md)]
  — predecessor story; established the `_stream_llm` seam Stage 1/Stage 2 will run through in se3-4.
- [Source: `_bmad-output/project-context.md` §Comments] — docstring + block-comment style.

## What does NOT belong in this story

- **No wiring into `generate()`** — running Stage 1 (and Stage 2), skipping Stage 1 for frozen JA,
  and short-circuiting on failure is **se3-4**.
- **No `path_mode="C"`, no `chapter="unspecified"` sentinel, no `_parse_chapter` change, no
  `difficulty_label`** — all se3-4.
- **No Stage-2 analysis prompt** (`build_japanese_analysis_prompt`) — that is **se3-3**.
- **No change to `build_system_prompt`'s prompt text** beyond swapping its two loops for the shared
  helpers; the fused prompt keeps working until se3-4 removes it from the call path.
- **No `_stream_llm`, `main.py`, `validator.py`, `enrichment.py`, or wire-format change.**
- **No `google-adk` import** — ADK stays deferred for the whole epic.
- **No edits to existing test assertions** — they are the regression net.

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `pytest tests/test_agent.py -k "system_prompt"` → 3 passed (byte-identical extraction proven, no assertion edits).
- `pytest tests/test_agent.py -k "production_prompt or system_prompt"` → 9 passed (6 new + 3 regression).
- `pytest tests/` → 71 passed in 124.66s (full suite, no regressions; ~2 min is expected due to `test_streaming_timeout_yields_error`).

### Completion Notes List

- Extracted the two cumulative-curriculum loops into module-level helpers
  `_cumulative_vocab_block` / `_cumulative_grammar_block`; `build_system_prompt` now calls them in
  place of its inline loops. Output is byte-identical — the three existing `system_prompt` tests pass
  with no assertion changes (AC7/AC10).
- Added `build_japanese_production_prompt(vocab_data, grammar_data, source, *, source_is_japanese,
  target_chapter, steering_instructions="")` under a new `# Stage 1 — Japanese production prompt`
  banner, before `build_proposal_prompt` (AC1). It requests minimal JSON `{"japanese": "..."}` and
  explicitly forbids words/furigana/gloss/grammar/metadata (AC2/AC3).
- Branching: `target_chapter=None` → no curriculum constraint (EN → natural translation; JA →
  defensive echo-unchanged, documented as unreachable-in-production per se3-4); `target_chapter=N` →
  cumulative Ch.1–N vocab + grammar blocks and the "do not introduce vocabulary beyond Chapter N"
  constraint (AC4/AC6). EN source is "translate"; JA source is "rewrite/simplify" and never says
  "translate" (AC5/AC6). Steering reuses the existing `steering_block` pattern (AC8).
- Six new tests cover every branch + the absence guardrail across all four `(source_is_japanese,
  target_chapter)` combinations and the steering present/absent cases (AC9).
- Scope fence held: `generate()`, `_generate_proposal()`, `_stream_llm`, `main.py`, `validator.py`,
  `enrichment.py`, and the wire contract are untouched; no new deps, no `google-adk` import (AC10).

### File List

- `apps/story-generator-backend/src/story_generator/agent.py` (modified — added
  `_cumulative_vocab_block`, `_cumulative_grammar_block`, `build_japanese_production_prompt`;
  refactored `build_system_prompt` loops)
- `apps/story-generator-backend/tests/test_agent.py` (modified — added 6 Stage-1 prompt-builder tests)

### Change Log

- 2026-07-12 — se3-2 implemented: extracted shared cumulative vocab/grammar block helpers and added
  the Stage-1 `build_japanese_production_prompt` (plain-Japanese production, decoupled from
  segmentation/annotation) with full branch-coverage unit tests. All 71 backend tests green.
