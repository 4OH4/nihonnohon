# Story 2.3: WordToken & SentenceBlock Components

Status: done

## Story

As a **reader**,
I want each Japanese word displayed as a tappable element with an optional ruby annotation above it,
so that I can select any word to look it up and optionally reveal its reading without disrupting the text layout.

## Acceptance Criteria

**AC1 — WordToken ruby rendering**

Given a `WordToken` with a ruby annotation and `rubyVisible: true`
When rendered
Then uses `<ruby lang="ja">` with `<rt>` containing the annotation; when `rubyVisible` is false, `<rt>` has class `invisible` (`visibility: hidden`); `display: none` is NEVER used on `<rt>`; line height is preserved regardless of toggle state; `white-space: nowrap` applied to the token

**AC2 — WordToken accessibility and interaction**

Given a `WordToken`
When rendered
Then has `role="button"`, `tabIndex={0}`, `aria-label` containing the word text; `lang="ja"` on all Japanese text elements; `onClick` calls `lookup(word, entry, sentenceId)`; `onKeyDown` fires lookup on both `Enter` AND `Space`

**AC3 — WordToken silent null ignore**

Given a `WordToken` where `vocabKey` is `null` OR `lookupVocab(vocabKey)` returns `null`
When tapped or activated via keyboard
Then `lookup` is NOT called; the info panel is not updated; no visual error is shown

**AC4 — WordToken active state**

Given a `WordToken` that is currently the active lookup word (`lookupState.status === 'found' && lookupState.word === word`)
When rendered
Then shows `bg-accent-subtle` background + 2px `accent` bottom border; a non-active token shows no background tint or border on default; hover state shows `accent-subtle` background only

**AC5 — SentenceBlock spacing toggle**

Given a `SentenceBlock` with `spacingVisible: false`
When rendered
Then word tokens have `gap-x-0`; with `spacingVisible: true`, tokens have `gap-x-2` with `transition-[gap] duration-150`; transition is CSS-only with no JS re-render

**AC6 — SentenceBlock selection highlight**

Given a `SentenceBlock` whose `sentence.id` matches `selectedSentenceId` in `useLookupStore`
When rendered
Then the container has `bg-accent-subtle` with `transition-colors duration-100`; non-selected sentences have no background tint; container has `role="group"` and `aria-label="Sentence N"`; clicking the container (not a word token) calls `selectSentence(sentence.id)`

**AC7 — SentenceBlock translation**

Given a `SentenceBlock` with `transVisible: true` and a non-null `sentence.translation`
When rendered
Then translation text appears below the word row in italic, `text-translation` colour (`#4A7B9D`), `font-size: 0.8em`; if `translation` is `null`, nothing is rendered below the word row

**AC8 — Tests**

Given `WordToken.test.tsx` and `SentenceBlock.test.tsx`
When run
Then cover: ruby toggle (`invisible` not `display:none`); Enter and Space keyboard triggers; silent ignore for null vocabKey; active word styling; sentence selection highlight; spacing gap toggle; translation conditional rendering; `afterEach(_reset)` present for both lookup and preference stores

## Tasks / Subtasks

- [x] Task 1: Install `@testing-library/react` (required for component tests)
  - [x] Run `pnpm add -D @testing-library/react @testing-library/jest-dom` in `apps/web`
  - [x] Add `import '@testing-library/jest-dom'` to a new `apps/web/src/__tests__/setup.ts` file
  - [x] Add `setupFiles: ['./src/__tests__/setup.ts']` to `vite.config.ts` test config

- [x] Task 2: Implement `WordToken.tsx` (AC1–AC4)
  - [x] Create `apps/web/src/components/WordToken.tsx`
  - [x] `<ruby role="button">` as outer element with `tabIndex={0}`, `aria-label={word}`, `lang="ja"`
  - [x] `<rt className={cn(!rubyVisible && 'invisible')}>{ruby ?? ''}</rt>` — use `invisible` not `display:none`
  - [x] `word-token` class OR `whitespace-nowrap` on the outer element
  - [x] `onClick` and `onKeyDown` (Enter AND Space): call `stopPropagation`, then conditionally call `lookup`
  - [x] Silent ignore: if `vocabKey === null` OR `lookupVocab(vocabKey) === null`, return early without calling `lookup`
  - [x] Active state: `bg-accent-subtle border-b-2 border-accent`; hover: `hover:bg-accent-subtle`

- [x] Task 3: Write `WordToken.test.tsx` (AC1–AC4)
  - [x] Create `apps/web/src/__tests__/WordToken.test.tsx`
  - [x] Test: `<rt>` has `invisible` class when `rubyVisible` is false
  - [x] Test: `<rt>` does NOT have `display:none` (check `rt.style.display === ''`)
  - [x] Test: Enter keydown triggers lookup; Space keydown triggers lookup
  - [x] Test: null vocabKey → lookup NOT called
  - [x] Test: `lookupVocab` returns null → lookup NOT called
  - [x] Test: active word gets `bg-accent-subtle` class
  - [x] `afterEach` resets both lookup and preference stores

