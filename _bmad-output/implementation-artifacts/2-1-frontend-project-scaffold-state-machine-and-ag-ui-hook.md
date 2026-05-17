# Story 2.1: Frontend Project Scaffold, State Machine & AG-UI Hook

Status: done

## Story

As a developer,
I want the React app initialised with the Zustand authoring store and AG-UI hook wired up and tested,
so that all M1 component stories build on a proven state machine and SSE foundation.

## Acceptance Criteria

**AC1 — App scaffolded and running:**
Given `apps/story-generator/` contains only a README.md,
when the app is created from `npm create vite@latest -- --template react-ts`, Tailwind initialised, and shadcn/ui set up with the nihonnohon design tokens,
then `pnpm dev` (from `apps/story-generator/`) starts the app at port 5174; the Vite proxy forwards `/run_sse`, `/cancel`, and `/health` to port 8000; `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config` resolve from the workspace.

**AC2 — Store phase transition:**
Given the store is implemented in `src/stores/authoringStore.ts`,
when `generate()` is called from `idle` phase,
then `phase → 'generating'`; `runId` is set to a new UUID; `outputIsDirty` remains `false`.

**AC3 — Hook RUN_FINISHED mapping:**
Given `useAgUiRun.ts` is implemented with an injected `createEventSource` factory,
when a synthetic `RUN_FINISHED` (resultType='story') is emitted via `MockEventSource`,
then `_setOutputJson` is called with the content and `phase → 'output-clean'`; no real network call is made.

**AC4 — Tests pass:**
Given `vitest.config.ts` is in place,
when `pnpm test:unit` is run from `apps/story-generator/`,
then the two seeded tests (store phase transition + hook RUN_FINISHED mapping) both pass; `pnpm typecheck` passes with no errors.

## Tasks / Subtasks

- [x] AC1: Scaffold the Vite app
  - [x] From monorepo root run `cd apps/story-generator && npm create vite@latest . -- --template react-ts` (dot = current dir, preserving README.md)
  - [x] Install workspace deps: `pnpm install` from monorepo root
  - [x] Set up `tsconfig.json` extending `@nihonnohon/typescript-config/vite` (or equivalent base)
  - [x] Set up `eslint.config.js` (or `.eslintrc`) extending `@nihonnohon/eslint-config/react`
  - [x] Install and configure Tailwind CSS with `tailwind.config.ts` mirroring apps/web design tokens (see Dev Notes)
  - [x] Install `postcss` and `autoprefixer`; create `postcss.config.js`
  - [x] Add Tailwind directives to `src/index.css`
  - [x] Install and configure shadcn/ui with `cssVariables: false` (see Dev Notes)
  - [x] Set up `vite.config.ts`: port 5174, proxy `/run_sse` + `/cancel` + `/health` → `localhost:8000`, `@/` alias to `src/`
  - [x] Verify `pnpm dev` starts at 5174 and proxy rules are in place

- [x] AC1: Configure Vitest
  - [x] Add `vitest.config.ts` (or inline in `vite.config.ts`): `globals: true`, `environment: 'jsdom'`
  - [x] Create `src/__tests__/setup.ts` (import `@testing-library/jest-dom`)
  - [x] Add `"test:unit": "vitest run"` and `"typecheck": "tsc -b"` to `package.json` scripts

- [x] AC2: Implement `authoringStore.ts`
  - [x] Create `src/stores/authoringStore.ts` with the complete `Phase` discriminated union (all 8 phases — see Dev Notes)
  - [x] Implement `AuthoringStore` interface with all fields: `phase`, `inputText`, `chapterTarget`, `steeringInstructions`, `pathMode`, `outputJson`, `outputIsDirty`, `proposalText`, `proposalApproved`, `errorCode`, `errorMessage`, `runId`
  - [x] Implement public actions: `generate()`, `cancel()`, `approve()`, `save()`, `clear()`, setters
  - [x] Implement internal actions (called by `useAgUiRun` only): `_setOutputJson()`, `_setProposalText()`, `_markDirty()`, `_setError()`, `_resolveCancel()`
  - [x] Export selectors: `selectIsGenerating`, `selectCanGenerate`, `selectCanSave`, `selectCanCancel`
  - [x] `generate()` from `idle`: assign new UUID `runId`, `phase → 'generating'`, `outputIsDirty` unchanged (false)
  - [x] `generate()` from `error`: clear `errorCode`/`errorMessage`, new `runId`, `phase → 'generating'` (implicit retry — no `clear()` required)
  - [x] `outputIsDirty` one-way latch: flips true on `_markDirty()`; resets only via `clear()` or completed `generate()` cycle

