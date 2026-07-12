# ADR 005: Inline Furigana Annotation Format for story.v2.json

**Status:** Accepted
**Date:** 2026-06-04

## Context

Story JSON files use a parallel `ruby` array to associate furigana (phonetic readings) with
words. Each sentence carries a `words: string[]` and an optional `ruby: (string | null)[]`
of equal length, where `ruby[i]` is the reading for `words[i]` or `null` if no annotation
is needed.

This design has two problems:

**1. Word-level granularity is incorrect by Japanese publishing standards.**
Standard practice places furigana only above the kanji portion of a word, leaving okurigana
(trailing hiragana) unannotated. The current scheme wraps the entire word string in a single
`<ruby>/<rt>` pair, so a word like `食べる` would display `たべる` above the full string
instead of `た` above `食` only.

**2. The parallel array is a synchronisation footgun.**
Every insertion, deletion, or reorder of `words` must be mirrored exactly in `ruby` and
`vocab_keys`. A mismatch shifts all annotations silently; the loader catches length errors
but only after the fact.

### Four annotation patterns that must be supported

Japanese furigana has four structurally distinct cases, all of which must be representable:

| Pattern | Example | Description |
|---|---|---|
| Jukujikun (whole-word) | `大人` → `おとな` | Reading spans multiple kanji; cannot be split |
| Kanji block + okurigana | `肌寒い` → `はだざむ` over `肌寒` | Block of kanji shares a reading; trailing kana unannotated |
| Separate kanji, interleaved kana | `付け加える` → `つ` over `付`, `くわ` over `加` | Each kanji annotated independently; kana between them bare |
| Single kanji | `私` → `わたし` | Standard single-kanji reading |

### Options considered

**Option A — Per-kanji segment objects on token objects**
Replace `words[]` + `ruby[]` with `tokens: [{surface, segments: [{text, ruby}]}]`.
Explicit and type-safe. Larger schema change; not a widely standardised wire format.

**Option B — Annotated ruby strings (keep parallel arrays)**
Keep the parallel structure but replace whole-word strings like `"がくせい"` with
per-kanji annotated strings like `"学[がく]生[せい]"` in the `ruby` array.
Conservative change; retains the parallel-array sync problem.

**Option C — Inline annotation in the `words` array**
Embed furigana directly in word strings using `漢字[よみ]` syntax; drop the `ruby` array
entirely. Each `[読み]` bracket attaches to the contiguous kanji block immediately preceding
it — unannotated kana is left as plain text. Compact; eliminates the parallel array.

## Decision

Adopt **Option C** with a bump to `schema_version: "2"`.

The `漢字[よみ]` inline syntax handles all four annotation patterns unambiguously:

```
大人[おとな]         → whole-word: bracket after full kanji block
肌寒[はだざむ]い     → kanji block + okurigana: bracket after kanji, kana outside
付[つ]け加[くわ]える → separate kanji: bracket after each individual kanji
私[わたし]           → single kanji: bracket after the single character
は                   → no annotation: plain string, no bracket
```

The parsing rule is mechanical: scan left to right; collect a run of kanji characters;
if immediately followed by `[`, consume to `]` as the reading; otherwise those kanji are
unannotated. Non-kanji characters between brackets become bare segments.

The `story.v2.json` JSON Schema drops the `ruby` field from sentence objects. Words with
no furigana are plain strings; words with furigana embed the annotation inline.

### Internal representation

The story loader (`packages/story-loader`) parses inline annotations at load time — once,
at the schema boundary — into typed `ParsedWord` token objects:

```typescript
interface WordSegment { text: string; ruby: string | null }
interface ParsedWord  { surface: string; segments: WordSegment[] }
```

`SentenceModel.tokens: ParsedWord[]` replaces the parallel `words[]` + `ruby[]` arrays.
`surface` always contains clean plain text for search and non-rendering uses. Components
iterate `segments` to produce per-kanji `<ruby>/<rt>` output.

### Backward compatibility

The v1 loader is updated to emit `ParsedWord` tokens by treating each existing whole-word
ruby string as a single segment. V1 stories render identically to their current appearance
without migration. A migration script converts all committed v1 story files to v2 in place.

## Consequences

- **Correct furigana placement:** Per-kanji `<ruby>/<rt>` output matches standard Japanese
  publishing practice; okurigana is no longer annotated.
- **Parallel array eliminated:** Word annotations travel with the word; no sync footgun.
- **`surface` always available:** Downstream code that needs plain text never needs to parse
  word strings.
- **Parser required in the loader:** `parseInlineRuby()` adds a small parsing step at load
  time; all render-path consumers receive pre-parsed typed data.
- **Story generator prompt updated:** `apps/story-generator-backend/agent.py` must be
  updated to produce v2 format with inline annotations instead of a parallel `ruby` array.
- **V1 stories are backward-compatible** via a shim in the v1 loader; migration to v2 is
  a one-time script operation, not a hard cutover.
- **`SCHEMA_CHANGELOG.md`** must document version `"2"` with the field changes.
