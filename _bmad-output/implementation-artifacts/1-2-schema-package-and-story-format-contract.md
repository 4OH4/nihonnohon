# Story 1.2: Schema Package & Story Format Contract

Status: done

## Story

As a **story author**,
I want a versioned JSON schema (`story.v1.json`) with matching TypeScript types,
so that I can author story files with tooling validation and the app has a published, machine-readable contract it shares with the AI authoring tool.

## Acceptance Criteria

1. **Given** the monorepo is set up with pnpm workspaces **When** `packages/schema` is built via `tsup` **Then** CJS + ESM outputs are produced in `dist/` with the canonical exports map (`import` and `require` entries with `.d.mts`/`.d.ts` types); `@nihonnohon/schema` is importable in `apps/web` with full TypeScript type resolution

2. **Given** `packages/schema/schemas/story.v1.json` exists **When** a valid story fixture is checked against it **Then** validation passes; `"additionalProperties": false` is enforced at every object node; unrecognised fields at root or in nested objects cause validation failure

3. **Given** `story.v1.json` **When** reviewed **Then** root-level required fields are: `schema_version` (string, enum: ["1"]), `id` (string, minLength: 1), `title` (string), `title_ja` (string), `language` (string), `description` (string), `sentences` (array, minItems: 1); optional root fields include: `difficulty` (string|null), `keywords` (array of `{word, hiragana, translation}`), `grammar` (string[]), `vocab_supplement` (array of `{word, hiragana, translation}`), `metadata` (object); each sentence object requires: `id` (string, minLength: 1), `words` (string[], each minLength: 1); optionally: `ruby` (array of string|null), `vocab_keys` (array of integer|null), `translation` (string), `grammar` (integer[] — indices into story grammar array), `audio_url` (string)

4. **Given** `packages/schema/src/types.ts` **When** reviewed **Then** it defines exactly: `StoryModel`, `SentenceModel`, `VocabSupplementEntry`, `VocabEntry`, `KanjiEntry`, and the `LookupState` discriminated union — matching the architecture's canonical definitions; no local redefinition of these types exists anywhere else in the codebase

5. **Given** `SCHEMA_CHANGELOG.md` in `packages/schema/` **When** reviewed **Then** it documents schema version `"1"` with its initial field list; version `"1"` is the only entry

6. **Given** CI runs on a PR **When** the pipeline executes **Then** all story fixture files in `packages/story-loader/src/__fixtures__/` are validated against `story.v1.json`; any fixture that is supposed to be valid passes; any fixture that is supposed to be invalid fails at validation *(Implementation split: fixtures created in Story 1.3; CI pipeline wired in Story 1.5. Story 1.2 delivers the schema; integration follows.)*

## Tasks / Subtasks

