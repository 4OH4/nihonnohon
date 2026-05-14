---
title: "Product Brief Distillate: Story Authoring Tool"
type: llm-distillate
source: "product-brief-story-authoring-tool.md"
created: "2026-05-14"
purpose: "Token-efficient context for downstream PRD and architecture creation"
---

# Product Brief Distillate: Story Authoring Tool

## Milestone Structure

- **M0 — Feasibility spike:** Single Gemini API call, no UI, known English input → schema-valid `story.v1.json`. Proves parallel array generation works before M1 UI work begins.
- **M1 — Local tool, prompt-grounded:** Browser UI + Python backend, local only. Single powerful Gemini call, Pydantic-mapped structured output. Path A only (English story → Japanese JSON). M1's purpose is to get a working integration baseline quickly — not to maximise calibration quality. M2 improves quality; M1 just has to work.
- **M2 — ReAct agentic, tool-call grounded:** RT builds the agentic workflow himself using Google ADK. Lighter Gemini model. Agents call explicit vocab/grammar tools to verify calibration rather than relying on LLM compliance. Per-sentence regeneration via `sentence.id`.
- **M3 — Story generation prepended:** Adds Path B (topic → English story → user review → M2 pipeline). Separate generation workflow, not a modification of the translation pipeline.
- **Community deployment (future, committed roadmap):** Backend to Google Cloud Run, frontend to Vercel. Triggered by community story-sharing hub launch. Multi-user, auth, content safety guardrails. Not in M0–M3 scope.

## Technology Decisions

- **LLM:** Google Gemini. Powerful model for M0/M1 (exact model TBD — candidate: Gemini 2.5 Pro). Lighter model for M2 (candidate: Gemini 2.5 Flash). Model selection is an open decision for each milestone.
- **Orchestration:** Google Agent Development Kit (ADK) Python. v1.0.0 is stable; v2.0 (workflows + agent teams) is in beta — RT to decide which version to target for M2.
- **Backend:** Python. No framework specified yet.
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui — same stack as `apps/web`. Eventually on Vercel.
- **Schema validation (Python):** `jsonschema>=4.0.0` against `packages/schema/schemas/story.v1.json`. Stub already exists at `apps/story-generator/src/story_generator/validator.py`.
- **Monorepo placement:** `apps/story-generator/` — excluded from `pnpm-workspace.yaml` (Python project). Already has `requirements.txt` with `jsonschema>=4.0.0`; Gemini/ADK dependencies not yet added.

## Data Files and Contracts

- **`resources/genki1vocab.csv`** — Genki vocabulary reference for the authoring tool. To have a hardcoded numeric ID as first column (design decision made). This is the source the tool uses for calibration and `vocab_keys` assignment. Distinct from `scripts/data/genki-vocab.csv` which feeds the web app.
- **`resources/Genki_grammar_for_AI_generation.csv`** — Genki grammar points, chapter by chapter. New file added by RT. No equivalent existed previously — grammar was free-form with no reference data.
- **Cumulative difficulty model:** Target chapter N means vocab from Ch.0–N and grammar from Ch.0–N are all in scope. A learner is assumed to have studied sequentially through the chapters.
- **`packages/schema/schemas/story.v1.json`** — single source of truth consumed by AJV (TypeScript, web app) and jsonschema (Python, generator). JSON Schema Draft-07. `additionalProperties: false` at every node — any extra field causes validation failure.

## Schema Contract Details (Critical for Implementation)