- [x] Task 4: Implement `SentenceBlock.tsx` (AC5–AC7)
  - [x] Create `apps/web/src/components/SentenceBlock.tsx`
  - [x] Props: `sentence: SentenceModel`, `sentenceIndex: number`
  - [x] `role="group"`, `aria-label="Sentence {sentenceIndex + 1}"`
  - [x] Container `onClick` calls `selectSentence(sentence.id)` (NOT from word token clicks — those stop propagation)
  - [x] `transition-[gap] duration-150` + conditional `gap-x-2` / `gap-x-0` based on `spacingVisible`
  - [x] `transition-colors duration-100` + conditional `bg-accent-subtle` based on `selectedSentenceId === sentence.id`
  - [x] Map `sentence.words` → `WordToken` components, passing `ruby[i]`, `vocabKeys[i]`, `sentenceId`
  - [x] Translation: render when `transVisible && sentence.translation !== null`; use `text-translation italic` classes + `style={{ fontSize: '0.8em' }}`

- [x] Task 5: Write `SentenceBlock.test.tsx` (AC5–AC8)
  - [x] Create `apps/web/src/__tests__/SentenceBlock.test.tsx`
  - [x] Test: spacing toggle changes gap class
  - [x] Test: selected sentence gets `bg-accent-subtle`
  - [x] Test: container click calls `selectSentence`
  - [x] Test: translation shown when `transVisible: true` and `translation` is set
  - [x] Test: translation hidden when `transVisible: false`
  - [x] Test: translation hidden when `sentence.translation` is null
  - [x] `afterEach` resets both lookup and preference stores

- [x] Task 6: Verify tests pass
  - [x] Run `pnpm test:unit` in `apps/web` — all tests pass including existing tests (32 passing from Stories 2.1/2.2)

## Dev Notes

### FIRST: Install `@testing-library/react`

`@testing-library/react` is NOT in `apps/web/package.json`. It must be installed before writing tests:

```bash
# run from apps/web
pnpm add -D @testing-library/react @testing-library/jest-dom
```

Then create `apps/web/src/__tests__/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

And update `apps/web/vite.config.ts` test config:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/__tests__/setup.ts'],  // add this line
  exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
},
```

### Global CSS already handles ruby positioning and word-token

`apps/web/src/index.css` already contains:
```css
ruby { ruby-position: over; ruby-align: center; }
.word-token { white-space: nowrap; }
.ruby-hidden rt { visibility: hidden; }
```

