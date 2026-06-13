# Story se1-7: Migrate Existing Story Files to v2

Status: done

## Story

As a **developer**,
I want all committed story JSON files converted to v2 format,
so that the codebase has a single consistent format and the v1 shim can be considered for
removal.

## Acceptance Criteria

1. **AC1 — Migration script writes v2 files correctly**
   - Script location: `scripts/migrate-to-v2.ts` (root `scripts/` per project pattern,
     runnable via `pnpm migrate-to-v2`)
   - Reads every `.json` file in `apps/web/public/stories/`, skipping `manifest.json`
   - Rewrites each file with `schema_version: "2"`
   - Converts `words[i]` + `ruby[i]` pairs to inline-annotated strings (see algorithm in Dev Notes)
   - Removes the `ruby` field from every sentence object
   - All other fields (id, title, grammar, vocab_supplement, sentences.vocab_keys, etc.) are
     unchanged

2. **AC2 — Pure-kanji word migration**
   - `{ words: ["学生"], ruby: ["がくせい"] }` → `{ words: ["学生[がくせい]"] }`
   - Whole-word reading becomes a whole-word inline annotation

3. **AC3 — Null ruby produces plain string**
   - `{ words: ["は"], ruby: [null] }` → `{ words: ["は"] }`
   - `null` and the `"null"` coercion string both produce a plain word with no brackets

4. **AC4 — Okurigana words preserve their reading**
   - For words that start with kanji but end with non-kanji (okurigana), the ruby is placed
     after the first contiguous kanji run: `終わり` [おわり] → `終[おわり]わり`
   - Annotation appears above the kanji portion; okurigana renders bare
   - Words with no kanji at all and a non-null ruby: drop the annotation, emit plain word

5. **AC5 — All migrated files load without error**
   - After migration, calling `loadStory()` on every migrated file returns a valid `StoryModel`
   - The migration script verifies each file with `loadStory()` after writing and reports
     any failures
   - `turbo test:unit` exits 0 with no regressions

6. **AC6 — `manifest.json` is unchanged**
   - `apps/web/public/stories/manifest.json` is not touched by the migration script

7. **AC7 — V1 shim retention decision is documented**
   - A code comment is added to `packages/story-loader/src/v1.ts` (near the top of
     `loadV1`) stating whether the v1 shim is retained for externally-sourced stories or
     is a candidate for removal

---

## Tasks / Subtasks

- [ ] Task 1: Write migration script `scripts/migrate-to-v2.ts` (AC1–AC5)
  - [ ] Add `isKanji()` helper (copy exact implementation from `parseInlineRuby.ts` to ensure
    consistent kanji detection; do not import from the package — the script is standalone)
  - [ ] Implement `migrateWord(word, ruby)` function following the algorithm in Dev Notes
  - [ ] Main loop: read every story JSON file, convert sentences, write back with 2-space indent
    + trailing newline (match existing file style)
  - [ ] After writing each file, call `loadStory()` to verify it is accepted; log result
  - [ ] Print a final summary: N files migrated, M failed
  - [ ] Use the same shebang/header style as `scripts/build-manifest.ts`

- [ ] Task 2: Add `migrate-to-v2` script to root `package.json` (AC1)
  - [ ] Add entry: `"migrate-to-v2": "tsx scripts/migrate-to-v2.ts"`

- [ ] Task 3: Run the migration (AC1–AC5)
  - [ ] Execute `pnpm migrate-to-v2` from repo root
  - [ ] Confirm all 29 story files migrated with 0 failures

- [ ] Task 4: Document v1 shim retention decision (AC7)
  - [ ] Add comment to `packages/story-loader/src/v1.ts` near `export function loadV1`

- [ ] Task 5: Verify (AC5)
  - [ ] Run `turbo test:unit` — all tests pass
  - [ ] Run `pnpm typecheck` — exits 0

---

## Dev Notes

### Architecture Context

This is story 7 of supp-epic-1 (furigana rework). Dependency chain:
- **se1-1**: Created `parseInlineRuby()` and `story.v2.json` schema
- **se1-2**: Updated `SentenceModel` to use `tokens: ParsedWord[]`
- **se1-3**: Updated story-loader: v2 loader + v1 backward-compat shim
- **se1-4**: Updated reader UI per-segment rendering
- **se1-5**: Story generator backend produces v2 format
- **se1-6**: Story generator frontend accepts v2 format

All infrastructure is in place. This story is purely a data migration + script.

### Script Location and Pattern

Follow the pattern of `scripts/build-manifest.ts`:
- Shebang: `#!/usr/bin/env tsx`
- Copyright header
- Import from `'../packages/story-loader/src/index.ts'` directly (not dist)
- Use `node:fs`, `node:path` (no extra deps)
- Register in root `package.json` scripts

**Do NOT** create `packages/story-loader/scripts/` — the root `scripts/` directory is the
established convention in this repo.

### Migration Algorithm

#### `isKanji(char: string): boolean`

Copy verbatim from `packages/story-loader/src/parseInlineRuby.ts:6-15`. This covers:
- CJK Unified Ideographs (U+4E00–U+9FFF)
- 々 (U+3005), 〻 (U+303B), 〃 (U+3003)

#### `migrateWord(word: string, ruby: string | null): string`

