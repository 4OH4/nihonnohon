# Story 2.4: Input Panel, Chapter Selector & ScopeChip

Status: done

## Story

As a content author,
I want to paste my English story, select a Genki chapter, and see the curriculum scope that will be applied,
so that I can confirm the correct calibration before triggering generation.

## Acceptance Criteria

**AC1 — Input fields:**
Given the app is in `idle` or `error` phase,
when the input section is visible,
then a labelled `<textarea>` for the English story (`min-h-[200px]`, grows to `max-h-[400px]` with overflow scroll) and a chapter `<select>` are both rendered; store `inputText` and `chapterTarget` update on every keystroke/change.

**AC2 — ScopeChip:**
Given a Genki chapter is selected,
when `ScopeChip` renders,
then it displays cumulative vocab count + grammar count + key grammar highlights for that chapter (hardcoded M1 lookup); text uses `font-ja` for Japanese content; `accent-subtle` background + `accent` border; hidden when no chapter is selected; updates immediately on chapter change.

**AC3 — Steering instructions collapsible:**
Given the steering instructions panel is collapsed (default),
when the toggle is clicked,
then it expands to show a labelled `<textarea>`; store `steeringInstructions` updates; collapses again on re-click; content preserved in both states.

**AC4 — Pre-flight validation:**
Given Generate is clicked with an empty story textarea or no chapter selected,
when pre-flight validation runs,
then an inline hint appears adjacent to the offending field; the generation request is not sent; the hint disappears when the field is corrected; **pre-flight checks only two conditions: non-empty `inputText` + `chapterTarget` set** — the full 7-rule semantic validation pipeline runs in `save()` in Story 2.8.

**AC5 — InputSection always expanded in this story:**
Given the `InputPanel` is rendered in Story 2.4,
when generation has not yet started,
then the input section is always visible and expanded; **collapse behaviour on generation start is intentionally deferred to Story 2.6**, which owns the `InputSection` collapse as part of the generation trigger UI.

**AC6 — Tests pass:**
Given components are implemented,
when `pnpm test:unit` is run,
then tests for `InputPanel` pre-flight validation and `ScopeChip` chapter data both pass; `pnpm typecheck` passes.

## Tasks / Subtasks

- [x] AC2: Create `src/components/ScopeChip.tsx` with hardcoded chapter data
  - [x] Define `CHAPTER_SCOPE` lookup table (type + data — see Dev Notes for exact data)
  - [x] Hidden when `chapterTarget === ''`; shows pill with vocab count, grammar count, and key highlights
  - [x] Apply `font-ja` to the highlights text only (not the counts)
  - [x] Style: `accent-subtle` bg + `accent` border + rounded-full pill, `text-xs`
  - [x] Write `src/__tests__/ScopeChip.test.tsx` (hidden when empty, shows counts, font-ja on highlights)

- [x] AC1+AC3+AC4+AC5: Create `src/components/InputPanel.tsx`
  - [x] English story textarea: `<label>` + `<textarea>` with `min-h-[200px] max-h-[400px] overflow-y-auto resize-none`; binds to `inputText` store field
  - [x] Chapter selector: `<label>` + native `<select>` with all 23 Genki chapters (see Dev Notes for option list); binds to `chapterTarget`; placeholder option value=""
  - [x] `ScopeChip` rendered immediately below chapter select; shows when chapter selected
  - [x] Steering instructions: collapsed by default using React `useState`; toggle button "Steering instructions ▸" / "Steering instructions ▾"; labelled `<textarea>` inside; binds to `steeringInstructions`
  - [x] Generate button (primary: `bg-accent text-white`): disabled when backend is `'unavailable'` (read `useBackendStatus()`); label "Convert to Japanese"
  - [x] Pre-flight: local `useState({ story: false, chapter: false })` for hint visibility; show hint when Generate clicked and field is empty/unset; clear hint `onChange` when field is corrected
  - [x] Generate button calls `generate()` only when both fields are valid

