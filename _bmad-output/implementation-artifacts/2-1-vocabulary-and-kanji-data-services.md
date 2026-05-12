# Story 2.1: Vocabulary & Kanji Data Services

Status: done

## Story

As a **reader**,
I want word lookups to return instantly from locally loaded data,
so that tapping any word in a story feels immediate with no network dependency during reading.

## Acceptance Criteria

**AC1 — kanji-data.json committed and correct shape**

Given `apps/web/public/kanji-data.json` is committed to the repo
When reviewed
Then it is a JSON object keyed by literal kanji character (e.g. `{"食": {...}}`); every entry matches the `KanjiEntry` type from `@nihonnohon/schema` with fields `char`, `kw`, `m`, `onY`, `kunY`

**AC2 — vocabService initialisation and lookup**

Given `apps/web/src/services/vocabService.ts`
When the service is initialised
Then `fetch('/vocab.json')` is called once; the result is loaded into an in-memory `Map<number, VocabEntry>` keyed by integer `id`; subsequent calls to `lookupVocab(id: number): VocabEntry | null` are synchronous O(1) lookups; `null` is returned when `id` has no entry

**AC3 — vocabService tests**

Given `apps/web/src/__tests__/vocabService.test.ts`
When run
Then covers: lookup returns correct `VocabEntry` for a known id; lookup returns `null` for an unknown id; the in-memory map is populated from a fixture dataset and not re-fetched on subsequent calls; tests do not use `vi.mock` to stub the return value of `lookupVocab` itself

**AC4 — kanjiService initialisation and lookup**

Given `apps/web/src/services/kanjiService.ts`
When the service is initialised
Then `fetch('/kanji-data.json')` is called once; loaded into an in-memory `Map<string, KanjiEntry>` keyed by literal kanji character; `lookupKanji(char: string): KanjiEntry | null` is synchronous; `null` returned for characters not in the file

**AC5 — kanjiService tests**

Given `apps/web/src/__tests__/kanjiService.test.ts`
When run
Then covers: lookup returns correct `KanjiEntry` for a known character; returns `null` for an unknown character; tests use a fixture dataset, not a mock of the service function itself

**AC6 — graceful degradation for non-kanji characters**

Given a word containing multiple kanji characters (e.g. `食べる`)
When `lookupKanji` is called for each character individually
Then returns `KanjiEntry` for `食`; returns `null` for hiragana characters `べ` and `る` — this is expected graceful degradation, not an error

## Tasks / Subtasks

- [x] Task 1: Verify kanji-data.json (AC1)
  - [x] Confirm `apps/web/public/kanji-data.json` exists and is committed
  - [x] Spot-check 2–3 entries to confirm they have `char`, `kw`, `m`, `onY`, `kunY` fields per `KanjiEntry` type

- [x] Task 2: Implement `vocabService.ts` (AC2)
  - [x] Create `apps/web/src/services/vocabService.ts`
  - [x] Export `initVocab(): Promise<void>` — fetches `/vocab.json` on first call only; no-op on repeat calls
  - [x] Export `lookupVocab(id: number): VocabEntry | null` — synchronous; works after `initVocab` resolves
  - [x] Export `_initVocabFromData(data: VocabEntry[]): void` and `_resetVocab(): void` for test isolation
  - [x] Import `VocabEntry` from `@nihonnohon/schema`

- [x] Task 3: Write `vocabService.test.ts` (AC3)
  - [x] Create `apps/web/src/__tests__/vocabService.test.ts`
  - [x] Use small inline fixture array (3–4 entries)
  - [x] Call `_initVocabFromData(fixture)` in `beforeEach`; call `_resetVocab()` in `afterEach`
  - [x] Test: known id returns correct VocabEntry; unknown id returns null
  - [x] Test: calling `initVocab()` twice does not fetch a second time (assert `fetch` call count = 1 via `vi.fn()`)

- [x] Task 4: Implement `kanjiService.ts` (AC4, AC6)
  - [x] Create `apps/web/src/services/kanjiService.ts`
  - [x] Export `initKanji(): Promise<void>` — fetches `/kanji-data.json` on first call only
  - [x] Export `lookupKanji(char: string): KanjiEntry | null` — synchronous
  - [x] Export `_initKanjiFromData(data: Record<string, KanjiEntry>): void` and `_resetKanji(): void` for test isolation
  - [x] Import `KanjiEntry` from `@nihonnohon/schema`

- [x] Task 5: Write `kanjiService.test.ts` (AC5, AC6)
  - [x] Create `apps/web/src/__tests__/kanjiService.test.ts`
  - [x] Use small inline fixture object (2–3 kanji entries)
  - [x] Call `_initKanjiFromData(fixture)` in `beforeEach`; call `_resetKanji()` in `afterEach`
  - [x] Test: known kanji character returns correct KanjiEntry
  - [x] Test: unknown character returns null
  - [x] Test: hiragana character (e.g. `べ`) returns null — confirming graceful degradation

