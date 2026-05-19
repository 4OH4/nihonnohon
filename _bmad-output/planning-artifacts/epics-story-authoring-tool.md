---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
status: complete
inputDocuments:
  - "_bmad-output/planning-artifacts/prd-story-authoring-tool.md"
  - "_bmad-output/planning-artifacts/architecture-story-authoring-tool.md"
  - "_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md"
  - "docs/adr/004-agui-event-types.md"
---

# Story Authoring Tool - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Story Authoring Tool, decomposing requirements from the PRD, Architecture, UX Design, and ADR-004 into implementable stories.

---

## Requirements Inventory

### Functional Requirements

**Story Input & Configuration**

- FR1: Author can provide English prose as the source for story generation
- FR2: Author can specify a target Genki difficulty level by chapter
- FR3: Author can initiate story generation from the provided inputs
- FR4: Author can clear all current inputs, output, and session state in a single action
- FR5: System restores the most recent session (inputs and generated output) when the tool is reopened, using client-side storage only; session state is keyed by mode
- FR46: Author can optionally provide additional steering instructions submitted alongside the source story and calibration data *(M1 — collapsible panel with hint text)*
- FR50: System validates that required inputs are present and within acceptable bounds before initiating a generation request
- FR52: Author can switch between "Convert a story" mode (Path A) and "Generate from topic" mode (Path B) using a mode selector; switching mode clears generated output; unsaved manual edits trigger inline confirmation *(M1 for mode selector; Path B functionality gated on M3)*
- FR53: Author can configure LLM generation temperature via a slider in the settings panel *(M1)*
- FR54: Author can configure grammar point distribution using a three-position control in the settings panel *(M1)*

**Story Generation**

- FR7: System generates a complete, curriculum-calibrated Japanese story from an English source story
- FR9: System indicates that generation is in progress and has not stalled
- FR10: System handles generation failure gracefully, preserving all author inputs and offering retry
- FR11: System generates a unique story identifier that embeds the textbook, chapter, and content context
- FR12: System performs server-side structural validation (JSON syntax + parallel array parity) of the generated output before returning it
- FR47: Author can cancel an in-progress story generation; the generation trigger transitions to a stop action; cancellation preserves all inputs
- FR48: System verifies backend connection on page load, flags unavailability, retries periodically, and re-verifies at regular intervals when healthy
- FR51: System reports LLM API errors, network failures, and backend errors with sufficient context to understand the failure

**Story Generation — M2**

- FR13: System applies a grammar verification check to confirm each sentence uses the grammar points annotated for it *(M2)*
- FR14: System ensures FR12 and FR13 both pass before presenting generated output to the author *(M2)*

**Story Generation — M3**

- FR6: Author can provide a topic description as an alternative to a full English story *(M3)*
- FR8: System generates an English story from a topic description as a reviewable intermediate step *(M3)*
- FR55: In Generate from topic mode, author can specify a target story length using preset options (Short ~100w / Medium ~250w / Long ~400w) or a custom numeric value (max 1000w) *(M3)*
- FR56: In Generate from topic mode, author can request a backend-generated topic suggestion for the selected Genki chapter; empty field → immediate replacement; has-content → inline confirmation before replacing *(M3)*

**Curriculum Calibration & Reference Data**

- FR15: System applies a cumulative vocabulary ceiling — only Genki vocabulary from Ch.1 through the target chapter is used in generation
- FR16: System applies a cumulative grammar ceiling — only grammar patterns introduced by the target chapter are used
- FR17: System assigns a consistent unique key to vocabulary not present in the Genki reference list and records it in the story's supplemental vocabulary
- FR18: System ensures supplemental vocabulary keys are consistent between supplemental vocabulary entries and sentence-level vocabulary key references

**Output Review & Editing**

- FR19: Author can review the complete generated story output
- FR20: Author can manually edit the generated story output
- FR21: Author can re-run story generation from the original inputs, replacing the current output
- FR22: System notifies the author before re-running generation when unsaved manual edits exist in the output
- FR23: Author can review and edit an English story proposal before proceeding to translation *(M3)*
- FR24: Author initiates Japanese conversion by clicking "Convert to Japanese"; this click is the confirmation gesture; clicking starts conversion with current draft content *(M3)*

**Output Validation**

- FR25: System validates that the output is syntactically valid JSON before download
- FR26: System validates that the words, ruby, and vocab_keys arrays are equal in length for every sentence
- FR27: System validates that all grammar index values reference valid positions within the story-level grammar list
- FR28: System validates that all vocab_key integer values reference an entry in either the Genki vocabulary list or the story's supplemental vocabulary
- FR29: System validates that the difficulty field follows the required textbook and chapter format
- FR30: System validates that the schema_version field contains the required value
- FR31: System validates that all required story and sentence fields are present
- FR32: System validates that the story identifier is suitable for use as a file name
- FR33: System reports validation failures with sufficient detail for the author to identify and correct the issue, including the affected sentence where applicable
- FR34: System prevents file download until all validation checks pass

**File Download**

- FR35: Author can download the validated story as a file named after the story identifier
- FR36: System encodes downloaded story files in UTF-8 without a byte-order mark

**Security & Configuration**

- FR37: System accesses LLM APIs using a credential stored in the local environment, not transmitted to or accessible from the browser
- FR38: The tool informs the author that English source material must be original or appropriately licensed
- FR49: Every generated story sentence includes a stable unique identifier that persists through any agent-driven corrections

**Community Authoring — v2 (out of scope for v1 epics)**

- FR39–FR45: Authentication, preview, JSON/preview toggle, load existing, submit, moderate, attribute *(v2)*

---

### Non-Functional Requirements

- NFR1: LLM generation requests complete within 60 seconds; requests exceeding this threshold enter a timeout error state with retry available
- NFR2: First AG-UI progress event received by the frontend within 3 seconds of a generation request; if not received, backend health check triggered
- NFR3: All UI interactions (button activation, textarea input, client-side validation on Save) complete within 200ms as perceived by the author
- NFR4: Backend health check responds within 5 seconds; absence of response within this window treated as unavailable
- NFR5: The Gemini API key is never transmitted to or logged by the frontend; accessed only by the backend process via environment variable
- NFR6: The .env file containing the API key is excluded from version control at the repository level
- NFR7: v1 stores no user data on any server; all session state is client-side only
- NFR8: A generation failure must not alter or clear the author's inputs; the tool returns to an input-ready state after any failure
- NFR9: If client-side storage is unavailable or at capacity, the tool degrades gracefully without blocking operation
- NFR10: Backend connection status re-evaluated at a maximum interval of 60 seconds when healthy; a single failed health check flags the connection as lost
- NFR11: Every story file produced by the tool must pass validation by `loadStory()` from `@nihonnohon/story-loader` without modification
- NFR12: Every story file must conform to `story.v1.json` (JSON Schema Draft-07) with `additionalProperties: false` enforced at every object node
- NFR13: Generated story files are encoded as UTF-8 without byte-order mark
- NFR14: Suggest-topic requests (`POST /suggest-topic`) complete within 10 seconds; frontend applies 300ms debounce; backend enforces 2-second per-session cooldown *(M3)*

---

### Additional Requirements

_Technical requirements from Architecture and ADR-004 that directly affect epic and story scope._

**Pre-M1 prerequisites (must be completed before Story 1 implementation begins):**

