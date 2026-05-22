# Story Supp-2: Reader UI Horizontal Layout Polish

Status: ready

## Story

As a reader,
I want the reader UI to make better use of horizontal screen space,
so that the app bar is cleaner, word lookups are more scannable, reading controls are always visible alongside the lookup panel, and the vocabulary panel shows more entries without scrolling.

## Acceptance Criteria

**AC1 — AppBar: title centred, right slot for caller-supplied content:**
Given any page that renders `AppBar`,
when the component is displayed,
then the 日本の本 title is visually centred in the bar regardless of what is placed in the left or right slots;
and `AppBar` accepts an optional `rightSlot` prop (`React.ReactNode`) rendered in the right cell — when omitted the right cell is empty;
and `AppBar` no longer hard-codes any knowledge of `SettingsMenu`.

**AC2 — ReaderRoute passes SettingsMenu as rightSlot; SettingsMenu removed from ToolBar; InfoPanel and ToolBar laid out side by side:**
Given the `reader` route renders,
when the page is displayed,
then `ReaderRoute` passes `<SettingsMenu />` as the `rightSlot` prop to `<AppBar />`;
and `InfoPanel` and `ToolBar` appear in the same horizontal band — `InfoPanel` on the left (expanding to fill available width) and `ToolBar` on the right, top-aligned;
and `ToolBar` stacks its buttons vertically rather than horizontally;
and `ToolBar` no longer contains a Settings button;
and the popover opened by the AppBar Settings button still controls `spacingVisible` and `textSize` from `preferenceStore` (no regression).

**AC3 — InfoPanel: kanji word and hiragana reading displayed inline:**
Given a word lookup has status `found`,
when `InfoPanel` renders the result,
then the looked-up word (kanji) and its hiragana reading appear on the same line — word on the left, reading immediately to its right — with the English meaning displayed on its own line below.

**AC4 — VocabItem: three elements displayed horizontally:**
Given `VocabPanel` renders one or more entries,
when a `VocabItem` is displayed,
then the word (kanji), reading (hiragana), and meaning (English) are laid out in a single horizontal row, each in its own column, with appropriate widths so none of the three fields is clipped on typical mobile widths.

**AC5 — No regressions, typecheck passes:**
Given all changes are applied,
when `pnpm typecheck` and `pnpm test:unit` run in `apps/web`,
then all pre-existing tests pass; the `SettingsMenu` unit tests are unaffected; any test that asserts the toolbar contains a Settings button is updated to look for it in `AppBar` instead; any test that asserts ToolBar button count is updated to reflect 2 buttons (Ruby + Trans).

## Tasks / Subtasks

- [ ] AC1: Update `AppBar` to a three-column grid layout with a `rightSlot` prop
  - [ ] Add `rightSlot?: React.ReactNode` to `AppBarProps`
  - [ ] Change the header from `flex justify-between` to `grid grid-cols-3 items-center`
  - [ ] Left cell: existing back link (reader) or empty `<span>` (library) — no content change
  - [ ] Centre cell: 日本の本 title with `justify-self-center`
  - [ ] Right cell: render `{rightSlot ?? <span />}`
  - [ ] Remove any existing import of `SettingsMenu` from `AppBar.tsx` (if present)

- [ ] AC2a: Update `ReaderRoute` — pass SettingsMenu as rightSlot; wrap InfoPanel+ToolBar
  - [ ] Add `import { SettingsMenu } from '@/components/SettingsMenu'` to `ReaderRoute.tsx`
  - [ ] Change `<AppBar />` to `<AppBar rightSlot={<SettingsMenu />} />`
  - [ ] Replace the two adjacent `<InfoPanel ... />` and `<ToolBar ... />` elements with a wrapping `<div className="flex items-start border-b border-border">` containing both
  - [ ] `InfoPanel` and `ToolBar` must both drop their own `border-b border-border` declarations — the wrapper now owns the shared bottom border

- [ ] AC2b: Change `ToolBar` to a vertical button stack; remove `SettingsMenu`
  - [ ] Change the root div from `flex gap-2 px-4 py-2 bg-surface border-b border-border` to `flex flex-col gap-2 px-3 py-3 border-l border-border bg-surface`
  - [ ] Delete the `<SettingsMenu />` element and its import

- [ ] AC3: Inline word + reading in `InfoPanel` found state
  - [ ] Wrap word and reading in `<div className="flex items-baseline gap-2">`
  - [ ] Word: `<span className="font-ja font-semibold text-paper-text" lang="ja">`
  - [ ] Reading: `<span className="text-[0.875rem] font-ja text-muted" lang="ja">`
  - [ ] Keep meaning `<p>` and `<KanjiBreakdown>` below, unchanged
  - [ ] Remove `border-b border-border` from `InfoPanel`'s root div (the `ReaderRoute` wrapper now provides it)

- [ ] AC4: Horizontal layout for `VocabItem`
  - [ ] Change root div from `flex-col` to `flex-row items-center gap-2`
  - [ ] Word column: add `min-w-[4rem]`
  - [ ] Reading column: add `min-w-[5.5rem]`
  - [ ] Meaning column: add `flex-1`
  - [ ] Confirm `bg-accent-subtle` highlight still spans the full row

- [ ] AC5: Update tests
  - [ ] In `ReaderRoute.test.tsx`: update the "ToolBar has exactly 3 interactive controls" test to assert 2 controls; add an assertion that the rendered AppBar contains a Settings button (via `rightSlot`)
  - [ ] Run `pnpm typecheck && pnpm test:unit` — confirm clean

## Dev Notes

### What This Story IS and IS NOT

