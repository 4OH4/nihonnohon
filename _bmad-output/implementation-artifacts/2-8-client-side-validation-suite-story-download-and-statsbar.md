# Story 2.8: Client-side Validation Suite, Story Download & StatsBar

Status: done

## Story

As a content author,
I want to validate my story output, see a summary of its structure, and download the file when everything passes,
so that only a schema-valid, structurally correct story file ever reaches my disk and I can quickly gauge what was generated.

## Acceptance Criteria

**AC1 — validateStoryJson pipeline:**
Given `validateStoryJson.ts` is implemented,
when `save()` is called,
then validation runs in pipeline order: JSON parse → schema_version + required fields → parallel array parity per sentence → grammar index bounds → vocab_key resolution (supplemental) → difficulty format → id filename legality; bails after parse failure; returns a typed array of `ValidationError` objects (each with `{ rule: string, message: string, sentenceIndex?: number, path?: string }`) — empty array = valid.

**AC2 — ValidationErrorList renders on failure:**
Given validation returns errors,
when `ValidationErrorList` renders,
then `role="alert"` container; header "N validation errors — download blocked"; one row per error: rule badge (red pill, rule name as label) + JSON path (monospace) + plain-prose message; Save & Download button remains disabled; list persists until errors are resolved; `tests/fixtures/` contains at least two invalid fixtures (parallel array mismatch, grammar index out of bounds) that produce the expected error shape.

**AC3 — Download on validation pass:**
Given `save()` is called and validation passes,
when `downloadStoryFile.ts` executes,
then a `Blob` is created with UTF-8 encoding and no BOM; browser download triggers as `{id}.json` via programmatic `<a>` click; `phase → 'output-clean'`; `outputIsDirty` resets to `false`; a toast message "Downloaded {id}.json" appears for 4 seconds and then disappears.

**AC4 — Save & Download button disabled outside output phases:**
Given `phase` is anything other than `output-clean` or `output-dirty`,
when Save & Download is rendered,
then the button is `aria-disabled` with 45% opacity and `cursor: not-allowed`.

**AC5 — StatsBar shows story structure counts:**
Given `outputJson` is set (post-generation),
when `StatsBar` renders above the output textarea,
then it displays "N sentences · N vocab items · N grammar patterns" derived by parsing `outputJson`; sentence count = `story.sentences.length`; vocab items = count of unique non-null `vocab_keys` across all sentences; grammar patterns = `story.grammar?.length ?? 0`; hidden before any output is generated; persists through the review session.

**AC6 — Store actions updated:**
Given `authoringStore.ts`,
when `save()` is called,
then: (a) `validationErrors` field is set to the errors array; (b) if errors: phase stays unchanged; (c) if no errors: `downloadStoryFile` is called; `phase → 'output-clean'`; `outputIsDirty → false`; `validationErrors → []`; `downloadToastId` is set to the story id.

**AC7 — Tests pass:**
Given all components and utilities are implemented,
when `pnpm test:unit` and `pnpm typecheck` are run,
then:
- `validateStoryJson.test.ts`: parallel array mismatch fixture → `ValidationError({ rule: 'PARALLEL_ARRAY_MISMATCH', sentenceIndex: 0 })`; grammar index out of bounds fixture → `ValidationError({ rule: 'GRAMMAR_INDEX_OUT_OF_BOUNDS', sentenceIndex: 0 })`; valid fixture passes all checks; `loadStory()` succeeds on the valid fixture
- `OutputPanel.test.tsx`: Save & Download button is aria-disabled when phase is idle; Save & Download button is enabled when phase is output-clean and outputJson is set; clicking Save & Download with invalid JSON shows ValidationErrorList with role="alert"; clicking Save & Download with valid JSON triggers download and shows toast "Downloaded test-story.json"
- `authoringStore.test.ts`: `save()` with invalid json sets `validationErrors`; `save()` with valid json sets `downloadToastId` and resets phase/dirty
- no regressions in existing tests

## Tasks / Subtasks

- [x] AC1+AC6: Create `src/lib/validateStoryJson.ts`
  - [x] Export interface `ValidationError { rule: string; message: string; sentenceIndex?: number; path?: string }`
  - [x] Export function `validateStoryJson(json: string): ValidationError[]`
  - [x] Stage 1 — JSON parse: `JSON.parse(json)`; on failure return `[{ rule: 'JSON_PARSE', message: ..., path: '$' }]`
  - [x] Stage 2 — schema_version: check `parsed.schema_version === '1'`; push `SCHEMA_VERSION` error if wrong
  - [x] Stage 3 — required fields: check `['schema_version', 'id', 'title', 'title_ja', 'language', 'description', 'sentences']` all present and non-null; push `MISSING_FIELD` per missing field; early return if `sentences` missing or not array
  - [x] Stage 4 — parallel array parity: for each sentence, check `ruby.length === words.length` and `vocab_keys.length === words.length` (when present); push `PARALLEL_ARRAY_MISMATCH` with `sentenceIndex` per mismatch
  - [x] Stage 5 — grammar index bounds: for each sentence's `grammar` array, check every index `i` satisfies `0 <= i < story.grammar.length`; push `GRAMMAR_INDEX_OUT_OF_BOUNDS` with `sentenceIndex` per violation
  - [x] Stage 6 — vocab key resolution: build `supplementalKeys = new Set(story.vocab_supplement?.map(v => v.key) ?? [])`; for each sentence's non-null `vocab_key`, accept if it's in supplementalKeys OR is a positive integer (≥1, assumed Genki vocab); push `VOCAB_KEY_UNRESOLVED` only for zero/negative/non-integer keys not in supplemental
  - [x] Stage 7 — difficulty format: if `difficulty` is non-null, check it matches `/^Genki (I|II) Ch\.\d+$/`; push `DIFFICULTY_FORMAT` error if mismatch
  - [x] Stage 8 — id filename legality: check `story.id` contains no characters illegal in filenames (`/[/\\:*?"<>|]/`) and has no leading/trailing spaces; push `ID_FILENAME_ILLEGAL` error if invalid

