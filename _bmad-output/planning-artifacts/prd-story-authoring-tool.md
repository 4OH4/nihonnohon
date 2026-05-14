---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
status: complete
completedAt: "2026-05-15"
releaseMode: phased
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-story-authoring-tool.md"
  - "_bmad-output/planning-artifacts/product-brief-story-authoring-tool-distillate.md"
  - "_bmad-output/project-context.md"
  - "docs/adr/003-story-generator-out-of-scope.md"
  - "docs/data-models.md"
briefCount: 2
researchCount: 0
brainstormingCount: 0
projectDocsCount: 3
workflowType: 'prd'
classification:
  projectType: web_app
  domain: edtech
  complexity: medium
  projectContext: brownfield
  schemaConstraintNote: "story.v1.json is versioned (currently v1) and can evolve — work with it where possible, change only where essential. Known required change: add key property to vocab_supplement entries to support supplemental vocab_keys."
---

# Product Requirements Document - Story Authoring Tool

**Author:** RT
**Date:** 2026-05-14

## Executive Summary

The nihonnohon Japanese graded reader app is feature-complete and awaiting library content. Hand-authoring a single curriculum-calibrated Japanese story — vocabulary selection, grammar calibration, kanji ruby annotation, English translation, and JSON schema encoding — takes hours and does not scale. One validated story file is the sole remaining gate before the app can launch publicly.

The Story Authoring Tool is an AI-powered content generation pipeline that transforms an English source story into a fully-annotated, schema-valid nihonnohon story file calibrated to a target Genki chapter difficulty level. It is built in two major versions. **v1** runs locally — a browser UI backed by a Python backend, used by RT to generate library content. **v2** is a cloud-deployed public product: the Python backend on Google Cloud Run, the frontend on Vercel, exposing the same generation pipeline to community authors via a secure, multi-user web interface. v2 is triggered by the launch of the nihonnohon community story-sharing hub and is a committed roadmap item. Architecture and technology choices in v1 (Python + ADK backend, React/Vite/Tailwind frontend) are made with v2's deployment target in mind — the transition from local to cloud is a configuration and infrastructure change, not a rewrite. This PRD covers v1 (M0–M3); v2 requirements will be specified separately.

The tool is delivered across four milestones: M0 (feasibility spike — no UI, validates core generation approach), M1 (local browser UI + Python backend, single-call prompt-grounded generation), M2 (RT-built ReAct agentic workflow with tool-call grounded calibration validation), and M3 (topic-to-story generation prepended to the M2 pipeline).

### What Makes This Special

**Curriculum calibration is grounded, not approximate.** The tool has access to `genki1vocab.csv` (vocabulary with stable numeric IDs, chapter by chapter) and `Genki_grammar_for_AI_generation.csv` (grammar points by chapter). A target of "Genki I Ch.6" applies a cumulative ceiling across both — vocabulary from Ch.1–6, grammar patterns from Ch.1–6. This is the only tool that knows what grammar and vocabulary a learner at a specific Genki chapter has and has not yet studied.

**Output is schema-native.** The generated file either passes `story.v1.json` validation and loads correctly in the nihonnohon reader, or it is not saved. The parallel array invariant (words, ruby, vocab_keys of equal length per sentence) is enforced before write. Vocabulary not in the Genki list is assigned a supplemental key and placed in `vocab_supplement`, referenced consistently from `vocab_keys`.

**M1 and M2 differ in calibration reliability, not schema contract.** M1 uses prompt-grounded generation (CSVs in system prompt — fast to build, bounded by LLM compliance). M2 uses tool-call grounded generation (ReAct agents explicitly look up and verify each word and grammar point — reliable calibration enforced programmatically). The schema output contract is identical across both milestones.

**No competitor does this.** Existing tools offer fixed human-authored catalogues (Satori Reader, Tadoku) or simplify native Japanese text (Lenguia, LingQ). None offer English source → Genki-chapter-calibrated Japanese → structured JSON output. The intermediate plateau (Genki II / JLPT N4–N3) is the most under-served difficulty band and the primary target.

### Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Type** | Web app (browser UI + Python backend; internal tool in v1, public multi-user in v2) |
| **Domain** | EdTech / AI content generation tooling |
| **Complexity** | Medium (elevated by LLM orchestration, agentic workflow design, and schema contract constraints) |
| **Project Context** | Brownfield — `story.v1.json` is a versioned constraint; work with it where possible, change only where essential. Known required change: add `key` property to `vocab_supplement` entries. |

## Success Criteria

### User Success

- **M0:** A Gemini API call with a known English story as input produces a `story.v1.json` that passes Python `jsonschema` validation and loads without error via `loadStory()` from `@nihonnohon/story-loader`. RT can open the story in the nihonnohon reader and read it.
- **M1:** RT can take an English story, specify a target Genki chapter, and receive a complete story JSON file in minutes. The file passes schema validation automatically (enforced by Pydantic structured output). RT's editorial read confirms vocab keys reference real entries, grammar strings are appropriate, and ruby annotations are phonetically correct. No story is saved unless it passes validation.
- **M2:** RT's editorial read of M2-generated stories finds fewer semantic errors (incorrect vocab keys, out-of-level vocabulary, malformed grammar strings) than M1 output for comparable inputs.
- **M3:** Given a topic prompt, the tool produces an English story proposal that RT proceeds with (without regenerating) more than 90% of the time. The accepted proposal is coherent, appropriately scoped for the target difficulty, and culturally plausible.

### Business Success

- **Launch gate:** M0 + M1 complete → nihonnohon v1 ships publicly.
- **Library growth:** RT builds a library of 10+ stories across Genki I and Genki II difficulty levels before or shortly after the nihonnohon v1 public launch.
- **v2 readiness:** The v1 architecture requires no significant restructuring to deploy to Cloud Run and Vercel when the community story-sharing hub launches.

### Technical Success

- **Schema validity:** Every saved story file passes `story.v1.json` validation via `jsonschema`. Pydantic structured output enforces this at generation time — invalid JSON is never written to disk.
- **Parallel array integrity:** `words[]`, `ruby[]`, and `vocab_keys[]` are equal length for every sentence. This constraint is enforced in the generation layer, not by JSON Schema.
- **Supplemental vocab consistency:** Every word not in `genki1vocab.csv` is assigned a supplemental key, appears in `vocab_supplement` with that key, and is referenced from `vocab_keys` using that key.
- **Difficulty string format:** Generated stories use the `"Genki I Ch.N"` / `"Genki II Ch.N"` convention exactly, ensuring the nihonnohon library filter correctly categorises them.

### Measurable Outcomes

| Milestone | Primary Outcome | How Verified |
|-----------|----------------|--------------|
| M0 | Schema-valid story from a single Gemini call | `jsonschema` pass + `loadStory()` success |
| M1 | Story generated and saved in under 5 minutes end-to-end | RT stopwatch |
| M2 | Editorial read finds fewer errors than M1 baseline | RT informal tracking |
| M3 | >90% of English story proposals accepted on first attempt | RT manual review log |

## User Journeys

### Journey 1: RT — Core Content Generation (Path A, M1)

**Persona:** RT — app developer and Japanese language enthusiast. He has a short English story about a university student's first day in Tokyo. He wants to turn it into a Genki I Ch.8 reading for the nihonnohon library.

**Opening Scene:** RT opens the Story Authoring Tool in his browser. The UI shows a text area for the English story, a difficulty selector, and a Generate button. If RT has a previous session in progress, the tool restores it from client-side storage automatically.

