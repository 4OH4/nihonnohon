---
status: backlog
type: supplemental-epic
epic_id: supp-epic-3
created: "2026-07-12"
---

# Supplemental Epic 3: Staged Generation Pipeline and Japanese Story Input

## Overview

This supplemental epic does two things to the story-generator backend
(`apps/story-generator-backend`) and its authoring frontend (`apps/story-generator`):

1. **Adds a third generation entry point** — a **finished Japanese story**, pasted by the user.
   Today the only entry points are an English story (Path A) or a topic (Path B); both always
   produce Japanese *constrained to a chosen Genki chapter*.

2. **Reframes "simplify to a chapter" as an optional _target difficulty_, and cleanly separates
   "produce the Japanese" from "analyse the Japanese".** The single fused Gemini call that today
   translates **and** segments **and** glosses **and** grammar-tags is split into two ordered
   Gemini calls on every path:
   - **Stage 1 — Japanese production**: translate EN→JA or simplify JA→JA (skipped entirely when
     the input is already-final Japanese).
   - **Stage 2 — Japanese analysis**: one prompt, identical on every path, that turns a Japanese
     string into the per-sentence `{english, japanese, words, grammar}` + story metadata that the
     existing deterministic enrichment step consumes.

The **motivation** is quality and testability. Splitting Stage 2 into a single reusable unit
gives us one place to improve **word segmentation**, **dictionary-form derivation**, and **ruby
(furigana) accuracy** — the three quality targets of the planned agentic work — and it maps
directly onto the frozen-input eval harness (`apps/story-generator-backend/eval/`, `ja →
annotations`). This epic is the **structural precursor** to that agentic-quality epic; it does not
itself change the segmentation/enrichment algorithms.

> **Scope note — ADK deferred.** Google ADK (`google-adk`) is declared in `requirements.txt` but
> imported nowhere; `tools.py` is a one-line stub and the AG-UI events are hand-rolled dicts.
> This epic implements the staging as **plain-Python functions**, keeping a clean `(segments,
> story_meta)` seam so ADK can be dropped into the Stage-2 slot later if the agentic epic wants it.

---

## Background and Motivation

### Current pipeline (one fused call)

```
Path A: English story ─┐
Path B: topic → English draft ─┤→ ONE Gemini JSON call (build_system_prompt)
                                    → { sentences:[{english, japanese, words, grammar}], story_meta }
                                → build_enriched_story (deterministic Python: furigana, dict form,
                                                        vocab_keys, vocab_supplement)
                                → validate (v2 schema)
                                → RUN_FINISHED(resultType="story")
```

The one Gemini call simultaneously: translates English→Japanese constrained to Genki Ch.N,
segments each sentence into `words`, writes a per-sentence English gloss, and tags grammar
indices. There is **no way to feed it a finished Japanese story**, and **no way to opt out of
chapter simplification**.

### The load-bearing feasibility fact

Enrichment is **not self-sufficient on raw Japanese**. `build_enriched_story`
(`enrichment.py:341`) requires each sentence to arrive **pre-segmented** and enforces
`"".join(words) == japanese`, raising `ValueError` otherwise (`enrichment.py:366-374`). It also
reads `segment["english"]` and needs `story_meta` (`id/title/title_ja/description`, which the
validator requires — `validator.py:24-26`).

Therefore a "paste finished Japanese" path **cannot** simply call enrichment. It still needs an
LLM **analysis** pass to build the `(segments, story_meta)` seam: segment the text, back-translate
each sentence, tag grammar, and invent the title/description. That analysis pass is exactly
**Stage 2**, and it is the same work needed by the produced paths — so we make it one shared unit.

### New pipeline (two ordered calls, shared analysis)

```
Stage 1 (produce Japanese) ── skipped for frozen JA
   EN→JA(Ch.N | natural)  |  JA→JA(Ch.N)          → plain Japanese prose
Stage 2 (analyse Japanese) ── SAME prompt every path
   Japanese prose → { sentences:[{english, japanese, words, grammar}], story_meta }
Stage 3 (enrich + format) ── UNCHANGED
   build_enriched_story → validate → RUN_FINISHED(resultType="story")
```

### Target-difficulty reframing

"Simplify to Ch.N" becomes an **optional target difficulty**:

- **Target set to Genki Ch.N** → Stage 1 constrains vocab/grammar to Ch.1..N (English translated
  down to that level, or Japanese simplified to it); Stage 2 tags grammar against Ch.1..N;
  `difficulty = "Genki I Ch.N"`.