- [x] AC1+AC5: Update `src/components/AuthoringTool.tsx` to mount `<InputPanel />`
  - [x] Replace `{/* Story 2.4: InputPanel */}` comment with `<InputPanel />`

- [x] AC6: Write `src/__tests__/InputPanel.test.tsx`
  - [x] Textarea renders with correct min-height class
  - [x] `inputText` store updates on textarea change
  - [x] Chapter select renders all 23 chapters + placeholder
  - [x] `chapterTarget` store updates on chapter change
  - [x] ScopeChip absent when no chapter selected
  - [x] ScopeChip present after chapter selection
  - [x] Steering instructions collapsed by default
  - [x] Steering instructions toggle expands/collapses; content preserved
  - [x] Generate click with empty textarea → shows story hint, no `generate()` call
  - [x] Generate click with no chapter → shows chapter hint, no `generate()` call
  - [x] Generate click with valid inputs → calls `generate()`
  - [x] Story hint disappears when textarea filled
  - [x] Run `pnpm test:unit` — all pass
  - [x] Run `pnpm typecheck` — no errors

## Dev Notes

### Files modified in this story

**New:**
- `apps/story-generator/src/components/InputPanel.tsx`
- `apps/story-generator/src/components/ScopeChip.tsx`
- `apps/story-generator/src/__tests__/InputPanel.test.tsx`
- `apps/story-generator/src/__tests__/ScopeChip.test.tsx`

**Modified:**
- `apps/story-generator/src/components/AuthoringTool.tsx` — add `<InputPanel />`

### CHAPTER_SCOPE lookup table

Derive from actual CSV data. Chapter format in store is `"Genki I Ch.N"` (N=1-12) and `"Genki II Ch.N"` (N=13-23). Cumulative vocab counts exclude Ch.0 greetings (the backend `build_system_prompt` uses `range(1, chapter+1)` so Ch.0 items are not included in generation context).

```typescript
/** Cumulative vocab/grammar counts and key grammar highlights per chapter.
 *  Vocab counts: cumulative Ch.1–N (Ch.0 greetings excluded — not in generation context).
 *  Grammar counts: cumulative Ch.1–N.
 *  Highlights: key Japanese patterns introduced by this chapter (font-ja).
 */
export interface ChapterScope {
  vocab: number
  grammar: number
  highlights: string[]  // 2–3 short Japanese forms; rendered with font-ja
}

export const CHAPTER_SCOPE: Record<string, ChapterScope> = {
  'Genki I Ch.1':  { vocab:   56, grammar:   3, highlights: ['X は Y です', '～か', 'N の N'] },
  'Genki I Ch.2':  { vocab:  104, grammar:  10, highlights: ['これ・それ・あれ', 'この・その・あの', '～も'] },
  'Genki I Ch.3':  { vocab:  159, grammar:  16, highlights: ['～ます・ません', 'を・で・に・へ'] },
  'Genki I Ch.4':  { vocab:  222, grammar:  22, highlights: ['あります・います', '～でした・ではありません'] },
  'Genki I Ch.5':  { vocab:  276, grammar:  27, highlights: ['い形容詞', 'な形容詞'] },
  'Genki I Ch.6':  { vocab:  325, grammar:  33, highlights: ['て形', '～てください'] },
  'Genki I Ch.7':  { vocab:  375, grammar:  38, highlights: ['～ている'] },
  'Genki I Ch.8':  { vocab:  421, grammar:  46, highlights: ['普通形', '～と思います'] },
  'Genki I Ch.9':  { vocab:  469, grammar:  49, highlights: ['名詞修飾', 'もう・まだ'] },
  'Genki I Ch.10': { vocab:  512, grammar:  54, highlights: ['A のほうが B より', '一番'] },
  'Genki I Ch.11': { vocab:  555, grammar:  58, highlights: ['～たい', '～たことがある'] },
  'Genki I Ch.12': { vocab:  602, grammar:  64, highlights: ['～んです', '～すぎる', '～ほうがいい'] },
  'Genki II Ch.13': { vocab:  657, grammar:  70, highlights: ['可能動詞', '～し', '～そうです'] },
  'Genki II Ch.14': { vocab:  705, grammar:  75, highlights: ['ほしい', '～かもしれない', 'あげる・くれる・もらう'] },
  'Genki II Ch.15': { vocab:  746, grammar:  79, highlights: ['意向形', '～ておく'] },
  'Genki II Ch.16': { vocab:  788, grammar:  84, highlights: ['～てあげる・くれる・もらう', '～といい'] },
  'Genki II Ch.17': { vocab:  835, grammar:  90, highlights: ['～そうです（伝聞）', '～たら'] },
  'Genki II Ch.18': { vocab:  883, grammar:  96, highlights: ['他動詞・自動詞', '～てしまう'] },
  'Genki II Ch.19': { vocab:  934, grammar: 101, highlights: ['尊敬動詞', 'お〜ください'] },
  'Genki II Ch.20': { vocab:  984, grammar: 107, highlights: ['謙譲語', 'お〜する'] },
  'Genki II Ch.21': { vocab: 1040, grammar: 112, highlights: ['受身形', '～てある'] },
  'Genki II Ch.22': { vocab: 1095, grammar: 118, highlights: ['使役形', '使役 + くれる'] },
  'Genki II Ch.23': { vocab: 1138, grammar: 124, highlights: ['使役受身形', '～ても', '～ことにする'] },
}
```

