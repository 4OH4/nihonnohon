---
generated: 2026-05-13
scan_level: deep
part: story-loader
project_type: library
---

# Architecture — Story Loader Package (`packages/story-loader`)

## Executive Summary

`@nihonnohon/story-loader` is the versioned story validation and transformation pipeline. It accepts raw JSON (string or object), detects the schema version, validates against the corresponding JSON Schema using AJV, checks cross-field invariants not expressible in JSON Schema, and transforms the `snake_case` wire format into the `camelCase` `StoryModel` that the web app consumes.

---

## Technology Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | TypeScript | strict mode |
| Build | tsup 8.5.1 | Dual CJS + ESM output |
| Schema validation | AJV 8.17.1 | Compiled from story.v1.json |
| Test framework | Vitest | Unit tests with fixture files |

---

## Architecture Pattern

**Versioned loader registry.** The `LOADERS` map dispatches to the correct loader based on `schema_version`. Adding a new schema version means adding a new loader file and registering it — no `if/else` chains allowed.

---

## Public API

```typescript
// packages/story-loader/src/index.ts

export function loadStory(rawJson: unknown): StoryModel
export { LoaderError } from './errors'
```

`loadStory` accepts either a JSON string (it parses it) or a pre-parsed object.

---

## Error Handling

`LoaderError` is a typed error class with three `code` values:

| Code | Cause |
|------|-------|
| `PARSE_FAILED` | Input string is not valid JSON |
| `SCHEMA_INVALID` | AJV validation failed, or parallel array length mismatch |
| `UNSUPPORTED_VERSION` | `schema_version` not in the `LOADERS` registry |

---

## Validation Pipeline (v1)

Three-stage pipeline in `v1.ts`:

```
1. AJV validate(raw)
   → throws LoaderError('SCHEMA_INVALID') on failure

2. Parallel array length check (per sentence)
   ruby.length === words.length      (if ruby present)
   vocab_keys.length === words.length (if vocab_keys present)
   → throws LoaderError('SCHEMA_INVALID') on mismatch

3. snake_case → camelCase transform
   → returns StoryModel
```

The parallel array check is needed because JSON Schema Draft-07 cannot express cross-field equality constraints.

---

## Adding a New Schema Version

1. Create `packages/story-loader/src/v2.ts` with a `loadV2(raw: unknown): StoryModel` function
2. Register it: `const LOADERS = { '1': loadV1, '2': loadV2 }`
3. Add fixtures to `src/__fixtures__/`
4. Update `SCHEMA_CHANGELOG.md`

---

## Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | `loadStory()` entry point; `LOADERS` registry |
| `src/v1.ts` | `loadV1`: AJV validate → array check → transform |
| `src/errors.ts` | `LoaderError` with typed `code` field |
| `src/index.test.ts` | Vitest unit tests |
| `src/__fixtures__/` | Valid and invalid story JSON fixtures |

---

## Fixture Files

| Fixture | Tests |
|---------|-------|
| `valid-v1.json` | Full valid story |
| `valid-v1-minimal.json` | Minimal valid story (only required fields) |
| `unsupported-schema-version.json` | `UNSUPPORTED_VERSION` error path |
| `invalid-schema.json` | `SCHEMA_INVALID` — field type error |
| `invalid-sentence-missing-id.json` | `SCHEMA_INVALID` — missing required field |
| `invalid-empty-sentences.json` | `SCHEMA_INVALID` — empty sentences array |
| `invalid-malformed.txt` | `PARSE_FAILED` — not valid JSON |
