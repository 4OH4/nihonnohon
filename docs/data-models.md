---
generated: 2026-05-13
scan_level: deep
---

# Data Models

All data types used by the nihonnohon system. TypeScript types live in `packages/schema/src/types.ts`; the story wire format is defined by `packages/schema/schemas/story.v1.json`.

---

## Story Format — Wire vs Model

The system uses two representations of a story:

| Layer | Format | Location |
|-------|--------|----------|
| **Wire** (JSON on disk / network) | `snake_case` fields | `story.v1.json` schema |
| **Model** (runtime TypeScript) | `camelCase` fields | `packages/schema/src/types.ts` |

The transform happens **exclusively** in `packages/story-loader/src/v1.ts`. No other code should handle wire-format fields.

---

## TypeScript Interfaces

### `StoryModel`

The in-memory representation of a loaded story.

```typescript
interface StoryModel {
  schemaVersion: string          // "1" (string, not integer)
  id: string                     // unique story identifier
  title: string                  // English title
  titleJa: string                // Japanese title (wire: title_ja)
  language: string               // e.g. "Japanese"
  difficulty: string | null      // e.g. "Genki I Ch.6" — null if unset
  description: string
  keywords: VocabSupplementEntry[]      // story-specific vocabulary shown first
  grammar: string[]              // story-level grammar point descriptions
  vocabSupplement: VocabSupplementEntry[] // additional story vocab (wire: vocab_supplement)
  sentences: SentenceModel[]
  metadata: Record<string, unknown>
}
```

### `SentenceModel`

One sentence in a story. All parallel arrays (`words`, `ruby`, `vocabKeys`) have equal length — guaranteed by the loader.

```typescript
interface SentenceModel {
  id: string
  words: string[]                     // Japanese word tokens
  ruby: (string | null)[]             // furigana per token; null = no reading
  vocabKeys: (number | null)[]        // VocabEntry.id per token; null = no entry
  translation: string | null          // English translation; null = not provided
  grammar: number[]                   // indices into StoryModel.grammar[]
  audioUrl?: string                   // stored but not played in v1
}
```

> **Critical:** `SentenceModel.grammar` is `number[]` (indices into `StoryModel.grammar`). `StoryModel.grammar` is `string[]` (the actual text). Never mix them up.

### `VocabEntry`

A vocabulary entry from the built-in `vocab.json` dictionary.

```typescript
interface VocabEntry {
  id: number        // permanent, never reused; keys the vocab Map
  word: string
  reading: string   // hiragana reading
  meaning: string
  lesson: string    // e.g. "Genki I Ch.6"
  notes?: string
}
```

### `KanjiEntry`

A kanji entry from `kanji-data.json` (sourced from kanjiapi.dev / KANJIDIC2).

```typescript
interface KanjiEntry {
  char: string
  kw: string | null   // Heisig keyword — shown as label in KanjiBreakdown
  m: string[]         // full dictionary meanings — shown in detail view
  onY: string[]       // on'yomi readings
  kunY: string[]      // kun'yomi readings
}
```

> **Critical:** `kw` is the short Heisig keyword (UI label). `m` is the full meanings array (detail). Never treat them interchangeably.

### `VocabSupplementEntry`

A story-specific vocabulary entry (keywords and vocab_supplement in the story JSON).

```typescript
interface VocabSupplementEntry {
  word: string
  hiragana: string
  translation: string
}
```

### `LookupState`

Discriminated union tracking word lookup state in the lookup store.

```typescript
type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
```

Always switch on `.status` before accessing `.entry` or `.word`.

### `ManifestEntry`

One entry in `public/stories/manifest.json`.

```typescript
interface ManifestEntry {
  id: string              // matches the story JSON's `id` field (used as route param)
  filename: string        // e.g. "genki-i-ch6-tanaka-letter.json"
  title: string
  titleJa: string
  difficulty?: string | null   // e.g. "Genki I Ch.6"
  language: string
  description: string
}
```

---

## Story JSON Schema (wire format)

**File:** `packages/schema/schemas/story.v1.json` — JSON Schema Draft-07

### Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | `string` | Must be `"1"` (string-as-integer) |
| `id` | `string` | Unique story ID |
| `title` | `string` | English title |
| `title_ja` | `string` | Japanese title |
| `language` | `string` | e.g. `"Japanese"` |
| `description` | `string` | Short synopsis |
| `sentences` | `sentence[]` | At least 1 sentence required |

### Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `difficulty` | `string \| null` | e.g. `"Genki I Ch.6"` |
| `keywords` | `vocabEntry[]` | Story-specific key vocab |
| `grammar` | `string[]` | Grammar point descriptions |
| `vocab_supplement` | `vocabEntry[]` | Additional vocab entries |
| `metadata` | `object` | Arbitrary extension data |

### `sentence` object

| Field | Required | Type | Notes |
|-------|---------|------|-------|
| `id` | ✓ | `string` | Unique within the story |
| `words` | ✓ | `string[]` | Min 1 token |
| `ruby` | — | `(string \| null)[]` | Must match `words` length |
| `vocab_keys` | — | `(integer \| null)[]` | Must match `words` length; references `VocabEntry.id` |
| `translation` | — | `string` | English translation |
| `grammar` | — | `integer[]` | Indices into the story's `grammar` array |
| `audio_url` | — | `string` | Stored but not used in v1 |

### `vocabEntry` object

| Field | Required | Type |
|-------|---------|------|
| `word` | ✓ | `string` |
| `hiragana` | ✓ | `string` |
| `translation` | ✓ | `string` |

> **Constraint:** `additionalProperties: false` at every object node. Unknown fields cause validation failure.

---

## Runtime Data Stores

### `vocab.json`

Served from `public/vocab.json`. Loaded once at reader startup into `Map<number, VocabEntry>` keyed by `VocabEntry.id`.

### `kanji-data.json`

Served from `public/kanji-data.json`. Loaded once into `Map<string, KanjiEntry>` keyed by the literal kanji character (e.g. `"食"`).

### IndexedDB — `nihonnohon-local-stories`

| Store | Key | Value |
|-------|-----|-------|
| `stories` | UUID (string) | Raw story JSON (unknown) |

Used for locally uploaded stories. UUID generated by `crypto.randomUUID()` at upload time and used as the route param.

---

## Schema Versioning

| Version | Loader | Notes |
|---------|--------|-------|
| `"1"` | `packages/story-loader/src/v1.ts` | Current version |

Adding a new version requires a new loader file (`v2.ts`) registered in the `LOADERS` map in `index.ts`. If/else chains are explicitly prohibited. See `SCHEMA_CHANGELOG.md` for change history.
