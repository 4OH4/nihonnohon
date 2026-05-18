---
title: "Product Brief: Nihonnohon Story Authoring Tool"
status: "complete"
created: "2026-05-14"
updated: "2026-05-14"
inputs:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "docs/adr/003-story-generator-out-of-scope.md"
  - "apps/story-generator/README.md"
  - "packages/schema/schemas/story.v1.json"
  - "scripts/data/genki-vocab.csv"
  - "resources/Genki_grammar_for_AI_generation.csv"
---

# Product Brief: Nihonnohon Story Authoring Tool

## Executive Summary

The nihonnohon Japanese graded reader app is feature-complete — a polished, curriculum-aligned reading experience awaiting a library. The bottleneck is content: hand-authoring a Japanese graded story at a precise Genki chapter difficulty level requires vocabulary selection, kanji ruby annotation, grammar point identification, English translation, and precise JSON schema encoding. A single story takes hours. Without a scalable content pipeline, the library stagnates and the app cannot launch.

The Nihonnohon Story Authoring Tool solves this by using AI — specifically Google Gemini via the Google Agent Development Kit — to transform either an English source story or a topic prompt into a fully-annotated, schema-valid Japanese story file, calibrated to a target Genki chapter difficulty. It runs locally as a browser-based UI backed by Python. Technology choices are made with a committed future deployment in mind: when the community story-sharing hub launches, the tool's backend moves to Google Cloud Run and its frontend to Vercel, serving community authors at scale.

This is not a generic translation tool. It understands the nihonnohon story schema, the Genki vocabulary and grammar curriculum, and the cumulative learning model — ensuring every generated story uses vocabulary and grammar appropriate for a learner who has studied up to and including the target chapter.

## The Problem

Creating content for a curriculum-aligned graded reader is a compound authoring problem:

- **Vocabulary calibration** — every word must be checked against the learner's chapter ceiling; out-of-level words must be avoided or supplemented with explanations
- **Grammar calibration** — sentence structures must match what the learner has studied; a Ch.3 story cannot use the て-form if it isn't introduced until Ch.6
- **Ruby annotation** — every kanji requires a hiragana reading encoded per-token in a parallel array aligned with the word segmentation
- **Schema encoding** — output must be valid `story.v1.json`: three equal-length parallel arrays per sentence, integer vocab key references, grammar index cross-references, a correctly formatted difficulty string

Today this is done entirely by hand. The single existing story in the app took significant effort to produce. That effort cannot scale to a useful library — let alone a community content ecosystem. The nihonnohon web app is ready and waiting; the content pipeline is the only thing blocking launch.

## The Solution

The authoring tool accepts one of two starting points:

**Path A — Translate an existing story:** The user provides an English story and a target difficulty level. The tool transforms it into a Genki-calibrated Japanese story with all required annotations and schema encoding.

**Path B — Generate then translate:** The user provides a topic or creative brief. The tool first generates a candidate English story for the user to review and approve, then runs the same translation pipeline.

In both cases the output is a complete, validated `story.v1.json` file: Japanese sentences with per-token word segmentation, ruby character annotations, vocabulary key mappings to the Genki vocabulary list, English translations, grammar point annotations, difficulty metadata, and all other required schema fields.

The tool runs as a browser UI with a Python backend, using Google Gemini LLMs orchestrated through the Google Agent Development Kit. It is developed across three milestones of increasing agentic sophistication — preceded by a focused feasibility spike that validates the core generation approach before any UI is built.

The two milestones differ in how they enforce curriculum calibration. M1 uses **prompt-grounded generation**: the full vocabulary and grammar CSVs are included in the system prompt and the LLM is instructed to stay within the chapter ceiling — a pragmatic baseline that enables rapid integration of all surrounding components. M2 uses **tool-call grounded generation**: the ReAct agents have explicit tools to look up words against the vocab list, verify chapter membership, and check grammar availability — catching and correcting calibration violations programmatically rather than relying on LLM compliance. Words not in the Genki list are handled consistently across both milestones: they are placed in `vocab_supplement` with an assigned supplemental key, and that key is used in `vocab_keys` — a design that requires a minor schema update to add a `key` property to supplement entries.

## What Makes This Different

**Curriculum-aware, not just translation-aware.** The tool has access to the full Genki vocabulary list (with stable hardcoded numeric IDs) and a Genki grammar points reference, chapter by chapter. A difficulty of "Genki I Ch.6" applies a cumulative ceiling — vocabulary from Ch.1–6, grammar patterns from Ch.1–6. This is pedagogically grounded calibration, not approximate level labelling.

**Schema-native output.** The tool produces the exact `story.v1.json` format the nihonnohon app consumes, validated against the same JSON Schema. The parallel array invariant (words, ruby, and vocab_keys of equal length per sentence) is enforced before the file is written. The output either works in the app or is not saved.

**No competitor does this (evaluated May 2026).** Existing tools offer fixed human-authored catalogues (Satori Reader, Tadoku) or simplify native Japanese text (Lenguia, LingQ). None offer English source → curriculum-calibrated Japanese → structured JSON for developer consumption. The intermediate plateau (Genki II / JLPT N4–N3) is the most acutely under-served difficulty band, and is precisely the target.