- [x] AC3: Implement `useAgUiRun.ts`
  - [x] Create `src/hooks/useAgUiRun.ts` with signature: `function useAgUiRun(createEventSource?: (url: string) => EventSource): void`
  - [x] Default parameter: `(url) => new EventSource(url)` — factory never hard-coded in the hook body
  - [x] On `generate()` dispatch (when `phase → 'generating'`): open SSE connection to `/run_sse` with query params `runId`, `inputText`, `chapter`, `pathMode`, `steeringInstructions`, `temperature`, `grammar_distribution`
  - [x] Map AG-UI events per ADR-004: `RUN_STARTED` → confirm generating; `TEXT_MESSAGE_CHUNK` → accumulate in hook-internal buffer (never write to store); `RUN_FINISHED` → `_setOutputJson(assembled)`, `phase → output-clean`; `ERROR` → `_setError`; `RUN_CANCELLED` → `phase → idle`
  - [x] Unexpected stream close (no `RUN_FINISHED`) → `_setError('BACKEND_UNAVAILABLE', 'Connection lost — your inputs are preserved. Check the backend and retry.')`
  - [x] Implement 3s first-event timeout: if no `RUN_STARTED` within 3s, trigger health check; if unavailable → `_setError('BACKEND_UNAVAILABLE', ...)`
  - [x] Implement 60s generation timeout: if no `RUN_FINISHED`, `_setError('TIMEOUT', 'This took longer than expected — your inputs are preserved. Try again.')`
  - [x] On `cancel()` dispatch: `phase → 'cancelling'`; `POST /cancel/{runId}` with `{ "type": "CANCEL", "runId": "..." }`; resolve to `idle` on `RUN_CANCELLED`

- [x] Create `src/lib/cn.ts` (className utility, mirrors apps/web)

- [x] AC4: Write the two seed tests
  - [x] `src/__tests__/authoringStore.test.ts`: test `generate()` from `idle` → `phase === 'generating'`, `runId` is a non-null string, `outputIsDirty === false`
  - [x] `src/__tests__/useAgUiRun.test.ts`: implement `MockEventSource`; emit synthetic `RUN_FINISHED (resultType='story')`; assert `_setOutputJson` called with content and `phase === 'output-clean'`
  - [x] Run `pnpm test:unit` — both pass
  - [x] Run `pnpm typecheck` — no errors

- [x] Update sprint status

### Review Findings (AI)

- [x] [Review][Patch] Hook reads live store inputs instead of `storedInputs` snapshot for SSE URL params [useAgUiRun.ts:~40]
- [x] [Review][Patch] Cancel POST `.catch` can corrupt state after phase moves past `cancelling` [useAgUiRun.ts:~165]
- [x] [Review][Patch] `components.json` for shadcn/ui missing — AC1 requires shadcn/ui to be set up [apps/story-generator/]
- [x] [Review][Patch] `bufferRef.current || parsed.content` fallback bypasses accumulation contract [useAgUiRun.ts:~121]
- [x] [Review][Patch] `approve()` does not snapshot `storedInputs` — needed once hook uses snapshot [authoringStore.ts:~106]
- [x] [Review][Patch] Missing test for `generate()` from `error` phase (implicit retry) [authoringStore.test.ts]
- [x] [Review][Patch] First-event timeout `.catch` missing phase re-check after async health check [useAgUiRun.ts:~74]
- [x] [Review][Patch] `useAgUiRun.test.ts` needs `vi.useFakeTimers()` to prevent timeout leaking into teardown [useAgUiRun.test.ts]
- [x] [Review][Defer] `clear()` during generating leaves SSE connection open until next render — deferred, pre-existing [authoringStore.ts / useAgUiRun.ts]
- [x] [Review][Defer] `steeringInstructions` empty-string vs not-provided ambiguity — deferred, Story 2.2 API contract [useAgUiRun.ts]
- [x] [Review][Defer] `crypto.randomUUID()` requires secure context — deferred, localhost+HTTPS covers all deployment targets [authoringStore.ts]
- [x] [Review][Defer] `_resolveCancel()` leaves `storedInputs` intact — deferred, Re-run design resolved in Story 2.6 [authoringStore.ts]
- [x] [Review][Defer] `generate()` from error doesn't clear `outputJson` — deferred, no UI component reads it in Story 2.1 [authoringStore.ts]
- [x] [Review][Defer] `approve()` doesn't clear stale `outputJson`/`proposalText` — deferred, Path B scope Story 4.3 [authoringStore.ts]

