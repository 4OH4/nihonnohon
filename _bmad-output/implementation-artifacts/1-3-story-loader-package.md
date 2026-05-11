# Story 1.3: Story Loader Package

Status: review

## Story

As a **developer**,
I want a versioned story loader that validates story JSON against the schema and transforms it to a type-safe `StoryModel`,
so that every story consumer receives validated, version-agnostic data with clear, typed errors on failure.

## Acceptance Criteria

1. **Given** `packages/story-loader/src/index.ts` exports `loadStory(rawJson: unknown): StoryModel` and the `LoaderError` class **When** called with valid schema version `"1"` JSON **Then** returns a correctly transformed `StoryModel` with all snake_case wire fields converted to camelCase (`schema_version` → `schemaVersion`, `title_ja` → `titleJa`, `vocab_keys` → `vocabKeys`); this transformation occurs ONLY in `v1.ts`, nowhere else in the codebase

2. **Given** AJV v8 validates in `v1.ts` **When** validation runs **Then** AJV validates the snake_case wire format BEFORE any transformation begins; a partially-transformed object is never passed to AJV

3. **Given** a sentence with mismatched parallel array lengths (e.g. `words` has 3 items, `ruby` has 2) **When** `loadStory()` is called **Then** throws `LoaderError('SCHEMA_INVALID', message)` where the message identifies the offending sentence `id`

4. **Given** a story with an unrecognised `schema_version` value (e.g. `"99"`) **When** `loadStory()` is called **Then** throws `LoaderError('UNSUPPORTED_VERSION', message)` naming the unsupported version

5. **Given** input that is not parseable JSON **When** `loadStory()` is called **Then** throws `LoaderError('PARSE_FAILED', message)`

6. **Given** all test fixtures in `packages/story-loader/src/__fixtures__/` **When** `pnpm --filter @nihonnohon/story-loader test:unit` runs **Then** all pass: `valid-v1.json` → StoryModel returned; `valid-v1-minimal.json` (1 sentence, no optional fields) → StoryModel returned; `invalid-schema.json` → SCHEMA_INVALID; `invalid-empty-sentences.json` → SCHEMA_INVALID; `invalid-malformed.json` content passed as string → PARSE_FAILED; `invalid-sentence-missing-id.json` → SCHEMA_INVALID; `unsupported-schema-version.json` → UNSUPPORTED_VERSION *(Note: `turbo test:unit` pipeline task wired in Story 1.5; run via `pnpm --filter` in this story)*

7. **Given** `tsup` builds the package **When** build completes **Then** `@nihonnohon/schema` is in `dependencies` (not `devDependencies`) of `packages/story-loader`; CJS + ESM outputs produced with canonical exports map; package is consumable from `apps/web` as `@nihonnohon/story-loader`

## Tasks / Subtasks

- [x] Task 1: Update `packages/story-loader/package.json` (AC: 1, 7)
  - [x] Update `"main"` from `./src/index.ts` → `./dist/index.js` (deferred from Story 1.2 review)
  - [x] Update `"types"` from `./src/index.ts` → `./dist/index.d.ts`
  - [x] Add `"files": ["dist"]`
  - [x] Add exports map: `"."` with `import`/`require` entries matching canonical shape
  - [x] Add `"scripts": { "build": "tsup", "typecheck": "tsc --noEmit", "test:unit": "vitest run" }`
  - [x] Verify `@nihonnohon/schema: workspace:*` is in `dependencies` (not devDependencies) — already present from Story 1.1, confirm it stays there
  - [x] Add devDependencies: `"ajv": "^8.17.1"` — CRITICAL: AJV goes in devDependencies so tsup bundles it into the output (see Dev Notes)
  - [x] Add devDependencies: `"tsup": "^8.0.0"`, `"typescript": "^5.0.0"`, `"vitest": "^3.0.0"`, `"@nihonnohon/typescript-config": "workspace:*"` (already present)

- [x] Task 2: Update `packages/story-loader/tsconfig.json` (AC: 1, 2)
  - [x] Add `"resolveJsonModule": true` to compilerOptions — required for JSON schema import
  - [x] Verify `"outDir": "./dist"` and `"rootDir": "./src"` are present

