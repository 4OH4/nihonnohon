# Story se1-3: Loader — v2 Support and v1 Backward-Compat Shim

Status: done

## Story

As a **developer**,
I want the story loader to correctly handle both v1 and v2 story files,
So that existing v1 stories continue to render without any changes to their JSON files,
and new v2 stories with inline annotations load and parse correctly.

## Acceptance Criteria

1. **AC1 — `v2.ts` loader validates and transforms v2 stories**
   - `packages/story-loader/src/v2.ts` exists and validates raw JSON against `story.v2.json` via AJV before any transformation
   - Maps each word string through `parseInlineRuby()` to produce `SentenceModel.tokens: ParsedWord[]`
   - Snake_case → camelCase transformation follows the same structure as `v1.ts` (same field names, same optionals, same defaults)
   - `schema_version: "2"` is registered in `LOADERS` in `src/index.ts`

2. **AC2 — v2 fixture round-trip**
   - `loadStory(validV2)` returns a `StoryModel` with correct `tokens` for all annotation patterns present in `valid-v2.json`
   - Annotated words produce multi-segment `ParsedWord`; plain words produce a single segment with `ruby: null`
   - `vocabKeys` and `translation` are mapped correctly from the fixture's sentence `s2`

3. **AC3 — v1 shim produces `tokens: ParsedWord[]`**
   - `v1.ts` `mapSentence` no longer sets `words` or `ruby` on the returned `SentenceModel`
   - Each word/ruby pair from the v1 wire becomes `{ surface: word, segments: [{ text: word, ruby: rubyVal ?? null }] }`
   - Words where `ruby` is `null` produce `segments: [{ text: word, ruby: null }]`
   - The `"null"` string-coercion logic (`v === 'null' ? null : v`) is preserved in the shim

4. **AC4 — v1 tests updated and passing**
   - All existing `index.test.ts` tests that previously accessed `s.words` and `s.ruby` are rewritten to assert against `s.tokens`
   - New v2 integration tests added covering: annotated segment parsing, plain word tokens, vocabKeys mapping
   - `turbo test:unit --filter=@nihonnohon/story-loader` exits 0

5. **AC5 — v1 mismatched lengths still throw SCHEMA_INVALID**
   - The length-check in `v1.ts` (ruby vs words, vocab_keys vs words) is preserved unchanged
   - Existing test `'throws SCHEMA_INVALID for mismatched ruby array length and names the sentence id'` still passes without modification

6. **AC6 — `parseInlineRuby.ts` cleaned up — no duplicate type definitions**
   - Local `WordSegment` and `ParsedWord` interface definitions removed from `parseInlineRuby.ts`
   - These are now imported from `@nihonnohon/schema` instead
   - `parseInlineRuby` function signature and body are unchanged; only the type source changes

7. **AC7 — typecheck**
   - `turbo typecheck --filter=@nihonnohon/story-loader` exits 0
   - Type errors in `apps/web` are expected until se1-4 and do not need fixing here

---

## Tasks / Subtasks

- [x] Task 1: Create `packages/story-loader/src/v2.ts` (AC1, AC2)
  - [x] Copy `v1.ts` structure as the base; adapt for v2 wire format (no `ruby` field on wire sentence)
  - [x] Import `schema from '@nihonnohon/schema/schemas/story.v2.json'` and compile with AJV
  - [x] Import `parseInlineRuby` from `./parseInlineRuby`
  - [x] Implement `mapSentence` to call `parseInlineRuby(word)` for each word in `s.words`
  - [x] Add `vocab_keys` length check (must match `s.words.length`) — no `ruby` length check in v2
  - [x] Export `loadV2` function

- [x] Task 2: Update `packages/story-loader/src/index.ts` (AC1)
  - [x] Import `loadV2` from `./v2`
  - [x] Add `'2': loadV2` entry to `LOADERS` map

