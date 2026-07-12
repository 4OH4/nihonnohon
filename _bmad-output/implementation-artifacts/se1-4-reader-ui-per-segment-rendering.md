# Story se1-4: Reader UI — Per-Segment Furigana Rendering

Status: done

## Story

As a **reader**,
I want furigana to appear only above the kanji portions of words,
So that the app follows standard Japanese publishing practice and okurigana is displayed
without annotation.

## Acceptance Criteria

1. **AC1 — Multi-segment ruby rendering**
   - `WordToken.tsx` receives `token: ParsedWord` (replaces `word: string` + `ruby: string | null`)
   - Segments with `ruby !== null` render as `<ruby>text<rt>reading</rt></ruby>`
   - Segments with `ruby === null` render as bare text (a `<span>` or text node)
   - Example: `[{ text: "食", ruby: "た" }, { text: "べる", ruby: null }]` → `<ruby>食<rt>た</rt></ruby>べる`

2. **AC2 — Ruby invisible toggle uses `invisible` class, never `display:none`**
   - When `rubyVisible: false`, `<rt>` elements have class `invisible`
   - `display: none` is never used for the toggle
   - Line height is identical regardless of toggle state (visibility: hidden preserves space)

3. **AC3 — All-null segments produce no `<rt>` elements**
   - A token where every segment has `ruby: null` renders no `<rt>` elements at all

4. **AC4 — SentenceBlock maps `sentence.tokens: ParsedWord[]`**
   - `SentenceBlock.tsx` maps over `sentence.tokens` to render `<WordToken>` per token
   - No `sentence.words[i]` or `sentence.ruby[i]` access remains anywhere in the component
   - `supplementMap.get()` uses `token.surface` as the lookup key
   - `vocabKey` comes from `sentence.vocabKeys[i]`

5. **AC5 — V1 shim stories render identically**
   - A v1 story loaded via the shim (single-segment tokens with whole-word ruby) renders
     visually identical to the pre-rework whole-word annotation behaviour

6. **AC6 — Tests pass**
   - `WordToken.test.tsx` updated: props use `token: ParsedWord` shape; new tests for
     per-segment rendering of all four annotation patterns; plain-segment no-`<rt>` test;
     ruby toggle uses `invisible`
   - `SentenceBlock.test.tsx` updated: sentence fixture uses `tokens: ParsedWord[]`; all
     prior ACs from Story 2.3 pass

7. **AC7 — Full typecheck passes**
   - `turbo typecheck` exits 0 across all packages and apps

---

## Tasks / Subtasks

- [ ] Task 1: Update `apps/web/src/components/WordToken.tsx` (AC1, AC2, AC3)
  - [ ] Change `WordTokenProps`: replace `word: string` + `ruby: string | null` with `token: ParsedWord`
  - [ ] Import `ParsedWord` from `@nihonnohon/schema`
  - [ ] Update `aria-label` to use `token.surface`
  - [ ] Update `isActive` check to use `token.surface` instead of `word`
  - [ ] Update `handleActivate` to use `token.surface` for lookup and supplement check
  - [ ] Replace the single `<ruby>` render with a segment map:
    - segments with `ruby !== null` → `<ruby key={i}>text<rt className={cn(!rubyVisible && 'invisible')}>ruby</rt></ruby>`
    - segments with `ruby === null` → `<span key={i}>text</span>`
  - [ ] The outer wrapper element stays `<span>` (or a `<span>` that wraps everything and holds the button role/styling)
    - NOTE: The outer element can no longer be `<ruby>` because it contains both ruby and non-ruby elements. Use a `<span>` as the wrapper with `role="button"`.

- [ ] Task 2: Update `apps/web/src/components/SentenceBlock.tsx` (AC4)
  - [ ] Import `ParsedWord` from `@nihonnohon/schema` (already imports `SentenceModel`)
  - [ ] Replace `sentence.words.map((word, i) => ...)` with `sentence.tokens.map((token, i) => ...)`
  - [ ] Pass `token={token}` to `<WordToken>` instead of `word={word}` + `ruby={...}`
  - [ ] Update `supplementMap?.get(word)` to `supplementMap?.get(token.surface)`