- **Target unspecified** → the story is **not framed around a chapter**: English is translated at
  natural difficulty (no constraint); finished Japanese is **preserved exactly** (Stage 1 skipped);
  Stage 2 tags grammar against the **full** Genki set so highlights still populate;
  `difficulty = "Unspecified"`.

### Routing and call counts

| Entry point (`path_mode`) | Target = Genki Ch.N | Target = Unspecified | Gemini calls |
|---|---|---|---|
| **A — English story** | produce EN→JA(Ch.N) → analyse | produce EN→JA natural → analyse | 2 |
| **B — Topic** | phase 1 topic→EN; phase 2 produce→analyse | *(unspecified not offered for B; see se3-5)* | 1 + 2 |
| **C — Japanese story (new)** | simplify JA→JA(Ch.N) → analyse | analyse **frozen** JA (no Stage 1) | 2 / **1** |

The "Unspecified" option is offered for the **full-story inputs (A and C)** only; topic mode (B)
keeps requiring a chapter, matching today's behaviour.

---

## Design Decisions

### Two separate Gemini calls on every path (not fused)

Stage 1 and Stage 2 are **distinct calls**, chosen for clean separation of concerns and a single
reusable, benchmarkable analysis stage. This costs an extra call (≈2× latency/token cost) on the
produced paths (A / B-phase-2 / C-with-target); the frozen path stays a single call. Accepted
deliberately — the frozen Japanese path is simply "Stage 1 skipped", handing the user's text
straight to the same Stage 2.

### Stage 1 output is plain Japanese prose

Stage 1 emits a minimal `{"japanese": "<full story text>"}` (or plain text) — **no** segmentation,
gloss, grammar, or metadata. Sentence-splitting is Stage 2's job, so that produced text and pasted
text reach Stage 2 in the identical shape (a Japanese string).

### Stage 2 is a single universal prompt

The same `build_japanese_analysis_prompt` runs for produced and frozen text. It **echoes the
Japanese unchanged** (reusing the existing segmentation rules so the enrichment join-invariant
holds), **back-translates** each sentence to `english`, **invents** `id/title/title_ja/
description`, and tags `grammar`. Its `english` (a back-translation) replaces today's
source-derived gloss uniformly. This prompt is also the production adapter for the eval harness.

### Parameter model: `path_mode="C"` + `chapter="unspecified"` sentinel

- `path_mode` gains value **`"C"`** (Japanese entry point). It is a plain `str` today (no enum),
  so this is additive.
- **No new `simplify` boolean.** The optional target difficulty is folded into the existing
  `chapter` field via a reserved sentinel value **`"unspecified"`**. The backend derives
  `target_chapter: int | None` (`None` ⇒ no target) and a `difficulty_label`. This keeps the wire
  surface minimal and matches the "chapter is a required choice, one option is Unspecified" UX.
- The Japanese source text reuses the existing `inputText` param (no new field).

### Grammar-tagging reference set

Stage 2 tags grammar against **Ch.1..N** when a target is set (as today) and the **full**
cumulative Genki grammar set when unspecified — so grammar highlights populate without constraining
the text. `GrammarData` (already loaded and injected into the agent) is the reference source.

### Extract the shared LLM streamer first (ADK-independent win)

The streaming / monotonic-deadline / mid-stream-cancel / thought-part→`AGENT_STATUS` / `llm_perf`
logging boilerplate is duplicated near-verbatim between the JSON path (`agent.py:366-447`) and the
proposal path (`agent.py:571-646`). Extract it into one `_stream_llm(...)` before adding new
prompts, so Stage 1, Stage 2, and the existing proposal all share one battle-tested streamer.

---

## Current-State Reference (so this epic stands alone)

**Backend — `apps/story-generator-backend/src/story_generator/`**

