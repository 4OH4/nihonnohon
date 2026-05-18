---
project_name: 'nihonnohon-story-generator'
user_name: 'RT'
date: '2026-05-18'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
optimized_for_llm: true
---

# Story Generator — Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in the Story Authoring Tool. Covers both `apps/story-generator/` (React/Vite frontend) and `apps/story-generator-backend/` (Python ADK backend)._

---

## Technology Stack & Versions

**Monorepo position**
- Package manager: pnpm (workspaces)
- `apps/story-generator/` — **pnpm workspace member** (has access to shared tooling)
- `apps/story-generator-backend/` — **NOT in pnpm workspace** (Python project; ADR 003 constraint)

**Frontend** (`apps/story-generator/`)
- React 18.3.1
- Vite 5.3.0 — dev port **5174** (not 5173; avoid clash with `apps/web`)
- TypeScript 5.5.0 (strict mode, bundler moduleResolution, ES2022 target)
- Zustand 4.5.4
- Tailwind CSS 3.4.0 (standalone config; mirrors `apps/web` tokens + adds `success` and `warning`)
- shadcn/ui primitives (copied from `apps/web`, not imported as package)
- clsx 2.1.0 + tailwind-merge 2.3.0 (via `cn()` utility at `@/lib/utils`)
- `@nihonnohon/story-loader` (workspace) — used for client-side validation on Save
- No client-side routing — single-view SPA; no `react-router-dom`

**Backend** (`apps/story-generator-backend/`)
- Python ≥ 3.11
- FastAPI (ASGI, uvicorn with `--reload` in dev)
- google-adk (Google Agent Development Kit)
- ag-ui-protocol ≥ 0.1.18 (AG-UI Python SDK; SSE transport; camelCase event payloads)
- Pydantic ≥ 2.0
- datamodel-code-generator (generates `models.py` from `story.v1.json`)
- python-dotenv, jsonschema
- Backend port: **8000** (ADK default)

**Testing — frontend**
- Vitest 3.0.0 (`globals: true`, jsdom environment)
- `@testing-library/react` 16.3.2 + `@testing-library/user-event`
- `@testing-library/jest-dom` (imported in `src/__tests__/setup.ts`)

**Testing — backend**
- pytest; `testpaths = ["tests"]` in `pyproject.toml`

**Schema source of truth:** `packages/schema/schemas/story.v1.json`

---

## Language-Specific Rules

### TypeScript (frontend)

- `strict: true` everywhere — no implicit any, no loose nulls
- `moduleResolution: "bundler"` — do not use `"node"` or `"node16"`
- All source is ESM (`"type": "module"` in package.json)
- Path alias `@/` maps to `apps/story-generator/src/` — use for all intra-app imports
- Do not use relative `../../` paths when `@/` applies
- Utility for class merging: `import { cn } from '@/lib/utils'`

### Python (backend)

- Python 3.11+ syntax (`from __future__ import annotations` at module top)
- All public functions and classes get a one-line docstring
- Data types exposed across module boundaries use `@dataclass(frozen=True)` — never plain dicts
- `validator.validate()` **never raises** — always returns `ValidationResult`
- Module-level mutable state is acceptable only for startup-loaded data (e.g., `_vocab_data`, `_grammar_data`) and the in-flight run registry (`_active_runs`)
- `models.py` is **auto-generated** — never hand-edit; run `make generate-models` after any change to `story.v1.json`

### Imports

- Internal monorepo packages: `@nihonnohon/<name>` (workspace references)
- No cross-app imports between `apps/story-generator` and `apps/web`
- shadcn/ui primitives are **copied** into `apps/story-generator/src/components/ui/` — do not import from `apps/web`

---

## Framework-Specific Rules

### Application Architecture — Single-View SPA

There is no client-side router. `App.tsx` renders `<AuthoringTool />` directly. All UI state lives in `useAuthoringStore`. Do not add `react-router-dom` or route components.

### State Machine (Zustand — `authoringStore.ts`)

The entire application state is one discriminated `Phase`:

```
idle → generating → output-clean → output-dirty → downloading → output-clean
                 → cancelling   → idle
                 → error        → generating (retry) | idle (clear)
                 → proposal     → generating (approve) | idle (clear)
```

**Phase type** (exact string literals):
```typescript
type Phase = 'idle' | 'generating' | 'cancelling' | 'output-clean' | 'output-dirty' | 'downloading' | 'error' | 'proposal'
```

