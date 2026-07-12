# Story se3.3: Stage 2 — Universal Japanese Analysis Prompt

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **story author**,
I want one analysis prompt that turns **any** Japanese string into the segmented, glossed,
grammar-tagged structure the enrichment pipeline consumes,
so that produced Japanese (Stage 1) and pasted Japanese (Path C) are analysed **identically**, and
there is a single place to improve segmentation / dictionary-form / ruby quality later.

## Context

This is the **third story of supp-epic-3** (Staged Generation Pipeline), landing on top of
already-merged se3-1 (`_stream_llm` extraction) and se3-2 (`build_japanese_production_prompt`, the
Stage-1 production prompt). It is **purely additive**: it adds one new prompt-builder function
(`build_japanese_analysis_prompt`) plus its unit tests, and makes two small **byte-identical**
refactors to shared prompt fragments so Stage 2 reuses them without divergence. It does **not** wire
the prompt into `generate()`, does **not** add `path_mode="C"`, does **not** add the
`chapter="unspecified"` sentinel or `_parse_chapter` changes, and does **not** touch the two-stage
orchestration — all of that is **se3-4**.

Today the only prompt that emits the seam structure is the **fused** `build_system_prompt`
([`agent.py:63-147`](../../apps/story-generator-backend/src/story_generator/agent.py#L63-L147)),
which simultaneously **translates** an English source, **constrains** it to a Genki chapter,
**segments** it, **glosses** it, and **grammar-tags** it in one JSON call. Stage 2 carves out only
the "analyse a Japanese string into the seam" concern: it **echoes** the Japanese unchanged (no
translation, no simplification), **segments** it, **back-translates** each sentence to `english`,
**invents** the story metadata (`id/title/title_ja/description`), and **grammar-tags** it. The fused
`build_system_prompt` **stays in place and keeps working** until se3-4 replaces the orchestration —
do not delete or repurpose it in this story.

### Why this is one shared, reusable prompt

The epic makes Stage 2 a **single universal prompt** run on every path: produced Japanese (from
Stage 1) and pasted Japanese (Path C, frozen) reach it in the **identical shape** (a Japanese
string). This is deliberate — it gives us **one** place to improve word segmentation,
dictionary-form derivation, and ruby accuracy (the three quality targets of the planned agentic
epic), and it is the production adapter the eval harness will call (se3-6). A weak analysis prompt
surfaces as a clean `VALIDATION_ERROR` downstream (via `validate()` — `agent.py:679`), not a crash.

Full epic: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(Design Decision "Stage 2 is a single universal prompt"; Story se3-3; "Grammar-tagging reference
set"; Risks "Stage-2 analysis prompt is the central quality dependency on every path").

## Acceptance Criteria

1. **AC1 — Function exists with the exact signature**
   A new module-level function exists in
   [`agent.py`](../../apps/story-generator-backend/src/story_generator/agent.py) that returns a
   prompt string:
   ```python
   def build_japanese_analysis_prompt(
       grammar_data: GrammarData,
       japanese_text: str,
       *,
       target_chapter: int | None,
       steering_instructions: str = "",
   ) -> str:
   ```
   **Only `grammar_data` is a data-object parameter** — the analysis prompt tags grammar but does
   **not** constrain vocabulary (the Japanese already exists), so **do not** add a `vocab_data`
   parameter (it would be dead). The epic states the conceptual signature as
   `build_japanese_analysis_prompt(japanese_text, *, target_chapter, steering_instructions)`; the
   leading `grammar_data` arg is the concrete adaptation to this codebase's builder convention
   (module-level prompt builders receive the curriculum data they consult rather than reaching for
   globals — matches `build_system_prompt` / `build_japanese_production_prompt`).

2. **AC2 — Output JSON shape is the full seam the pipeline consumes**
   The prompt instructs the model to return a **single JSON object** with exactly the top-level
   fields `id`, `title`, `title_ja`, `description`, `grammar`, and `sentences`, where each
   `sentences[]` entry is `{english, japanese, words, grammar}`. This is the **same simplified shape
   the fused `build_system_prompt` already emits** (`agent.py:118-134`) — enrichment
   (`build_enriched_story`) injects `schema_version`, `language`, `difficulty`, `vocab_keys`,
   `vocab_supplement`, and furigana downstream, so the prompt must **NOT** request any of those.
   (Confirmed: `enrichment.py:433-444` reads only `story_meta[id/title/title_ja/description/grammar]`
   and `segment[english/japanese/words/grammar]`; it sets `schema_version="2"` and `language="ja"`
   itself, and `difficulty` is set by `generate()` in se3-4.)

3. **AC3 — Echo the Japanese exactly (no rewriting, no translation, no simplification)**
   The prompt instructs the model to **preserve each sentence's Japanese verbatim** — it must split
   the given `japanese_text` into sentences and copy each sentence character-for-character into that
   sentence's `japanese` field, **without** translating, simplifying, correcting, or otherwise
   altering it. An explicit "do not alter / do not rewrite the Japanese" instruction is present.

4. **AC4 — Word Segmentation Rules reused verbatim (join-invariant preserved)**
   The prompt includes the **existing Word Segmentation Rules block** from `build_system_prompt`
   ([`agent.py:107-114`](../../apps/story-generator-backend/src/story_generator/agent.py#L107-L114))
   so that `"".join(words)` reconstructs `japanese` and the enrichment guard
   ([`enrichment.py:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L366-L374))
   passes. **Do not copy-paste** the rules — extract them into a shared module-level constant
   (e.g. `_WORD_SEGMENTATION_RULES`), refactor `build_system_prompt` to interpolate it, and reuse it
   in `build_japanese_analysis_prompt`. Extraction must be **byte-identical** so
   `test_system_prompt_has_simplified_format` passes **unchanged** (it asserts `"particles"` and
   `'"words"'` are present and `漢字[よみ]` / `vocab_keys` / `vocab_supplement` are absent).

5. **AC5 — Back-translation into `english` per sentence**
   The prompt requires a **faithful English back-translation** of each echoed Japanese sentence in
   that sentence's `english` field. (This back-translation uniformly replaces today's source-derived
   gloss — there is no English source on Path C, so `english` must be derived from the Japanese.)

6. **AC6 — Metadata invention (all validator-required fields)**
   The prompt requires the model to **invent** a **kebab-case** `id` (filename-safe: lowercase,
   hyphens, no spaces/special chars), an English `title`, a Japanese `title_ja`, and a 1–2 sentence
   English `description`, all derived from the story content. These four plus the top-level `grammar`
   array populate `story_meta`; `id/title/title_ja/description` are **validator-required**
   ([`validator.py:24-26`](../../apps/story-generator-backend/src/story_generator/validator.py#L24-L26)).

7. **AC7 — Grammar-reference switch: Ch.1..N when targeted, full set when unspecified**
   The story-level `grammar` array and per-sentence `grammar` indices are tagged against a **grammar
   reference block** injected into the prompt:
   - `target_chapter = N` → the **cumulative Ch.1..N** grammar block (same content/format as the
     fused prompt).
   - `target_chapter is None` → the **full cumulative Genki grammar set** (every chapter present in
     `grammar_data.by_chapter`), so grammar highlights still populate without constraining the text.
   Implement the switch by **generalising `_cumulative_grammar_block`** to accept
   `chapter: int | None`, where `None` means "all chapters". The `int` path must stay
   **byte-identical** (the three existing `system_prompt` tests are the regression net).

8. **AC8 — Grammar tagging is a reference, not a vocabulary constraint**
   The grammar block is presented as the **set of patterns to tag/recognise**, not as a "use only
   these" generation constraint. The prompt must contain **no** "do not introduce vocabulary beyond
   Chapter N" text and **no** cumulative-vocabulary block — Stage 2 never restricts vocabulary
   (`vocab_data` is not even a parameter — AC1).

9. **AC9 — Steering instructions honoured**
   A non-empty `steering_instructions` is appended as an "Additional Instructions" block using the
   **same** `steering_block` pattern as `build_system_prompt`
   ([`agent.py:77-81`](../../apps/story-generator-backend/src/story_generator/agent.py#L77-L81)); an
   empty/whitespace value injects nothing.

10. **AC10 — Unit tests cover every branch**
    New tests in `tests/test_agent.py` (reusing the module-scope `grammar_data` fixture) assert:
    - the **"do not alter / echo the Japanese exactly"** instruction is present (AC3),
    - the **segmentation-rules** text is present (`"particles"`; the join-invariant instruction) (AC4),
    - the **back-translation** requirement is present (`english` per sentence) (AC5),
    - the **id/title/title_ja/description** invention requirement is present, and `id` is required
      kebab-case (AC6),
    - **target vs full** grammar switch: with `target_chapter=3` a Ch.4-only grammar title is
      **absent**; with `target_chapter=None` a high-chapter grammar title (e.g. from the max chapter)
      is **present** (AC7),
    - **no vocab constraint** leaks in: `"beyond Chapter"` and the `Vocabulary available` header are
      **absent** in both branches (AC8),
    - the output shape requests `id/title/title_ja/description/grammar` + `sentences[]` and does
      **not** request `vocab_keys`, `vocab_supplement`, furigana `漢字[よみ]`, `schema_version`,
      `language`, or `difficulty` (AC2),
    - `steering_instructions` appears when set and not when `"   "` (AC9).

11. **AC11 — No regressions, scope fence holds**
    `pytest tests/` is fully green with **no edits to existing test assertions**. `generate()`,
    `_generate_proposal()`, `_stream_llm`, `build_japanese_production_prompt`, `_parse_chapter`,
    `main.py`, `validator.py`, `enrichment.py`, and the wire contract are **unchanged** — this story
    adds one prompt builder + its tests and refactors two shared prompt fragments
    (`_cumulative_grammar_block` generalisation, `_WORD_SEGMENTATION_RULES` extraction) only.

## Tasks / Subtasks

- [x] Task 1: Extract the Word Segmentation Rules into a shared constant (AC: 4)
  - [x] Add a module-level `_WORD_SEGMENTATION_RULES` string reproducing the rules body of
        [`agent.py:107-114`](../../apps/story-generator-backend/src/story_generator/agent.py#L107-L114)
        **exactly** (the "Split each Japanese sentence…" line through rule 5 "The words array joined
        (no spaces) must exactly equal the japanese string"). Decide a clean boundary (constant = the
        five numbered rules + intro line; keep the `## Word Segmentation Rules` heading inline in each
        prompt) — whatever boundary you pick, the **rendered `build_system_prompt` output must be
        byte-identical** to today's.
  - [x] Refactor `build_system_prompt` to interpolate `_WORD_SEGMENTATION_RULES` in place of its
        inline rules text; leave every other line of that function untouched.
  - [x] Run `pytest tests/test_agent.py -k "system_prompt"` — the three existing prompt tests must
        pass with **no assertion edits** (proves byte-identical extraction).

- [x] Task 2: Generalise `_cumulative_grammar_block` to `chapter: int | None` (AC: 7)
  - [x] Change the signature to `_cumulative_grammar_block(grammar_data: GrammarData, chapter: int | None) -> str`.
  - [x] When `chapter is None`, iterate **all** chapters present in `grammar_data.by_chapter`
        (e.g. `max_ch = chapter if chapter is not None else max(grammar_data.by_chapter, default=0)`,
        then the existing `for ch in range(1, max_ch + 1)` loop). The `int` path must produce
        **byte-identical** output to today (do not restructure the existing loop/format).
  - [x] Update the docstring to note the `None` → full-set behaviour.
  - [x] Confirm `build_system_prompt` (which passes an `int`) and the se3-2
        `build_japanese_production_prompt` (which passes an `int`, guarded by its own `is None`
        branch) still compile and their tests pass unchanged. (`_cumulative_vocab_block` is **not**
        generalised — analysis needs no vocab block.)

- [x] Task 3: Add `build_japanese_analysis_prompt` (AC: 1, 2, 3, 5, 6, 7, 8, 9)
  - [x] Place it directly after `build_japanese_production_prompt` (before `build_proposal_prompt`),
        under a new `# ---- Stage 2 — Japanese analysis prompt ----` section banner.
  - [x] Signature per AC1 (`grammar_data, japanese_text, *, target_chapter, steering_instructions=""`).
  - [x] Build the `steering_block` with the existing pattern (reuse the `build_system_prompt` idiom).
  - [x] Assemble the grammar-reference block via `_cumulative_grammar_block(grammar_data, target_chapter)`
        (None → full set). Present it as "the grammar patterns to recognise/tag", **not** as a
        generation constraint — no "beyond Chapter N", no vocab block.
  - [x] Frame the task: **analyse** the given Japanese — split into sentences, **echo each sentence
        verbatim** into `japanese` (explicit "do not alter/rewrite/translate the Japanese"), segment
        into `words` per the reused `_WORD_SEGMENTATION_RULES`, **back-translate** each sentence into
        `english`, **invent** kebab-case `id`, `title`, `title_ja`, `description`, and build the
        story-level `grammar` array + per-sentence 0-based `grammar` indices from the reference block.
  - [x] Specify the Output Format JSON block with exactly `id/title/title_ja/description/grammar` +
        `sentences[]{english, japanese, words, grammar}` and "Return ONLY the JSON object. No
        markdown, no code fences." — do **not** mention `vocab_keys`, `vocab_supplement`, furigana,
        `schema_version`, `language`, or `difficulty`.
  - [x] Add a succinct docstring (project-context §Comments) and block comments labelling the major
        sections (grammar-reference assembly / task framing / output format).

- [x] Task 4: Unit tests (AC: 10, 11)
  - [x] Add tests to `tests/test_agent.py` under a `# Stage 2 — Japanese analysis prompt (se3-3)`
        banner, using the existing module-scope `grammar_data` fixture
        ([`tests/test_agent.py:116-120`](../../apps/story-generator-backend/tests/test_agent.py#L116-L120))
        — no Gemini call, no `generate()`; call the builder directly and assert on the returned string.
  - [x] Cover: echo/do-not-alter present; segmentation-rules present (`"particles"`); back-translation
        present; `id`/`title`/`title_ja`/`description` invention present + kebab-case required;
        target-vs-full grammar switch (Ch.4-only title absent at N=3, a max-chapter title present at
        None); no-vocab-constraint (`"beyond Chapter"` and `"Vocabulary available"` absent in both
        branches); absence of `vocab_keys` / `vocab_supplement` / `漢字[よみ]` / `schema_version` /
        `language` / `difficulty` in the output-format section; steering present when set, absent when
        `"   "`.
  - [x] Run `pytest tests/ -v` — all green, no existing assertions edited.

### Review Findings

_Code review 2026-07-12 (bmad-code-review; Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor verdict: PASS — no AC violations. All 76 backend tests green._

- [x] [Review][Patch] Grammar-switch test uses fragile substring containment [apps/story-generator-backend/tests/test_agent.py:391] — FIXED (asserts the exact `[Ch{ch} {point}] {title}:` line via a `grammar_line()` helper) — `assert ch4_only[0].title not in targeted` / `not any(gp.title in targeted ...)` check whether a grammar *title* is a substring of the whole rendered prompt. A short/common max-chapter or Ch.4 title that also appears in a Ch.1–3 title/summary line would false-fail. Passes against the current fixture only; the AC7 switch is proven for the data, not structurally. Fix: assert against the exact rendered `[Ch{ch} {point}] {title}:` line, not the bare title.
- [x] [Review][Patch] `steering_instructions` parameter undocumented in docstring [apps/story-generator-backend/src/story_generator/agent.py:263] — FIXED (docstring now documents the Additional-Instructions behaviour) — docstring documents `grammar_data`/`japanese_text`/`target_chapter` but omits the `steering_instructions` keyword param and its Additional-Instructions behaviour (project-context §Comments: succinct docstrings for exported functions). Behaviour itself is correct.
- [x] [Review][Defer] `target_chapter=0`/negative yields an empty `(none)` grammar block instead of the full set [apps/story-generator-backend/src/story_generator/agent.py:69] — deferred; se3-4 owns chapter validation (spec scope fence: "Do not add lower-bound guards here"). `None`→full vs `0`→empty asymmetry is by-design for this story but must be handled where `target_chapter` is parsed.
- [x] [Review][Defer] Empty/whitespace `japanese_text` produces a degenerate prompt with no guard [apps/story-generator-backend/src/story_generator/agent.py:303] — deferred; se3-4 owns input validation (spec scope fence: "do not add rejection logic"). Prompt would instruct the model to echo an empty body.

## Dev Notes

### What Stage 2 is (and is NOT)

Stage 2 = "**analyse** a finished Japanese string into the seam the pipeline consumes." It takes a
Japanese prose blob (produced by Stage 1, or pasted by the user on Path C) and returns
`{ id, title, title_ja, description, grammar, sentences:[{english, japanese, words, grammar}] }`.

**It never changes the Japanese.** No translation (there is no English source on Path C), no
simplification, no correction. It **echoes** each sentence verbatim and describes it. Contrast with:

- **Stage 1** (se3-2, `build_japanese_production_prompt`): **produces** Japanese (EN→JA translate or
  JA→JA simplify) and emits **only** `{"japanese": "..."}` — no segmentation/metadata.
- **The fused `build_system_prompt`**: does Stage 1 **and** Stage 2 in one call, constrained to a
  chapter, with an English source. Stage 2 is the "analysis half" of that fused prompt, generalised
  to run on **any** Japanese (produced or pasted) with an **optional** chapter.

### The exact seam Stage 2 must feed (do not guess the fields)

`generate()` (se3-4 will call Stage 2 here; the seam is unchanged from today) extracts, at
[`agent.py:651-653`](../../apps/story-generator-backend/src/story_generator/agent.py#L651-L653):

```python
segments = raw_response.get("sentences") or []
story_meta = {k: v for k, v in raw_response.items() if k != "sentences"}
story_meta["difficulty"] = ...   # set by generate(), NOT the prompt
```

Then `pipeline.build_enriched_story(segments, story_meta)`
([`enrichment.py:341`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L341))
reads exactly:

- from each **segment**: `japanese` (join-invariant checked at
  [`enrichment.py:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L366-L374)),
  `words`, `english` (→ `translation`), `grammar`.
- from **story_meta**: `id`, `title`, `title_ja`, `description`, `grammar`.

Enrichment **injects itself**: `schema_version="2"`, `language="ja"`, and all
furigana/`vocab_keys`/`vocab_supplement`
([`enrichment.py:433-444`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L433-L444)).
**Therefore the analysis prompt must request the first set and none of the injected set.** This is
identical to the fields the fused `build_system_prompt` already asks for
([`agent.py:118-134`](../../apps/story-generator-backend/src/story_generator/agent.py#L118-L134)) —
model the Output Format block on it, minus the vocab-constraint framing.

### The routing matrix this prompt serves (from the epic; callers are se3-4, not this story)

| Caller (se3-4) | Input to Stage 2 | `target_chapter` | This prompt does |
|---|---|---|---|
| Path A / B-phase-2, target = Ch.N | Stage-1 output (JA) | `N` | echo + segment + back-translate + tag vs Ch.1..N |
| Path A, target = Unspecified | Stage-1 output (JA) | `None` | same, tag vs **full** Genki set |
| Path C, target = Ch.N | Stage-1 output (simplified JA) | `N` | same, tag vs Ch.1..N |
| Path C, target = Unspecified (frozen) | **user's pasted JA, verbatim** | `None` | same, tag vs **full** set; `japanese` must equal the pasted input |

So the frozen Path-C case is why AC3 (echo exactly) is load-bearing: se3-4's acceptance test asserts
the resulting per-sentence `japanese` equals the pasted input character-for-character. The prompt is
the only guardrail — write the "do not alter the Japanese" instruction unambiguously.

### Reuse targets (do not diverge them)

1. **`_cumulative_grammar_block`** — already extracted in se3-2
   ([`agent.py:49-60`](../../apps/story-generator-backend/src/story_generator/agent.py#L49-L60)).
   se3-2's dev note explicitly deferred the `int | None` generalisation to **this story**:
   > "Stage 2 needs a full cumulative Genki grammar set when no target is chosen … it can generalise
   > `_cumulative_grammar_block` (e.g. accept `chapter: int | None` where `None` → every chapter)."
   Keep the `int` branch byte-identical (existing `test_system_prompt_includes_grammar_for_chapter`
   asserts each `gp.title` substring for Ch.1–3). Add the `None` branch to iterate all chapters.

2. **Word Segmentation Rules** — currently inline in `build_system_prompt`
   ([`agent.py:107-114`](../../apps/story-generator-backend/src/story_generator/agent.py#L107-L114)).
   se3-2 deliberately did **not** carry these into Stage 1 (Stage 1 doesn't segment). Stage 2 **does**
   segment, so extract them into `_WORD_SEGMENTATION_RULES` and share. The current block text is:
   ```
   Split each Japanese sentence into surface word tokens following these rules:
   1. Verb stems stay attached to their polite endings: 食べます is one token, 行きます is one token
   2. Particles are separate tokens: は、を、に、で、へ、が、と、も、の are each a single token
   3. Punctuation is separate: 。and 、are each a single token
   4. Honorifics attached to names stay attached: たろうさん is one token
   5. The words array joined (no spaces) must exactly equal the japanese string
   ```
   Byte-identical extraction keeps `test_system_prompt_has_simplified_format`
   ([`tests/test_agent.py:204-233`](../../apps/story-generator-backend/tests/test_agent.py#L204-L233))
   green with no edits (it asserts `"particles"` present, `'"words"'` present, `漢字[よみ]` /
   `vocab_keys` / `vocab_supplement` absent).

`_cumulative_vocab_block` is **not** reused here — Stage 2 does not inject a vocabulary list (it does
not constrain vocabulary). Do not call it; do not add a `vocab_data` parameter.

### Grammar-reference framing (AC8 — the subtle bit)

In the **fused** prompt, the grammar block is presented under "Grammar patterns available" and paired
with a hard "do not introduce vocabulary beyond Chapter N" constraint, because that prompt *generates*
constrained Japanese. Stage 2 does the opposite: the Japanese already exists and must not change, so
the grammar block is a **recognition/tagging reference** — "here are the grammar patterns; identify
which appear in each sentence and tag them." Word the header accordingly (e.g.
`## Grammar Reference (for tagging)`) and **omit** any "use only" / "beyond Chapter N" language. The
AC10 test asserts `"beyond Chapter"` is absent in both branches.

When `target_chapter is None`, the full-set block can be large (all Genki chapters) — the epic flags
this as a token-budget watch-item, but it is acceptable for this story; do not truncate.

### Output-format shape (mirror the known-good fused block)

Model the Output Format on `build_system_prompt`'s block
([`agent.py:118-134`](../../apps/story-generator-backend/src/story_generator/agent.py#L118-L134)) —
it is already proven to produce a pipeline-valid structure. Concretely request:

```json
{
  "id": "<kebab-case identifier derived from the story topic, e.g. daily-life-at-the-station>",
  "title": "<English story title>",
  "title_ja": "<Japanese story title>",
  "description": "<1-2 sentence English description of the story>",
  "grammar": ["<grammar pattern string 1>", "<grammar pattern string 2>", ...],
  "sentences": [
    {
      "english": "<faithful English back-translation of this sentence>",
      "japanese": "<this sentence copied EXACTLY from the source, unchanged>",
      "words": ["<surface word 1>", "<surface word 2>", ...],
      "grammar": [<0-based index into the story-level grammar array>, ...]
    }
  ]
}
```

Note the differences from the fused block: `english` is a **back-translation** (not a source gloss),
`japanese` is an **exact copy** (not a translation), and `id` is derived from **content** (there is no
chapter to embed when unspecified). Do **not** add `vocab_keys`, `vocab_supplement`, furigana
brackets, `schema_version`, `language`, or `difficulty` — enrichment/`generate()` own those.

### Prompt-builder unit-test pattern (match se3-2 style exactly)

`build_japanese_analysis_prompt` is a **pure function** — call it **directly**, do not route through
`generate()` (that capturing-stream pattern is for prompts reached only via `generate()`). Reuse the
module-scope `grammar_data` fixture; you do **not** need `vocab_data`. Example skeleton:

```python
def test_analysis_prompt_echoes_japanese_unchanged(grammar_data):
    from story_generator.agent import build_japanese_analysis_prompt
    prompt = build_japanese_analysis_prompt(
        grammar_data, "けんは こうえんに いきました。",
        target_chapter=3,
    )
    assert "do not" in prompt.lower() and ("alter" in prompt.lower() or "rewrite" in prompt.lower())
    assert "particles" in prompt.lower()          # segmentation rules present (AC4)
    assert "back-translat" in prompt.lower() or '"english"' in prompt   # AC5
    for field in ("id", "title", "title_ja", "description"):
        assert field in prompt                     # metadata invention (AC6)

def test_analysis_prompt_grammar_switch_target_vs_full(grammar_data):
    from story_generator.agent import build_japanese_analysis_prompt
    max_ch = max(grammar_data.by_chapter)
    targeted = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=3)
    full = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=None)
    # A Ch.4-only grammar title is absent when targeted at Ch.3, present in the full set
    ch1_to_3 = {gp.title for ch in range(1, 4) for gp in grammar_data.by_chapter.get(ch, [])}
    ch4_only = [gp for gp in grammar_data.by_chapter.get(4, []) if gp.title not in ch1_to_3]
    if ch4_only:
        assert ch4_only[0].title not in targeted
        assert ch4_only[0].title in full
    # A max-chapter grammar title appears only in the full set
    assert any(gp.title in full for gp in grammar_data.by_chapter[max_ch])

def test_analysis_prompt_has_no_vocab_constraint(grammar_data):
    from story_generator.agent import build_japanese_analysis_prompt
    for target in (3, None):
        prompt = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=target)
        assert "beyond Chapter" not in prompt
        assert "Vocabulary available" not in prompt

def test_analysis_prompt_omits_downstream_fields(grammar_data):
    from story_generator.agent import build_japanese_analysis_prompt
    prompt = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=3)
    for banned in ("vocab_keys", "vocab_supplement", "漢字[よみ]", "schema_version",
                   '"language"', "difficulty"):
        assert banned not in prompt, f"downstream/enrichment token leaked: {banned}"

def test_analysis_prompt_honours_steering(grammar_data):
    from story_generator.agent import build_japanese_analysis_prompt
    with_s = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=3,
                                            steering_instructions="Keep it cheerful.")
    assert "Additional Instructions" in with_s and "Keep it cheerful." in with_s
    without_s = build_japanese_analysis_prompt(grammar_data, "…", target_chapter=3,
                                               steering_instructions="   ")
    assert "Additional Instructions" not in without_s
```

Match the se3-2 assertion idioms (`tests/test_agent.py:261-358`). Keep the kebab-case check on `id`
as "the field is requested"; do not over-assert the exact placeholder wording.

### Behavioural nuances to preserve

- **`_parse_chapter` is not called here.** `build_japanese_analysis_prompt` receives an already-int
  `target_chapter | None`; chapter-string parsing and the `"unspecified"` sentinel are **se3-4**.
- **No `generate()` call, no streaming, no `main.py`.** If you find yourself editing `generate()` or
  adding `path_mode="C"`, you are in se3-4 territory — stop.
- **`target_chapter <= 0` / out-of-range** is **not** this story's concern — se3-4 owns chapter
  validation (see the se3-2 deferred-review notes). Do not add lower-bound guards here; the `None`
  branch (full set) and the `int` branch (Ch.1..N via the existing loop) are the only two paths.
- **Empty/whitespace `japanese_text`** is likewise se3-4's input-validation concern; a `.strip()`
  when embedding the source is fine, but do not add rejection logic.
- **Do not touch `build_system_prompt`'s rendered output** beyond swapping the inline segmentation
  rules for `_WORD_SEGMENTATION_RULES` (and it already calls `_cumulative_grammar_block` — the
  generalisation must keep its `int`-path output byte-identical).

### Data shapes (so references are correct)

`GrammarData.by_chapter: dict[int, list[GrammarPoint]]`; `GrammarPoint` = `chapter:int, point:str
(e.g. "1.1"), title:str, summary:str`. `GrammarData` is already imported at the top of `agent.py`
([`agent.py:11`](../../apps/story-generator-backend/src/story_generator/agent.py#L11)) — reuse the
import for the type hint. [Source: [`data_loader.py:18-40`](../../apps/story-generator-backend/src/story_generator/data_loader.py#L18-L40)]

### Code style (project-context.md §Comments; se2-1/se2-2/se3-1/se3-2 precedent)

- `from __future__ import annotations` is already present at
  [`agent.py:2`](../../apps/story-generator-backend/src/story_generator/agent.py#L2) — keep it (lets
  you write `int | None` hints freely).
- Succinct docstring on the new function; block comments to label major sections (grammar-reference
  assembly / task framing / output format). Do not narrate obvious mechanics.
- Follow the existing f-string prompt-assembly style of `build_system_prompt` /
  `build_japanese_production_prompt`.

### Project Structure Notes

- Single-file source change plus tests:
  `apps/story-generator-backend/src/story_generator/agent.py` (add `build_japanese_analysis_prompt`;
  extract `_WORD_SEGMENTATION_RULES`; generalise `_cumulative_grammar_block` to `int | None`; refactor
  `build_system_prompt`'s inline rules) and
  `apps/story-generator-backend/tests/test_agent.py` (new analysis-prompt tests only).
- No new modules, no new dependencies, no `main.py` / `validator.py` / `enrichment.py` change, no
  fixture change. ADK stays deferred (epic scope note) — plain-Python only; do not import
  `google-adk`.
- Runtime: `pytest` needs no `GEMINI_API_KEY` (pure prompt-builder tests + injection seam elsewhere).
  Run from `apps/story-generator-backend`. Note the pre-existing `test_streaming_timeout_yields_error`
  case makes the full agent suite take ~2 min — expected.

### References

- [Source: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)]
  — Story se3-3 ACs; Design Decisions "Stage 2 is a single universal prompt", "Grammar-tagging
  reference set"; Risks "Stage-2 analysis prompt is the central quality dependency on every path".
- [Source: [`agent.py:63-147`](../../apps/story-generator-backend/src/story_generator/agent.py#L63-L147)]
  — `build_system_prompt`: the fused prompt Stage 2 generalises from; segmentation rules `:107-114`,
  steering block `:77-81`, output-format block `:118-134`, `_cumulative_grammar_block` call `:74`.
- [Source: [`agent.py:49-60`](../../apps/story-generator-backend/src/story_generator/agent.py#L49-L60)]
  — `_cumulative_grammar_block` (se3-2): generalise to `int | None`.
- [Source: [`agent.py:155-245`](../../apps/story-generator-backend/src/story_generator/agent.py#L155-L245)]
  — `build_japanese_production_prompt` (se3-2): the sibling Stage-1 builder; steering-block idiom,
  constraint-block assembly, docstring/comment style to mirror.
- [Source: [`agent.py:651-653`](../../apps/story-generator-backend/src/story_generator/agent.py#L651-L653)]
  — the `(segments, story_meta)` seam Stage 2 must feed.
- [Source: [`enrichment.py:341-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L341-L374)]
  — `build_enriched_story` inputs + the join-invariant guard (why AC3/AC4 matter).
- [Source: [`enrichment.py:433-444`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L433-L444)]
  — fields enrichment injects (`schema_version`, `language`) vs reads (`story_meta`/`segment`) —
  the exact prompt-output contract.
- [Source: [`validator.py:24-26`](../../apps/story-generator-backend/src/story_generator/validator.py#L24-L26)]
  — validator-required top-level fields (`id/title/title_ja/language/description/sentences`).
- [Source: [`data_loader.py:18-40`](../../apps/story-generator-backend/src/story_generator/data_loader.py#L18-L40)]
  — `GrammarData`/`GrammarPoint` shapes.
- [Source: [`tests/test_agent.py:116-120`](../../apps/story-generator-backend/tests/test_agent.py#L116-L120)]
  — `grammar_data` fixture to reuse.
- [Source: [`tests/test_agent.py:167-253`](../../apps/story-generator-backend/tests/test_agent.py#L167-L253)]
  — existing `build_system_prompt` tests (the byte-identical-extraction regression net for Task 1/2).
- [Source: [`tests/test_agent.py:261-358`](../../apps/story-generator-backend/tests/test_agent.py#L261-L358)]
  — se3-2 `build_japanese_production_prompt` tests: the pure-function, direct-call test idiom to mirror.
- [Source: [`_bmad-output/implementation-artifacts/se3-2-stage-1-japanese-production-prompt.md`](se3-2-stage-1-japanese-production-prompt.md)]
  — predecessor story; established the shared-helper extraction pattern and flagged this story's
  `_cumulative_grammar_block` generalisation.
- [Source: `_bmad-output/project-context.md` §Comments] — docstring + block-comment style.

## What does NOT belong in this story

- **No wiring into `generate()`** — running Stage 1 then Stage 2, skipping Stage 1 for frozen JA, and
  short-circuiting on failure is **se3-4**.
- **No `path_mode="C"`, no `chapter="unspecified"` sentinel, no `_parse_chapter` change, no
  `difficulty_label`** — all se3-4.
- **No chapter validation / lower-bound guards** — se3-4 owns chapter and input validation.
- **No change to `build_system_prompt`'s rendered output** beyond swapping its inline segmentation
  rules for the shared `_WORD_SEGMENTATION_RULES` constant; the fused prompt keeps working until se3-4
  removes it from the call path.
- **No `_stream_llm`, `main.py`, `validator.py`, `enrichment.py`, or wire-format change.**
- **No `vocab_data` parameter and no vocabulary block** in the analysis prompt — Stage 2 never
  constrains vocabulary.
- **No eval-harness wiring** (`eval/run_eval.py`) — that is the optional **se3-6**.
- **No `google-adk` import** — ADK stays deferred for the whole epic.
- **No edits to existing test assertions** — they are the regression net.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `pytest tests/test_agent.py -k "system_prompt or production_prompt"` → 9 passed (proves the
  `_WORD_SEGMENTATION_RULES` extraction and `_cumulative_grammar_block` `int`-path are byte-identical;
  no assertion edits).
- `pytest tests/test_agent.py -k "analysis_prompt"` → 5 passed (the new AC10 branch coverage).
- `pytest tests/` → **76 passed** in ~123s (full regression net, AC11; the pre-existing
  `google.genai` `DeprecationWarning` is unrelated).

### Completion Notes List

- **Purely additive, scope fence held.** Added one prompt builder (`build_japanese_analysis_prompt`)
  + 5 unit tests, and refactored two shared fragments only. `generate()`, `_generate_proposal()`,
  `_stream_llm`, `build_japanese_production_prompt`, `_parse_chapter`, `main.py`, `validator.py`,
  `enrichment.py`, and the wire contract are untouched. No `vocab_data` param, no vocab block, no
  `path_mode`/`"unspecified"`/orchestration (all se3-4). No `google-adk` import.
- **AC4 byte-identical extraction:** `_WORD_SEGMENTATION_RULES` = the intro line + 5 numbered rules;
  the `## Word Segmentation Rules` heading stays inline in each prompt. `build_system_prompt` renders
  identically — the three existing `system_prompt` tests pass unedited.
- **AC7 grammar switch:** `_cumulative_grammar_block` now takes `chapter: int | None`; `None` →
  `max(by_chapter, default=0)` so every chapter is emitted. `int` path unchanged
  (`max_ch = chapter`, same loop) → byte-identical. Verified `max_ch > 3` in the fixture so the
  target-vs-full switch test is meaningful.
- **AC2/AC8 negative-space:** the analysis prompt never emits `vocab_keys`, `vocab_supplement`,
  furigana `漢字[よみ]`, `schema_version`, `"language"`, `difficulty`, `beyond Chapter`, or a
  `Vocabulary available` block; grammar is framed as `## Grammar Reference (for tagging)`.
- **AC3 echo guardrail** (load-bearing for se3-4's frozen Path-C test): explicit "Do NOT alter,
  rewrite, translate, simplify, or correct the Japanese — copy each sentence character-for-character"
  in both the Task framing and Rule 1.

### File List

- `apps/story-generator-backend/src/story_generator/agent.py` — added `_WORD_SEGMENTATION_RULES`
  constant; refactored `build_system_prompt` to interpolate it; generalised `_cumulative_grammar_block`
  to `chapter: int | None`; added `build_japanese_analysis_prompt` (Stage-2 banner).
- `apps/story-generator-backend/tests/test_agent.py` — added the "Stage 2 — Japanese analysis prompt
  (se3-3)" test block (5 tests).

### Change Log

- 2026-07-12: Implemented se3-3 (Stage-2 universal Japanese analysis prompt). Added
  `build_japanese_analysis_prompt` + tests; extracted `_WORD_SEGMENTATION_RULES`; generalised
  `_cumulative_grammar_block` to `int | None`. All 76 backend tests green; no existing assertions
  edited. Status → review.