IS:
- A pure visual / layout refactor — no state, store, or schema changes
- Introducing a `rightSlot` prop on `AppBar` so it stays agnostic of reader concerns
- Moving responsibility for composing `SettingsMenu` into `AppBar` from `ReaderRoute` (not from `AppBar` itself)
- Placing `InfoPanel` and `ToolBar` side by side (top-aligned) in `ReaderRoute` instead of stacked vertically
- Changing `ToolBar`'s internal button layout from horizontal to vertical
- Changing flex direction on `VocabItem` and introducing an inline word+reading row in `InfoPanel`

IS NOT:
- Any deletion of `ToolBar` — the component is kept; only its layout and contents change
- Any change to `preferenceStore`, `lookupStore`, or other state
- Any change to `SettingsMenu` internals — only its render location changes
- AppBar knowing anything about `SettingsMenu` — that coupling lives in `ReaderRoute`

### AppBar rightSlot prop

`AppBar` becomes a generic three-column header. The caller decides what goes in the right cell.

```tsx
interface AppBarProps {
  /** 'reader' shows the back link; 'library' shows logo only. Defaults to 'reader'. */
  variant?: 'reader' | 'library'
  /** Optional content rendered in the right cell of the header grid. */
  rightSlot?: React.ReactNode
}

export function AppBar({ variant = 'reader', rightSlot }: AppBarProps) {
  return (
    <header className={cn('grid grid-cols-3 items-center bg-surface px-4 py-2 border-b border-border')}>
      {variant === 'reader' ? (
        <Link to="/" aria-label="Back to library" className="text-sm text-muted hover:text-paper-text transition-colors">
          ← Library
        </Link>
      ) : (
        <span />
      )}
      <span className="font-ja text-sm text-muted justify-self-center" lang="ja">
        日本の本
      </span>
      {rightSlot ?? <span />}
    </header>
  )
}
```

### ReaderRoute: AppBar usage and side-by-side wrapper

```tsx
// AppBar with SettingsMenu in the right slot
<AppBar rightSlot={<SettingsMenu />} />

// InfoPanel and ToolBar in a shared top-aligned flex row
<div className="flex items-start border-b border-border">
  <InfoPanel story={story} />
  <ToolBar language={story.language} />
</div>
```

`items-start` (not `items-stretch`) means ToolBar height is determined by its own content — the two buttons — not by however tall InfoPanel grows. The wrapper's `border-b` replaces both components' individual bottom borders.

### ToolBar vertical layout

Current (horizontal, 3 buttons):
```tsx
<div role="toolbar" aria-label="Reading controls" className="flex gap-2 px-4 py-2 bg-surface border-b border-border">
  <button ...>{rubyLabel}</button>
  <button ...>Trans</button>
  <SettingsMenu />
</div>
```

Target (vertical, 2 buttons, no SettingsMenu):
```tsx
<div role="toolbar" aria-label="Reading controls" className="flex flex-col gap-2 px-3 py-3 border-l border-border bg-surface">
  <button ...>{rubyLabel}</button>
  <button ...>Trans</button>
</div>
```

`justify-center` is removed — with `items-start` on the wrapper, ToolBar sits at the top of the band and its buttons are naturally top-aligned. No vertical centering needed.

### InfoPanel inline word + reading (AC3)

Current found state:
```tsx
<div>
  <p className="font-ja font-semibold" lang="ja">{lookupState.word}</p>
  <p className="text-[1.125rem] text-paper-text">{lookupState.entry.meaning}</p>
  <p className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</p>
  <KanjiBreakdown word={lookupState.word} />
</div>
```

Target found state:
```tsx
<div>
  <div className="flex items-baseline gap-2">
    <span className="font-ja font-semibold text-paper-text" lang="ja">{lookupState.word}</span>
    <span className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</span>
  </div>
  <p className="text-[1.125rem] text-paper-text">{lookupState.entry.meaning}</p>
  <KanjiBreakdown word={lookupState.word} />
</div>
```

### VocabItem horizontal layout

Current (vertical):
```tsx
<div className={cn('flex flex-col px-3 py-2 cursor-pointer rounded', ...)}>
  <span className="font-ja text-paper-text text-base" lang="ja">{entry.word}</span>
  <span className="font-ja text-muted text-sm" lang="ja">{entry.reading}</span>
  <span className="text-paper-text text-sm">{entry.meaning}</span>
</div>
```

Target (horizontal):
```tsx
<div className={cn('flex flex-row items-center gap-2 px-3 py-2 cursor-pointer rounded', ...)}>
  <span className="font-ja text-paper-text text-base min-w-[4rem]" lang="ja">{entry.word}</span>
  <span className="font-ja text-muted text-sm min-w-[5.5rem]" lang="ja">{entry.reading}</span>
  <span className="text-paper-text text-sm flex-1">{entry.meaning}</span>
</div>
```

### Files changed

| File | Change |
|------|--------|
| `apps/web/src/components/AppBar.tsx` | UPDATE — grid layout, centre title, add `rightSlot` prop; remove any SettingsMenu knowledge |
| `apps/web/src/components/ToolBar.tsx` | UPDATE — remove SettingsMenu; vertical flex layout; drop bottom border; remove `justify-center` |
| `apps/web/src/components/InfoPanel.tsx` | UPDATE — inline word+reading in found state; drop bottom border |
| `apps/web/src/components/VocabItem.tsx` | UPDATE — horizontal flex layout |
| `apps/web/src/routes/ReaderRoute.tsx` | UPDATE — pass `rightSlot={<SettingsMenu />}` to AppBar; wrap InfoPanel+ToolBar in `flex items-start` div with bottom border |
| `apps/web/src/__tests__/ReaderRoute.test.tsx` | UPDATE — ToolBar control count 3→2; add AppBar Settings button assertion |

## Dev Agent Record

_To be filled in by the implementing agent._

### Model used
_pending_

### Completion notes
_pending_

### Change log
_pending_