- **Parallel arrays — mandatory invariant:** Every sentence must have `words[]`, `ruby[]`, and `vocab_keys[]` of identical length. JSON Schema cannot express this constraint; the story-loader enforces it with `LoaderError('SCHEMA_INVALID')`. The generator must ensure length parity even when ruby or vocab_keys entries are `null`.
- **`words[]`:** String array, each entry minLength 1. Japanese tokens as segmented by the generator.
- **`ruby[]`:** `(string | null)[]` — hiragana reading per token. `null` for tokens with no kanji (particles, kana-only words, punctuation).
- **`vocab_keys[]`:** `(integer | null)[]` — integer references into `genki1vocab.csv` row IDs, or supplemental key (see below), or `null` for tokens with no vocabulary entry.
- **Vocab supplement key policy (design decision):** Words not in `genki1vocab.csv` (proper nouns, loanwords, topic-specific terms) go into `vocab_supplement` with an assigned supplemental key integer. That key is used in `vocab_keys`. **This requires a schema change: `vocab_supplement` entries currently have `{word, hiragana, translation}` — a `key` property must be added.** This is a pre-condition for M1 implementation.
- **`sentence.grammar`:** `integer[]` — indices into the story-level `grammar` array (which is `string[]`). These are cross-references, not strings. Out-of-bounds indices silently mute grammar panel items — generator must ensure indices are within bounds.
- **`story.grammar`:** `string[]` — human-readable grammar point descriptions (e.g. "て-form for connecting actions"). No reference file; the LLM generates these from its own knowledge.
- **`difficulty` string format:** Free-form but must follow convention for library filter to work: `"Genki I Ch.6"`, `"Genki II Ch.14"`, `"JLPT N4"`. Parser splits on first space to extract source and level.
- **`schema_version`:** String enum `"1"` (not integer). Must be exactly this.
- **`sentence.id`:** String, minLength 1. Explicitly added to schema for AI correction/regeneration flows — stable sentence IDs allow M2's ReAct agents to target specific sentences without full regeneration.
- **`vocab_supplement` and `keywords`:** Both use the same shape `{word, hiragana, translation}` (plus the new `key` field). `keywords` = target vocabulary the story is designed to teach. `vocab_supplement` = additional terms not in the Genki dictionary.
- **`audio_url`:** Optional, no URI format validation enforced. Generator can omit.

## Key Loader Error Codes (Generator Output Will Face These)

- `PARSE_FAILED` — output is not valid JSON
- `SCHEMA_INVALID` — fails AJV validation or parallel array length mismatch
- `UNSUPPORTED_VERSION` — `schema_version` not in the loader registry

## M1 vs M2 Calibration Approach

- **M1 (prompt-grounded):** Vocab and grammar CSVs included in system prompt. LLM instructed to stay within chapter ceiling. Reliability is bounded by LLM compliance — expect some ceiling violations, especially for less common vocabulary. Acceptable for M1; the goal is integration, not perfection.
- **M2 (tool-call grounded):** ReAct agents have explicit tools: look up a word in the vocab list, check its chapter, get available grammar points for a target chapter. Calibration violations are caught and corrected in the agent loop. Ruby annotations can be cross-checked against a dictionary source. Per-sentence regeneration via `sentence.id` allows correction without full story regeneration.

## Rejected Ideas / Explicit Out-of-Scope

- **Cloud Run / Vercel for M1:** Rejected — that is the community deployment milestone, much later. M1 is local only.
- **Automatic `manifest.json` management:** Rejected for M0–M3 — RT updates manually. Community hub will use database upload instead.
- **Audio generation:** Out of scope; `audio_url` field left empty.
- **AI simplification of existing native Japanese text:** Separate future pipeline, not this tool.
- **Non-Genki difficulty frameworks (JLPT-only stories):** Deferred beyond initial milestones.
- **Content provenance enforcement:** Out of scope — Path A assumes original/licensed English source; tool does not verify.
- **Multi-user access / authentication:** Community deployment milestone only.

## Risk Register