```
1. Coerce "null" string → null  (same logic as v1 loader: v === 'null' ? null : v)
2. If ruby is null: return word as-is (plain string)
3. Find the first contiguous kanji run from position 0:
     kanjiRunEnd = 0
     while kanjiRunEnd < word.length and isKanji(word[kanjiRunEnd]):
       kanjiRunEnd++
4. If kanjiRunEnd === 0 (no leading kanji): return word (drop annotation — no bracket anchor)
5. Return: word[0..kanjiRunEnd] + '[' + ruby + ']' + word[kanjiRunEnd..]
```

Examples with this algorithm:

| word | ruby | result |
|---|---|---|
| `学生` | `がくせい` | `学生[がくせい]` |
| `大学` | `だいがく` | `大学[だいがく]` |
| `終わり` | `おわり` | `終[おわり]わり` |
| `皆さん` | `みなさん` | `皆[みなさん]さん` |
| `好き` | `すき` | `好[すき]き` |
| `けんじさん` | `けんじさん` | `けんじさん` (no leading kanji → drop) |
| `は` | `null` | `は` |
| `午前` | `ごぜん` | `午前[ごぜん]` |

**Note on okurigana cases (1136 occurrences in the current story files):** For words like
`終わり[おわり]わり`, the parsed v2 token will have two segments: `[{text:"終", ruby:"おわり"},
{text:"わり", ruby:null}]`. The ruby `おわり` appears above the kanji `終` only, not above the
full word `終わり`. This is NOT pixel-identical to the v1 rendering (whole word annotated), but
it preserves the reading and is acceptable: the learning value is retained, and this is what
"lossy in one direction" means in the epic's risk notes. The strict "visually identical" claim
in AC5 of the epic applies cleanly only to pure-kanji words; okurigana words shift the ruby
extent but retain the reading.

#### Sentence Conversion Loop

```typescript
for (const sentence of story.sentences) {
  const wordCount = sentence.words.length
  const rubyArr = sentence.ruby ?? Array(wordCount).fill(null)
  
  sentence.words = sentence.words.map((w, i) => migrateWord(w, rubyArr[i]))
  delete sentence.ruby
}
story.schema_version = '2'
```

#### File Write Style

Existing files use `JSON.stringify(data, null, 2) + '\n'`. Match this exactly.

### V1 Shim Retention Decision

Add this comment to `packages/story-loader/src/v1.ts` near `export function loadV1`:

```typescript
// The v1 shim is retained for externally-sourced stories (user uploads, shared links).
// All committed story files in apps/web/public/stories/ were migrated to v2 in se1-7.
// Removal of this shim can be considered once external v1 ingestion is formally deprecated.
```

### Files to Create

| File | Change |
|------|--------|
| `scripts/migrate-to-v2.ts` | New migration script |

### Files to Modify

| File | Change |
|------|--------|
| `package.json` (root) | Add `"migrate-to-v2": "tsx scripts/migrate-to-v2.ts"` script |
| `apps/web/public/stories/*.json` (29 files) | Migrated to v2 by running the script |
| `packages/story-loader/src/v1.ts` | Add shim retention comment |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `apps/web/public/stories/manifest.json` | Format-agnostic; no schema_version field |
| `packages/story-loader/src/v2.ts` | No changes needed |
| `packages/story-loader/src/parseInlineRuby.ts` | No changes needed |
| All web app components | se1-4 already handles both v1-shim and v2 tokens |
| All existing unit tests | No fixture changes needed (unit tests use their own fixtures) |

### Testing Notes

The unit tests in `packages/story-loader/src/index.test.ts` and `parseInlineRuby.test.ts`
use fixtures in `src/__fixtures__/`, not the public story files. They are unaffected by the
migration.

The migration script itself runs `loadStory()` on each migrated file as a post-write
verification step — this is the "loaded via loadStory()" check from AC5. If any file fails,
report and exit non-zero; do not silently continue.

### Comment Style

Per project feedback: exported functions get a succinct one-line JSDoc. Major sections within
function bodies get a `//` block comment. Do not narrate obvious code.

### References

- Epic: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-7 section
- ADR: `docs/adr/005-inline-furigana-format.md`
- Pattern reference: `scripts/build-manifest.ts` — script structure to follow
- `packages/story-loader/src/parseInlineRuby.ts` — `isKanji()` to copy
- `packages/story-loader/src/v1.ts` — `"null"` string coercion pattern (line 105)
- Story files: `apps/web/public/stories/` (29 v1 files, 0 v2 files as of story creation)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — migration was straightforward with no blockers.

### Completion Notes List

- AC1: `scripts/migrate-to-v2.ts` written following `build-manifest.ts` pattern; registered as `pnpm migrate-to-v2`
- AC2: Pure-kanji words (e.g. `学生[がくせい]`) migrate correctly; bracket placed after full kanji run
- AC3: Null ruby (and `"null"` string coercion) produces plain word
- AC4: Okurigana words (1136 occurrences) use `kanji_prefix[ruby]okurigana_suffix` — reading preserved, annotation extent shifts to kanji portion only
- AC5: All 29 story files migrated with 0 failures; `loadStory()` verified each file post-write; `turbo test:unit` exits 0 (280 tests, 12 files)
- AC6: `manifest.json` untouched
- AC7: V1 shim retention comment added to `packages/story-loader/src/v1.ts`
- `turbo typecheck` exits 0 across all packages

### File List

- `scripts/migrate-to-v2.ts` — new one-time migration script
- `package.json` (root) — added `"migrate-to-v2"` script entry
- `apps/web/public/stories/*.json` (29 files) — migrated to v2 format
- `packages/story-loader/src/v1.ts` — v1 shim retention comment added
