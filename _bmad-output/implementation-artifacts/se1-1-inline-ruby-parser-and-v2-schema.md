# Story se1-1: Inline Ruby Parser and v2 Schema Definition

**Status:** done
**Epic:** Supplemental Epic 1 — Furigana Rework
**Story ID:** se1-1
**Date:** 2026-06-04

---

## User Story

As a **developer**,
I want a validated `story.v2.json` schema and a tested `parseInlineRuby()` function,
So that the new `漢字[よみ]` annotation format has a formal contract and a correct, well-tested
parser before any consumers are updated.

---

## Background

The current story format stores furigana as a parallel `ruby` array — one reading per word,
whole-word. The rework replaces this with inline annotations embedded directly in word strings:
`漢字[よみ]`. This story creates the two foundational artifacts — the v2 JSON Schema and the
parser — without touching any types, loaders, or components (those are se1-2 and se1-3).

**See:** `docs/adr/005-inline-furigana-format.md` for full design rationale.
**See:** `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` for the full epic.

---

## Scope

**This story creates:**
- `packages/schema/schemas/story.v2.json` — new JSON Schema (no `ruby` field, annotated words)
- `packages/story-loader/src/parseInlineRuby.ts` — parser function + local type definitions
- `packages/story-loader/src/parseInlineRuby.test.ts` — comprehensive unit tests
- `packages/story-loader/src/__fixtures__/valid-v2.json` — new v2 fixture
- `packages/schema/SCHEMA_CHANGELOG.md` — updated with version 2 entry

**This story does NOT change:**
- `packages/schema/src/types.ts` — type changes are se1-2
- `packages/story-loader/src/v1.ts` — loader changes are se1-3
- `packages/story-loader/src/index.ts` — registry change is se1-3
- Any `apps/web` components — UI changes are se1-4
- Any story generator code — generator changes are se1-5/se1-6

**`turbo typecheck` MUST pass at the end of this story.**

---

## Acceptance Criteria

**AC1 — v2 JSON Schema**

Given `packages/schema/schemas/story.v2.json`
When reviewed
Then:
- `"$schema": "http://json-schema.org/draft-07/schema#"`
- `schema_version` enum is `["2"]` (not `["1", "2"]` — it is version-2-only)
- The sentence `$def` has `words: string[]` but NO `ruby` field
- `additionalProperties: false` is enforced at every object node
- All other root and sentence fields are identical to `story.v1.json`
- The file is valid JSON parseable by AJV

**AC2 — parseInlineRuby: whole-word jukujikun**

Given `parseInlineRuby("大人[おとな]")`
When called
Then returns:
```json
{ "surface": "大人", "segments": [{ "text": "大人", "ruby": "おとな" }] }
```

**AC3 — parseInlineRuby: kanji block + okurigana**

Given `parseInlineRuby("肌寒[はだざむ]い")`
When called
Then returns:
```json
{
  "surface": "肌寒い",
  "segments": [
    { "text": "肌寒", "ruby": "はだざむ" },
    { "text": "い", "ruby": null }
  ]
}
```

**AC4 — parseInlineRuby: separate kanji interleaved with kana**

Given `parseInlineRuby("付[つ]け加[くわ]える")`
When called
Then returns:
```json
{
  "surface": "付け加える",
  "segments": [
    { "text": "付", "ruby": "つ" },
    { "text": "け", "ruby": null },
    { "text": "加", "ruby": "くわ" },
    { "text": "える", "ruby": null }
  ]
}
```

**AC5 — parseInlineRuby: single kanji**

Given `parseInlineRuby("私[わたし]")`
When called
Then returns:
```json
{ "surface": "私", "segments": [{ "text": "私", "ruby": "わたし" }] }
```

**AC6 — parseInlineRuby: unannotated plain string**

Given `parseInlineRuby("は")`
When called
Then returns:
```json
{ "surface": "は", "segments": [{ "text": "は", "ruby": null }] }
```

**AC7 — parseInlineRuby: adjacent annotated kanji blocks**

Given `parseInlineRuby("全国[ぜんこく]大会[たいかい]")`
When called
Then returns:
```json
{
  "surface": "全国大会",
  "segments": [
    { "text": "全国", "ruby": "ぜんこく" },
    { "text": "大会", "ruby": "たいかい" }
  ]
}
```

**AC8 — parseInlineRuby: malformed input is handled gracefully**

Given a string with an unclosed bracket `"食[た"`
When called
Then returns without throwing; `surface` equals the input string; no partial ruby annotation present