- [ ] Task 3: Update `apps/web/src/__tests__/WordToken.test.tsx` (AC6)
  - [ ] Update all existing test renders: replace `word="..."` + `ruby="..."` props with `token={...}` prop
  - [ ] Build a `makeToken(surface, ruby?)` helper for concise single-segment test tokens
  - [ ] Update `aria-label` assertions to match `token.surface`
  - [ ] Add test: multi-segment token with kanji block + okurigana renders correct ruby elements
  - [ ] Add test: multi-segment token with separate kanji + interleaved kana
  - [ ] Add test: whole-word annotation (single segment with ruby, jukujikun style)
  - [ ] Add test: all-null-ruby token produces no `<rt>` elements
  - [ ] Verify ruby toggle tests still pass (invisible class, not display:none)

- [ ] Task 4: Update `apps/web/src/__tests__/SentenceBlock.test.tsx` (AC6)
  - [ ] Update `sentence` fixture: replace `words/ruby` with `tokens: ParsedWord[]`
  - [ ] Update `sentenceNoTranslation` fixture similarly
  - [ ] All existing `SentenceBlock` tests should pass unchanged (no new tests needed for the block itself)

### Review Findings

- [x] [Review][Patch] Line height regression: add `items-baseline` to SentenceBlock flex container [`apps/web/src/components/SentenceBlock.tsx`]
- [x] [Review][Patch] Missing single-kanji test for AC6 [`apps/web/src/__tests__/WordToken.test.tsx`]
- [x] [Review][Defer] `vocabKeys` length not validated vs `tokens` in UI layer [`apps/web/src/components/SentenceBlock.tsx:48`] — deferred, pre-existing; loader validates at load time
- [x] [Review][Defer] Inner `<ruby>` elements carry no explicit `lang` attribute [`apps/web/src/components/WordToken.tsx:64`] — deferred, `lang` inherited from parent `<span lang="ja">`
- [x] [Review][Defer] Empty `segments[]` array produces invisible focusable button [`apps/web/src/components/WordToken.tsx:62`] — deferred, AJV schema prevents empty word strings
- [x] [Review][Defer] supplementMap key mismatch if supplement `word` field contains bracket notation [`apps/web/src/components/SentenceBlock.tsx:50`] — deferred, theoretical; supplement entries never contain inline ruby markup
- [x] [Review][Defer] `seg.ruby === ""` from v1 shim renders empty `<rt>` [`packages/story-loader/src/v1.ts:109`] — deferred, v1 wire format never uses bracket notation in word strings
- [x] [Review][Defer] Space key `handleActivate` calls `stopPropagation()` but not `preventDefault()` — page scrolls on Space key [`apps/web/src/components/WordToken.tsx:57`] — deferred, pre-existing; same handler existed on old `<ruby role="button">` outer element
- [x] [Review][Defer] `token.surface` is empty string when `parseInlineRuby` receives orphan-bracket input, yielding zero-width focusable button with empty aria-label [`apps/web/src/components/WordToken.tsx:44`] — deferred, pre-existing; root cause in parser (se1-1); AJV minLength:1 blocks this path on valid wire input
- [x] [Review][Defer] Two `WordToken` instances with identical `token.surface` in the same sentence both highlight when either is clicked — `isActive` uses `activeWord === token.surface` with no position discriminator [`apps/web/src/components/WordToken.tsx:27`] — deferred, pre-existing store design; `lookupState` stores only `word: string`
- [x] [Review][Defer] AC5 no explicit integration test loading a v1 story through the shim to assert rendered output; coverage is indirect via `makeToken()` single-segment tests — deferred, rendering path fully covered; explicit end-to-end test would add documentation clarity only
- [x] [Review][Defer] Inner `<ruby>` segments lack `<rp>` ruby-parenthesis fallback elements — browsers without ruby support render reading adjacent to base with no separator [`apps/web/src/components/WordToken.tsx:64`] — deferred, pre-existing omission
- [x] [Review][Defer] `supplementEntry` override path not tested under new `token: ParsedWord` prop shape — no test passes non-null `supplementEntry` after migration [`apps/web/src/__tests__/WordToken.test.tsx`] — deferred, behaviour unchanged; pre-existing coverage gap
- [x] [Review][Defer] `<span role="button">` instead of native `<button>` — Space lacks `preventDefault()` for built-in scroll suppression; `<button>` would provide this natively while still accepting inline `<ruby>` children [`apps/web/src/components/WordToken.tsx:45`] — deferred, architectural design decision required to support nested `<ruby>` segments; valid ARIA pattern with tabIndex={0} and explicit keyboard handler