- [x] Task 6: Verify tests pass
  - [x] Run `pnpm test:unit` in `apps/web` — all tests pass including the existing `buildVocab.test.ts`

### Review Findings

- [x] [Review][Patch] `lookupVocab`/`lookupKanji` return `null` silently when called before init — add `console.warn` when map is null so programmer errors surface during development [vocabService.ts:14, kanjiService.ts:17]
- [x] [Review][Patch] Race condition: concurrent `initVocab`/`initKanji` calls both pass the null guard before either fetch resolves, issuing two fetches and last-write-wins overwrite — fix: cache the in-flight Promise; clear on rejection to preserve retry behaviour [vocabService.ts:6, kanjiService.ts:6]
- [x] [Review][Patch] No `res.ok` check before `res.json()` — HTTP 404/500 bodies parsed as data or throw SyntaxError, leaving map permanently null with no error surfaced to caller [vocabService.ts:8, kanjiService.ts:8]
- [x] [Review][Patch] `vi.unstubAllGlobals()` and second `_resetVocab()` called inline in test body, not in `afterEach` — if any `expect` throws before those lines, global `fetch` stub leaks into subsequent tests [vocabService.test.ts:50]
- [x] [Review][Patch] `kanjiService.test.ts` never tests the `initKanji` fetch path — no double-call no-op test, no `vi` import; async initialisation is entirely untested [kanjiService.test.ts]
- [x] [Review][Patch] `kw: null` branch of `KanjiEntry` type never exercised in fixture — add one fixture entry with `kw: null` to confirm the service handles and returns it correctly [kanjiService.test.ts]
- [x] [Review][Defer] Test-only exports (`_initVocabFromData`, `_resetVocab`, etc.) are part of the public module surface with only a naming convention as guard [vocabService.ts:18, kanjiService.ts:22] — deferred, pre-existing
- [x] [Review][Defer] `kanji-data.json` `char` field duplicates the map key — if they ever diverge the service returns a corrupt entry silently [kanjiService.ts:9] — deferred, pre-existing
- [x] [Review][Defer] Duplicate `id` values in `vocab.json` would silently drop earlier entries in the Map constructor [vocabService.ts:9] — deferred, architecture prevents this (append-only CSV with stable IDs)

## Dev Notes

### kanji-data.json is already committed — do NOT rebuild it

`apps/web/public/kanji-data.json` already exists in the repo (pre-Epic-2 task completed by RT before this story began). The file contains the 1026 kyouiku kanji fetched from kanjiapi.dev.

**Critical:** The actual `KanjiEntry` type in `packages/schema/src/types.ts` uses abbreviated field names — do NOT use the field names mentioned in the Epic 1 retro (those were an earlier draft):

```ts
// ACTUAL KanjiEntry in packages/schema/src/types.ts:
interface KanjiEntry {
  char: string
  kw: string | null  // heisig_en: short Heisig keyword — used as the label in KanjiBreakdown UI
  m: string[]        // full dictionary meanings — shown in kanji detail drill-down view
  onY: string[]
  kunY: string[]
}
```

The data file is already keyed by literal character: `{ "食": { "char": "食", "kw": "eat", "m": [...], ... } }`. AC1 just needs a spot-check that the shape is correct — no new data files to create.

### Service architecture pattern

Both services follow the same pattern: lazy singleton initialisation behind a module-level Map.

```ts
// vocabService.ts — skeleton
import type { VocabEntry } from '@nihonnohon/schema'

let vocabMap: Map<number, VocabEntry> | null = null

/** Fetches /vocab.json once and loads it into the in-memory map. No-op on repeat calls. */
export async function initVocab(): Promise<void> {
  if (vocabMap !== null) return
  const res = await fetch('/vocab.json')
  const data: VocabEntry[] = await res.json()
  vocabMap = new Map(data.map(e => [e.id, e]))
}

/** O(1) synchronous lookup. Returns null when id has no entry. */
export function lookupVocab(id: number): VocabEntry | null {
  return vocabMap?.get(id) ?? null
}

// Test-only helpers — never call these in production code
export function _initVocabFromData(data: VocabEntry[]): void {
  vocabMap = new Map(data.map(e => [e.id, e]))
}
export function _resetVocab(): void {
  vocabMap = null
}
```

```ts
// kanjiService.ts — skeleton
import type { KanjiEntry } from '@nihonnohon/schema'

let kanjiMap: Map<string, KanjiEntry> | null = null

/** Fetches /kanji-data.json once and loads it into the in-memory map. No-op on repeat calls. */
export async function initKanji(): Promise<void> {
  if (kanjiMap !== null) return
  const res = await fetch('/kanji-data.json')
  const data: Record<string, KanjiEntry> = await res.json()
  kanjiMap = new Map(Object.entries(data))
}

/** O(1) synchronous lookup by literal kanji character. Returns null for hiragana, katakana, or unknown kanji. */
export function lookupKanji(char: string): KanjiEntry | null {
  return kanjiMap?.get(char) ?? null
}

// Test-only helpers — never call these in production code
export function _initKanjiFromData(data: Record<string, KanjiEntry>): void {
  kanjiMap = new Map(Object.entries(data))
}
export function _resetKanji(): void {
  kanjiMap = null
}
```