- [x] Task 1: Update `packages/schema/package.json` (AC: 1)
  - [x] Add `"scripts": { "build": "tsup", "typecheck": "tsc --noEmit" }` 
  - [x] Update `"main"` from `./src/index.ts` → `./dist/index.js`
  - [x] Update `"types"` from `./src/index.ts` → `./dist/index.d.ts`
  - [x] Add `"files": ["dist", "schemas"]` (controls what's available to consumers; schemas/ exposes story.v1.json directly)
  - [x] Add exports entry for JSON schema: `"./schemas/story.v1.json": "./schemas/story.v1.json"` alongside existing `"."` entry
  - [x] Add `"tsup": "^8.0.0"` and `"typescript": "^5.0.0"` to `devDependencies` (already has `@nihonnohon/typescript-config`)

- [x] Task 2: Create `packages/schema/tsup.config.ts` (AC: 1)
  - [x] Entry: `['src/index.ts']`, format: `['cjs', 'esm']`, dts: true, clean: true
  - [x] No external deps needed (schema has no runtime deps)

- [x] Task 3: Create `packages/schema/schemas/story.v1.json` (AC: 2, 3)
  - [x] JSON Schema Draft-07 (`"$schema": "http://json-schema.org/draft-07/schema#"`)
  - [x] Root object: required fields (`schema_version`, `id`, `title`, `title_ja`, `language`, `description`, `sentences`) + all optional fields + `"additionalProperties": false`
  - [x] `$defs.vocabEntry`: `{word, hiragana, translation}` all required strings + `"additionalProperties": false`
  - [x] `$defs.sentence`: required (`id`, `words`) + optional fields + `"additionalProperties": false`
  - [x] `metadata`: defined with `"type": "object"` + `"additionalProperties": true` (intentionally open bag — only exception to the rule; see Dev Notes)
  - [x] Include `grammar` as optional in sentence objects (integer[] of indices) even though omitted from AC text — required by SentenceModel type definition and Story 4.2 grammar highlighting

- [x] Task 4: Create `packages/schema/src/types.ts` (AC: 4)
  - [x] Define all 6 canonical types exactly as specified in architecture (see Dev Notes for exact definitions)
  - [x] `StoryModel.grammar: string[]` (story-level descriptions) — NOT the same as `SentenceModel.grammar: number[]` (indices)
  - [x] `LookupState` as discriminated union with `status` discriminant field
  - [x] No other file in the codebase should define these types

- [x] Task 5: Update `packages/schema/src/index.ts` (AC: 1, 4)
  - [x] Replace `export {}` placeholder with named exports of all types from `./types`
  - [x] Export everything needed by consumers: `export type { StoryModel, SentenceModel, VocabSupplementEntry, VocabEntry, KanjiEntry, LookupState }`

- [x] Task 6: Create `packages/schema/SCHEMA_CHANGELOG.md` (AC: 5)
  - [x] Document schema version `"1"` with complete initial field list
  - [x] Note: breaking changes bump the version string and require a new loader in story-loader

- [x] Task 7: Install dependencies and verify tsup build (AC: 1)
  - [x] Run `pnpm install` from repo root to pull in tsup and typescript into packages/schema
  - [x] Run `turbo build --filter=@nihonnohon/schema` from repo root
  - [x] Verify `packages/schema/dist/` contains: `index.js`, `index.mjs`, `index.d.ts`, `index.d.mts`
  - [x] Verify `dist/` outputs do not contain runtime code (types-only package → output files will be mostly empty module wrappers)
  - [x] Run `turbo typecheck --filter=@nihonnohon/schema` and confirm exit 0

- [x] Task 8: Verify schema correctness manually (AC: 2, 3)
  - [x] Use Node.js inline script to validate schema structure (AJV not yet installed — Story 1.3 scope)
  - [x] Confirmed `additionalProperties: false` at root, sentence, and vocabEntry nodes
  - [x] Confirmed `metadata` uses `additionalProperties: true` (open bag)
  - [x] Confirmed required fields array, enum constraint on schema_version, integer types for grammar/vocab_keys

### Review Findings (Senior Developer Review — 2026-05-11)

**Outcome:** Changes Requested — 5 patches required before marking done.

#### Patches

- [x] [Review][Patch] Remove corrupted `allowBuilds` block from `pnpm-workspace.yaml` [pnpm-workspace.yaml] — `allowBuilds: esbuild: set this to true or false` is an invalid leftover from cancelled interactive `pnpm approve-builds`; remove the block entirely (build approval handled by `package.json` `pnpm.onlyBuiltDependencies`)
- [x] [Review][Patch] Add `"minItems": 1` to `sentence.words` array in `story.v1.json` [packages/schema/schemas/story.v1.json] — empty `words: []` sentence passes schema validation; semantically invalid and will break renderers
- [x] [Review][Patch] Add `"minimum": 0` to `sentence.grammar` integer items in `story.v1.json` [packages/schema/schemas/story.v1.json] — negative grammar indices are nonsensical and pass schema validation silently
- [x] [Review][Patch] Add `"minimum": 0` to `vocab_keys` integer items in `story.v1.json` [packages/schema/schemas/story.v1.json] — negative vocab key IDs are nonsensical
- [x] [Review][Patch] Add `"minLength": 1` to `title`, `title_ja`, `language`, `description` in `story.v1.json` root properties [packages/schema/schemas/story.v1.json] — required string fields currently accept empty string `""`; `id` already has `minLength: 1`

#### Defers

- [x] [Review][Defer] `story-loader/package.json` `main`/`types` still point at `./src/index.ts` [packages/story-loader/package.json] — deferred, Story 1.3 scope (same class of fix already applied to schema package)
- [x] [Review][Defer] `apps/web` has no declared `@nihonnohon/schema` workspace dependency [apps/web/package.json] — deferred, Story 1.4 scope (apps/web scaffold not yet created)
- [x] [Review][Defer] `audio_url` has no URI format validation in JSON Schema [packages/schema/schemas/story.v1.json] — deferred, audio playback is explicitly out of scope for v1
- [x] [Review][Defer] No `sourcemap: true` in tsup config [packages/schema/tsup.config.ts] — deferred, optional enhancement; not required by spec
- [x] [Review][Defer] `ruby`/`words` parallel array length not enforced in JSON Schema [packages/schema/schemas/story.v1.json] — deferred, JSON Schema Draft-07 cannot enforce cross-field array equality; story-loader (Story 1.3) validates this

## Dev Notes

### What This Story IS and IS NOT

**In scope (Story 1.2):**
- `packages/schema/schemas/story.v1.json` — the JSON Schema source of truth
- `packages/schema/src/types.ts` — canonical TypeScript types (all 6 types)
- `packages/schema/src/index.ts` — updated to export all types
- `packages/schema/tsup.config.ts` — tsup build config
- `packages/schema/package.json` — add tsup/typescript devDeps + build script + files field
- `packages/schema/SCHEMA_CHANGELOG.md` — v1 entry
- Working `turbo build` for @nihonnohon/schema producing CJS + ESM + declarations

**Explicitly NOT in scope (later stories):**
- AJV validation code — **Story 1.3** (`packages/story-loader/src/v1.ts`)
- Story fixture files — **Story 1.3** (`packages/story-loader/src/__fixtures__/`)
- CI pipeline wiring for fixture validation — **Story 1.5** (`.github/workflows/ci.yml`)
- `apps/web` TypeScript integration — **Story 1.4** (Vite setup needed first)
- `@nihonnohon/story-loader` implementation — **Story 1.3**

### Current State of packages/schema (from Story 1.1)

The package stub from Story 1.1 already has the correct shape. Review before touching:

```
packages/schema/
├── src/
│   └── index.ts    ← placeholder: `export {}`  → UPDATE in Task 5
├── package.json    ← stub, no build scripts    → UPDATE in Task 1
└── tsconfig.json   ← extends typescript-config/base.json; correct as-is
```

**Current `package.json`** (abridged):
```json
{
  "name": "@nihonnohon/schema",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",        ← UPDATE to ./dist/index.js
  "types": "./src/index.ts",       ← UPDATE to ./dist/index.d.ts
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    }
  },
  "devDependencies": {
    "@nihonnohon/typescript-config": "workspace:*"
  }
}
```

The `exports` map is already correct — it just doesn't have `dist/` files yet. Task 1 also adds the `"./schemas/story.v1.json"` entry for Story 1.3 to consume.

### tsup.config.ts — Exact Specification

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
})
```

- `format: ['cjs', 'esm']` — produces `dist/index.js` (CJS) and `dist/index.mjs` (ESM)
- `dts: true` — generates `dist/index.d.ts` (CJS types) and `dist/index.d.mts` (ESM types)
- `clean: true` — clears dist/ before each build; prevents stale artifacts
- No `external` needed — schema package has no runtime dependencies
- No `splitting` needed — types-only package

### JSON Schema — Complete Specification

**CRITICAL:** `"additionalProperties": false` must appear at every object node EXCEPT `metadata`. The metadata field is intentionally an open bag for future extensibility — it uses `"additionalProperties": true`.

The `$defs` pattern is required (not inline object definitions) because AJV in Story 1.3 uses the compiled schema instance for validation — `$defs` ensures reuse without duplication.

**Full story.v1.json:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Nihon no Hon Story v1",
  "description": "Open story format for Japanese language reading practice.",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "id", "title", "title_ja", "language", "description", "sentences"],
  "properties": {
    "schema_version": { "type": "string", "enum": ["1"] },
    "id": { "type": "string", "minLength": 1 },
    "title": { "type": "string" },
    "title_ja": { "type": "string" },
    "language": { "type": "string" },
    "description": { "type": "string" },
    "difficulty": { "type": ["string", "null"] },
    "keywords": { "type": "array", "items": { "$ref": "#/$defs/vocabEntry" } },
    "grammar": { "type": "array", "items": { "type": "string" } },
    "vocab_supplement": { "type": "array", "items": { "$ref": "#/$defs/vocabEntry" } },
    "metadata": { "type": "object", "additionalProperties": true },
    "sentences": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/sentence" } }
  },
  "$defs": {
    "vocabEntry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["word", "hiragana", "translation"],
      "properties": {
        "word": { "type": "string" },
        "hiragana": { "type": "string" },
        "translation": { "type": "string" }
      }
    },
    "sentence": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "words"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "words": { "type": "array", "items": { "type": "string", "minLength": 1 } },
        "ruby": { "type": "array", "items": { "type": ["string", "null"] } },
        "vocab_keys": { "type": "array", "items": { "type": ["integer", "null"] } },
        "translation": { "type": "string" },
        "grammar": { "type": "array", "items": { "type": "integer" } },
        "audio_url": { "type": "string" }
      }
    }
  }
}
```