| What | Where |
|---|---|
| `generate(*, run_id, input_text="", chapter, path_mode="A", topic="", english_draft="", steering_instructions="", temperature=1.0, grammar_distribution=1, target_word_count=0, cancel_event=None)` | `agent.py:285-299` |
| `RUN_STARTED` emit + early cancel guard | `agent.py:307-312` |
| Path B phase-1 dispatch (`if path_mode=="B" and topic:` → `_generate_proposal`) | `agent.py:315-327` |
| Source selection (`source_text = english_draft if (B and english_draft) else input_text`) | `agent.py:331` |
| Empty-source guard | `agent.py:340-346` |
| `_parse_chapter(chapter)` (raises ValueError on bad input) | `agent.py:349-353` |
| `build_system_prompt(...)` — the current fused prompt; cumulative Ch.1..N vocab loop `:44-49`, grammar loop `:53-57`, segmentation rules `:90-97`, "do not introduce vocabulary beyond Chapter N" `:125` | `agent.py:33-130` |
| `build_proposal_prompt(...)` (topic→English) | `agent.py:138-167` |
| JSON stream loop (thought→`AGENT_STATUS`, deadline, cancel, perf log) | `agent.py:366-447` |
| Seam: `segments = raw.get("sentences") or []`; `story_meta = {k:v for k,v in raw.items() if k!="sentences"}`; `story_meta["difficulty"]=f"Genki I Ch.{chapter_int}"` | `agent.py:478-491` |
| `pipeline.build_enriched_story(segments, story_meta)` | `agent.py:506` |
| `validate(story_dict)` | `agent.py:517` |
| Proposal stream loop (duplicate boilerplate) | `agent.py:571-646` |
| `build_enriched_story(segments, story_meta)` — requires pre-segmented `words`; join-invariant | `enrichment.py:341`, guard `:366-374` |
| Validator required top-level fields (`schema_version,id,title,title_ja,language,description,sentences`) | `validator.py:24-26` |
| `GET /run_sse` query params (camelCase aliases) → `agent.generate(...)` | `main.py:173-224` |
| `POST /suggest-topic` | `main.py:285-348` |

**Frontend — `apps/story-generator/src/`**

| What | Where |
|---|---|
| Mode tab registry (`A`=Convert a story, `B`=Generate from topic) | `components/ModeToggle.tsx:8-11`; keyboard nav `:41-51` |
| `pathMode:'A'|'B'` union (duplicated) | `stores/authoringStore.ts:74,88,121`; `hooks/useAgUiRun.ts:63`; `hooks/useSession.ts:22` |
| Input branch (`pathMode==='A'` textarea vs `<TopicTextarea>`) | `components/InputPanel.tsx:166-203`; validation `:79-97`; button label `:297`; collapsed summary `:126-148` |
| Chapter `<select>` (`chapterTarget`, `CHAPTER_OPTIONS = Object.keys(CHAPTER_SCOPE)`) + `<ScopeChip>` | `components/InputPanel.tsx:205-234`; data `components/ScopeChip.tsx:19-43` |
| Request assembly (`URLSearchParams`: runId, inputText, chapter, pathMode, temperature, grammar_distribution, optional steeringInstructions, B-only topic/englishDraft/target_word_count) | `hooks/useAgUiRun.ts:59-94` |
| Store snapshot `StoredInputs` + writers `generate()`/`approve()` | `stores/authoringStore.ts:69-82, 222-226, 250-255` |
| "gate control on pathMode" precedent (Story Length is B-only) | `components/SettingsPanel.tsx:60, 137-196` |
| Session persistence (3 enumerated spots) | `hooks/useSession.ts:15-31, 92-106, 137-152` |
| Contract tests | `src/__tests__/{useAgUiRun,authoringStore,ModeToggle,InputPanel,useSession}.test.*` |

---

## Components Affected

| Component | Package / App | Nature of change |
|---|---|---|
| `agent.py` | story-generator-backend | Extract `_stream_llm`; add `build_japanese_production_prompt` + `build_japanese_analysis_prompt`; two-stage `generate()`; `path_mode="C"`; target-difficulty sentinel + `difficulty_label` |
| `main.py` | story-generator-backend | Accept `path_mode="C"` (already flows through); allow `chapter="unspecified"` |
| `test_agent.py` (+ fixtures) | story-generator-backend | Two-stage ordering, C paths, prompt-builder unit tests, streamer regression |
| `eval/run_eval.py` | story-generator-backend | *(optional se3-6)* wire the Stage-2 analysis prompt as a production adapter |
| `ModeToggle.tsx` | story-generator | Third tab "Japanese story" |
| `authoringStore.ts` | story-generator | `PathMode` type; widen union; `StoredInputs`/snapshot writers |
| `InputPanel.tsx` | story-generator | JA textarea branch; "Unspecified" chapter option + gating; validation; label |
| `useAgUiRun.ts` | story-generator | Widened union; C rides existing `inputText`+`chapter` params |
| `useSession.ts` | story-generator | Persist `pathMode='C'` + unspecified chapter with fallbacks |
| `*.test.*` | story-generator | Update the five contract tests |