**Store interface additions vs. architecture doc** (implemented in code):
- `temperature: number` — LLM temperature parameter
- `grammarDist: 0 | 1 | 2` — grammar distribution setting
- `storedInputs: StoredInputs | null` — snapshot of all generation inputs taken at `generate()` time; used for SSE URL construction and `rerun()`
- `agentRunStarted: boolean` — true once `RUN_STARTED` is received; reset on each `generate()`
- `rerun()` — separate action from `generate()`; valid from `output-clean` and `output-dirty`; reuses `storedInputs` snapshot
- `_editOutputJson(v)` — called by `OutputPanel` on textarea change; latches dirty state on first call from `output-clean`
- `_markRunStarted()` — sets `agentRunStarted = true`; called by `useAgUiRun` on `RUN_STARTED`
- `validationErrors: ValidationError[]` — *(Story 2.8)* errors from last `save()` call; empty array = valid; `ValidationError = { rule, message, sentenceIndex?, path? }`
- `downloadToastId: string | null` — *(Story 2.8)* set to story id on successful download; drives the 4-second toast in `OutputPanel`; cleared by `_clearDownloadToast()`
- `sessionRestored: boolean` — *(Story 2.9)* true after `useSession` restores a non-empty session; cleared on first input edit or `clear()`; drives `SessionRestoreBanner` in `InputPanel`
- `save()` — *(Story 2.8, fully implemented)* validates `outputJson` via `validateStoryJson()`, triggers download via `downloadStoryFile()`, transitions `downloading → output-clean`; sets `validationErrors` on failure; recovers to `error` if download throws
- `_clearDownloadToast()` — *(Story 2.8)* sets `downloadToastId = null`; called by `OutputPanel` after toast is shown
- `_setSessionRestored(v)` — *(Story 2.9)* sets `sessionRestored`; called by `useSession` on hydration and by `InputPanel` on first input edit

**`generate()` from `error` state** performs implicit retry: clears `errorCode`/`errorMessage`, generates new `runId`, transitions to `generating`. No `clear()` required first.

**Exported selectors** (in `authoringStore.ts`; always use these in components, never derive inline):
```typescript
export const selectIsGenerating = (s: AuthoringStore) => s.phase === 'generating'
export const selectCanGenerate  = (s: AuthoringStore) => s.phase === 'idle' || s.phase === 'error'
export const selectCanSave      = (s: AuthoringStore) => s.outputJson !== null && (s.phase === 'output-clean' || s.phase === 'output-dirty')
export const selectCanCancel    = (s: AuthoringStore) => s.phase === 'generating' || s.phase === 'cancelling'
```

**`outputIsDirty` is a one-way latch:**
- Flips to `true` on the first `_editOutputJson` or `_markDirty` call after reaching `output-clean`
- Stays `true` even if the user reverts to the original text
- Reset to `false` only by `clear()` or a completed `generate()` / `rerun()` cycle

### AG-UI Streaming Hook (`useAgUiRun`)

`useAgUiRun` is the **sole** SSE consumer in the app. Components never instantiate `EventSource`.

**EventSource is injected for testability:**
```typescript
export function useAgUiRun(
  createEventSource: (url: string) => EventSource = (url) => new EventSource(url)
): void
```
Tests inject a `MockEventSource`. This is the only approved SSE mock strategy.

**SSE URL construction uses `storedInputs` snapshot**, not current store state. This ensures URL consistency with `runId` regardless of concurrent user edits during generation.

**`TEXT_MESSAGE_CHUNK` events accumulate in a hook-internal buffer only** — never written to the store. On `RUN_FINISHED`, the complete assembled buffer is committed to `outputJson` in one atomic store update via `_setOutputJson()`.

**Event → store mapping (per ADR-004):**
| AG-UI event | Store action |
|---|---|
| `RUN_STARTED` | `_markRunStarted()`; clears first-event timeout |
| `TEXT_MESSAGE_CHUNK` | accumulate `delta` in hook-internal buffer; no store write |
| `RUN_FINISHED` (`resultType: 'story'`) | `_setOutputJson(buffer)`; phase → `output-clean` |
| `RUN_FINISHED` (`resultType: 'proposal'`) | `_setProposalText(buffer)`; phase → `proposal` |
| `ERROR` | `_setError(code, message)`; phase → `error` |
| `RUN_CANCELLED` | `_resolveCancel()`; phase → `idle`; inputs preserved |
| unexpected stream close (no `RUN_FINISHED`) | `_setError('BACKEND_UNAVAILABLE', '...')`; phase → `error` |

**Timeouts enforced by `useAgUiRun`:**
- 3 s first-event timeout: if no `RUN_STARTED` arrives, health-checks `/health`; sets `error` if unavailable
- 60 s generation timeout: if still generating, sets `TIMEOUT` error