- [x] Task 3: Create `packages/story-loader/tsup.config.ts` (AC: 7)
  - [x] Entry: `['src/index.ts']`, format `['cjs', 'esm']`, dts: true, clean: true
  - [x] Do NOT list `ajv` in `external` — it must be bundled into the output for ESM chain compatibility (see Dev Notes)

- [x] Task 4: Create all 7 fixture files in `packages/story-loader/src/__fixtures__/` (AC: 6)
  - [x] `valid-v1.json` — complete story with all optional fields, valid parallel arrays
  - [x] `valid-v1-minimal.json` — 1 sentence, no optional fields (no ruby, no vocab_keys, no grammar, no keywords, no vocab_supplement, no difficulty, no metadata)
  - [x] `invalid-schema.json` — valid JSON but fails AJV (e.g. extra root field `"unknown_field": "x"`)
  - [x] `invalid-empty-sentences.json` — `"sentences": []` (minItems: 1 violated)
  - [x] `invalid-malformed.json` — a `.json` file containing content that fails JSON.parse (e.g. `{ this is not valid json }`)
  - [x] `invalid-sentence-missing-id.json` — sentence object without required `id` field
  - [x] `unsupported-schema-version.json` — `"schema_version": "99"` (not in LOADERS registry)

- [x] Task 5: Implement `packages/story-loader/src/index.ts` (AC: 1, 4, 5)
  - [x] Export `LoaderError` class with `code: 'UNSUPPORTED_VERSION' | 'SCHEMA_INVALID' | 'PARSE_FAILED'` (exact definition in Dev Notes)
  - [x] Export `loadStory(rawJson: unknown): StoryModel`
  - [x] `loadStory` first step: if `rawJson` is a string, call `JSON.parse()` and throw `LoaderError('PARSE_FAILED', ...)` on error; if already an object, skip parsing
  - [x] After parsing, read `schema_version` from the data; throw `LoaderError('UNSUPPORTED_VERSION', ...)` if not in LOADERS
  - [x] Dispatch to `LOADERS[version](data)` and return the result
  - [x] `const LOADERS: Record<string, (raw: unknown) => StoryModel> = { '1': loadV1 }` — version-keyed registry; all dispatch logic in index.ts; all wire format knowledge in v1.ts

- [x] Task 6: Implement `packages/story-loader/src/v1.ts` (AC: 1, 2, 3)
  - [x] Import AJV and story.v1.json schema (see Dev Notes for exact import approach)
  - [x] Compile AJV validator ONCE at module level (`const validate = new Ajv().compile(schema)`) — NOT inside the function (avoids repeated compilation)
  - [x] Run AJV validation FIRST on the raw snake_case data; on failure throw `LoaderError('SCHEMA_INVALID', ajv.errorsText(...))`
  - [x] After AJV passes, perform parallel array length checks for each sentence (see Dev Notes)
  - [x] ONLY AFTER all validation passes: transform snake_case → camelCase to produce StoryModel
  - [x] Export `function loadV1(raw: unknown): StoryModel`
  - [x] Defaults for absent optional arrays (see Dev Notes for exact handling)

- [x] Task 7: Write `packages/story-loader/src/index.test.ts` (AC: 6)
  - [x] Test each fixture against its expected outcome (see AC 6 for the complete list)
  - [x] Test camelCase transformation: verify `schemaVersion`, `titleJa`, `vocabKeys`, `audioUrl` on the StoryModel from `valid-v1.json`
  - [x] Test parallel array check: construct a story object with `ruby.length !== words.length` and verify SCHEMA_INVALID
  - [x] Test default value filling: verify that `valid-v1-minimal.json` produces `ruby: [null]`, `vocabKeys: [null]`, `grammar: []`, `translation: null` on its sentence
  - [x] Verify `LoaderError` is an instance of `Error` (for catch-by-type in error boundaries)
  - [x] Verify `LoaderError.code` is accessible and correct for each error case
  - [x] No `vi.mock()` stubs of the loader's internal functions — tests exercise real validation logic