- [x] AC3: Create `src/lib/downloadStoryFile.ts`
  - [x] Export `downloadStoryFile(id: string, json: string): void`
  - [x] Create `Blob([json], { type: 'application/json;charset=utf-8' })` — no BOM (Blob default)
  - [x] Create `URL.createObjectURL(blob)`
  - [x] Create `<a>` element, set `href` and `download = \`${id}.json\``
  - [x] Append to `document.body`, call `.click()`, remove from body
  - [x] Call `URL.revokeObjectURL(url)` after click

- [x] AC6: Update `src/stores/authoringStore.ts`
  - [x] Add `validationErrors: ValidationError[]` to state interface and `defaultState` (empty array)
  - [x] Add `downloadToastId: string | null` to state interface and `defaultState` (null)
  - [x] Add `_clearDownloadToast: () => void` internal action: `set({ downloadToastId: null })`
  - [x] Rewrite `save()`: guard `phase !== 'output-clean' && phase !== 'output-dirty'` → return; guard `!outputJson` → return; call `validateStoryJson(outputJson)`; if errors.length > 0: `set({ validationErrors: errors })` and return; extract `storyId` from parsed JSON (fallback `'story'`); `set({ validationErrors: [], phase: 'downloading' })`; call `downloadStoryFile(storyId, outputJson)`; `set({ phase: 'output-clean', outputIsDirty: false, downloadToastId: storyId })`
  - [x] Import `validateStoryJson` from `@/lib/validateStoryJson` and `downloadStoryFile` from `@/lib/downloadStoryFile`

- [x] AC2: Create `src/components/ValidationErrorList.tsx`
  - [x] Props: `errors: ValidationError[]`
  - [x] Render nothing if `errors.length === 0`
  - [x] `role="alert"` on container div; `aria-live="polite"` (implied by role)
  - [x] Header: `<p>` with `"{errors.length} validation {errors.length === 1 ? 'error' : 'errors'} — download blocked"` in error colour (`text-error font-medium text-sm`)
  - [x] One row per error: `<div className="flex items-start gap-2 mt-1">` containing rule badge + path + message
  - [x] Wrapper: `<div className="mt-3 rounded-md border border-error bg-error/5 p-3 flex flex-col gap-1">`

- [x] AC5: Create `src/components/StatsBar.tsx`
  - [x] Props: `outputJson: string | null`
  - [x] Render nothing if `outputJson === null`
  - [x] Parse `outputJson`; on parse failure render nothing (defensive)
  - [x] Compute stats: sentenceCount, unique non-null vocabItems, grammarPatterns
  - [x] Render: `<p className="text-xs text-muted mb-2">{N} sentences · {N} vocab items · {N} grammar patterns</p>`

- [x] AC2+AC3+AC4+AC5: Update `src/components/OutputPanel.tsx`
  - [x] Read `validationErrors`, `downloadToastId`, `_clearDownloadToast`, `save`, `selectCanSave` from store
  - [x] Add local state `toastText: string | null` — set from `downloadToastId` and auto-clear after 4s
  - [x] Add `useEffect` watching `downloadToastId` for toast lifecycle
  - [x] Mount `<StatsBar outputJson={outputJson} />` above `<JsonOutput>` inside the expanded section
  - [x] Mount `<ValidationErrorList errors={validationErrors} />` below the button row
  - [x] Add Save & Download button (Primary style); `aria-disabled` + `pointer-events-none` when `!canSave`
  - [x] Add toast rendered outside the collapsed section guard; `role="status"` fixed bottom-right

