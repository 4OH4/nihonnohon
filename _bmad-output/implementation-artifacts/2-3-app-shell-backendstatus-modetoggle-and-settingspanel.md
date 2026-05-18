# Story 2.3: App Shell, BackendStatus, ModeToggle & SettingsPanel

Status: done

## Story

As a content author,
I want to open the tool and immediately see backend status, the mode selector, and access to generation settings,
so that I know whether the tool is ready before filling in inputs.

## Acceptance Criteria

**AC1 — App shell layout:**
Given the app is open at `http://localhost:5174`,
when the page loads,
then a `<header>` displays the app title, the `BackendStatus` indicator, and a settings gear button; the page uses `max-w-[860px] mx-auto` layout with `surface` background.

**AC2 — BackendStatus: connected:**
Given the backend is reachable,
when the health check on mount succeeds,
then `BackendStatus` shows a green dot + "Backend connected"; re-checks every 60 seconds; `aria-live="polite"` on the label text.

**AC3 — BackendStatus: unavailable:**
Given the backend is unreachable,
when the health check fails or times out (5s),
then `BackendStatus` shows an amber dot + "Backend unavailable"; re-checks every 10 seconds; recovers automatically when backend comes back online.

**AC4 — ModeToggle:**
Given `ModeToggle` is rendered,
when the user clicks "Convert a story" or "Generate from topic",
then the active option has `aria-selected="true"`; switching clears any `outputJson` in the store; `role="tablist"` / `role="tab"` present.

**AC5 — Design contracts:**
Given Story 2.3 is the first story to render interactive components,
when components are implemented,
then this story establishes the canonical button hierarchy and interaction patterns referenced by all subsequent stories (see Dev Notes).

**AC6 — SettingsPanel:**
Given the user clicks the settings gear,
when the `SettingsPanel` Sheet opens,
then it slides from the right without displacing the main layout; temperature slider (0.0–2.0, default 1.0) with paired numeric input; grammar distribution 3-position slider with reactive hint text; story length section rendered as disabled stubs with hint "Available in Generate from topic mode"; closing saves values to the store.

**AC7 — Tests pass:**
Given components are implemented,
when `pnpm test:unit` is run,
then tests for `BackendStatus` state rendering and `ModeToggle` aria attributes both pass; `pnpm typecheck` passes.

## Tasks / Subtasks

- [x] AC1+AC5: Create `src/lib/utils.ts` and update `tailwind.config.ts`
  - [x] Create `src/lib/utils.ts` re-exporting `cn` from `./cn` — shadcn components import from `@/lib/utils`
  - [x] Add `success: '#22C55E'` and `warning: '#F59E0B'` tokens to `tailwind.config.ts` (needed for BackendStatus dots)

- [x] AC2+AC3: Implement `useBackendStatus` hook
  - [x] Create `src/hooks/useBackendStatus.ts` returning `'checking' | 'connected' | 'unavailable'`
  - [x] On mount: immediately fetch `/health` with `AbortSignal.timeout(5000)`
  - [x] 200 response → `'connected'`; any error/timeout/non-200 → `'unavailable'`
  - [x] Re-poll every 60s when `'connected'`, every 10s when `'unavailable'`
  - [x] Clean up intervals on unmount

- [x] AC1+AC2+AC3: Create `src/components/BackendStatus.tsx`
  - [x] 8px status dot (`w-2 h-2 rounded-full inline-block`) + label text; always both rendered
  - [x] Connected: `bg-success` dot + "Backend connected"
  - [x] Unavailable: `bg-warning` dot + "Backend unavailable"
  - [x] Checking: `bg-muted animate-pulse` dot + "Checking…"
  - [x] `aria-live="polite"` on the label `<span>`

- [x] AC4: Create `src/components/ModeToggle.tsx`
  - [x] Segmented pill: `role="tablist"`, each option `role="tab"` + `aria-selected`
  - [x] Active option: `bg-accent text-white` pill; inactive: `text-muted hover:text-paper-text`
  - [x] On click: call `setPathMode(v)` from store; switching also clears outputJson (update `setPathMode` in store — see Dev Notes)
  - [x] Arrow key navigation: left/right cycles between modes
  - [x] Focus ring: `focus-visible:ring-2 ring-accent`