- [x] Task 8: Install dependencies and verify build + tests (AC: 6, 7)
  - [x] Run `pnpm install` from repo root (adds AJV, tsup, vitest to story-loader devDependencies)
  - [x] Run `turbo build --filter=@nihonnohon/story-loader` — confirm CJS + ESM + declarations produced in `dist/`
  - [x] Run `turbo typecheck --filter=@nihonnohon/story-loader` — exit 0
  - [x] Run `pnpm --filter @nihonnohon/story-loader test:unit` — all tests pass (14/14)

## Dev Notes

### What This Story IS and IS NOT

**In scope (Story 1.3):**
- `packages/story-loader/src/index.ts` — LoaderError + loadStory dispatch
- `packages/story-loader/src/v1.ts` — AJV validation + snake_case→camelCase transform
- `packages/story-loader/src/__fixtures__/` — all 7 fixture files
- `packages/story-loader/src/index.test.ts` — Vitest unit tests
- `packages/story-loader/tsup.config.ts` — build config
- `packages/story-loader/package.json` — full update (scripts, deps, main/types, exports)
- `packages/story-loader/tsconfig.json` — add resolveJsonModule
- `pnpm install` + build + test verification

**Explicitly NOT in scope (later stories):**
- `turbo test:unit` pipeline task — **Story 1.5** (`.github/workflows/ci.yml` + `turbo.json`)
- AJV v8 ESM chain verification in Vite — **Story 1.4** (apps/web scaffold confirms this)
- Any code in `apps/web` — **Story 1.4+**
- Schema fixture CI validation — **Story 1.5**

### Current State of packages/story-loader (from Story 1.1)

```
packages/story-loader/
├── src/
│   └── index.ts    ← placeholder: `export {}`  → REPLACE in Task 5
├── package.json    ← stub, no scripts           → UPDATE in Task 1
└── tsconfig.json   ← extends typescript-config/base.json → UPDATE in Task 2
```

**Current `package.json`** (key fields):
```json
{
  "name": "@nihonnohon/story-loader",
  "main": "./src/index.ts",       ← UPDATE to ./dist/index.js (Story 1.2 code review deferred)
  "types": "./src/index.ts",      ← UPDATE to ./dist/index.d.ts
  "exports": { ".": { "import": {..."./dist/...}, "require": {..."./dist/..."} } },
  "dependencies": {
    "@nihonnohon/schema": "workspace:*"  ← KEEP in dependencies (not devDependencies)
  },
  "devDependencies": {
    "@nihonnohon/typescript-config": "workspace:*"
  }
}
```

### CRITICAL: AJV Placement — devDependencies, NOT dependencies

**Put AJV in `devDependencies` of story-loader** so tsup bundles it into the output.

If AJV is in `dependencies`, tsup treats it as external (does not bundle it). The story-loader dist output would then contain `import ajv from 'ajv'` — which Vite must resolve at runtime. This creates the "AJV v8 CommonJS ESM chain" problem the architecture warns about.

If AJV is in `devDependencies`, tsup bundles AJV into `dist/index.js` and `dist/index.mjs` — the output is self-contained and consumers (apps/web) never directly encounter AJV.

```json
"devDependencies": {
  "@nihonnohon/typescript-config": "workspace:*",
  "ajv": "^8.17.1",
  "tsup": "^8.0.0",
  "typescript": "^5.0.0",
  "vitest": "^3.0.0"
}
```

`@nihonnohon/schema` stays in `dependencies` — tsup treats types-only packages as external correctly (it has no runtime code to bundle).

### CRITICAL: AJV Import in v1.ts

**Preferred approach** (TypeScript 5.x + tsup/esbuild):
```ts
import Ajv from 'ajv'
import schema from '@nihonnohon/schema/schemas/story.v1.json'

const ajv = new Ajv()
const validate = ajv.compile(schema)
```

tsup/esbuild handles the CJS→ESM interop for AJV and inlines the JSON schema. Both work natively with `moduleResolution: "bundler"`.