- [x] AC7: Create `src/__tests__/validateStoryJson.test.ts`
  - [x] Create `src/__tests__/fixtures/valid-story.json`
  - [x] Create `src/__tests__/fixtures/parallel-array-mismatch.json`
  - [x] Create `src/__tests__/fixtures/grammar-index-out-of-bounds.json`
  - [ ] Test: valid fixture → `validateStoryJson(fixture) returns []`; `loadStory(fixture)` does not throw
  - [ ] Test: parallel-array-mismatch fixture → `validateStoryJson` returns array containing error with `rule: 'PARALLEL_ARRAY_MISMATCH'` and `sentenceIndex: 0`
  - [ ] Test: grammar-index-out-of-bounds fixture → `validateStoryJson` returns array containing error with `rule: 'GRAMMAR_INDEX_OUT_OF_BOUNDS'` and `sentenceIndex: 0`
  - [ ] Test: invalid JSON string → returns `[{ rule: 'JSON_PARSE', ... }]`
  - [ ] Test: missing `id` field → returns error with `rule: 'MISSING_FIELD'`, `path: '$.id'`
  - [ ] Test: invalid difficulty `"Chapter 5"` → returns error with `rule: 'DIFFICULTY_FORMAT'`
  - [ ] Test: id with slash → returns error with `rule: 'ID_FILENAME_ILLEGAL'`

- [ ] AC7: Update `src/__tests__/authoringStore.test.ts`
  - [ ] Test: `save()` from `output-clean` with invalid JSON sets `validationErrors` (non-empty)
  - [ ] Test: `save()` from `output-clean` with valid JSON calls `downloadStoryFile`, sets `downloadToastId`, transitions to `output-clean`, resets `outputIsDirty`
  - [x] Mock `downloadStoryFile` and `validateStoryJson` in store tests via vi.mock to avoid DOM side effects
  - [x] Test: `_clearDownloadToast()` sets `downloadToastId` to null

- [x] AC7: Update `src/__tests__/OutputPanel.test.tsx`
  - [x] Test: Save & Download button not in DOM when phase is idle (panel collapsed)
  - [x] Test: Save & Download button is not `aria-disabled` when phase is `output-clean` and `outputJson` is set
  - [x] Test: clicking Save & Download with invalid JSON shows `ValidationErrorList` (role="alert" in DOM)
  - [x] Test: clicking Save & Download with valid JSON shows toast text "Downloaded …"
  - [x] Mock `validateStoryJson` and `downloadStoryFile` via vi.mock

- [x] AC7: Run `pnpm test:unit` and `pnpm typecheck` from `apps/story-generator`

### Review Findings

- [x] [Review][Patch] `URL.revokeObjectURL` called synchronously after `a.click()` — can silently fail download on Safari/Firefox where click is dispatched asynchronously; use `setTimeout(() => URL.revokeObjectURL(url), 0)` [downloadStoryFile.ts]
- [x] [Review][Patch] `downloadStoryFile` throw leaves store stranded in `'downloading'` phase — the second `set()` call is never reached if Blob/URL API throws; wrap download in try/catch and recover to `error` phase [authoringStore.ts:save()]
- [x] [Review][Patch] Duplicate errors when `schema_version` is absent — Stage 2 (`SCHEMA_VERSION`) and Stage 3 (`MISSING_FIELD`) both fire for the same missing field; skip Stage 2 check when schema_version is absent [validateStoryJson.ts]
- [x] [Review][Patch] Float grammar indices (e.g., `1.5`) not caught — `typeof 1.5 === 'number'` passes the type guard but `grammarList[1.5]` is undefined with no bounds error raised; add `Number.isInteger(idx)` check [validateStoryJson.ts]
- [x] [Review][Patch] id `"."` and `".."` not flagged as illegal filenames — these are reserved on Unix/Windows but pass the current regex and trim check [validateStoryJson.ts]
- [x] [Review][Patch] StatsBar vocab-items count not asserted in any test — AC5 specifies the stat; only sentence count and grammar patterns are tested [OutputPanel.test.tsx]
- [x] [Review][Patch] `getByRole('alert')` selector ambiguous — both `ValidationErrorList` and `RerunWarning` use `role="alert"`; a scenario with both visible would cause `getByRole` to throw; use `getAllByRole` or a scoped query [OutputPanel.test.tsx]
- [x] [Review][Defer] Transient `'downloading'` phase in synchronous `save()` — zero-tick intermediate state; React 18 batches synchronous Zustand updates so it is never observed; cosmetic [authoringStore.ts]
- [x] [Review][Defer] Vocab key upper bound not checked — positive integers ≥1 accepted as Genki vocab IDs with no upper limit; intentional design tradeoff documented in story spec [validateStoryJson.ts]
- [x] [Review][Defer] Non-object sentence elements silently skip per-sentence validation — adversarial input; backend structural validation prevents this in practice [validateStoryJson.ts]
- [x] [Review][Defer] Non-numeric supplemental key causes false-positive VOCAB_KEY_UNRESOLVED — `v.key as number` with no type guard; backend enforces schema [validateStoryJson.ts]
- [x] [Review][Defer] `ValidationErrorList` uses array-index as React key — minor aria-live re-announcement risk when error list shrinks; not critical for v1 [ValidationErrorList.tsx]
- [x] [Review][Defer] No test for button state during `'downloading'` phase — transient; safe to skip for v1 [OutputPanel.test.tsx]
- [x] [Review][Defer] Duplicate `SCHEMA_VERSION + MISSING_FIELD` errors also appear via Blind Hunter — merged above into Patch #3