- [x] AC6: Install shadcn Sheet and create `src/components/SettingsPanel.tsx`
  - [x] Run `pnpm dlx shadcn@latest add sheet` from `apps/story-generator/`
  - [x] Run `pnpm dlx shadcn@latest add button` from `apps/story-generator/` (needed for gear button)
  - [x] Create `SettingsPanel.tsx` using `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
  - [x] Temperature section: `<input type="range" min="0" max="2" step="0.1">` + `<input type="number">` pair; synced bidirectionally; default 1.0; reads/writes `temperature` from store
  - [x] Grammar distribution: `<input type="range" min="0" max="2" step="1">` (native integer snapping); reactive hint text per value; reads/writes `grammarDist` from store
  - [x] Story length stub: short/medium/long/custom controls at 38% opacity + `cursor-not-allowed`; hint: "Available in Generate from topic mode"; NOT connected to store
  - [x] Sheet does not push content (overlay, not push); closes on outside click or Escape

- [x] AC1+AC5: Create `src/components/AuthoringTool.tsx` and update `src/App.tsx`
  - [x] `AuthoringTool.tsx`: header + main layout with BackendStatus, gear button, ModeToggle
  - [x] Update `App.tsx` to render `<AuthoringTool />`
  - [x] Mount `useAgUiRun()` in `AuthoringTool`

- [x] AC4: Update `authoringStore.ts` — `setPathMode` mode-switch behaviour
  - [x] Extend `setPathMode` to clear `outputJson`, reset `outputIsDirty`, set `phase` to `'idle'` when mode changes
  - [x] Updated store tests cover `setPathMode` mode-change clearing behavior

- [x] AC7: Write component tests
  - [x] `src/__tests__/BackendStatus.test.tsx`: 5 tests — all 3 states, aria-live, dot classes
  - [x] `src/__tests__/ModeToggle.test.tsx`: 5 tests — tablist, tabs, aria-selected, click, outputJson clear
  - [x] Run `pnpm test:unit` — 19/19 passing
  - [x] Run `pnpm typecheck` — no errors

## Dev Notes

### Files modified in this story

**New:**
- `apps/story-generator/src/lib/utils.ts` — shadcn utility re-export
- `apps/story-generator/src/hooks/useBackendStatus.ts`
- `apps/story-generator/src/components/AuthoringTool.tsx`
- `apps/story-generator/src/components/BackendStatus.tsx`
- `apps/story-generator/src/components/ModeToggle.tsx`
- `apps/story-generator/src/components/SettingsPanel.tsx`
- `apps/story-generator/src/components/ui/sheet.tsx` (generated by shadcn CLI)
- `apps/story-generator/src/components/ui/button.tsx` (generated by shadcn CLI)
- `apps/story-generator/src/__tests__/BackendStatus.test.tsx`
- `apps/story-generator/src/__tests__/ModeToggle.test.tsx`

**Modified:**
- `apps/story-generator/src/App.tsx` — mount AuthoringTool
- `apps/story-generator/src/stores/authoringStore.ts` — extend setPathMode
- `apps/story-generator/tailwind.config.ts` — add success/warning tokens

### `src/lib/utils.ts` — shadcn bridge

shadcn CLI generates components that import `cn` from `@/lib/utils`. Our `cn` lives at `@/lib/cn`. Create a bridge:

```typescript
// src/lib/utils.ts
export { cn } from './cn'
```

### `tailwind.config.ts` additions

```typescript
// Add to colors:
success: '#22C55E',   // BackendStatus connected dot
warning: '#F59E0B',   // BackendStatus unavailable dot
```

### `useBackendStatus` hook implementation

```typescript
// src/hooks/useBackendStatus.ts
export type BackendStatusState = 'checking' | 'connected' | 'unavailable'

export function useBackendStatus(): BackendStatusState {
  const [status, setStatus] = useState<BackendStatusState>('checking')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/health', { signal: AbortSignal.timeout(5_000) })
      setStatus(res.ok ? 'connected' : 'unavailable')
    } catch {
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    check()  // immediate check on mount
    // Schedule re-checks; interval changes when status changes
    const interval = status === 'connected' ? 60_000 : 10_000
    intervalRef.current = setInterval(check, interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, check])  // re-schedule when status changes

  return status
}
```

**Testing `useBackendStatus`:** mock `global.fetch` with `vi.stubGlobal('fetch', ...)`. Return `{ ok: true }` for connected, throw for unavailable. Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` for interval tests.

### `BackendStatus.tsx` implementation guide

```tsx
export function BackendStatus() {
  const status = useBackendStatus()

  const dotClass = {
    checking: 'bg-muted animate-pulse',
    connected: 'bg-success',
    unavailable: 'bg-warning',
  }[status]

  const label = {
    checking: 'Checking…',   // ellipsis character
    connected: 'Backend connected',
    unavailable: 'Backend unavailable',
  }[status]

  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotClass)} aria-hidden="true" />
      <span aria-live="polite" className="text-sm text-muted">{label}</span>
    </div>
  )
}
```