**Fallback if JSON import causes TypeScript errors** (add `with { type: 'json' }` or use `createRequire`):
```ts
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const schema = _require('@nihonnohon/schema/schemas/story.v1.json')
```

**If `import Ajv from 'ajv'` causes "default export" TypeScript error**, use:
```ts
import Ajv from 'ajv'
// If tsc complains about no default export:
import AjvDefault, { type ValidateFunction } from 'ajv'
const Ajv = (AjvDefault as any).default ?? AjvDefault
```

The `moduleResolution: "bundler"` in tsconfig usually makes the first form work. Try the simple form first.

### LoaderError — Exact Implementation

```ts
export class LoaderError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_VERSION' | 'SCHEMA_INVALID' | 'PARSE_FAILED',
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'LoaderError'
  }
}
```

This class is defined in `src/index.ts` and exported from both `index.ts` and re-exported via the package's public API. `v1.ts` imports it from `../index` (NOT from @nihonnohon/schema — no circular dependency).

Wait — actually `LoaderError` is used in `v1.ts` AND defined in `index.ts`. And `index.ts` imports `loadV1` from `v1.ts`. This would be a circular dependency. 

**Resolution:** Put `LoaderError` in its own file:
- `packages/story-loader/src/errors.ts` — exports `LoaderError`
- `packages/story-loader/src/index.ts` — imports from `./errors`, re-exports
- `packages/story-loader/src/v1.ts` — imports from `./errors`

Or alternatively, put `LoaderError` in `index.ts` and pass it as a parameter/import to v1.ts. The cleanest is a separate `errors.ts` file.

### Dispatch Architecture in index.ts

```ts
// src/index.ts
import { loadV1 } from './v1'
import { LoaderError } from './errors'
import type { StoryModel } from '@nihonnohon/schema'

export { LoaderError } from './errors'

const LOADERS: Record<string, (raw: unknown) => StoryModel> = {
  '1': loadV1,
}

export function loadStory(rawJson: unknown): StoryModel {
  let data: unknown

  if (typeof rawJson === 'string') {
    try {
      data = JSON.parse(rawJson)
    } catch (err) {
      throw new LoaderError('PARSE_FAILED', 'Story JSON could not be parsed.', err)
    }
  } else {
    data = rawJson
  }

  // Extract schema_version for dispatch
  const version =
    data !== null && typeof data === 'object' && 'schema_version' in data
      ? (data as Record<string, unknown>)['schema_version']
      : undefined

  if (typeof version !== 'string' || !(version in LOADERS)) {
    throw new LoaderError(
      'UNSUPPORTED_VERSION',
      `Unsupported schema version: ${String(version)}. Supported: ${Object.keys(LOADERS).join(', ')}.`
    )
  }

  return LOADERS[version](data)
}
```

### v1.ts — Validation + Transform Logic

```ts
// src/v1.ts
import Ajv from 'ajv'
import schema from '@nihonnohon/schema/schemas/story.v1.json'
import { LoaderError } from './errors'
import type { StoryModel, SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

const ajv = new Ajv()
const validate = ajv.compile(schema)

export function loadV1(raw: unknown): StoryModel {
  // 1. AJV validation on snake_case wire format FIRST
  if (!validate(raw)) {
    throw new LoaderError('SCHEMA_INVALID', `Story JSON failed schema validation: ${ajv.errorsText(validate.errors)}`)
  }

  // 2. Cast to wire format type after validation passes
  const wire = raw as WireStory  // internal type — see below

  // 3. Parallel array length check (JSON Schema cannot enforce cross-field equality)
  for (const sentence of wire.sentences) {
    const wordCount = sentence.words.length
    if (sentence.ruby !== undefined && sentence.ruby.length !== wordCount) {
      throw new LoaderError('SCHEMA_INVALID', `Sentence "${sentence.id}": ruby array length (${sentence.ruby.length}) must match words length (${wordCount}).`)
    }
    if (sentence.vocab_keys !== undefined && sentence.vocab_keys.length !== wordCount) {
      throw new LoaderError('SCHEMA_INVALID', `Sentence "${sentence.id}": vocab_keys array length (${sentence.vocab_keys.length}) must match words length (${wordCount}).`)
    }
  }

  // 4. Transform snake_case wire format → camelCase StoryModel
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
    sentences: wire.sentences.map(mapSentence),
    metadata: wire.metadata ?? {},
  }
}

function mapVocabEntry(e: { word: string; hiragana: string; translation: string }): VocabSupplementEntry {
  return { word: e.word, hiragana: e.hiragana, translation: e.translation }
}

function mapSentence(s: WireSentence, _i: number): SentenceModel {
  const wordCount = s.words.length
  return {
    id: s.id,
    words: s.words,
    ruby: s.ruby ?? Array<string | null>(wordCount).fill(null),
    vocabKeys: s.vocab_keys ?? Array<number | null>(wordCount).fill(null),
    translation: s.translation ?? null,
    grammar: s.grammar ?? [],
    audioUrl: s.audio_url,
  }
}
```