### Chapter select options

Use the same keys as `CHAPTER_SCOPE`. Add a placeholder option with `value=""`:

```tsx
const CHAPTER_OPTIONS = [
  // Genki I
  'Genki I Ch.1', 'Genki I Ch.2', 'Genki I Ch.3', 'Genki I Ch.4',
  'Genki I Ch.5', 'Genki I Ch.6', 'Genki I Ch.7', 'Genki I Ch.8',
  'Genki I Ch.9', 'Genki I Ch.10', 'Genki I Ch.11', 'Genki I Ch.12',
  // Genki II
  'Genki II Ch.13', 'Genki II Ch.14', 'Genki II Ch.15', 'Genki II Ch.16',
  'Genki II Ch.17', 'Genki II Ch.18', 'Genki II Ch.19', 'Genki II Ch.20',
  'Genki II Ch.21', 'Genki II Ch.22', 'Genki II Ch.23',
]
```

### InputPanel implementation guide

```tsx
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore, selectCanGenerate } from '@/stores/authoringStore'
import { useBackendStatus } from '@/hooks/useBackendStatus'
import { ScopeChip } from './ScopeChip'

interface ValidationHints {
  story: boolean
  chapter: boolean
}

export function InputPanel() {
  const inputText          = useAuthoringStore(s => s.inputText)
  const chapterTarget      = useAuthoringStore(s => s.chapterTarget)
  const steeringInstructions = useAuthoringStore(s => s.steeringInstructions)
  const setInputText       = useAuthoringStore(s => s.setInputText)
  const setChapterTarget   = useAuthoringStore(s => s.setChapterTarget)
  const setSteeringInstructions = useAuthoringStore(s => s.setSteeringInstructions)
  const generate           = useAuthoringStore(s => s.generate)
  const canGenerate        = useAuthoringStore(selectCanGenerate)
  const backendStatus      = useBackendStatus()

  const [steeringOpen, setSteeringOpen] = useState(false)
  const [hints, setHints] = useState<ValidationHints>({ story: false, chapter: false })

  const handleGenerate = () => {
    const missingStory   = inputText.trim() === ''
    const missingChapter = chapterTarget === ''
    if (missingStory || missingChapter) {
      setHints({ story: missingStory, chapter: missingChapter })
      return
    }
    generate()
  }

  const handleInputChange = (v: string) => {
    setInputText(v)
    if (hints.story && v.trim() !== '') setHints(h => ({ ...h, story: false }))
  }

  const handleChapterChange = (v: string) => {
    setChapterTarget(v)
    if (hints.chapter && v !== '') setHints(h => ({ ...h, chapter: false }))
  }

  const isGenerateDisabled = !canGenerate || backendStatus === 'unavailable'

  return (
    <section aria-label="Story inputs" className="space-y-4">
      {/* English story */}
      <div>
        <label htmlFor="input-text" className="block text-sm font-medium text-paper-text mb-1">
          English story
        </label>
        <textarea
          id="input-text"
          value={inputText}
          onChange={e => handleInputChange(e.target.value)}
          placeholder="Paste your English story here…"
          className={cn(
            'w-full min-h-[200px] max-h-[400px] overflow-y-auto resize-none',
            'px-3 py-2 text-sm border rounded-md bg-surface-subtle text-paper-text',
            'focus-visible:ring-2 ring-accent outline-none transition-colors',
            hints.story ? 'border-error' : 'border-border',
          )}
        />
        {hints.story && (
          <p className="text-xs text-error mt-1">Enter your English story before generating.</p>
        )}
      </div>

      {/* Chapter selector */}
      <div>
        <label htmlFor="chapter-select" className="block text-sm font-medium text-paper-text mb-1">
          Genki chapter
        </label>
        <select
          id="chapter-select"
          value={chapterTarget}
          onChange={e => handleChapterChange(e.target.value)}
          className={cn(
            'w-full px-3 py-2 text-sm border rounded-md bg-surface text-paper-text',
            'focus-visible:ring-2 ring-accent outline-none',
            hints.chapter ? 'border-error' : 'border-border',
          )}
        >
          <option value="">Select a chapter…</option>
          {CHAPTER_OPTIONS.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
        {hints.chapter && (
          <p className="text-xs text-error mt-1">Select a chapter before generating.</p>
        )}
        {chapterTarget && <ScopeChip chapter={chapterTarget} className="mt-2" />}
      </div>

      {/* Steering instructions collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setSteeringOpen(o => !o)}
          className={cn(
            'text-sm text-muted hover:text-paper-text transition-colors',
            'focus-visible:ring-2 ring-accent outline-none rounded',
          )}
          aria-expanded={steeringOpen}
        >
          Steering instructions {steeringOpen ? '▾' : '▸'}
        </button>
        {steeringOpen && (
          <div className="mt-2">
            <label htmlFor="steering-input" className="block text-xs text-muted mb-1">
              Optional guidance for the LLM
            </label>
            <textarea
              id="steering-input"
              value={steeringInstructions}
              onChange={e => setSteeringInstructions(e.target.value)}
              rows={3}
              className={cn(
                'w-full px-3 py-2 text-sm border border-border rounded-md',
                'bg-surface-subtle text-paper-text resize-none',
                'focus-visible:ring-2 ring-accent outline-none',
              )}
            />
          </div>
        )}
      </div>

      {/* Generate button */}
      <div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          aria-disabled={isGenerateDisabled}
          className={cn(
            'px-6 py-2 rounded-md text-sm font-medium transition-colors',
            'bg-accent text-white hover:bg-accent/90',
            'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
            isGenerateDisabled && 'opacity-[0.45] cursor-not-allowed pointer-events-none',
          )}
        >
          Convert to Japanese
        </button>
        {backendStatus === 'unavailable' && (
          <p className="text-xs text-muted mt-1">Backend unavailable — check the server is running.</p>
        )}
      </div>
    </section>
  )
}
```

