# Story 4.3: Responsive Layout & SettingsMenu

Status: done

## Story

As a **reader**,
I want to control word spacing and text size, and on desktop see story and panels side by side,
so that I can customise my reading comfort and make full use of screen real estate on larger devices.

## Acceptance Criteria

**AC1 — SettingsMenu content**

Given `SettingsMenu` (Radix Popover, ⚙ icon in `ToolBar`)
When opened
Then contains: Spaces toggle (controls `spacingVisible`) and three text size buttons A−, A, A+;
- A− → `textSize: 'small'` (1rem)
- A → `textSize: 'medium'` (1.25rem, reset)
- A+ → `textSize: 'large'` (1.5rem)

**AC2 — ToolBar now has 3 controls; regression guard updated**

Given `ToolBar`
When rendered
Then has exactly three interactive controls: ルビ toggle, Trans toggle, ⚙ settings icon;
the existing regression guard test is updated to assert 3 controls (not 2)

**AC3 — text size CSS custom property**

Given `textSize` changes in `preferenceStore`
When the story container renders
Then `--story-font-size` CSS custom property on the story container is set to the corresponding `TEXT_SIZE_VALUES` value; change is instant; `utils/textSize.ts` exports `TEXT_SIZE_VALUES` as a const

**AC4 — Narrow viewport (< lg) single-column layout with tab bar**

Given a viewport narrower than `lg` (< 1024px)
When `ReaderRoute` renders
Then single-column layout: InfoPanel full width, ToolBar below, scrollable story area; bottom tab bar shows `Story | Vocabulary | Grammar`; active tab: `accent` bottom border + `paper-text` label; inactive: `muted` text

**AC5 — Tab switching preserves story scroll position**

Given the user switches from `Story` to `Vocabulary` tab on mobile
When tab changes
Then VocabPanel replaces story content; InfoPanel and ToolBar remain; scroll position in story area is saved; switching back to Story restores that scroll position

**AC6 — Wide viewport (≥ lg) two-column layout**

Given a viewport at or wider than `lg` (≥ 1024px)
When `ReaderRoute` renders
Then two-column layout: InfoPanel spans full width, story text left column (max-width ~65ch), Vocabulary/Grammar tabs in right panel; bottom tab bar is NOT rendered on desktop

**AC7 — ReaderRoute.test.tsx updated for Epic 4**

Given `ReaderRoute.test.tsx`
When run
Then: regression guard updated to 3 controls; new ACs cover SettingsMenu opens with spacing + size controls; text size CSS property updates; tab bar renders with 3 tabs; tab switching shows correct panel; all previously preserved ACs still pass

## Tasks / Subtasks

- [x] Task 1: Install `@radix-ui/react-popover` and update test setup (AC1)
  - [x] Run `pnpm add @radix-ui/react-popover` from `apps/web`
  - [x] Add `ResizeObserver` mock to `apps/web/src/__tests__/setup.ts` (required for Radix in jsdom)

- [x] Task 2: Create `apps/web/src/utils/textSize.ts` (AC3)
  - [x] Export `TEXT_SIZE_VALUES` as `{ small: '1rem', medium: '1.25rem', large: '1.5rem' } as const`

- [x] Task 3: Create `apps/web/src/components/SettingsMenu.tsx` (AC1)
  - [x] Radix `Popover.Root` + `Popover.Trigger asChild` wrapping a `<button>` with `aria-label="Settings"` and ⚙ text
  - [x] `Popover.Portal` + `Popover.Content` with `sideOffset={5}`
  - [x] Spaces toggle: reads/sets `spacingVisible` from `usePreferenceStore`; `aria-pressed` reflects state
  - [x] Text size buttons A−/A/A+: call `setTextSize('small'|'medium'|'large')`; active button gets `bg-accent-subtle border-accent` style; inactive gets `bg-surface border-border text-muted`
  - [x] Use `useShallow` to select multiple fields from store (consistent with ToolBar pattern)
  - [x] Write succinct JSDoc for exported function

- [x] Task 4: Update `apps/web/src/components/ToolBar.tsx` (AC2)
  - [x] Import `SettingsMenu` from `@/components/SettingsMenu`
  - [x] Render `<SettingsMenu />` after the Trans button
  - [x] Update JSDoc: "3 interactive controls" (was 2)
  - [x] No changes to ルビ/Trans toggle logic