- ARCH-1: AG-UI event-type contract is committed to `docs/adr/004-agui-event-types.md` *(done — accepted 2026-05-15)*
- ARCH-2: `apps/story-generator` must be added to `pnpm-workspace.yaml` before any frontend package installation
- ARCH-3: `docs/adr/003-story-generator-out-of-scope.md` must be updated to reference `apps/story-generator-backend/` as the excluded Python project
- ARCH-4: `story.v1.json` must have the `key` property added to `vocab_supplement` entries before M1 implementation *(done)*
- ARCH-5: `genki1vocab.csv` must have a hardcoded numeric ID column added as first column before M1 relies on it *(done)*
- ARCH-6: `Genki_grammar_for_AI_generation.csv` must be validated against the Genki textbook before M1 relies on it
- ARCH-7: Test harness scaffolded before M1 story implementation: `apps/story-generator/vitest.config.ts`, `apps/story-generator-backend/tests/__init__.py`, `tests/test_contract.py` (cross-language contract test calling `loadStory()`)

**State machine and data contracts:**

- ARCH-8: Single Zustand store (`authoringStore.ts`) with explicit phase state machine: `idle → generating → cancelling / output-clean → output-dirty → downloading / error / proposal`
- ARCH-9: `outputIsDirty` is a one-way latch — resets only on `clear()` or completed `generate()`, not by string comparison
- ARCH-10: localStorage session state includes a `version: 1` field; version mismatch or stale generation phases (`generating`, `cancelling`, `downloading`) → treat as crashed, restore to `output-clean` if `outputJson` present else `idle`
- ARCH-11: Client-generated UUID assigned as `runId` when `useAgUiRun` initiates SSE connection; eliminates cancel-timing race; passed as query param on `/run_sse`

**AG-UI event contract (from ADR-004):**

- ARCH-12: Backend emits exactly five event types: `RUN_STARTED`, `TEXT_MESSAGE_CHUNK`, `RUN_FINISHED` (with `resultType: 'story' | 'proposal'`), `ERROR`, `RUN_CANCELLED`
- ARCH-13: `TEXT_MESSAGE_CHUNK` events accumulate in a hook-internal buffer only; complete assembled string committed atomically to `outputJson` store on `RUN_FINISHED` — partial JSON never surfaces to the output textarea
- ARCH-14: Unexpected stream close without `RUN_FINISHED` is treated as a network drop → `phase: 'error'` with `errorCode: 'BACKEND_UNAVAILABLE'`; never treated as successful completion
- ARCH-15: Cancellation is `POST /cancel/{runId}` with `{ "type": "CANCEL", "runId": "..." }` body

**Infrastructure and tooling:**

- ARCH-16: Pydantic models in `models.py` are auto-generated from `story.v1.json` via `make generate-models` (`datamodel-codegen`); `models.py` is never hand-edited; `make generate-models` must run in CI on any schema change
- ARCH-17: CSV files (`genki1vocab.csv`, `Genki_grammar_for_AI_generation.csv`) loaded once at backend startup into frozen dataclasses; path resolved from `DATA_DIR` env var (default: `../../resources/` relative to backend root)
- ARCH-18: Vite dev proxy in `vite.config.ts` forwards `/run_sse`, `/cancel`, `/health` to port 8000; `apps/story-generator` on port 5174 (avoids conflict with `apps/web` on 5173)
- ARCH-19: CORS driven by `ALLOWED_ORIGIN` env var (default: `http://localhost:5174`); health endpoint excluded from CORS restrictions
- ARCH-20: `Makefile` targets: `dev` (port-guard + starts both processes), `generate-models`, `test`

**M0 gate:**

- ARCH-21: M0 feasibility spike — Python script, single Gemini call, Pydantic structured output — must pass `jsonschema` validation and `loadStory()` before any M1 UI work begins; if spike fails, M1 scope reconsidered

---

### UX Design Requirements

_Actionable component and interaction requirements from the UX Design Specification._

**Custom components to implement:**

- UX-DR1: `ModeToggle` — segmented pill control; "Convert a story" | "Generate from topic"; `role="tablist"` / `role="tab"` / `aria-selected`; arrow key navigation; switching clears generated output; if `outputIsDirty`, shows inline warning before switching
- UX-DR2: `ScopeChip` — shows cumulative vocab count + grammar count + key grammar highlights for selected Genki chapter; hardcoded lookup table in M1; `accent-subtle` bg + `accent` border; updates immediately on chapter change; hidden when no chapter selected; text in `font-ja`
- UX-DR3: `GenerationProgress` — unified progress surface; always mounted, `height: 0 / overflow: hidden` when idle (no layout shift); M1 and M2: 3px shimmer (`background-position` CSS animation) + elapsed time counter; M2 adds a single `<p>` status text line below the shimmer that updates on each `AGENT_STATUS` event (absent in M1); `aria-live="polite"` on status text; `aria-label="Generation progress"` on container
- UX-DR4: ~~`AgentStepRow`~~ — **removed**; M2 does not surface sentence-level agent steps in the UI
- UX-DR5: `JsonOutput` — monospace (`font-mono`) line-numbered display via `<pre>` + CSS `counter-increment`; 44px line gutter (`user-select: none`); error-line state (red tint); `min-h-[300px]`, fixed height with internal scroll; if inline editing becomes first-class, replace with CodeMirror — do not build a line-numbered textarea hybrid
- UX-DR6: `ValidationErrorList` — `role="alert"`; error-coloured header ("N validation errors — download blocked"); one row per error: rule badge (red pill) + JSON path (monospace) + plain-prose message; validation pipeline order: `json-parse` → `schema-version` + `required-fields` → `parallel-arrays` → `vocab-keys` + `grammar-indices` + `id-filename`; bails after `json-parse` failure
- UX-DR7: `InputSection` — shadcn `Collapsible` wrapper for all generation inputs; collapses on generation start with `storedInputs` snapshot taken; "Edit inputs" ghost button re-expands without clearing content; collapsed view shows: mode label + scope pill + truncated input preview
- UX-DR8: `TopicTextarea` (M3) — topic input with overlay button; `position: relative` wrapper + `<textarea>` with `padding-bottom: 40px` + `position: absolute; bottom: 8px; right: 8px` button; empty state: "✦ Suggest a topic" button; has-content state: "Replace topic" button (accent border); button transitions to spinner (`aria-busy="true"`, `pointer-events: none`) during request without unmounting or shifting layout
- UX-DR9: `SuggestConfirm` (M3) — inline amber confirmation strip (`accent-subtle` bg, `accent` border); `role="alert"`; message states consequence not question; focus moves to confirm button on appearance; Escape triggers Cancel; Generate button disabled while confirmation pending
- UX-DR10: `StatsBar` — "N sentences · N vocab items · N grammar patterns" in `muted` text; counts derived from the final output JSON; hidden pre-generation; appears with output, persists through review session
- UX-DR11: ~~`AuditSummary`~~ — **removed**; M2 does not produce a post-generation audit summary strip
- UX-DR12: `RerunWarning` — inline amber strip below Re-run button when `outputIsDirty`; consequence-labelled buttons: "Discard my edits and Re-run" / "Cancel"; `role="alert"`; React state-driven (never `window.confirm`); focus moves to confirm button; Escape triggers Cancel
- UX-DR13: `BackendStatus` — app bar status dot (8px) + label text; states: Connected (green dot + "Backend connected") / Unavailable (amber dot + "Backend unavailable"; Convert/Generate disabled) / Checking (pulsing grey dot + "Checking…"); `aria-live="polite"` on label text; health check on load, 60s poll when healthy, 10s poll when unavailable
- UX-DR14: `SettingsPanel` — shadcn `Sheet` sliding from right (does not displace main layout); temperature slider + numeric readout (`<input type="range">` + text input pair); grammar distribution 3-position slider (`min=0 max=2 step=1`, native snapping) with reactive hint text; story length presets (Short/Medium/Long/Custom) + numeric input (M3, disabled in Convert mode with 38% opacity + hint); settings persist in `storedInputs` and restore with session
- UX-DR15: `SessionRestoreBanner` — appears at top of input section when a completed session is restored from localStorage; "Restored from previous session · [Clear]"; dismisses on first edit