### `ModeToggle.tsx` implementation guide

```tsx
const MODES = [
  { value: 'A' as const, label: 'Convert a story' },
  { value: 'B' as const, label: 'Generate from topic' },
]

export function ModeToggle() {
  const pathMode = useAuthoringStore(s => s.pathMode)
  const setPathMode = useAuthoringStore(s => s.setPathMode)

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      const next = MODES[(idx + 1) % MODES.length]
      setPathMode(next.value)
    } else if (e.key === 'ArrowLeft') {
      const prev = MODES[(idx - 1 + MODES.length) % MODES.length]
      setPathMode(prev.value)
    }
  }

  return (
    <div role="tablist" aria-label="Generation mode" className="flex rounded-full border border-border bg-surface-subtle p-1 gap-1">
      {MODES.map((mode, idx) => (
        <button
          key={mode.value}
          role="tab"
          aria-selected={pathMode === mode.value}
          onClick={() => setPathMode(mode.value)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            'focus-visible:ring-2 ring-accent outline-none',
            pathMode === mode.value
              ? 'bg-accent text-white'
              : 'text-muted hover:text-paper-text',
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
```

### `setPathMode` store extension

Current: `setPathMode: (v) => set({ pathMode: v })`

Replace with:

```typescript
setPathMode(v: 'A' | 'B') {
  const { pathMode } = get()
  if (pathMode === v) return   // no-op if same mode
  // Clear generated output when mode changes (UX-DR1)
  set({ pathMode: v, outputJson: null, outputIsDirty: false, phase: 'idle' })
},
```

**Note:** This resets phase to `'idle'` and clears outputJson. It does NOT clear inputs (inputText, chapterTarget, steeringInstructions) — those are preserved across mode switches.

**Add store test:**
```typescript
describe('authoringStore — setPathMode mode-change', () => {
  it('clears outputJson and resets to idle when mode changes', () => {
    const store = useAuthoringStore.getState()
    store._setOutputJson('{"test":true}')
    expect(store.outputJson).toBeTruthy()
    store.setPathMode('B')  // was 'A'
    expect(useAuthoringStore.getState().outputJson).toBeNull()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('is a no-op when same mode selected', () => {
    useAuthoringStore.getState()._setOutputJson('{"test":true}')
    useAuthoringStore.getState().setPathMode('A')  // already 'A'
    expect(useAuthoringStore.getState().outputJson).toBeTruthy()
  })
})
```

### `SettingsPanel.tsx` — shadcn Sheet usage

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// Temperature slider + numeric input (synced):
// Note: HTML range input step=0.1 → use parseFloat(e.target.value) for precision
// Note: Clamp number input: Math.min(2, Math.max(0, parseFloat(v) || 0))

