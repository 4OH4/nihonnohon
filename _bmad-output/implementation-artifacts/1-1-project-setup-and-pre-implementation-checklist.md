# Story 1.1: Project Setup & Pre-implementation Checklist

Status: done

## Story

As a developer,
I want the monorepo workspace, ADRs, and curriculum reference data correctly configured,
so that M1 implementation can begin without tooling or reference-data gaps.

## Acceptance Criteria

**AC1 — Workspace registration:**
Given `apps/story-generator` is a recognised pnpm workspace member,
when `pnpm install` is run from `apps/story-generator/` (after Story 2.1 creates `package.json`),
then `@nihonnohon/typescript-config` and `@nihonnohon/eslint-config` resolve from the workspace.

**AC2 — ADR-003 updated:**
Given `docs/adr/003-story-generator-out-of-scope.md` previously named `apps/story-generator/` as the excluded Python project,
when RT reviews the ADR,
then it correctly names `apps/story-generator-backend/` as the excluded Python project and `apps/story-generator/` as a normal workspace member.

**AC3 — Grammar CSV validated:**
Given `resources/Genki_grammar_for_AI_generation.csv` has not been formally reviewed,
when RT manually checks all 123 grammar entries against the Genki I textbook,
then all entries are confirmed correct or corrected; a commit note confirms the validation; no chapter assignments are incorrect.

## Tasks / Subtasks

- [x] AC1: Add `apps/story-generator` to `pnpm-workspace.yaml` *(done in planning commit a0eedc2)*
- [x] AC2: Update `docs/adr/003-story-generator-out-of-scope.md` *(done in planning commit a0eedc2)*
- [x] Write `docs/adr/004-agui-event-types.md` (architecture dependency, not in original AC) *(done in planning commit a0eedc2)*
- [ ] AC3: RT manually reviews `resources/Genki_grammar_for_AI_generation.csv` against Genki I
  - [ ] Open Genki I textbook and compare chapter assignments (CSV column 1) for all 123 rows
  - [ ] Correct any misassigned rows in the CSV
  - [ ] Commit with message: `data(grammar): validate grammar CSV against Genki I textbook`

## Dev Notes

### Pre-completion status

Three of the four checklist items were completed during the planning phase (commit `a0eedc2`):

| Item | Status | Details |
|------|--------|---------|
| `pnpm-workspace.yaml` — add `apps/story-generator` | ✅ Done | Entry exists |
| `docs/adr/003-story-generator-out-of-scope.md` | ✅ Done | Updated to reference `apps/story-generator-backend/` |
| `docs/adr/004-agui-event-types.md` | ✅ Done | Full event contract committed |
| `resources/Genki_grammar_for_AI_generation.csv` validation | ❌ **Pending** | Requires RT's manual check |

The only implementation work remaining is the grammar CSV review (AC3). Once that is done this story is complete and Story 1.2 can begin.

### Grammar CSV context

`resources/Genki_grammar_for_AI_generation.csv` — 124 lines including header, 123 grammar points.

Columns: `Chapter`, `Grammar Point`, `Descriptive Title`, `Detailed Summary and Scope`

```
1,1.1,Defining Identity (X は Y です),"..."
1,1.2,Basic Inquiry (Question Sentences),"..."
...
```

The CSV spans Genki I chapters 1–12. Each row's `Chapter` value determines which cumulative ceiling the grammar point falls under — a mismatch means a learner at that chapter will be tested on grammar they haven't studied. Incorrect chapter assignments are **silent calibration failures** that no downstream test will catch.

**How to validate:** Open Genki I and cross-reference the chapter each grammar pattern is introduced. The `Descriptive Title` column gives a reliable plain-English hint. Chapter boundaries are the critical constraint — a grammar point assigned to Chapter 5 that actually appears in Chapter 8 would expose learners at Ch.5–7 to unseen grammar.

**What correct looks like:** Every row's `Chapter` value matches the chapter in which Genki I first introduces that pattern. Minor wording differences in `Descriptive Title` are not failures; only chapter misassignment matters for this story.

### Existing Python content in apps/story-generator/

`apps/story-generator/` currently contains Python placeholder files from the pre-sprint era:
```
apps/story-generator/
  README.md
  requirements.txt         (jsonschema>=4.0.0 only)
  src/story_generator/
    __init__.py
    validator.py           (stub — schema-level JSON validation only; not the real validator)
```

**Do not modify these files in this story.** Story 1.2 creates `apps/story-generator-backend/` and migrates the Python content there. Story 1.1's only concern is the grammar CSV.

### AC1 verification note

AC1 (pnpm install resolves workspace packages from `apps/story-generator/`) cannot be fully verified until Story 2.1 creates `package.json` in that directory. The workspace entry in `pnpm-workspace.yaml` is already correct; the verification step naturally belongs to Story 2.1's scaffold work.

### Project Structure Notes

No files are created or modified in this story beyond (possibly) `resources/Genki_grammar_for_AI_generation.csv`. All other setup was handled in the planning commit.

### References

- Architecture pre-implementation checklist: [architecture-story-authoring-tool.md — Pre-Implementation Checklist](_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- ADR-003: [docs/adr/003-story-generator-out-of-scope.md](docs/adr/003-story-generator-out-of-scope.md)
- ADR-004 (AG-UI event contract): [docs/adr/004-agui-event-types.md](docs/adr/004-agui-event-types.md)
- Grammar CSV: [resources/Genki_grammar_for_AI_generation.csv](resources/Genki_grammar_for_AI_generation.csv)
- Epics story definition: [epics-story-authoring-tool.md — Story 1.1](_bmad-output/planning-artifacts/epics-story-authoring-tool.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A

### Completion Notes List

- ACs 1, 2, and the ADR-004 prerequisite were completed during the planning phase (commit `a0eedc2`).
- Only AC3 (grammar CSV validation) remains. This is a manual review task for RT, not generated code.
- Once AC3 is done and committed, mark this story `done` and proceed to Story 1.2.

### File List

- `resources/Genki_grammar_for_AI_generation.csv` — may be modified if corrections are needed