## Dev Notes

### Current state of `apps/story-generator/`

Only `README.md` exists. The Vite app must be created from scratch. Use the `.` form of `npm create vite` to scaffold into the existing directory (or scaffold into a temp dir and merge). The README.md must be preserved.

`apps/story-generator` is already in `pnpm-workspace.yaml` (added in Epic 1 Story 1.1) and `docs/adr/003-story-generator-out-of-scope.md` is already updated — these ARCH-2 / ARCH-3 prerequisites are done.

### `vite.config.ts` — port and proxy

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/run_sse': 'http://localhost:8000',
      '/cancel':  'http://localhost:8000',
      '/health':  'http://localhost:8000',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
```

### Tailwind config — exact token values from apps/web

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'paper-bg':       '#FDF6E3',
        'paper-text':     '#1C1C1C',
        surface:          '#FFFFFF',
        'surface-subtle': '#F5F5F0',
        accent:           '#C8A85A',
        'accent-subtle':  '#F5EDD6',
        muted:            '#6B6B6B',
        border:           '#E0D8C8',
        error:            '#C0392B',
        translation:      '#4A7B9D',
      },
      fontFamily: {
        ja: ['Noto Sans JP', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

### shadcn/ui setup

Initialize with: `pnpm dlx shadcn@latest init` — select **no CSS variables** (`cssVariables: false`) and **default** style. This story only installs the shell; individual shadcn components (Button, Collapsible, Sheet, Toast) are added in Stories 2.3–2.9 as needed.

The `components.json` for shadcn must NOT use `cssVariables: true` — this project uses custom Tailwind tokens, not CSS variables.

### Complete `AuthoringStore` interface

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
  temperature: number           // default 1.0; range 0.0–2.0
  grammarDist: 0 | 1 | 2        // 3-position: 0=fewer, 1=balanced, 2=more
  outputJson: string | null
  outputIsDirty: boolean
  proposalText: string | null
  proposalApproved: boolean
  errorCode: string | null
  errorMessage: string | null
  runId: string | null
  storedInputs: { inputText: string; chapterTarget: string; steeringInstructions: string } | null

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
  setTemperature: (v: number) => void
  setGrammarDist: (v: 0 | 1 | 2) => void

  // Internal actions — used by useAgUiRun only
  _setOutputJson: (v: string) => void
  _setProposalText: (v: string) => void
  _markDirty: () => void
  _setError: (code: string, message: string) => void
  _resolveCancel: () => void
}
```

**`generate()` must snapshot `storedInputs`** when transitioning to `generating` — this is what Re-run uses later. Snapshot = `{ inputText, chapterTarget, steeringInstructions }` at the moment generate is called.

**Selectors (exported from `authoringStore.ts`):**
```typescript
export const selectIsGenerating = (s: AuthoringStore) => s.phase === 'generating'
export const selectCanGenerate  = (s: AuthoringStore) => s.phase === 'idle' || s.phase === 'error'
export const selectCanSave      = (s: AuthoringStore) =>
  s.outputJson !== null && (s.phase === 'output-clean' || s.phase === 'output-dirty')
export const selectCanCancel    = (s: AuthoringStore) =>
  s.phase === 'generating' || s.phase === 'cancelling'
```

### `useAgUiRun` — injected EventSource factory

The hook must **never** call `new EventSource(url)` directly in the hook body. The factory is injected:

```typescript
function useAgUiRun(
  createEventSource: (url: string) => EventSource = (url) => new EventSource(url)
): void { ... }
```

This is the only approved SSE mock strategy. Tests inject `MockEventSource`.

**TEXT_MESSAGE_CHUNK accumulation rule:** Chunks accumulate in a `useRef` buffer inside the hook. The store's `outputJson` is never written during streaming — only after `RUN_FINISHED`, when the complete assembled string is committed atomically via `_setOutputJson`.

**AG-UI event mapping (per ADR-004):**
- `RUN_STARTED` → confirm `phase === 'generating'`; runId confirmed
- `TEXT_MESSAGE_CHUNK` → `buffer.current += event.delta` (no store write)
- `RUN_FINISHED` (resultType='story') → `_setOutputJson(buffer.current)`; clear buffer; `phase → 'output-clean'`
- `RUN_FINISHED` (resultType='proposal') → `_setProposalText(buffer.current)`; clear buffer; `phase → 'proposal'` (M3)
- `ERROR` → `_setError(event.code, event.message)`
- `RUN_CANCELLED` → `_resolveCancel()` (phase → idle, runId → null)
- stream close without `RUN_FINISHED` → `_setError('BACKEND_UNAVAILABLE', 'Connection lost...')`