// Grammar distribution hint map:
const GRAMMAR_HINTS: Record<0|1|2, string> = {
  0: 'Fewer patterns — simpler sentence structures',
  1: 'Balanced variety',
  2: 'Maximum grammar variety',
}
```

The Sheet component slides from the right as an overlay (does not push main content). The `SheetContent` side prop defaults to `"right"`.

### `AuthoringTool.tsx` structure

```tsx
export function AuthoringTool() {
  useAgUiRun()   // mount SSE lifecycle once at root

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border">
        <div className="max-w-[860px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-paper-text">
            nihonnohon Story Authoring Tool
          </h1>
          <div className="flex items-center gap-4">
            <BackendStatus />
            {/* gear button — uses shadcn Button variant="ghost" or plain button */}
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className={cn(
                'p-2 rounded-md text-muted hover:text-paper-text hover:bg-surface-subtle',
                'focus-visible:ring-2 ring-accent outline-none transition-colors',
              )}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-4 py-8">
        <div className="mb-6">
          <ModeToggle />
        </div>
        {/* Story 2.4: InputPanel */}
        {/* Story 2.7: OutputPanel */}
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
```

### Canonical button design contracts (AC5)

These are established HERE and referenced by all future stories — never redefine:

| Variant | Classes |
|---------|---------|
| Primary | `bg-accent text-white hover:bg-accent/90` |
| Secondary | `bg-surface border border-border text-paper-text hover:bg-surface-subtle` |
| Stop/Destructive | `bg-surface border border-error text-error hover:bg-error/5` |
| Ghost | `text-accent hover:bg-accent/10` |
| Disabled | `opacity-45 cursor-not-allowed pointer-events-none` |
| Loading | add `aria-busy="true"` + `pointer-events-none`; replace label with spinner span |
| Focus ring | `focus-visible:ring-2 ring-accent outline-none` |

### shadcn Sheet install note

Run from `apps/story-generator/`:
```bash
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add button
```

This generates `src/components/ui/sheet.tsx` and `src/components/ui/button.tsx`. The generated files use `@/lib/utils` for `cn` — which is why `src/lib/utils.ts` must exist.

Since `cssVariables: false`, shadcn generates classes using Tailwind utilities not CSS vars. The generated components will use Tailwind classes that reference our custom tokens via the config.

### Testing `BackendStatus` component

Mock `fetch` globally. Use `@testing-library/react` render + state assertions:

```typescript
// Check dot color class
const dot = container.querySelector('[aria-hidden="true"]')
expect(dot).toHaveClass('bg-success')

// Check label text
expect(screen.getByText('Backend connected')).toBeInTheDocument()

// Check aria-live
expect(screen.getByRole('status') ?? container.querySelector('[aria-live="polite"]'))
  .toBeInTheDocument()
```

### Testing `ModeToggle` component

```typescript
// Render in MemoryRouter or plain render (no router needed — no Link/NavLink)
// Check tablist
expect(screen.getByRole('tablist')).toBeInTheDocument()

// Check tabs
const tabs = screen.getAllByRole('tab')
expect(tabs).toHaveLength(2)
expect(tabs[0]).toHaveAttribute('aria-selected', 'true')  // default A

// Click B
fireEvent.click(tabs[1])
expect(useAuthoringStore.getState().pathMode).toBe('B')
```

### Important: `useAgUiRun` mounting in AuthoringTool

`useAgUiRun()` is the SSE hook — it must be mounted once at the root so the SSE lifecycle is active. Mount it in `AuthoringTool` (the root layout). Do NOT mount it in individual components.

The hook has no-op behavior when `phase === 'idle'` (which is the initial state), so mounting it immediately is safe and produces no network requests until `generate()` is called.

### Previous story patterns to carry forward

**From Story 2.1 review (act() warning):** The Zustand subscription + React 18 produces an act() warning in hook tests. This is a known false positive — tests pass correctly. Document it but don't try to silence it.

**From Story 2.1 (cn utility):** Always use `cn()` from `@/lib/utils` (not `@/lib/cn`) in ALL components — shadcn components import from `@/lib/utils`, and component code should use the same import path for consistency.

**From Story 2.2 (backend patterns):** The `/health` endpoint returns `{"status":"ok"}` on 200 or `{"status":"unavailable"}` on 503. Check `res.ok` (not response body) for the status determination.

### References

- [epics-story-authoring-tool.md — Story 2.3](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [ux-design-specification-story-authoring-tool.md — UX-DR1, UX-DR13, UX-DR14](../../_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md)
- [architecture-story-authoring-tool.md — Frontend Architecture, Naming Patterns](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [project-context.md — Tailwind tokens, component naming, cn() utility](../../_bmad-output/project-context.md)
- [2-1 story — authoringStore.ts, useAgUiRun.ts patterns established](./)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- shadcn CLI placed generated files at literal `apps/story-generator/@/components/ui/` instead of `src/components/ui/` — the CLI doesn't read Vite alias config. Moved files manually and cleaned up `@/` directory.
- shadcn Sheet required `@radix-ui/react-dialog`, `class-variance-authority`, `lucide-react` — added via `pnpm add`.
- act() warnings in ModeToggle tests: known Zustand/React 18 false positive (store subscription causes re-render outside act); all assertions pass correctly.

### Completion Notes List

- AC1+AC5: `src/lib/utils.ts` bridges `cn` for shadcn; tailwind.config.ts adds `success`/`warning` status tokens; `AuthoringTool.tsx` establishes canonical button hierarchy and layout contracts for all subsequent stories.
- AC2+AC3: `useBackendStatus` hook — immediate mount check + interval re-scheduling on status change (60s connected, 10s unavailable); `BackendStatus.tsx` renders dot + aria-live label for all 3 states.
- AC4: `ModeToggle.tsx` — segmented pill with tablist/tab ARIA, arrow key nav; `setPathMode` store extension clears outputJson+phase on mode switch.
- AC6: shadcn Sheet installed and moved to correct path; `SettingsPanel.tsx` — temperature range+number pair, grammar dist 3-position slider with reactive hints, story length disabled stub.
- AC7: 19 tests passing — 8 store, 1 hook, 5 BackendStatus, 5 ModeToggle; typecheck clean.

### File List

- `apps/story-generator/src/lib/utils.ts` (new)
- `apps/story-generator/src/hooks/useBackendStatus.ts` (new)
- `apps/story-generator/src/components/AuthoringTool.tsx` (new)
- `apps/story-generator/src/components/BackendStatus.tsx` (new)
- `apps/story-generator/src/components/ModeToggle.tsx` (new)
- `apps/story-generator/src/components/SettingsPanel.tsx` (new)
- `apps/story-generator/src/components/ui/sheet.tsx` (new — shadcn generated)
- `apps/story-generator/src/components/ui/button.tsx` (new — shadcn generated)
- `apps/story-generator/src/__tests__/BackendStatus.test.tsx` (new)
- `apps/story-generator/src/__tests__/ModeToggle.test.tsx` (new)
- `apps/story-generator/src/App.tsx` (modified — now renders AuthoringTool)
- `apps/story-generator/src/stores/authoringStore.ts` (modified — setPathMode extended)
- `apps/story-generator/src/__tests__/authoringStore.test.ts` (modified — setPathMode tests added)
- `apps/story-generator/tailwind.config.ts` (modified — success/warning tokens)
- `apps/story-generator/package.json` (modified — class-variance-authority, lucide-react, @radix-ui/react-dialog added)
- `_bmad-output/implementation-artifacts/2-3-app-shell-backendstatus-modetoggle-and-settingspanel.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)