---

## Story List

| Story ID | Title | Depends on | Can parallel |
|---|---|---|---|
| se3-1 | Shared LLM streamer extraction | — | se3-5 |
| se3-2 | Stage 1 — Japanese production prompt | se3-1 | se3-3 |
| se3-3 | Stage 2 — universal Japanese analysis prompt | se3-1 | se3-2 |
| se3-4 | Two-stage orchestration + Japanese entry point (backend) | se3-2, se3-3 | — |
| se3-5 | Frontend — Japanese input mode + optional target difficulty | — | se3-1..se3-4 |
| se3-6 | Eval adapter for Stage 2 *(optional)* | se3-3 | — |

se3-1 is a pure refactor and gates the two prompt stories. se3-5 (frontend) can be built in
parallel against the agreed wire contract (`pathMode="C"`, `chapter="unspecified"`). se3-4
integrates the backend; se3-6 is an optional benchmarking payoff.

---

## Stories

---

### Story se3-1: Shared LLM streamer extraction

As a **backend developer**,
I want the duplicated Gemini streaming/deadline/cancel/logging boilerplate extracted into one
`_stream_llm` helper,
So that Stage 1, Stage 2, and the existing proposal path share one tested streamer and adding new
prompts does not triple the boilerplate.

**Acceptance Criteria:**

**Given** `agent.py`
**When** reviewed
**Then** a single async helper (e.g. `_stream_llm(self, *, contents, json_output: bool, activity:
str, temperature: float, cancel_event, run_id)`) owns: the `GenerateContentConfig`
(response_mime_type toggled by `json_output`, `ThinkingConfig` with `include_thoughts=True`), the
monotonic wall-clock deadline and initial `asyncio.wait_for` (mirroring `agent.py:383-388`), the
mid-stream cancel check (`agent.py:393-394`), thought-part → `AGENT_STATUS` emission
(`agent.py:402-408`), and the `llm_perf` log line keyed by `activity`

**Given** `_stream_llm`
**When** it runs
**Then** it yields pass-through `AGENT_STATUS` event dicts and exactly one terminal control dict
(e.g. `{"__stream__": "ok", "text": <raw>}` or `"timeout"` / `"error"` / `"cancelled"`), so callers
`break` on the terminal dict and forward the rest

**Given** the JSON generation path (`agent.py:366-447`) and the proposal path (`agent.py:571-646`)
**When** refactored
**Then** both call `_stream_llm` (JSON path with `json_output=True`, proposal with
`json_output=False`) and no streaming/deadline/cancel/perf boilerplate remains duplicated

**Given** `tests/test_agent.py`
**When** `pytest` is run
**Then** the existing streaming, timeout, thought-chunk, cancel, Path-B phase-1 and phase-2 tests
all pass unchanged (they are the regression net for this extraction)

---

### Story se3-2: Stage 1 — Japanese production prompt

As a **story author**,
I want a Stage-1 prompt that produces only Japanese prose from an English or Japanese source,
So that "produce the Japanese" is a single concern, decoupled from segmentation and annotation.

**Acceptance Criteria:**

**Given** `agent.py`
**When** reviewed
**Then** a new `build_japanese_production_prompt(source, *, source_is_japanese: bool,
target_chapter: int | None, steering_instructions: str)` exists and asks the model to return only
Japanese prose as minimal JSON `{"japanese": "..."}` (or plain text) — **no** `words`, `english`,
`grammar`, `vocab_keys`, furigana, or story metadata

**Given** an English source and `target_chapter` set to N
**When** the prompt is built
**Then** it injects the cumulative Ch.1..N vocab and grammar blocks (reuse the loops at
`agent.py:44-57`) and the hard constraint "do not introduce vocabulary beyond Chapter N"
(`agent.py:125`), instructing a faithful translation at that level

**Given** an English source and `target_chapter is None`
**When** the prompt is built
**Then** no vocab/grammar constraint is injected; the instruction is to translate at natural
difficulty

**Given** a Japanese source and `target_chapter` set to N
**When** the prompt is built
**Then** the instruction is to **simplify the given Japanese** to Ch.N vocab/grammar (not translate)

**Given** `tests/test_agent.py`
**When** run
**Then** unit tests assert the constraint text is present only when a target is set, that the
segmentation/annotation instructions are absent, and that the JA-source variant says "simplify"

