---
status: backlog
type: supplemental-epic
epic_id: supp-epic-2
created: "2026-06-04"
---

# Supplemental Epic 2: Python-Side Tokenization and Vocab Enrichment

## Overview

This supplemental epic replaces the LLM-generated tokenization, furigana annotation, and
vocabulary assignment with a deterministic Python pipeline. Currently the story generator
asks Gemini to produce `words[]`, `vocab_keys[]`, inline furigana annotations, and
`vocab_supplement[]` in a single pass. The parallel array invariant between `words` and
`vocab_keys` is fragile and a frequent source of validation failures.

The new approach splits responsibility cleanly:

- **LLM:** translate the English source to Japanese and segment each sentence into
  pedagogically meaningful word units (verb stems with polite endings attached, particles
  separate, etc.)
- **Python:** deterministically generate furigana, dictionary forms, POS codes, and
  vocabulary definitions using SudachiPy (morphological analysis), the Genki vocab CSV
  (primary definitions), and JMdict via jamdict (fallback definitions)

The `words[]` and `vocab_keys[]` arrays — and the story JSON wire format — are unchanged.
Only who generates them changes.

---

## Background and Motivation

### Current pipeline (fragile)

```
English source
  → Gemini (one LLM call)
      → words[], vocab_keys[], furigana annotations, vocab_supplement[]
  → validator.py (checks parallel array parity)
  → story JSON
```

The LLM must simultaneously:
1. Decide word boundaries
2. Annotate kanji with correct readings in `漢字[よみ]` format
3. Assign curriculum vocab keys to matching words
4. Build `vocab_supplement` for non-curriculum words with correct key offsets

Any mistake in (3) or (4) breaks the `words` / `vocab_keys` parallel array invariant,
producing a validation failure and requiring a retry or manual correction.

### New pipeline (deterministic)

```
English source
  → Gemini (simplified call)
      → [{english, japanese, words: [surface strings]}]
  → EnrichmentPipeline (Python)
      → furigana via SudachiPy + okurigana stripping
      → vocab lookup: Genki CSV → jamdict fallback
      → POS codes from SudachiPy conjugation type
      → vocab_keys assignment (Genki keys 1–1172; supplemental 10000+)
      → vocab_supplement entries for non-Genki words
  → validator.py (sanity check)
  → story JSON
```

The parallel array invariant is guaranteed by construction — Python builds both arrays
simultaneously. Furigana accuracy is deterministic and testable. Vocab definitions are
sourced from authoritative data rather than LLM recall.

### Reference implementation

`apps/story-generator-backend/dev/tokenize_prototype.py` contains a working end-to-end
prototype of the enrichment pipeline, developed and validated during the planning phase.

---

## Design Decisions

### SudachiPy split mode

SudachiPy split mode C (longest compound units) is used for morphological analysis.
This keeps compound nouns and named entities intact while still separating verb stems
from their auxiliaries (needed for the `_pos_code` function).

### Furigana: okurigana stripping

Furigana annotations cover only kanji characters, not trailing okurigana:
- `食べ` + reading `たべ` → `食[た]べ` (not `食べ[たべ]`)
- `帰っ` + reading `かえっ` → `帰[かえ]っ`
- `勉強` + reading `べんきょう` → `勉強[べんきょう]` (all-kanji, no stripping needed)

The algorithm strips matching trailing kana from both surface and reading before
bracketing. This is morpheme-level — each SudachiPy morpheme is annotated independently,
then concatenated.

### First-occurrence furigana

By default, furigana is added only on the first occurrence of each word (keyed on
dictionary form) across the full story. Subsequent occurrences use the plain surface
form. This follows standard Japanese publishing practice and is controlled by the
`FURIGANA_ALL_OCCURRENCES` flag in the enrichment pipeline.

### Vocab key assignment

- Words whose `dictionary_form` matches a Genki vocab entry (by kanji form or kana
  reading, first occurrence wins on duplicates) → that entry's row ID (1–1172)
- Content words with no Genki match → assigned key ≥ 10000, added to `vocab_supplement`
- Particles, auxiliaries, punctuation → `null`

The Genki CSV row IDs (column 0) are used directly as vocab keys. The CSV must not be
reordered; its ordering is a stable contract.

### POS codes

A simplified JMdict-compatible set:

| Code | Meaning |
|---|---|
| `n` | noun |
| `v1` | ichidan verb (一段) |
| `v5` | godan verb (五段) |
| `v-irr` | irregular verb (する, くる) and suru-verb compounds |
| `adj-i` | i-adjective (形容詞) |
| `adj-na` | na-adjective (形状詞) |
| `adv` | adverb |
| `pron` | pronoun |
| `conj` | conjunction |
| `pref` | prefix |
| `suff` | suffix |
| `prt` | particle |