- Use the `.word-token` class OR `whitespace-nowrap` Tailwind utility on the `<ruby>` element (both work)
- Do NOT use `.ruby-hidden` — the AC requires `invisible` class on `<rt>` directly (Tailwind's `visibility: hidden`), not a parent-class approach
- `--story-font-size: 1.25rem` is also set in `:root` — the translation's `0.8em` is relative to this

### WordToken implementation sketch

```tsx
import { cn } from '@/lib/utils'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { lookupVocab } from '@/services/vocabService'

interface WordTokenProps {
  word: string
  ruby: string | null
  vocabKey: number | null
  sentenceId: string
}

/** Renders a single Japanese word token with optional ruby annotation and lookup interaction. */
export function WordToken({ word, ruby, vocabKey, sentenceId }: WordTokenProps) {
  const lookup = useLookupStore((s) => s.lookup)
  const lookupStatus = useLookupStore((s) => s.lookupState.status)
  const activeWord = useLookupStore((s) =>
    s.lookupState.status === 'found' ? s.lookupState.word : null
  )
  const rubyVisible = usePreferenceStore((s) => s.rubyVisible)

  const isActive = lookupStatus === 'found' && activeWord === word

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation() // prevent SentenceBlock container from also firing
    if (vocabKey === null) return
    const entry = lookupVocab(vocabKey)
    if (entry === null) return
    lookup(word, entry, sentenceId)
  }

  return (
    <ruby
      role="button"
      tabIndex={0}
      aria-label={word}
      lang="ja"
      className={cn(
        'font-ja cursor-pointer rounded word-token',
        isActive
          ? 'bg-accent-subtle border-b-2 border-accent'
          : 'hover:bg-accent-subtle',
      )}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleActivate(e)
      }}
    >
      {word}
      <rt className={cn(!rubyVisible && 'invisible')}>
        {ruby ?? ''}
      </rt>
    </ruby>
  )
}
```

**Critical: `e.stopPropagation()` is NOT optional.** Without it, clicking a WordToken would ALSO trigger `SentenceBlock`'s container `onClick`, calling `selectSentence` which resets `lookupState` to idle immediately after `lookup` set it to `found`. This is a subtle bug that would be hard to catch without understanding the event bubbling model.

**Critical: `stopPropagation` even when ignoring the tap** (null vocabKey/entry). Otherwise tapping a no-entry word would bubble to the container and call `selectSentence`, which is NOT the intended "silently ignored" behaviour.

### SentenceBlock implementation sketch

```tsx
import { cn } from '@/lib/utils'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { useShallow } from 'zustand/react/shallow'
import { WordToken } from '@/components/WordToken'
import type { SentenceModel } from '@nihonnohon/schema'

interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
}

/** Renders a sentence as a row of WordTokens with optional translation and selection highlight. */
export function SentenceBlock({ sentence, sentenceIndex }: SentenceBlockProps) {
  const { selectSentence, selectedSentenceId } = useLookupStore(
    useShallow((s) => ({
      selectSentence: s.selectSentence,
      selectedSentenceId: s.selectedSentenceId,
    }))
  )
  const { spacingVisible, transVisible } = usePreferenceStore(
    useShallow((s) => ({ spacingVisible: s.spacingVisible, transVisible: s.transVisible }))
  )

  const isSelected = selectedSentenceId === sentence.id

  return (
    <div
      role="group"
      aria-label={`Sentence ${sentenceIndex + 1}`}
      onClick={() => selectSentence(sentence.id)}
      className={cn(
        'flex flex-wrap py-2 px-1 rounded transition-[gap] duration-150 transition-colors duration-100',
        spacingVisible ? 'gap-x-2' : 'gap-x-0',
        isSelected && 'bg-accent-subtle',
      )}
    >
      {sentence.words.map((word, i) => (
        <WordToken
          key={i}
          word={word}
          ruby={sentence.ruby[i] ?? null}
          vocabKey={sentence.vocabKeys[i] ?? null}
          sentenceId={sentence.id}
        />
      ))}
      {transVisible && sentence.translation !== null && (
        <p className="w-full mt-1 italic text-translation" style={{ fontSize: '0.8em' }}>
          {sentence.translation}
        </p>
      )}
    </div>
  )
}
```

Note: `cn()` combines `transition-[gap]` and `transition-colors` in the same class string — both transitions apply simultaneously. Tailwind compiles these as separate CSS transition-property values.

### `useShallow` import path

```ts
import { useShallow } from 'zustand/react/shallow'
```

Use for multi-value object selectors only. Single-value primitive selectors (e.g. `s.rubyVisible`) don't need it.

### Test isolation for components

Both stores need to be reset after each test:
```ts
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _resetVocab, _initVocabFromData } from '@/services/vocabService'

const DEFAULT_PREFS = {
  rubyVisible: true, spacingVisible: false, transVisible: false,
  textSize: 'medium' as const, activeTab: 'story' as const,
}

afterEach(() => {
  useLookupStore.getState()._reset()
  usePreferenceStore.setState(DEFAULT_PREFS)
  localStorage.clear()
  _resetVocab()
})
```

For tests that call through the `lookup` flow (i.e. `handleActivate` calls `lookupVocab`), seed the vocab service:
```ts
import type { VocabEntry } from '@nihonnohon/schema'

const vocabFixture: VocabEntry[] = [
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
]

beforeEach(() => _initVocabFromData(vocabFixture))
```

### WordToken test — ruby toggle

```tsx
it('rt has invisible class when rubyVisible is false', () => {
  usePreferenceStore.setState({ rubyVisible: false })
  const { container } = render(
    <WordToken word="食べる" ruby="たべる" vocabKey={null} sentenceId="s1" />
  )
  const rt = container.querySelector('rt')!
  expect(rt.classList.contains('invisible')).toBe(true)
  expect(rt.style.display).not.toBe('none') // never display:none
})
```

### WordToken test — keyboard triggers

```tsx
it('Enter keydown calls lookup', () => {
  _initVocabFromData(vocabFixture)
  const { getByRole } = render(
    <WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />
  )
  fireEvent.keyDown(getByRole('button', { name: '食べる' }), { key: 'Enter' })
  expect(useLookupStore.getState().lookupState).toMatchObject({ status: 'found', word: '食べる' })
})
```

### SentenceModel fixture for tests

```ts
import type { SentenceModel } from '@nihonnohon/schema'

const sentence: SentenceModel = {
  id: 'sent-1',
  words: ['食べる', 'は', '楽しい'],
  ruby: ['たべる', null, 'たのしい'],
  vocabKeys: [42, null, null],
  translation: 'Eating is fun.',
  grammar: [],
}
```

### Translation colour

`text-translation` maps to `#4A7B9D` via `tailwind.config.ts`. This token IS defined — do not use inline `style={{ color: '#4A7B9D' }}`.

### What this story does NOT include

- `InfoPanel` or `KanjiBreakdown` — Story 2.4
- Wiring to `ReaderRoute` — Story 2.5
- `AppBar`, `ToolBar` — Story 2.5
- The `vocabSupplement` lookup path — Story 2.5
- Text size control (`--story-font-size` CSS property update) — Epic 4

### Project Structure Notes

**New files (CREATE):**
- `apps/web/src/components/WordToken.tsx`
- `apps/web/src/components/SentenceBlock.tsx`
- `apps/web/src/__tests__/WordToken.test.tsx`
- `apps/web/src/__tests__/SentenceBlock.test.tsx`
- `apps/web/src/__tests__/setup.ts` (new Vitest setup file)

**Files to UPDATE:**
- `apps/web/vite.config.ts` — add `setupFiles` entry
- `apps/web/package.json` — `@testing-library/react` and `@testing-library/jest-dom` devDeps (via `pnpm add -D`)

**Do NOT modify:** stores, services, schema, story-loader, router, `ReaderRoute.tsx`.

### Learnings from Stories 2.1 / 2.2

- `try/finally` for any test that sets global state outside `beforeEach`/`afterEach`
- Store test helpers (`_reset`, `_initVocabFromData`) are the right pattern — use them here
- `_initVocabFromData` must be called before any test that expects `lookupVocab` to return a non-null entry
- The `lookup` store function receives a pre-resolved `VocabEntry | null` — the component is responsible for calling `lookupVocab` first

### References

- Ruby rendering rules: [architecture.md — Japanese Text Rendering Patterns]
- WordToken ARIA/keyboard: [architecture.md — Japanese Text Rendering Patterns]
- SentenceBlock pattern: [architecture.md — Sentence Selection Patterns]
- Design tokens: [apps/web/tailwind.config.ts]
- Global CSS (ruby + word-token): [apps/web/src/index.css]
- `useShallow` import: `zustand/react/shallow`
- Component file locations: [project-context.md — Framework-Specific Rules]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `@testing-library/react@16.3.2` and `@testing-library/jest-dom@6.9.1`; created `setup.ts` and wired `setupFiles` in `vite.config.ts`.
- `WordToken`: `<ruby role="button">` outer element; `e.stopPropagation()` on ALL activations (including null-entry taps) to prevent SentenceBlock container from resetting lookupState; `invisible` on `<rt>`, never `display:none`; `word-token` global CSS class for `white-space: nowrap`.
- `SentenceBlock`: `useShallow` for multi-value Zustand selectors; `transition-[gap]` and `transition-colors` combined in same `cn()`; translation uses `text-translation` Tailwind token and `style={{ fontSize: '0.8em' }}`.
- Key discovery: direct `useXxxStore.setState()` calls in tests outside `render()` / `fireEvent` require wrapping in `act()` to avoid React re-render warnings. Fixed by wrapping all external store mutations in `act(() => { ... })`.
- 54/54 tests passing, zero warnings. 11 new WordToken tests, 11 new SentenceBlock tests.

### Review Findings

- [x] [Review][Patch] `transition-[gap] duration-150` and `transition-colors duration-100` both set `transition-property` — in Tailwind v3 only the last wins, silently dropping the background-color transition; fix: `transition-[gap,background-color] duration-150` [SentenceBlock.tsx:35]
- [x] [Review][Patch] `style={{ fontSize: '0.8em' }}` violates the inline-style constraint (only CSS custom properties permitted in style={}); replace with Tailwind `text-[0.8em]` class [SentenceBlock.tsx:55]
- [x] [Review][Patch] `_initVocabFromData(vocabFixture)` called in `afterEach` instead of `beforeEach` in SentenceBlock.test.tsx — first test of a fresh run has uninitialised vocab; inconsistent with WordToken.test.tsx pattern [SentenceBlock.test.tsx]
- [x] [Review][Defer] Empty `<rt>` when `ruby` is null renders a `<rt>` with empty string content; some screen readers may announce the empty annotation — add `aria-hidden` or conditionally omit `<rt>` when ruby is null [WordToken.tsx:52] — deferred, minor a11y improvement

### File List

- `apps/web/src/components/WordToken.tsx` (new)
- `apps/web/src/components/SentenceBlock.tsx` (new)
- `apps/web/src/__tests__/WordToken.test.tsx` (new)
- `apps/web/src/__tests__/SentenceBlock.test.tsx` (new)
- `apps/web/src/__tests__/setup.ts` (new)
- `apps/web/vite.config.ts` (updated — added setupFiles)
- `apps/web/package.json` (updated — added @testing-library/react, @testing-library/jest-dom)