**Rising Action:** He pastes the English story and selects "Genki I Ch.8". He can optionally expand a steering panel to provide additional LLM instructions. He clicks Generate. The tool validates inputs are non-empty and a chapter is selected. A progress indicator shows generation is live. On timeout (60s), a recoverable error state preserves all inputs with a Retry button. On success, the backend validates JSON syntax and the parallel array invariant before returning; a structured error is returned on failure (not 200 with broken JSON). The backend generates a suitable `id` field (e.g. `genki-i-ch8-tokyo-first-day`). The generated story JSON populates the output textarea.

**Climax (M1):** RT reviews the output — his editorial eye is the quality gate at this milestone. If satisfied, he clicks Save. The tool validates the `id` as a legal filename and runs the full client-side semantic validation suite. If all checks pass, the browser downloads the file as `{id}.json` (UTF-8, no BOM) and a toast confirms the download. RT uploads the file to the nihonnohon reader to verify rendering.

**Climax (M2):** Same UI, but the ReAct agentic loop including the grammar verification agent runs on the backend before returning. The UI only receives output that has passed all LLM-based checks.

**Resolution:** Story verified and downloaded. RT adds it to `manifest.json` alongside other stories at a later point.

---

### Journey 2: RT — Unsatisfactory Output, Edit or Re-run (M1 Error Recovery)

**Persona:** Same as Journey 1. RT is generating a Genki II Ch.14 story.

**Opening Scene:** RT generates output. It arrives in the textarea, having passed backend validation.

**Rising Action — Edit path:** RT spots a grammar annotation referencing the wrong index. He edits the JSON in the textarea and clicks Save. Client-side validation runs (JSON syntax, then semantic rules). All pass. Browser download triggered.

**Rising Action — Re-run path:** RT clicks Re-run. Because he has made edits, the tool prompts: *"You have unsaved manual edits. Re-running will replace the current output. Continue?"* He confirms. Re-run re-invokes the pipeline from the original inputs — it does not re-parse the textarea. New output arrives with a new `id`.

**Climax — Validation failure path:** A semantic check fails: *"Parallel array invariant broken at sentence 3: words has 5 tokens, ruby has 4."* The download is blocked. RT locates sentence 3 in the textarea, corrects the ruby array, clicks Save again. All checks pass. Download proceeds.

**Resolution:** A clean, validated story file regardless of which recovery path RT took.

---

### Journey 3: RT — Topic-to-Story Generation (Path B, M3)

**Persona:** RT wants a Genki I Ch.5 story with no English source material. Theme: a student asking for directions to the campus library.

**Opening Scene:** RT selects Path B mode and sees a topic/prompt field. He types a brief description, selects "Genki I Ch.5", clicks Generate Story.

**Rising Action:** The tool generates a short English story displayed in an editable text area with a Proceed to Translation button. RT tweaks one sentence — editing revokes the implicit approval, requiring a fresh Proceed click. He proceeds. The M2 agentic pipeline runs with progress visible. The final JSON arrives in the output textarea.

**Climax:** RT reviews and saves using the same flow as Journey 1.

**Resolution:** From topic idea to verified story JSON without writing English source content from scratch.

---

### Journey 4: Community Author — Public Web UI (v2, for context)

**Persona:** Yuki — a Japanese language teacher at a UK university.

**Opening Scene:** Yuki logs in to the nihonnohon story-sharing hub and opens Create a Story. The interface is the same generation pipeline as v1, deployed publicly with authentication.

**Rising Action:** She enters a topic prompt, selects "Genki II Ch.12", generates an English proposal, approves it, and triggers translation. The output arrives. She switches to story preview mode, which renders the story as it appears in the nihonnohon reader — furigana, word tap interactions, info panel. She can also load an existing story JSON for editing.

**Climax:** She submits to the community hub. The story enters a moderation queue before appearing in the shared library with her attribution.

**Resolution:** A Genki II reading passage contributed without touching JSON. Preview mode gave her confidence before submission.

---

### Journey Requirements Summary