**Layout and interaction patterns:**

- UX-DR16: Page layout — `max-w-[860px] mx-auto` tool shell; `surface` background (not `paper-bg`); all major sections always mounted in DOM; visibility and weight controlled by CSS state (height, opacity) — not conditional rendering — to prevent layout shift during generation cycle
- UX-DR17: Button hierarchy — Primary (`accent` fill, white text): Convert to Japanese / Generate / Save & Download; Secondary (`surface` fill, `border` border): Re-run / Clear / Regenerate / Cancel; Stop/Destructive (`surface` fill, `error` border + text): Stop / "Discard my edits and Re-run"; Ghost (`accent` text, no bg): Edit inputs / Copy / Show log; Disabled: 45% opacity + `cursor: not-allowed`
- UX-DR18: Loading state pattern — any button triggering an async action transitions its label to a spinner; `pointer-events: none`; `aria-busy="true"`; button does not unmount or change size
- UX-DR19: Inline confirmation pattern — used only for Re-run with dirty edits (`RerunWarning`) and Replace topic with existing content (`SuggestConfirm`); amber tint; consequence-labelled confirm; never modal; `role="alert"`
- UX-DR20: Semantic HTML baseline — `<main>`, `<header>`, `<section>`, `<button>`, `<label>`, `<select>`; no `<div>` used as interactive elements; every `<input>`, `<select>`, and `<textarea>` has an associated `<label>`; focus ring via `focus-visible:ring-2 ring-accent`

---

### FR Coverage Map

```
FR1  → Epic 2 — English story textarea (StoryInputPanel)
FR2  → Epic 2 — Genki chapter selector (StoryInputPanel)
FR3  → Epic 2 — Generate button trigger (GenerateButton / authoringStore)
FR4  → Epic 2 — Clear button (ClearButton)
FR5  → Epic 2 — Session restore on load (useSession)
FR6  → Epic 3 — Topic input field (TopicTextarea, Path B)
FR7  → Epic 1 (M0 proof) → Epic 2 (full UI pipeline)
FR8  → Epic 3 — English proposal generation (Path B)
FR9  → Epic 2 — GenerationProgress component
FR10 → Epic 2 — Error state + Retry (authoringStore + GenerationProgress)
FR11 → Epic 2 — LLM-generated id field (agent.py)
FR12 → Epic 1 (M0 proof) → Epic 2 (full: validator.py + backend integration)
FR13 → Epic 4 — Grammar verification agent (agent.py M2, tools.py)
FR14 → Epic 4 — Both validation checks pass before RUN_FINISHED emitted
FR15 → Epic 1 (M0 proof) → Epic 2 (full: data_loader.py + system prompt)
FR16 → Epic 1 (M0 proof) → Epic 2 (full: grammar CSV in system prompt)
FR17 → Epic 1 (M0 proof) → Epic 2 (full: supplemental vocab key logic)
FR18 → Epic 1 (M0 proof) → Epic 2 (full: supplemental key consistency)
FR19 → Epic 2 — JsonOutput + OutputPanel
FR20 → Epic 2 — OutputPanel editable + outputIsDirty latch
FR21 → Epic 2 — Re-run from storedInputs (authoringStore.generate())
FR22 → Epic 2 — RerunWarning component
FR23 → Epic 3 — English proposal textarea review (ProposalPanel, Path B)
FR24 → Epic 3 — "Convert to Japanese" button (Path B commitment gesture)
FR25 → Epic 2 — validateStoryJson: JSON.parse check
FR26 → Epic 2 — validateStoryJson: parallel array parity
FR27 → Epic 2 — validateStoryJson: grammar index bounds
FR28 → Epic 2 — validateStoryJson: vocab_key resolution
FR29 → Epic 2 — validateStoryJson: difficulty field format
FR30 → Epic 2 — validateStoryJson: schema_version value
FR31 → Epic 2 — validateStoryJson: required fields present
FR32 → Epic 2 — validateStoryJson: id filename legality
FR33 → Epic 2 — ValidationErrorList (sentence-level errors)
FR34 → Epic 2 — Save button disabled until all checks pass
FR35 → Epic 2 — downloadStoryFile (Blob + anchor)
FR36 → Epic 2 — UTF-8 no BOM encoding in downloadStoryFile
FR37 → Epic 1 (backend .env setup) → Epic 2 (CORS config, key never in frontend)
FR38 → Epic 2 — Content provenance note in StoryInputPanel
FR46 → Epic 2 — Steering instructions collapsible (StoryInputPanel)
FR47 → Epic 2 — Stop button + POST /cancel/{runId} (useAgUiRun)
FR48 → Epic 2 — BackendStatus + useAgUiRun health pre-flight
FR49 → Epic 1 (M0 proof) → Epic 2 (full: sentence.id in Pydantic model)
FR50 → Epic 2 — Pre-flight validation before generate() (authoringStore)
FR51 → Epic 2 — Error state human-readable messages (useAgUiRun)
FR52 → Epic 2 — ModeToggle (Path B inactive; activated in Epic 3)
FR53 → Epic 2 — Temperature slider in SettingsPanel
FR54 → Epic 2 — Grammar distribution control in SettingsPanel
FR55 → Epic 3 — Story length presets in SettingsPanel (Path B only)
FR56 → Epic 3 — Suggest-topic button + POST /suggest-topic endpoint

NFR1  → Epic 2 — 60s timeout in useAgUiRun
NFR2  → Epic 2 — 3s first-event window in useAgUiRun
NFR3  → Epic 2 — Zustand synchronous state (inherent)
NFR4  → Epic 2 — 5s health check timeout in useAgUiRun
NFR5  → Epic 1 (.env setup) + Epic 2 (CORS, key never transmitted)
NFR6  → Epic 1 (.env gitignored in backend scaffold)
NFR7  → Epic 2 — localStorage-only session; no server writes
NFR8  → Epic 2 — error state preserves inputs (authoringStore)
NFR9  → Epic 2 — useSession graceful localStorage failure
NFR10 → Epic 2 — BackendStatus 60s re-check interval
NFR11 → Epic 1 (test_contract.py) + Epic 2 (validateStoryJson calls loadStory)
NFR12 → Epic 1 (test_contract.py) + Epic 2 (Pydantic model conformance)
NFR13 → Epic 1 (backend) + Epic 2 (downloadStoryFile)
NFR14 → Epic 3 — suggest-topic 10s timeout + debounce + cooldown
```

---

## Epic List

### Epic 1: Foundation & M0 Feasibility Spike

RT has a proven Python script that generates a schema-valid, curriculum-calibrated Japanese story from an English source. All pre-implementation prerequisites are complete. The project scaffold is ready for M1 UI work to begin.

**FRs covered:** FR7 (M0 proof), FR12 (M0 proof), FR15, FR16, FR17, FR18 (M0 proof), FR49 (M0 proof)
**NFRs covered:** NFR5 (partial), NFR6, NFR11, NFR12, NFR13 (via test_contract.py)
**ARCH:** ARCH-2, ARCH-3, ARCH-6, ARCH-7, ARCH-21

---

### Epic 2: M1 — Full Convert a Story Pipeline