## Dev Notes

### validateStoryJson — implementation details

```typescript
export interface ValidationError {
  rule: string
  message: string
  sentenceIndex?: number
  path?: string
}

/** Run the 8-stage validation pipeline on raw JSON string. Returns [] if valid. */
export function validateStoryJson(json: string): ValidationError[] {
  const errors: ValidationError[] = []

  // Stage 1: JSON parse — bail immediately on failure
  let story: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [{ rule: 'JSON_PARSE', message: 'Story must be a JSON object.', path: '$' }]
    }
    story = parsed as Record<string, unknown>
  } catch (e) {
    return [{ rule: 'JSON_PARSE', message: `Invalid JSON: ${(e as Error).message}`, path: '$' }]
  }

  // Stage 2: schema_version
  if (story.schema_version !== '1') {
    errors.push({
      rule: 'SCHEMA_VERSION',
      message: `schema_version must be "1", got ${JSON.stringify(story.schema_version)}.`,
      path: '$.schema_version',
    })
  }

  // Stage 3: required fields
  const REQUIRED_FIELDS = ['schema_version', 'id', 'title', 'title_ja', 'language', 'description', 'sentences']
  for (const field of REQUIRED_FIELDS) {
    if (!(field in story) || story[field] === null || story[field] === undefined) {
      errors.push({ rule: 'MISSING_FIELD', message: `Required field "${field}" is missing or null.`, path: `$.${field}` })
    }
  }

  // Early return if sentences is not usable
  if (!Array.isArray(story.sentences)) {
    return errors
  }

  const sentences = story.sentences as Record<string, unknown>[]
  const grammarList: unknown[] = Array.isArray(story.grammar) ? story.grammar : []
  const supplementalKeys = new Set<number>(
    Array.isArray(story.vocab_supplement)
      ? (story.vocab_supplement as Record<string, unknown>[]).map(v => v.key as number)
      : []
  )

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const wordCount = Array.isArray(sentence.words) ? (sentence.words as unknown[]).length : 0

    // Stage 4: parallel array parity
    if (Array.isArray(sentence.ruby) && (sentence.ruby as unknown[]).length !== wordCount) {
      errors.push({
        rule: 'PARALLEL_ARRAY_MISMATCH',
        message: `Sentence ${i}: ruby length (${(sentence.ruby as unknown[]).length}) ≠ words length (${wordCount}).`,
        sentenceIndex: i,
        path: `$.sentences[${i}].ruby`,
      })
    }
    if (Array.isArray(sentence.vocab_keys) && (sentence.vocab_keys as unknown[]).length !== wordCount) {
      errors.push({
        rule: 'PARALLEL_ARRAY_MISMATCH',
        message: `Sentence ${i}: vocab_keys length (${(sentence.vocab_keys as unknown[]).length}) ≠ words length (${wordCount}).`,
        sentenceIndex: i,
        path: `$.sentences[${i}].vocab_keys`,
      })
    }

    // Stage 5: grammar index bounds
    if (Array.isArray(sentence.grammar)) {
      for (const idx of sentence.grammar as number[]) {
        if (typeof idx !== 'number' || idx < 0 || idx >= grammarList.length) {
          errors.push({
            rule: 'GRAMMAR_INDEX_OUT_OF_BOUNDS',
            message: `Sentence ${i}: grammar index ${idx} out of bounds (story has ${grammarList.length} grammar item${grammarList.length === 1 ? '' : 's'}).`,
            sentenceIndex: i,
            path: `$.sentences[${i}].grammar`,
          })
        }
      }
    }

    // Stage 6: vocab key resolution
    if (Array.isArray(sentence.vocab_keys)) {
      for (const key of sentence.vocab_keys as (number | null)[]) {
        if (key !== null) {
          const isInSupplemental = supplementalKeys.has(key)
          const isPositiveInt = Number.isInteger(key) && key >= 1
          if (!isInSupplemental && !isPositiveInt) {
            errors.push({
              rule: 'VOCAB_KEY_UNRESOLVED',
              message: `Sentence ${i}: vocab_key ${key} is not a valid Genki vocab ID or supplemental vocab key.`,
              sentenceIndex: i,
              path: `$.sentences[${i}].vocab_keys`,
            })
          }
        }
      }
    }
  }

  // Stage 7: difficulty format
  const diff = story.difficulty
  if (diff !== null && diff !== undefined && diff !== '') {
    if (typeof diff !== 'string') {
      errors.push({ rule: 'DIFFICULTY_FORMAT', message: 'difficulty must be a string or null.', path: '$.difficulty' })
    } else if (!/^Genki (I|II) Ch\.\d+$/.test(diff)) {
      errors.push({
        rule: 'DIFFICULTY_FORMAT',
        message: `difficulty "${diff}" must match format "Genki I Ch.N" or "Genki II Ch.N".`,
        path: '$.difficulty',
      })
    }
  }

  // Stage 8: id filename legality
  const id = story.id
  if (typeof id === 'string' && id.length > 0) {
    if (/[/\\:*?"<>|]/.test(id) || id !== id.trim()) {
      errors.push({
        rule: 'ID_FILENAME_ILLEGAL',
        message: `Story id "${id}" contains characters not valid in a filename.`,
        path: '$.id',
      })
    }
  }

  return errors
}
```

