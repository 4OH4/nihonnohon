---
stepsCompleted: ["step-01-init", "step-02-context", "step-03-starter", "step-04-decisions", "step-05-patterns", "step-06-structure", "step-07-validation", "step-08-complete"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd-story-authoring-tool.md"
  - "_bmad-output/planning-artifacts/product-brief-story-authoring-tool.md"
  - "_bmad-output/planning-artifacts/product-brief-story-authoring-tool-distillate.md"
  - "docs/adr/003-story-generator-out-of-scope.md"
  - "apps/story-generator/README.md"
  - "_bmad-output/project-context.md"
lastStep: 8
status: complete
completedAt: "2026-05-15"
workflowType: 'architecture'
project_name: 'nihonnohon-story-authoring-tool'
user_name: 'RT'
date: '2026-05-15'
---

# Architecture Decision Document — Story Authoring Tool

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements — 51 total across 8 categories (v1 scope: 44; v2: 7 deferred)**

| Category | Count | Core Capability |
|---|---|---|
| Story Input & Configuration | 8 | English text area, chapter selector, steering panel, session restore, Path B topic mode (M3) |
| Story Generation | 11 | Core generation, AG-UI streaming progress, cancellation, 60s timeout/retry, backend health monitor |
| Curriculum Calibration | 4 | Cumulative vocab + grammar ceilings from CSVs; supplemental vocab key consistency |
| Output Review & Editing | 6 | Editable JSON textarea, re-run (from original inputs), English proposal gate (M3) |
| Output Validation | 10 | JSON syntax, parallel array parity, grammar indices, vocab key resolution, difficulty format, schema version; sentence-level error reporting |
| File Download | 2 | Browser download as `{id}.json`, UTF-8 no BOM |
| Security & Configuration | 3 | API key in backend `.env` only, content provenance notice, stable sentence IDs |
| Community Authoring | 7 | **v2 only** — auth, preview, submission, moderation |

**Non-Functional Requirements — 10 binding constraints:**

- **NFR1:** Generation requests complete ≤60s; timeout → recoverable error state
- **NFR2:** First AG-UI event received within 3s of request
- **NFR3:** All client-side interactions ≤200ms perceived
- **NFR4:** Backend health check responds ≤5s
- **NFR5–7:** API key never reaches browser; `.env` gitignored; v1 stores zero server-side user data
- **NFR8–10:** Failure preserves inputs; storage unavailability degrades gracefully; health re-check max 60s interval
- **NFR11–13:** Every saved file passes `loadStory()` and `story.v1.json` validation; UTF-8 no BOM

**Scale & Complexity:**

- Project complexity: **medium** (elevated by LLM orchestration, agentic workflow design, and the strict schema contract)
- Primary domain: Full-stack web app + AI/LLM pipeline
- Developer: solo (RT), sequential milestones with explicit gates
- Estimated architectural components: ~8 (SPA frontend, ADK agent server, Gemini API integration, Pydantic models, AG-UI streaming layer, curriculum data loader, validation library, session storage)

### Technical Constraints & Dependencies

1. **Brownfield schema contract.** `story.v1.json` is the non-negotiable output contract. Every saved file must pass `loadStory()` from `@nihonnohon/story-loader` without modification. One planned schema change is in scope: add `key` property to `vocab_supplement` entries.

2. **ADK `api_server` packaging.** The Python backend is packaged via the ADK `api_server` command, exposing a containerisable endpoint. This is the v1→v2 transition mechanism (Cloud Run) and must not be bypassed.

3. **AG-UI transport selection.** Frontend-backend communication uses AG-UI streaming. The transport (SSE vs WebSocket) must be resolved as a concrete decision before M1 implementation begins — "SSE or WebSocket" is not a valid architecture state. SSE is simpler and sufficient for unidirectional progress streaming; WebSocket is required if M2 ReAct needs bidirectional agent interruption.

4. **Monorepo exclusion.** `apps/story-generator/` is excluded from `pnpm-workspace.yaml` (ADR 003). The frontend within this directory is self-contained and cannot use workspace-level Tailwind config or shadcn/ui packages from `apps/web`. Shared UI patterns must be explicitly copied in.

5. **Reference data as files.** `genki1vocab.csv` and `Genki_grammar_for_AI_generation.csv` are the calibration source of truth, read by the backend at runtime. They are file dependencies co-located with the backend, not databases.

6. **Two-sided validation contract.** Backend validates structural invariants (parallel array parity, JSON syntax) before returning output. Frontend re-validates all semantic rules on Save (post-edit). Both layers must implement the same contract rules — divergence between them is the highest-probability silent failure in this design.

7. **Cloud Run streaming constraints.** The backend must be designed for Cloud Run's timeout and keep-alive limits from M1, not deferred to v2. Long-running SSE connections and ReAct tool loops approaching 60s will encounter Cloud Run's default request timeout. v1→v2 is a configuration/infrastructure change, but backend streaming behaviour must not be local-only.

8. **v1→v2 upgrade constraint.** Architecture decisions in v1 must not require application code changes for v2 deployment. Configuration and infrastructure changes only.

### Cross-Cutting Concerns

- **Pydantic↔TypeScript contract maintenance** — `story.v1.json` is the single source of truth shared between the Python Pydantic models and the TypeScript `@nihonnohon/story-loader` types. A strategy for keeping both sides in sync must be decided at architecture level: auto-generate Pydantic from JSON Schema (`datamodel-code-generator`), or a schema-change checklist enforced by convention.

- **Streaming + schema invariant interaction** — the frontend must not render intermediate invalid parallel-array state during a live AG-UI stream. Streaming granularity must ensure each event is self-consistent, or the frontend must explicitly tolerate partial state without surfacing it as a validation error.

- **Error taxonomy** — generation failures, validation failures, network errors, and LLM API errors each have distinct UX recovery paths; error types must be modelled explicitly in the AG-UI event stream and frontend state machine.

- **AG-UI event contract stability** — the streaming event schema is the frontend-backend interface contract; M1→M2 backend rewrite (prompt-grounded → ReAct agentic) must not break the frontend event contract.

- **Session state: draft-vs-committed distinction** — localStorage session restore must distinguish between unvalidated draft output (post-edit, pre-Save) and last-saved-clean state. Eviction policy (5MB limit), tab-conflict behaviour (multiple tabs diverge silently), and browser-clear warning are UX contract decisions, not implementation details.

- **Test harness** — must be defined and in place before M1 implementation begins: pytest + jsonschema for backend Pydantic output; Vitest + mock AG-UI stream for frontend; a cross-language contract test that runs `loadStory()` against a fixture. ReAct non-determinism in M2 makes a M1 harness essential.

- **API key isolation** — the Gemini key path must be enforced at architecture level (backend-only); no frontend code path should touch it.

---

## Starter Template Evaluation

### Primary Technology Domain

Two separate sub-projects within `apps/`: React/Vite SPA (`apps/story-generator/`) and Python ADK agent server (`apps/story-generator-backend/`), communicating via AG-UI over SSE.

### Starter Options Considered

No off-the-shelf full-stack starter covers Python ADK + React with AG-UI. The stack is specified by the PRD and mirrors `apps/web` on the frontend. Each sub-project is bootstrapped independently.

### Selected Approach: Separate Frontend and Backend Apps

**Rationale:** Splitting frontend and backend into separate `apps/` directories gives each a clear single purpose and allows `apps/story-generator/` to be a pnpm workspace member, granting it access to shared tooling (`@nihonnohon/eslint-config`, `@nihonnohon/typescript-config`, Tailwind token inheritance) and Turborepo pipeline participation. The Python backend lives in `apps/story-generator-backend/`, excluded from pnpm workspace (ADR 003 constraint updated to reference the new path).

**Project Layout:**

```
apps/
├── web/                            # nihonnohon reader (existing, unchanged)
├── story-generator/                # React/Vite SPA — pnpm workspace member
│   ├── src/
│   │   ├── components/ui/          # shadcn/ui primitives
│   │   ├── components/             # feature components
│   │   ├── stores/                 # Zustand stores
│   │   ├── hooks/                  # custom hooks
│   │   └── lib/                    # utilities (cn, ag-ui client)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts          # extends shared token conventions from apps/web
│   └── package.json
└── story-generator-backend/        # Python ADK backend — NOT in pnpm workspace
    ├── src/story_generator/
    │   ├── __init__.py             # existing
    │   ├── validator.py            # existing
    │   ├── agent.py                # ADK agent definition (M1)
    │   ├── models.py               # Pydantic models — generated from story.v1.json
    │   └── tools.py                # ADK tool definitions (M2)
    ├── .env                        # gitignored; Gemini API key
    ├── requirements.txt            # extend with google-adk, ag-ui-protocol, datamodel-code-generator
    └── README.md
```

**`pnpm-workspace.yaml` update:** Add `apps/story-generator` (or keep `apps/*` with explicit exclusion of `apps/story-generator-backend`).

**Frontend Initialization:**

```bash
npm create vite@latest apps/story-generator -- --template react-ts
```

Extends `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config` via workspace references. Tailwind config mirrors `apps/web` tokens.

**Backend Key Dependencies:**

```
google-adk
ag-ui-protocol>=0.1.18    # official AG-UI Python SDK; SSE transport; 16 event types
pydantic>=2.0
datamodel-code-generator   # generate models.py from story.v1.json
python-dotenv
jsonschema                 # existing
```

**Pydantic Model Generation:**

```bash
datamodel-codegen \
  --input ../../packages/schema/schemas/story.v1.json \
  --input-file-type jsonschema \
  --output-model-type pydantic_v2.BaseModel \
  --output src/story_generator/models.py
```

Re-run whenever `story.v1.json` changes. This is the schema-change enforcement mechanism.

**Architectural Decisions Established by This Approach:**

| Decision | Choice | Rationale |
|---|---|---|
| Frontend location | `apps/story-generator/` — pnpm workspace member | Shared tooling; Turborepo pipeline; resolves Tailwind isolation |
| Backend location | `apps/story-generator-backend/` — excluded from workspace | Python project; ADR 003 constraint (updated path) |
| Frontend stack | React 18 + Vite 5 + TypeScript strict + Tailwind + shadcn/ui | Mirrors `apps/web`; no new conventions |
| Frontend state | Zustand | Consistent with reader app |
| AG-UI transport | SSE via ADK `/run_sse` endpoint | Unidirectional stream sufficient for M1+M2 |
| AG-UI SDK | `ag-ui-protocol` Python package (v0.1.18) | Official SDK; Pydantic-based; SSE built-in |
| Pydantic source of truth | Generated from `story.v1.json` via `datamodel-code-generator` | Eliminates contract drift; schema is single source of truth |
| ADR 003 update | `apps/story-generator-backend/` must NOT be in pnpm workspace | Updated constraint; `apps/story-generator/` is now a normal workspace member |

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (block implementation):**
- Application state machine including `cancelling` micro-state and session restore mapping
- AG-UI event-type contract (must be in `docs/adr/` before hook implementation)
- Client-generated `runId` approach (unblocks cancel timing)
- localStorage versioning strategy

**Important Decisions (shape architecture):**
- CSV loading strategy (backend startup dependency)
- Ports, CORS, health endpoint
- Error response format
- `downloading` exit transition
- Makefile dev runner with port guard and process cleanup
- Test harness scaffold

**Deferred (v2):**
- Authentication, TLS, Cloud Run, Vercel, moderation, accessibility, per-sentence regeneration

---

### Data Architecture

**No database in v1.** Story output is a browser download. No server-side persistence. Reference data is CSV files.

**CSV loading: once at backend startup.** `genki1vocab.csv` and `Genki_grammar_for_AI_generation.csv` are loaded into memory when the ADK agent server starts. They are read-only at runtime, injected into the LLM system prompt at generation time. Per-request file I/O is unnecessary.

**localStorage session state schema:**
```typescript
interface SessionState {
  version: 1                   // increment when schema changes; mismatch → wipe and reset
  inputText: string
  chapterTarget: string        // e.g. "Genki I Ch.6"
  steeringInstructions: string
  outputJson: string | null    // raw textarea content (may be post-generation edited)
  outputIsDirty: boolean       // one-way latch: true from first edit until Re-run or Clear
  pathMode: 'A' | 'B'
}
```

Session is written to localStorage on every state change. On page load, restore is attempted silently. Any parse error, missing `version`, or `version` mismatch → full reset to defaults (no partial state accepted). Restore maps to the correct Zustand state: `outputJson` populated + `outputIsDirty` true → `output-dirty`; `outputJson` populated + `outputIsDirty` false → `output-clean`; `outputJson` null → `idle` with inputs pre-filled. Restoring to `idle` when output is present in storage would be disorienting — the state mapping is mandatory.

---

### Authentication & Security

**v1: no authentication.** Local tool, RT only.

**API key isolation.** Gemini API key in `apps/story-generator-backend/.env`, loaded at startup via `python-dotenv`. Never transmitted to or logged by the frontend. `.env` is gitignored.

**CORS.** `ALLOWED_ORIGIN` environment variable drives the allowed origin — never hardcoded. Default: `http://localhost:5174`. v2 sets the Vercel deployment URL. Health endpoint (`GET /health`) is excluded from CORS restrictions to support ops tooling and Cloud Run probes.

**v2 (deferred):** TLS enforced; authentication required; API key via Google Secret Manager or Cloud Run env var — no code changes.

---

### API & Communication Patterns

**Ports.**
- `apps/story-generator` Vite dev server: **5174** (avoids conflict with `apps/web` on 5173)
- Python ADK backend: **8000** (ADK default)
- Both env-configurable.

**AG-UI streaming (SSE).** Frontend initiates generation via SSE connection to `/run_sse`. Run lifecycle:

```
Frontend opens:  GET /run_sse?runId=<client-uuid>&inputText=...&chapter=...
Backend streams: RUN_STARTED → TEXT_MESSAGE_CHUNK* → [TOOL_CALL* (M2)] → RUN_FINISHED | ERROR
```

**Run ID.** Client-generated UUID, assigned at the moment `useAgUiRun` initiates the connection. Passed as a query parameter on `/run_sse`. The backend registers this ID on connect and uses it as the cancellation key. This eliminates the cancel-timing race: the Stop button is always functional from the moment the SSE connection opens.

**Cancellation.** Frontend sends `POST /cancel/{runId}` with AG-UI CANCEL event payload. Backend terminates the current generation and emits `RUN_CANCELLED` on the SSE stream. Stop button disables immediately on click and shows "Stopping…" (`cancelling` micro-state in UI). Progress goes indeterminate. `RUN_CANCELLED` event resolves back to `idle` with inputs preserved.

**SSE completion signal.** Successful generation emits a `RUN_FINISHED` event before stream close. `useAgUiRun` treats `RUN_FINISHED` as the authoritative completion signal. Unexpected stream close (no `RUN_FINISHED`) is treated as a network drop and transitions to `error` state — it is never treated as successful completion.

**AG-UI event-type contract.** The exact event types emitted by the backend must be committed to `docs/adr/004-agui-event-types.md` before `useAgUiRun` implementation begins. The hook is written against this contract; the backend is tested against it. This is the primary AG-UI/ADK integration seam.

**Health endpoint.** `GET /health` → `200 OK` or `503 Service Unavailable` (key missing/invalid). Called on page load and every 60s. `useAgUiRun` polls health once on mount before opening the SSE connection — fails fast with `error` state if backend is unreachable rather than leaving a spinner.

**Error response format.** Non-streaming failures: `{ "error": "GENERATION_FAILED", "message": "...", "sentence_id": null }`. Streaming errors: AG-UI `ERROR` event type. Both map to `error` state in the frontend state machine.

---

### Frontend Architecture

**Single-view application.** No client-side routing in M1/M2. Path A/B is a mode toggle on one screen. M3 does not add routes.

**Application state machine (Zustand store):**

```
idle
  → [Generate click, inputs valid] → generating

generating
  → [RUN_FINISHED received] → output-clean
  → [ERROR event or network drop] → error
  → [Stop click] → cancelling

cancelling           ← micro-state: Stop disabled, "Stopping…" shown, progress indeterminate
  → [RUN_CANCELLED received] → idle (inputs preserved)

output-clean
  → [textarea onChange] → output-dirty
  → [Re-run click] → generating
  → [Save click, validation passes] → downloading
  → [Save click, validation fails] → output-clean (error inline)

output-dirty         ← outputIsDirty is a one-way latch; does not reset if user reverts text
  → [Re-run click] → [inline confirmation: amber button "Overwrite edits & re-run?"]
    → [confirm] → generating
  → [Save click, validation passes] → downloading
  → [Save click, validation fails] → output-dirty (error inline)
  → [Clear click] → idle

downloading          ← transient; Blob URL created, <a>.click() triggered
  → [download triggered] → output-clean   (outputIsDirty reset to false)

error
  → [Retry click] → generating (inputs editable in error state; edit does not change state)
  → [Clear click] → idle

proposal             ← M3 Path B only; sits between generating and output-clean
  → [generated → proposal] after English story arrives
  → [Approve click] → generating (phase 2: Japanese pass; "Now generating Japanese story…" shown)
  → [Clear click] → idle
  Note: English proposal text is freely editable in this state; Approve button requires non-empty text only.
```

**`useAgUiRun` hook.** Owns SSE connection lifecycle, event parsing, cancellation dispatch, and health-check pre-flight. Components consume Zustand store state only — no direct SSE access in components. Hook responsibilities:
1. Assign client UUID for runId
2. Poll `/health` on mount; set `error` state if unavailable
3. Open SSE connection on generate dispatch
4. Parse AG-UI events → dispatch Zustand actions
5. Send `POST /cancel/{runId}` on cancel dispatch
6. Distinguish `RUN_FINISHED` (success) from unexpected stream close (network drop → error)

**Re-run confirmation UX.** When `output-dirty`, Re-run button transforms inline: turns amber, label changes to "Overwrite edits & re-run?". One click to confirm. No modal dialog. Resets `outputIsDirty` to false and transitions to `generating`.

**Immediate progress feedback.** A "Connecting…" indicator appears on Generate click before the first AG-UI event. The 3s first-event timeout starts on connection open; if no event arrives, transitions to `error`. The UI never presents a dead interval between click and visible response.

**Error messages.** Error state surfaces human-readable context, not raw codes:
- LLM timeout: "This took longer than expected — your inputs are preserved. Try again."
- API error: "The AI service returned an error — your inputs are preserved. Try again."
- Network drop: "Connection lost — your inputs are preserved. Check the backend and retry."

---

### Infrastructure & Development Workflow

**Dev runner (`apps/story-generator-backend/Makefile`):**
```makefile
.PHONY: dev

dev:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; true
	@lsof -ti:5174 | xargs kill -9 2>/dev/null; true
	python -m uvicorn story_generator.main:app --port 8000 --reload &
	BACKEND_PID=$$!; \
	trap "kill $$BACKEND_PID 2>/dev/null" EXIT; \
	cd ../story-generator && pnpm dev
```
Clears stale port occupancy before starting. Kills Python process when Vite exits. `make dev` from `apps/story-generator-backend/` starts both processes.

**Test harness (scaffolded before M1 story implementation):**
- `apps/story-generator/vitest.config.ts` — Vitest with jsdom; mirrors `apps/web` config
- `apps/story-generator-backend/tests/__init__.py` — pytest entry point
- `apps/story-generator-backend/tests/test_contract.py` — validates Pydantic output against `story.v1.json`; calls `loadStory()` against a fixture via Node subprocess (cross-language contract test)

**Pydantic model codegen (CI step):**
```bash
# Must run in CI on any change to packages/schema/schemas/story.v1.json
make generate-models
```
Not a one-time manual step. Drift returns in two sprints if it isn't automated.

**v2 deployment (deferred):**
- Backend: containerised ADK `api_server` → Google Cloud Run (no code changes; config only)
- Frontend: Vite build → Vercel (standard static deployment)
- `ALLOWED_ORIGIN` env var is already env-driven from v1; no code change required for v2 CORS

---

### Pre-Implementation Checklist

Before Story-1 implementation begins:

- [ ] Commit AG-UI event-type contract to `docs/adr/004-agui-event-types.md`
- [ ] Scaffold `apps/story-generator/vitest.config.ts`
- [ ] Scaffold `apps/story-generator-backend/tests/__init__.py` and `test_contract.py`
- [ ] Update `docs/adr/003-story-generator-out-of-scope.md` → `apps/story-generator-backend/`
- [ ] Add `apps/story-generator` to `pnpm-workspace.yaml`
- [ ] Add `make generate-models` to CI pipeline

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Python backend — always snake_case:**
- Module files: `agent.py`, `models.py`, `tools.py`, `validator.py`, `data_loader.py`
- Functions: `load_vocab_csv()`, `build_system_prompt()`, `validate_parallel_arrays()`
- Pydantic model fields: snake_case (matching `story.v1.json` wire format — no transformation needed in Python)
- Test files: `test_agent.py`, `test_models.py`, `test_contract.py`, `test_validator.py`

**TypeScript frontend — mirrors `apps/web` conventions:**
- Components: PascalCase `.tsx` (`GenerateButton.tsx`, `OutputTextarea.tsx`)
- Hooks: `use` prefix camelCase (`useAgUiRun.ts`, `useSession.ts`, `useValidation.ts`)
- Stores: camelCase + `Store` suffix (`authoringStore.ts` → `useAuthoringStore`)
- Utilities: camelCase (`validateStoryJson.ts`, `downloadStoryFile.ts`)
- Test files: `*.test.ts` / `*.test.tsx` in `src/__tests__/`

**AG-UI event types — per `ag-ui-protocol` spec; exact set in `docs/adr/004-agui-event-types.md`.** Agents must reference that file, not invent type names.

**API endpoints — lowercase, underscore-separated (AG-UI convention):**
`GET /health`, `GET /run_sse`, `POST /cancel/{runId}`

**Error codes — SCREAMING_SNAKE_CASE strings:**
`GENERATION_FAILED`, `VALIDATION_ERROR`, `TIMEOUT`, `CANCELLED`, `BACKEND_UNAVAILABLE`, `PARALLEL_ARRAY_MISMATCH`, `SCHEMA_INVALID`, `MISSING_FIELD`

---

### Structure Patterns

**Frontend (`apps/story-generator/src/`):**
```
src/
  components/ui/       # shadcn/ui primitives (copied from apps/web)
  components/          # feature components — one file per component
  stores/              # authoringStore.ts (single store)
  hooks/               # useAgUiRun.ts, useSession.ts, useValidation.ts
  lib/                 # validateStoryJson.ts, downloadStoryFile.ts, cn.ts
  __tests__/           # Vitest unit tests
```

**Backend (`apps/story-generator-backend/`):**
```
src/story_generator/
  __init__.py
  agent.py             # ADK agent; system prompt assembly; CSV data injection
  models.py            # AUTO-GENERATED — do not edit; run: make generate-models
  tools.py             # ADK tool definitions (M2+)
  validator.py         # structural validation; returns ValidationResult (never raises)
  data_loader.py       # CSV loading at startup; returns frozen dataclasses
tests/
  __init__.py
  test_contract.py     # loadStory() contract test
  test_validator.py
  test_agent.py
```

**`models.py` is auto-generated — never hand-edited.** Header comment enforces this: `# AUTO-GENERATED from story.v1.json — run: make generate-models`. Any model change requires editing `story.v1.json` then regenerating.

---

### Format Patterns

**AG-UI event payloads — camelCase** (ag-ui-protocol SDK convention). `useAgUiRun` receives raw events and dispatches typed Zustand actions — raw event objects never reach components.

**AG-UI → Zustand event mapping:**
```
RUN_STARTED          → confirm phase = 'generating'; runId confirmed
TEXT_MESSAGE_CHUNK   → accumulate in hook-internal buffer (NOT written to store)
RUN_FINISHED         → setOutputJson(assembled buffer); phase → 'output-clean'
                       if resultType === 'proposal' (M3 Path B):
                         → _setProposalText(payload); phase → 'proposal'
ERROR                → errorCode = event.data.code ?? 'GENERATION_FAILED'
                       errorMessage = event.data.message; phase → 'error'
RUN_CANCELLED        → phase → 'idle'; runId → null; inputs preserved
[stream close, no RUN_FINISHED]
                     → errorCode = 'BACKEND_UNAVAILABLE'
                       errorMessage = 'Connection lost — your inputs are preserved. Check the backend and retry.'
                       phase → 'error'
```

**`TEXT_MESSAGE_CHUNK` accumulates in a hook-internal buffer only.** The output textarea never displays partial JSON. On `RUN_FINISHED`, the complete assembled string is committed to `outputJson` in one atomic store update.

**Non-streaming error response:**
```json
{ "error": "GENERATION_FAILED", "message": "Human-readable string", "sentence_id": null }
```
`sentence_id` always present, `null` when not sentence-specific.

**`validator.py` return contract:**
```python
@dataclass(frozen=True)
class ValidationError:
    code: str            # PARALLEL_ARRAY_MISMATCH | SCHEMA_INVALID | MISSING_FIELD | …
    message: str
    sentence_index: int | None   # None if not sentence-specific

@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    errors: list[ValidationError]

def validate(story_dict: dict) -> ValidationResult: ...
# Never raises. Always returns ValidationResult.
```

---

### Zustand Store Contract

**Single store: `authoringStore.ts`**

```typescript
type Phase =
  | 'idle' | 'generating' | 'cancelling'
  | 'output-clean' | 'output-dirty' | 'downloading'
  | 'error' | 'proposal'

interface AuthoringStore {
  phase: Phase
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  outputJson: string | null
  outputIsDirty: boolean        // one-way latch; reset only by clear() or new generate()
  proposalText: string | null   // M3 Path B
  proposalApproved: boolean     // M3 Path B
  errorCode: string | null
  errorMessage: string | null
  runId: string | null          // client UUID; new on every generate(); null after clear()
  // Public actions
  generate: () => void          // valid from: idle, error
  cancel: () => void            // valid from: generating, cancelling
  approve: () => void           // valid from: proposal (M3)
  save: () => void              // valid from: output-clean, output-dirty
  clear: () => void             // valid from: any phase
  setInputText: (v: string) => void
  setChapterTarget: (v: string) => void
  setSteeringInstructions: (v: string) => void
  setPathMode: (v: 'A' | 'B') => void
  // Internal actions — called by useAgUiRun only, not exposed to components
  _setOutputJson: (v: string) => void
  _setProposalText: (v: string) => void
  _markDirty: () => void
  _setError: (code: string, message: string) => void
  _resolveCancel: () => void
}
```

**`generate()` from `error` state** performs an implicit retry: clears `errorCode`/`errorMessage`, generates a new `runId`, transitions to `generating`. No `clear()` required first.

**Exported selectors** (in `authoringStore.ts`; not derived inline in components):
```typescript
export const selectIsGenerating = (s: AuthoringStore) => s.phase === 'generating'
export const selectCanGenerate  = (s: AuthoringStore) =>
  s.phase === 'idle' || s.phase === 'error'
export const selectCanSave      = (s: AuthoringStore) =>
  s.outputJson !== null &&
  (s.phase === 'output-clean' || s.phase === 'output-dirty')
export const selectCanCancel    = (s: AuthoringStore) =>
  s.phase === 'generating' || s.phase === 'cancelling'
```

---

### Communication Patterns

**State transitions via store actions only.** Components call public actions (`generate`, `cancel`, `save`, `clear`, `approve`, setters). `phase` is never written directly from a component. Internal actions (`_setOutputJson`, `_markDirty`, etc.) are called only by `useAgUiRun`.

**`useAgUiRun` is the sole SSE consumer.** No component instantiates `EventSource` directly.

**SSE transport is injected — never constructed inside the hook body:**
```typescript
function useAgUiRun(
  createEventSource: (url: string) => EventSource = (url) => new EventSource(url)
): void
```
Tests inject a `MockEventSource`. This is the only approved SSE mock strategy.

**Session state written on phase transition or debounced 300ms on input change** — not on render. `useSession` hook handles this; components do not write to localStorage.

**Session hydration on mount (once, in `useSession`):**
- Restorable phases: `idle`, `output-clean`, `output-dirty`, `error`, `proposal`
- Stale phases (`generating`, `cancelling`, `downloading`) → treat as crashed → restore to `output-clean` if `outputJson` present, else `idle`
- Any parse error, missing `version`, or `version` mismatch → full reset to defaults (no partial restore)

---

### Process Patterns

**Validation fires on `save()` only — never on textarea `onChange`.**

**`outputIsDirty` is a one-way latch:**
- Starts `false`; flips to `true` on the first `_markDirty()` call after `output-clean` is reached
- Stays `true` even if the user reverts to the original text (no string comparison)
- Reset to `false` only by `clear()` or a completed `generate()` cycle

**Backend validation runs before `RUN_FINISHED` is emitted.** If `validator.validate()` returns `valid: false`, the backend emits `ERROR` instead. The frontend never receives structurally invalid output.

**Python CSV data is immutable at runtime.** `data_loader.py` returns `@dataclass(frozen=True)` instances. The agent receives references; it cannot mutate in-memory curriculum data.

---

### Test Tooling & First Tests

**Frontend:** Vitest (globals enabled) + `@testing-library/react` + `@testing-library/user-event`. Config at `apps/story-generator/vitest.config.ts` (mirrors `apps/web`).

**Backend:** pytest. `pyproject.toml` sets `testpaths = ["tests"]`.

**First three tests (vertical slice before any component work):**
1. `src/__tests__/authoringStore.test.ts` — `generate()` transitions `idle → generating`; `runId` set; `outputIsDirty` remains `false`
2. `src/__tests__/useAgUiRun.test.ts` — synthetic `RUN_FINISHED` via `MockEventSource` calls `_setOutputJson` and transitions phase to `output-clean`
3. `tests/test_validator.py` — `validate()` returns `ValidationResult(valid=False, errors=[...])` when a required field is missing; never raises

---

### Enforcement

**All agents MUST:**
- Reference `docs/adr/004-agui-event-types.md` before implementing `useAgUiRun` or backend event emission
- Never hand-edit `models.py` — run `make generate-models`
- Never dispatch phase changes from components — use public store actions
- Never instantiate `EventSource` outside `useAgUiRun`
- Use `cn()` for all className composition in frontend components
- Use `font-ja` class on all Japanese text
- Use only design tokens from `tailwind.config.ts` — no arbitrary colours

**Anti-patterns:**
- `store.setState({ phase: 'generating' })` in a component ❌ → call `store.generate()` ✅
- `new EventSource(url)` in a component ❌ → consumed via `useAgUiRun` hook ✅
- Hand-editing `models.py` ❌ → edit `story.v1.json` then `make generate-models` ✅
- Validating output on `onChange` ❌ → validate in `save()` action ✅
- Resetting `outputIsDirty` by string comparison ❌ → one-way latch ✅
- Deriving `isGenerating` inline in a component ❌ → use `selectIsGenerating` selector ✅

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
apps/
├── story-generator/                    # React/Vite SPA — pnpm workspace member
│   ├── package.json                    # deps: react, vite, zustand, @nihonnohon/*, ag-ui-protocol client
│   ├── tsconfig.json                   # extends @nihonnohon/typescript-config/vite
│   ├── vite.config.ts                  # port 5174; proxy /run_sse + /cancel + /health → 8000
│   ├── tailwind.config.ts              # standalone; mirrors apps/web design tokens
│   ├── vitest.config.ts                # globals: true; jsdom; mirrors apps/web
│   ├── eslint.config.js                # extends @nihonnohon/eslint-config/react
│   ├── index.html
│   └── src/
│       ├── main.tsx                    # React entry point
│       ├── App.tsx                     # root component; mounts AuthoringTool
│       ├── components/
│       │   ├── ui/                     # shadcn/ui primitives (copied from apps/web)
│       │   │   ├── Button.tsx
│       │   │   ├── Textarea.tsx
│       │   │   ├── Select.tsx
│       │   │   ├── Badge.tsx
│       │   │   └── Collapsible.tsx     # steering instructions panel
│       │   ├── AuthoringTool.tsx       # root layout component
│       │   ├── StoryInputPanel.tsx     # FR1,2,46,50: English source + chapter + steering
│       │   ├── PathModeToggle.tsx      # FR6/M3: Path A / Path B toggle
│       │   ├── GenerateButton.tsx      # FR3,47: Generate/Stop button; phase-aware label
│       │   ├── ProgressIndicator.tsx   # FR9: AG-UI streaming progress; "Connecting…" on click
│       │   ├── OutputPanel.tsx         # FR19,20: editable JSON textarea; marks dirty on change
│       │   ├── ValidationReport.tsx    # FR33: sentence-level validation error display
│       │   ├── SaveButton.tsx          # FR35: triggers save() action; disabled until canSave
│       │   ├── ClearButton.tsx         # FR4: clear() action; no confirmation
│       │   ├── BackendHealthBanner.tsx # FR48: connection status; shown when backend unavailable
│       │   └── ProposalPanel.tsx       # FR8,23,24/M3: English proposal + Approve button
│       ├── stores/
│       │   └── authoringStore.ts       # single Zustand store; phase machine + selectors
│       ├── hooks/
│       │   ├── useAgUiRun.ts           # FR7,9,47: SSE lifecycle; event→store mapping; cancel
│       │   ├── useSession.ts           # FR5: localStorage read/write; hydration on mount
│       │   └── useValidation.ts        # FR25-34: client-side semantic validation suite
│       ├── lib/
│       │   ├── cn.ts                   # className utility (from apps/web)
│       │   ├── validateStoryJson.ts    # FR25-32: full validation; calls @nihonnohon/story-loader
│       │   ├── downloadStoryFile.ts    # FR35,36: Blob + anchor download; UTF-8 no BOM
│       │   └── agui.ts                 # AG-UI event type constants (mirrors ADR-004)
│       └── __tests__/
│           ├── authoringStore.test.ts  # phase transitions; selector correctness
│           ├── useAgUiRun.test.ts      # MockEventSource; event→state mapping
│           ├── useSession.test.ts      # hydration; version mismatch; stale phase reset
│           └── validateStoryJson.test.ts  # parallel array; grammar indices; vocab keys
│
└── story-generator-backend/           # Python ADK backend — NOT in pnpm workspace
    ├── pyproject.toml                  # pytest: testpaths=["tests"]; project metadata
    ├── requirements.txt                # google-adk, ag-ui-protocol>=0.1.18, pydantic>=2,
    │                                   # datamodel-code-generator, python-dotenv, jsonschema
    ├── Makefile                        # targets: dev, generate-models, test
    ├── .env                            # GITIGNORED — GEMINI_API_KEY, ALLOWED_ORIGIN, DATA_DIR
    ├── .env.example                    # GEMINI_API_KEY=, ALLOWED_ORIGIN=http://localhost:5174
    ├── README.md
    └── src/story_generator/
        ├── __init__.py
        ├── main.py                     # ADK api_server entry; CORS (ALLOWED_ORIGIN env);
        │                               # /health endpoint; startup: load CSVs
        ├── agent.py                    # ADK agent definition; system prompt assembly;
        │                               # injects vocab + grammar CSV data; emits AG-UI events
        ├── models.py                   # AUTO-GENERATED — do not edit
        │                               # run: make generate-models
        ├── tools.py                    # ADK tool definitions (M2+; empty stub in M1)
        ├── validator.py                # validate(story_dict) → ValidationResult; never raises
        │                               # ValidationResult, ValidationError dataclasses defined here
        └── data_loader.py              # load_vocab_data(path), load_grammar_data(path)
                                        # returns frozen dataclasses; called once at startup

# Reference data (monorepo root — read by backend at startup via DATA_DIR env var)
resources/
├── genki1vocab.csv                     # FR15: vocabulary reference; stable numeric IDs
└── Genki_grammar_for_AI_generation.csv # FR16: grammar reference by chapter

# Schema contract (shared — source of truth for Pydantic codegen and TypeScript types)
packages/schema/schemas/
└── story.v1.json                       # JSON Schema Draft-07; Pydantic codegen source
```

---

### Architectural Boundaries

**Frontend → Backend (AG-UI over HTTP/SSE):**

| Endpoint | Direction | Consumer | Purpose |
|---|---|---|---|
| `GET /health` | → backend | `useAgUiRun.ts`, `BackendHealthBanner.tsx` | FR48: connection check on mount + 60s poll |
| `GET /run_sse?runId=&inputText=&chapter=&steeringInstructions=&pathMode=` | → backend (SSE) | `useAgUiRun.ts` | FR7,9: initiate generation; stream AG-UI events |
| `POST /cancel/{runId}` | → backend | `useAgUiRun.ts` | FR47: cancel in-progress generation |

Vite dev proxy (`vite.config.ts`) forwards `/run_sse`, `/cancel`, and `/health` to `localhost:8000`. No CORS issues in development.

**Backend → Gemini API:**
- `agent.py` calls Gemini via ADK structured output
- API key from `GEMINI_API_KEY` env var only — never reaches frontend
- Pydantic models enforce output schema; `validator.py` enforces semantic invariants before `RUN_FINISHED`

**Backend → Reference data:**
- `data_loader.py` reads CSV files once at startup
- Path resolved from `DATA_DIR` env var (default: `../../resources/` relative to backend root)
- Frozen dataclasses — no mutation at runtime

**Schema contract boundary (`story.v1.json`):**
- Backend: `make generate-models` → `models.py` (Pydantic v2)
- Frontend: `@nihonnohon/story-loader` `loadStory()` (TypeScript)
- Both sides consume the same JSON Schema; codegen eliminates manual sync

---

### FR Category → File Mapping

| FR Category | Frontend | Backend |
|---|---|---|
| Story Input & Configuration (FR1-5, FR46, FR50) | `StoryInputPanel.tsx`, `PathModeToggle.tsx`, `authoringStore.ts`, `useSession.ts` | — |
| Story Generation (FR7-14, FR47-48, FR51) | `GenerateButton.tsx`, `ProgressIndicator.tsx`, `useAgUiRun.ts`, `BackendHealthBanner.tsx` | `agent.py`, `main.py` |
| Curriculum Calibration (FR15-18) | — | `data_loader.py`, `agent.py` (system prompt injection) |
| Output Review & Editing (FR19-24) | `OutputPanel.tsx`, `authoringStore.ts` (outputIsDirty), `GenerateButton.tsx` (re-run) | — |
| Output Validation (FR25-34) | `validateStoryJson.ts`, `useValidation.ts`, `ValidationReport.tsx`, `SaveButton.tsx` | `validator.py` (pre-emit) |
| File Download (FR35-36) | `downloadStoryFile.ts`, `SaveButton.tsx` | — |
| Security & Configuration (FR37-38, FR49) | — (key never in frontend) | `main.py` (CORS, env), `agent.py` (sentence IDs) |
| Topic Generation / M3 (FR6, FR8, FR23-24) | `ProposalPanel.tsx`, `PathModeToggle.tsx`, `authoringStore.ts` (proposal state) | `agent.py` (Path B flow) |

---

### Data Flow

```
[RT types English story]
  → StoryInputPanel → authoringStore (inputText, chapterTarget, steeringInstructions)
  → useSession debounced write → localStorage

[RT clicks Generate]
  → authoringStore.generate()
  → useAgUiRun opens SSE: GET /run_sse?runId=<uuid>&...
  → main.py → agent.py
      ├── data_loader (frozen CSV data already in memory)
      ├── build system prompt (vocab + grammar injected)
      └── Gemini structured output → Pydantic validation
          → validator.validate() → ValidationResult
          ├── valid:   emit RUN_FINISHED (assembled JSON)
          └── invalid: emit ERROR

[AG-UI stream → frontend]
  → useAgUiRun parses events → dispatches store actions
  → ProgressIndicator reads phase
  → OutputPanel reads outputJson (populated on RUN_FINISHED only)

[RT clicks Save]
  → authoringStore.save()
  → validateStoryJson(outputJson) via @nihonnohon/story-loader
  ├── passes: downloadStoryFile({id}.json, UTF-8 no BOM)
  └── fails:  ValidationReport displays sentence-level errors
```

---

### Makefile Targets (`apps/story-generator-backend/Makefile`)

```makefile
.PHONY: dev generate-models test

generate-models:
	datamodel-codegen \
	  --input ../../packages/schema/schemas/story.v1.json \
	  --input-file-type jsonschema \
	  --output-model-type pydantic_v2.BaseModel \
	  --output src/story_generator/models.py
	@echo "# AUTO-GENERATED from story.v1.json — do not edit manually" \
	  | cat - src/story_generator/models.py > /tmp/models.py \
	  && mv /tmp/models.py src/story_generator/models.py

dev:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; true
	@lsof -ti:5174 | xargs kill -9 2>/dev/null; true
	python -m uvicorn story_generator.main:app --port 8000 --reload & \
	BACKEND_PID=$$!; \
	trap "kill $$BACKEND_PID 2>/dev/null" EXIT; \
	cd ../story-generator && pnpm dev

test:
	pytest
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are mutually compatible. React 18 + Vite 5 + TypeScript strict + Tailwind + shadcn/ui is the proven `apps/web` stack with no version conflicts. Zustand 4.5.4 is compatible with React 18. The `ag-ui-protocol` Python SDK (v0.1.18) aligns with the ADK `/run_sse` SSE endpoint. Pydantic v2 is supported by `datamodel-code-generator` with `--output-model-type pydantic_v2.BaseModel`. Vitest + `@testing-library/react` is compatible with Vite. `@nihonnohon/story-loader` is built with tsup dual CJS+ESM output — it will bundle correctly via Vite in `validateStoryJson.ts`.

**Pattern Consistency:**
Python snake_case → TypeScript camelCase → AG-UI camelCase event payloads forms a coherent chain with no naming collisions at boundaries. Single-store Zustand + exported selectors + injected `EventSource` transport is internally consistent. Session versioning with wipe-on-mismatch is consistent with the defensive error handling philosophy throughout.

**Structure Alignment:**
`apps/story-generator/` as a workspace member correctly grants access to `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config`. The Vite proxy in `vite.config.ts` (forwarding `/run_sse`, `/cancel`, `/health` to port 8000) eliminates CORS issues in development without leaking credentials. `apps/story-generator-backend/` exclusion from pnpm workspace is consistent with ADR 003 (updated path). No structural contradictions found.

---

### Requirements Coverage Validation ✅

**Functional Requirements — all 44 v1 FRs covered:**

| Category | FRs | Coverage |
|---|---|---|
| Story Input & Configuration | FR1-5, FR46, FR50 | `StoryInputPanel.tsx`, `authoringStore.ts`, `useSession.ts` |
| Story Generation | FR7-14, FR47-48, FR51 | `agent.py`, `useAgUiRun.ts`, `GenerateButton.tsx`, `BackendHealthBanner.tsx` |
| Curriculum Calibration | FR15-18 | `data_loader.py` + `agent.py` system prompt |
| Output Review & Editing | FR19-24 | `OutputPanel.tsx`, `authoringStore.ts`, `ProposalPanel.tsx` (M3) |
| Output Validation | FR25-34 | `validateStoryJson.ts`, `validator.py`, `ValidationReport.tsx` |
| File Download | FR35-36 | `downloadStoryFile.ts` |
| Security & Configuration | FR37-38, FR49 | `main.py` (env), `agent.py` (sentence IDs); FR38 as inline note in `StoryInputPanel.tsx` |
| Community Authoring | FR39-45 | Deferred to v2 — correctly out of scope |

**Non-Functional Requirements — all 10 covered:**

| NFR | Coverage |
|---|---|
| NFR1: 60s generation timeout | `useAgUiRun.ts` timeout → `error` state |
| NFR2: 3s first-event window | `ProgressIndicator.tsx` "Connecting…" + timeout trigger |
| NFR3: 200ms UI interactions | Zustand synchronous state updates; no blocking I/O in UI path |
| NFR4: 5s health check | `useAgUiRun.ts` pre-flight + `BackendHealthBanner.tsx` 60s poll |
| NFR5-7: Security (key, .env, no server data) | `main.py` env-only key; `.env` gitignored; localStorage-only session |
| NFR8-10: Reliability | `error` state preserves inputs; storage degradation silent; health re-checks every 60s |
| NFR11-13: Output integrity | `validateStoryJson.ts` + `@nihonnohon/story-loader`; `validator.py` pre-emit; UTF-8 no BOM in `downloadStoryFile.ts` |

---

### Implementation Readiness Validation ✅

**Decision completeness:** All critical decisions documented with specific versions, rationale, and explicit handling of edge cases (stale phase restore, cancel timing race, `outputIsDirty` latch semantics, `TEXT_MESSAGE_CHUNK` buffer strategy).

**Structure completeness:** Every file is named and purpose-annotated. FR→file mapping is explicit. No placeholder directories.

**Pattern completeness:** All 6 identified conflict points resolved. Naming, structure, format, communication, and process patterns are fully specified with anti-patterns and concrete examples.

---

### Gap Analysis Results

**Critical gaps: None.**

**Important gaps (3 — all on the pre-implementation checklist):**

1. `docs/adr/004-agui-event-types.md` — referenced throughout; not yet written. Must be created before `useAgUiRun.ts` or `agent.py` event emission is implemented.
2. ADR 003 update — `docs/adr/003-story-generator-out-of-scope.md` still references `apps/story-generator/` as the Python project. Must be updated.
3. `pnpm-workspace.yaml` — `apps/story-generator` must be added before any frontend package installation.

**Nice-to-have:**
- `tools.py` interface (tool name, parameter schema, return type) should be sketched at M1 time even if empty — so M2 has a clear seam to expand.
- `README.md` note on running the backend from the correct CWD for `DATA_DIR` default to resolve correctly.

---

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

All 16 checklist items confirmed. No critical gaps remain. The three important gaps are pre-implementation tasks that must be completed before Story-1, not before architecture sign-off.

**Confidence level: High**

**Key strengths:**
- Brownfield schema contract fully addressed via codegen (eliminates highest-probability maintenance failure)
- State machine is explicit and complete, tested through two multi-agent review rounds
- v1→v2 upgrade path is config-only by design
- Test harness is defined and the first three tests are written as acceptance criteria
- All 6 agent conflict points resolved with anti-patterns and concrete examples

**Areas for future enhancement (v2):**
- Authentication layer (Cloud Run + Vercel identity)
- Per-sentence regeneration UI
- Story preview mode (nihonnohon reader embed)
- Community submission and moderation queue
- WCAG 2.1 AA accessibility pass

---

### Implementation Handoff

**AI Agent Guidelines:**
- Read `docs/adr/004-agui-event-types.md` before implementing `useAgUiRun.ts` or any backend event emission
- Never hand-edit `models.py` — run `make generate-models`
- Dispatch all phase transitions through store actions only
- `useAgUiRun` is the only SSE consumer — inject `createEventSource` for testability
- Complete the pre-implementation checklist before starting Story-1

**First implementation priority (M0):**
```bash
# Pre-implementation checklist
# 1. Write docs/adr/004-agui-event-types.md
# 2. Update docs/adr/003-story-generator-out-of-scope.md
# 3. Add apps/story-generator to pnpm-workspace.yaml
# 4. cd apps/story-generator-backend && make generate-models

# M0 spike — backend only, no UI:
# Single Gemini call; validate output passes jsonschema + loadStory()
# Gate: if spike fails, revisit M1 scope before any UI work begins
```