RT can open the tool in a browser, paste an English story, select a Genki chapter, generate a Japanese story, review and edit the JSON output, validate it, and download the file — the complete end-to-end pipeline in under 5 minutes. nihonnohon v1 can launch.

**FRs covered:** FR1–5, FR7 (full), FR9–12 (full), FR15–22, FR25–38, FR46–54
**NFRs covered:** NFR1–NFR13 (full)
**UX-DRs covered:** UX-DR1–UX-DR7, UX-DR10, UX-DR12–UX-DR20
**Stories:** 9 (Story 2.5 split into SSE lifecycle + generation UI)

---

### Epic 3: M3 — Generate from Topic (Path B)

RT can generate a story from a topic description alone — no English source material required. The tool generates an English proposal for review, then converts it to Japanese using the M1 single-call pipeline. The mode selector (shipped in M1) activates fully.

**FRs covered:** FR6, FR8, FR23, FR24, FR55, FR56
**NFRs covered:** NFR14
**UX-DRs covered:** UX-DR8, UX-DR9, UX-DR14 (story length activation)

---

### Epic 4: M2 — Agentic Calibration Quality

RT gets higher-quality output — the ReAct agentic workflow verifies every sentence's vocabulary and grammar against the Genki curriculum before presenting results. The UI surfaces what the agents checked, building RT's trust in the output without requiring a separate audit interface. Undertaken after the full Path A + Path B pipeline has been validated in use.

**FRs covered:** FR13, FR14
**UX-DRs covered:** UX-DR3 (M2 status message addition)

---

## Epic 1: Foundation & M0 Feasibility Spike

RT has a proven Python script that generates a schema-valid, curriculum-calibrated Japanese story from an English source. All pre-implementation prerequisites are complete. The project scaffold is ready for M1 UI work to begin.

### Story 1.1: Project Setup & Pre-implementation Checklist

As a developer,
I want the monorepo workspace, ADRs, and curriculum reference data correctly configured,
So that M1 implementation can begin without tooling or reference-data gaps.

**Acceptance Criteria:**

**Given** `apps/story-generator` is not yet a recognised pnpm workspace member
**When** the workspace configuration is updated to include `apps/story-generator`
**Then** `pnpm install` resolves `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config` from the workspace when run from `apps/story-generator/`

**Given** `docs/adr/003-story-generator-out-of-scope.md` still references `apps/story-generator/` as the excluded Python project
**When** the ADR is updated
**Then** the ADR correctly names `apps/story-generator-backend/` as the excluded Python project and `apps/story-generator/` as a normal workspace member

**Given** `Genki_grammar_for_AI_generation.csv` has not been formally reviewed
**When** RT manually checks all grammar entries against the Genki textbook chapters
**Then** all entries are confirmed correct or corrected; the reviewed file is committed with a note confirming validation; no chapter assignments are incorrect

---

### Story 1.2: Backend Project Scaffold

As a developer,
I want the Python backend scaffolded with its complete directory structure, data loader, validator, Pydantic codegen pipeline, and test harness skeleton,
So that the M0 spike and all subsequent M1 backend stories build on a working, testable foundation.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/` does not exist
**When** the directory is created with `pyproject.toml`, `requirements.txt`, `Makefile`, `.env`, `.env.example`, and `README.md`
**Then** `pip install -r requirements.txt` installs `google-adk`, `ag-ui-protocol>=0.1.18`, `pydantic>=2.0`, `datamodel-code-generator`, `python-dotenv`, `jsonschema`; the `.env` file is gitignored; `.env.example` documents `GEMINI_API_KEY=` and `ALLOWED_ORIGIN=http://localhost:5174`

**Given** `packages/schema/schemas/story.v1.json` exists
**When** `make generate-models` is run from `apps/story-generator-backend/`
**Then** `src/story_generator/models.py` is created with Pydantic v2 models and the header `# AUTO-GENERATED from story.v1.json — do not edit manually`; the file contains a model for `vocab_supplement` entries that includes the `key` field

**Given** `resources/genki1vocab.csv` and `resources/Genki_grammar_for_AI_generation.csv` exist
**When** `load_vocab_data(path)` and `load_grammar_data(path)` are called in `data_loader.py`
**Then** both return frozen dataclasses; neither raises; the vocab map is keyed by the numeric ID column; chapter groupings are preserved

**Given** a story dict with a missing required field (e.g., `title` absent)
**When** `validate(story_dict)` is called in `validator.py`
**Then** it returns `ValidationResult(valid=False, errors=[ValidationError(code='MISSING_FIELD', message=..., sentence_index=None)])`; it never raises an exception under any input

**Given** `tests/__init__.py`, `tests/test_validator.py`, and `tests/test_contract.py` exist
**When** `make test` is run
**Then** three passing tests: (1) `validate()` returns `valid=False` on a missing required field; (2) `validate()` never raises; (3) `test_contract.py` imports and its fixture test is skipped pending Story 1.3 fixture

---

### Story 1.3: M0 Feasibility Spike

As a developer,
I want a Python script that generates a schema-valid, curriculum-calibrated Japanese story from a known English source,
So that the core technical assumption (Gemini produces schema-valid parallel arrays via Pydantic structured output) is proven before any UI investment.

**Acceptance Criteria:**

**Given** a hardcoded English source story and target chapter (e.g., "Genki I Ch.8") in a spike script or fixture
**When** the M0 spike is executed (e.g., `python -m story_generator.spike` or `make spike`)
**Then** `data_loader.py` loads both CSVs; the system prompt includes cumulative Ch.1–8 vocabulary and grammar; a single Gemini API call is made; a response is received within 60 seconds

**Given** the Gemini response arrives
**When** Pydantic structured output maps it to the generated story model
**Then** `jsonschema.validate()` against `story.v1.json` passes with no errors; `words`, `ruby`, and `vocab_keys` arrays are equal length in every sentence

**Given** the schema-valid story JSON
**When** it is written to a `.json` file (UTF-8, no BOM) and `loadStory()` is called via Node subprocess in `test_contract.py`
**Then** the subprocess is invoked with a 10-second timeout; exit code 0 is required for the test to pass; if `node` is not on PATH the test is marked `pytest.mark.skip` with message "node not available"; `loadStory()` returns a `StoryModel` without throwing; `make test` passes including the contract test

**Given** all three ACs pass
**When** the M0 gate is assessed
**Then** the spike is declared complete; no M1 UI scope changes are required; the `README.md` is updated to document how to run the spike and what output to expect

---

## Epic 2: M1 — Full Convert a Story Pipeline

RT can open the tool in a browser, paste an English story, select a Genki chapter, generate a Japanese story, review and edit the JSON output, validate it, and download the file — the complete end-to-end pipeline in under 5 minutes. nihonnohon v1 can launch.

_Note: temperature slider and session persistence are deliberate M1 features, not deferred polish. Temperature is RT's primary escape hatch during editorial review; session persistence prevents lost work during multi-story authoring sessions._

### Story 2.1: Frontend Project Scaffold, State Machine & AG-UI Hook

As a developer,
I want the React app initialised with the Zustand authoring store and AG-UI hook wired up and tested,
So that all M1 component stories build on a proven state machine and SSE foundation.

**Acceptance Criteria:**

**Given** `apps/story-generator/` does not exist
**When** the app is created from `npm create vite@latest -- --template react-ts`, Tailwind initialised, and shadcn/ui set up with the nihonnohon design tokens
**Then** `pnpm dev` starts the app at port 5174; the Vite proxy forwards `/run_sse`, `/cancel`, and `/health` to port 8000; `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config` resolve from the workspace

