---
generated: 2026-05-13
scan_level: deep
part: schema
project_type: library
---

# Architecture — Schema Package (`packages/schema`)

## Executive Summary

`@nihonnohon/schema` is the single source of truth for the nihonnohon story format. It exports TypeScript interfaces for runtime use and ships a JSON Schema (`story.v1.json`) that acts as a language-agnostic contract consumable by both the TypeScript story-loader (AJV) and the Python story-generator (`jsonschema`).

---

## Technology Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | TypeScript | strict mode |
| Build | tsup 8.5.1 | Dual CJS + ESM output |
| Schema format | JSON Schema Draft-07 | Validated by AJV (TS) and jsonschema (Python) |

---

## Architecture Pattern

**Pure contract library** — no runtime logic, no side effects. Exports types and a schema file.

---

## Package Exports

```
@nihonnohon/schema
├── TypeScript types (index.ts re-export)
│   ├── VocabEntry
│   ├── KanjiEntry
│   ├── VocabSupplementEntry
│   ├── SentenceModel
│   ├── StoryModel
│   └── LookupState
└── JSON Schema
    └── @nihonnohon/schema/schemas/story.v1.json
```

---

## Key Invariants

- `schema_version` is an **integer-as-string** (`"1"`, `"2"`) — never a plain integer or semver.
- `SentenceModel.grammar` is `number[]` (indices) — `StoryModel.grammar` is `string[]` (text).
- `KanjiEntry.kw` is the short Heisig keyword; `KanjiEntry.m` is the full meanings array.
- Wire format is `snake_case`; TypeScript model is `camelCase`.
- `additionalProperties: false` at every JSON Schema object node.

---

## Versioning Contract

Non-breaking additions (new optional fields) → no version bump required; must not violate `additionalProperties: false`.

Breaking changes → increment `schema_version` enum (e.g. `"1"` → `"2"`) + add new loader in story-loader + update `SCHEMA_CHANGELOG.md`.

---

## Source Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript interfaces |
| `src/index.ts` | Re-exports from types.ts |
| `schemas/story.v1.json` | JSON Schema Draft-07 story contract |
| `SCHEMA_CHANGELOG.md` | Breaking + non-breaking change history |