**AC9 — Full test suite passes**

Given `pnpm test:unit` run inside `packages/story-loader`
When executed
Then all tests pass; coverage includes all four annotation patterns, adjacent kanji blocks,
unannotated strings, katakana-only strings, empty string input, and malformed bracket inputs

**AC10 — SCHEMA_CHANGELOG.md updated**

Given `packages/schema/SCHEMA_CHANGELOG.md`
When reviewed
Then contains a new "Version 2" section documenting:
- Removed: `ruby` field from sentence objects
- Added: `words` entries may contain inline `漢字[よみ]` annotations
- References ADR 005

---

## Implementation Guide

### 1. story.v2.json

**Location:** `packages/schema/schemas/story.v2.json`

Base this on `story.v1.json` exactly, with two changes only:
1. `schema_version` enum changes from `["1"]` to `["2"]`
2. In the `sentence` `$def`, remove the `ruby` property entirely

The `words` property definition stays identical — it remains `string[]` with `minItems: 1`.
The schema does NOT enforce annotation syntax (that is the parser's job, not the schema's).

Do not add any new fields in this story. The `additionalProperties: false` at the sentence
level already prevents unknown fields, so removing `ruby` automatically makes it illegal.

### 2. parseInlineRuby.ts

**Location:** `packages/story-loader/src/parseInlineRuby.ts`

Define local interfaces (these will be moved to `@nihonnohon/schema` in se1-2 and imported from
there in se1-3; for this story they live here to keep the package self-contained and compiling):

```typescript
/** A single text+ruby segment within a parsed word. ruby is null for unannotated text. */
export interface WordSegment {
  text: string
  ruby: string | null
}

/** A word parsed from an inline-annotated string. surface is always the clean plain text. */
export interface ParsedWord {
  surface: string
  segments: WordSegment[]
}
```

**Parsing rule** (implement exactly this logic):

Scan `input` left-to-right, maintaining a current position `pos`:
1. If `input[pos]` is a kanji character, collect a contiguous run of kanji characters.
   - If the character immediately after the run is `[`, consume to `]` and create an annotated segment.
   - Otherwise create an unannotated segment from the kanji run.
2. Otherwise collect a run of non-kanji, non-`[` characters and create an unannotated segment.
3. If a `[` is encountered outside kanji context (malformed), skip to the matching `]` or end of string.
4. Repeat until `pos === input.length`.

**Kanji detection:** A character is kanji if its Unicode codepoint is in the CJK Unified
Ideographs block: `code >= 0x4E00 && code <= 0x9FFF`. Use `char.codePointAt(0)`.

**Malformed bracket handling:** If `[` occurs after a kanji run and there is no matching `]`,
treat the `[` and everything after it as an unannotated plain segment. Do not throw.

**surface:** Concatenate `segment.text` values for all segments.

**Empty string input:** Return `{ surface: '', segments: [] }`.

Export a named function `parseInlineRuby(input: string): ParsedWord`.

Write a succinct JSDoc on the exported function explaining the format.

### 3. parseInlineRuby.test.ts

**Location:** `packages/story-loader/src/parseInlineRuby.test.ts`

**Pattern:** Explicit imports (follow `index.test.ts` pattern — NOT globals):
```typescript
import { describe, expect, it } from 'vitest'
import { parseInlineRuby } from './parseInlineRuby'
```

Group tests by annotation case. Required test cases:

| Input | Expected `surface` | Segment count |
|---|---|---|
| `"大人[おとな]"` | `"大人"` | 1 (annotated) |
| `"肌寒[はだざむ]い"` | `"肌寒い"` | 2 (annotated + plain) |
| `"付[つ]け加[くわ]える"` | `"付け加える"` | 4 |
| `"私[わたし]"` | `"私"` | 1 |
| `"は"` | `"は"` | 1 (plain) |
| `"全国[ぜんこく]大会[たいかい]"` | `"全国大会"` | 2 |
| `"食べる"` (kanji + unannotated kana) | `"食べる"` | 2 |
| `"テスト"` (katakana only) | `"テスト"` | 1 (plain) |
| `""` (empty string) | `""` | 0 segments |
| `"食[た"` (unclosed bracket) | does not throw | — |
| `"食べる[たべる]"` (bracket after kana) | handles gracefully | — |

Each test should assert `surface`, segment count, and spot-check at least one segment's `text`
and `ruby` values. Use `toEqual` for full segment array assertions on the four annotation cases.

### 4. valid-v2.json fixture