---

### Story se3-3: Stage 2 — universal Japanese analysis prompt

As a **story author**,
I want one analysis prompt that turns any Japanese string into the segmented, glossed,
grammar-tagged structure the enrichment pipeline consumes,
So that produced and pasted Japanese are analysed identically and there is a single place to
improve segmentation/dictionary-form/ruby quality later.

**Acceptance Criteria:**

**Given** `agent.py`
**When** reviewed
**Then** a new `build_japanese_analysis_prompt(japanese_text, *, target_chapter: int | None,
steering_instructions: str)` exists and asks for the full JSON the seam needs: top-level
`id/title/title_ja/description/grammar` plus `sentences[]` of `{english, japanese, words, grammar}`

**Given** the analysis prompt
**When** reviewed
**Then** it instructs the model to **echo each `japanese` sentence exactly** (no rewriting) and
reuses the existing Word Segmentation Rules block (`agent.py:90-97`) verbatim, so that
`"".join(words)` reconstructs `japanese` and the enrichment guard (`enrichment.py:366-374`) passes

**Given** the analysis prompt
**When** reviewed
**Then** it requires a **back-translation** into `english` per sentence and requires inventing a
kebab-case `id`, `title`, `title_ja`, and `description` (all validator-required — `validator.py:24-26`)

**Given** `target_chapter` set to N
**When** the prompt is built
**Then** grammar tagging uses the Ch.1..N grammar reference; **given** `target_chapter is None`,
it uses the **full** cumulative Genki grammar set

**Given** `tests/test_agent.py`
**When** run
**Then** unit tests assert the "do not alter the Japanese" instruction, the segmentation-rules
text, the back-translation requirement, the id/title/description requirement, and the
target-vs-full grammar-reference switch

---

### Story se3-4: Two-stage orchestration and Japanese entry point (backend)

As a **story author**,
I want `generate()` to run Stage 1 then Stage 2 (skipping Stage 1 for frozen Japanese) and to
accept `path_mode="C"` with an optional target difficulty,
So that a finished Japanese story can be enriched and formatted, and English/Japanese full-story
inputs can opt out of chapter simplification.

**Acceptance Criteria:**

**Given** `generate()`
**When** invoked
**Then** after `RUN_STARTED` + early-cancel (`agent.py:307-312`) and the unchanged Path-B phase-1
branch (`agent.py:315`), it computes `target_chapter` by guarding the `"unspecified"` sentinel
**before** calling `_parse_chapter` (so `chapter="unspecified"` yields `None`, a real chapter
parses as today)

**Given** `path_mode == "C"` and `target_chapter is None`
**When** generating
**Then** **Stage 1 is skipped**; `japanese_text = input_text` is passed straight to Stage 2; the
resulting story's per-sentence `japanese` equals the pasted input character-for-character

**Given** `path_mode == "C"` and `target_chapter` set
**When** generating
**Then** Stage 1 runs `build_japanese_production_prompt(source=input_text,
source_is_japanese=True, target_chapter)` to simplify, then Stage 2 analyses the result

**Given** `path_mode` in {A, B-phase-2}
**When** generating
**Then** `source_text = english_draft if (path_mode=="B" and english_draft) else input_text`;
Stage 1 runs `build_japanese_production_prompt(source=source_text, source_is_japanese=False,
target_chapter)`; then Stage 2 analyses the result

**Given** the two stages
**When** either Stage 1 or Stage 2 times out, errors, or is cancelled
**Then** the run emits the corresponding `ERROR`/`RUN_CANCELLED` and **does not proceed to the next
stage** (a Stage-1 failure short-circuits Stage 2); both stages surface `AGENT_STATUS` via
`_stream_llm`

**Given** a successful Stage 2
**When** building the story
**Then** the existing seam is preserved — `(segments, story_meta)` are passed unchanged to
`pipeline.build_enriched_story` (`agent.py:506`) then `validate` (`agent.py:517`) then
`RUN_FINISHED(resultType="story")`; `story_meta["difficulty"]` is set to `f"Genki I Ch.{n}"` when a
target is set and `"Unspecified"` when not

**Given** the empty-source guard (`agent.py:340`)
**When** the resolved source (English/draft, or Japanese for Path C) is blank
**Then** an `ERROR` with code `GENERATION_FAILED` is emitted before any Gemini call