### ScopeChip implementation guide

```tsx
import { cn } from '@/lib/utils'
import { CHAPTER_SCOPE } from './ScopeChip'  // co-locate CHAPTER_SCOPE in ScopeChip.tsx

interface ScopeChipProps {
  chapter: string
  className?: string
}

/** Displays cumulative vocab/grammar scope for the selected Genki chapter. */
export function ScopeChip({ chapter, className }: ScopeChipProps) {
  const scope = CHAPTER_SCOPE[chapter]
  if (!scope) return null  // hidden when chapter unknown or empty

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs',
        'bg-accent-subtle border border-accent',
        className,
      )}
    >
      <span className="text-muted font-medium">Scope:</span>
      <span className="text-paper-text">{scope.vocab} vocab</span>
      <span className="text-muted">·</span>
      <span className="text-paper-text">{scope.grammar} grammar</span>
      <span className="text-muted">·</span>
      <span className="font-ja text-paper-text">
        {scope.highlights.join('、')}
      </span>
    </div>
  )
}
```

### AuthoringTool.tsx update

Replace the `{/* Story 2.4: InputPanel */}` comment with:

```tsx
import { InputPanel } from './InputPanel'

// In <main>:
<InputPanel />
```

### Store fields used

All are already on `authoringStore.ts` from Story 2.1 — no store changes needed:
- `inputText` / `setInputText`
- `chapterTarget` / `setChapterTarget`
- `steeringInstructions` / `setSteeringInstructions`
- `generate()`
- `selectCanGenerate` (phase === 'idle' || phase === 'error')

