---
generated: 2026-07-12
scan_level: deep
part: story-generator-backend
project_type: pipeline-analysis
status: baseline-for-planning
---

# Story Generation Pipeline — Current State

## Executive Summary

This report documents how a topic or an English story is transformed into a JSON-formatted
story file, and where each reference data source (Genki grammar, Genki vocabulary, kanji data)
is incorporated. It is a baseline for a planned block of work to improve output quality —
specifically **word segmentation**, **dictionary-form / lookup derivation**, and **ruby
(furigana) accuracy** — using an agentic AI approach.

The single most important structural fact: **exactly one LLM call touches Japanese.** It
produces the sentences, the word segmentation, and the grammar indices. Everything else —
furigana/ruby, dictionary forms, vocab keys, and glosses — is generated **deterministically in
Python after the LLM returns**, with no AI involved.

The three target quality areas map to code as follows:

| Target area | Owner | Location |
|-------------|-------|----------|
| Word segmentation | LLM (Gemini 2.5 Flash), prompt-driven | [`agent.py:90`](../apps/story-generator-backend/src/story_generator/agent.py#L90) |
| Dictionary form / lookup | Deterministic (SudachiPy) | [`enrichment.py:89`](../apps/story-generator-backend/src/story_generator/enrichment.py#L89) |
| Ruby / furigana | Deterministic (SudachiPy) | [`enrichment.py:34`](../apps/story-generator-backend/src/story_generator/enrichment.py#L34) |

---

## System Context

The backend ([`apps/story-generator-backend`](../apps/story-generator-backend/)) is a FastAPI
service. The React authoring UI ([`apps/story-generator`](../apps/story-generator/)) drives it
over Server-Sent Events (SSE), consuming AG-UI events per ADR-004. All generation flows through
[`agent.py`](../apps/story-generator-backend/src/story_generator/agent.py).

There are two generation paths plus one utility endpoint:

- **Path A** — English source story → Japanese JSON story (one LLM call + enrichment).
- **Path B** — topic → English draft (phase 1, LLM), then English draft → Japanese JSON
  (phase 2, identical to Path A).
- **`/suggest-topic`** — a lightweight LLM call that proposes a topic sentence for a chapter
  ([`main.py:238`](../apps/story-generator-backend/src/story_generator/main.py#L238)).

---

## Step-by-Step Pipeline

### 1. Startup (once)

[`main.py` `lifespan`](../apps/story-generator-backend/src/story_generator/main.py#L122) loads
three reference sources into memory and holds them for the process lifetime:

- Genki vocab CSV → `VocabData` ([`data_loader.py:43`](../apps/story-generator-backend/src/story_generator/data_loader.py#L43))
- Genki grammar CSV → `GrammarData` ([`data_loader.py:70`](../apps/story-generator-backend/src/story_generator/data_loader.py#L70))
- `EnrichmentPipeline` — SudachiPy dictionary + Genki CSV indexes + JMdict (Jamdict)
  ([`enrichment.py:252`](../apps/story-generator-backend/src/story_generator/enrichment.py#L252)).
  SudachiPy dictionary load is ~1–2 s, so it is initialised once and reused.

### 2. Request entry

`GET /run_sse` ([`main.py:173`](../apps/story-generator-backend/src/story_generator/main.py#L173))
opens the SSE stream and calls `agent.generate(...)`. Inputs (chapter, path mode, source text /
topic / draft, steering instructions, temperature, grammar distribution, target word count) are
passed straight through.

### 3. (Path B phase 1 only) Topic → English draft

`build_proposal_prompt` ([`agent.py:138`](../apps/story-generator-backend/src/story_generator/agent.py#L138))
asks Gemini for a plain-prose English story of a target length. No curriculum data beyond the
chapter number is injected at this stage.

### 4. LLM adaptation → Japanese + segmentation

`build_system_prompt` ([`agent.py:33`](../apps/story-generator-backend/src/story_generator/agent.py#L33))
assembles the main prompt and streams it to **Gemini 2.5 Flash** (`GEMINI_MODEL`,
[`agent.py:17`](../apps/story-generator-backend/src/story_generator/agent.py#L17)) with JSON
output mode. The model returns, per sentence:

- `english` — English translation of the sentence
- `japanese` — full Japanese sentence, no spaces
- `words` — the **surface word segmentation** (plain surface forms, no furigana)
- `grammar` — 0-based indices into a story-level `grammar` array

> **Target area #1 — segmentation.** Word boundaries are decided entirely by the LLM, governed
> by the free-text "Word Segmentation Rules" block
> ([`agent.py:90`](../apps/story-generator-backend/src/story_generator/agent.py#L90)):
> verb stems stay attached to polite endings, particles and punctuation are separate tokens,
> name honorifics stay attached, and the joined `words` must equal `japanese`.

Thinking-token parts are surfaced as `AGENT_STATUS` events; content parts accumulate into the
raw JSON. A wall-clock deadline (`generationTimeoutS`, default 55 s) bounds the stream.

### 5. Deterministic enrichment

The LLM's simplified response is split into `segments` (sentences) and `story_meta`, then handed
to `build_enriched_story` ([`enrichment.py:341`](../apps/story-generator-backend/src/story_generator/enrichment.py#L341)).
Per word, `enrich_sentence` ([`enrichment.py:273`](../apps/story-generator-backend/src/story_generator/enrichment.py#L273)):

- **Re-tokenizes each LLM word** with SudachiPy (`SplitMode.C`). Note the double-tokenization:
  the LLM segments words, then SudachiPy independently re-segments each token to obtain readings
  and POS.
- Derives the **dictionary form** via `_derive_dictionary_form`
  ([`enrichment.py:89`](../apps/story-generator-backend/src/story_generator/enrichment.py#L89)),
  with special handling for suru-verb compounds (名詞 + する) and conjugation classes read from
  SudachiPy's 活用型 field. *(Target area #2.)*
- Generates **ruby/furigana** from `reading_form()` + `_annotate_morpheme`
  ([`enrichment.py:34`](../apps/story-generator-backend/src/story_generator/enrichment.py#L34)),
  which strips okurigana to produce `食[た]べ`-style annotations, applying **first-occurrence-only**
  suppression across the whole story. *(Target area #3.)*
- Assigns **`vocab_keys`** and builds the **`vocab_supplement`** list (see data-flow table).
- **Validates word boundaries**: raises `ValueError` if `"".join(words)` ≠ the `japanese` string
  ([`enrichment.py:370`](../apps/story-generator-backend/src/story_generator/enrichment.py#L370)).

The result is a complete v2-wire-format story dict.

### 6. Schema validation

`validate(story_dict)` ([`validator.py`](../apps/story-generator-backend/src/story_generator/validator.py))
checks the assembled story against the v2 schema. A failure here is treated as a **pipeline bug**,
not an LLM error (the LLM never sees the enriched fields).

### 7. Stream result to the UI

The enriched JSON is emitted as a `TEXT_MESSAGE_CHUNK` followed by `RUN_FINISHED`
(`resultType: "story"`). The authoring UI reassembles the buffered chunks into the canonical
output ([`useAgUiRun.ts`](../apps/story-generator/src/hooks/useAgUiRun.ts)).

---

## Where Each Data Source Is Incorporated

| Data | Source file | Enters at | Used for |
|------|-------------|-----------|----------|
| **Genki grammar** | `resources/Genki_grammar_for_AI_generation.csv` | **LLM prompt only** — cumulative Ch.1–N grammar block ([`agent.py:52`](../apps/story-generator-backend/src/story_generator/agent.py#L52)) | LLM selects patterns and returns grammar indices. Not consulted after the LLM call. |
| **Genki vocabulary** | `resources/genki1vocab.csv` | **Two places:** (a) LLM prompt as the allowed-vocab list, cumulative by chapter ([`agent.py:44`](../apps/story-generator-backend/src/story_generator/agent.py#L44)); (b) enrichment indexes ([`enrichment.py:163`](../apps/story-generator-backend/src/story_generator/enrichment.py#L163)–[208](../apps/story-generator-backend/src/story_generator/enrichment.py#L208)) | Constrains LLM word choice; deterministically maps dictionary forms → Genki row IDs (`vocab_keys`) and English definitions (glosses). |
| **JMdict** | Jamdict database | Enrichment only ([`enrichment.py:227`](../apps/story-generator-backend/src/story_generator/enrichment.py#L227)) | Fallback English gloss for content words not found in the Genki CSV. |
| **Kanji data** | — | **Not used in generation at all** | `kanji-data.json` (Heisig keywords) is a *reader-side* asset fetched at runtime by [`apps/web`](../apps/web/). Ruby readings are derived from SudachiPy, **not** from any kanji dataset. |

### vocab_key assignment order

Per word, `build_enriched_story` assigns a key by:

1. Genki lookup by dictionary form → Genki row ID (1–1172).
2. Particles / punctuation (`pos_code` in `prt`, `""`) → `null`.
3. Other content words → a supplemental key (≥ 10000), reused per dictionary form, with an entry
   pushed to `vocab_supplement`.
4. Remaining non-content words (suffixes, prefixes) → `null`.

---

## Observations Relevant to the Quality-Improvement Plan

- **Two independent tokenizers disagree.** The LLM decides word boundaries; SudachiPy then
  re-tokenizes each token for readings and dictionary forms. A boundary the LLM draws differently
  from Sudachi is a plausible source of the reading/dictionary-form errors observed in typical
  stories.
- **Ruby accuracy is fully deterministic and SudachiPy-driven.** Improving it is about reading
  selection and the okurigana-stripping heuristic — not the LLM. Homograph disambiguation
  (e.g. 今日 きょう vs こんにち) currently relies on Sudachi's context-free tokenization of an
  already-split token, so sentence context is largely lost.
- **Dictionary-form derivation is heuristic.** Hand-written special cases (suru-compounds,
  conjugation classes) are a likely place where an agentic approach could improve coverage.
- **Prior planning context.** `supp-epic-2` (project memory) covers the Python enrichment
  pipeline that replaced LLM-based tokenization/furigana/vocab, with recorded design decisions
  (okurigana stripping, first-occurrence furigana, POS codes, vocab-key assignment, the Gemini
  segmentation contract). That epic is the direct predecessor to this work.

---

## Key Files

| File | Role |
|------|------|
| [`agent.py`](../apps/story-generator-backend/src/story_generator/agent.py) | Prompt construction, LLM streaming, orchestration of enrichment + validation |
| [`enrichment.py`](../apps/story-generator-backend/src/story_generator/enrichment.py) | SudachiPy tokenization, dictionary form, ruby, vocab_keys, glosses |
| [`data_loader.py`](../apps/story-generator-backend/src/story_generator/data_loader.py) | Genki vocab + grammar CSV loaders (prompt-side data) |
| [`validator.py`](../apps/story-generator-backend/src/story_generator/validator.py) | v2 schema validation of the assembled story |
| [`main.py`](../apps/story-generator-backend/src/story_generator/main.py) | FastAPI app, SSE endpoint, startup wiring, suggest-topic |
| [`useAgUiRun.ts`](../apps/story-generator/src/hooks/useAgUiRun.ts) | Frontend SSE lifecycle / event reassembly |
</content>
</invoke>