### Schema: additive change only, no version bump

Two optional fields are added to `vocabEntry`:
- `dictionary_form` (string) — base/lemma form from SudachiPy
- `pos` (string) — POS code from the table above

Existing stories without these fields remain valid. No `schema_version` bump is required.

---

## Components Affected

| Component | Package / App | Nature of change |
|---|---|---|
| `enrichment.py` | `apps/story-generator-backend` | New module — all tokenisation and enrichment logic |
| `agent.py` | `apps/story-generator-backend` | Simplified prompt; post-processing via enrichment |
| `validator.py` | `apps/story-generator-backend` | Parallel array check becomes sanity assertion |
| `requirements.txt` | `apps/story-generator-backend` | Add sudachipy, sudachidict-core, jamdict, jamdict-data-fix |
| `story.v2.json` | `packages/schema` | Add optional `pos`, `dictionary_form` to `vocabEntry` |
| `SCHEMA_CHANGELOG.md` | `packages/schema` | Document additive vocab entry fields |
| `types.ts` | `packages/schema` | `VocabSupplementEntry`: add optional `pos?`, `dictionaryForm?` |
| `v2.ts` loader | `packages/story-loader` | Pass through new optional vocab fields |
| `InfoPanel.tsx` | `apps/web` | Render `pos` tag when present |
| Story JSON files | `apps/web/public/stories/` | Optional re-enrichment to add pos/dictionary_form |

---

## Story List

| Story ID | Title | Depends on | Can parallel |
|---|---|---|---|
| se2-1 | Enrichment Module | — | se2-3 |
| se2-2 | Updated Generation Pipeline | se2-1 | — |
| se2-3 | Schema and Type Updates | — | se2-1 |
| se2-4 | Web App — POS Display | se2-3 | — |
| se2-5 | Story Library Re-enrichment *(optional)* | se2-2 | — |

se2-1 and se2-3 can be developed in parallel. se2-4 and se2-5 are independent of each other
once their respective prerequisites are met.

---

## Stories

---

### Story se2-1: Enrichment Module

As a **developer**,
I want a tested `EnrichmentPipeline` class in `enrichment.py`,
So that furigana generation, vocabulary lookup, and POS classification are encapsulated,
deterministic, and independently testable before being wired into the generation pipeline.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/src/story_generator/enrichment.py`
**When** reviewed
**Then** exports an `EnrichmentPipeline` class that initialises SudachiPy (Dictionary +
tokenizer), loads the Genki vocab index from the CSV path, and initialises a Jamdict
instance; all three are initialised once at construction and reused across calls

**Given** `EnrichmentPipeline.enrich_sentence(words: list[str], seen_dict_forms: set[str] | None)`
**When** called with a list of Japanese word strings
**Then** returns a list of dicts, one per word, each containing:
`annotated` (surface with inline furigana), `dictionary_form`, `reading` (hiragana),
`pos_code`, `gloss` (optional), `gloss_source` (optional, `"genki"` or `"jmdict"`)

**Given** a word containing kanji with okurigana, e.g. `食べます`
**When** `enrich_sentence` is called
**Then** `annotated` is `食[た]べます` — only the kanji `食` is bracketed, `べます` is bare

**Given** `食べます` followed later by `食べた` in the same call with a shared `seen_dict_forms` set
**When** the set contains `食べる` by the time `食べた` is processed
**Then** `食べた` returns `annotated = "食べた"` with no furigana brackets

**Given** `seen_dict_forms = None`
**When** `enrich_sentence` is called
**Then** every kanji word is annotated regardless of prior occurrences

**Given** a suru-verb compound e.g. `勉強します`
**When** `enrich_sentence` is called
**Then** `dictionary_form` is `勉強する`, `pos_code` is `v-irr`,
`annotated` is `勉強[べんきょう]します`

**Given** a word whose dictionary form matches a Genki CSV entry (by kanji or kana)
**When** `enrich_sentence` is called
**Then** `gloss` is the Genki English definition, `gloss_source` is `"genki"`

**Given** a word not in Genki but in JMdict
**When** `enrich_sentence` is called
**Then** `gloss` is the first sense of the first JMdict entry, `gloss_source` is `"jmdict"`

**Given** a short all-kana word of 2 characters or fewer (e.g. `に`, `は`)
**When** `enrich_sentence` is called and the word is not in Genki
**Then** no JMdict lookup is performed; `gloss` is absent from the returned dict

**Given** `apps/story-generator-backend/requirements.txt`
**When** reviewed
**Then** includes `sudachipy`, `sudachidict-core`, `jamdict`, and `jamdict-data-fix`

**Given** `tests/test_enrichment.py`
**When** `pytest` is run
**Then** covers: okurigana stripping (食べる, 起きる, 帰る), all-kanji word (勉強),
mixed morpheme (朝ごはん), first-occurrence suppression enabled and disabled,
suru-verb compound POS (v-irr), godan verb POS (v5), ichidan verb POS (v1),
i-adjective (adj-i), na-adjective (adj-na), Genki hit, JMdict fallback,
short kana skip; all pass

---

### Story se2-2: Updated Generation Pipeline

As a **story author**,
I want the generation backend to use the Python enrichment pipeline to produce
`words[]`, `vocab_keys[]`, and `vocab_supplement[]`,
So that these arrays are always consistent and the parallel array invariant is guaranteed
by construction rather than by LLM reliability.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/src/story_generator/agent.py` system prompt
**When** reviewed
**Then** no longer contains furigana annotation rules, `vocab_keys` format instructions,
`vocab_supplement` instructions, or examples of bracket annotation syntax;
instructs the model to return a JSON array of
`{"english": "...", "japanese": "...", "words": [...]}` objects only;
specifies word segmentation rules: verb stems stay attached to their polite endings,
particles are separate, punctuation is separate, さん/くん stay attached to names