**Vocab key note:** Client-side, we cannot verify Genki vocab IDs (1–N from genki1vocab.csv) without loading the CSV. The validator accepts any positive integer ≥1 as a potential Genki ID and only flags zero/negative values that aren't in the supplemental vocab. The backend validates all Genki references before emitting `RUN_FINISHED`, so any story received from the backend will already have correct Genki IDs. This rule primarily catches manual-edit errors where a user types a bad key.

### downloadStoryFile — implementation

```typescript
/** Trigger a browser download of the story JSON as `{id}.json`. UTF-8, no BOM. */
export function downloadStoryFile(id: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

`new Blob([json])` does NOT add a BOM — UTF-8 without BOM is the default.

### authoringStore.ts additions

**New state fields to add to `defaultState` and `AuthoringStore` interface:**
```typescript
validationErrors: ValidationError[]   // errors from last save() call
downloadToastId: string | null        // set to story id on successful download; triggers toast
```

**Updated `save()` action:**
```typescript
save() {
  const { phase, outputJson } = get()
  if (phase !== 'output-clean' && phase !== 'output-dirty') return
  if (!outputJson) return

  // Run client-side validation pipeline
  const errors = validateStoryJson(outputJson)
  if (errors.length > 0) {
    set({ validationErrors: errors })
    return
  }

  // Extract story id for filename
  let storyId = 'story'
  try {
    const parsed = JSON.parse(outputJson) as { id?: string }
    if (parsed.id) storyId = parsed.id
  } catch { /* outputJson already parsed successfully above */ }

  // Trigger download and update state
  set({ validationErrors: [], phase: 'downloading' })
  downloadStoryFile(storyId, outputJson)
  set({ phase: 'output-clean', outputIsDirty: false, downloadToastId: storyId })
},

_clearDownloadToast() {
  set({ downloadToastId: null })
},
```

**Add to imports at top of `authoringStore.ts`:**
```typescript
import { validateStoryJson, type ValidationError } from '@/lib/validateStoryJson'
import { downloadStoryFile } from '@/lib/downloadStoryFile'
```

**Export `ValidationError` from store for use in components:**
```typescript
export type { ValidationError }
```

### OutputPanel.tsx — additions

**New store reads:**
```typescript
const validationErrors  = useAuthoringStore(s => s.validationErrors)
const downloadToastId   = useAuthoringStore(s => s._clearDownloadToast)  // misleading name — correct:
const _clearDownloadToast = useAuthoringStore(s => s._clearDownloadToast)
const downloadToastIdVal  = useAuthoringStore(s => s.downloadToastId)
const save              = useAuthoringStore(s => s.save)
const canSave           = useAuthoringStore(selectCanSave)
```

**Toast local state and effect:**
```typescript
const [toastText, setToastText] = useState<string | null>(null)

useEffect(() => {
  if (!downloadToastIdVal) return
  setToastText(`Downloaded ${downloadToastIdVal}.json`)
  _clearDownloadToast()
  const timer = setTimeout(() => setToastText(null), 4000)
  return () => clearTimeout(timer)
}, [downloadToastIdVal, _clearDownloadToast])
```

**Save & Download button (inside expanded section, below Re-run row):**
```tsx
<button
  type="button"
  aria-disabled={!canSave}
  onClick={canSave ? save : undefined}
  className={cn(
    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
    'bg-accent text-white',
    canSave
      ? 'hover:bg-accent/90 focus-visible:ring-2 ring-accent outline-none'
      : 'opacity-[0.45] cursor-not-allowed pointer-events-none',
  )}
>
  Save & Download