| Capability | Journeys | Milestone | Layer |
|-----------|---------|-----------|-------|
| English story text area | 1, 2 | M1 | Frontend |
| Chapter difficulty selector | 1, 2, 3 | M1 | Frontend |
| Optional steering instructions panel | 1, 2, 3 | M1 | Frontend |
| Pre-flight input validation | 1, 2, 3 | M1 | Frontend |
| Generate button + AG-UI progress indicator | 1, 2, 3 | M1 | Frontend |
| Generation cancellation (Generate → Stop) | 1, 2, 3 | M1 | Frontend |
| LLM timeout → recoverable error state | 1, 2, 3 | M1 | Frontend |
| Backend health monitoring | 1, 2, 3 | M1 | Frontend + Backend |
| Backend JSON syntax + parallel array check before response | 1, 2 | M1 | Backend |
| LLM-generated `id` (textbook+chapter + content summary) | 1, 2, 3 | M1 | Backend |
| Output JSON in editable textarea | 1, 2 | M1 | Frontend |
| Client-side validation on Save: JSON syntax + semantic rules | 1, 2, 3 | M1 | Frontend |
| Validation failure: human-readable, sentence-level report | 2 | M1 | Frontend |
| `id` validated as legal filename; download blocked on failure | 1, 2, 3 | M1 | Frontend |
| Browser file download as `{id}.json` (UTF-8, no BOM) + toast | 1, 2, 3 | M1 | Frontend |
| Client-side session state restore on reload | 1 | M1 | Frontend |
| Clear button (resets all + session state, no confirmation) | 1, 2, 3 | M1 | Frontend |
| Re-run from original inputs (not textarea) | 2 | M1 | Frontend |
| Re-run confirmation when manual edits exist | 2 | M1 | Frontend |
| Grammar verification agent (per sentence, backend only) | 1, 2, 3 | M2 | Backend (ADK ReAct) |
| All LLM quality checks pass before output reaches UI | 1, 2, 3 | M2 | Backend (ADK ReAct) |
| Topic/prompt input mode (Path B) | 3 | M3 | Frontend |
| English proposal in editable text area + approval gate | 3 | M3 | Frontend |
| Proceed to Translation action | 3 | M3 | Frontend |
| Load existing JSON for editing | 4 | v2 | Frontend |
| Story preview mode (nihonnohon render) + JSON toggle | 4 | v2 | Frontend |
| Per-sentence regeneration UI | 4 | v2 | Backend + Frontend |
| User authentication | 4 | v2 | Backend + Frontend |
| Community submission + moderation | 4 | v2 | Backend + Frontend |

## Domain-Specific Requirements

### Curriculum Standards

- `genki1vocab.csv` and `Genki_grammar_for_AI_generation.csv` are the authoritative source for calibration. A story is considered calibrated to chapter N if the LLM has been grounded with the cumulative Ch.1–N vocab and grammar lists.
- No formal mechanical verification of calibration beyond the LLM and validation suite. Pedagogical quality is validated by RT's editorial review in v1 and by user feedback in v2.
- The `difficulty` field must follow `"Genki I Ch.N"` / `"Genki II Ch.N"` convention exactly — both a curriculum standard and a functional requirement for the nihonnohon library filter.

### LLM API Security

- The Gemini API key is stored in a `.env` file in `apps/story-generator/`, loaded at backend startup via `python-dotenv`. The `.env` file is gitignored and never committed.
- The frontend communicates only with the local Python backend — the API key is never exposed to the browser.
- For v2 (Cloud Run deployment), the API key is injected as an environment variable or via Google Secret Manager. No application code changes required for this transition.

### Content Provenance

- Path A assumes the English source story is original content or appropriately licensed. The tool does not verify this. Content provenance is the author's responsibility.
- A one-line note near the English input field informs authors of this responsibility.

### Content Moderation (v2 only)

- Community-submitted stories enter a moderation queue before appearing in the shared library. Criteria and tooling are out of scope for v1; specified in the v2 PRD.

### Accessibility (v2 only)

