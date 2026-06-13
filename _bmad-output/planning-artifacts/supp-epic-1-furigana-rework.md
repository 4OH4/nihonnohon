---
status: backlog
type: supplemental-epic
epic_id: supp-epic-1
created: "2026-06-04"
---

# Supplemental Epic 1: Furigana Rework — Per-Kanji Annotations and story.v2.json

## Overview

This supplemental epic upgrades how furigana (ruby) annotations are stored and rendered
throughout the nihonnohon system. The current word-level annotation scheme (`ruby` parallel
array) wraps entire words in a single `<ruby>/<rt>` pair, which is incorrect by Japanese
publishing standards: furigana should appear only above kanji characters, leaving okurigana
and other non-kanji elements unannotated.

The rework introduces `story.v2.json` with inline `漢字[よみ]` annotation syntax, a
`parseInlineRuby()` parser in the story loader, updated internal types, corrected reader UI
rendering, updated story generator output, and a one-time migration of all committed stories.

**Reference:** See `docs/adr/005-inline-furigana-format.md` for the full design rationale
and decision record.

---

## Background and Motivation

### Current behaviour (incorrect)

The word `食べる` with ruby `"たべる"` renders as:

```html
<ruby>食べる<rt>たべる</rt></ruby>
```

— `たべる` appears above the entire word, including the okurigana `べる`.

### Target behaviour (standard practice)

```html
<ruby>食<rt>た</rt></ruby>べる
```

— `た` appears above only the kanji `食`; `べる` is bare.

### Four annotation patterns that must be supported

| Pattern | Wire format | Rendered output |
|---|---|---|
| Jukujikun (whole-word) | `大人[おとな]` | `<ruby>大人<rt>おとな</rt></ruby>` |
| Kanji block + okurigana | `肌寒[はだざむ]い` | `<ruby>肌寒<rt>はだざむ</rt></ruby>い` |
| Separate kanji, interleaved kana | `付[つ]け加[くわ]える` | `<ruby>付<rt>つ</rt></ruby>け<ruby>加<rt>くわ</rt></ruby>える` |
| Single kanji | `私[わたし]` | `<ruby>私<rt>わたし</rt></ruby>` |

---

## Design Decisions

### Wire format: `漢字[よみ]` inline annotation

The `[読み]` bracket attaches to the contiguous kanji block immediately preceding it.
Non-kanji characters (hiragana, katakana, punctuation) between or after annotated blocks
are plain text with no annotation. Words with no furigana are plain strings.

Parsing rule: scan left-to-right; collect a kanji run; if immediately followed by `[`,
consume to `]` as the reading; otherwise the kanji run is unannotated.

### Internal representation

The loader parses inline annotations once, at load time:

```typescript
interface WordSegment { text: string; ruby: string | null }
interface ParsedWord  { surface: string; segments: WordSegment[] }
```

`SentenceModel.tokens: ParsedWord[]` replaces `words: string[]` + `ruby: (string | null)[]`.
`surface` is always the clean plain-text form of the word, available without parsing.

### Backward compatibility

- V1 stories remain loadable via a shim in the v1 loader that converts whole-word ruby
  strings to single-segment `ParsedWord` tokens. Rendering is identical to current.
- A one-time migration script converts all committed story files to v2.

---

## Components Affected

| Component | Package / App | Nature of change |
|---|---|---|
| `story.v2.json` | `packages/schema` | New schema: no `ruby` field; annotated `words` strings |
| `SCHEMA_CHANGELOG.md` | `packages/schema` | Document version `"2"` |
| `WordSegment`, `ParsedWord` | `packages/schema` | New types |
| `SentenceModel` | `packages/schema` | `tokens: ParsedWord[]` replaces parallel arrays |
| `parseInlineRuby()` | `packages/story-loader` | New parser function |
| `v2.ts` loader | `packages/story-loader` | New version-2 loader |
| `v1.ts` loader (shim) | `packages/story-loader` | Emit `ParsedWord` tokens from v1 data |
| `WordToken.tsx` | `apps/web` | Render segments, not whole-word ruby |
| `SentenceBlock.tsx` | `apps/web` | Consume `tokens[]`, remove parallel-array zip |
| `agent.py` system prompt | `apps/story-generator-backend` | Produce v2 inline format |
| `validator.py` | `apps/story-generator-backend` | Validate annotated strings; remove parallel-array check |
| Story generator frontend | `apps/story-generator` | Audit for `ruby` field references |
| Story JSON files | `apps/web/public/stories/` | Migrate all v1 files to v2 |

---

## Story List