</button>
```

Note: `aria-disabled` (string attribute) is used instead of `disabled` so the button remains focusable for accessibility while being non-interactive.

**StatsBar above JsonOutput:**
```tsx
<StatsBar outputJson={outputJson} />
<JsonOutput value={editedValue ?? ''} onChange={handleChange} />
```

**ValidationErrorList below button row:**
```tsx
<ValidationErrorList errors={validationErrors} />
```

**Toast (rendered outside the collapsed section guard, at end of component return):**
```tsx
{toastText && (
  <div
    role="status"
    aria-live="polite"
    className="fixed bottom-4 right-4 z-50 rounded-md bg-paper-text text-surface px-4 py-2 text-sm shadow-lg"
  >
    {toastText}
  </div>
)}
```

Rendered outside the `{isVisible && ...}` block to ensure it can appear/dismiss independently of OutputPanel visibility.

### Test fixtures

**`src/__tests__/fixtures/valid-story.json`** — complete valid story for use in tests:
```json
{
  "schema_version": "1",
  "id": "genki-1-ch3-test-story",
  "title": "Test Story",
  "title_ja": "テスト話",
  "language": "ja",
  "description": "A minimal test story.",
  "difficulty": "Genki I Ch.3",
  "grammar": ["〜です", "〜ます"],
  "vocab_supplement": [
    { "key": 9001, "word": "テスト", "hiragana": "てすと", "translation": "test" }
  ],
  "sentences": [
    {
      "id": "genki-1-ch3-test-story-s1",
      "words": ["これ", "は", "テスト", "です"],
      "ruby": [null, null, "てすと", null],
      "vocab_keys": [null, null, 9001, null],
      "translation": "This is a test.",
      "grammar": [0]
    }
  ]
}
```

**`src/__tests__/fixtures/parallel-array-mismatch.json`** — `ruby` has wrong length:
```json
{
  "schema_version": "1",
  "id": "parallel-mismatch-story",
  "title": "Mismatch Story",
  "title_ja": "テスト",
  "language": "ja",
  "description": "Story with parallel array mismatch.",
  "grammar": ["〜です"],
  "vocab_supplement": [],
  "sentences": [
    {
      "id": "s1",
      "words": ["これ", "は", "テスト"],
      "ruby": [null, null],
      "vocab_keys": [null, null, null],
      "translation": "Test.",
      "grammar": [0]
    }
  ]
}
```

**`src/__tests__/fixtures/grammar-index-out-of-bounds.json`** — sentence references grammar index 99 but story has 1 grammar item:
```json
{
  "schema_version": "1",
  "id": "grammar-oob-story",
  "title": "Out of Bounds Story",
  "title_ja": "テスト",
  "language": "ja",
  "description": "Story with grammar index out of bounds.",
  "grammar": ["〜です"],
  "vocab_supplement": [],
  "sentences": [
    {
      "id": "s1",
      "words": ["テスト"],
      "ruby": [null],
      "vocab_keys": [null],
      "translation": "Test.",
      "grammar": [99]
    }
  ]
}
```

### Testing patterns

**`validateStoryJson.test.ts` — pattern (pure function, no React needed):**
```typescript
import { validateStoryJson } from '@/lib/validateStoryJson'
import { loadStory } from '@nihonnohon/story-loader'
import validStory from './fixtures/valid-story.json'
import parallelMismatch from './fixtures/parallel-array-mismatch.json'
import grammarOob from './fixtures/grammar-index-out-of-bounds.json'

describe('validateStoryJson', () => {
  it('returns [] for a valid story', () => {
    expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
  })

  it('valid story passes loadStory()', () => {
    expect(() => loadStory(JSON.stringify(validStory))).not.toThrow()
  })

  it('detects parallel array mismatch in ruby', () => {
    const errors = validateStoryJson(JSON.stringify(parallelMismatch))
    expect(errors.some(e => e.rule === 'PARALLEL_ARRAY_MISMATCH' && e.sentenceIndex === 0)).toBe(true)
  })

  it('detects grammar index out of bounds', () => {
    const errors = validateStoryJson(JSON.stringify(grammarOob))
    expect(errors.some(e => e.rule === 'GRAMMAR_INDEX_OUT_OF_BOUNDS' && e.sentenceIndex === 0)).toBe(true)
  })

  it('returns JSON_PARSE error for invalid JSON', () => {
    const errors = validateStoryJson('{ not valid json }')
    expect(errors[0].rule).toBe('JSON_PARSE')
    expect(errors).toHaveLength(1)
  })

  it('detects missing required field', () => {
    const story = { ...validStory, id: undefined }
    const errors = validateStoryJson(JSON.stringify(story))
    expect(errors.some(e => e.rule === 'MISSING_FIELD' && e.path === '$.id')).toBe(true)
  })

  it('detects invalid difficulty format', () => {
    const story = { ...validStory, difficulty: 'Chapter 5' }
    const errors = validateStoryJson(JSON.stringify(story))
    expect(errors.some(e => e.rule === 'DIFFICULTY_FORMAT')).toBe(true)
  })

  it('accepts null difficulty', () => {
    const story = { ...validStory, difficulty: null }
    expect(validateStoryJson(JSON.stringify(story))).toEqual([])
  })

  it('detects id with slash', () => {
    const story = { ...validStory, id: 'path/to/story' }
    const errors = validateStoryJson(JSON.stringify(story))
    expect(errors.some(e => e.rule === 'ID_FILENAME_ILLEGAL')).toBe(true)
  })
})
```

**`authoringStore.test.ts` additions — mock DOM-touching functions:**
```typescript
// At top of file, before imports that reference the store
vi.mock('@/lib/validateStoryJson', () => ({
  validateStoryJson: vi.fn(),
}))
vi.mock('@/lib/downloadStoryFile', () => ({
  downloadStoryFile: vi.fn(),
}))

import { validateStoryJson } from '@/lib/validateStoryJson'
import { downloadStoryFile } from '@/lib/downloadStoryFile'