- [ ] Task 5: Verify (AC7)
  - [ ] Run `pnpm typecheck` from monorepo root — must exit 0
  - [ ] Run `pnpm test:unit` in `apps/web` — must exit 0

---

## Dev Notes

### Architecture Context

This is story 4 of supp-epic-1 (furigana rework). The upstream stories are:
- **se1-1**: Created `parseInlineRuby()` and `story.v2.json` schema
- **se1-2**: Updated `SentenceModel` to use `tokens: ParsedWord[]` (replacing `words[]` + `ruby[]`)
- **se1-3**: Updated story loader (v2 loader + v1 shim) to produce `tokens`

After se1-3, `apps/web` has type errors in `SentenceBlock.tsx` because it still accesses
`sentence.words` and `sentence.ruby`. This story fixes those errors and upgrades the rendering.

### Current State of Files to Change

**`WordToken.tsx` (lines 1–68)**
- Current props: `{ word: string, ruby: string | null, vocabKey, sentenceId, supplementEntry }`
- Current render: single `<ruby>` element wrapping the whole word with one `<rt>`
- The outer `<ruby>` element has `role="button"` — this is the clickable token wrapper

**`SentenceBlock.tsx` (lines 44–53)**
- Current render: `sentence.words.map((word, i) => <WordToken word={word} ruby={sentence.ruby[i] ?? null} .../>)`
- Must change to: `sentence.tokens.map((token, i) => <WordToken token={token} .../>)`

### Critical Design Decision: Outer Wrapper Element

The current `<ruby>` outer wrapper cannot be kept when the token has multiple segments
(some with ruby, some without). HTML spec: `<ruby>` children must be text runs and `<rt>`,
not nested `<ruby>` elements.

**Solution**: Change the outer wrapper from `<ruby>` to a `<span>`. The button role, styling,
aria-label, and click handlers all move to the `<span>`. Individual segments are then either
`<ruby>segment<rt>reading</rt></ruby>` or a bare `<span>segment</span>`.

```tsx
// Outer wrapper (was <ruby>):
<span
  role="button"
  tabIndex={0}
  aria-label={token.surface}
  lang="ja"
  className={cn('font-ja cursor-pointer rounded word-token', isActive ? ... : ...)}
  onClick={handleActivate}
  onKeyDown={...}
>
  {token.segments.map((seg, i) =>
    seg.ruby !== null ? (
      <ruby key={i}>
        {seg.text}
        <rt className={cn(!rubyVisible && 'invisible')}>{seg.ruby}</rt>
      </ruby>
    ) : (
      <span key={i}>{seg.text}</span>
    )
  )}
</span>
```

**Why `<span>` not `<ruby>` for the outer element:**
- Standard HTML: `<ruby>` should only contain text + `<rt>`. Nesting `<ruby>` inside `<ruby>` is invalid.
- Semantics: the clickable token is a UI concept, not a ruby annotation. `<span role="button">` is correct.

**Ruby toggle**: The `invisible` class goes on each `<rt>` element inside the segments. When
`rubyVisible: false`, all `<rt>` elements in the token are invisible simultaneously. The
segment spans have no conditional class.

### `handleActivate` Change

The lookup uses `token.surface` (the clean word text, no annotation brackets):
```tsx
const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
  e.stopPropagation()
  if (supplementEntry != null) {
    lookup(token.surface, supplementEntry, sentenceId)
    return
  }
  if (vocabKey === null) return
  const entry = lookupVocab(vocabKey)
  if (entry === null) return
  lookup(token.surface, entry, sentenceId)
}
```