**Given** the store is implemented in `src/stores/authoringStore.ts`
**When** `generate()` is called from `idle` phase
**Then** `phase → 'generating'`; `runId` is set to a new UUID; `outputIsDirty` remains `false`

**Given** `useAgUiRun.ts` is implemented with an injected `createEventSource` factory
**When** a synthetic `RUN_FINISHED` (resultType='story') is emitted via `MockEventSource`
**Then** `_setOutputJson` is called with the content and `phase → 'output-clean'`; no real network call is made

**Given** `vitest.config.ts` is in place
**When** `pnpm test:unit` is run
**Then** the two seeded tests (store phase transition + hook RUN_FINISHED mapping) both pass; `pnpm typecheck` passes with no errors

---

### Story 2.2: M1 Production Backend — Agent, SSE Endpoints & Cancellation

As a developer,
I want the full M1 Python backend running with SSE generation, health, cancel endpoints, and CORS configured,
So that the frontend can connect to a real backend and complete the generate/cancel/error cycle without mocking.

**Acceptance Criteria:**

**Given** the backend is running with a valid `GEMINI_API_KEY` in `.env`
**When** `GET /health` is called
**Then** it responds 200 `{"status":"ok"}` within 5 seconds (or 503 if the key is missing/invalid)

**Given** a generation request is sent to `GET /run_sse` with `inputText`, `chapter`, `pathMode=A`, `runId`, and optional `steeringInstructions`, `temperature`, `grammar_distribution`
**When** the request is processed
**Then** the stream emits `RUN_STARTED` → zero or more `TEXT_MESSAGE_CHUNK` → `RUN_FINISHED` (resultType='story') with a complete schema-valid JSON string; `validator.validate()` is called before `RUN_FINISHED` — if validation fails, `ERROR` is emitted instead; every sentence in the output has a stable `sentence.id`; the story `id` field embeds textbook, chapter, and content context

**Given** a `POST /cancel/{runId}` is received while generation is in progress
**When** the backend handles the cancel request
**Then** the in-progress generation is terminated and `RUN_CANCELLED` is emitted on the SSE stream with the matching `runId`

**Given** `ALLOWED_ORIGIN` is set in `.env`
**When** a request arrives from that origin
**Then** CORS headers allow it; the health endpoint has no CORS restriction regardless of origin

**Given** both CSVs exist at the path resolved from `DATA_DIR`
**When** the backend starts
**Then** `data_loader.py` loads both CSVs into frozen dataclasses once at startup; no per-request file I/O

**Given** `agent.py` is implemented with an injectable Gemini client
**When** the injection seam is designed
**Then** `agent.py` accepts a `gemini_client` constructor/factory parameter; the production entry point passes the real ADK client; tests pass a mock callable that returns a pre-crafted valid JSON fixture; injection is via parameter, not environment variable or module-level patching (to preserve test isolation when tests run in parallel)

**Given** `test_agent.py` runs with the injected mock client and no `GEMINI_API_KEY` set
**When** `make test` is run
**Then** all backend tests pass; the mock verifies: system prompt includes cumulative vocab + grammar for the requested chapter; AG-UI events are emitted in order (`RUN_STARTED` → `RUN_FINISHED`); `validator.validate()` is called before `RUN_FINISHED`; an invalid mock response causes `ERROR` to be emitted instead

---

### Story 2.3: App Shell, BackendStatus, ModeToggle & SettingsPanel

As a content author,
I want to open the tool and immediately see backend status, the mode selector, and access to generation settings,
So that I know whether the tool is ready before filling in inputs.

**Acceptance Criteria:**

**Given** the app is open at `http://localhost:5174`
**When** the page loads
**Then** a `<header>` displays the app title, the `BackendStatus` indicator, and a settings gear button; the page uses `max-w-[860px] mx-auto` layout with `surface` background

**Given** the backend is reachable
**When** the health check on mount succeeds
**Then** `BackendStatus` shows a green dot + "Backend connected"; re-checks every 60 seconds; `aria-live="polite"` on the label text

**Given** the backend is unreachable
**When** the health check fails or times out (5s)
**Then** `BackendStatus` shows an amber dot + "Backend unavailable"; Convert to Japanese button is disabled; re-checks every 10 seconds; recovers automatically when backend comes back online

**Given** `ModeToggle` is rendered
**When** the user clicks "Convert a story" or "Generate from topic"
**Then** the active option has `aria-selected="true"`; switching to "Generate from topic" is a no-op beyond updating the toggle (Path B UI activates in Epic 3); switching clears any `outputJson` in the store; `role="tablist"` / `role="tab"` present

**Given** Story 2.3 is the first story to render interactive components
**When** components are implemented
**Then** this story establishes the canonical design contracts inherited by all subsequent stories: Primary button (`accent` fill, white text), Secondary button (`surface` fill, `border` border), Stop/Destructive (`error` border + text), Ghost (`accent` text, no bg), Disabled (45% opacity + `cursor: not-allowed`); loading state pattern (label → spinner, `aria-busy="true"`, `pointer-events: none`, no unmount); focus ring (`focus-visible:ring-2 ring-accent`); these are not redefined in later stories — they reference this one

**Given** the user clicks the settings gear
**When** the `SettingsPanel` Sheet opens
**Then** it slides from the right without displacing the main layout; **in-scope for this story:** temperature slider (0.0–2.0, default 1.0) with paired numeric input; grammar distribution 3-position `<input type="range" min="0" max="2" step="1">` with reactive hint text; **story length section:** visible but all controls disabled with a hint ("Available in Generate from topic mode") — controls are rendered as disabled stubs only; full story length activation is scoped to Story 4.4; closing the sheet saves in-scope values to the store

---

### Story 2.4: Input Panel, Chapter Selector & ScopeChip

As a content author,
I want to paste my English story, select a Genki chapter, and see the curriculum scope that will be applied,
So that I can confirm the correct calibration before triggering generation.

**Acceptance Criteria:**

**Given** the app is in `idle` or `error` phase
**When** the input section is visible
**Then** a labelled `<textarea>` for the English story (`min-h-[200px]`, grows to `max-h-[400px]` with overflow scroll) and a chapter `<select>` are both rendered; store `inputText` and `chapterTarget` update on every change

**Given** a Genki chapter is selected
**When** `ScopeChip` renders
**Then** it displays cumulative vocab count + grammar count + key grammar highlights for that chapter (hardcoded M1 lookup); text uses `font-ja` for Japanese content; `accent-subtle` background + `accent` border; hidden when no chapter is selected; updates immediately on chapter change

**Given** the steering instructions `Collapsible` is collapsed (default)
**When** the toggle is clicked
**Then** it expands to show a labelled `<textarea>`; store `steeringInstructions` updates; collapses again on re-click; content preserved in both states

**Given** Generate is clicked with an empty story textarea or no chapter selected
**When** pre-flight validation runs
**Then** an inline hint appears adjacent to the offending field; the generation request is not sent; the hint disappears when the field is corrected; **pre-flight checks only two conditions: non-empty story text + chapter selected** — it does not run the full 7-rule semantic validation pipeline (that runs in `save()` in Story 2.8)

**Given** the `InputSection` is rendered in Story 2.4
**When** generation has not yet started
**Then** the input section is always visible and expanded; **collapse behaviour on generation start is intentionally deferred to Story 2.6**, which owns the `InputSection` collapse as part of the generation trigger UI; Story 2.4 delivers the input form — Story 2.6 delivers the state-driven collapse

---

### Story 2.5: AG-UI SSE Lifecycle & Store Integration

As a developer,
I want the `useAgUiRun` hook to manage the full SSE lifecycle — event mapping, timeouts, and cancellation — wired to the Zustand store,
So that all generation trigger and error recovery behaviour is tested in isolation before any UI components are built on top of it.