**Do NOT add `selectCanGenerate` guard to the Generate button as a `disabled` prop alone — combine it with the backend status check for the full disable condition:**

```tsx
const isGenerateDisabled = !canGenerate || backendStatus === 'unavailable'
```

### Testing InputPanel

```typescript
// src/__tests__/InputPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { InputPanel } from '../components/InputPanel'
import { useAuthoringStore } from '../stores/authoringStore'

// Mock useBackendStatus to return 'connected' by default
vi.mock('../hooks/useBackendStatus', () => ({
  useBackendStatus: vi.fn(() => 'connected'),
}))
import { useBackendStatus } from '../hooks/useBackendStatus'

describe('InputPanel', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })
  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('renders textarea with min-h-[200px] class', () => {
    const { container } = render(<InputPanel />)
    const ta = container.querySelector('textarea#input-text')
    expect(ta).toHaveClass('min-h-[200px]')
  })

  it('updates inputText in store on change', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('textbox', { name: /english story/i }), {
      target: { value: 'Hello world' },
    })
    expect(useAuthoringStore.getState().inputText).toBe('Hello world')
  })

  it('renders chapter select with placeholder and all 23 chapters', () => {
    render(<InputPanel />)
    const select = screen.getByRole('combobox', { name: /genki chapter/i })
    expect(select).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    // 1 placeholder + 23 chapters
    expect(options.length).toBe(24)
  })

  it('updates chapterTarget in store on chapter change', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: /genki chapter/i }), {
      target: { value: 'Genki I Ch.6' },
    })
    expect(useAuthoringStore.getState().chapterTarget).toBe('Genki I Ch.6')
  })

  it('ScopeChip absent when no chapter selected', () => {
    render(<InputPanel />)
    expect(screen.queryByText(/vocab/)).not.toBeInTheDocument()
  })

  it('ScopeChip appears when chapter is selected', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: /genki chapter/i }), {
      target: { value: 'Genki I Ch.6' },
    })
    expect(screen.getByText(/vocab/)).toBeInTheDocument()
  })

  it('steering instructions collapsed by default', () => {
    render(<InputPanel />)
    expect(screen.queryByLabelText(/optional guidance/i)).not.toBeInTheDocument()
  })

  it('steering instructions toggle expands and collapses', () => {
    render(<InputPanel />)
    const toggle = screen.getByText(/steering instructions/i)
    fireEvent.click(toggle)
    expect(screen.getByLabelText(/optional guidance/i)).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByLabelText(/optional guidance/i)).not.toBeInTheDocument()
  })

  it('Generate click with empty textarea shows story hint', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText(/enter your english story/i)).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('Generate click with no chapter shows chapter hint', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('textbox', { name: /english story/i }), {
      target: { value: 'A story.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText(/select a chapter/i)).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('Generate click with valid inputs calls generate()', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByRole('textbox', { name: /english story/i }), {
      target: { value: 'A story.' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /genki chapter/i }), {
      target: { value: 'Genki I Ch.6' },
    })
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('story hint disappears when textarea is filled', () => {
    render(<InputPanel />)
    // Trigger hint
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText(/enter your english story/i)).toBeInTheDocument()
    // Fill the field
    fireEvent.change(screen.getByRole('textbox', { name: /english story/i }), {
      target: { value: 'A story.' },
    })
    expect(screen.queryByText(/enter your english story/i)).not.toBeInTheDocument()
  })
})
```