**Architecture aligned with its deployment future.** The Python backend and React/Vite frontend share the same technology choices as the nihonnohon reader and its planned production infrastructure (Google Cloud Run, Vercel). The local-first v1 is not a throwaway prototype — it is the first deployment of a production-aligned architecture, making the eventual move to Cloud Run a configuration change rather than a rewrite.

## Who This Serves

**Primary — RT (content author, app developer):** Needs to populate the nihonnohon library with readable, level-appropriate Japanese stories. Currently blocked by the time cost of manual authoring. Success means generating a validated, renderable story in minutes, and building a library of ten or more stories across difficulty levels to enable a meaningful public launch.

**Future — Community authors:** Japanese learners and teachers who want to contribute stories to the nihonnohon sharing hub. They will need a deployed web interface, account-based access, and safety guardrails — but the same core generation pipeline serves them.

**End beneficiaries — Intermediate-beginner Japanese learners:** At the Genki I/II level (JLPT N5–N3), these learners face the well-documented intermediate plateau: enough vocabulary to want to read, but insufficient calibrated reading material. Every story the tool produces is content that did not exist before.

## Success Criteria

**M1 — Launch gate:** A single Gemini call produces a `story.v1.json` that passes schema validation and renders correctly in the nihonnohon reader. This unlocks the nihonnohon v1 public launch.

**M2 — Quality and control:** The RT-built ReAct agentic workflow produces stories with measurably better linguistic calibration than M1, supports per-sentence regeneration, and reduces the need for manual post-generation correction.

**M3 — Full authoring flow:** A user can go from topic brief to published story JSON without authoring any English content manually. The English story generation and review step is smooth and produces usable proposals on the first attempt in the majority of cases.

**Quality bar (all milestones) — two tracks:**
- *Technical validity:* passes schema validation, all vocab_keys resolve to real Genki entries, parallel arrays correctly aligned, difficulty string correctly formatted
- *Pedagogical quality:* spot-checked by RT against the Genki reference — vocabulary within the chapter ceiling, grammar structures appropriate, ruby annotations phonetically correct, English translation accurate

## Scope

**Milestone 0 — Feasibility Spike (pre-M1):**
- Single Gemini API call (no UI) with a known English story as input
- Validates that a powerful Gemini model can produce schema-valid `story.v1.json` with correct parallel arrays in one call
- Success criterion: the output passes `story.v1.json` schema validation and loads correctly in the nihonnohon reader
- Informs prompt design and Pydantic model structure before M1 UI work begins

**Milestone 1 (M1):**
- Browser UI + Python backend, running locally only
- Single Gemini call, powerful model, Pydantic-mapped structured JSON output (prompt-grounded calibration)
- Path A only (English story → Japanese story JSON)
- Vocab reference: `genki1vocab.csv` with hardcoded numeric ID column
- Grammar reference: `Genki_grammar_for_AI_generation.csv`
- Cumulative difficulty model (Ch.1 through target chapter)
- Vocab supplement policy: words not in `genki1vocab.csv` assigned a supplemental key, placed in `vocab_supplement`, referenced from `vocab_keys` — requires a `key` property addition to `story.v1.json` schema
- Schema validation against `story.v1.json` before file is written
- Output file saved locally; user manually updates `manifest.json`

**Milestone 2 (M2):**
- RT-built ReAct agentic workflow using Google ADK (tool-call grounded calibration)
- Lighter Gemini model with agent-driven schema and linguistic validation via explicit vocab/grammar tool calls
- Per-sentence regeneration using stable `sentence.id` field
- Agent loop continues until output passes all validation gates

**Milestone 3 (M3):**
- Path B: topic prompt → English story generation → user review → Japanese story JSON
- Separate story-generation workflow prepended to the M2 pipeline

**Future milestone — Community deployment:**
- Backend deployed to Google Cloud Run; frontend deployed to Vercel
- Multi-user access, authentication, and content safety guardrails
- Triggered by community story-sharing hub launch; not in scope for M1–M3

**Explicitly out of scope for M0–M3:**
- Automatic `manifest.json` management (manual for now)
- Audio generation (`audio_url` field omitted or left empty)
- AI simplification of existing native Japanese text (separate future pipeline)
- Non-Genki difficulty frameworks in initial milestones
- Content provenance enforcement — Path A assumes the English source story is original or appropriately licensed content; the tool does not verify this

## Vision

When the nihonnohon community story-sharing hub launches, this tool becomes its content engine. Authors worldwide — teachers, advanced learners, enthusiasts — use a deployed web interface to generate curriculum-calibrated stories on any topic and contribute them to a shared library. The tool's chapter-level difficulty awareness ensures every contributed story carries a trustworthy difficulty label, solving the cold-start problem that plagues community content platforms.

Longer term, the agentic pipeline could support a language educator workflow: specify a chapter, a grammar point to reinforce, a cultural theme — and receive a classroom-ready reading passage in minutes. That is the distance between a content tool and a curriculum authoring platform.