| Story ID | Title | Depends on |
|---|---|---|
| se1-1 | Inline Ruby Parser and v2 Schema Definition | — |
| se1-2 | Internal Type Changes | se1-1 |
| se1-3 | Loader: v2 Support and v1 Backward-Compat Shim | se1-2 |
| se1-4 | Reader UI: Per-Segment Furigana Rendering | se1-3 |
| se1-5 | Story Generator Backend: v2 Output Format | se1-1 |
| se1-6 | Story Generator Frontend: v2 Compatibility | se1-5 |
| se1-7 | Migrate Existing Story Files to v2 | se1-3, se1-6 |

Stories se1-5 and se1-6 can proceed in parallel with se1-3 and se1-4 once se1-1 is done.
Story se1-7 is a cleanup step and may be deferred if needed.

---

## Stories

---

### Story se1-1: Inline Ruby Parser and v2 Schema Definition

As a **developer**,
I want a validated `story.v2.json` schema and a tested `parseInlineRuby()` function,
So that the new annotation format has a formal contract and a correct, well-tested parser
before any consumers are updated.

**Acceptance Criteria:**

**Given** `packages/schema/schemas/story.v2.json`
**When** reviewed
**Then** `schema_version` enum is `["2"]`; sentence objects have `words: string[]` and no
`ruby` field; `additionalProperties: false` is enforced at every node; all other fields
match `story.v1.json` except the removed `ruby`

**Given** `parseInlineRuby("大人[おとな]")`
**When** called
**Then** returns `{ surface: "大人", segments: [{ text: "大人", ruby: "おとな" }] }`

**Given** `parseInlineRuby("肌寒[はだざむ]い")`
**When** called
**Then** returns `{ surface: "肌寒い", segments: [{ text: "肌寒", ruby: "はだざむ" }, { text: "い", ruby: null }] }`

**Given** `parseInlineRuby("付[つ]け加[くわ]える")`
**When** called
**Then** returns `{ surface: "付け加える", segments: [{ text: "付", ruby: "つ" }, { text: "け", ruby: null }, { text: "加", ruby: "くわ" }, { text: "える", ruby: null }] }`

**Given** `parseInlineRuby("私[わたし]")`
**When** called
**Then** returns `{ surface: "私", segments: [{ text: "私", ruby: "わたし" }] }`

**Given** `parseInlineRuby("は")`
**When** called
**Then** returns `{ surface: "は", segments: [{ text: "は", ruby: null }] }`

**Given** adjacent annotated kanji blocks `"全国[ぜんこく]大会[たいかい]"`
**When** called
**Then** returns two segments: `{ text: "全国", ruby: "ぜんこく" }` and `{ text: "大会", ruby: "たいかい" }`

**Given** a string with unclosed bracket `"食[た"`
**When** called
**Then** returns gracefully without throwing; surface is the input string; segments contain no partial ruby

**Given** the full unit test suite for `parseInlineRuby`
**When** `turbo test:unit` runs
**Then** all cases pass; coverage includes all four annotation patterns, adjacent kanji blocks, unannotated plain strings, katakana input, and malformed bracket inputs

**Given** `packages/schema/SCHEMA_CHANGELOG.md`
**When** reviewed
**Then** documents version `"2"`: lists removed `ruby` field, describes `words` annotated string format, references ADR 005

---

### Story se1-2: Internal Type Changes

As a **developer**,
I want `SentenceModel` to use `tokens: ParsedWord[]` instead of parallel `words[]` and
`ruby[]` arrays,
So that the internal representation is type-safe and self-contained, with clean surface text
always accessible without parsing.

**Acceptance Criteria:**

**Given** `packages/schema/src/types.ts`
**When** reviewed
**Then** exports `WordSegment { text: string; ruby: string | null }` and
`ParsedWord { surface: string; segments: WordSegment[] }`;
`SentenceModel` has `tokens: ParsedWord[]` replacing the `words: string[]` and
`ruby: (string | null)[]` fields; all other `SentenceModel` fields are unchanged

**Given** `turbo typecheck` run after this story in isolation (before loader and UI are updated)
**When** executed
**Then** reports type errors in `packages/story-loader` and `apps/web` — this is expected and
intentional; this story does not fix downstream consumers

**Given** no other files besides `packages/schema/src/types.ts`
**When** changed in this story
**Then** the diff is limited to the type file only; no loader, component, or test changes are
included (those belong to se1-3 and se1-4)

---

### Story se1-3: Loader — v2 Support and v1 Backward-Compat Shim

As a **developer**,
I want the story loader to correctly handle both v1 and v2 story files,
So that existing v1 stories continue to render without any changes to their JSON files,
and new v2 stories with inline annotations load and parse correctly.