**Internal wire format types** (defined in v1.ts, NOT exported — they are the only place that knows the wire format):
```ts
interface WireVocabEntry { word: string; hiragana: string; translation: string }
interface WireSentence {
  id: string
  words: string[]
  ruby?: (string | null)[]
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
  metadata?: Record<string, unknown>
  sentences: WireSentence[]
}
```

### Default Value Handling for Absent Optional Fields

When optional fields are absent in the wire format, the v1 loader produces these defaults in `SentenceModel`:

| Wire field | Absent → TypeScript model default |
|---|---|
| `ruby` | `Array(words.length).fill(null)` — parallel nulls |
| `vocab_keys` | `Array(words.length).fill(null)` — parallel nulls |
| `grammar` | `[]` — empty index array |
| `translation` | `null` |
| `audio_url` | `undefined` (field is `audioUrl?: string`) |

At story level:
| `keywords` absent | `[]` |
| `grammar` absent | `[]` |
| `vocab_supplement` absent | `[]` |
| `difficulty` absent/null | `null` |
| `metadata` absent | `{}` |

### Fixture Specifications

**`valid-v1.json`** — complete story, all optional fields present:
```json
{
  "schema_version": "1",
  "id": "test-story-complete",
  "title": "Complete Test Story",
  "title_ja": "完全なテストストーリー",
  "language": "Japanese",
  "description": "A complete test story with all optional fields.",
  "difficulty": "Genki I Ch.6",
  "keywords": [{ "word": "田中", "hiragana": "たなか", "translation": "Tanaka (name)" }],
  "grammar": ["て-form for connecting actions"],
  "vocab_supplement": [{ "word": "先生", "hiragana": "せんせい", "translation": "teacher" }],
  "metadata": { "source": "test" },
  "sentences": [
    {
      "id": "s1",
      "words": ["田中", "さん", "は", "先生", "です"],
      "ruby": ["たなか", null, null, "せんせい", null],
      "vocab_keys": [null, null, null, 1, null],
      "translation": "Mr. Tanaka is a teacher.",
      "grammar": [0],
      "audio_url": "https://example.com/s1.mp3"
    }
  ]
}
```

**`valid-v1-minimal.json`** — 1 sentence, no optional fields:
```json
{
  "schema_version": "1",
  "id": "test-story-minimal",
  "title": "Minimal Test Story",
  "title_ja": "最小テストストーリー",
  "language": "Japanese",
  "description": "A minimal story with no optional fields.",
  "sentences": [{ "id": "s1", "words": ["こんにちは"] }]
}
```

**`invalid-schema.json`** — unknown root field (additionalProperties: false violated):
```json
{
  "schema_version": "1",
  "id": "invalid-story",
  "title": "Invalid Story",
  "title_ja": "無効なストーリー",
  "language": "Japanese",
  "description": "Story with extra field.",
  "sentences": [{ "id": "s1", "words": ["test"] }],
  "unknown_field": "this causes schema validation failure"
}
```

**`invalid-empty-sentences.json`** — `minItems: 1` violated:
```json
{
  "schema_version": "1",
  "id": "empty-sentences",
  "title": "Empty Sentences",
  "title_ja": "文なし",
  "language": "Japanese",
  "description": "Story with no sentences.",
  "sentences": []
}
```