- [x] Task 3: Update `packages/story-loader/src/v1.ts` shim (AC3, AC5)
  - [x] Import `type { ParsedWord } from '@nihonnohon/schema'` at the top
  - [x] Rewrite `mapSentence` to produce `tokens: ParsedWord[]` — see exact shape in Dev Notes
  - [x] Preserve the `ruby` length-check and `"null"` string coercion — do not remove these
  - [x] Remove `words` and `ruby` from the returned object literal

- [x] Task 4: Clean up `packages/story-loader/src/parseInlineRuby.ts` (AC6)
  - [x] Remove local `WordSegment` interface export
  - [x] Remove local `ParsedWord` interface export
  - [x] Add `import type { WordSegment, ParsedWord } from '@nihonnohon/schema'` at the top (after the copyright header)
  - [x] Verify the function body compiles cleanly; no logic changes

- [x] Task 5: Update `packages/story-loader/src/index.test.ts` (AC4)
  - [x] Update the 'correctly transforms all sentence snake_case fields to camelCase' test to assert `s.tokens` (see shape in Dev Notes)
  - [x] Update the 'fills absent sentence arrays with parallel nulls matching words length' test to assert `s.tokens` for the minimal fixture
  - [x] Add a new `describe('v2 stories')` block with the tests listed in Dev Notes
  - [x] All tests that check `s.words` or `s.ruby` must be replaced — do not leave dead assertions

- [x] Task 6: Verify (AC7)
  - [x] Run `turbo typecheck --filter=@nihonnohon/story-loader` — must exit 0
  - [x] Run `turbo test:unit --filter=@nihonnohon/story-loader` — must exit 0

---

### Review Findings

- [x] [Review][Patch] v2 test missing assertions for tokens[3] and tokens[4] — `日[ひ]に` and `付[つ]け加[くわ]える` patterns uncovered, violating AC2 [`packages/story-loader/src/index.test.ts`]
- [x] [Review][Defer] Shared AJV `validate.errors` mutable under concurrent calls [`v2.ts:9-10`] — deferred, pre-existing; same pattern in v1.ts; loader is synchronous in current usage
- [x] [Review][Defer] `mapVocabEntry` duplicated verbatim between `v1.ts` and `v2.ts` [`v1.ts:100`, `v2.ts:91`] — deferred, by design in versioned-loader architecture; each version file is intentionally self-contained
- [x] [Review][Defer] v1 shim `surface` contains bracket markup if a v1 payload word contains inline notation [`v1.ts:108-111`] — deferred, theoretical only; well-formed v1 stories never contain bracket notation in words
- [x] [Review][Defer] `sentence.grammar` indices not bounds-checked against `story.grammar.length` in v2.ts [`v2.ts:60-69`] — deferred, pre-existing in v1.ts; grammar panel handles out-of-range indices gracefully

## Dev Notes

### Architecture Context

This story is the third in supp-epic-1 (furigana rework). After se1-1 created `parseInlineRuby()` and se1-2 updated `SentenceModel` to use `tokens: ParsedWord[]`, the loader package now has type errors because `mapSentence` in `v1.ts` still returns `{ words, ruby, ... }`. This story fixes that and adds the v2 loader path.

**Type errors to fix in this story:**
- `packages/story-loader/src/v1.ts` line ~105: `return { id, words, ruby, ... }` — `SentenceModel` no longer has `words` or `ruby`
- `packages/story-loader/src/index.test.ts` lines 33-35, 53-55: `s.words` and `s.ruby` access

**Type errors intentionally left for se1-4:**
- `apps/web/src/components/SentenceBlock.tsx` — `sentence.words` / `sentence.ruby`
- `apps/web/src/__tests__/SentenceBlock.test.tsx` — fixture objects with `words`/`ruby`

### Files to Change

| File | Change |
|------|--------|
| `packages/story-loader/src/v2.ts` | NEW — v2 loader |
| `packages/story-loader/src/index.ts` | Register `'2': loadV2` in LOADERS |
| `packages/story-loader/src/v1.ts` | `mapSentence` produces `tokens: ParsedWord[]` |
| `packages/story-loader/src/parseInlineRuby.ts` | Remove local type defs; import from `@nihonnohon/schema` |
| `packages/story-loader/src/index.test.ts` | Update v1 assertions; add v2 tests |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `packages/schema/**` | All schema changes done in se1-1 / se1-2 |
| `apps/web/src/components/SentenceBlock.tsx` | se1-4 |
| `apps/web/src/__tests__/SentenceBlock.test.tsx` | se1-4 |
| `packages/story-loader/src/parseInlineRuby.test.ts` | No logic change; tests still pass as-is |
| `packages/story-loader/src/errors.ts` | Unchanged |

