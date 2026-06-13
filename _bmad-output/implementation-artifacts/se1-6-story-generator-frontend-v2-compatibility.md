# Story se1-6: Story Generator Frontend — v2 Compatibility

Status: done

## Story

As a **developer**,
I want the story generator frontend to be compatible with v2 story output,
So that the authoring tool correctly handles, displays, and validates generated stories
after the generator backend switches to v2 format.

## Acceptance Criteria

1. **AC1 — No `ruby` field references in source code**
   - No component or utility in `apps/story-generator/src` directly reads, writes, or
     renders a `ruby` field
   - The client-side parallel-array check for `ruby` in `validateStoryJson.ts` is removed

2. **AC2 — `schema_version: "2"` is accepted as valid**
   - Stage 2 of `validateStoryJson()` accepts both `"1"` and `"2"` as valid values
   - Any version string other than `"1"` or `"2"` still triggers a `SCHEMA_VERSION` error

3. **AC3 — `words` / `vocab_keys` parity check is preserved**
   - The existing `vocab_keys` length check in Stage 4 remains unchanged and catches
     mismatches as before

4. **AC4 — Test fixtures converted to v2 format**
   - `valid-story.json` uses `schema_version: "2"`, has no `ruby` field
   - `parallel-array-mismatch.json` uses `schema_version: "2"`, no `ruby` field; mismatch
     is demonstrated via `vocab_keys` length diverging from `words` length
   - `grammar-index-out-of-bounds.json` uses `schema_version: "2"`, no `ruby` field

5. **AC5 — Test suite updated and passing**
   - Stage 2 test: asserts `"2"` is accepted (no error); asserts `"3"` is rejected with
     `SCHEMA_VERSION` error
   - Stage 4 test: previously tested `ruby` length mismatch; updated to test `vocab_keys`
     mismatch using the updated fixture
   - All other existing tests continue to pass

6. **AC6 — Typecheck passes**
   - `turbo typecheck` exits 0 for `apps/story-generator` with no errors related to schema
     or type changes from se1-1 / se1-2

7. **AC7 — `loadStory()` round-trip on valid fixture**
   - The existing test `'valid fixture also passes loadStory()'` continues to pass with the
     v2 fixture (loader v2 support was added in se1-3)

---

## Tasks / Subtasks

- [x] Task 1: Update `validateStoryJson.ts` — Stage 2 (AC1, AC2)
  - [x] Change Stage 2 condition from `story.schema_version !== '1'` to
    `story.schema_version !== '1' && story.schema_version !== '2'`
  - [x] Update Stage 2 error message to read: `schema_version must be "1" or "2", got ...`
  - [x] Remove the Stage 4 `ruby` parallel array check block (lines 78–85 in current file)

- [x] Task 2: Update `tests/fixtures/valid-story.json` (AC4, AC7)
  - [x] Change `"schema_version"` from `"1"` to `"2"`
  - [x] Remove the `"ruby"` field from the sentence object
  - [x] Words are already `["これ", "は", "テスト", "です"]` — テスト is katakana; no inline
    annotations needed; `words` array unchanged

- [x] Task 3: Update `tests/fixtures/parallel-array-mismatch.json` (AC4)
  - [x] Change `"schema_version"` from `"1"` to `"2"`
  - [x] Remove the `"ruby"` field from the sentence
  - [x] Change `"vocab_keys"` to have a different length than `"words"` to create a
    `vocab_keys` mismatch (e.g. `words` has 3 entries, `vocab_keys` has 2)

- [x] Task 4: Update `tests/fixtures/grammar-index-out-of-bounds.json` (AC4)
  - [x] Change `"schema_version"` from `"1"` to `"2"`
  - [x] Remove the `"ruby"` field from the sentence

- [x] Task 5: Update `tests/validateStoryJson.test.ts` (AC5)
  - [x] Stage 2 suite: replace the single test (`schema_version: "2"` triggers error) with:
    - `'accepts "2" as a valid schema_version'` — passes `{ ...validStory, schema_version: '2' }`;
      asserts no `SCHEMA_VERSION` error
    - `'rejects unknown schema_version "3"'` — passes `{ ...validStory, schema_version: '3' }`;
      asserts a `SCHEMA_VERSION` error
  - [x] Stage 4 suite, ruby mismatch test: change to test `vocab_keys` mismatch using the
    updated `parallel-array-mismatch.json` fixture; update assertion to check
    `e.path?.includes('vocab_keys')` (not `'ruby'`)

- [x] Task 6: Verify (AC6, AC7)
  - [x] Run `pnpm test:unit` from `apps/story-generator` — all tests must pass
  - [x] Run `pnpm typecheck` from `apps/story-generator` (or `turbo typecheck`) — exits 0

### Review Findings

