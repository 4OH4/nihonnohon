# ADR 002: JSON Schema Over Zod for Story Format Validation

**Status:** Accepted
**Date:** 2026-05-11

## Context

Story files need to be validated in two separate contexts:
1. The nihonnohon web app (`packages/story-loader`) — TypeScript, running in the browser.
2. The story-generator tool (`apps/story-generator/`) — Python, running server-side.

Both tools must enforce the same story format contract. The schema must be a single source
of truth accessible from both environments.

Options considered:
- **Zod:** Excellent TypeScript DX, runtime validation, and type inference. TypeScript-only;
  cannot be consumed by the Python story-generator.
- **JSON Schema (Draft-07) + AJV v8:** Language-agnostic; the `story.v1.json` file can be
  consumed by AJV (TypeScript) and `jsonschema` (Python) from the same source file.
- **Custom validation:** Hand-written validators in both languages. Divergence risk is high
  and maintenance burden doubles every time the schema changes.

## Decision

Use `packages/schema/schemas/story.v1.json` (JSON Schema Draft-07) as the single source
of truth. AJV v8 validates in the TypeScript story-loader; the `jsonschema` Python library
validates in the story-generator.

`additionalProperties: false` is set at every object node to prevent silent field drift —
unrecognised fields at any level cause validation failure.

## Consequences

- **Language-agnostic contract:** `story.v1.json` is the canonical interface between
  nihonnohon and the story-generator tool.
- **Zod rejected:** TypeScript-only; breaks the Python validation requirement.
- **AJV v8 is CommonJS:** Requires careful ESM import chain verification in Vite (confirmed
  working: AJV is bundled into `@nihonnohon/story-loader` dist by tsup).
- **Breaking changes require a new schema version:** `schema_version` is incremented for
  every breaking change; a new versioned loader (`v2.ts`) is added in `packages/story-loader`.
- **Non-breaking additions do not require a version bump:** New optional fields may be added
  without incrementing `schema_version`, provided `additionalProperties: false` is not violated.