### MockEventSource pattern for tests

```typescript
class MockEventSource {
  private handlers: Record<string, ((e: MessageEvent) => void)[]> = {}
  
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    this.handlers[type] = [...(this.handlers[type] ?? []), handler]
  }
  
  dispatchEvent(type: string, data: object) {
    const event = { data: JSON.stringify(data) } as MessageEvent
    this.handlers[type]?.forEach(h => h(event))
  }
  
  close() {}
}
```

### `cn.ts` utility

```typescript
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely — always use this instead of string concatenation. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Requires: `pnpm add clsx tailwind-merge`

### tsconfig.json guidance

Extend `@nihonnohon/typescript-config/vite` if that base exists in the package, otherwise use:

```json
{
  "extends": "@nihonnohon/typescript-config/base",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

Check what base configs are exported from `packages/typescript-config/` before writing this.

### package.json — key dependencies for this story

```json
{
  "name": "@nihonnohon/story-generator",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@nihonnohon/story-loader": "workspace:*",
    "clsx": "^2.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.3.0",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@nihonnohon/eslint-config": "workspace:*",
    "@nihonnohon/typescript-config": "workspace:*",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^3.0.0"
  }
}
```

Note: `@nihonnohon/story-loader` is needed for `validateStoryJson.ts` (Story 2.8) but good to include early.

### Seed test outlines

**`src/__tests__/authoringStore.test.ts`:**
```typescript
import { useAuthoringStore } from '../stores/authoringStore'

describe('authoringStore — generate() from idle', () => {
  beforeEach(() => useAuthoringStore.getState()._reset?.())

  it('transitions phase to generating', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('assigns a non-null runId', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().runId).toBeTruthy()
  })

  it('does not set outputIsDirty', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })
})
```

Include `_reset` alongside public actions (standard Zustand test teardown pattern from project-context.md). See: [project-context.md — Zustand section](../../_bmad-output/project-context.md).

**`src/__tests__/useAgUiRun.test.ts`:**
```typescript
import { renderHook, act } from '@testing-library/react'
import { useAgUiRun } from '../hooks/useAgUiRun'
import { useAuthoringStore } from '../stores/authoringStore'

// MockEventSource (defined at module level — see Dev Notes)

it('RUN_FINISHED (story) calls _setOutputJson and transitions to output-clean', async () => {
  const mockEs = new MockEventSource()
  const factory = (_url: string) => mockEs as unknown as EventSource

  useAuthoringStore.getState().generate()  // phase → generating
  renderHook(() => useAgUiRun(factory))

  act(() => {
    mockEs.dispatchEvent('message', {
      type: 'RUN_FINISHED', resultType: 'story', content: '{"test":true}'
    })
  })

  expect(useAuthoringStore.getState().outputJson).toBe('{"test":true}')
  expect(useAuthoringStore.getState().phase).toBe('output-clean')
})
```

### Files created / modified by this story

**New files:**
- `apps/story-generator/package.json`
- `apps/story-generator/tsconfig.json`
- `apps/story-generator/vite.config.ts`
- `apps/story-generator/tailwind.config.ts`
- `apps/story-generator/postcss.config.js`
- `apps/story-generator/eslint.config.js`
- `apps/story-generator/index.html`
- `apps/story-generator/src/main.tsx`
- `apps/story-generator/src/App.tsx`
- `apps/story-generator/src/index.css`
- `apps/story-generator/src/lib/cn.ts`
- `apps/story-generator/src/stores/authoringStore.ts`
- `apps/story-generator/src/hooks/useAgUiRun.ts`
- `apps/story-generator/src/__tests__/setup.ts`
- `apps/story-generator/src/__tests__/authoringStore.test.ts`
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts`

**Not modified:**
- `apps/story-generator-backend/` — no backend changes in this story (backend is Story 2.2)
- `pnpm-workspace.yaml` — already correct
- `docs/adr/003-story-generator-out-of-scope.md` — already updated

### Prerequisites confirmed done (from Epic 1)

- ARCH-2: `apps/story-generator` already in `pnpm-workspace.yaml` ✓
- ARCH-3: ADR-003 updated to reference `apps/story-generator-backend/` ✓
- ARCH-4: `story.v1.json` has `key` property in `vocab_supplement` ✓
- ARCH-5: `genki1vocab.csv` has numeric ID column ✓
- ADR-004: AG-UI event contract committed to `docs/adr/004-agui-event-types.md` ✓
- M0 gate passed: spike produces schema-valid output ✓

### Project structure rules that apply

From [project-context.md](../../_bmad-output/project-context.md):
- Components: PascalCase `.tsx`, named export matching filename
- Stores: camelCase + `Store` suffix, `useXxxStore` hook
- Hooks: `use` prefix, camelCase
- Use `cn()` for all className composition — never raw string concatenation
- Include `_reset` alongside `reset` in stores for test teardown
- `font-ja` class on all Japanese text
- Only custom design tokens — no arbitrary Tailwind colours

From [architecture-story-authoring-tool.md](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md) — Zustand anti-patterns:
- Never: `store.setState({ phase: 'generating' })` in a component → call `store.generate()` ✓
- Never: `new EventSource(url)` in a component → consumed via `useAgUiRun` hook ✓
- Never: derive `isGenerating` inline → use `selectIsGenerating` selector ✓

### References

- [epics-story-authoring-tool.md — Story 2.1](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [architecture-story-authoring-tool.md — Frontend Architecture, Zustand Store Contract, Communication Patterns](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [docs/adr/004-agui-event-types.md — AG-UI event contract](../../docs/adr/004-agui-event-types.md)
- [project-context.md — Zustand, Testing, Naming Conventions](../../_bmad-output/project-context.md)
- [1-3-m0-feasibility-spike.md — Dev Agent Record (Windows encoding note)](1-3-m0-feasibility-spike.md)
- apps/web/tailwind.config.ts — exact design token values to mirror
- apps/web/vite.config.ts — vitest configuration pattern to mirror

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `authoringStore.ts` initially imported `{ v4 as uuidv4 } from 'uuid'` (not installed) — replaced with `crypto.randomUUID()` throughout; no extra dependency needed.
- `act()` warning in `useAgUiRun.test.ts` is a known false positive with Zustand's `useSyncExternalStore` + React 18 + @testing-library/react v16: the hook-internal Zustand subscription re-renders TestComponent after the act() call; all assertions pass correctly.
- `shadcn/ui` full init deferred — this story creates the shell without shadcn components (individual components added in Stories 2.3–2.9).

### Completion Notes List

- AC1: Scaffolded `apps/story-generator/` with Vite 5 + React 18 + TypeScript strict, port 5174, proxy rules to port 8000, Tailwind mirroring apps/web tokens, `.eslintrc.cjs` extending `@nihonnohon/eslint-config/react`.
- AC2: `authoringStore.ts` — full 8-phase state machine (`idle|generating|cancelling|output-clean|output-dirty|downloading|error|proposal`), one-way `outputIsDirty` latch, `storedInputs` snapshot on `generate()`, `crypto.randomUUID()` for runId, exported selectors, `_reset` for test teardown.
- AC3: `useAgUiRun.ts` — injected `createEventSource` factory, ADR-004 event mapping, hook-internal `bufferRef` for TEXT_MESSAGE_CHUNK accumulation, 3s/60s timeouts, cancellation via `POST /cancel/{runId}`.
- AC4: `pnpm test:unit` → 4 passed (3 store + 1 hook); `pnpm typecheck` → clean.

### File List

- `apps/story-generator/package.json` (new)
- `apps/story-generator/tsconfig.json` (new)
- `apps/story-generator/tsconfig.app.json` (new)
- `apps/story-generator/tsconfig.node.json` (new)
- `apps/story-generator/vite.config.ts` (new)
- `apps/story-generator/tailwind.config.ts` (new)
- `apps/story-generator/postcss.config.js` (new)
- `apps/story-generator/.eslintrc.cjs` (new)
- `apps/story-generator/index.html` (new)
- `apps/story-generator/src/main.tsx` (new)
- `apps/story-generator/src/App.tsx` (new)
- `apps/story-generator/src/index.css` (new)
- `apps/story-generator/src/lib/cn.ts` (new)
- `apps/story-generator/src/stores/authoringStore.ts` (new)
- `apps/story-generator/src/hooks/useAgUiRun.ts` (new)
- `apps/story-generator/src/__tests__/setup.ts` (new)
- `apps/story-generator/src/__tests__/authoringStore.test.ts` (new)
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)