**Acceptance Criteria:**

**Given** `packages/story-loader/src/v2.ts`
**When** reviewed
**Then** validates raw JSON against `story.v2.json` via AJV before any transformation;
maps each word string through `parseInlineRuby()` to produce `SentenceModel.tokens`;
transformation from snake_case to camelCase follows the same pattern as `v1.ts`;
`schema_version: "2"` is registered in the loader dispatch in `src/index.ts`

**Given** a valid v2 story fixture (new fixture to be created: `valid-v2.json`)
**When** `loadStory()` is called
**Then** returns a `StoryModel` where each sentence has `tokens: ParsedWord[]` with correct
segments for annotated words and `segments: [{text, ruby: null}]` for plain words

**Given** `packages/story-loader/src/v1.ts`
**When** reviewed
**Then** produces `tokens: ParsedWord[]` for each sentence by converting each `words[i]` /
`ruby[i]` pair into `{ surface: words[i], segments: [{ text: words[i], ruby: ruby[i] ?? null }] }`;
the `words` and `ruby` fields no longer appear in the returned `SentenceModel`

**Given** all existing v1 test fixtures
**When** `turbo test:unit` runs against the updated v1 loader
**Then** all prior test cases pass; `StoryModel.sentences[n].tokens` is populated correctly;
no test references `sentence.words` or `sentence.ruby` directly

**Given** a v1 sentence with mismatched parallel array lengths
**When** `loadStory()` is called
**Then** still throws `LoaderError('SCHEMA_INVALID', ...)` identifying the offending sentence —
the length-check in `v1.ts` is preserved

**Given** `turbo typecheck`
**When** run after this story
**Then** exits 0 for `packages/story-loader`; type errors in `apps/web` are expected until se1-4

---

### Story se1-4: Reader UI — Per-Segment Furigana Rendering

As a **reader**,
I want furigana to appear only above the kanji portions of words,
So that the app follows standard Japanese publishing practice and okurigana is displayed
without annotation.

**Acceptance Criteria:**

**Given** `WordToken.tsx` receives a `token: ParsedWord` with segments
`[{ text: "食", ruby: "た" }, { text: "べる", ruby: null }]`
**When** rendered with `rubyVisible: true`
**Then** outputs `<ruby>食<rt>た</rt></ruby>べる` — `た` above `食` only, `べる` bare

**Given** `WordToken.tsx` with `rubyVisible: false`
**When** rendered
**Then** `<rt>` elements have class `invisible` (CSS `visibility: hidden`); `display: none`
is never used; line height is identical regardless of toggle state

**Given** a token where all segments have `ruby: null`
**When** rendered
**Then** no `<rt>` elements are present in the output; the word renders as plain text spans

**Given** `SentenceBlock.tsx`
**When** reviewed
**Then** maps over `sentence.tokens: ParsedWord[]` to render `WordToken` components; no
parallel-array zip code (`sentence.words[i]` + `sentence.ruby[i]`) remains anywhere
in the component

**Given** a v1 story loaded via the shim (single-segment tokens)
**When** rendered
**Then** output is visually identical to the pre-rework rendering — whole-word annotations
continue to span the full word as before

**Given** `WordToken.test.tsx` and `SentenceBlock.test.tsx`
**When** run
**Then** all prior ACs from Story 2.3 pass; new ACs added and passing: per-segment ruby
rendering for each of the four annotation patterns; plain segments render without `<rt>`;
ruby toggle uses `invisible` not `display:none`

**Given** `turbo typecheck`
**When** run after this story
**Then** exits 0 across all packages and apps

---

### Story se1-5: Story Generator Backend — v2 Output Format

As a **story generator**,
I want the backend agent to produce `story.v2.json`-compliant output with inline furigana
annotations,
So that newly generated stories use per-kanji furigana from the start.

**Acceptance Criteria:**

**Given** `apps/story-generator-backend/agent.py` system prompt
**When** reviewed
**Then** instructs the model to produce `schema_version: "2"`; describes the `漢字[よみ]`
inline annotation format; includes worked examples covering all four annotation patterns
(jukujikun, kanji block + okurigana, separate kanji with interleaved kana, single kanji);
makes no mention of a `ruby` parallel array

**Given** the system prompt constraint on `vocab_keys`
**When** reviewed
**Then** still requires `words` and `vocab_keys` arrays of equal length per sentence;
the removed `ruby` array length constraint is no longer mentioned

**Given** `apps/story-generator-backend/validator.py`
**When** reviewed
**Then** validates each word string for well-formed bracket syntax (a `[` must be matched
by a `]` and must follow at least one kanji character); the parallel ruby-array length
check is removed; `words` / `vocab_keys` length check is preserved