**Given** `main.py` `GET /run_sse`
**When** a request arrives with `pathMode=C` and/or `chapter=unspecified`
**Then** it is accepted without a new query parameter (`path_mode` already flows through;
`chapter="unspecified"` is passed through and no longer forced through `_parse_chapter` at the
HTTP layer)

**Given** `tests/test_agent.py`
**When** run
**Then** covers: two-stage ordering (Stage 1 then Stage 2) for A/B2/C-target; Stage-1 failure
short-circuits Stage 2; C-frozen (Stage 1 skipped, `japanese` unchanged, `RUN_FINISHED story`);
C-with-target (simplified); A-unspecified (no vocab constraint in the production prompt);
empty-JA guard; `difficulty` label is "Unspecified" when no target

---

### Story se3-5: Frontend — Japanese input mode and optional target difficulty

As a **story author**,
I want a "Japanese story" tab and an "Unspecified" target-difficulty option,
So that I can paste finished Japanese to enrich, or generate a full story without framing it to a
Genki chapter.

**Acceptance Criteria:**

**Given** `authoringStore.ts`
**When** reviewed
**Then** a shared `export type PathMode = 'A' | 'B' | 'C'` replaces every inline `'A' | 'B'`
(`authoringStore.ts:74,88,121`, `useSession.ts:22`, `ModeToggle.tsx` local types); `pnpm
typecheck` exits 0 (it will flag any missed site)

**Given** `ModeToggle.tsx:8-11`
**When** reviewed
**Then** the `MODES` registry has a third entry `{ value: 'C', label: 'Japanese story' }`; the
existing arrow-key nav (`:41-51`) already generalises over `MODES.length` and needs no change

**Given** `InputPanel.tsx:166-203`
**When** `pathMode === 'C'`
**Then** a `font-ja` `<textarea>` (label "Japanese story") is rendered, bound to
`inputText`/`setInputText`; per-mode validation (`:79-97`) requires `inputText` + a chapter choice
for C; the Generate button label (`:297`) and collapsed summary (`:126-148`) include the C case

**Given** the chapter `<select>` (`InputPanel.tsx:205-234`)
**When** `pathMode` is A or C
**Then** it includes an **"Unspecified — keep original difficulty"** option that maps to the wire
value `chapter="unspecified"`; the "Select a chapter…" placeholder remains the invalid/unfilled
state that triggers the validation hint; when "Unspecified" is selected, the `<ScopeChip>` preview
is hidden and helper text explains the story is not framed around a chapter (reuse the disabled/hint
styling vocabulary from `SettingsPanel.tsx:60,137-196`)

**Given** the topic mode (B)
**When** the chapter selector is shown
**Then** the "Unspecified" option is **not** offered (B keeps requiring a chapter, unchanged)

**Given** `useAgUiRun.ts:59-94`
**When** a Path C run starts
**Then** the request sends the existing `inputText` and `chapter` params (with `chapter=unspecified`
when chosen) and `pathMode=C`; the Path-B-only block stays `=== 'B'`-guarded (no topic/englishDraft
for C)

**Given** the store snapshot and session persistence
**When** reviewed
**Then** `StoredInputs` (`authoringStore.ts:69-82`) and both writers (`:222-226`, `:250-255`) carry
the chapter value as-is; `useSession.ts` (`:15-31, 92-106, 137-152`) round-trips `pathMode='C'` and
an `"unspecified"` chapter with stale-session fallbacks

**Given** the contract tests
**When** run
**Then** `ModeToggle.test.tsx` (3rd tab + 3-way nav), `authoringStore.test.ts`
(`setPathMode('C')`), `useAgUiRun.test.ts` (C sends `inputText`+`chapter`, no topic/englishDraft;
`chapter=unspecified` case), `InputPanel.test.tsx` (C textarea, Unspecified option, validation,
label), and `useSession.test.ts` (`pathMode:'C'` round-trip) are updated and pass

**Given** the project non-negotiable (verify UI/CSS changes in a browser)
**When** the feature is complete
**Then** `pnpm dev` is used to confirm all four behaviours render correctly (A with chapter and
Unspecified; B; C-with-chapter simplified; C-Unspecified leaving the Japanese identical), the
ScopeChip hides when Unspecified, and difficulty labels correctly

---

### Story se3-6: Eval adapter for Stage 2 *(optional)*