### `v2.ts` — Full Implementation Guide

Model `v2.ts` on `v1.ts` exactly. Key differences:

1. **Wire sentence has no `ruby` field** — `WireSentence` in v2 omits it entirely
2. **`mapSentence` calls `parseInlineRuby`** instead of returning raw strings
3. **No ruby length check** — only `vocab_keys` length check remains

```typescript
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import Ajv from 'ajv'
import schema from '@nihonnohon/schema/schemas/story.v2.json'
import { LoaderError } from './errors'
import { parseInlineRuby } from './parseInlineRuby'
import type { StoryModel, SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

const ajv = new Ajv()
const validate = ajv.compile(schema)

interface WireVocabEntry { key: number; word: string; hiragana: string; translation: string }

interface WireSentence {
  id: string
  words: string[]
  vocab_keys?: (number | null)[]
  translation?: string
  grammar?: number[]
  audio_url?: string
}

interface WireStory {
  schema_version: string
  id: string
  title: string
  title_ja: string
  language: string
  description: string
  difficulty?: string | null
  keywords?: WireVocabEntry[]
  grammar?: string[]
  vocab_supplement?: WireVocabEntry[]
  author?: string
  source?: string
  license?: string
  license_url?: string
  metadata?: Record<string, unknown>
  sentences: WireSentence[]
}

export function loadV2(raw: unknown): StoryModel {
  if (!validate(raw)) {
    throw new LoaderError('SCHEMA_INVALID', `Story JSON failed schema validation: ${ajv.errorsText(validate.errors)}`)
  }
  const wire = raw as unknown as WireStory
  for (const sentence of wire.sentences) {
    const wordCount = sentence.words.length
    if (sentence.vocab_keys !== undefined && sentence.vocab_keys.length !== wordCount) {
      throw new LoaderError('SCHEMA_INVALID', `Sentence "${sentence.id}": vocab_keys array length (${sentence.vocab_keys.length}) must match words length (${wordCount}).`)
    }
  }
  return {
    schemaVersion: wire.schema_version,
    id: wire.id,
    title: wire.title,
    titleJa: wire.title_ja,
    language: wire.language,
    difficulty: wire.difficulty ?? null,
    description: wire.description,
    keywords: (wire.keywords ?? []).map(mapVocabEntry),
    grammar: wire.grammar ?? [],
    vocabSupplement: (wire.vocab_supplement ?? []).map(mapVocabEntry),
    author: wire.author,
    source: wire.source,
    license: wire.license,
    licenseUrl: wire.license_url,
    sentences: wire.sentences.map(mapSentence),
    metadata: wire.metadata ?? {},
  }
}

function mapVocabEntry(e: WireVocabEntry): VocabSupplementEntry {
  return { key: e.key!, word: e.word, hiragana: e.hiragana, translation: e.translation }
}

function mapSentence(s: WireSentence): SentenceModel {
  const wordCount = s.words.length
  return {
    id: s.id,
    tokens: s.words.map(word => parseInlineRuby(word)),
    vocabKeys: (s.vocab_keys ?? Array<number | null>(wordCount).fill(null))
      .map(v => (v === ('null' as unknown) ? null : v)),
    translation: s.translation ?? null,
    grammar: s.grammar ?? [],
    audioUrl: s.audio_url,
  }
}
```

### `v1.ts` — `mapSentence` Rewrite

Replace the entire `mapSentence` function. The shape of each token: `surface` is the raw word string (no annotation syntax in v1); segments is a single element wrapping that word with the ruby value.