**Given** a story generated by the updated agent
**When** inspected
**Then** has `schema_version: "2"`; `words` entries use inline `漢字[よみ]` annotations
where furigana is appropriate; no `ruby` field is present

**Given** `test_validator.py`
**When** run
**Then** covers: well-formed annotated word passes; malformed bracket (unclosed) fails with
a clear message; unannotated plain word passes; empty string handled gracefully

**Given** `test_agent.py` mock fixtures
**When** updated and run
**Then** mock output uses v2 format; all existing test cases that checked v1 format are
updated to v2 equivalents and pass

**Given** `test_contract.py`
**When** run
**Then** validates generated output against `story.v2.json`; exits 0

---

### Story se1-6: Story Generator Frontend — v2 Compatibility

As a **developer**,
I want the story generator frontend to be compatible with v2 story output,
So that the authoring tool correctly handles, displays, and validates generated stories
after the generator backend switches to v2 format.

**Acceptance Criteria:**

**Given** `apps/story-generator` source code
**When** audited for `ruby` field references
**Then** no component or utility directly reads, writes, or renders a `ruby` field; any
such code is removed or updated

**Given** the story preview in the authoring tool (if it uses `@nihonnohon/story-loader`)
**When** `story-loader` is updated (se1-3)
**Then** the preview renders v2 stories correctly with no changes required to the frontend
preview component

**Given** any client-side validation in `apps/story-generator` that checks parallel array
lengths for `ruby`
**When** reviewed
**Then** the ruby-length check is removed; `words` / `vocab_keys` length parity check is
preserved if present

**Given** `turbo typecheck` for `apps/story-generator`
**When** run
**Then** exits 0 with no errors related to the schema or type changes

**Given** the end-to-end authoring flow (generate → display → download)
**When** exercised with the updated backend
**Then** a generated v2 story downloads as valid JSON; `loadStory()` accepts it without
error; no regression in the output panel or download flow

---

### Story se1-7: Migrate Existing Story Files to v2

As a **developer**,
I want all committed story JSON files converted to v2 format,
So that the codebase has a single consistent format and the v1 shim can be considered for
removal.

**Acceptance Criteria:**

**Given** a migration script (location: `packages/story-loader/scripts/migrate-to-v2.ts`
or a standalone Node script)
**When** run against `apps/web/public/stories/*.json`
**Then** each file is rewritten with `schema_version: "2"`; `words` entries are updated to
include inline annotations derived from the original `ruby` values; the `ruby` field is
removed from every sentence object; all other fields are unchanged

**Given** a v1 source entry `{ words: ["学生"], ruby: ["がくせい"] }`
**When** migrated
**Then** output is `{ words: ["学生[がくせい]"] }` — the whole-word reading becomes a
whole-word inline annotation

**Given** a v1 source entry `{ words: ["は"], ruby: [null] }`
**When** migrated
**Then** output is `{ words: ["は"] }` — null ruby produces a plain string, no brackets

**Given** all migrated story files
**When** loaded via `loadStory()`
**Then** each returns a valid `StoryModel` without error; `turbo test:unit` exits 0

**Given** the reader app rendering migrated stories
**When** compared to the pre-migration rendering of the same stories
**Then** output is visually identical — whole-word annotations render identically via the
single-segment path in `WordToken`

**Given** `apps/web/public/stories/manifest.json`
**When** reviewed after migration
**Then** is unchanged; no structural changes to manifest entries are needed

**Given** the migration script completing successfully
**When** the team reviews the v1 shim in `packages/story-loader/src/v1.ts`
**Then** a decision is documented (in a code comment or follow-up ADR amendment) on whether
the v1 shim is retained for externally-sourced stories or marked for removal

---

## Risks and Notes

- **Gemini prompt sensitivity:** The story generator backend relies on an LLM to produce
  structured output. Story se1-5 must include prompt-engineering iteration to verify the
  model reliably produces well-formed `漢字[よみ]` annotations across varied vocabulary
  before the story is merged.

- **Migration is lossy in one direction:** Migrated v1 stories produce whole-word
  annotations (e.g. `"学生[がくせい]"`), not per-kanji splits. Rendering is identical;
  the data is just not maximally precise. True per-kanji annotations only appear in
  newly generated v2 stories.

- **`vocabKeys` parallel array remains:** This array still runs parallel to `tokens[]`
  after the rework. The sync concern is reduced (vocab linkage is explicit and semantic)
  but not fully eliminated.

- **Reference document:** A comprehensive reference document on Japanese text handling
  standards and conventions is to be written to `resources/` as a companion to this work.