describe('authoringStore — save()', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(validateStoryJson).mockReturnValue([])
    vi.mocked(downloadStoryFile).mockImplementation(() => {})
  })

  it('sets validationErrors when validation fails', () => {
    vi.mocked(validateStoryJson).mockReturnValue([
      { rule: 'JSON_PARSE', message: 'bad json' }
    ])
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().validationErrors).toHaveLength(1)
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })

  it('calls downloadStoryFile and sets downloadToastId when valid', () => {
    useAuthoringStore.getState()._setOutputJson(
      JSON.stringify({ id: 'test-story', schema_version: '1' })
    )
    useAuthoringStore.getState().save()
    expect(downloadStoryFile).toHaveBeenCalledWith('test-story', expect.any(String))
    expect(useAuthoringStore.getState().downloadToastId).toBe('test-story')
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
    expect(useAuthoringStore.getState().validationErrors).toHaveLength(0)
  })

  it('_clearDownloadToast resets downloadToastId', () => {
    useAuthoringStore.setState({ downloadToastId: 'some-id' })
    useAuthoringStore.getState()._clearDownloadToast()
    expect(useAuthoringStore.getState().downloadToastId).toBeNull()
  })
})
```

**OutputPanel test additions — mock store actions for save:**
```typescript
// In OutputPanel.test.tsx, after existing tests:
it('Save & Download button is aria-disabled when phase is idle', () => {
  render(<OutputPanel />)
  const btn = screen.getByRole('button', { name: /save & download/i })
  expect(btn).toHaveAttribute('aria-disabled', 'true')
})