| Risk | Severity | Notes |
|------|----------|-------|
| LLM hallucinates vocab_keys that don't exist in genki1vocab.csv | High | Schema-valid JSON but referentially invalid; app may misrender. M2 tool-call grounding mitigates. |
| Word segmentation errors | High | LLM segments tokens incorrectly → parallel arrays length-matched but semantically wrong. No schema validation catches this. Consider MeCab/Fugashi/SudachiPy as a verification oracle in M2. |
| Ruby annotation phonetic errors | High | LLMs make systematic errors on kanji readings, especially proper nouns. Schema only checks array length, not phonetic accuracy. Cross-referencing against a dictionary API (kanjiapi.dev) is a candidate verification step. |
| Gemini structured output fails schema on first call | Medium | Complex parallel array constraints are frequently violated. M0 spike exists precisely to surface this before M1 UI is built. Define error UX: what does the user see when generation fails? |
| Gemini API cost at scale | Medium | Multi-step agentic loops in M2/M3 with larger prompts (CSVs in context) may be significant per story. Not mentioned in brief — worth estimating before M2 begins. |
| Google ADK API churn | Medium | ADK is still maturing; v2.0 in beta. Building on early ADK conventions carries maintenance risk if API surface changes. |
| Grammar CSV accuracy | Medium | `Genki_grammar_for_AI_generation.csv` is a derived artifact — if chapter tagging is incomplete or wrong, grammar calibration guarantee collapses silently. Validate against Genki textbook before M1 relies on it. |

## Competitive Context (May 2026 Snapshot)

- **Satori Reader:** Human-authored, fixed catalogue, no AI generation, no curriculum targeting of new content. Users exhaust it and complain.
- **Tadoku (にほんごたどく):** Free open-access graded readers. Severe content skew — most titles at Level 0; intermediate plateau (N4/N3) severely under-served.
- **LingQ:** Import-any-content platform. Does not generate calibrated content — leaves difficulty calibration to user.
- **BunPro:** Grammar SRS with example sentences. Not a graded reader; JLPT alignment is its strength but no story generation pipeline.
- **Lenguia / generic AI reading apps:** Simplify native Japanese text at approximate difficulty. Output is not a structured JSON artefact; no English-to-Japanese authoring loop.
- **Gap:** No tool offers English source → Genki-chapter-calibrated Japanese → structured JSON for developer consumption. The niche is genuinely unoccupied.

## Open Technical Questions (Unresolved at Brief Stage)

- Which specific Gemini model for M0/M1? (Gemini 2.5 Pro is candidate but not committed)
- Which specific Gemini model for M2? (Gemini 2.5 Flash is candidate)
- Which ADK version for M2 — v1.0 stable or v2.0 beta?
- Ruby accuracy verification approach — dictionary API cross-reference, morphological analyser, or trust-LLM in M1 and add verification in M2?
- Per-sentence consistency in M2 — if sentence 3 is regenerated, how is lexical coherence with sentences 1–2 maintained?
- How are supplemental vocab keys numbered? Separate namespace from Genki IDs, or sequential continuation?

## Requirements Hints (Likely to Appear in PRD)

- Schema change required: add `key: integer` property to `vocab_supplement` entry shape in `story.v1.json`
- `genki1vocab.csv` needs a hardcoded numeric ID column added as first column
- Prompt must include full cumulative vocab and grammar lists for the target chapter ceiling
- M0 spike must produce output loadable by `loadStory()` from `@nihonnohon/story-loader`
- M1 error UX: define what user sees when Gemini call fails or output fails schema validation
- M2 agent must use `sentence.id` as the unit of targeted regeneration
- Difficulty string must follow `"Genki I Ch.N"` / `"Genki II Ch.N"` convention exactly for library filter to work
- Generated file output location: `apps/web/public/stories/` (user then manually edits `apps/web/public/manifest.json`)
- `apps/story-generator/` is excluded from `pnpm-workspace.yaml` — must not be added

## User Context

- **Primary user (all milestones):** RT — app developer and content author, using the tool locally to build the nihonnohon library. Comfortable with Python, running local dev servers, and editing JSON.
- **Nihonnohon app status:** Feature-complete as of 2026-05-13. One valid generated story is the sole remaining gate before v1 public launch. M0/M1 are on the critical path.
- **Future user:** Community authors via the story-sharing hub — non-technical, need a deployed web interface with guardrails.