### Testing ScopeChip

```typescript
// src/__tests__/ScopeChip.test.tsx
import { render, screen } from '@testing-library/react'
import { ScopeChip } from '../components/ScopeChip'

describe('ScopeChip', () => {
  it('renders nothing when chapter is empty', () => {
    const { container } = render(<ScopeChip chapter="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders vocab count for a known chapter', () => {
    render(<ScopeChip chapter="Genki I Ch.6" />)
    expect(screen.getByText('325 vocab')).toBeInTheDocument()
  })

  it('renders grammar count for a known chapter', () => {
    render(<ScopeChip chapter="Genki I Ch.6" />)
    expect(screen.getByText('33 grammar')).toBeInTheDocument()
  })

  it('grammar highlights use font-ja class', () => {
    const { container } = render(<ScopeChip chapter="Genki I Ch.6" />)
    const highlightsEl = container.querySelector('.font-ja')
    expect(highlightsEl).toBeInTheDocument()
    expect(highlightsEl?.textContent).toContain('て形')
  })

  it('renders nothing for an unknown chapter key', () => {
    const { container } = render(<ScopeChip chapter="Genki I Ch.99" />)
    expect(container.firstChild).toBeNull()
  })
})
```

### Key patterns from previous stories

**From Story 2.3 (button.tsx AC5):** The Generate button must use the design contract established in Story 2.3:
- Primary: `bg-accent text-white hover:bg-accent/90`
- Disabled: `opacity-[0.45] cursor-not-allowed pointer-events-none`
- Focus ring: `focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none`
- Do NOT use the shadcn `<Button>` component for the Generate button in this story — use a plain `<button>` with Tailwind classes to keep it simple and avoid size/state coupling with Story 2.6's Generate/Stop transition.

**From Story 2.3 (useBackendStatus):** Import from `@/hooks/useBackendStatus`. The hook returns `'checking' | 'connected' | 'unavailable'`. Disable the Generate button only on `'unavailable'`; do NOT disable on `'checking'` (user should not be blocked while the initial check is running).

**From Story 2.1 (authoringStore):** `selectCanGenerate = s.phase === 'idle' || s.phase === 'error'`. The Generate button should be disabled when phase is NOT idle/error (e.g., already generating). Combine with backend check:
```tsx
const isGenerateDisabled = !canGenerate || backendStatus === 'unavailable'
```

**From Story 2.3 (ModeToggle tests):** The `act()` warnings in store-connected component tests are known false positives from Zustand + React 18. Tests still pass correctly. Do not attempt to suppress them.

**From Story 2.1 (imports):** Always use `@/` path alias for all intra-app imports. Never use relative `../../` paths.

### Deferred intentionally in this story

- **InputSection collapse on generation:** Story 2.6 scope. The `InputPanel` is always visible and expanded in Story 2.4.
- **Generate → Stop button transition:** Story 2.6 scope. The button always shows "Convert to Japanese" in Story 2.4.
- **Disabled Generate when backend is 'checking':** See note above — only disable on 'unavailable'.
- **Steering instructions collapsing when generation starts:** Story 2.6 scope.
- **ScopeChip collapse into the collapsed InputSection:** Story 2.6 scope.