- [x] [Review][Defer] No test asserts schema_version "1" is still accepted after condition change [`apps/story-generator/src/__tests__/validateStoryJson.test.ts`, Stage 2 suite] — deferred to deferred-work.md
- [x] [Review][Defer] v1 stories with ruby mismatch now pass client-side validator — intentional per spec; the custom validator delegates schema-level v1 validation to the loader layer; not caused by this change [`apps/story-generator/src/lib/validateStoryJson.ts:76`] — deferred, architectural limitation / pre-existing
- [x] [Review][Defer] Error message whitelist (`"1" or "2"`) will silently become stale when v3 is added — pre-existing design pattern in the validator; not caused by this diff — deferred, pre-existing pattern
- [x] [Review][Defer] Duplicate `vocab_supplement` keys silently valid — `supplementalKeys` Set deduplicates without error — pre-existing, unrelated to this story — deferred, pre-existing
- [x] [Review][Defer] Empty sentence (`words: []` with no `vocab_keys`) passes all 8 validation stages — pre-existing, unrelated to this story — deferred, pre-existing

---

## Dev Notes

### Architecture Context

This is story 6 of supp-epic-1 (furigana rework). Dependency chain:
- **se1-1**: Created `parseInlineRuby()` and `story.v2.json` schema in `packages/schema`
- **se1-2**: Updated `SentenceModel` to use `tokens: ParsedWord[]` (removed `words[]` + `ruby[]`)
- **se1-3**: Updated story-loader: v2 loader + v1 backward-compat shim
- **se1-5**: Updated story generator backend to emit v2 format

The story generator frontend (`apps/story-generator`) is a standalone React/Vite app that:
1. Communicates with the Python backend (`apps/story-generator-backend`) via AG-UI SSE protocol
2. Receives generated story JSON as a string in the `outputJson` state
3. Runs client-side validation via `validateStoryJson()` when the user clicks "Save & Download"
4. Calls `loadStory()` from `@nihonnohon/story-loader` in tests only (the `loadStory` is not
   called at runtime in the frontend — only in the test for the fixture round-trip)

The frontend itself does **not** render story content (no `WordToken`, `SentenceBlock`, etc.) —
it just stores and validates the JSON string. This means the type changes in se1-2 do not
directly affect TypeScript compilation here, since `SentenceModel` is not used in source.

### Current State of `validateStoryJson.ts`

**Stage 2 (line 38)** — rejects any version that isn't `"1"`:
```typescript
if ('schema_version' in story && story.schema_version !== null && story.schema_version !== '1') {
  errors.push({
    rule: 'SCHEMA_VERSION',
    message: `schema_version must be "1", got ${JSON.stringify(story.schema_version)}.`,
    ...
  })
}
```
After the change it becomes:
```typescript
if ('schema_version' in story && story.schema_version !== null
    && story.schema_version !== '1' && story.schema_version !== '2') {
  errors.push({
    rule: 'SCHEMA_VERSION',
    message: `schema_version must be "1" or "2", got ${JSON.stringify(story.schema_version)}.`,
    ...
  })
}
```

**Stage 4 ruby check (lines 78–85)** — remove entirely:
```typescript
// REMOVE THIS BLOCK:
if (Array.isArray(sentence.ruby) && (sentence.ruby as unknown[]).length !== wordCount) {
  errors.push({
    rule: 'PARALLEL_ARRAY_MISMATCH',
    message: `Sentence ${i}: ruby length ...`,
    sentenceIndex: i,
    path: `$.sentences[${i}].ruby`,
  })
}
```
The `vocab_keys` check immediately below it (lines 86–93) is preserved unchanged.

### Fixture Conversions

**`valid-story.json`** — minimal change (テスト is katakana, no annotation needed):
```json
{
  "schema_version": "2",
  "sentences": [
    {
      "id": "genki-1-ch3-test-story-s1",
      "words": ["これ", "は", "テスト", "です"],
      "vocab_keys": [null, null, 9001, null],
      "translation": "This is a test.",
      "grammar": [0]
    }
  ]
}
```

**`parallel-array-mismatch.json`** — v2, vocab_keys mismatch:
```json
{
  "schema_version": "2",
  "sentences": [
    {
      "id": "s1",
      "words": ["これ", "は", "テスト"],
      "vocab_keys": [null, null],
      "translation": "Test.",
      "grammar": [0]
    }
  ]
}
```
`words` has length 3, `vocab_keys` has length 2 → triggers `PARALLEL_ARRAY_MISMATCH`.

**`grammar-index-out-of-bounds.json`** — v2, remove ruby:
```json
{
  "schema_version": "2",
  "sentences": [
    {
      "id": "s1",
      "words": ["テスト"],
      "vocab_keys": [null],
      "translation": "Test.",
      "grammar": [99]
    }
  ]
}
```

### Updated Test Cases