- The public web interface targets WCAG 2.1 AA compliance. v1 is a local single-user tool — no accessibility standard mandated, though semantic HTML is expected.

## Innovation & Novel Patterns

### Detected Innovation Areas

**Curriculum-grounded LLM generation.** Rather than approximating difficulty with a vague level label, the tool provides the LLM with the actual Genki vocabulary and grammar the learner has studied — chapter by chapter, cumulatively — as grounding reference data. Calibration is achieved through explicit data injection, not LLM heuristics. No existing Japanese content generation tool applies curriculum data at this granularity.

**Schema-native structured content generation.** The output must satisfy strict inter-field constraints: three parallel arrays per sentence of equal length, grammar indices valid against a story-level array, vocab keys resolved against a reference CSV. Generating this via Pydantic-mapped Gemini structured output and validating it at both generation time (backend) and save time (frontend, post-edit) is a novel application of constrained LLM output for a domain-specific artifact format.

**Two-phase calibration architecture.** M1 (prompt-grounded: fast, integration baseline) and M2 (tool-call grounded: agents programmatically verify each word and grammar point) are designed as an explicit upgrade path with an identical output contract. This pattern — separating "good enough to integrate" from "reliable enough at scale" — is a reproducible model for AI content generation product development.

### Market Context & Competitive Landscape

No tool offers the complete pipeline of English source → Genki-chapter-calibrated Japanese → validated structured JSON for developer consumption (evaluated May 2026). Existing tools occupy adjacent niches: fixed human-authored catalogues (Satori Reader, Tadoku), native text simplifiers (Lenguia, LingQ), or grammar SRS without reading content (BunPro). The intermediate plateau (Genki II / JLPT N4–N3) is the most under-served difficulty band in the market.

### Validation Approach

- **M0 spike:** Single Gemini API call validates core schema generation feasibility before any UI investment
- **M1 validation:** RT's editorial review of generated stories; correction rate tracked informally
- **M2 validation:** Correction rate compared against M1 baseline; grammar verification agent provides machine-checkable calibration evidence per sentence
- **Ongoing:** User feedback on story quality and difficulty accuracy via the nihonnohon app

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Gemini structured output fails parallel array parity reliably | M0 spike surfaces this before M1 investment; backend validation catches any failure before output reaches user |
| M1 calibration quality insufficient for real use | M2 tool-call grounding is a designed upgrade path; identical output contract means no UI changes required |
| Google ADK API surface changes between M1 and M2 | ADK usage confined to backend; frontend AG-UI event contract is stable; upgrade is backend-only |

## Web App Specific Requirements

### Project-Type Overview

The Story Authoring Tool is a single-page application (React/Vite) sharing the same frontend stack as the nihonnohon reader (`apps/web`). In v1 it is a local-only tool accessed via `localhost` — no public deployment, no SEO, no mobile requirements. In v2 it is deployed to Vercel as a public web app; responsive design and accessibility become relevant at that point.

### Technical Architecture

**Rendering:** Single-page application. All UI state managed client-side. No server-side rendering required.

**Browser support:** Modern browsers only (Chrome, Firefox, Safari — current and one prior major version). No legacy browser support.

**Frontend-backend communication:** The frontend uses the **AG-UI (Agent-User Interaction) protocol** — streaming agent events (tool calls, intermediate results, state changes, final output) from the ADK agent server to the React frontend via SSE or WebSocket. This enables meaningful progress feedback: M1 streams token generation, M2 streams individual ReAct agent steps. The backend is packaged using the ADK `api_server` command, exposing the ADK agent as a containerised API server compatible with Cloud Run for v2 without code changes.

*Note: AG-UI is a newer protocol with a stabilising spec. This is a deliberate technology choice made with awareness of ecosystem maturity risk, acceptable for a local solo tool.*

**Backend:** Python, ADK agent server (`api_server`). Runs locally on a configured port. React frontend served via Vite dev server in development.