## Senior Developer Review (AI)

**Review Date:** 2026-05-17
**Outcome:** Changes Requested → All Applied

### Action Items

- [x] **[High] P1 — `button.tsx` AC5 violation:** shadcn-generated file used OKLCH hardcoded values throughout instead of project design tokens. All variants replaced: `default→bg-accent text-white`, `destructive→border-error text-error`, `outline/secondary→border-border text-paper-text`, `ghost→text-accent hover:bg-accent/10`; disabled opacity corrected to `opacity-[0.45]`; focus ring to `ring-accent ring-offset-paper-bg`; `isLoading` prop added with inline SVG spinner + `aria-busy`. [button.tsx]

- [x] **[High] P2 — `useBackendStatus` double-check bug:** Single combined effect with `[status, check]` deps meant `void check()` fired immediately on every status transition (double-check on 'checking'→'connected'). Split into two effects: mount-only effect for initial check, separate interval effect for rescheduling. [useBackendStatus.ts]

- [x] **[High] P3 — mode switch bypasses SSE cancel:** `setPathMode` directly forced `phase:'idle'` even while generating, leaving SSE connection open. Fixed: guard checks `phase === 'generating'` and calls `cancel()` first; when already-cancelling or generating, phase is not overridden to idle (stays `'cancelling'` until `_resolveCancel` fires). [authoringStore.ts]

- [x] **[Med] P4 — `SettingsPanel` input handlers unclamped/unchecked:** `handleTempRange` had no clamp (NaN possible); `handleGrammarDist` cast `parseInt` result directly to `0|1|2` without runtime guard. Both fixed: temp range now uses same `Math.min(2, Math.max(0, v))` clamp; grammar dist uses explicit `if (v === 0 || v === 1 || v === 2)` guard. [SettingsPanel.tsx]

- [x] **[Med] P5 — `ModeToggle` keyboard focus not moved:** Arrow key handler only updated store, never called `.focus()` on the target button; no roving tabIndex. Added `useRef<(HTMLButtonElement | null)[]>([])`, assigned refs, added `tabIndex={active ? 0 : -1}` to each tab, called `buttonRefs.current[nextIdx]?.focus()` in arrow key handler. [ModeToggle.tsx]

- [x] **[Low] P6 — `AuthoringTool` gear glyph not aria-hidden:** Raw `⚙` character could be announced by screen readers alongside the button's `aria-label`. Wrapped in `<span aria-hidden="true">`. [AuthoringTool.tsx]

### Deferred Findings

- Concurrent in-flight `fetch()` calls in `useBackendStatus` (no abort of previous call on re-trigger). Single-user v1; address if concurrent load becomes a concern.
- `AbortSignal.timeout` Safari support (≥16.4). All deployment targets use modern browsers; acceptable.
- `proposalText` not cleared on mode switch. Path B / M3 scope — Story 4.x.
- `storedInputs` snapshot missing `pathMode` and `temperature`. Re-run URL construction is Story 2.6 scope.
- `save()` doesn't return from `downloading` phase. Download completion flow is Story 2.8 scope.
- `useAuthoringStore()` full subscription in components. Performance optimisation; address when profiling shows need.