```typescript
import type { ParsedWord } from '@nihonnohon/schema'  // add at top

function mapSentence(s: WireSentence): SentenceModel {
  const wordCount = s.words.length
  const rubyArr = (s.ruby ?? Array<string | null>(wordCount).fill(null))
    .map(v => (v === 'null' ? null : v))
  return {
    id: s.id,
    tokens: s.words.map((word, i): ParsedWord => ({
      surface: word,
      segments: [{ text: word, ruby: rubyArr[i] ?? null }],
    })),
    vocabKeys: (s.vocab_keys ?? Array<number | null>(wordCount).fill(null))
      .map(v => (v === ('null' as unknown) ? null : v)),
    translation: s.translation ?? null,
    grammar: s.grammar ?? [],
    audioUrl: s.audio_url,
  }
}
```

Note: the `rubyArr` local is still needed to support the `"null"` string coercion. Do not inline and remove it.

### `parseInlineRuby.ts` — Type Definition Cleanup

Current state (lines 4–14) exports `WordSegment` and `ParsedWord` as local interfaces. These now duplicate the definitions in `@nihonnohon/schema`. Remove them and add an import instead:

```typescript
// Remove these exports:
export interface WordSegment { ... }
export interface ParsedWord { ... }

// Add this import after the copyright header:
import type { WordSegment, ParsedWord } from '@nihonnohon/schema'
```

The `isKanji` function and `parseInlineRuby` function body are unchanged. The function still returns `ParsedWord` — the type just comes from the schema package now.

### `index.test.ts` — Updated v1 Assertions

Replace the `s.words`/`s.ruby` assertions. The v1 shim produces single-segment tokens:

```typescript
// In 'correctly transforms all sentence snake_case fields to camelCase':
// REMOVE:
// expect(s.words).toEqual(['田中', 'さん', 'は', '先生', 'です'])
// expect(s.ruby).toEqual(['たなか', null, null, 'せんせい', null])
// ADD:
expect(s.tokens).toEqual([
  { surface: '田中', segments: [{ text: '田中', ruby: 'たなか' }] },
  { surface: 'さん', segments: [{ text: 'さん', ruby: null }] },
  { surface: 'は', segments: [{ text: 'は', ruby: null }] },
  { surface: '先生', segments: [{ text: '先生', ruby: 'せんせい' }] },
  { surface: 'です', segments: [{ text: 'です', ruby: null }] },
])

// In 'fills absent sentence arrays with parallel nulls matching words length':
// REMOVE:
// expect(s.words).toEqual(['こんにちは'])
// expect(s.ruby).toEqual([null])
// ADD:
expect(s.tokens).toEqual([
  { surface: 'こんにちは', segments: [{ text: 'こんにちは', ruby: null }] },
])
```

### `index.test.ts` — New v2 Tests to Add

Add after the existing `describe('UNSUPPORTED_VERSION errors')` block (or as a new nested describe within `describe('valid stories')`):

```typescript
import validV2 from './__fixtures__/valid-v2.json'

describe('valid v2 stories', () => {
  it('loads valid-v2.json and returns schemaVersion "2"', () => {
    const result = loadStory(validV2)
    expect(result.schemaVersion).toBe('2')
    expect(result.id).toBe('test-story-v2')
  })

  it('parses annotated words into multi-segment tokens', () => {
    const result = loadStory(validV2)
    const s1 = result.sentences[0]
    // 大人[おとな] — whole-word annotation
    expect(s1.tokens[0]).toEqual({ surface: '大人', segments: [{ text: '大人', ruby: 'おとな' }] })
    // は — plain word
    expect(s1.tokens[1]).toEqual({ surface: 'は', segments: [{ text: 'は', ruby: null }] })
    // 肌寒[はだざむ]い — kanji block + okurigana
    expect(s1.tokens[2]).toEqual({
      surface: '肌寒い',
      segments: [{ text: '肌寒', ruby: 'はだざむ' }, { text: 'い', ruby: null }],
    })
  })

  it('maps vocab_keys and translation from v2 sentence', () => {
    const result = loadStory(validV2)
    const s2 = result.sentences[1]
    expect(s2.vocabKeys).toEqual([null, null, 1, null])
    expect(s2.translation).toBe('I am a student.')
  })
})
```