**Location:** `packages/story-loader/src/__fixtures__/valid-v2.json`

Create a minimal but representative v2 fixture. Include at least one sentence with examples
of all four annotation patterns so se1-3 can use it for loader testing. Example structure:

```json
{
  "schema_version": "2",
  "id": "test-story-v2",
  "title": "V2 Test Story",
  "title_ja": "V2テストストーリー",
  "language": "Japanese",
  "description": "Test fixture for story.v2.json parser validation.",
  "difficulty": "Genki I Ch.6",
  "sentences": [
    {
      "id": "s1",
      "words": ["大人[おとな]", "は", "肌寒[はだざむ]い", "日[ひ]に", "付[つ]け加[くわ]える"]
    },
    {
      "id": "s2",
      "words": ["私[わたし]", "は", "学生[がくせい]", "です"],
      "vocab_keys": [null, null, 1, null],
      "translation": "I am a student."
    }
  ]
}
```

### 5. SCHEMA_CHANGELOG.md update

Append a new section above the existing Version 1 section:

```markdown
## Version 2

Introduced inline furigana annotation. See ADR 005 (`docs/adr/005-inline-furigana-format.md`)
for full design rationale.

### Changes from Version 1

**Removed:** `ruby` field from sentence objects. This was a parallel array associating a
whole-word reading with each word. It is no longer valid in v2; including it causes
`additionalProperties: false` validation to fail.

**Changed:** `words` array entries may now contain inline `漢字[よみ]` annotations. The
`[reading]` bracket attaches to the contiguous kanji block immediately preceding it.
Unannotated characters are plain text. Words with no furigana are plain strings. This
is transparent to the schema — `words` remains `string[]`.

### Sentence-level fields (v2)

Required: `id`, `words`

Optional: `vocab_keys`, `translation`, `grammar`, `audio_url`

Removed: `ruby`
```

---

## Technical Constraints

### Package structure and imports

- `ajv` is in `devDependencies` of `packages/story-loader` (it is bundled by tsup). Do not
  move it to dependencies — the existing pattern is correct.
- `@nihonnohon/schema` is in `dependencies` of `packages/story-loader`. The new
  `story.v2.json` must be importable via `@nihonnohon/schema/schemas/story.v2.json` (same
  pattern as the existing `story.v1.json` import in `v1.ts`). Verify the schema package's
  `exports` map or `files` config supports this path; if it does not, add it.
- Do not import `parseInlineRuby` from `@nihonnohon/schema` — the parser lives in the loader.

### TypeScript

- `strict: true` — all types must be explicit; no implicit `any`
- `moduleResolution: "bundler"` — used in all packages
- The `WordSegment` and `ParsedWord` interfaces are exported from `parseInlineRuby.ts` now
  (so they can be tested) and will be moved/re-exported from `@nihonnohon/schema` in se1-2.
  Define them here without worrying about that future move.

### Testing in packages

Tests in `packages/story-loader` use **explicit vitest imports**, NOT globals:
```typescript
import { describe, expect, it } from 'vitest'
```
This is different from `apps/web` tests which use Vitest globals. Follow the existing
`index.test.ts` pattern exactly.

### Schema package exports

Check `packages/schema/package.json` to confirm the `exports` map allows importing JSON
schema files. The existing loader imports:
```typescript
import schema from '@nihonnohon/schema/schemas/story.v1.json'
```
The v2 schema must be importable via the same pattern:
```typescript
import schema from '@nihonnohon/schema/schemas/story.v2.json'
```
`packages/schema/package.json` uses **named per-file exports** — there is a specific entry
`"./schemas/story.v1.json": "./schemas/story.v1.json"`. You MUST add the v2 entry:
```json
"./schemas/story.v2.json": "./schemas/story.v2.json"
```
Without this, `import schema from '@nihonnohon/schema/schemas/story.v2.json'` will fail to
resolve in the loader. The `schemas/` directory is already in `"files"` so the JSON file
itself does not need any other change.

### File headers

All new TypeScript files must start with:
```typescript
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
```

---

## Verification Checklist

Before marking complete:

- [x] `pnpm test:unit` passes inside `packages/story-loader` — all new tests green
- [x] `turbo typecheck` passes from repo root — zero type errors
- [x] `story.v2.json` is valid JSON (parseable by `JSON.parse`)
- [x] All four annotation cases are covered by tests with `toEqual` assertions on segments
- [x] Empty string input is tested and does not throw
- [x] Malformed bracket input is tested and does not throw
- [x] `SCHEMA_CHANGELOG.md` has a Version 2 section
- [x] No changes made to `types.ts`, `v1.ts`, `index.ts`, or any `apps/web` file