As a **backend developer**,
I want the Stage-2 analysis prompt wired into `eval/run_eval.py` as a production adapter,
So that segmentation / dictionary-form / ruby quality is benchmarked against the frozen gold and
the `sudachi-baseline` snapshot before the agentic epic begins.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/eval/run_eval.py`
**When** reviewed
**Then** a new adapter maps `ja → list[{surface, dict, ruby, pos?}]` by calling
`build_japanese_analysis_prompt` on the frozen `ja` (via a real Gemini call, needs
`GEMINI_API_KEY`) and then `EnrichmentPipeline.enrich_sentence` on the returned `words`

**Given** the adapter is selected
**When** `python eval/run_eval.py` runs against `gold/eval-genki6-daily-life.json`
**Then** it prints the same segmentation / dictionary-form / ruby metrics as the baseline adapter,
enabling a direct comparison; the offline `sudachi-baseline` adapter remains the default so the
harness still runs without an API key

---

## Risks and Notes

- **Stage-2 analysis prompt is the central quality dependency on every path.** It must produce
  valid segmentation (join-invariant), back-translation, grammar indices, and the
  validator-required `id/title/title_ja/description`. A weak prompt surfaces as a clean
  `VALIDATION_ERROR` (not a crash) via the existing validate step (`agent.py:517-526`). Iterate it
  against the eval harness — that is the point of making it one reusable unit.

- **Two LLM calls per produced path** (A / B-phase-2 / C-with-target) roughly double latency and
  token cost versus today's single fused call; frozen-JA stays one call. The wall-clock deadline
  (`generationTimeoutS`) now bounds each stage — confirm Stage 1 does not consume the whole budget
  and starve Stage 2.

- **A/B output will change.** They become a two-call pipeline and Stage 2's back-translated
  `english` replaces the original source gloss. This is an intended behavioural change, not a
  regression; validate quality holds via the eval harness + manual checks rather than a
  byte-identical comparison. **Stage 3 (deterministic enrichment) is untouched.**

- **Grammar tagging with no target** injects the full Genki grammar list into the analysis prompt —
  verify it stays within token budget.

- **`chapter="unspecified"` sentinel** must be guarded before `_parse_chapter` on the backend
  **and** be a real selectable option on the frontend — easy to implement one side only.

- **Streamer extraction (se3-1)** is the riskiest change to shared code; lean on the existing
  streaming/timeout/thought/proposal tests as the regression net and land it before the prompt
  stories.

- **ADK stays deferred.** The `_produce_japanese` / `_analyze_japanese` seam is the drop-in point
  if the later agentic epic adopts an ADK `SequentialAgent`. Nothing in this epic wires ADK.

---

## Verification

1. **Backend unit tests** — from `apps/story-generator-backend`: `pytest tests/test_agent.py -v`
   (no SudachiPy needed; mock pipeline), plus `test_enrichment.py`, `test_validator.py`,
   `test_contract.py`. Existing streaming/proposal tests guard se3-1; new tests cover the C paths
   and A-unspecified.
2. **Backend run** — `uvicorn`; `GET /run_sse?runId=…&pathMode=C&chapter=unspecified&inputText=<frozen JA>`
   → `RUN_FINISHED resultType="story"` with the Japanese **unchanged** and furigana/vocab_keys
   present; repeat with `chapter=Genki%20I%20Ch.6` and confirm it is simplified; confirm
   `pathMode=A&chapter=unspecified` translates without a Genki constraint.
3. **Eval harness** — `python eval/run_eval.py` still runs on the unchanged gold with the offline
   baseline; the optional se3-6 adapter benchmarks production Stage 2 against the snapshot.
4. **Frontend** — `pnpm typecheck` (catches every un-widened `'A' | 'B'`), `pnpm build`,
   `pnpm test` for the five updated test files.
5. **Manual browser check (project non-negotiable)** — `pnpm dev`; exercise A (chapter +
   Unspecified), B, C-with-chapter (simplified), C-Unspecified (JA identical to input); confirm the
   Unspecified option renders, the ScopeChip hides when Unspecified, difficulty labels correctly,
   download works, and a session restore round-trips `pathMode='C'`.

---

## What does NOT belong in this epic

- The segmentation / dictionary-form / ruby **quality algorithms** themselves — this epic only
  builds the isolated, benchmarkable analysis stage those improvements will target (the agentic
  epic).
- **ADK adoption** — deferred; the plain-Python seam is the future drop-in point.
- Any change to the **v2 wire format** or `validator.py` — the seam and schema are unchanged.