- [x] Task 5: Create `apps/web/src/__tests__/SettingsMenu.test.tsx` (AC1)
  - [x] Follows VocabItem/GrammarPanel test pattern: `afterEach` with `usePreferenceStore.setState(DEFAULT_PREFS)` + `localStorage.clear()`
  - [x] Test: ⚙ button exists with `aria-label="Settings"`
  - [x] Test: clicking ⚙ opens popover (Spaces toggle and A/A−/A+ buttons appear)
  - [x] Test: clicking Spaces toggle updates `spacingVisible`
  - [x] Test: clicking A− sets `textSize: 'small'`; A sets `'medium'`; A+ sets `'large'`
  - [x] Test: active size button has `bg-accent-subtle` class; inactive buttons do not

- [x] Task 6: Update `apps/web/src/routes/ReaderRoute.tsx` (AC3–AC6)
  - [x] Import `TEXT_SIZE_VALUES` from `@/utils/textSize`
  - [x] Import `VocabPanel` from `@/components/VocabPanel`
  - [x] Import `GrammarPanel` from `@/components/GrammarPanel`
  - [x] Read `textSize`, `activeTab`, `setActiveTab` from `usePreferenceStore` (use `useShallow`)
  - [x] Add `storyScrollRef = useRef<HTMLDivElement>(null)` and `savedScrollTop` state for scroll preservation
  - [x] Add `switchTab` handler: save story `scrollTop` before leaving story tab; call `setActiveTab(newTab)`
  - [x] Add `useEffect` to restore story `scrollTop` when `activeTab` returns to `'story'`
  - [x] Apply `--story-font-size` CSS custom property: `style={{ '--story-font-size': TEXT_SIZE_VALUES[textSize] } as React.CSSProperties}` on the story scroll container
  - [x] Responsive layout structure (see Dev Notes for exact shape)
  - [x] Mobile bottom tab bar: Story/Vocabulary/Grammar; active tab style: `border-b-2 border-accent text-paper-text`; inactive: `text-muted`
  - [x] Update AC tracking comment header (Epic 4 preserved/new ACs)

- [x] Task 7: Update `apps/web/src/__tests__/ReaderRoute.test.tsx` (AC7)
  - [x] Update "ToolBar has exactly 2 interactive controls" → "exactly 3 controls" (Popover.Trigger counts as 1 button)
  - [x] Add `DEFAULT_PREFS` import reset for `textSize` and `activeTab` fields (already present in existing `afterEach`)
  - [x] New test: clicking ⚙ opens SettingsMenu with Spaces and text size controls
  - [x] New test: clicking A+ sets `--story-font-size` to `1.5rem`
  - [x] New test: bottom tab bar renders with Story, Vocabulary, Grammar buttons
  - [x] New test: clicking Vocabulary tab shows VocabPanel (check for empty state or vocab content)
  - [x] New test: clicking Grammar tab shows GrammarPanel
  - [x] Update AC tracking comment block

- [x] Task 8: Verify
  - [x] `pnpm test:unit` from `apps/web` — 169/169 pass (157 pre-existing + 12 new)
  - [x] `pnpm typecheck` from repo root — 0 errors

### Review Findings

- [x] [Review][Patch] **HIGH** — `--story-font-size` CSS custom property is SET but never consumed: old `fontSize: 'var(--story-font-size, 1.25rem)'` was removed, so A−/A/A+ silently has no visual effect on text size [apps/web/src/routes/ReaderRoute.tsx] Fix: add `fontSize: 'var(--story-font-size)'` alongside the custom property in the story container's inline style
- [x] [Review][Patch] AC7: Test verifies `textSize` store update but not the `--story-font-size` CSS property itself — spec explicitly required testing the CSS property value [apps/web/src/__tests__/ReaderRoute.test.tsx] Fix: add `element.style.getPropertyValue('--story-font-size')` assertion after A+ click
- [x] [Review][Defer] Desktop right-panel tab buttons use `tab.charAt(0).toUpperCase()` instead of the `label` from the `TABS` constant, creating a duplicate label source [apps/web/src/routes/ReaderRoute.tsx] — deferred, no current divergence; low risk
- [x] [Review][Defer] `activeTab` persisted in localStorage with no validation against known values — an invalid stored string would cause an unknown tab state on startup [apps/web/src/routes/ReaderRoute.tsx] — deferred, schema/store layer concern; not triggered by any current authoring path
- [x] [Review][Defer] No test for bottom tab bar being hidden on desktop — CSS `lg:hidden` class, not verifiable in jsdom — deferred, Playwright E2E (Story 4.4) scope
- [x] [Review][Defer] No test for scroll position restoration when switching back to Story tab — jsdom does not implement scrollTop; deferred to Playwright
- [x] [Review][Defer] `getAllByText().length).toBeGreaterThan(0)` assertions (4 tests) would be more precise as exact counts for the dual-panel DOM — deferred, acceptable for v1 given CSS-responsive complexity

