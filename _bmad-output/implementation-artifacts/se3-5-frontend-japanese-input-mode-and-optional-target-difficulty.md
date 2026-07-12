# Story se3.5: Frontend — Japanese Input Mode and Optional Target Difficulty

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **story author**,
I want a **"Japanese story" tab** and an **"Unspecified" target-difficulty option**,
so that I can paste a finished Japanese story to enrich (no chapter framing), or generate a full
story without constraining it to a Genki chapter.

## Context

This is the **frontend story of supp-epic-3** (Staged Generation Pipeline). The backend is **already
done and merged** — se3-4 shipped the two-stage `generate()`, the `path_mode="C"` (Japanese entry
point) branch, and the `chapter="unspecified"` sentinel (`None` target ⇒ no chapter framing). This
story is the **UI half of the agreed wire contract**; it adds no backend behaviour.

**The wire contract this UI must produce (frozen by se3-4):**

- `pathMode=C` → Japanese entry point (paste a finished Japanese story).
- `chapter=unspecified` (exact string) → optional target difficulty is "none"; backend skips Stage 1
  for C (frozen Japanese) and labels `difficulty="Unspecified"`. A real chapter string
  (`Genki I Ch.6`) behaves as today.
- Path C rides the **existing** `inputText` and `chapter` query params — **no new param, no new
  field**. The Path-B-only params (`topic`/`englishDraft`/`target_word_count`) are **not** sent for C.