The `valid-v2.json` fixture already exists at `packages/story-loader/src/__fixtures__/valid-v2.json` (created in se1-1). Do not recreate it.

### `index.ts` — Minimal Change

```typescript
import { loadV2 } from './v2'

const LOADERS: Record<string, (raw: unknown) => StoryModel> = {
  '1': loadV1,
  '2': loadV2,
}
```

### Existing Test Preservation

Tests that must still pass unchanged after this story:
- `'throws SCHEMA_INVALID for mismatched ruby array length and names the sentence id'`
- `'throws SCHEMA_INVALID for mismatched vocab_keys array length and names the sentence id'`
- All `PARSE_FAILED` and `UNSUPPORTED_VERSION` tests
- All `LoaderError type guarantees` tests
- All tests in `parseInlineRuby.test.ts` (no changes to that file)

### Package.json / Build Notes

- `@nihonnohon/schema` is already a dependency of `packages/story-loader` — no `package.json` changes needed
- `story.v2.json` is in `packages/schema/schemas/` and was already importable (se1-1 created it); same import pattern as `story.v1.json`
- AJV is already in `packages/story-loader`'s dependencies — no new dependencies

### Comment Style

Per project feedback: exported functions get a succinct one-line `/** ... */` JSDoc. Major code sections within a function get a `// comment` (like the numbered comments in v1.ts). No multi-line blocks. Match the exact comment style of `v1.ts`.

### File Header

All TypeScript files start with:
```typescript
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
```

### References

- Epic: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-3 section
- Previous story: `_bmad-output/implementation-artifacts/se1-2-internal-type-changes.md`
- ADR: `docs/adr/005-inline-furigana-format.md`
- Current v1 loader: `packages/story-loader/src/v1.ts`
- Current index: `packages/story-loader/src/index.ts`
- Parser: `packages/story-loader/src/parseInlineRuby.ts`
- v2 schema: `packages/schema/schemas/story.v2.json`
- v2 fixture: `packages/story-loader/src/__fixtures__/valid-v2.json`
- Types: `packages/schema/src/types.ts`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `packages/story-loader/src/v2.ts`: AJV validation against `story.v2.json`, `parseInlineRuby()` mapping per word, `vocab_keys` length check, full snake_case → camelCase transform matching v1 structure.
- Registered `'2': loadV2` in `LOADERS` in `src/index.ts`.
- Updated `v1.ts` `mapSentence` to produce `tokens: ParsedWord[]` — each word/ruby pair becomes a single-segment `ParsedWord`; `"null"` string coercion and ruby length-check preserved.
- Removed local `WordSegment`/`ParsedWord` exports from `parseInlineRuby.ts`; now imported from `@nihonnohon/schema`. Function body and logic unchanged.
- Updated `index.test.ts`: v1 tests now assert `s.tokens` shape; added `describe('valid v2 stories')` block with 4 tests (schemaVersion, multi-segment annotation, vocabKeys/translation mapping, v2 vocab_keys mismatch error).
- `turbo typecheck --filter=@nihonnohon/story-loader` exits 0 ✅
- `pnpm test:unit` in `packages/story-loader`: 34 tests pass (16 parseInlineRuby + 18 index) ✅
- Type errors in `apps/web` (SentenceBlock.tsx) are expected and intentional; se1-4 fixes them.

### File List

- `packages/story-loader/src/v2.ts` — NEW: v2 loader
- `packages/story-loader/src/index.ts` — registered `'2': loadV2`
- `packages/story-loader/src/v1.ts` — `mapSentence` produces `tokens: ParsedWord[]`; imports `ParsedWord` from `@nihonnohon/schema`
- `packages/story-loader/src/parseInlineRuby.ts` — removed local type exports; imports `WordSegment`/`ParsedWord` from `@nihonnohon/schema`
- `packages/story-loader/src/index.test.ts` — updated v1 assertions to `tokens`; added v2 test block