**Given** the Gemini response after the simplified prompt
**When** `agent.py` processes it
**Then** calls `EnrichmentPipeline.build_enriched_story(segments, story_meta)`
which returns a complete story dict with `words[]`, `vocab_keys[]`, `vocab_supplement[]`
populated deterministically

**Given** `build_enriched_story` assigning vocab keys
**When** a word's `dictionary_form` matches a Genki entry
**Then** `vocab_keys[i]` is set to the Genki row ID (1–1172);
no entry is added to `vocab_supplement` for this word

**Given** `build_enriched_story` assigning vocab keys
**When** a content word has no Genki match
**Then** a new entry is added to `vocab_supplement` with `key ≥ 10000`,
`word` (surface), `hiragana` (reading), `translation` (gloss), `pos`, `dictionary_form`;
`vocab_keys[i]` is set to that key

**Given** `build_enriched_story`
**When** the same non-Genki word appears in multiple sentences
**Then** the same `vocab_supplement` key is reused; the entry is added only once

**Given** a particle or punctuation token
**When** `build_enriched_story` assigns its key
**Then** `vocab_keys[i]` is `null`; no entry is added to `vocab_supplement`

**Given** the word strings returned by Gemini joined together
**When** compared to the `japanese` sentence string (after stripping spaces)
**Then** they are equal; if not, the pipeline raises a `ValueError` identifying the
mismatched sentence so the caller can request a retry

**Given** `validator.py`
**When** reviewed
**Then** the `PARALLEL_ARRAY_MISMATCH` error path is retained as a sanity assertion
(unreachable in normal operation but preserves a clear error message if the pipeline
has a bug); furigana bracket syntax validation still runs on the assembled `words[]`

**Given** a story generated end-to-end with the updated agent
**When** validated against `story.v2.json`
**Then** passes schema validation; `words` and `vocab_keys` arrays have equal length
per sentence; all `vocab_supplement` keys ≥ 10000 have a corresponding entry

**Given** `tests/test_agent.py` mock fixtures
**When** updated to use the new prompt and enrichment pipeline
**Then** all existing tests pass with new-format mock data

---

### Story se2-3: Schema and Type Updates

As a **developer**,
I want the `vocabEntry` schema and TypeScript types to include optional `pos` and
`dictionary_form` fields,
So that enriched vocabulary entries generated by the new pipeline can carry POS and
lemma information for future UI and tooling use.

**Acceptance Criteria:**

**Given** `packages/schema/schemas/story.v2.json`
**When** reviewed
**Then** the `vocabEntry` definition in `$defs` includes:
`"dictionary_form": { "type": "string" }` (optional) and
`"pos": { "type": "string" }` (optional);
both fields appear in `properties` but not in `required`;
all existing required fields (`key`, `word`, `hiragana`, `translation`) are unchanged

**Given** a story JSON with `vocab_supplement` entries that omit `pos` and `dictionary_form`
**When** validated against the updated schema
**Then** passes validation — the fields are optional and absence is not an error