**Routing recap (from the epic — the UI's job is only the left two columns):**

| Tab (`pathMode`) | Chapter options offered | Sends |
|---|---|---|
| **A — Convert a story** (English) | `Genki I Ch.N` **+ Unspecified** | `inputText` (English) + `chapter` |
| **B — Generate from topic** | `Genki I Ch.N` only (**no** Unspecified) | `topic`/`englishDraft` + `chapter` |
| **C — Japanese story** (new) | `Genki I Ch.N` **+ Unspecified** | `inputText` (Japanese) + `chapter` |

"Unspecified" is offered for the **full-story inputs (A and C) only**; topic mode (B) keeps requiring
a chapter, exactly as today.

Full epic:
[`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(§"Target-difficulty reframing"; §"Routing and call counts"; §"Parameter model: `path_mode='C'` +
`chapter='unspecified'` sentinel"; §"Components Affected"; Story se3-5).

> **This is almost purely additive on the frontend.** Nothing in the A/B rendering, validation, or
> SSE assembly is removed — you widen a union, add a third tab, add a third input branch and a new
> `<option>`, and thread `pathMode='C'` + `chapter='unspecified'` through the store snapshot and
> session persistence. The one non-obvious risk is a **cross-mode chapter leak** (Unspecified selected
> in A/C, then switch to B) — see Dev Notes → "Gotcha: the Unspecified-then-switch-to-B leak".

## Acceptance Criteria

1. **AC1 — Shared `PathMode` type replaces every inline `'A' | 'B'`**
   Add `export type PathMode = 'A' | 'B' | 'C'` to
   [`stores/authoringStore.ts`](../../apps/story-generator/src/stores/authoringStore.ts) and replace
   every inline `'A' | 'B'` union with `PathMode`:
   - `authoringStore.ts:73` (`StoredInputs.pathMode`), `:90` (`AuthoringStore.pathMode`), `:121`
     (`setPathMode` param).
   - `hooks/useSession.ts:22` (`SessionState.pathMode`).
   - `components/ModeToggle.tsx:24` (`pendingMode` state) and `:32` (`handleModeClick` param).
   `pnpm typecheck` exits 0 (it flags any missed site). `useAgUiRun.ts` needs **no** annotation change —
   `pathMode` flows in from the store types; it only stringifies into `URLSearchParams`.

2. **AC2 — Third tab in `ModeToggle`**
   [`ModeToggle.tsx:8-11`](../../apps/story-generator/src/components/ModeToggle.tsx#L8-L11): the `MODES`
   registry gains a third entry `{ value: 'C' as const, label: 'Japanese story' }`. The existing
   arrow-key nav ([`:41-51`](../../apps/story-generator/src/components/ModeToggle.tsx#L41-L51)) already
   generalises over `MODES.length` and needs **no** change; the dirty-output warning strip works
   unchanged for C.

3. **AC3 — Path C renders a Japanese textarea**
   In [`InputPanel.tsx:166-203`](../../apps/story-generator/src/components/InputPanel.tsx#L166-L203),
   when `pathMode === 'C'` a `<textarea>` is rendered (label **"Japanese story"**, placeholder e.g.
   "Paste your finished Japanese story here…") carrying the **`font-ja`** class (project non-negotiable
   for Japanese text), bound to `inputText` / `handleInputChange` exactly like the Path A textarea.
   The branch becomes three-way: `A` → English textarea, `C` → Japanese (`font-ja`) textarea, else
   (`B`) → `<TopicTextarea>`.

4. **AC4 — "Unspecified" chapter option for A and C only, mapping to the exact wire value**
   The chapter `<select>`
   ([`InputPanel.tsx:205-234`](../../apps/story-generator/src/components/InputPanel.tsx#L205-L234))
   offers, **only when `pathMode` is `'A'` or `'C'`**, an option
   **"Unspecified — keep original difficulty"** whose `value` is the exact string **`"unspecified"`**
   (this string is the backend sentinel — se3-4 guards `chapter == "unspecified"`; any other spelling
   silently breaks the feature). The `<option value="">Select a chapter…</option>` placeholder remains
   the invalid/unfilled state that triggers the validation hint. When `pathMode === 'B'` the
   "Unspecified" option is **not** rendered (AC5).

5. **AC5 — Topic mode (B) still requires a chapter**
   For `pathMode === 'B'` the chapter selector renders exactly as today (placeholder + the 23
   `CHAPTER_OPTIONS`, **no** "Unspecified"). B's behaviour is unchanged end to end.

6. **AC6 — Unspecified hides the ScopeChip and shows explanatory helper text**
   When `chapterTarget === 'unspecified'`, the `<ScopeChip>` preview is **not** shown (ScopeChip
   already returns `null` for an unrecognised chapter — [`ScopeChip.tsx:52-53`](../../apps/story-generator/src/components/ScopeChip.tsx#L52-L53) —
   but the render guard `chapterTarget && <ScopeChip …>` at
   [`InputPanel.tsx:233`](../../apps/story-generator/src/components/InputPanel.tsx#L233) must not render
   an empty chip either) and **helper text** explains the story is not framed around a chapter (e.g.
   "The story keeps its natural difficulty — vocabulary and grammar are not constrained to a Genki
   chapter."). Reuse the muted-hint styling vocabulary already in the file (`text-xs text-muted mt-1`,
   as at [`InputPanel.tsx:191`](../../apps/story-generator/src/components/InputPanel.tsx#L191)) / the
   disabled-hint precedent in
   [`SettingsPanel.tsx:191-195`](../../apps/story-generator/src/components/SettingsPanel.tsx#L191-L195)).

7. **AC7 — Validation and the Generate-button label cover C; collapsed summary labels C**
   - **Validation:** the pre-flight check
     ([`InputPanel.tsx:79-97`](../../apps/story-generator/src/components/InputPanel.tsx#L79-L97))
     requires `inputText` **and** a chapter choice for Path C. This already holds — C is not `'B'`, so
     it falls into the existing `else` branch that checks `inputText` + `chapterTarget !== ''`, and
     `"unspecified"` is a non-empty value that satisfies the chapter check. **Confirm no change is
     needed here and record it**; do not duplicate the branch.
   - **Button label** ([`InputPanel.tsx:297`](../../apps/story-generator/src/components/InputPanel.tsx#L297)):
     the label ternary includes a C case — recommend **"Create story"** for C (A stays "Convert to
     Japanese", B stays "Generate"; "Convert to Japanese" is wrong for C since the input is already
     Japanese).
   - **Collapsed summary** ([`InputPanel.tsx:123-160`](../../apps/story-generator/src/components/InputPanel.tsx#L123-L160)):
     the mode label ([`:126`](../../apps/story-generator/src/components/InputPanel.tsx#L126)) shows
     **"Japanese story"** for C; the content preview uses `inputText` for C (the existing non-B `else`
     branch at [`:140-147`](../../apps/story-generator/src/components/InputPanel.tsx#L140-L147) already
     does this — confirm it renders for C).

8. **AC8 — `useAgUiRun` sends C correctly with no new param**
   For a Path C run
   ([`useAgUiRun.ts:59-94`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L59-L94)) the request
   sends the existing `inputText`, `chapter` (with `chapter=unspecified` when chosen), and `pathMode=C`.
   The Path-B-only block stays `pathMode === 'B'`-guarded
   ([`:85`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L85)) so **no** `topic`/`englishDraft`/
   `target_word_count` is sent for C. No code change should be required in this file beyond what AC1's
   type widening implies — **verify and record**.

9. **AC9 — Store snapshot and session persistence round-trip `pathMode='C'` and `chapter='unspecified'`**
   - `StoredInputs` ([`authoringStore.ts:69-82`](../../apps/story-generator/src/stores/authoringStore.ts#L69-L82))
     and both snapshot writers — `generate()`
     ([`:222-226`](../../apps/story-generator/src/stores/authoringStore.ts#L222-L226)) and `approve()`
     ([`:250-255`](../../apps/story-generator/src/stores/authoringStore.ts#L250-L255)) — carry
     `pathMode` and `chapterTarget` **as-is** (they already spread the current values; only the type
     widens via AC1).
   - `useSession.ts` round-trips `pathMode='C'` and an `"unspecified"` chapter: the write path
     ([`:144,142`](../../apps/story-generator/src/hooks/useSession.ts#L142-L144)) already persists both
     verbatim; the restore path ([`:98`](../../apps/story-generator/src/hooks/useSession.ts#L98)) must
     **guard a stale/invalid `pathMode`** to a safe fallback (`'A'`) so an old or corrupt session cannot
     hydrate an out-of-range mode. `chapterTarget='unspecified'` round-trips as a plain string (no
     special fallback needed — confirm).

10. **AC10 — Gotcha handled: switching A/C → B must not leak an `"unspecified"` chapter into B**
    Because B does not offer the "Unspecified" option, a `chapterTarget` left at `"unspecified"` from
    A/C would (a) render the B `<select>` with no matching option and (b) pass B's non-empty chapter
    validation while sending `chapter=unspecified` to a Path-B run — which the epic explicitly
    disallows for B. In `setPathMode`
    ([`authoringStore.ts:315-326`](../../apps/story-generator/src/stores/authoringStore.ts#L315-L326)),
    when switching **to** `'B'` and `chapterTarget === 'unspecified'`, reset `chapterTarget` to `''`
    (forcing a real chapter choice). Switching **to** A or C leaves `chapterTarget` untouched.

11. **AC11 — Contract tests updated and green**
    - `ModeToggle.test.tsx` — assert **3** tabs, third labelled "Japanese story", clicking it sets
      `pathMode==='C'`, and 3-way arrow-key nav (wrap-around over `MODES.length`).
    - `authoringStore.test.ts` — `setPathMode('C')` sets the mode; add the AC10 case
      (`setPathMode('C')` then `setChapterTarget('unspecified')` then `setPathMode('B')` ⇒
      `chapterTarget === ''`).
    - `useAgUiRun.test.ts` — a Path C run sends `pathMode=C` + `inputText` + `chapter`, and **no**
      `topic`/`englishDraft`; plus a `chapter=unspecified` case.
    - `InputPanel.test.tsx` — Path C renders the `font-ja` Japanese textarea; the "Unspecified" option
      is present for A/C and **absent** for B; selecting Unspecified hides the ScopeChip and shows the
      helper text; the C button label and validation behave.
    - `useSession.test.ts` — `pathMode:'C'` and `chapterTarget:'unspecified'` round-trip; a stale
      `pathMode` restores to the `'A'` fallback.
    `pnpm test` (from `apps/story-generator`) is fully green; **no unrelated test regresses** (ProposalPanel,
    TopicTextarea, ScopeChip, GenerationProgress, OutputPanel, BackendStatus).

12. **AC12 — Typecheck, build, and manual browser verification (project non-negotiable)**
    `pnpm typecheck` and `pnpm build` pass. Then, per the project non-negotiable for any UI/CSS change,
    run `pnpm dev` (from `apps/story-generator`) and confirm in the browser:
    - **A + chapter** and **A + Unspecified** both generate; ScopeChip shows for a chapter, hides for
      Unspecified; the resulting story JSON's `difficulty` is `Genki I Ch.N` vs `Unspecified`.
    - **B** unchanged (chapter required, no Unspecified option).
    - **C + chapter** simplifies the pasted Japanese; **C + Unspecified** leaves the Japanese
      **identical** to the input (frozen path).
    - A session restore round-trips `pathMode='C'` and the chosen chapter (incl. Unspecified).

13. **AC13 — Scope fence: frontend-only, no backend/schema/wire change**
    Changes are confined to `apps/story-generator/src/`: `stores/authoringStore.ts`,
    `components/ModeToggle.tsx`, `components/InputPanel.tsx`, `hooks/useSession.ts`, and the five test
    files (+ `hooks/useAgUiRun.ts` **iff** type widening forces an edit there — expected: none). **No**
    change to the backend (`apps/story-generator-backend/`), the v2 wire format, `ScopeChip`'s
    `CHAPTER_SCOPE` data, `TopicTextarea`, or the SSE event contract. No new query param and no new
    store field — Path C rides existing `inputText`/`chapter`; the target rides the `"unspecified"`
    sentinel.

## Tasks / Subtasks

- [x] **Task 1: Introduce the shared `PathMode` type and widen all sites** (AC: 1)
  - [x] Add `export type PathMode = 'A' | 'B' | 'C'` in `authoringStore.ts` (near the other exported
        types, e.g. above `Phase`).
  - [x] Replace inline `'A' | 'B'` at `authoringStore.ts:73,90,121`; `useSession.ts:22`;
        `ModeToggle.tsx:24,32`. Import `type { PathMode }` where needed.
  - [x] `pnpm typecheck` → 0 errors (it will flag any missed occurrence).

- [x] **Task 2: Add the third tab** (AC: 2)
  - [x] `ModeToggle.tsx` `MODES` gains `{ value: 'C' as const, label: 'Japanese story' }`.
  - [x] Verify arrow-key nav and the dirty-warning strip need no change (they generalise over
        `MODES.length` and `PathMode`).

- [x] **Task 3: Path C Japanese textarea + Unspecified chapter option + helper text** (AC: 3, 4, 5, 6)
  - [x] Make the input branch three-way: `A` English textarea; `C` `font-ja` "Japanese story" textarea
        (bound to `inputText`/`handleInputChange`); else `<TopicTextarea>`.
  - [x] In the chapter `<select>`, render the `"unspecified"` option **only** when
        `pathMode === 'A' || pathMode === 'C'`; keep the empty placeholder always.
  - [x] Replace the ScopeChip render guard so it shows only for a **recognised** chapter and hides for
        `"unspecified"`; when `"unspecified"`, render the muted helper text.

- [x] **Task 4: Button label, collapsed summary, and validation for C** (AC: 7)
  - [x] Button label ternary: A → "Convert to Japanese", C → "Create story", B → "Generate".
  - [x] Collapsed-summary mode label: add the "Japanese story" case for C; confirm the content preview
        uses `inputText` for C.
  - [x] Confirm `handleGenerate`'s `else` branch already validates C (inputText + chapter). Record that
        no change is needed.

- [x] **Task 5: Store snapshot + `setPathMode` leak guard** (AC: 9, 10)
  - [x] Confirm `StoredInputs`, `generate()`, and `approve()` carry `pathMode`/`chapterTarget` verbatim
        after the type widens (no logic change expected).
  - [x] In `setPathMode`, when switching to `'B'` and `chapterTarget === 'unspecified'`, also set
        `chapterTarget: ''`.

- [x] **Task 6: Session persistence round-trip + stale-mode guard** (AC: 9)
  - [x] Confirm the write path persists `pathMode`/`chapterTarget` verbatim.
  - [x] In the restore path, coerce an invalid/missing `session.pathMode` to `'A'`
        (e.g. `(['A','B','C'] as const).includes(session.pathMode) ? session.pathMode : 'A'`).
        `chapterTarget='unspecified'` restores as-is.

- [x] **Task 7: Update the five contract tests** (AC: 11)
  - [x] `ModeToggle.test.tsx`, `authoringStore.test.ts` (+ AC10 leak case), `useAgUiRun.test.ts`
        (C params + `chapter=unspecified`), `InputPanel.test.tsx` (C textarea, Unspecified
        present/absent, ScopeChip hide + helper text, label, validation), `useSession.test.ts`
        (`pathMode:'C'` + `chapter:'unspecified'` round-trip + stale-mode fallback).
  - [x] `pnpm test` (from `apps/story-generator`) → all green, no unrelated regressions.

- [x] **Task 8: Typecheck, build, and manual browser verification** (AC: 12)
  - [x] `pnpm typecheck` + `pnpm build`.
  - [x] `pnpm dev`; exercise A (chapter + Unspecified), B, C-with-chapter, C-Unspecified; confirm
        ScopeChip hide/show, difficulty labels, and a `pathMode='C'` session restore.

### Review Findings

_Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-07-12. High-risk ACs confirmed correct by the Auditor: the `"unspecified"` literal (AC4), `font-ja` on the Path C textarea (AC3), the AC10 leak guard, the AC9 stale-`pathMode` fallback, AC8 (no B-only params for C), AC6 (ScopeChip hidden + helper), and AC13 (scope fence)._

- [x] [Review][Decision→Patch] Session restore clamps `pathMode` but not `chapterTarget`. **Resolved (RT chose to add the guard):** mirrored the `setPathMode` leak guard on restore — a stale `pathMode:'B'` + `chapterTarget:'unspecified'` session now coerces `chapterTarget` to `''`. Added a covering test. [apps/story-generator/src/hooks/useSession.ts:95-100] (blind+edge)
- [x] [Review][Patch] Collapsed summary prints the raw `"unspecified"` sentinel to the user — now maps to the friendly label "Unspecified" [apps/story-generator/src/components/InputPanel.tsx:132-134] (blind+edge)
- [x] [Review][Patch] Path C collapsed-summary preview now carries `font-ja` conditionally for C [apps/story-generator/src/components/InputPanel.tsx:145-152] (edge)
- [x] [Review][Patch] The `pathMode:'X'` → `'A'` fallback test now seeds the store to `'C'` first, so it genuinely proves the clamp fired [apps/story-generator/src/__tests__/useSession.test.ts] (blind)
- [x] [Review][Patch] Path C empty-input validation test now asserts the "Enter your Japanese story before generating." hint surfaces, not just `phase==='idle'` [apps/story-generator/src/__tests__/InputPanel.test.tsx] (blind)
- [x] [Review][Defer] Pre-existing ScopeChip test hardcodes the `'325 vocab'` magic count [apps/story-generator/src/__tests__/InputPanel.test.tsx:76] — deferred, pre-existing (not introduced by this change)

## Dev Notes

### The five files you touch — exact current shape (verified anchors)

1. **`stores/authoringStore.ts`** — inline `pathMode: 'A' | 'B'` at
   [`:73`](../../apps/story-generator/src/stores/authoringStore.ts#L73) (`StoredInputs`),
   [`:90`](../../apps/story-generator/src/stores/authoringStore.ts#L90) (store shape),
   [`:121`](../../apps/story-generator/src/stores/authoringStore.ts#L121) (`setPathMode` sig). Default
   `pathMode: 'A' as const` at [`:176`](../../apps/story-generator/src/stores/authoringStore.ts#L176).
   `generate()` snapshots `{ inputText, chapterTarget, …, pathMode, … }` at
   [`:222-226`](../../apps/story-generator/src/stores/authoringStore.ts#L222-L226); `approve()` at
   [`:250-255`](../../apps/story-generator/src/stores/authoringStore.ts#L250-L255). `setPathMode` at
   [`:315-326`](../../apps/story-generator/src/stores/authoringStore.ts#L315-L326) — this is where the
   AC10 leak guard goes. **These snapshot writers already spread the live `pathMode`/`chapterTarget`,
   so `'C'`/`'unspecified'` flow through with only the type widened.**

2. **`components/ModeToggle.tsx`** — `MODES` at
   [`:8-11`](../../apps/story-generator/src/components/ModeToggle.tsx#L8-L11); `pendingMode` state typed
   `'A' | 'B' | null` at [`:24`](../../apps/story-generator/src/components/ModeToggle.tsx#L24);
   `handleModeClick(mode: 'A' | 'B')` at
   [`:32`](../../apps/story-generator/src/components/ModeToggle.tsx#L32); arrow-key nav over
   `MODES.length` at [`:41-51`](../../apps/story-generator/src/components/ModeToggle.tsx#L41-L51). Widen
   the two `'A' | 'B'` to `PathMode | null` / `PathMode`; add the C entry. Nothing else changes.

3. **`components/InputPanel.tsx`** — input branch `pathMode === 'A' ? <English textarea> : <TopicTextarea>`
   at [`:166-203`](../../apps/story-generator/src/components/InputPanel.tsx#L166-L203); chapter select
   at [`:205-234`](../../apps/story-generator/src/components/InputPanel.tsx#L205-L234) (options from
   `CHAPTER_OPTIONS`, ScopeChip guard at `:233`); validation `handleGenerate` at
   [`:79-97`](../../apps/story-generator/src/components/InputPanel.tsx#L79-L97) (B-branch vs `else`);
   button label at [`:297`](../../apps/story-generator/src/components/InputPanel.tsx#L297); collapsed
   summary at [`:123-160`](../../apps/story-generator/src/components/InputPanel.tsx#L123-L160). Note the
   existing `useEffect` at [`:58-60`](../../apps/story-generator/src/components/InputPanel.tsx#L58-L60)
   that resets `isConfirmOpen` when `pathMode !== 'B'` — it already covers C (C is not B); no change.

4. **`hooks/useAgUiRun.ts`** — reads `storedInputs?.pathMode ?? store.pathMode` at
   [`:62`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L62); builds base params (runId,
   inputText, chapter, pathMode, temperature, grammar_distribution) at
   [`:70-77`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L70-L77); the Path-B-only block at
   [`:85-92`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L85-L92) is `pathMode === 'B'`-guarded.
   **Path C already works with zero changes here** — it sends the base params (incl. `chapter`, which is
   `"unspecified"` when chosen) and skips the B block. Just verify typecheck is clean.

5. **`hooks/useSession.ts`** — `SessionState.pathMode: 'A' | 'B'` at
   [`:22`](../../apps/story-generator/src/hooks/useSession.ts#L22); restore sets `pathMode: session.pathMode`
   at [`:98`](../../apps/story-generator/src/hooks/useSession.ts#L98) (add the fallback here); write
   persists `pathMode: state.pathMode` / `chapterTarget: state.chapterTarget` at
   [`:142-144`](../../apps/story-generator/src/hooks/useSession.ts#L142-L144). The file already has the
   "guard against stale sessions" idiom (e.g. `topicText` at
   [`:89`](../../apps/story-generator/src/hooks/useSession.ts#L89)) — mirror it for `pathMode`.

### The `"unspecified"` string is a hard contract — do not paraphrase

The backend sentinel is an **exact string comparison** `chapter == "unspecified"` (se3-4, verified in
its Dev Agent Record). The `<option value="unspecified">` **value** must be exactly that (the visible
label "Unspecified — keep original difficulty" is free). If you emit `"Unspecified"`, `"none"`, `""`,
or anything else, the backend routes it into `_parse_chapter` and raises → `GENERATION_FAILED`. This
is the single most breakable line in the story.

### Gotcha: the Unspecified-then-switch-to-B leak (AC10)

`setPathMode` does **not** reset `chapterTarget` today
([`authoringStore.ts:315-326`](../../apps/story-generator/src/stores/authoringStore.ts#L315-L326)). So:
select Unspecified in A or C → `chapterTarget = 'unspecified'` → switch to B. B's `<select>` has no
`"unspecified"` option, so the control shows no selection, **but** `chapterTarget` is still
`'unspecified'` in the store, so B's validation (`missingChapter = chapterTarget === ''` → `false`)
passes and a Path-B run would send `chapter=unspecified` — which the epic forbids for B. Fix in
`setPathMode`: when the target mode is `'B'` **and** `chapterTarget === 'unspecified'`, include
`chapterTarget: ''` in the `set(...)`. Add the `authoringStore.test.ts` case (AC11). This is a
store-level bug that a component-only test would miss.

### Validation already covers C — do not add a branch

`handleGenerate` ([`:79-97`](../../apps/story-generator/src/components/InputPanel.tsx#L79-L97)) branches
`if (pathMode === 'B') {…} else {…}`. Path C takes the `else`, which requires `inputText.trim() !== ''`
**and** `chapterTarget !== ''`. Selecting "Unspecified" sets `chapterTarget = 'unspecified'` (non-empty)
→ chapter check passes. So C validation is correct **without** touching `handleGenerate`. State this in
the completion notes; do not duplicate logic.

### `selectCanGenerate` and the phase machine are mode-agnostic

`selectCanGenerate` ([`authoringStore.ts:411`](../../apps/story-generator/src/stores/authoringStore.ts#L411))
gates only on `phase` (`idle`/`error`), not on `pathMode`. The whole generate → SSE → output/error
cycle is identical for C — you are only choosing *what* gets sent, not *how* the run is driven. Do not
add mode logic to the phase machine, `useAgUiRun`'s lifecycle, or the Generate/Stop button states.

### ScopeChip hides itself, but tighten the render guard (AC6)

`ScopeChip` returns `null` when `CHAPTER_SCOPE[chapter]` is undefined
([`ScopeChip.tsx:52-53`](../../apps/story-generator/src/components/ScopeChip.tsx#L52-L53)), and
`CHAPTER_SCOPE` has no `"unspecified"` key — so it already renders nothing for Unspecified. But the
current render site is `{chapterTarget && <ScopeChip chapter={chapterTarget} … />}`
([`InputPanel.tsx:233`](../../apps/story-generator/src/components/InputPanel.tsx#L233)); for Unspecified
you additionally want the **helper text** shown, so structure it as:
`chapterTarget === 'unspecified'` → render helper `<p>`; else `chapterTarget` → render `<ScopeChip>`.
Do **not** add an `"unspecified"` entry to `CHAPTER_SCOPE` (AC13 — that data is out of scope and would
make the chip render).

### Collapsed-summary polish (minor, within AC7)

The mode-label ternary at [`InputPanel.tsx:126`](../../apps/story-generator/src/components/InputPanel.tsx#L126)
is currently binary (`=== 'B' ? 'Generate from topic' : 'Convert a story'`); make it 3-way so C reads
"Japanese story". The chapter chip at
[`:128-130`](../../apps/story-generator/src/components/InputPanel.tsx#L128-L130) will show
"· unspecified" verbatim for the Unspecified case — optionally prettify to "· Unspecified" (cosmetic;
not required to pass). The content-preview `else` branch
([`:140-147`](../../apps/story-generator/src/components/InputPanel.tsx#L140-L147)) already shows
`inputText` for any non-B mode, so C's pasted Japanese previews correctly.

### Test primitives you already have (match existing style)

- **`ModeToggle.test.tsx`** ([full file](../../apps/story-generator/src/__tests__/ModeToggle.test.tsx)) —
  uses `getAllByRole('tab')`, `_reset()` in before/after, `_setOutputJson`/`_markDirty` for the dirty
  strip. Update "renders two tab buttons" → three; add a click-`tabs[2]` → `pathMode==='C'` assertion
  and a 3-way arrow-key wrap assertion.
- **`authoringStore.test.ts`** — `setPathMode` block starts at
  [`:37`](../../apps/story-generator/src/__tests__/authoringStore.test.ts#L37); follow its
  `getState().setPathMode(…)` + assertion idiom for the `'C'` and the AC10 leak cases.
- **`useAgUiRun.test.ts`** — the Path B URL-param block is at
  [`:487-620`](../../apps/story-generator/src/__tests__/useAgUiRun.test.ts#L487); model a "Path C URL
  params" block on it (assert `url.contains('pathMode=C')`, `inputText=…`, `chapter=…`, and **not**
  `topic=`/`englishDraft=`; a second case with `chapterTarget='unspecified'` asserting
  `chapter=unspecified`). The hook is driven by setting store state then entering `generating` — copy the
  existing setup verbatim.
- **`InputPanel.test.tsx`** — the "Path B mode" describe at
  [`:341`](../../apps/story-generator/src/__tests__/InputPanel.test.tsx#L341) is the template for a new
  "Path C mode" describe (`setPathMode('C')` in `beforeEach`, wrap in `act`). Assert the `font-ja`
  textarea (query by label "Japanese story"), the Unspecified `<option>` present under A/C and absent
  under B (query `screen.getByRole('option', { name: /unspecified/i })` / `queryByRole`), ScopeChip
  hidden + helper text shown when `chapterTarget='unspecified'`, and the "Create story" button label.
- **`useSession.test.ts`** — `writeSession(overrides)` helper at
  [`:9-25`](../../apps/story-generator/src/__tests__/useSession.test.ts#L9-L25); add
  `writeSession({ pathMode: 'C', chapterTarget: 'unspecified' })` → assert both hydrate; and
  `writeSession({ pathMode: 'X' as unknown })` → assert restore falls back to `'A'`.

### Previous-story intelligence (se3-1…se3-4, all done)

- **The backend contract is settled and tested.** se3-4's Dev Agent Record confirms `/run_sse` accepts
  `pathMode=C` and `chapter=unspecified` **with no new query param** (both are free-form `str` query
  params passed straight to `agent.generate`), and that `difficulty` is labelled `"Unspecified"` when no
  target. You are wiring to a green backend — do not re-open it.
- **se3-4 shipped an `isinstance` hardening fix** for malformed Gemini JSON, so a weak Stage-2 result
  surfaces as a clean `GENERATION_FAILED`/`VALIDATION_ERROR` (handled by the existing `_setError` path in
  the store), never a hung stream. The frontend needs no new error handling for C.
- **Frozen-JA fidelity is a backend guarantee** (se3-3 echo prompt + enrichment join-invariant), not a
  frontend concern — your C-Unspecified browser check (AC12) just eyeballs that the output Japanese
  matches the pasted input; you are not asserting byte-equality in a unit test.

### Code style (project-context.md)

- **Japanese text always carries `font-ja`** (Noto Sans JP) — the Path C textarea is Japanese input, so
  it must have `font-ja` (AC3). This is a project non-negotiable, not a preference.
- **Only custom Tailwind tokens** — reuse `paper-text`, `muted`, `border`, `surface-subtle`, `error`,
  `accent`, `accent-subtle` (as the surrounding code does); no arbitrary colours.
- **Compose classes with `cn()`** — never raw string concatenation.
- Succinct docstrings on exported functions/components; block comments for the new C branches; do not
  narrate obvious code (project-context.md §Comments).
- Widened union is `PathMode` from the store — do not re-declare `'A' | 'B' | 'C'` inline anywhere.

### Project Structure Notes

- All changes under `apps/story-generator/src/` (frontend authoring app). Rebuild is not needed for
  package deps (no package source changes); `pnpm dev` from `apps/story-generator` is the dev loop.
- Files: `stores/authoringStore.ts`, `components/ModeToggle.tsx`, `components/InputPanel.tsx`,
  `hooks/useSession.ts` (source) + the five `src/__tests__/*` contract tests. `hooks/useAgUiRun.ts` is
  read/verified; expected no edit beyond the type flow.
- No new files, no new deps, no shadcn/ui primitive needed (native `<select>`/`<textarea>` reused).

### References

- [Source: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)]
  — Story se3-5 ACs; §"Target-difficulty reframing"; §"Routing and call counts" (Unspecified offered for
  A/C only, not B); §"Parameter model: `path_mode='C'` + `chapter='unspecified'` sentinel"; §"Current-State
  Reference → Frontend" (the exact line anchors); Risks ("`chapter='unspecified'` … be a real selectable
  option on the frontend — easy to implement one side only").
- [Source: [`se3-4-two-stage-orchestration-and-japanese-entry-point.md`](se3-4-two-stage-orchestration-and-japanese-entry-point.md)]
  — the merged backend contract this UI targets: `pathMode=C`, `chapter=unspecified` sentinel, no new
  query param, `difficulty="Unspecified"` when no target; the isinstance hardening (clean error surface).
- [Source: [`components/ModeToggle.tsx:8-51`](../../apps/story-generator/src/components/ModeToggle.tsx#L8-L51)]
  — `MODES` registry + arrow-key nav to extend (AC2).
- [Source: [`components/InputPanel.tsx:79-97,166-234,283-299`](../../apps/story-generator/src/components/InputPanel.tsx#L79-L97)]
  — validation, input branch, chapter select + ScopeChip guard, button label (AC3/4/6/7).
- [Source: [`components/ScopeChip.tsx:19-73`](../../apps/story-generator/src/components/ScopeChip.tsx#L19-L73)]
  — `CHAPTER_SCOPE` (source of `CHAPTER_OPTIONS`; no `"unspecified"` key ⇒ chip auto-hides). Do not modify.
- [Source: [`components/SettingsPanel.tsx:60,137-196`](../../apps/story-generator/src/components/SettingsPanel.tsx#L60-L196)]
  — the "gate a control on pathMode" + muted disabled-hint styling precedent to mirror for the Unspecified
  helper text (AC6).
- [Source: [`stores/authoringStore.ts:69-90,121,222-226,250-255,315-326,411`](../../apps/story-generator/src/stores/authoringStore.ts#L69-L90)]
  — `StoredInputs`, store shape, `setPathMode` (AC10 leak guard), snapshot writers, `selectCanGenerate`.
- [Source: [`hooks/useAgUiRun.ts:59-94`](../../apps/story-generator/src/hooks/useAgUiRun.ts#L59-L94)]
  — SSE URL assembly; Path-B block `=== 'B'`-guarded (C rides base params) (AC8).
- [Source: [`hooks/useSession.ts:22,89,98,142-144`](../../apps/story-generator/src/hooks/useSession.ts#L22-L144)]
  — `SessionState.pathMode`, the stale-guard idiom, restore/write sites (AC9).
- [Source: `apps/story-generator/src/__tests__/{ModeToggle,authoringStore,useAgUiRun,InputPanel,useSession}.test.*`]
  — the five contract tests to update (AC11); reuse their `_reset()`/`writeSession`/store-driven patterns.
- [Source: `_bmad-output/project-context.md`] — `font-ja` for Japanese text, custom Tailwind tokens only,
  `cn()` composition, comment style, and the **"verify UI/CSS changes in a browser"** non-negotiable (AC12).

## What does NOT belong in this story

- **No backend change** — `apps/story-generator-backend/` is done (se3-1…se3-4). If C misbehaves, the
  fault is a wrong wire value from this UI (usually the `"unspecified"` string), not the backend.
- **No new query parameter and no new store field** — Path C rides the existing `inputText`/`chapter`;
  the optional target rides the `"unspecified"` sentinel on the existing `chapter` param.
- **No change to `ScopeChip`'s `CHAPTER_SCOPE`** — do not add an `"unspecified"` entry (it would make the
  chip render). The chip hiding is intentional.
- **No change to `TopicTextarea`, the SSE event contract, `useAgUiRun`'s lifecycle/timeout logic, or the
  phase machine** — C reuses all of it unchanged.
- **No eval-harness work** (`eval/run_eval.py`) — that is the optional **se3-6**.
- **No "Unspecified" for Path B** — B keeps requiring a Genki chapter (epic-mandated).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code / bmad-dev-story workflow)

### Debug Log References

- `pnpm typecheck` (apps/story-generator) → 0 errors after the `PathMode` widening (confirms AC1 and
  AC8 — `useAgUiRun.ts` needed no annotation change; `pathMode` flows in from the store types).
- `pnpm test:unit` → **301 passed / 301** (the app's script is `test:unit`, not `test`). Two failures
  surfaced on the first run and were resolved:
  1. Pre-existing "renders chapter select with placeholder and 23 chapter options" saw **25** options
     because Path A (default) now offers "Unspecified" (AC4). Updated the expected count to 25 and the
     comment to "1 placeholder + 1 Unspecified + 23 chapters" — a correct consequence of the feature,
     not an unrelated regression.
  2. My own Path C test used `queryByText(/vocab/)` to assert the ScopeChip was hidden, but that regex
     also matches "vocabulary" inside the new helper text. Tightened to `/\d+ vocab/`.
- `pnpm build` → clean (`tsc -b && vite build`, 1846 modules).
- `pnpm lint` → clean.

### Completion Notes List

- **AC1 (PathMode type):** Added `export type PathMode = 'A' | 'B' | 'C'` above `Phase` in
  `authoringStore.ts` and replaced every inline `'A' | 'B'` union (`StoredInputs`, `AuthoringStore`,
  `setPathMode` sig, `useSession.SessionState`, `ModeToggle` `pendingMode`/`handleModeClick`).
- **AC7 / AC8 — verified, no change:** `handleGenerate`'s `else` branch already validates Path C
  (`inputText` non-empty **and** `chapterTarget !== ''`; `"unspecified"` is non-empty so it passes) — no
  duplicated branch. `useAgUiRun.ts` required no edit: it reads `pathMode` from the (now widened)
  `storedInputs` and stringifies it into `URLSearchParams`; the Path-B-only block stays `=== 'B'`-guarded
  so C sends only the base params (`inputText`, `chapter`, `pathMode`) plus `chapter=unspecified` when
  chosen — verified by the two new `useAgUiRun.test.ts` cases.
- **AC10 (leak guard):** In `setPathMode`, switching **to** `'B'` while `chapterTarget === 'unspecified'`
  now also resets `chapterTarget: ''`; switching to A/C leaves it untouched (unit-tested both ways).
- **`"unspecified"` sentinel:** the `<option>` `value` is the exact string `"unspecified"` (the visible
  label "Unspecified — keep original difficulty" is free text) — the single most breakable line; asserted
  verbatim in `InputPanel.test.tsx`.
- **AC6:** ScopeChip render site restructured to `chapterTarget === 'unspecified' ? <helper> : chapterTarget && <ScopeChip>`
  so no empty chip renders and the muted helper text (`text-xs text-muted mt-1`) shows for Unspecified.
  `CHAPTER_SCOPE` was **not** touched (AC13).
- **AC12 (browser verification):** Drove the running `pnpm dev` server (Vite, backend reported
  "connected") with a headless Chromium (Playwright) script — **13/13 checks passed**: 3 tabs with the
  third labelled "Japanese story"; Path C renders the `#input-text` textarea carrying `font-ja` with the
  "Japanese story" label; Unspecified option present for A **and** C, absent for B; ScopeChip shows for a
  real chapter ("325 vocab" @ Genki I Ch.6) and hides for Unspecified with the helper text shown; C button
  label "Create story"; B button label "Generate". Screenshots captured for Path C (chapter + Unspecified)
  and Path B. **Scope note:** live end-to-end LLM generations (the AC12 `difficulty` label / frozen-JA
  fidelity checks) were **not** run — those exercise the already-merged, se3-4-tested backend, not this
  frontend-only story; the exact wire output this UI produces (`pathMode=C`, `chapter=unspecified`, no
  `topic`/`englishDraft`) is verified by the `useAgUiRun` unit tests.
- **AC13 (scope fence):** all changes confined to `apps/story-generator/src/` (4 source files + 5 test
  files). No backend, schema, wire-format, `ScopeChip` data, `TopicTextarea`, or SSE-contract change; no
  new query param and no new store field.

### File List

- `apps/story-generator/src/stores/authoringStore.ts` — added `PathMode` type; widened 3 sites; AC10 leak guard in `setPathMode`.
- `apps/story-generator/src/components/ModeToggle.tsx` — added the C tab; widened `pendingMode`/`handleModeClick` to `PathMode`.
- `apps/story-generator/src/components/InputPanel.tsx` — three-way input branch (C `font-ja` textarea); Unspecified option for A/C; ScopeChip-vs-helper-text guard; C button label; 3-way collapsed-summary mode label.
- `apps/story-generator/src/hooks/useSession.ts` — widened `SessionState.pathMode` to `PathMode`; stale/out-of-range `pathMode` → `'A'` fallback on restore.
- `apps/story-generator/src/__tests__/ModeToggle.test.tsx` — 3 tabs; C click; 3-way arrow-key wrap.
- `apps/story-generator/src/__tests__/authoringStore.test.ts` — `setPathMode('C')`; AC10 leak case (+ real-chapter and A→C preservation cases).
- `apps/story-generator/src/__tests__/useAgUiRun.test.ts` — Path C URL params (pathMode=C, inputText, chapter, no topic/englishDraft; `chapter=unspecified` case).
- `apps/story-generator/src/__tests__/InputPanel.test.tsx` — Path C describe (font-ja textarea, Unspecified value/gating, ScopeChip hide + helper text, "Create story" label, validation); updated Path A option-count to 25.
- `apps/story-generator/src/__tests__/useSession.test.ts` — `pathMode:'C'` + `chapter:'unspecified'` round-trip; stale-mode → `'A'` fallback.

### Change Log

- 2026-07-12 — se3-5 implemented: added Path C ("Japanese story") input mode and the "Unspecified"
  optional-target-difficulty option (A/C only), riding the existing `inputText`/`chapter` wire params
  with the `chapter="unspecified"` sentinel. Frontend-only; 301/301 unit tests green; typecheck, build,
  and lint clean; browser-verified (13/13 UI checks). Status → review.