**Progress indicator:** Appears immediately on Generate/Re-run. Shows live AG-UI event stream. When the final response arrives, the progress bar animates quickly to 100% then vanishes. On 60s timeout, replaced by error state with Retry button. Performance targets are specified in NFR1–NFR4.

### Responsive Design & Accessibility

- **v1:** Desktop layout only. No breakpoints. Semantic HTML expected.
- **v2:** Responsive layout and WCAG 2.1 AA required. Specifications deferred to v2 PRD.

### Implementation Considerations

- Frontend lives within `apps/story-generator/` directory structure, excluded from `pnpm-workspace.yaml`
- Shared Tailwind design tokens and shadcn/ui patterns from `apps/web` reused where practical
- No offline/PWA support — the tool requires a live backend and active Gemini API connection

## Functional Requirements

### Story Input & Configuration

- **FR1:** Author can provide English prose as the source for story generation
- **FR2:** Author can specify a target Genki difficulty level by chapter
- **FR3:** Author can initiate story generation from the provided inputs
- **FR4:** Author can clear all current inputs, output, and session state in a single action
- **FR5:** System restores the most recent session (inputs and generated output) when the tool is reopened, using client-side storage only
- **FR6:** Author can provide a topic description as an alternative to a full English story *(M3)*
- **FR46:** Author can optionally provide additional steering instructions to further direct the LLM's output; these instructions are submitted alongside the source story and calibration data *(M1 — collapsible panel with hint text)*
- **FR50:** System validates that required inputs are present and within acceptable bounds before initiating a generation request

### Story Generation

- **FR7:** System generates a complete, curriculum-calibrated Japanese story from an English source story
- **FR8:** System generates an English story from a topic description as a reviewable intermediate step *(M3)*
- **FR9:** System indicates that generation is in progress and has not stalled
- **FR10:** System handles generation failure gracefully, preserving all author inputs and offering retry
- **FR11:** System generates a unique story identifier that embeds the textbook, chapter, and content context
- **FR12:** System performs server-side structural validation of the generated output before returning it to the author
- **FR13:** System applies a grammar verification check to confirm each sentence uses the grammar points annotated for it *(M2)*
- **FR14:** System ensures FR12 and FR13 both pass before presenting generated output to the author *(M2)*
- **FR47:** Author can cancel an in-progress story generation; the generation trigger transitions to a stop action while generation is running, and cancellation preserves all inputs
- **FR48:** System verifies backend connection on page load, flags unavailability when no response is received within a reasonable timeout, retries periodically when unavailable, and re-verifies at regular intervals when healthy
- **FR51:** System reports LLM API errors, network failures, and backend errors to the author with sufficient context to understand the failure

### Curriculum Calibration & Reference Data

- **FR15:** System applies a cumulative vocabulary ceiling — only Genki vocabulary from chapters 1 through the target chapter is used in generation
- **FR16:** System applies a cumulative grammar ceiling — only grammar patterns introduced by the target chapter are used in generation
- **FR17:** System assigns a consistent unique key to vocabulary not present in the Genki reference list and records it in the story's supplemental vocabulary
- **FR18:** System ensures supplemental vocabulary keys are consistent between supplemental vocabulary entries and sentence-level vocabulary key references

### Output Review & Editing

- **FR19:** Author can review the complete generated story output
- **FR20:** Author can manually edit the generated story output
- **FR21:** Author can re-run story generation from the original inputs, replacing the current output
- **FR22:** System notifies the author before re-running generation when unsaved manual edits exist in the output
- **FR23:** Author can review and edit an English story proposal before proceeding to translation *(M3)*
- **FR24:** System requires the author to explicitly confirm the English proposal before proceeding to translation, and revokes confirmation if the proposal is subsequently edited *(M3)*

### Output Validation