---

## Review Findings

### Decision-Needed

- [x] [Review][Decision] **D1 — `々` (U+3005) not recognized as kanji, breaks annotation for 時々/人々** ✅ Fixed: extended `isKanji` to include 々 (U+3005), 〻 (U+303B), 〃 (U+3003); 3 tests added — `isKanji` checks 0x4E00–0x9FFF; the ideographic iteration mark `々` (U+3005) is outside that range and is treated as a non-kanji character. Input `時々[ときどき]` produces a broken parse: kanji run stops at `時`, then `々` is a plain-text run, then `[ときどき]` becomes an orphan bracket. Edge Case Hunter found 12 sentences across 7 existing story files using `時々`/`人々` in v1 ruby form. Decision: extend `isKanji` to also recognize `々` (and optionally `〃` U+3003), or document the limitation and handle in the migration step (se1-7)?
- [x] [Review][Decision] **D2 — Orphan bracket surface is ambiguous; test deliberately does not assert surface value** ✅ Fixed: orphan bracket content is now discarded (surface stays clean); test updated to assert surface = `"食べる"` with 2 plain segments; added test for orphan-at-start case — Spec rule 3: "If a `[` is encountered outside kanji context, skip to matching `]` or end of string." Current behavior: the bracket and its content form a segment `{text:"[たべる]", ruby:null}`, so surface for `食べる[たべる]` is `"食べる[たべる]"`. The test only asserts `typeof surface === 'string'`. Decision: does "skip" mean discard (surface = `"食べる"`, no bracket segment) or advance-past (surface includes brackets, current behavior)?

### Deferred

- [x] [Review][Defer] **W1 — CJK Extension A (U+3400–U+4DBF) excluded from `isKanji`** [`parseInlineRuby.ts:19`] — deferred, pre-existing; no kyouiku/joyo kanji are in Extension A; spec defines range as 0x4E00–0x9FFF explicitly
- [x] [Review][Defer] **W2 — Surrogate-pair iteration corrupts output for CJK Extension B+ characters** [`parseInlineRuby.ts:40`] — deferred, pre-existing; Extension B characters (U+20000+) do not exist in Japanese; theoretical only
- [x] [Review][Defer] **W3 — `metadata` object node uses `additionalProperties: true` while AC1 says "every object node"** [`story.v2.json:66`] — deferred, pre-existing from v1; metadata is intentionally an open escape-hatch

---

## Dev Notes Section

## Dev Notes

### Implementation summary

All five artifacts created. The `parseInlineRuby` function implements a left-to-right
scanner that collects kanji runs, checks for a following `[reading]` bracket, and
otherwise falls through to plain unannotated segments. Malformed inputs (unclosed or
orphaned brackets) never throw. `turbo typecheck` passes across all 7 packages;
`pnpm test:unit` passes 25/25 tests (11 new, 14 pre-existing regressions).

### Files created

- `packages/schema/schemas/story.v2.json`
- `packages/story-loader/src/parseInlineRuby.ts`
- `packages/story-loader/src/parseInlineRuby.test.ts`
- `packages/story-loader/src/__fixtures__/valid-v2.json`

### Files modified

- `packages/schema/package.json` — added `./schemas/story.v2.json` export entry
- `packages/schema/SCHEMA_CHANGELOG.md` — prepended Version 2 section

### Key decisions made

- `WordSegment` and `ParsedWord` interfaces exported from `parseInlineRuby.ts` as the
  story specifies (se1-2 will move them to `@nihonnohon/schema`).
- Malformed unclosed bracket after a kanji run: the entire remainder of the input
  (kanji + `[` + partial reading) is returned as a single unannotated segment so
  `surface` equals the input string, satisfying AC8 exactly.
- Orphaned `[` (bracket not preceded by kanji) is returned as a plain text segment
  including the brackets.

### Issues encountered

None. The parsing algorithm in the story spec was precise; no ambiguity arose during
implementation.

### Learnings for se1-2 (internal type changes)

- `WordSegment` and `ParsedWord` are currently exported from `parseInlineRuby.ts`.
  se1-2 should add them to `packages/schema/src/types.ts` and re-export them; se1-3
  can then import from `@nihonnohon/schema` and remove the local definitions.
- The v2 fixture at `packages/story-loader/src/__fixtures__/valid-v2.json` covers all
  four annotation patterns and is ready for the se1-3 loader integration tests.