### References

- [epics-story-authoring-tool.md — Story 2.4](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [ux-design-specification-story-authoring-tool.md — UX-DR2, UX-DR7, UX-DR16, UX-DR17, UX-DR20](../../_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md)
- [architecture-story-authoring-tool.md — Zustand Store Contract, Structure Patterns](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- [2-3 story — button.tsx design contracts established](./)
- [2-1 story — authoringStore.ts, selectCanGenerate selector](./)

### Review Findings

- [x] [Review][Patch] CHAPTER_OPTIONS duplicates CHAPTER_SCOPE keys — use Object.keys(CHAPTER_SCOPE) [InputPanel.tsx]
- [x] [Review][Patch] Stale hints persist after successful generate() — clear hints on success path in handleGenerate [InputPanel.tsx]
- [x] [Review][Patch] Steering toggle chevrons (▾/▸) should be wrapped in aria-hidden span [InputPanel.tsx]
- [x] [Review][Patch] Steering collapsible unmounts textarea on collapse — add useRef focus management back to toggle button on collapse [InputPanel.tsx]
- [x] [Review][Defer] useBackendStatus concurrent in-flight fetches — pre-existing issue from Story 2.3 [useBackendStatus.ts]
- [x] [Review][Defer] useAgUiRun 3s first-event timeout can call _setError after component unmounts — pre-existing from Story 2.1 [useAgUiRun.ts]
- [x] [Review][Defer] React concurrent-mode potential tear from separate useAuthoringStore subscriptions — pre-existing pattern throughout app [InputPanel.tsx]
- [x] [Review][Defer] No visible indicator on steering toggle when hidden instructions are present — minor UX enhancement, v1 single-user tool [InputPanel.tsx]
- [x] [Review][Defer] focus-visible without :focus fallback for older browsers — pre-existing pattern throughout app [InputPanel.tsx, ScopeChip.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Test `getByText(/select a chapter/i)` matched two elements: the option placeholder AND the error hint paragraph. Fixed by using exact string `'Select a chapter before generating.'` in affected tests.

### Completion Notes List

- AC2: `ScopeChip.tsx` with `CHAPTER_SCOPE` lookup (23 chapters, Genki I Ch.1–12 + Genki II Ch.13–23). Vocab counts derived from actual `genki1vocab.csv` (Ch.0 greetings excluded, matching backend `range(1, chapter+1)` logic). Grammar counts from `Genki_grammar_for_AI_generation.csv`. Highlights use `font-ja` class. 7 tests passing.
- AC1+AC3+AC4+AC5: `InputPanel.tsx` with native `<select>` (24 options incl. placeholder), paired `ScopeChip`, steering collapsible via `useState`, pre-flight validation with per-field hints that clear `onChange`. Generate button reads `useBackendStatus()` — disabled only on `'unavailable'`. 19 tests passing.
- AC1+AC5: `AuthoringTool.tsx` updated to mount `<InputPanel />`.
- AC6: 45/45 tests passing (19 store + 1 hook + 5 BackendStatus + 5 ModeToggle + 7 ScopeChip + 19 InputPanel — but 19 ModeToggle and 19 InputPanel overlap wait, actually: 8 store + 1 hook + 5 BackendStatus + 5 ModeToggle + 7 ScopeChip + 19 InputPanel = 45). `pnpm typecheck` clean.

### File List

- `apps/story-generator/src/components/ScopeChip.tsx` (new)
- `apps/story-generator/src/components/InputPanel.tsx` (new)
- `apps/story-generator/src/__tests__/ScopeChip.test.tsx` (new)
- `apps/story-generator/src/__tests__/InputPanel.test.tsx` (new)
- `apps/story-generator/src/components/AuthoringTool.tsx` (modified — mounts InputPanel)
- `_bmad-output/implementation-artifacts/2-4-input-panel-chapter-selector-and-scopechip.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)
