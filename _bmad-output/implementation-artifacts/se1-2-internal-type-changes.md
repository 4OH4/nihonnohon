# Story se1-2: Internal Type Changes

Status: done

## Story

As a **developer**,
I want `SentenceModel` to use `tokens: ParsedWord[]` instead of parallel `words[]` and `ruby[]` arrays,
so that the internal representation is type-safe and self-contained, with clean surface text always accessible without parsing.

## Acceptance Criteria

1. **AC1 — New types exported from schema package**
   - `packages/schema/src/types.ts` exports `WordSegment { text: string; ruby: string | null }` and `ParsedWord { surface: string; segments: WordSegment[] }`
   - Both types are added to `packages/schema/src/index.ts` re-export list

2. **AC2 — SentenceModel updated**
   - `SentenceModel` has `tokens: ParsedWord[]` replacing the `words: string[]` and `ruby: (string | null)[]` fields
   - All other `SentenceModel` fields (`id`, `vocabKeys`, `translation`, `grammar`, `audioUrl`) are unchanged

3. **AC3 — Intentional downstream breakage**
   - `turbo typecheck` run after this story **reports type errors** in `packages/story-loader` and `apps/web` — this is expected and intentional; this story does NOT fix downstream consumers
   - `packages/schema` itself must typecheck clean

4. **AC4 — Minimal diff**
   - Changed files: `packages/schema/src/types.ts` and `packages/schema/src/index.ts` only
   - No loader, component, or test files are modified in this story

## Tasks / Subtasks

- [ ] Task 1: Add `WordSegment` and `ParsedWord` to `packages/schema/src/types.ts` (AC1)
  - [ ] Copy the interface definitions verbatim from `packages/story-loader/src/parseInlineRuby.ts` (lines 4–13)
  - [ ] Place them above `SentenceModel` in `types.ts`
  - [ ] Add one-line JSDoc to each interface (same as in `parseInlineRuby.ts`)

- [ ] Task 2: Update `SentenceModel` in `packages/schema/src/types.ts` (AC2)
  - [ ] Remove `words: string[]` field
  - [ ] Remove `ruby: (string | null)[]` field
  - [ ] Add `tokens: ParsedWord[]` field

- [ ] Task 3: Re-export new types from `packages/schema/src/index.ts` (AC1)
  - [ ] Add `WordSegment` and `ParsedWord` to the `export type { ... }` block

- [ ] Task 4: Verify typecheck behaviour (AC3, AC4)
  - [ ] Run `turbo typecheck --filter=@nihonnohon/schema` — must pass clean
  - [ ] Run `turbo typecheck` from repo root — expect errors in `packages/story-loader` and `apps/web`; these are correct and expected
  - [ ] Confirm no other files were modified

## Dev Notes

### Scope — This Story Is Intentionally Incomplete

This story is a **breaking type change only**. After it lands, the repo will have type errors in the loader and web app. This is by design — se1-3 and se1-4 fix those errors. Do not "fix" the downstream errors here; doing so would violate the story's scope and make reviewing harder.

### Files to Change

| File | Change |
|------|--------|
| `packages/schema/src/types.ts` | Add `WordSegment`, `ParsedWord`; update `SentenceModel` |
| `packages/schema/src/index.ts` | Add `WordSegment`, `ParsedWord` to re-export list |

### Files to Leave Untouched

| File | Why |
|------|-----|
| `packages/story-loader/src/parseInlineRuby.ts` | Still exports its own local `WordSegment`/`ParsedWord` — these definitions co-exist temporarily until se1-3 removes them and imports from `@nihonnohon/schema` |
| `packages/story-loader/src/v1.ts` | Loader changes are se1-3; editing here now would cause confusing partial states |
| `apps/web/src/components/SentenceBlock.tsx` | UI changes are se1-4 |
| `apps/web/src/components/GrammarPanel.tsx` | Not affected by tokens change |
| Any test files | No test changes in this story |

### Source Truth for Interface Definitions

The canonical interface shapes are already defined in `packages/story-loader/src/parseInlineRuby.ts` lines 4–13:

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

Copy these verbatim into `types.ts`. Do not alter the field names, types, or order. The JSDoc lines must be preserved (per project comment style: succinct docstrings on all exported types).

### Current `SentenceModel` State (before this story)