**Acceptance Criteria:**

**Given** `generate()` is dispatched from `idle` or `error` phase
**When** `useAgUiRun` initiates
**Then** a new UUID is assigned as `runId`; `phase → 'generating'`; `createEventSource` factory is called with the correct `/run_sse` URL including `runId`, `inputText`, `chapter`, `pathMode`, `steeringInstructions`, `temperature`, `grammar_distribution` as query params

**Given** `RUN_STARTED` is received
**When** the event is processed
**Then** `phase` is confirmed as `generating`; `runId` is confirmed

**Given** `RUN_FINISHED` (resultType='story') is received
**When** the event is processed
**Then** `_setOutputJson(content)` is called with the fully assembled JSON; `phase → 'output-clean'`; `runId → null`

**Given** `RUN_CANCELLED` is received
**When** the event is processed
**Then** `phase → 'idle'`; `runId → null`; inputs preserved

**Given** no `RUN_STARTED` arrives within 3 seconds of opening the SSE connection
**When** the 3s window expires
**Then** the backend health check is triggered; if unavailable `phase → 'error'` with `errorCode: 'BACKEND_UNAVAILABLE'`

**Given** the 60-second generation timeout fires
**When** no `RUN_FINISHED` has been received
**Then** `phase → 'error'`; `errorMessage: 'This took longer than expected — your inputs are preserved. Try again.'`

**Given** the SSE stream closes without a `RUN_FINISHED` event
**When** stream close is detected
**Then** `phase → 'error'`; `errorCode: 'BACKEND_UNAVAILABLE'`; `errorMessage: 'Connection lost — your inputs are preserved. Check the backend and retry.'`

**Given** Stop is dispatched (`cancel()` action)
**When** `useAgUiRun` handles it
**Then** `phase → 'cancelling'`; `POST /cancel/{runId}` is sent with `{ "type": "CANCEL", "runId": "..." }` body; resolves to `idle` on `RUN_CANCELLED`

**Given** `generate()` is called from `error` phase (Retry)
**When** it executes
**Then** `errorCode` and `errorMessage` cleared; new `runId` assigned; `phase → 'generating'`; no `clear()` required first

**Given** `useAgUiRun.test.ts` with `MockEventSource`
**When** synthetic events are emitted
**Then** the following pass: `ERROR` event → `_setError` + `phase → 'error'`; `RUN_CANCELLED` → `phase → 'idle'`, inputs preserved; 3s timeout mock → health check triggered; 60s timeout mock → `phase → 'error'` with correct message; stream close without `RUN_FINISHED` → `BACKEND_UNAVAILABLE` error

---

### Story 2.6: Generation UI — Progress Display, Stop Button & InputSection Collapse

As a content author,
I want to see live generation progress, be able to stop generation, and have the input form collapse out of the way while the pipeline runs,
So that I can monitor what's happening and recover cleanly from any outcome.

**Acceptance Criteria:**

**Given** the app is in `idle` or `error` phase with valid inputs
**When** Generate is clicked
**Then** `InputSection` collapses (content preserved); `storedInputs` snapshot is written to store; `GenerationProgress` expands showing a "Connecting…" label; `GenerateButton` transitions to "Stop"

**Given** `RUN_STARTED` is received
**When** `GenerationProgress` updates
**Then** the 3px shimmer (CSS `background-position` animation) appears with an elapsed time counter incrementing each second; label changes to "Generating story…"

**Given** `phase === 'generating'`
**When** Stop is clicked
**Then** `GenerateButton` label → "Stopping…" (disabled, `pointer-events: none`); progress goes indeterminate (shimmer continues, elapsed time stops); `cancel()` is dispatched to the store

**Given** `phase === 'cancelling'` resolves to `idle`
**When** `RUN_CANCELLED` is received
**Then** `InputSection` re-expands with all field values intact; `GenerationProgress` collapses; `GenerateButton` resets to "Convert to Japanese"

**Given** `phase === 'error'`
**When** `GenerationProgress` renders
**Then** error message is displayed in plain English (distinct messages per `errorCode`): timeout → "This took longer than expected — your inputs are preserved. Try again."; API error → "The AI service returned an error — your inputs are preserved. Try again."; network drop → "Connection lost — your inputs are preserved. Check the backend and retry."; Retry button is visible; `InputSection` re-expands

**Given** M2 mode is active and `AGENT_STATUS` events arrive
**When** `GenerationProgress` renders
**Then** a single `<p>` status text line appears below the shimmer in `muted` colour; each new `AGENT_STATUS` event replaces the previous message; absent in M1 mode when no `AGENT_STATUS` events are emitted

**Given** `GenerationProgress` in all phases
**When** it is mounted
**Then** it is always present in the DOM; `height: 0 / overflow: hidden` in `idle` and non-active phases; no layout shift on expand/collapse

---

### Story 2.7: Output Panel, Dirty State & Re-run

As a content author,
I want to review the generated story JSON, edit it in place, and re-run generation from my original inputs,
So that I have full control over the output before committing to download.

_Note: `authoringStore.ts` phase machine was initialised in Story 2.1. The `proposal` phase required for M3 is deferred to Story 4.3 — design the phase type as a discriminated union (string literal union) so adding new phases in later stories is mechanical, not structural._

**Acceptance Criteria:**

**Given** `RUN_FINISHED` (resultType='story') is received
**When** `useAgUiRun` processes it
**Then** `_setOutputJson(content)` is called with the fully assembled JSON (never partial); `phase → 'output-clean'`; `GenerationProgress` collapses; `OutputPanel` expands

**Given** `OutputPanel` is visible
**When** `outputJson` is set
**Then** `JsonOutput` renders the JSON in a `<pre>` block with `font-mono`, CSS counter line numbers, and a `user-select: none` gutter; `min-h-[300px]` with internal `overflow-y: auto`

**Given** the user makes any edit to the output textarea
**When** the first `onChange` fires after `output-clean` is reached
**Then** `_markDirty()` is called; `phase → 'output-dirty'`; an "Unsaved edits" indicator is visible; `outputIsDirty` does not reset if the user reverts the text

**Given** `phase === 'output-clean'`
**When** Re-run is clicked
**Then** generation fires immediately from `storedInputs` (not from the textarea); new output replaces existing; `outputIsDirty` resets to `false`

**Given** `phase === 'output-dirty'`
**When** Re-run is clicked
**Then** `RerunWarning` strip appears inline below Re-run: "Re-running will replace your edits." with [Discard my edits and Re-run] / [Cancel]; `role="alert"`; React state-driven (never `window.confirm`); confirm fires generate; cancel dismisses

**Given** `authoringStore.test.ts`
**When** `_markDirty()` is called from `output-clean`
**Then** `phase → 'output-dirty'`; subsequent Re-run confirm transitions to `generating`; tests pass

---

### Story 2.8: Client-side Validation Suite, Story Download & StatsBar

As a content author,
I want to validate my story output, see a summary of its structure, and download the file when everything passes,
So that only a schema-valid, structurally correct story file ever reaches my disk and I can quickly gauge what was generated.

**Acceptance Criteria:**

**Given** `validateStoryJson.ts` is implemented
**When** `save()` is called
**Then** validation runs in pipeline order: JSON parse → schema_version + required fields → parallel array parity per sentence → grammar index bounds → vocab_key resolution (Genki list + supplemental) → difficulty format → id filename legality; bails after parse failure; returns a typed array of `ValidationError` objects (each with `{ rule: string, message: string, sentenceIndex?: number, path?: string }`) — empty array = valid