**Stage 2 suite — replace the existing single test:**
```typescript
it('accepts "2" as a valid schema_version', () => {
  const story = { ...validStory, schema_version: '2' }
  const errors = validateStoryJson(JSON.stringify(story))
  expect(errors.some(e => e.rule === 'SCHEMA_VERSION')).toBe(false)
})

it('rejects unknown schema_version "3"', () => {
  const story = { ...validStory, schema_version: '3' }
  const errors = validateStoryJson(JSON.stringify(story))
  expect(errors.some(e => e.rule === 'SCHEMA_VERSION')).toBe(true)
})
```

**Stage 4 ruby→vocab_keys test:**
```typescript
it('detects vocab_keys array length mismatch at sentenceIndex 0', () => {
  const errors = validateStoryJson(JSON.stringify(parallelMismatch))
  const match = errors.find(
    e => e.rule === 'PARALLEL_ARRAY_MISMATCH' && e.sentenceIndex === 0
  )
  expect(match).toBeDefined()
  expect(match?.path).toContain('vocab_keys')
})
```

### Story Loader Version Support

The `@nihonnohon/story-loader` already supports v2 (se1-3). The test
`valid fixture also passes loadStory()` calls `loadStory(JSON.stringify(validStory))` —
this will dispatch to the v2 loader once the fixture has `schema_version: "2"`.

The v1 loader shim is still registered for `schema_version: "1"`, so the
`grammar-index-out-of-bounds.json` and `parallel-array-mismatch.json` fixtures will
continue to work as either v1 or v2 (those tests don't call `loadStory()`).

### Files to Change

| File | Change |
|------|--------|
| `apps/story-generator/src/lib/validateStoryJson.ts` | Stage 2: accept `"2"`; Stage 4: remove ruby check |
| `apps/story-generator/src/__tests__/fixtures/valid-story.json` | v2 format; remove ruby field |
| `apps/story-generator/src/__tests__/fixtures/parallel-array-mismatch.json` | v2 format; vocab_keys mismatch |
| `apps/story-generator/src/__tests__/fixtures/grammar-index-out-of-bounds.json` | v2 format; remove ruby field |
| `apps/story-generator/src/__tests__/validateStoryJson.test.ts` | Stage 2 and Stage 4 tests updated |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `apps/story-generator/src/stores/authoringStore.ts` | No ruby or schema-version references |
| `apps/story-generator/src/components/*` | No ruby/schema references in any component |
| `apps/story-generator/src/hooks/*` | No ruby/schema references |
| `apps/story-generator/src/lib/downloadStoryFile.ts` | Passes JSON string through as-is; format-agnostic |
| All other test files | No ruby references; no schema_version assertions |

### Comment Style

Per project feedback: exported functions get a succinct one-line JSDoc. Update the
`validateStoryJson` docstring to reflect the new stage count / schema_version support.
Stage comments within the function body follow the existing `// Stage N:` pattern.

### References

- Epic: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-6 section
- Previous story: `_bmad-output/implementation-artifacts/se1-5-story-generator-backend-v2-format.md`
- v2 JSON schema: `packages/schema/schemas/story.v2.json`
- ADR: `docs/adr/005-inline-furigana-format.md`
- Current `validateStoryJson.ts`: `apps/story-generator/src/lib/validateStoryJson.ts`
- Current test: `apps/story-generator/src/__tests__/validateStoryJson.test.ts`
- Current fixtures: `apps/story-generator/src/__tests__/fixtures/`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward with no blockers.

### Completion Notes List

- AC1: Removed ruby parallel array check from Stage 4 of `validateStoryJson.ts`
- AC2: Stage 2 now accepts both `"1"` and `"2"` as valid schema_version values
- AC3: `vocab_keys` parity check preserved unchanged
- AC4: All three test fixtures converted to v2 format — ruby fields removed, `parallel-array-mismatch.json` now uses a vocab_keys length mismatch
- AC5: Stage 2 test suite expanded to two tests (accepts "2", rejects "3"); Stage 4 ruby test replaced with vocab_keys mismatch test
- AC6: `pnpm typecheck` exits 0
- AC7: `valid fixture also passes loadStory()` test passes — v2 fixture dispatches to the v2 loader (se1-3)
- All 280 tests passing across 12 test files; no regressions

### File List

- `apps/story-generator/src/lib/validateStoryJson.ts` — Stage 2 accepts v2; ruby check removed
- `apps/story-generator/src/__tests__/fixtures/valid-story.json` — converted to v2
- `apps/story-generator/src/__tests__/fixtures/parallel-array-mismatch.json` — converted to v2, vocab_keys mismatch
- `apps/story-generator/src/__tests__/fixtures/grammar-index-out-of-bounds.json` — converted to v2
- `apps/story-generator/src/__tests__/validateStoryJson.test.ts` — Stage 2 and Stage 4 tests updated