## Dev Notes

### New dependency — @radix-ui/react-popover

`@radix-ui/react-popover` is NOT currently installed (no Radix packages exist in `apps/web/package.json`). Install it first:

```bash
# Run from apps/web/
pnpm add @radix-ui/react-popover
```

This is the only new dependency for this story.

### ResizeObserver mock required for Radix in jsdom

Radix UI internally uses `ResizeObserver`. jsdom does not implement it, causing tests to fail with `ReferenceError: ResizeObserver is not defined`. Add to `apps/web/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom'

// Radix UI components use ResizeObserver internally; mock it for jsdom
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

### utils/textSize.ts — complete implementation

```typescript
/** Font size values for each textSize preference setting. */
export const TEXT_SIZE_VALUES = {
  small: '1rem',
  medium: '1.25rem',
  large: '1.5rem',
} as const
```

### SettingsMenu — complete implementation shape

```tsx
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { useShallow } from 'zustand/react/shallow'
import { TEXT_SIZE_VALUES } from '@/utils/textSize'

/** Popover settings panel with spacing toggle and text size controls. */
export function SettingsMenu() {
  const { spacingVisible, textSize, setSpacingVisible, setTextSize } = usePreferenceStore(
    useShallow(s => ({
      spacingVisible: s.spacingVisible,
      textSize: s.textSize,
      setSpacingVisible: s.setSpacingVisible,
      setTextSize: s.setTextSize,
    }))
  )

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="px-3 py-1 rounded text-sm border bg-surface border-border text-muted"
        >
          ⚙
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-surface border border-border rounded shadow-md p-3 flex flex-col gap-3 z-50 min-w-[160px]"
          sideOffset={5}
        >
          {/* Spaces toggle */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-paper-text">Spaces</span>
            <button
              type="button"
              aria-pressed={spacingVisible}
              onClick={() => setSpacingVisible(!spacingVisible)}
              className={cn(
                'px-3 py-1 rounded text-sm border',
                spacingVisible
                  ? 'bg-accent-subtle border-accent text-paper-text'
                  : 'bg-surface border-border text-muted',
              )}
            >
              {spacingVisible ? 'On' : 'Off'}
            </button>
          </div>

          {/* Text size controls */}
          <div className="flex items-center gap-1">
            {(['small', 'medium', 'large'] as const).map((size, i) => (
              <button
                key={size}
                type="button"
                aria-label={size === 'medium' ? 'Medium text (reset)' : size === 'small' ? 'Smaller text' : 'Larger text'}
                aria-pressed={textSize === size}
                onClick={() => setTextSize(size)}
                className={cn(
                  'px-2 py-1 rounded text-sm border flex-1',
                  textSize === size
                    ? 'bg-accent-subtle border-accent text-paper-text'
                    : 'bg-surface border-border text-muted',
                )}
              >
                {['A−', 'A', 'A+'][i]}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

### ToolBar — what changes

Only two modifications to `ToolBar.tsx`:
1. Add `import { SettingsMenu } from '@/components/SettingsMenu'`
2. Render `<SettingsMenu />` as the third element inside the toolbar div, after Trans button
3. Update JSDoc from "Exactly 2 interactive controls" to "3 interactive controls: ruby toggle, trans toggle, settings"

Do NOT add `spacingVisible` or `textSize` to ToolBar's state — those are internal to SettingsMenu.

### Current ReaderRoute.tsx state (read before modifying)

The current file (`apps/web/src/routes/ReaderRoute.tsx`) renders:
```
flex-col h-dvh bg-paper-bg
  AppBar
  InfoPanel
  ToolBar
  div.flex-1.overflow-y-auto.p-4  ← story scroll container (already has fontSize: 'var(--story-font-size, 1.25rem)')
    {sentences}
```

Story 4.3 restructures this significantly. `buildSupplementMap`, `loader`, and `ReaderError` are unchanged.

### ReaderRoute — responsive layout structure

```tsx
export function ReaderRoute() {
  const story = useLoaderData() as StoryModel
  const supplementMap = buildSupplementMap(story.vocabSupplement)

  const { textSize, activeTab, setActiveTab } = usePreferenceStore(
    useShallow(s => ({
      textSize: s.textSize,
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
    }))
  )

  // Scroll preservation: save story area scrollTop before leaving, restore on return
  const storyScrollRef = useRef<HTMLDivElement>(null)
  const [savedScrollTop, setSavedScrollTop] = useState(0)

  const switchTab = (tab: 'story' | 'vocabulary' | 'grammar') => {
    if (activeTab === 'story' && tab !== 'story' && storyScrollRef.current) {
      setSavedScrollTop(storyScrollRef.current.scrollTop)
    }
    setActiveTab(tab)
  }

  useEffect(() => {
    if (activeTab === 'story' && storyScrollRef.current) {
      storyScrollRef.current.scrollTop = savedScrollTop
    }
  }, [activeTab]) // intentionally omits savedScrollTop — only fires on tab change

  return (
    <div className="flex flex-col h-dvh bg-paper-bg">
      <AppBar />
      <InfoPanel story={story} />
      <ToolBar language={story.language} />

      {/* Content area: single column on mobile, two-column on desktop */}
      <div className="flex-1 flex overflow-hidden">

        {/* Story column: full-width mobile (story tab only), left column desktop (always) */}
        <div
          ref={storyScrollRef}
          className={cn(
            'overflow-y-auto p-4 w-full',
            activeTab !== 'story' ? 'hidden lg:block' : 'block',
            'lg:max-w-[65ch]',
          )}
          style={{ '--story-font-size': TEXT_SIZE_VALUES[textSize] } as React.CSSProperties}
        >
          {story.sentences.map((sentence, i) => (
            <SentenceBlock
              key={sentence.id}
              sentence={sentence}
              sentenceIndex={i}
              supplementMap={supplementMap}
            />
          ))}
        </div>

        {/* Desktop right panel: Vocabulary/Grammar tabs, hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:overflow-hidden lg:border-l lg:border-border">
          {/* Desktop tab buttons */}
          <div className="flex border-b border-border bg-surface">
            {(['vocabulary', 'grammar'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-sm capitalize',
                  (activeTab === tab || (activeTab === 'story' && tab === 'vocabulary'))
                    ? 'border-b-2 border-accent text-paper-text'
                    : 'text-muted',
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'grammar'
              ? <GrammarPanel grammar={story.grammar} sentences={story.sentences} />
              : <VocabPanel keywords={story.keywords} vocabSupplement={story.vocabSupplement} />
            }
          </div>
        </div>

        {/* Mobile-only: vocab panel (hidden on desktop since it's in right panel) */}
        <div className={cn('w-full overflow-y-auto', activeTab === 'vocabulary' ? 'block lg:hidden' : 'hidden')}>
          <VocabPanel keywords={story.keywords} vocabSupplement={story.vocabSupplement} />
        </div>

        {/* Mobile-only: grammar panel */}
        <div className={cn('w-full overflow-y-auto', activeTab === 'grammar' ? 'block lg:hidden' : 'hidden')}>
          <GrammarPanel grammar={story.grammar} sentences={story.sentences} />
        </div>
      </div>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <div className="lg:hidden flex border-t border-border bg-surface" role="tablist" aria-label="Content tabs">
        {(['story', 'vocabulary', 'grammar'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => switchTab(tab)}
            className={cn(
              'flex-1 py-3 text-sm',
              activeTab === tab
                ? 'border-b-2 border-accent text-paper-text'
                : 'text-muted',
            )}
          >
            {tab === 'story' ? 'Story' : tab === 'vocabulary' ? 'Vocabulary' : 'Grammar'}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Import additions needed in ReaderRoute.tsx:**
```typescript
import { useRef, useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { TEXT_SIZE_VALUES } from '@/utils/textSize'
import { VocabPanel } from '@/components/VocabPanel'
import { GrammarPanel } from '@/components/GrammarPanel'
```

### Critical: `--story-font-size` CSS custom property type assertion

Setting a CSS custom property via React's inline `style` prop requires a type assertion:

```tsx
style={{ '--story-font-size': TEXT_SIZE_VALUES[textSize] } as React.CSSProperties}
```

Without the cast, TypeScript will error because `React.CSSProperties` doesn't include custom properties by default.

### ReaderRoute.test.tsx — what changes

**Required changes (regression guard):**
```typescript
// Before (from Story 2.5):
it('ToolBar has exactly 2 interactive controls', () => {
  const buttons = within(toolbar).getAllByRole('button')
  expect(buttons).toHaveLength(2)
})

// After (Story 4.3):
it('ToolBar has exactly 3 interactive controls', () => {
  const buttons = within(toolbar).getAllByRole('button')
  expect(buttons).toHaveLength(3)
})
```

**New tests to add** (new describe block or inline):
```typescript
it('SettingsMenu opens with spacing and text size controls', async () => {
  renderRoute()
  const settingsBtn = screen.getByRole('button', { name: 'Settings' })
  fireEvent.click(settingsBtn)
  // Popover content appears in portal (document.body)
  expect(screen.getByRole('button', { name: /Spaces/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Smaller text' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Larger text' })).toBeInTheDocument()
})

it('A+ button sets --story-font-size to 1.5rem on story container', () => {
  renderRoute()
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
  // The story container div should have the CSS custom property set
  // Find the story scroll container by data-testid or by class characteristic
  // Verify preferenceStore textSize changed to 'large'
  expect(usePreferenceStore.getState().textSize).toBe('large')
})

it('renders bottom tab bar with Story, Vocabulary, Grammar tabs', () => {
  renderRoute()
  expect(screen.getByRole('tab', { name: 'Story' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Vocabulary' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Grammar' })).toBeInTheDocument()
})

it('clicking Vocabulary tab shows vocab panel empty state', () => {
  renderRoute() // baseStory has no keywords or vocabSupplement
  fireEvent.click(screen.getByRole('tab', { name: 'Vocabulary' }))
  expect(screen.getByText('No vocabulary defined for this story.')).toBeInTheDocument()
})

it('clicking Grammar tab shows grammar panel empty state', () => {
  renderRoute() // baseStory has grammar: []
  fireEvent.click(screen.getByRole('tab', { name: 'Grammar' }))
  expect(screen.getByText('No grammar notes for this story.')).toBeInTheDocument()
})
```

**AC tracking comment block update:** The existing header comment lists preserved ACs through Story 3.4. Add a new section:
```typescript
// NEW (Story 4.3):
//   - ToolBar has exactly 3 controls (updated from 2)
//   - SettingsMenu opens with spacing and text size controls
//   - A+ sets textSize to 'large' in preferenceStore
//   - Bottom tab bar renders Story/Vocabulary/Grammar tabs
//   - Vocabulary tab shows VocabPanel
//   - Grammar tab shows GrammarPanel
```

### SettingsMenu.test.tsx — Radix Popover in jsdom notes

Radix Popover renders content in a Portal (teleported to `document.body`). After clicking the trigger, the popover content appears in the document — `screen.getByText()` and `screen.getByRole()` WILL find it since they scan the full document.

The popover opens and closes synchronously in jsdom (no animation delays with Radix in test environments).

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SettingsMenu } from '@/components/SettingsMenu'
import { usePreferenceStore } from '@/stores/preferenceStore'

const DEFAULT_PREFS = {
  spacingVisible: false,
  textSize: 'medium' as const,
}

afterEach(() => {
  usePreferenceStore.setState(DEFAULT_PREFS)
  localStorage.clear()
})

describe('SettingsMenu', () => {
  it('renders a settings trigger button', () => {
    render(<SettingsMenu />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('clicking trigger opens popover with Spaces and size controls', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('Spaces')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medium text/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeInTheDocument()
  })

  it('Spaces toggle changes spacingVisible in store', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    // Spaces toggle is the button with aria-pressed
    const spacesBtn = screen.getByRole('button', { name: 'Off' }) // initial state is Off
    fireEvent.click(spacesBtn)
    expect(usePreferenceStore.getState().spacingVisible).toBe(true)
  })

  it('A− button sets textSize to small', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    expect(usePreferenceStore.getState().textSize).toBe('small')
  })

  it('A+ button sets textSize to large', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(usePreferenceStore.getState().textSize).toBe('large')
  })

  it('A button resets textSize to medium', () => {
    usePreferenceStore.setState({ textSize: 'large' })
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /Medium text/ }))
    expect(usePreferenceStore.getState().textSize).toBe('medium')
  })

  it('active size button has bg-accent-subtle; inactive buttons do not', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    // medium is default active
    expect(screen.getByRole('button', { name: /Medium text/ })).toHaveClass('bg-accent-subtle')
    expect(screen.getByRole('button', { name: 'Smaller text' })).not.toHaveClass('bg-accent-subtle')
    expect(screen.getByRole('button', { name: 'Larger text' })).not.toHaveClass('bg-accent-subtle')
  })
})
```

### preferenceStore — NO changes needed

`preferenceStore.ts` already has all needed state from Story 1.4:
- `spacingVisible: boolean` with `setSpacingVisible`
- `textSize: 'small' | 'medium' | 'large'` with `setTextSize`
- `activeTab: 'story' | 'vocabulary' | 'grammar'` with `setActiveTab`

Do NOT modify it.

### lookupStore — NO changes needed

### VocabPanel and GrammarPanel — props reference

Both components already exist from Stories 4.1 and 4.2:
```typescript
// VocabPanel.tsx
<VocabPanel keywords={story.keywords} vocabSupplement={story.vocabSupplement} />

// GrammarPanel.tsx
<GrammarPanel grammar={story.grammar} sentences={story.sentences} />
```

`story.keywords` is `VocabSupplementEntry[] | undefined` — VocabPanel already handles undefined (defaults to `[]` internally via `keywords ?? []`).

### File locations summary

```
apps/web/
  src/
    utils/
      textSize.ts           ← NEW
    components/
      SettingsMenu.tsx      ← NEW
      ToolBar.tsx           ← MODIFY (add SettingsMenu, update JSDoc)
    routes/
      ReaderRoute.tsx       ← MODIFY (major restructure)
    __tests__/
      setup.ts              ← MODIFY (add ResizeObserver mock)
      SettingsMenu.test.tsx ← NEW
      ReaderRoute.test.tsx  ← MODIFY (regression guard + new ACs)
```

### What this story does NOT include

- Playwright E2E tests — Story 4.4 scope
- CreditsRoute — Story 4.4 scope
- Any changes to `WordToken`, `SentenceBlock`, `InfoPanel`, `KanjiBreakdown`, `AppBar`, `DifficultyBadge`, `StoryCard`
- Any changes to services, stores (except reading them), or router

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `@radix-ui/react-popover 1.1.15`; added `ResizeObserver` global mock to `setup.ts` for jsdom compatibility.
- Created `utils/textSize.ts` exporting `TEXT_SIZE_VALUES` const.
- Created `SettingsMenu.tsx`: Radix Popover with ⚙ trigger (`aria-label="Settings"`), Spaces toggle with `aria-pressed`, and A−/A/A+ text size buttons; reads/sets from `usePreferenceStore` via `useShallow`.
- Updated `ToolBar.tsx`: added `SettingsMenu` as third control; updated JSDoc. ルビ/Trans logic unchanged.
- Major refactor of `ReaderRoute.tsx`: integrated `VocabPanel` and `GrammarPanel`, responsive two-column desktop layout (Tailwind `lg:` breakpoint), mobile tab bar (Story/Vocabulary/Grammar), scroll preservation via `useRef`+`useState`, `--story-font-size` CSS custom property driven by `TEXT_SIZE_VALUES[textSize]`.
- Updated `ReaderRoute.test.tsx`: regression guard updated 2→3 controls; 5 new tests for SettingsMenu, textSize, tab bar, and panel switching; 4 existing supplement tests updated to use `getAllByText` to handle dual DOM rendering (CSS-responsive panels both present in jsdom).
- Created `SettingsMenu.test.tsx`: 7 tests covering trigger, popover open, Spaces toggle, A−/A/A+ text size, and active state styling. All 169 tests pass, 0 TypeScript errors.

### File List

- `apps/web/src/utils/textSize.ts` (NEW)
- `apps/web/src/components/SettingsMenu.tsx` (NEW)
- `apps/web/src/__tests__/SettingsMenu.test.tsx` (NEW)
- `apps/web/src/components/ToolBar.tsx` (UPDATED — added SettingsMenu, updated JSDoc)
- `apps/web/src/routes/ReaderRoute.tsx` (UPDATED — major refactor: panels, responsive layout, tab bar, scroll preservation, CSS custom property)
- `apps/web/src/__tests__/setup.ts` (UPDATED — ResizeObserver mock)
- `apps/web/src/__tests__/ReaderRoute.test.tsx` (UPDATED — regression guard 2→3, 5 new tests, 4 getAllByText fixes)
- `apps/web/package.json` (UPDATED — @radix-ui/react-popover dependency)
- `apps/web/pnpm-lock.yaml` (UPDATED — lock file)