### Test file location

Place test files in `apps/web/src/__tests__/` (per `project-context.md`'s canonical structure, consistent with the existing `buildVocab.test.ts`). The architecture doc shows service tests co-located, but `project-context.md` is the authoritative rule for `apps/web`.

### Test isolation pattern

```ts
// vocabService.test.ts pattern
import { lookupVocab, _initVocabFromData, _resetVocab } from '@/services/vocabService'
import type { VocabEntry } from '@nihonnohon/schema'

const fixture: VocabEntry[] = [
  { id: 1, word: 'お早う', reading: 'おはよう', meaning: 'Good morning', lesson: 'Genki I Intro' },
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
]

beforeEach(() => _initVocabFromData(fixture))
afterEach(() => _resetVocab())

// Do NOT use vi.mock(() => ({ lookupVocab: vi.fn() })) — test the real function
```

```ts
// kanjiService.test.ts pattern
import { lookupKanji, _initKanjiFromData, _resetKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

const fixture: Record<string, KanjiEntry> = {
  '食': { char: '食', kw: 'eat', m: ['eat', 'food'], onY: ['ショク'], kunY: ['た.べる'] },
  '学': { char: '学', kw: 'study', m: ['study', 'learning'], onY: ['ガク'], kunY: ['まな.ぶ'] },
}

beforeEach(() => _initKanjiFromData(fixture))
afterEach(() => _resetKanji())
```

### Vitest environment

Tests run in the default `jsdom` environment — no `// @vitest-environment node` header required. The `_initFromData` helpers bypass `fetch` entirely so no fetch mocking is needed.

### "Not re-fetched on subsequent calls" test

To prove `initVocab()` only fetches once, stub `fetch` before calling it:

```ts
it('does not fetch again on second initVocab call', async () => {
  _resetVocab()                                      // ensure clean state
  const mockFetch = vi.fn().mockResolvedValue({
    json: async () => fixture,
  })
  vi.stubGlobal('fetch', mockFetch)
  await initVocab()
  await initVocab()                                  // second call — should be no-op
  expect(mockFetch).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})
```

### Data access rules

- Never `import vocabData from '@/data/vocab.json'` or similar static import — use the service
- Both data files served from `apps/web/public/` → fetched as `/vocab.json` and `/kanji-data.json`
- After `initVocab()` / `initKanji()` resolves, all subsequent lookups are synchronous

### What this story does NOT include

- Wiring `initVocab()` / `initKanji()` into app startup (`main.tsx`) — that happens in Story 2.5 when the ReaderRoute is built and needs the services live
- Using these services in any React component — Story 2.3 (WordToken) and Story 2.4 (InfoPanel/KanjiBreakdown) will import and call them

### Project Structure Notes

**New files (CREATE):**
- `apps/web/src/services/vocabService.ts`
- `apps/web/src/services/kanjiService.ts`
- `apps/web/src/__tests__/vocabService.test.ts`
- `apps/web/src/__tests__/kanjiService.test.ts`

**Existing files (VERIFY ONLY — do not modify):**
- `apps/web/public/kanji-data.json` — already committed; spot-check shape only
- `apps/web/public/vocab.json` — generated by turbo build-vocab; already present

**No changes to packages.** These services are `apps/web` concerns; the `@nihonnohon/schema` types they import are already compiled.

### References

- `KanjiEntry` and `VocabEntry` types: [packages/schema/src/types.ts]
- Data loading rule: [project-context.md — Data Loading section]
- Test file location: [project-context.md — Unit Tests section]
- Service file location: [architecture.md — Where Does Code Go table]
- kanji-data.json existence: [epic-1-retro-2026-05-12.md — Pre-Epic-2 Critical Task]
- Graceful degradation rule: [project-context.md — Edge Cases section]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- kanji-data.json confirmed committed with correct `KanjiEntry` shape (`char`, `kw`, `m`, `onY`, `kunY`). All 1026 kyouiku entries present, no null kw values in current data.
- `vocabService.ts`: lazy singleton Map. `initVocab()` fetches `/vocab.json` once; repeat calls are no-ops (guarded by null check). `lookupVocab()` returns `VocabEntry | null` synchronously.
- `kanjiService.ts`: same pattern. `lookupKanji()` returns `null` for hiragana, katakana, punctuation, and any character not in the file — graceful degradation confirmed by tests.
- Test isolation via `_initFromData` / `_reset` helpers; no vi.mock of the service functions themselves. `initVocab` double-call test stubs `fetch` globally and confirms call count = 1.
- All 15 tests pass (4 vocab, 6 kanji, 5 existing buildVocab). No regressions.

### File List

- `apps/web/src/services/vocabService.ts` (new)
- `apps/web/src/services/kanjiService.ts` (new)
- `apps/web/src/__tests__/vocabService.test.ts` (new)
- `apps/web/src/__tests__/kanjiService.test.ts` (new)