```typescript
export interface SentenceModel {
  id: string
  words: string[]              // ← REMOVE
  ruby: (string | null)[]     // ← REMOVE
  vocabKeys: (number | null)[]
  translation: string | null
  grammar: number[]
  audioUrl?: string
}
```

### Target `SentenceModel` State (after this story)

```typescript
export interface SentenceModel {
  id: string
  tokens: ParsedWord[]         // ← NEW (replaces words + ruby)
  vocabKeys: (number | null)[]
  translation: string | null
  grammar: number[]
  audioUrl?: string
}
```

### Expected Downstream Type Errors After This Story

When `turbo typecheck` runs from the repo root, expect errors in:

- **`packages/story-loader/src/v1.ts`** — `mapSentence` returns `{ words, ruby, ... }` which no longer satisfies `SentenceModel`. Line ~102: `return { id, words, ruby, vocabKeys, ... }`.
- **`apps/web/src/components/SentenceBlock.tsx`** — references `sentence.words` (line 44) and `sentence.ruby[i]` (line 48). Both fields no longer exist on `SentenceModel`.
- **`apps/web/src/__tests__/SentenceBlock.test.tsx`** — test fixtures construct `SentenceModel` objects with `words`/`ruby` directly.

These are the correct, expected errors that se1-3 and se1-4 will resolve. Do not attempt to fix them here.

### Comment Style

Per project feedback: write a one-line `/** ... */` JSDoc on every exported type/interface. The two new interfaces both have JSDoc in `parseInlineRuby.ts` — copy those docstrings verbatim.

### File Header

All TypeScript files in this repo start with:
```typescript
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
```
`types.ts` already has this header — do not remove it.

### Project Structure Notes

- `packages/schema/src/types.ts` is the single source of truth for shared model types; this is the correct home for `WordSegment` and `ParsedWord`
- `packages/schema/src/index.ts` uses explicit named re-exports — add the two new types to the existing `export type { ... }` block (no barrel-style catch-all)
- `@nihonnohon/schema` is already a dependency of `packages/story-loader` — no package.json changes needed

### References

- Epic spec: `_bmad-output/planning-artifacts/supp-epic-1-furigana-rework.md` — Story se1-2 section
- Se1-1 artifact (done): `_bmad-output/implementation-artifacts/se1-1-inline-ruby-parser-and-v2-schema.md`
- ADR: `docs/adr/005-inline-furigana-format.md`
- Current `types.ts`: `packages/schema/src/types.ts`
- Current `index.ts`: `packages/schema/src/index.ts`
- Interface source: `packages/story-loader/src/parseInlineRuby.ts` lines 4–13

### Review Findings

- [x] [Review][Patch] `vocabKeys` has no doc comment documenting its parallel relationship to `tokens[]` [`packages/schema/src/types.ts`] — add a one-line `/** Parallel to tokens[] — one entry per token. */` doc comment so the invariant is self-evident to future readers and se1-3/se1-4 authors.
- [x] [Review][Defer] `parseInlineRuby` orphan-bracket handler silently discards bracket content, causing `surface` to differ from the original input string — deferred, pre-existing from se1-1; not introduced by this diff.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `WordSegment` and `ParsedWord` interfaces to `packages/schema/src/types.ts`, placed above `SentenceModel`, with JSDoc copied verbatim from `parseInlineRuby.ts`.
- `SentenceModel.tokens: ParsedWord[]` replaces the removed `words: string[]` and `ruby: (string | null)[]` fields. All other fields (`id`, `vocabKeys`, `translation`, `grammar`, `audioUrl`) are unchanged.
- Both new types added to the `export type { ... }` block in `packages/schema/src/index.ts`.
- `turbo typecheck --filter=@nihonnohon/schema` exits 0 ✅
- Full `turbo typecheck` reports expected errors in `packages/story-loader` (v1.ts:105, index.test.ts:33,34,53,54) ✅ — intentional, per AC3.
- No loader, component, or test files were modified.
- Local `WordSegment`/`ParsedWord` definitions in `parseInlineRuby.ts` remain in place; se1-3 will remove them and import from `@nihonnohon/schema` instead.

### File List

- `packages/schema/src/types.ts` — added `WordSegment`, `ParsedWord`; updated `SentenceModel`
- `packages/schema/src/index.ts` — added `WordSegment`, `ParsedWord` to re-export list