**Given** `packages/schema/src/types.ts`
**When** reviewed
**Then** `VocabSupplementEntry` has `pos?: string` and `dictionaryForm?: string`
as optional fields; no existing required fields are changed

**Given** `packages/story-loader/src/v2.ts`
**When** reviewed
**Then** maps `pos` and `dictionary_form` (snake_case) from the raw JSON to
`pos` and `dictionaryForm` (camelCase) on the `VocabSupplementEntry` model when present;
absence of either field is handled gracefully with no error

**Given** `packages/schema/SCHEMA_CHANGELOG.md`
**When** reviewed
**Then** documents the additive change to `vocabEntry`: lists `pos` and `dictionary_form`
as new optional fields, notes their source (SudachiPy + enrichment pipeline),
and states that existing stories without these fields remain valid

**Given** `turbo typecheck`
**When** run after this story
**Then** exits 0 across all packages and apps

---

### Story se2-4: Web App — POS Display

As a **reader**,
I want to see the part of speech of a word when I tap it,
So that I can understand its grammatical role without needing to look it up separately.

**Acceptance Criteria:**

**Given** `InfoPanel.tsx` receiving a `VocabSupplementEntry` with `pos: "v5"`
**When** a word is tapped and the panel is shown
**Then** the POS code `v5` is displayed as a small label near the definition;
the label is visually distinct from the definition text (e.g. muted colour, smaller size)

**Given** `InfoPanel.tsx` receiving an entry without a `pos` field
**When** the panel is shown
**Then** no POS label is rendered; layout is unchanged from current behaviour

**Given** entries from the main Genki vocab store (which do not have `pos`)
**When** tapped
**Then** no POS label appears; no error is thrown

**Given** `InfoPanel.test.tsx`
**When** run
**Then** covers: POS label present when `pos` is set; no label when `pos` is absent;
no regression on existing InfoPanel test cases

**Given** `turbo typecheck`
**When** run after this story
**Then** exits 0

---

### Story se2-5: Story Library Re-enrichment *(optional)*

As a **developer**,
I want a script that adds `pos` and `dictionary_form` to `vocab_supplement` entries in
existing committed story files,
So that older stories benefit from the enriched metadata without needing to be fully
regenerated.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/scripts/re-enrich-vocab.py`
**When** run against a story JSON file
**Then** reads each `vocab_supplement` entry; for entries that already have `pos` set,
skips them; for entries without `pos`, looks up the `word` field via `EnrichmentPipeline`
and writes back `pos` and `dictionary_form` if found; all other fields are unchanged

**Given** the script run against all committed story files
**When** complete
**Then** all stories pass `loadStory()` validation; no `vocab_supplement` entry has its
`translation`, `word`, `hiragana`, or `key` field changed

**Given** a story that has no `vocab_supplement` entries
**When** the script is run against it
**Then** the file is unchanged

**Given** `apps/web/public/stories/manifest.json`
**When** reviewed after re-enrichment
**Then** is unchanged

---

## Risks and Notes

- **Word boundary validation:** After Gemini segments a sentence into words, the
  pipeline must verify that joining the word surfaces reconstructs the original Japanese
  sentence. If not, the Gemini output is malformed and the call should be retried.
  This guard is specified in se2-2 and is the primary reliability safeguard.

- **SudachiPy startup time:** Dictionary initialisation takes ~1–2 seconds at cold
  start. `EnrichmentPipeline` must be instantiated once at FastAPI startup (in `main.py`)
  and injected into the agent, not created per-request.

- **Windows dependency:** `jamdict-data` fails to install on Windows due to a file-lock
  bug during extraction; use `jamdict-data-fix` instead. If the backend runs in Linux
  containers in production this is moot, but the `requirements.txt` should document the
  Windows workaround.

- **Genki CSV stability:** Vocab keys 1–1172 are row IDs from `resources/genki1vocab.csv`.
  Reordering the CSV would invalidate all vocab key references in existing story files.
  The CSV must be treated as append-only; any new Genki II extension must add rows only
  at the end.

- **`v-irr` covers both する and くる:** The simplified POS scheme collapses all
  irregular verbs into `v-irr`. This is intentional for the learner-facing label; the
  SudachiPy conjugation type (`サ行変格` vs `カ行変格`) distinguishes them internally
  if finer granularity is needed later.

- **Reference prototype:** `apps/story-generator-backend/dev/tokenize_prototype.py`
  is the working prototype for se2-1 and se2-2. It should be retained as a standalone
  development tool even after the production code is written.