**Given** validation returns errors
**When** `ValidationErrorList` renders
**Then** `role="alert"` container; header "N validation errors — download blocked"; one row per error: rule badge (red pill, rule name as label) + JSON path (monospace) + plain-prose message; Save & Download button remains disabled; list persists until errors are resolved; `tests/fixtures/` contains one invalid fixture per rule to document the expected error shape

**Given** `save()` is called and validation passes
**When** `downloadStoryFile.ts` executes
**Then** a `Blob` is created with UTF-8 encoding and no BOM; browser download triggers as `{id}.json` via programmatic `<a>` click; `phase → 'output-clean'`; `outputIsDirty` resets to `false`; a shadcn Toast confirms "Downloaded {id}.json" (4-second auto-dismiss)

**Given** `phase` is anything other than `output-clean` or `output-dirty`
**When** Save & Download is rendered
**Then** the button is `aria-disabled` with 45% opacity and `cursor: not-allowed`

**Given** `outputJson` is set (post-generation)
**When** `StatsBar` renders above the output panel
**Then** it displays "N sentences · N vocab items · N grammar patterns" derived by parsing `outputJson`; counts come from the story structure (sentence array length, vocab_supplement + unique vocab_keys, grammar array length); hidden before any output is generated; persists through the review session

**Given** `validateStoryJson.test.ts`
**When** fixtures are validated
**Then** parallel array mismatch → `ValidationError({ rule: 'PARALLEL_ARRAY_MISMATCH', sentenceIndex: N })`; grammar index out of bounds → `ValidationError({ rule: 'GRAMMAR_INDEX_OUT_OF_BOUNDS', sentenceIndex: N })`; valid fixture passes all checks and `loadStory()` succeeds on it; all tests pass

---

### Story 2.9: Session Persistence, Clear & Content Provenance

As a content author,
I want my session automatically saved and restored when I reopen the tool, and a single Clear action to start fresh,
So that I never lose work and can always reset to a clean state.

**Acceptance Criteria:**

**Given** any store state change occurs
**When** `useSession.ts` handles it
**Then** `SessionState` (with `version: 1`) is written to localStorage on phase transition or 300ms debounce on input change; write failures are caught silently without blocking the tool

**Given** the page loads and a session is present in localStorage
**When** `useSession` hydrates
**Then** version mismatch or parse error → full reset to defaults; stale phases (`generating`, `cancelling`, `downloading`) with `outputJson` present → restore to `output-clean`; stale phases with no `outputJson` → restore to `idle` with inputs pre-filled; `outputIsDirty: true` + `outputJson` → restore to `output-dirty`

**Given** a non-idle session was restored
**When** `SessionRestoreBanner` renders
**Then** it appears at the top of `InputSection`: "Restored from previous session · Clear"; Clear link calls `clear()`; banner disappears on the first input edit

**Given** `clear()` is called from any phase
**When** it executes
**Then** all store state resets to defaults; localStorage session is cleared; no confirmation shown; `InputSection` re-expands if collapsed

**Given** `StoryInputPanel` is rendered
**When** the input section is visible
**Then** a one-line content provenance note appears below the story textarea: "English source material must be original or appropriately licensed."

**Given** `useSession.test.ts`
**When** a version-mismatch session is stored
**Then** `useSession` resets to defaults; when a stale `generating` phase with `outputJson` is stored, it restores to `output-clean`; all session tests pass

---

## Epic 3: M3 — Generate from Topic (Path B)

RT can generate a story from a topic description alone — no English source material required. The tool generates an English proposal for review, then converts it to Japanese using the M1 single-call pipeline. The mode selector shipped in M1 activates fully.

### Story 3.1: Path B Backend — English Generation & Suggest-Topic Endpoints

As a developer,
I want the backend extended with a Path B generation flow and a lightweight suggest-topic endpoint,
So that the frontend can trigger English story generation and topic suggestions without changing the existing M1 pipeline contract.

**Acceptance Criteria:**

**Given** Path B uses two separate SSE lifecycle phases
**When** the frontend is in "Generate from topic" mode
**Then** Path B requires **two separate `GET /run_sse` requests** — each is a complete SSE lifecycle (RUN_STARTED → RUN_FINISHED | ERROR); the frontend opens a fresh SSE connection for each phase; the two requests are not multiplexed on a single stream

**Given** the first `GET /run_sse` request with `pathMode=B`, `topic`, and `chapter` params
**When** the backend processes it
**Then** the agent generates an English story proposal using a single Gemini call; `RUN_FINISHED` is emitted with `resultType: 'proposal'` and `content` set to the English story text; the SSE stream closes after this `RUN_FINISHED`

**Given** the second `GET /run_sse` request with `pathMode=B`, `englishDraft`, and `chapter` params
**When** the backend processes it
**Then** the M1 single-call pipeline converts the English draft to a Japanese story (identical to Path A but using `englishDraft` as the source text); `RUN_FINISHED` is emitted with `resultType: 'story'`; output passes all structural checks; schema contract identical to Path A

**Given** `POST /suggest-topic` is called with `{ "chapter": "Genki I Ch.5" }`
**When** the backend handles it
**Then** it returns a single-sentence topic string calibrated to that chapter within 10 seconds (NFR14); a 2-second per-session cooldown is enforced server-side; the endpoint is separate from the generation pipeline and does not emit AG-UI events

**Given** `test_agent.py` Path B tests
**When** `make test` is run without `GEMINI_API_KEY`
**Then** mock verifies: Path B emits `RUN_FINISHED` with `resultType: 'proposal'` on the first call and `resultType: 'story'` on the second; suggest-topic returns a plausible string; all tests pass

---

### Story 3.2: Topic Input, Suggest-Topic Button & Mode Activation

As a content author,
I want to switch to "Generate from topic" mode, type or generate a topic, and see the same chapter selector and settings I used in Convert mode,
So that I can start Path B from a topic description without any additional setup.

**Acceptance Criteria:**

**Given** the user clicks "Generate from topic" in `ModeToggle`
**When** Path B activates
**Then** the story textarea is replaced by `TopicTextarea`; chapter selector and `ScopeChip` remain; story length controls in `SettingsPanel` become active; `steeringInstructions` collapsible remains; `pathMode` in store updates to `'B'`

**Given** `TopicTextarea` is rendered with an empty topic field
**When** the "✦ Suggest a topic" button is clicked
**Then** the button transitions to a spinner (`aria-busy="true"`, `pointer-events: none`) without unmounting; `POST /suggest-topic` fires with the current chapter as payload; on response, the textarea is populated and the button resets; on error, a shadcn Toast "Could not fetch suggestion" appears and the button resets

**Given** `TopicTextarea` already has content
**When** "Replace topic" is clicked
**Then** a `SuggestConfirm` strip appears inline below the textarea; Generate button is disabled while the strip is visible

**Given** `SuggestConfirm` strip is visible
**When** it renders
**Then** `role="alert"` on the strip container; `accent-subtle` background + `accent` border; message: "Replace your current topic with a suggested one?"; [Yes, replace] fires the suggest-topic request and dismisses the strip; [Cancel] dismisses the strip without firing; focus moves to [Yes, replace] button on appearance; Escape key triggers [Cancel] from anywhere while the strip is visible

**Given** the 300ms frontend debounce on the suggest button
**When** the button is clicked rapidly
**Then** only one request is sent per 300ms window; the button remains in spinner state until the request resolves