**Key design decisions:**
- `schema_version` uses `enum: ["1"]` (string "1", not integer 1) — Story 1.3 dispatch is keyed by string
- `difficulty` allows null to represent "not specified" — matches `StoryModel.difficulty: string | null`
- `vocab_keys` items are `["integer", "null"]` — null means "no vocab entry for this word position"
- `ruby` items are `["string", "null"]` — null means "no annotation for this word position"
- `grammar` at sentence level is `integer[]` (indices into story-level grammar array) — distinct from story-level `grammar: string[]`; both fields are named `grammar` but carry different types
- `metadata` uses `"additionalProperties": true` — sole exception; this is intentional open bag
- `$defs` (Draft-07 standard) not `definitions` — AJV v8 supports both but `$defs` is the correct Draft-07 key

### TypeScript Types — Exact Canonical Definitions

These types must appear **verbatim** in `packages/schema/src/types.ts`. No variations.

```ts
export interface VocabEntry {
  id: number
  word: string
  reading: string
  meaning: string
  lesson: string
  notes?: string
}

export interface KanjiEntry {
  character: string
  meaning: string
  onYomi: string[]
  kunYomi: string[]
}

export interface VocabSupplementEntry {
  word: string
  hiragana: string
  translation: string
}

export interface SentenceModel {
  id: string
  words: string[]
  ruby: (string | null)[]
  vocabKeys: (number | null)[]
  translation: string | null
  grammar: number[]        // indices into StoryModel.grammar (string[])
  audioUrl?: string        // stored only; not played in v1; wire format: audio_url
}

export interface StoryModel {
  schemaVersion: string
  id: string
  title: string
  titleJa: string
  language: string
  difficulty: string | null
  description: string
  keywords: VocabSupplementEntry[]
  grammar: string[]        // story-level grammar point descriptions (NOT SentenceModel.grammar)
  vocabSupplement: VocabSupplementEntry[]
  sentences: SentenceModel[]
  metadata: Record<string, unknown>
}

export type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
```