**Cancellation** — on phase transition to `cancelling`, hook sends `POST /cancel/{runId}`. SSE stream remains open until `RUN_CANCELLED` event arrives.

**ADR-004 is authoritative.** Read `docs/adr/004-agui-event-types.md` before implementing or modifying `useAgUiRun` or any backend event emission. No event types outside that ADR may be used.

### Session Persistence Hook (`useSession`)

`useSession` is mounted once in `AuthoringTool.tsx` alongside `useAgUiRun`. It owns all localStorage reads and writes. Components never access localStorage directly.

**localStorage key:** `'nihonnohon-sg-session'` (export `SESSION_KEY` from `useSession.ts`)

**`SessionState` schema:**
```typescript
interface SessionState {
  version: 1
  phase: Phase
  inputText: string; chapterTarget: string; steeringInstructions: string
  pathMode: 'A' | 'B'; temperature: number; grammarDist: 0 | 1 | 2
  outputJson: string | null; outputIsDirty: boolean
}
```

**On mount (one-shot):** reads localStorage, validates `version === 1`, maps stale phases (`generating`, `cancelling`, `downloading`) to `output-clean` (if `outputJson` present) or `idle`; batch-sets store; calls `_setSessionRestored(true)` if meaningful content restored.

**On store change (subscribe):** writes immediately on phase transition; debounced 300ms on input-only changes; removes session from localStorage when store reaches cleared/default state; flushes pending write synchronously on hook cleanup (unmount).

**Sanitization on restore:** `outputIsDirty: true` + `outputJson: null` → sanitized to `outputIsDirty: false` (inconsistent state is corrected, not propagated).

### AG-UI Event Payloads

All event payloads use **camelCase** field names (ag-ui-protocol SDK convention):
```json
{ "type": "RUN_STARTED",       "runId": "<string>" }
{ "type": "TEXT_MESSAGE_CHUNK","delta": "<string>" }
{ "type": "RUN_FINISHED",      "resultType": "story"|"proposal", "content": "<string>" }
{ "type": "ERROR",             "code": "<SCREAMING_SNAKE_CASE>", "message": "<string>" }
{ "type": "RUN_CANCELLED",     "runId": "<string>" }
{ "type": "AGENT_STATUS",      "message": "<string>" }  // M2 only; see ADR-004
```

Standard error codes: `GENERATION_FAILED`, `VALIDATION_ERROR`, `TIMEOUT`, `CANCELLED`, `BACKEND_UNAVAILABLE`, `PARALLEL_ARRAY_MISMATCH`, `SCHEMA_INVALID`, `MISSING_FIELD`.

### Vite Dev Proxy

`vite.config.ts` proxies these paths to the backend at `localhost:8000`:
- `/run_sse`
- `/cancel`
- `/health`

No CORS issues in development. Never hardcode `localhost:8000` in frontend code.

### Styling (Tailwind)

Design tokens (must use these; no arbitrary colours):

| Token | Value |
|---|---|
| `paper-bg` | `#FDF6E3` |
| `paper-text` | `#1C1C1C` |
| `surface` | `#FFFFFF` |
| `surface-subtle` | `#F5F5F0` |
| `accent` | `#C8A85A` |
| `accent-subtle` | `#F5EDD6` |
| `muted` | `#6B6B6B` |
| `border` | `#E0D8C8` |
| `error` | `#C0392B` |
| `translation` | `#4A7B9D` |
| `success` | `#22C55E` _(not in `apps/web`)_ |
| `warning` | `#F59E0B` _(not in `apps/web`)_ |