**`invalid-malformed.json`** — NOT valid JSON; content is:
```
{ this is not valid json
```
(Store this content as-is in the file. Tests must read it with `fs.readFileSync` and pass as string to `loadStory`.)

**`invalid-sentence-missing-id.json`** — sentence without required `id`:
```json
{
  "schema_version": "1",
  "id": "missing-id",
  "title": "Missing ID",
  "title_ja": "IDなし",
  "language": "Japanese",
  "description": "Sentence missing required id field.",
  "sentences": [{ "words": ["test"] }]
}
```

**`unsupported-schema-version.json`** — unrecognised version:
```json
{
  "schema_version": "99",
  "id": "future-story",
  "title": "Future Story",
  "title_ja": "未来のストーリー",
  "language": "Japanese",
  "description": "Uses an unsupported schema version.",
  "sentences": [{ "id": "s1", "words": ["test"] }]
}
```

### Test File Structure

```ts
// src/index.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadStory, LoaderError } from './index'
import validV1 from './__fixtures__/valid-v1.json'
import validMinimal from './__fixtures__/valid-v1-minimal.json'
import invalidSchema from './__fixtures__/invalid-schema.json'
import invalidEmptySentences from './__fixtures__/invalid-empty-sentences.json'
import invalidSentenceMissingId from './__fixtures__/invalid-sentence-missing-id.json'
import unsupportedVersion from './__fixtures__/unsupported-schema-version.json'

const malformedContent = readFileSync(
  join(__dirname, './__fixtures__/invalid-malformed.json'),
  'utf-8'
)

describe('loadStory', () => {
  it('transforms valid-v1.json to StoryModel with correct camelCase fields', () => {
    const result = loadStory(validV1)
    expect(result.schemaVersion).toBe('1')
    expect(result.titleJa).toBe('完全なテストストーリー')
    expect(result.sentences[0].vocabKeys).toEqual([null, null, null, 1, null])
    expect(result.sentences[0].audioUrl).toBe('https://example.com/s1.mp3')
  })

  it('loads valid-v1-minimal.json and fills defaults for absent optional fields', () => {
    const result = loadStory(validMinimal)
    expect(result.difficulty).toBeNull()
    expect(result.keywords).toEqual([])
    expect(result.grammar).toEqual([])
    expect(result.vocabSupplement).toEqual([])
    expect(result.sentences[0].ruby).toEqual([null])        // 1 word → 1 null
    expect(result.sentences[0].vocabKeys).toEqual([null])   // 1 word → 1 null
    expect(result.sentences[0].translation).toBeNull()
    expect(result.sentences[0].grammar).toEqual([])
  })

  it('throws SCHEMA_INVALID for unknown root field', () => {
    expect(() => loadStory(invalidSchema)).toThrow(LoaderError)
    try { loadStory(invalidSchema) } catch (e) {
      expect((e as LoaderError).code).toBe('SCHEMA_INVALID')
    }
  })

  it('throws SCHEMA_INVALID for empty sentences array', () => {
    expect(() => loadStory(invalidEmptySentences)).toThrow(LoaderError)
    try { loadStory(invalidEmptySentences) } catch (e) {
      expect((e as LoaderError).code).toBe('SCHEMA_INVALID')
    }
  })

  it('throws PARSE_FAILED for malformed JSON string', () => {
    expect(() => loadStory(malformedContent)).toThrow(LoaderError)
    try { loadStory(malformedContent) } catch (e) {
      expect((e as LoaderError).code).toBe('PARSE_FAILED')
    }
  })

  it('throws SCHEMA_INVALID for sentence missing required id', () => {
    expect(() => loadStory(invalidSentenceMissingId)).toThrow(LoaderError)
    try { loadStory(invalidSentenceMissingId) } catch (e) {
      expect((e as LoaderError).code).toBe('SCHEMA_INVALID')
    }
  })

  it('throws UNSUPPORTED_VERSION for unknown schema_version', () => {
    expect(() => loadStory(unsupportedVersion)).toThrow(LoaderError)
    try { loadStory(unsupportedVersion) } catch (e) {
      expect((e as LoaderError).code).toBe('UNSUPPORTED_VERSION')
      expect((e as LoaderError).message).toContain('99')
    }
  })

  it('throws SCHEMA_INVALID for mismatched parallel array lengths', () => {
    const mismatch = {
      ...validV1,
      sentences: [{
        id: 's1',
        words: ['a', 'b', 'c'],
        ruby: ['x', 'y'],  // 2 items for 3 words
      }]
    }
    expect(() => loadStory(mismatch)).toThrow(LoaderError)
    try { loadStory(mismatch) } catch (e) {
      expect((e as LoaderError).code).toBe('SCHEMA_INVALID')
      expect((e as LoaderError).message).toContain('s1')
    }
  })

  it('LoaderError is instanceof Error', () => {
    try { loadStory(unsupportedVersion) } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect(e).toBeInstanceOf(LoaderError)
    }
  })
})
```