**CRITICAL GRAMMAR FIELD DISAMBIGUATION** — this is the #1 source of future bugs:
- `StoryModel.grammar: string[]` — array of descriptive strings (e.g. "て-form for requesting actions")
- `SentenceModel.grammar: number[]` — array of integer INDICES into `StoryModel.grammar`
- They share the name `grammar` but carry completely different types
- Every file using both types must be clear about which is which

**src/index.ts content after update:**
```ts
export type {
  StoryModel,
  SentenceModel,
  VocabSupplementEntry,
  VocabEntry,
  KanjiEntry,
  LookupState,
} from './types'
```

Use `export type` (not `export`) to ensure tree-shaking and avoid runtime cost for type-only exports.

### Package.json — Final Shape After This Story

```json
{
  "name": "@nihonnohon/schema",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "schemas"],
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    },
    "./schemas/story.v1.json": "./schemas/story.v1.json"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@nihonnohon/typescript-config": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

### SCHEMA_CHANGELOG.md — Content

```markdown
# Schema Changelog

## Version 1

Initial schema version. Establishes the core story format contract.

### Root-level fields

Required: `schema_version`, `id`, `title`, `title_ja`, `language`, `description`, `sentences`

Optional: `difficulty`, `keywords`, `grammar`, `vocab_supplement`, `metadata`