**Given** `useSession` and `storedInputs`
**When** the user switches from Convert to Generate mode
**Then** `chapter`, `grammarDist`, and `temperature` migrate to the new mode's `storedInputs`; the previous Convert mode's `storyText` is preserved separately so switching back restores it; generated output is cleared on mode switch; if `outputIsDirty`, inline warning appears before switching

---

### Story 3.3: English Proposal Review & Convert to Japanese

As a content author,
I want to review and edit the generated English story proposal before converting it to Japanese,
So that I can steer the content before committing to the full generation pipeline.

**Acceptance Criteria:**

**Given** the user clicks Generate in Path B mode with a topic and chapter set
**When** the backend returns `RUN_FINISHED` with `resultType: 'proposal'`
**Then** `phase → 'proposal'`; the English draft appears in an editable textarea with a "Convert to Japanese" primary button and a "Regenerate" secondary button; `InputSection` collapses (content preserved); `englishDraft` is saved to `storedInputs` and persisted to localStorage

**Given** `phase === 'proposal'`
**When** the user edits the English draft freely
**Then** edits are captured in the store; there is no dirty-state warning for the proposal (editing is expected and encouraged); "Convert to Japanese" remains active as long as the textarea is non-empty

**Given** the user clicks "Convert to Japanese"
**When** the action fires
**Then** the click is the commitment gesture (no separate confirmation); `phase → 'generating'`; a new `runId` is assigned; the English draft is sent as `englishDraft` param on the second `GET /run_sse` request; the M1 single-call pipeline runs; `englishDraft` is held in `authoringStore` throughout conversion and is not cleared on any error

**Given** Japanese conversion fails (timeout or `ERROR` event)
**When** `phase → 'error'`
**Then** `englishDraft` is restored to the proposal textarea; `phase` transitions back to `'proposal'` (not `'idle'`); Retry button re-dispatches the second `GET /run_sse` request with the preserved `englishDraft` — it does not regenerate the English story; state transitions for this story: `proposal → generating` (Convert click); `generating → output-clean` (RUN_FINISHED story); `generating → proposal` (error/timeout — restores draft)

**Given** the user clicks "Regenerate" from `proposal` state
**When** the action fires
**Then** Path B generation restarts from the topic + chapter inputs; the previous English draft is replaced on the new `RUN_FINISHED`

---

### Story 3.4: Story Length Settings & Path B Session Restore

As a content author,
I want to set a target story length when generating from a topic, and have my Path B session restore correctly when I reopen the tool,
So that I can control the scope of generated stories and pick up where I left off.

**Acceptance Criteria:**

**Given** the user is in "Generate from topic" mode
**When** `SettingsPanel` is open
**Then** story length presets are active: Short (~100w) / Medium (~250w) / Long (~400w) / Custom; selecting a preset populates the numeric input; typing in the numeric input (max 1000) implicitly selects Custom; only `wordCount` (integer) is sent to the backend as `target_word_count`; preset selection is UI state only

**Given** the user is in "Convert a story" mode
**When** `SettingsPanel` is open
**Then** story length controls are dimmed (38% opacity) with the hint "Available in Generate from topic mode"; they are not interactive; no `target_word_count` is sent to the backend

**Given** a Path B session is in `proposal` state (English draft present) when the tab is closed
**When** the user reopens the tool
**Then** `useSession` restores to `proposal` state with the English draft in the textarea and "Convert to Japanese" available; the topic and chapter are also restored

**Given** a Path B session is in a generating phase when the tab is closed
**When** the user reopens the tool
**Then** the stale generating phase is treated as crashed; the tool restores to `idle` with the topic and chapter pre-filled; no stuck spinner

---

## Epic 4: M2 — Agentic Calibration Quality

RT gets higher-quality output — the 4-agent ReAct workflow plans, generates, verifies grammar, and quality-reviews the story before presenting results. The UI surfaces live agent status with a single updating message line; output delivery and download are identical to M1. Undertaken after the full Path A + Path B pipeline has been validated in use.

### Story 4.1: M2 Multi-Agent Backend

As a developer,
I want the M1 backend upgraded to a 4-agent ReAct system that plans, generates, verifies grammar, and quality-reviews the story before returning output,
So that RT receives higher-quality, better-calibrated stories without any UI contract changes.

**Acceptance Criteria:**

**Given** `docs/adr/004-agui-event-types.md` governs all event types
**When** M2 introduces agent status messages
**Then** an `AGENT_STATUS` event type is added to ADR-004 before implementation begins: `{ "type": "AGENT_STATUS", "message": "<string>" }`; no other new event types are introduced without updating the ADR first

**Given** the M2 backend receives a generation request
**When** the ReAct agent loop runs
**Then** four agents execute: (1) reasoning agent plans the story structure and calibration approach; (2) action agent generates the story; (3) grammar checker agent verifies each sentence's annotated grammar points match the sentence text — sentences that fail may be rewritten or dropped, with no guaranteed 1:1 mapping from input to output sentences; (4) final QC agent reviews the story as a whole for quality and calibration

**Given** agents are running
**When** each agent starts or completes a significant step
**Then** the backend emits `AGENT_STATUS` events with plain-English status messages (e.g., "Planning story structure…", "Generating story…", "Checking grammar…", "Running quality review…") via the SSE stream before `RUN_FINISHED`

**Given** both structural (FR12) and grammar verification (FR13) checks pass
**When** the agent loop completes
**Then** `RUN_FINISHED` is emitted with a complete, schema-valid story JSON; output contract is identical to M1; `words`, `ruby`, and `vocab_keys` arrays are equal length in every sentence

**Given** the grammar checker agent finds one or more sentences that fail verification
**When** corrections are attempted
**Then** the action agent rewrites or drops the failing sentences (no 1:1 sentence mapping guarantee); corrected sentences are re-verified; if the story passes after corrections, `RUN_FINISHED` is emitted normally

**Given** grammar verification or QC fails after the configured retry budget is exhausted
**When** the agent loop gives up
**Then** `ERROR` is emitted with `code: 'GRAMMAR_VERIFICATION_FAILED'` and a human-readable message; the frontend recovers to `error` state with inputs preserved — identical to M1 error handling; the retry budget is a backend constant (not user-configurable in M2)

**Given** `test_agent.py` M2 tests run without `GEMINI_API_KEY`
**When** `make test` is run
**Then** mock verifies: all four agents are invoked; `AGENT_STATUS` events are emitted during the loop; `RUN_FINISHED` is only emitted after both structural and grammar checks pass; a mock grammar failure triggers correction before `RUN_FINISHED`; all tests pass

---

### Story 4.2: M2 Progress UI — Agent Status Message Line

As a content author,
I want to see a live status message during M2 generation showing what the system is currently doing,
So that I know the tool is actively working and have a rough sense of where it is in the process.

**Acceptance Criteria:**

**Given** `useAgUiRun` receives an `AGENT_STATUS` event during `generating` phase
**When** the event arrives
**Then** a `agentStatusMessage` value is updated; `GenerationProgress` displays it as a single `<p>` text line below the shimmer bar in `muted` colour; each new `AGENT_STATUS` event replaces the previous message

**Given** the app is in M1 mode (backend emits no `AGENT_STATUS` events)
**When** `GenerationProgress` renders
**Then** the status text line is absent; M1 behaviour is entirely unchanged; no regressions in existing tests

**Given** `RUN_FINISHED` is received
**When** `GenerationProgress` collapses
**Then** the status text disappears with it; no persistent audit summary or step log is shown; output review and download flow is identical to M1

**Given** `useAgUiRun.test.ts`
**When** a synthetic `AGENT_STATUS` event is emitted via `MockEventSource`
**Then** the displayed status message updates to the new message; all existing store and hook tests continue to pass