- **FR25:** System validates that the output is syntactically valid JSON before download
- **FR26:** System validates that the words, ruby, and vocab\_keys arrays are equal in length for every sentence
- **FR27:** System validates that all grammar index values reference valid positions within the story-level grammar list
- **FR28:** System validates that all vocab\_key integer values reference an entry in either the Genki vocabulary list or the story's supplemental vocabulary
- **FR29:** System validates that the difficulty field follows the required textbook and chapter format
- **FR30:** System validates that the schema\_version field contains the required value
- **FR31:** System validates that all required story and sentence fields are present
- **FR32:** System validates that the story identifier is suitable for use as a file name
- **FR33:** System reports validation failures with sufficient detail for the author to identify and correct the specific issue, including the affected sentence where applicable
- **FR34:** System prevents file download until all validation checks pass

### File Download

- **FR35:** Author can download the validated story as a file named after the story identifier
- **FR36:** System encodes downloaded story files in UTF-8 without a byte-order mark

### Security & Configuration

- **FR37:** System accesses LLM APIs using a credential stored in the local environment, not transmitted to or accessible from the browser
- **FR38:** The tool informs the author that English source material must be original or appropriately licensed
- **FR49:** Every generated story sentence includes a stable unique identifier that persists through any agent-driven corrections

### Community Authoring *(v2)*

- **FR39:** Community author can authenticate to access the authoring interface *(v2)*
- **FR40:** Community author can preview how a generated story will render in the nihonnohon reader *(v2)*
- **FR41:** Community author can switch between raw JSON view and rendered story preview *(v2)*
- **FR42:** Community author can load an existing story JSON file for editing and re-generation *(v2)*
- **FR43:** Community author can submit a completed story to the community library for review *(v2)*
- **FR44:** Moderator can review and approve or reject submitted stories before they are published *(v2)*
- **FR45:** System attributes published community stories to the author who submitted them *(v2)*

## Non-Functional Requirements

### Performance

- **NFR1:** LLM generation requests complete within 60 seconds; requests exceeding this threshold enter a timeout error state with retry available
- **NFR2:** The first AG-UI progress event is received by the frontend within 3 seconds of a generation request being initiated; if not received within this window, the backend health check is triggered
- **NFR3:** All UI interactions (button activation, textarea input, client-side validation on Save) complete within 200ms as perceived by the author
- **NFR4:** Backend health check responds within 5 seconds; absence of response within this window is treated as unavailable

### Security

- **NFR5:** The Gemini API key is never transmitted to or logged by the frontend; it is accessed only by the backend process via environment variable
- **NFR6:** The `.env` file containing the API key is excluded from version control at the repository level
- **NFR7:** The v1 tool stores no user data on any server; all session state is client-side only *(v2: all user data encrypted in transit via TLS; authentication required before any generation request)*

### Reliability

- **NFR8:** A generation failure (LLM timeout, API error, network loss) must not alter or clear the author's inputs; the tool must return to an input-ready state after any failure
- **NFR9:** If client-side storage is unavailable or at capacity, the tool degrades gracefully — session restore fails silently without blocking the tool from operating
- **NFR10:** Backend connection status is re-evaluated at a maximum interval of 60 seconds when the connection is healthy; a single failed health check is sufficient to flag the connection as lost

### Output Integrity

- **NFR11:** Every story file produced by the tool must pass validation by `loadStory()` from `@nihonnohon/story-loader` without modification
- **NFR12:** Every story file must conform to `story.v1.json` (JSON Schema Draft-07) with `additionalProperties: false` enforced at every object node
- **NFR13:** Generated story files are encoded as UTF-8 without byte-order mark

## Project Scoping & Phased Development

### MVP Strategy

**MVP Approach:** Problem-solving MVP — the minimum that produces one valid, renderable story and unblocks the nihonnohon v1 public launch. M0 + M1 together constitute the MVP. M1 is not feature-complete as a product; it is complete as a launch enabler.

**Resource requirements:** RT solo throughout M0–M3. v2 may involve collaborators for infrastructure, frontend polish, and community operations.