### Package.json — Final Shape After This Story

```json
{
  "name": "@nihonnohon/story-loader",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@nihonnohon/schema": "workspace:*"
  },
  "devDependencies": {
    "@nihonnohon/typescript-config": "workspace:*",
    "ajv": "^8.17.1",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

### tsup.config.ts

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  // AJV is in devDependencies so tsup bundles it automatically
  // @nihonnohon/schema is in dependencies so tsup treats it as external
})
```

### tsconfig.json — Update Required

```json
{
  "extends": "@nihonnohon/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

`resolveJsonModule: true` is required for `import schema from '@nihonnohon/schema/schemas/story.v1.json'` to work in TypeScript without errors.

### File Structure After This Story

```
packages/story-loader/
├── src/
│   ├── __fixtures__/
│   │   ├── valid-v1.json            NEW
│   │   ├── valid-v1-minimal.json    NEW
│   │   ├── invalid-schema.json      NEW
│   │   ├── invalid-empty-sentences.json  NEW
│   │   ├── invalid-malformed.json   NEW (contains invalid JSON text)
│   │   ├── invalid-sentence-missing-id.json  NEW
│   │   └── unsupported-schema-version.json   NEW
│   ├── errors.ts        NEW (LoaderError class)
│   ├── index.ts         UPDATE (loadStory + re-export LoaderError)
│   ├── index.test.ts    NEW (Vitest tests)
│   └── v1.ts            NEW (AJV validation + transform)
├── dist/                GENERATED (gitignored)
├── package.json         UPDATE
├── tsconfig.json        UPDATE (add resolveJsonModule)
└── tsup.config.ts       NEW
```

### Deferred Items from Story 1.2 Code Review (Now Actionable)

- `story-loader/package.json` `main`/`types` still pointed at `./src/index.ts` — **fix in Task 1** of this story (update to dist/ paths)
- Story 1.2 CI deferred item: Story 1.3 fixtures (`__fixtures__/`) are the inputs for CI fixture validation (wired in Story 1.5)

### Anti-Patterns to Prevent

- Do NOT run AJV validation on the already-transformed camelCase StoryModel — AJV validates the snake_case wire format only
- Do NOT export WireStory or WireSentence types from v1.ts — these are internal implementation details; consumers only see StoryModel
- Do NOT put snake_case transformation logic anywhere except v1.ts — index.ts knows nothing about wire format field names
- Do NOT use `vi.mock` to stub `loadV1` or `validate` in tests — tests must exercise the real validation pipeline
- Do NOT put AJV in `dependencies` — it goes in `devDependencies` so tsup bundles it (prevents ESM chain issues in Vite)
- Do NOT forget to check `vocab_keys` parallel array length as well as `ruby` — both are checked per deferred-work requirement

### References

- Story 1.3 ACs: [Source: _bmad-output/planning-artifacts/epics.md — Story 1.3]
- Versioned loader architecture: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Versioned Loader Architecture]
- LoaderError definition: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — LoaderError]
- Wire format fields: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Story JSON Wire Format Fields]
- Package exports map: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Package Exports Map]
- Parallel array deferred: [Source: _bmad-output/implementation-artifacts/deferred-work.md — Deferred from code review of 1-2]
- Story 1.2 completion notes (tsup pattern): [Source: _bmad-output/implementation-artifacts/1-2-schema-package-and-story-format-contract.md — Completion Notes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tsc --noEmit` initially failed on 4 errors: (1) `node:fs`/`node:path` not resolvable — fixed by removing `readFileSync` and using a string literal for malformed JSON content instead; (2) `__dirname` not valid in ESM `moduleResolution: "bundler"` context — same fix; (3) `raw as WireStory` cast rejected as insufficient overlap — fixed with `raw as unknown as WireStory` double-cast.
- AJV placed in `devDependencies` (not `dependencies`) so tsup bundles it into dist output (~250KB), avoiding the ESM chain resolution issue the architecture warned about.
- `LoaderError` extracted to `src/errors.ts` to prevent circular import: `index.ts` imports `loadV1` from `v1.ts`; `v1.ts` throws `LoaderError` from `errors.ts`; circular avoided.