### `isActive` Change

```tsx
const isActive = lookupStatus === 'found' && activeWord === token.surface
```

### SentenceBlock Change

The only changes are in the JSX render of words:

```tsx
// BEFORE:
{sentence.words.map((word, i) => (
  <WordToken
    key={i}
    word={word}
    ruby={sentence.ruby[i] ?? null}
    vocabKey={sentence.vocabKeys[i] ?? null}
    sentenceId={sentence.id}
    supplementEntry={supplementMap?.get(word) ?? null}
  />
))}

// AFTER:
{sentence.tokens.map((token, i) => (
  <WordToken
    key={i}
    token={token}
    vocabKey={sentence.vocabKeys[i] ?? null}
    sentenceId={sentence.id}
    supplementEntry={supplementMap?.get(token.surface) ?? null}
  />
))}
```

### Test Helper for WordToken Tests

Reduce boilerplate with a helper:

```typescript
// Single-segment token (plain word or whole-word ruby)
const makeToken = (surface: string, ruby: string | null = null): ParsedWord => ({
  surface,
  segments: [{ text: surface, ruby }],
})
```

Use it everywhere a simple `word="食べる" ruby="たべる"` was previously:
```typescript
<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />
```

### SentenceBlock Test Fixture Update

Replace the `words`/`ruby` fields with `tokens`:

```typescript
const sentence: SentenceModel = {
  id: 'sent-1',
  tokens: [
    { surface: '食べる', segments: [{ text: '食べる', ruby: 'たべる' }] },
    { surface: 'は',    segments: [{ text: 'は',    ruby: null }] },
    { surface: '楽しい', segments: [{ text: '楽しい', ruby: 'たのしい' }] },
  ],
  vocabKeys: [42, null, null],
  translation: 'Eating is fun.',
  grammar: [],
}
```

The rest of the SentenceBlock tests (aria-label, spacing, highlight, click, translation) do
not need changes — they test the block container and translation rendering, not the word text.

### New WordToken Tests to Add

```typescript
// 1. Multi-segment: kanji block + okurigana — 食[た]べる
it('renders per-segment ruby: kanji block with okurigana', () => {
  const token: ParsedWord = {
    surface: '食べる',
    segments: [{ text: '食', ruby: 'た' }, { text: 'べる', ruby: null }],
  }
  const { container } = render(
    <WordToken token={token} vocabKey={null} sentenceId="s1" />
  )
  const rubies = container.querySelectorAll('ruby')
  expect(rubies).toHaveLength(1)
  expect(rubies[0].textContent).toContain('食')
  const rt = rubies[0].querySelector('rt')!
  expect(rt.textContent).toBe('た')
  // 'べる' appears without a ruby wrapper
  expect(container.querySelector('[role="button"]')!.textContent).toContain('べる')
})

// 2. Multi-segment: separate kanji with interleaved kana — 付[つ]け加[くわ]える
it('renders per-segment ruby: two annotated segments with interleaved kana', () => {
  const token: ParsedWord = {
    surface: '付け加える',
    segments: [
      { text: '付', ruby: 'つ' },
      { text: 'け', ruby: null },
      { text: '加', ruby: 'くわ' },
      { text: 'える', ruby: null },
    ],
  }
  const { container } = render(
    <WordToken token={token} vocabKey={null} sentenceId="s1" />
  )
  const rubies = container.querySelectorAll('ruby')
  expect(rubies).toHaveLength(2)
  expect(rubies[0].querySelector('rt')!.textContent).toBe('つ')
  expect(rubies[1].querySelector('rt')!.textContent).toBe('くわ')
})

// 3. Whole-word annotation (jukujikun) — 大人[おとな]
it('renders whole-word annotation as single ruby element', () => {
  const token: ParsedWord = {
    surface: '大人',
    segments: [{ text: '大人', ruby: 'おとな' }],
  }
  const { container } = render(
    <WordToken token={token} vocabKey={null} sentenceId="s1" />
  )
  const rubies = container.querySelectorAll('ruby')
  expect(rubies).toHaveLength(1)
  expect(rubies[0].querySelector('rt')!.textContent).toBe('おとな')
})

// 4. All-null segments produce no <rt> elements
it('renders no rt elements when all segments have ruby null', () => {
  const token: ParsedWord = {
    surface: 'は',
    segments: [{ text: 'は', ruby: null }],
  }
  const { container } = render(
    <WordToken token={token} vocabKey={null} sentenceId="s1" />
  )
  expect(container.querySelectorAll('rt')).toHaveLength(0)
})
```