### M0 — Feasibility Spike

**Goal:** Validate core technical assumption before any UI investment.

- Python script: single Gemini API call with a known English story + Genki chapter context
- Pydantic model mapping to `story.v1.json` schema
- Output validated via `jsonschema` and loaded via `loadStory()` from `@nihonnohon/story-loader`
- Prompt engineering and Pydantic model structure iterated here

**Gate:** Output passes schema validation and renders in the nihonnohon reader. If this fails, M1 scope is reconsidered before any UI work begins.

### M1 — Local MVP

**Core user journeys:** Journey 1 (Path A success), Journey 2 (edit/re-run recovery).

**Must-have capabilities:**
- React/Vite SPA + ADK `api_server` Python backend, AG-UI protocol
- English story text area, Genki chapter selector, optional steering panel, Generate button
- Pre-flight input validation; 60-second timeout with Retry; generation cancellation (Generate → Stop)
- Backend health monitoring on load + 60s re-verification
- Prompt-grounded calibration: `genki1vocab.csv` + `Genki_grammar_for_AI_generation.csv` in system prompt
- Pydantic-mapped Gemini structured output; backend validates JSON syntax + parallel arrays before returning
- LLM-generated `id` field (textbook+chapter + content summary)
- Editable JSON output textarea; Re-run from original inputs with edit-warning prompt
- Client-side validation on Save: JSON syntax + full semantic rule suite; download blocked until all pass
- Browser file download as `{id}.json` (UTF-8, no BOM) + download toast
- Client-side session state restore on reload; Clear button (resets all, no confirmation)
- `.env` file for Gemini API key (gitignored); content provenance note in UI

**Gate:** One valid story generated and downloaded in under 5 minutes. nihonnohon v1 launches.

### M2 — ReAct Agentic Workflow

**Core user journeys:** Journey 1 + 2 (same UI, improved backend quality).

**Must-have capabilities:**
- RT-built ReAct agentic workflow using Google ADK; lighter Gemini model (TBD at M2 start)
- Tool-call grounded calibration: agents explicitly look up vocab chapter membership and available grammar points
- Grammar verification agent: confirms each sentence uses its annotated grammar points (backend only)
- Agent loop validates and corrects before any output is returned to the UI
- `sentence.id` used internally by agents for targeted sentence correction; no per-sentence UI in M2
- Identical output contract and UI to M1

**Gate:** RT's editorial review finds fewer semantic errors per story than M1 baseline.

### M3 — Story Generation (Path B)

**Core user journeys:** Journey 3 (topic → English proposal → translation).

**Must-have capabilities:**
- Topic/prompt input mode (Path B)
- English story generation step; proposal displayed in editable text area with approval gate
- Approval state tied to content (edit revokes until Proceed clicked again)
- Proceed to Translation feeds M2 pipeline; same Save/download flow as M1

### v2 — Community Deployment

**Core user journeys:** Journey 4 (community author).

**Must-have capabilities:**
- Backend on Google Cloud Run; frontend on Vercel
- User authentication; story preview mode (nihonnohon render); toggle JSON / preview
- Load existing story JSON for editing; per-sentence regeneration UI
- Community submission + moderation queue; story attribution; WCAG 2.1 AA
- Content moderation criteria and tooling (spec in v2 PRD)

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| M0 fails — Gemini cannot reliably produce schema-valid parallel arrays | Prompt engineering and Pydantic model iterated at M0; M1 UI work deferred until spike passes |
| AG-UI ecosystem immaturity | Confined to frontend-backend communication layer; fallback to HTTP fetch is a localised change |
| ADK API churn between M1 and M2 | ADK confined to backend; AG-UI event contract is stable; upgrade is backend-only |
| Gemini API cost at scale in M2/M3 agentic loops | Estimate cost per story before M2 begins; lighter model in M2 partially mitigates |
| Single developer | Sequential milestones with explicit gates; no parallel workstreams required |