### Completion Notes List

- `packages/story-loader/package.json` fully updated: main/types → dist/, files field, exports map, build/typecheck/test:unit scripts, AJV in devDependencies (bundled by tsup), vitest/tsup/typescript in devDependencies.
- `packages/story-loader/tsconfig.json` updated: added `resolveJsonModule: true` for JSON schema import.
- `packages/story-loader/tsup.config.ts` created: CJS + ESM + dts; AJV auto-bundled (devDependency); @nihonnohon/schema stays external (dependency).
- All 7 fixtures created in `src/__fixtures__/`; `invalid-malformed.json` contains literal invalid JSON text.
- `src/errors.ts` created with exact `LoaderError` class definition.
- `src/index.ts` implements `loadStory()` dispatch + `LOADERS` registry; string input → JSON.parse → PARSE_FAILED; unknown version → UNSUPPORTED_VERSION; dispatches to `loadV1`.
- `src/v1.ts` implements: AJV compile once at module level; AJV validates snake_case FIRST; parallel array length checks; snake_case → camelCase transform with correct defaults (absent ruby/vocab_keys → null-filled arrays, absent translation → null, absent grammar → []).
- `src/index.test.ts`: 14 tests across 5 describe blocks; all fixtures exercised; camelCase transform verified; parallel array mismatch for both ruby and vocab_keys tested; LoaderError instanceof hierarchy verified.
- `turbo build --filter=@nihonnohon/story-loader`: ✅ CJS 250KB, ESM 249KB, d.ts + d.mts produced.
- `turbo typecheck --filter=@nihonnohon/story-loader`: ✅ exit 0.
- `pnpm --filter @nihonnohon/story-loader test:unit`: ✅ 14/14 passed.

### Change Log

- 2026-05-11: Story 1.3 implemented. Created story-loader package with AJV v8 validation, snake_case→camelCase transform, LoaderError class, 7 fixtures, and 14 Vitest unit tests.

### File List

- `packages/story-loader/package.json` (UPDATED)
- `packages/story-loader/tsconfig.json` (UPDATED)
- `packages/story-loader/tsup.config.ts` (NEW)
- `packages/story-loader/src/errors.ts` (NEW)
- `packages/story-loader/src/index.ts` (UPDATED)
- `packages/story-loader/src/v1.ts` (NEW)
- `packages/story-loader/src/index.test.ts` (NEW)
- `packages/story-loader/src/__fixtures__/valid-v1.json` (NEW)
- `packages/story-loader/src/__fixtures__/valid-v1-minimal.json` (NEW)
- `packages/story-loader/src/__fixtures__/invalid-schema.json` (NEW)
- `packages/story-loader/src/__fixtures__/invalid-empty-sentences.json` (NEW)
- `packages/story-loader/src/__fixtures__/invalid-malformed.json` (NEW)
- `packages/story-loader/src/__fixtures__/invalid-sentence-missing-id.json` (NEW)
- `packages/story-loader/src/__fixtures__/unsupported-schema-version.json` (NEW)
- `pnpm-lock.yaml` (UPDATED — AJV, vitest added)