### Files to Change

| File | Change |
|------|--------|
| `apps/web/src/components/WordToken.tsx` | New prop `token: ParsedWord`; segment-map render; `<span>` outer wrapper |
| `apps/web/src/components/SentenceBlock.tsx` | Map `sentence.tokens`; pass `token=` to WordToken |
| `apps/web/src/__tests__/WordToken.test.tsx` | Update all props; add 4 new tests |
| `apps/web/src/__tests__/SentenceBlock.test.tsx` | Update fixtures to `tokens` shape |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `packages/schema/**` | All type changes done in se1-1 / se1-2 |
| `packages/story-loader/**` | All loader changes done in se1-3 |
| `apps/web/src/routes/**` | Routes pass `SentenceModel` through unchanged |
| `apps/web/src/stores/**` | No store changes needed |

### Visual Verification

After implementation, start the dev server from `apps/web` and open `http://localhost:5173`.
Load a story and verify:
1. Furigana appears only above kanji characters, not over okurigana
2. Ruby toggle (hide/show) works correctly — furigana disappears but line height is stable

### Comment Style

Per project feedback: exported functions/components get a succinct one-line `/** ... */` JSDoc.
Major code sections within a function get a `// comment`. No multi-line comment blocks.

### File Header

All TypeScript files start with:
```typescript
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
```

### References

- Epic: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-4 section
- Previous story: `_bmad-output/implementation-artifacts/se1-3-loader-v2-and-v1-shim.md`
- ADR: `docs/adr/005-inline-furigana-format.md`
- Current `WordToken.tsx`: `apps/web/src/components/WordToken.tsx`
- Current `SentenceBlock.tsx`: `apps/web/src/components/SentenceBlock.tsx`
- Types: `packages/schema/src/types.ts`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Updated `WordToken.tsx`: replaced `word/ruby` props with `token: ParsedWord`; outer wrapper changed from `<ruby>` to `<span role="button">`; segments map renders `<ruby>` for annotated segments and `<span>` for plain segments; `rt className={cn(!rubyVisible && 'invisible')}` applied per segment.
- Updated `SentenceBlock.tsx`: maps `sentence.tokens` instead of `sentence.words`; passes `token=` to WordToken; uses `token.surface` for supplementMap lookup.
- Updated `WordToken.test.tsx`: all existing tests use `makeToken()` helper; 5 new tests cover per-segment patterns (kanji+okurigana, two kanji with interleaved kana, jukujikun, all-null, multi-rt invisible toggle).
- Updated `SentenceBlock.test.tsx`: fixture updated to `tokens: ParsedWord[]` shape.
- Fixed collateral `words`/`ruby` fixtures in `GrammarPanel.test.tsx` and `ReaderRoute.test.tsx` (4 locations).
- `turbo typecheck` exits 0 ✅
- `pnpm test:unit` in `apps/web`: 175 tests pass across 18 test files ✅

### File List

- `apps/web/src/components/WordToken.tsx` — new `token: ParsedWord` prop, segment-map render
- `apps/web/src/components/SentenceBlock.tsx` — maps `sentence.tokens`, passes `token=`
- `apps/web/src/__tests__/WordToken.test.tsx` — updated props + 5 new segment tests
- `apps/web/src/__tests__/SentenceBlock.test.tsx` — fixture updated to tokens shape
- `apps/web/src/__tests__/GrammarPanel.test.tsx` — fixture updated to tokens shape
- `apps/web/src/__tests__/ReaderRoute.test.tsx` — 4 fixtures updated to tokens shape