- Japanese text: always apply `font-ja` class (Noto Sans JP)
- Always compose classes with `cn()` — never raw string concatenation
- Tailwind config is standalone (not extending `apps/web`'s config directly) but tokens are identical except for `success` and `warning`
- `shimmer` animation and keyframes are defined for progress indicator use

### Backend (`apps/story-generator-backend/`)

**CORS:** `ALLOWED_ORIGIN` env var drives the allowed origin (default: `http://localhost:5174`). Never hardcode. Health endpoint (`GET /health`) always returns `Access-Control-Allow-Origin: *` so ops tooling and Cloud Run probes can reach it.

**CSV reference data** is loaded once at startup (FastAPI lifespan event) into module-level variables. Path resolved from `DATA_DIR` env var (default: `../../resources/` relative to backend root). Returned as `@dataclass(frozen=True)` instances — immutable at runtime.

**`validator.validate(story_dict)`** checks:
1. Required top-level fields (`schema_version`, `id`, `title`, `title_ja`, `language`, `description`, `sentences`)
2. Parallel array parity per sentence (`words`, `ruby`, `vocab_keys` must be equal length)
3. `sentence.id` presence per sentence

Backend validates before emitting `RUN_FINISHED`. If validation fails, the backend emits `ERROR` instead.

**`models.py` header:** `# AUTO-GENERATED from story.v1.json — do not edit manually`. Any Pydantic model change requires editing `story.v1.json` then running `make generate-models`.

---

## Testing Rules

### Frontend (Vitest)

- Test files in `apps/story-generator/src/__tests__/`; named `*.test.ts` or `*.test.tsx`
- Vitest globals enabled — no need to import `describe`/`it`/`expect`
- Environment: jsdom (set in `vite.config.ts`)
- `setupFiles: ['./src/__tests__/setup.ts']` — imports `@testing-library/jest-dom` matchers
- Run: `pnpm test:unit` from `apps/story-generator/`

**`useAgUiRun` test pattern — inject `MockEventSource`:**

```typescript
class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror:   ((e: Event) => void) | null = null
  close = vi.fn()

  emit(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }
}

const mockEs = new MockEventSource()
renderHook(() => useAgUiRun(() => mockEs as unknown as EventSource))

// Trigger phase → generating in the store first, then emit events:
act(() => useAuthoringStore.getState().generate())
act(() => mockEs.emit({ type: 'RUN_STARTED', runId: '...' }))
```

**Zustand store reset between tests:** Call `useAuthoringStore.getState()._reset()` in `beforeEach`.

### Backend (pytest)

- Test files in `apps/story-generator-backend/tests/`; named `test_*.py`
- Run: `pytest` from `apps/story-generator-backend/` (or `make test`)
- `test_contract.py` — validates Pydantic output against `story.v1.json` schema; calls `loadStory()` against a fixture via Node subprocess (cross-language contract test)
- `test_validator.py` — tests that `validate()` returns correct `ValidationResult` and never raises

---

## Code Quality & Style Rules

### Naming Conventions

**Frontend:**
- Components: PascalCase `.tsx` files, named export matching filename (e.g. `BackendStatus.tsx` → `export function BackendStatus`)
- Hooks: `use` prefix camelCase (`useAgUiRun.ts`, `useBackendStatus.ts`)
- Store: `authoringStore.ts` → `export const useAuthoringStore`
- Utilities: camelCase (`validateStoryJson.ts`, `downloadStoryFile.ts`)
- Test files: `*.test.ts` / `*.test.tsx`

**Backend:**
- Module files: snake_case (`agent.py`, `models.py`, `tools.py`, `validator.py`, `data_loader.py`)
- Functions: snake_case (`load_vocab_csv()`, `build_system_prompt()`, `validate()`)
- Pydantic model fields: snake_case (matching `story.v1.json` wire format — no transformation needed)
- Test files: `test_agent.py`, `test_models.py`, `test_contract.py`, `test_validator.py`

### File Organisation

**Frontend (`apps/story-generator/src/`):**
```
src/
  components/ui/    # shadcn/ui primitives (copied from apps/web)
  components/       # feature components — one file per component
                    #   AuthoringTool, BackendStatus, GenerationProgress, InputPanel,
                    #   JsonOutput, ModeToggle, OutputPanel, ScopeChip, SettingsPanel,
                    #   StatsBar, ValidationErrorList
  stores/           # authoringStore.ts (single store; exports ValidationError type)
  hooks/            # useAgUiRun.ts, useBackendStatus.ts, useSession.ts
  lib/              # cn.ts, utils.ts, validateStoryJson.ts, downloadStoryFile.ts
  __tests__/        # Vitest unit tests (180 tests as of Epic 2)
    fixtures/       # JSON story fixtures for validateStoryJson tests
```

**Backend (`apps/story-generator-backend/`):**
```
src/story_generator/
  __init__.py
  agent.py          # ADK agent; system prompt assembly; CSV data injection
  models.py         # AUTO-GENERATED — never hand-edit
  tools.py          # ADK tool definitions (M2+; stub in M1)
  validator.py      # validate(dict) → ValidationResult; never raises
  data_loader.py    # CSV loading at startup; returns frozen dataclasses
  main.py           # FastAPI app; CORS; /health, /run_sse, /cancel endpoints; lifespan CSV load
tests/
  __init__.py
  test_contract.py
  test_validator.py
  test_agent.py
```

### Comments

- Write succinct JSDoc/TSDoc docstrings for all exported functions and components
- Add inline block comments to label major functional sections within a function body
- Do not narrate obvious code — comments explain structure and intent, not mechanics

### ESLint (frontend)

- Config: `@nihonnohon/eslint-config/react` (shared workspace package)
- `@typescript-eslint/no-unused-vars`: warn; args prefixed `_` are ignored
- `// eslint-disable-next-line react-hooks/exhaustive-deps` is acceptable on `useEffect` deps arrays where the dependency list is intentionally restricted (e.g., `[store.phase, store.runId]` in `useAgUiRun`)

---

## Development Workflow Rules

### Commands

**Frontend:**
- `pnpm dev` — start Vite dev server on port 5174 (run from `apps/story-generator/`)
- `pnpm build` — TypeScript compile + Vite build
- `pnpm typecheck` — type-check only
- `pnpm test:unit` — run Vitest unit tests
- `pnpm lint` — ESLint

**Backend + Frontend together:**
- `make dev` — from `apps/story-generator-backend/`; clears stale ports 8000 and 5174, starts uvicorn + Vite, kills Python on Vite exit

**Backend only:**
- `make test` — run pytest
- `make generate-models` — regenerate `models.py` from `story.v1.json`; **run after any schema change**

### Ports

- Frontend Vite dev: **5174** (not 5173 — avoids conflict with `apps/web`)
- Backend FastAPI: **8000**
- Both are env-configurable for v2 deployment

### Schema Contract

`packages/schema/schemas/story.v1.json` is the single source of truth shared by both Python (Pydantic codegen) and TypeScript (`@nihonnohon/story-loader`). When `story.v1.json` changes:
1. Run `make generate-models` (backend Pydantic)
2. Rebuild `@nihonnohon/story-loader` (`pnpm build` in packages/story-loader)

### Environment Variables (backend)

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | _(required)_ | Gemini API key — never reaches frontend |
| `ALLOWED_ORIGIN` | `http://localhost:5174` | CORS allowed origin |
| `DATA_DIR` | `../../resources` | Path to CSV reference data directory |

`.env` is gitignored. `.env.example` documents all variables.

---

## Critical Don't-Miss Rules

### Anti-Patterns

- **Never dispatch phase changes from components.** Call `store.generate()`, `store.cancel()`, etc. Never `set({ phase: 'generating' })` from a component.
- **Never instantiate `EventSource` outside `useAgUiRun`.** Inject `createEventSource` factory for all SSE access.
- **Never hand-edit `models.py`.** Edit `story.v1.json` then `make generate-models`.
- **Never validate output on `onChange`.** Validation fires in `save()` action only.
- **Never reset `outputIsDirty` by string comparison.** It is a one-way latch; reset only via `clear()` or completed generation.
- **Never derive `isGenerating` / `canGenerate` inline in a component.** Use the exported selectors from `authoringStore.ts`.
- **Never use `storedInputs` for anything other than SSE URL params and re-run.** Current live inputs are in the store root; `storedInputs` is the snapshot taken at `generate()` time.
- **Never add client-side routing.** This is a single-view SPA — no `react-router-dom`.
- **Never use arbitrary Tailwind colours.** Only the custom tokens defined in `tailwind.config.ts` are on-brand.
- **Never let the Gemini API key reach the frontend.** Backend env var only.
- **Never emit AG-UI event types not listed in `docs/adr/004-agui-event-types.md`** without updating the ADR first.
- **Never write partial / intermediate output to `outputJson` during streaming.** The store receives one atomic write on `RUN_FINISHED` from the assembled buffer.

### Edge Cases

- `storedInputs` can be `null` on first mount (before any `generate()` call) — guard with `?? store.inputText` fallback as in `useAgUiRun`
- Unexpected SSE stream close (onerror fires before `RUN_FINISHED`) → `BACKEND_UNAVAILABLE` error; never treat as success
- Backend startup race: requests arriving before the lifespan CSV load completes receive `BACKEND_UNAVAILABLE` error — the guard in `main.py` checks `_vocab_data is None`
- `sentences: null` in a story dict is not valid — `validator.py` catches this explicitly (key present, value null)
- Every sentence must have a non-empty `id` — `validator.py` checks this per sentence

---

## Usage Guidelines

**For AI Agents:** Read `docs/adr/004-agui-event-types.md` before implementing `useAgUiRun` or any backend event emission. Follow all rules exactly as documented. Check the actual `authoringStore.ts` for the current store interface before adding actions or selectors — the implementation has evolved from the architecture doc.

**For Humans:** Keep this file lean and focused on agent needs. Update when technology, store interface, or AG-UI contract changes.

_Last updated: 2026-05-18 (post-Epic-2: added validationErrors, downloadToastId, sessionRestored, save(), useSession, AGENT_STATUS, file org)_