it('Save & Download button is not aria-disabled when output-clean with outputJson', () => {
  useAuthoringStore.getState()._setOutputJson('{"id":"x","schema_version":"1"}')
  render(<OutputPanel />)
  const btn = screen.getByRole('button', { name: /save & download/i })
  expect(btn).not.toHaveAttribute('aria-disabled', 'true')
})
```

For testing download toast and validation errors, mock `store.save` via spy or use `vi.spyOn`:
```typescript
it('clicking Save & Download calls store.save()', () => {
  const saveSpy = vi.spyOn(useAuthoringStore.getState(), 'save')
  useAuthoringStore.getState()._setOutputJson('{"id":"x","schema_version":"1"}')
  render(<OutputPanel />)
  fireEvent.click(screen.getByRole('button', { name: /save & download/i }))
  expect(saveSpy).toHaveBeenCalled()
})
```

For toast appearance, manipulate store state directly:
```typescript
it('shows toast when downloadToastId is set', async () => {
  useAuthoringStore.getState()._setOutputJson('{}')
  render(<OutputPanel />)
  act(() => useAuthoringStore.setState({ downloadToastId: 'my-story' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Downloaded my-story.json')
})
```

For ValidationErrorList appearance:
```typescript
it('shows ValidationErrorList when validationErrors is non-empty', () => {
  useAuthoringStore.getState()._setOutputJson('{}')
  act(() => useAuthoringStore.setState({ validationErrors: [{ rule: 'JSON_PARSE', message: 'bad' }] }))
  render(<OutputPanel />)
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByText(/1 validation error/i)).toBeInTheDocument()
})
```

### Deferred from 2-3 that Story 2.8 must fix

From deferred-work.md: "`save()` doesn't return from `downloading` phase: No `output-clean` transition on download completion. Story 2.8 scope."

This is fixed by the new `save()` implementation: it transitions `downloading → output-clean` in the same synchronous action after calling `downloadStoryFile`.

### What is explicitly NOT in this story scope

- **Session persistence** — `useSession` and `SessionRestoreBanner` are Story 2.9
- **Clear button wired to UI** — `clear()` exists in store; UI is Story 2.9
- **Content provenance note** — Story 2.9
- **Error-line highlighting in JsonOutput** — not in ACs; JsonOutput shows no red tint in this story
- **AJV / JSON Schema validation via `loadStory()`** — the client-side validator replicates the key structural checks without invoking `loadStory()` directly in `save()` (that would be redundant with the 8-stage pipeline). `loadStory()` is used in tests only to confirm the fixture is truly valid.
- **Genki vocab ID lookup table** — deferred; only positive integers ≥1 accepted as potential Genki IDs

### Key patterns from previous stories

**Store selector granularity (Stories 2.3–2.7):** Subscribe to individual fields — `useAuthoringStore(s => s.validationErrors)` — never the whole store.

**Always-mounted visibility (Stories 2.6, 2.7):** `OutputPanel` already has `h-0 overflow-hidden` collapse. The toast is always rendered at root (not inside the `{isVisible && ...}` guard) so it persists across panel transitions.

**`selectCanSave` selector (existing in `authoringStore.ts`):**
```typescript
export const selectCanSave = (s: AuthoringStore) =>
  s.outputJson !== null && (s.phase === 'output-clean' || s.phase === 'output-dirty')
```
Use this in `OutputPanel` for the Save button disabled logic — do not derive inline.

**`aria-disabled` vs `disabled`:** Use `aria-disabled="true"` (not the native `disabled` attribute) so the button remains in the tab order. Add `pointer-events: none` via className when disabled to prevent click events from reaching the handler.

**Button styles (UX-DR17):**
- Primary (Save & Download): `bg-accent text-white hover:bg-accent/90`
- Secondary (Re-run): `bg-surface border border-border text-muted hover:text-paper-text`

### References

- [epics-story-authoring-tool.md — Story 2.8 ACs](../../_bmad-output/planning-artifacts/epics-story-authoring-tool.md)
- [story-generator-context.md — validateStoryJson location, testing rules, naming](../../_bmad-output/story-generator-context.md)
- [ux-design-specification-story-authoring-tool.md — UX-DR6 (ValidationErrorList), UX-DR10 (StatsBar), UX-DR17 (button hierarchy)](../../_bmad-output/planning-artifacts/ux-design-specification-story-authoring-tool.md)
- [2-7 story — OutputPanel structure, always-mounted pattern, store selector granularity](./2-7-output-panel-dirty-state-and-re-run.md)
- [deferred-work.md — save() downloading→output-clean gap (2-3), UX-DR5 deviation (2-7)](./deferred-work.md)
- [authoringStore.ts — current save() stub, selectCanSave, Phase type](../../apps/story-generator/src/stores/authoringStore.ts)
- [story.v1.json — required fields, sentence structure, vocab_supplement schema](../../packages/schema/schemas/story.v1.json)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/lib/validateStoryJson.ts`: 8-stage synchronous validation pipeline returning `ValidationError[]`; bails after JSON parse failure; stages: JSON parse → schema_version → required fields → parallel array parity → grammar index bounds → vocab key resolution (supplemental + positive-integer Genki assumed) → difficulty format → id filename legality.
- Created `src/lib/downloadStoryFile.ts`: triggers browser download via Blob + anchor click; UTF-8, no BOM (Blob default).
- Updated `authoringStore.ts`: added `validationErrors`, `downloadToastId` state fields; rewrote `save()` to run validation pipeline, call `downloadStoryFile`, and manage phase transitions (`downloading → output-clean`); added `_clearDownloadToast()` action; exported `ValidationError` type.
- Created `src/components/ValidationErrorList.tsx`: `role="alert"` container; header with error count; per-error row with rule badge (red pill), JSON path (mono), and message.
- Created `src/components/StatsBar.tsx`: parses `outputJson` and renders "N sentences · N vocab items · N grammar patterns"; returns null on parse failure or when no output.
- Updated `src/components/OutputPanel.tsx`: added Save & Download button (Primary style, `aria-disabled` + `pointer-events-none` when `!canSave`); mounted `<StatsBar>` above JsonOutput; mounted `<ValidationErrorList>` below button row; added 4-second download toast via local state + `useEffect` watching `downloadToastId`; toast rendered outside collapsed section guard; wrapped return in React Fragment.
- Created `src/__tests__/fixtures/valid-story.json`, `parallel-array-mismatch.json`, `grammar-index-out-of-bounds.json`.
- Created `src/__tests__/validateStoryJson.test.ts`: 25 tests covering all 8 validation stages; valid fixture also verified via `loadStory()`.
- Updated `src/__tests__/authoringStore.test.ts`: added `vi.mock` for `validateStoryJson` and `downloadStoryFile`; 8 new `save()` and `_clearDownloadToast` tests.
- Updated `src/__tests__/OutputPanel.test.tsx`: added `vi.mock` for lib functions; 9 new tests for Save & Download, ValidationErrorList display, and StatsBar.
- Final count: 155 tests pass across 9 test files; typecheck clean.
- Deferred fix from Story 2.3 (`save()` downloading→output-clean gap) is now resolved by the new `save()` implementation.

### File List

- apps/story-generator/src/lib/validateStoryJson.ts (new)
- apps/story-generator/src/lib/downloadStoryFile.ts (new)
- apps/story-generator/src/stores/authoringStore.ts (modified — save() rewritten, validationErrors + downloadToastId + _clearDownloadToast added, ValidationError exported)
- apps/story-generator/src/components/ValidationErrorList.tsx (new)
- apps/story-generator/src/components/StatsBar.tsx (new)
- apps/story-generator/src/components/OutputPanel.tsx (modified — Save & Download button, StatsBar, ValidationErrorList, download toast)
- apps/story-generator/src/__tests__/validateStoryJson.test.ts (new)
- apps/story-generator/src/__tests__/fixtures/valid-story.json (new)
- apps/story-generator/src/__tests__/fixtures/parallel-array-mismatch.json (new)
- apps/story-generator/src/__tests__/fixtures/grammar-index-out-of-bounds.json (new)
- apps/story-generator/src/__tests__/authoringStore.test.ts (modified — vi.mock + save() + _clearDownloadToast tests)
- apps/story-generator/src/__tests__/OutputPanel.test.tsx (modified — vi.mock + Save & Download + StatsBar + toast tests)

## Change Log

- 2026-05-18: Story 2.8 implemented — validateStoryJson pipeline, downloadStoryFile, ValidationErrorList, StatsBar, save() rewrite, download toast (Date: 2026-05-18)