### Sentence-level fields

Required: `id`, `words`

Optional: `ruby`, `vocab_keys`, `translation`, `grammar`, `audio_url`

### Vocab entry shape (used by `keywords` and `vocab_supplement`)

`word`, `hiragana`, `translation` (all required strings)

### Versioning policy

Breaking changes to the story format require a new `schema_version` string (e.g. `"2"`) and a corresponding new loader in `packages/story-loader/src/v2.ts`. The story-loader dispatches by version; old loaders remain for backward compatibility.
```

### Build Verification Steps

After Task 7, the following must be true:

```
packages/schema/
├── dist/
│   ├── index.js        ← CJS output
│   ├── index.mjs       ← ESM output  
│   ├── index.d.ts      ← CJS type declarations
│   └── index.d.mts     ← ESM type declarations
├── schemas/
│   └── story.v1.json   ← JSON schema (not in dist; exported directly)
├── src/
│   ├── index.ts        ← updated exports
│   └── types.ts        ← new canonical types
├── tsup.config.ts      ← new
├── tsconfig.json       ← unchanged from Story 1.1
├── package.json        ← updated
└── SCHEMA_CHANGELOG.md ← new
```

Check that `turbo typecheck --filter=@nihonnohon/schema` exits 0. The schema package is a types-only package — if tsc finds errors, there's a type definition mistake.

### Wire Format vs TypeScript Model

The JSON schema describes the **wire format** (snake_case). The TypeScript types describe the **internal model** (camelCase). The transformation between them happens ONLY in `packages/story-loader/src/v1.ts` (Story 1.3). This story delivers both ends of that contract:

| Wire format (story.v1.json) | TypeScript model (types.ts) |
|---|---|
| `schema_version` | `schemaVersion` |
| `title_ja` | `titleJa` |
| `vocab_supplement` | `vocabSupplement` |
| `vocab_keys` (per sentence) | `vocabKeys` |
| `audio_url` (per sentence) | `audioUrl` |

All other fields have the same name in both formats.

### Deferred Item: AC 6 (CI Validation)

AC 6 requires:
1. Story fixtures in `packages/story-loader/src/__fixtures__/` — created in **Story 1.3**
2. A validation step in the CI pipeline — wired in **Story 1.5** (`.github/workflows/ci.yml`)

Story 1.2 delivers the schema file. The CI script (likely a `scripts/validate-fixtures.ts` or inline AJV call) that reads fixtures and validates them against `story.v1.json` is Story 1.5 scope. Do NOT attempt to wire CI in this story.

### Anti-Patterns to Prevent

- Do NOT add runtime code to packages/schema — it is a types-only package
- Do NOT add `src/schema.ts` that re-exports the JSON schema — the JSON is consumed directly via the `"./schemas/story.v1.json"` exports entry
- Do NOT import from `@nihonnohon/schema` inside packages/schema itself (it would be a circular self-reference)
- Do NOT add AJV as a dependency to packages/schema — AJV belongs in packages/story-loader
- Do NOT use `"additionalProperties": false` on the `metadata` object — it is intentionally open-ended
- Do NOT name the `grammar` types loosely — `StoryModel.grammar` is `string[]` and `SentenceModel.grammar` is `number[]`; never conflate

### Project Structure Notes

**Files this story creates (NEW):**
- `packages/schema/schemas/story.v1.json`
- `packages/schema/src/types.ts`
- `packages/schema/tsup.config.ts`
- `packages/schema/SCHEMA_CHANGELOG.md`
- `packages/schema/dist/` (generated; gitignored via root .gitignore `dist/`)

**Files this story modifies (UPDATE):**
- `packages/schema/package.json` (add scripts, devDeps, files field, exports entry)
- `packages/schema/src/index.ts` (replace `export {}` with type re-exports)

**Files this story does NOT touch:**
- `packages/schema/tsconfig.json` — correct as-is from Story 1.1
- Root `turbo.json` — the default scaffold `build` task already handles packages with a `build` script
- Any file outside `packages/schema/` — this story is entirely scoped to the schema package

### References

- Story 1.2 ACs: [Source: _bmad-output/planning-artifacts/epics.md — Story 1.2]
- Canonical type definitions: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Canonical Type Definitions]
- Package exports map shape: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Package Exports Map]
- Schema format contract: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Story Format Contract]
- Wire format fields: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Story JSON Wire Format Fields]
- Turborepo pipeline: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Turborepo Pipeline]
- Story 1.1 completion notes (current package.json state): [Source: _bmad-output/implementation-artifacts/1-1-monorepo-initialization.md — Completion Notes]
- Deferred work from Story 1.1: [Source: _bmad-output/implementation-artifacts/deferred-work.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- pnpm install required root package.json `pnpm.onlyBuiltDependencies: ["esbuild"]` + lockfile deletion to approve esbuild's postinstall script (pnpm 11 security policy). Lockfile regenerated cleanly after fix.

### Completion Notes List

- `packages/schema/package.json` updated: main/types point to dist/, files field added, `./schemas/story.v1.json` export entry added, tsup + typescript devDeps added, build + typecheck scripts added.
- `packages/schema/tsup.config.ts` created: entry `src/index.ts`, format `['cjs', 'esm']`, dts, clean.
- `packages/schema/schemas/story.v1.json` created: JSON Schema Draft-07 with `additionalProperties: false` at root, sentence, and vocabEntry nodes; `additionalProperties: true` on metadata (intentional open bag); `$defs` pattern for sentence and vocabEntry reuse; all 12 root fields; all 7 optional sentence fields.
- `packages/schema/src/types.ts` created: all 6 canonical types (VocabEntry, KanjiEntry, VocabSupplementEntry, SentenceModel, StoryModel, LookupState). Critical disambiguation: `StoryModel.grammar: string[]` vs `SentenceModel.grammar: number[]`.
- `packages/schema/src/index.ts` updated: `export type` re-exports from ./types.
- `packages/schema/SCHEMA_CHANGELOG.md` created: version 1 entry with field inventory and versioning policy.
- `pnpm install` succeeded after adding `pnpm.onlyBuiltDependencies: ["esbuild"]` to root `package.json` and deleting stale `pnpm-lock.yaml`.
- `turbo build --filter=@nihonnohon/schema` succeeded: tsup 8.5.1, CJS + ESM + .d.ts + .d.mts all produced in `dist/`.
- `turbo typecheck --filter=@nihonnohon/schema` succeeded: `tsc --noEmit` exit 0.
- Schema structure verified via Node.js inline script: `additionalProperties` constraints confirmed, required/enum/type values confirmed, integer types for grammar indices and vocab_keys confirmed.
- AC 6 (CI validation) deferred as planned: fixtures in Story 1.3, CI pipeline in Story 1.5.

### Change Log

- 2026-05-11: Story 1.2 implemented. Created `story.v1.json` JSON Schema, canonical TypeScript types, tsup build config, SCHEMA_CHANGELOG.md. Updated package.json and src/index.ts. Build and typecheck verified passing.

### File List

- `packages/schema/package.json` (UPDATED)
- `packages/schema/tsup.config.ts` (NEW)
- `packages/schema/schemas/story.v1.json` (NEW)
- `packages/schema/src/types.ts` (NEW)
- `packages/schema/src/index.ts` (UPDATED)
- `packages/schema/SCHEMA_CHANGELOG.md` (NEW)
- `package.json` (UPDATED — added `pnpm.onlyBuiltDependencies: ["esbuild"]`)
- `pnpm-lock.yaml` (REGENERATED — lockfile deleted and recreated after esbuild approval)
