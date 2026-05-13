# Story 3.4: Local File Upload & Validation

Status: done

## Story

As a **reader**,
I want to load a story JSON file from my device and read it exactly like a built-in library story,
so that I can use community-authored stories without them needing to be in the built-in library.

## Acceptance Criteria

**AC1 — File picker trigger always visible**

Given a "Load a story from your device" trigger at the bottom of the library story list
When the library is rendered (whether stories are visible or the empty state is shown)
Then the trigger is always visible; tapping it opens the platform native file picker (`<input type="file" accept=".json">`); no custom file-picker UI

**AC2 — Valid file navigates to reader**

Given a valid story JSON file is selected
When read and passed to `loadStory()`
Then a UUID is generated via `crypto.randomUUID()`; raw JSON stored in IndexedDB via `indexedDbService.saveStory(uuid, rawJson)`; user navigated to `/read/:uuid` via `useNavigate()`

**AC3 — Loader falls back to IndexedDB for UUID routes**

Given the user navigates to `/read/:uuid` (a UUID not in the manifest)
When the `ReaderRoute` loader runs
Then manifest finds no match; `indexedDbService.getStory(uuid)` is called; if it returns data, `loadStory()` is called and the story renders identically to a library story

**AC4 — UUID not found renders specific error**

Given the UUID is opened on a different device or after storage is cleared
When IndexedDB returns nothing
Then `ErrorBoundary` renders `ReaderError` with status 410; the message reads: `"This story is not available on this device."` with a `← Back to library` link

**AC5 — SCHEMA_INVALID inline error**

Given an invalid story file is selected (missing required field)
When `loadStory()` throws `LoaderError('SCHEMA_INVALID', ...)`
Then inline error appears below upload trigger (not a modal): `"This doesn't look like a valid Nihon no Hon story."` + the AJV hint from `err.message` + a `"View the story format documentation"` link; error colour is `text-error` (#C0392B)

**AC6 — UNSUPPORTED_VERSION inline error**

Given an unsupported schema version file
When `loadStory()` throws `LoaderError('UNSUPPORTED_VERSION', ...)`
Then inline error: `"This story uses a format version this app doesn't support."` + spec link

**AC7 — PARSE_FAILED inline error**

Given a file that is not valid JSON
When `loadStory()` throws `LoaderError('PARSE_FAILED', ...)`
Then inline error: `"This file couldn't be read as a story."` + spec link

**AC8 — Error is dismissible**

Given an inline upload error is displayed
When the user taps elsewhere on the page
Then the error is dismissed; selecting a library story (navigates away) also dismisses it

**AC9 — Optional fields absent still loads**

Given a story file with absent optional fields (no `difficulty`, no `ruby` arrays)
When loaded
Then story renders normally; `DifficultyBadge` not shown; ruby toggle has no visible effect; no error

**AC10 — IndexedDB service unit tests**

Given `indexedDbService.test.ts`
When run
Then covers: save and retrieve round-trip; `getStory` returns `null` for unknown UUID; uses real in-memory IndexedDB via `fake-indexeddb` — not a `vi.mock` stub of the service

**AC11 — ReaderRoute.test.tsx updated**

Given `ReaderRoute.test.tsx`
When run
Then all existing tests from Story 3.3 pass unchanged; new tests added: loader calls `getStory` when ID not in manifest; loader returns StoryModel from IndexedDB hit; loader throws 410 when IndexedDB also misses; `ReaderError` renders "isn't available" message for status 410

**AC12 — LibraryRoute.test.tsx updated**

Given `LibraryRoute.test.tsx`
When run
Then all 10 existing tests from Story 3.2 pass unchanged; new tests added: file upload trigger is always visible; valid upload calls `saveStory` and navigates; SCHEMA_INVALID shows inline error; UNSUPPORTED_VERSION shows inline error; PARSE_FAILED shows inline error

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/src/services/indexedDbService.ts` (AC2, AC3, AC4, AC10)
  - [x] Open IndexedDB `'nihonnohon-local-stories'` v1 with object store `'stories'`; cache the `IDBDatabase` instance after first open
  - [x] Export `saveStory(uuid: string, rawJson: unknown): Promise<void>` — puts value keyed by uuid into `'stories'` store
  - [x] Export `getStory(uuid: string): Promise<unknown | null>` — gets by uuid; returns `null` (not `undefined`) when absent
  - [x] Export `_resetDb(): void` — test-only; closes cached db and sets to null; required for test isolation with `fake-indexeddb`

- [x] Task 2: Create `apps/web/src/__tests__/indexedDbService.test.ts` (AC10)
  - [x] Add `import 'fake-indexeddb/auto'` as first import (replaces global `indexedDB`)
  - [x] Add `fake-indexeddb` as a devDependency in `apps/web/package.json`
  - [x] `beforeEach(() => _resetDb())` — clears cached db connection so each test opens fresh
  - [x] Test: `saveStory` then `getStory` with same UUID returns the original object
  - [x] Test: `getStory` with unknown UUID returns `null`
  - [x] Do NOT use `vi.mock` to stub `saveStory` or `getStory` — tests exercise the real service against in-memory IDB

- [x] Task 3: Update `apps/web/src/routes/ReaderRoute.tsx` (AC3, AC4)
  - [x] Import `getStory` from `@/services/indexedDbService`
  - [x] Update loader: after `manifest.find()` returns no match, call `await getStory(storyId)` instead of immediately throwing 404
  - [x] If `getStory` returns non-null: call `loadStory(rawJson)` and return the `StoryModel`
  - [x] If `getStory` returns null: throw `new Response('Gone', { status: 410 })`
  - [x] Update `ReaderError`: add `const isStorageNotFound = isRouteErrorResponse(error) && error.status === 410`; render `"This story is not available on this device."` for that branch; the existing 404 branch and fallback branch are preserved unchanged
  - [x] Do NOT change the `ReaderRoute` component body — it is structurally frozen

- [x] Task 4: Update `apps/web/src/__tests__/ReaderRoute.test.tsx` (AC11)
  - [x] Add mock for `indexedDbService` alongside existing mocks; mock defaults `getStory` to `mockResolvedValue(null)`
  - [x] Import `getStory` from `@/services/indexedDbService` after mock declaration
  - [x] Update AC tracking comment: added "PRESERVED (Story 3.3)", "SUPERSEDED (Story 3.4)", and "NEW (Story 3.4)" blocks
  - [x] Add `describe('loader — IndexedDB fallback', ...)`: loader returns StoryModel from IDB hit
  - [x] Existing loader test updated: "throws 404" → "throws 410 when not in manifest and not in IndexedDB" (behavior change)
  - [x] Add `describe('ReaderError — storage not found', ...)`: renders "not available on this device" for 410; shows Back to library link
  - [x] `afterEach` teardown with `vi.clearAllMocks()` confirmed present from Story 3.3

- [x] Task 5: Update `apps/web/src/routes/LibraryRoute.tsx` (AC1, AC2, AC5, AC6, AC7, AC8, AC9)
  - [x] Added imports: `useRef`, `useNavigate`, `loadStory`, `LoaderError`, `saveStory`
  - [x] Added `uploadError` state, `fileInputRef`, `navigate`, click-outside dismiss `useEffect`
  - [x] Implemented `handleFileChange`: reads file as text, `loadStory(text)`, saves to IDB, navigates
  - [x] Removed placeholder button from empty state; always-visible upload CTA added after conditional block
  - [x] Added `errorTitle()` helper and `FORMAT_SPEC_URL` constant

- [x] Task 6: Update `apps/web/src/__tests__/LibraryRoute.test.tsx` (AC12)
  - [x] Added mocks for `indexedDbService` (saveStory), `@nihonnohon/story-loader` (loadStory), `useNavigate`, `FileReader`
  - [x] Updated AC tracking comment
  - [x] Test: upload button always visible when stories are present
  - [x] Test: valid upload calls `saveStory` with UUID and `navigate` to `/read/:uuid`
  - [x] Test: SCHEMA_INVALID inline error with title, AJV hint, spec link
  - [x] Test: UNSUPPORTED_VERSION inline error
  - [x] Test: PARSE_FAILED inline error
  - [x] `afterEach(() => vi.clearAllMocks())` present

- [x] Task 7: Install `fake-indexeddb` devDependency (AC10)
  - [x] Installed via `pnpm add -D fake-indexeddb --filter @nihonnohon/web`
  - [x] Verified in `apps/web/package.json` devDependencies

- [x] Task 8: Run tests and verify (all ACs)
  - [x] `pnpm test:unit` — 139 tests pass (9 new), 0 failures, 0 regressions
  - [x] `pnpm typecheck` — 0 TypeScript errors across all packages

### Review Findings

- [x] [Review][Patch] `saveStory` resolves on `request.onsuccess` not `tx.oncomplete` — fixed: now resolves on `tx.oncomplete`, rejects on `tx.onerror`/`tx.onabort` [apps/web/src/services/indexedDbService.ts:29]
- [x] [Review][Patch] Non-`LoaderError` exceptions in `handleFileChange` are silently swallowed — fixed: added `else` branch that wraps unexpected errors in `LoaderError('PARSE_FAILED', ...)` so the user always gets feedback [apps/web/src/routes/LibraryRoute.tsx:handleFileChange]
- [x] [Review][Defer] Concurrent `openDb()` race — two callers both seeing `db === null` before first open settles each fire `indexedDB.open()`; benign today but leaves an unclosed connection that blocks future DB version upgrades [apps/web/src/services/indexedDbService.ts:8] — deferred, low risk in single-user SPA; no parallel IDB calls occur in current flows
- [x] [Review][Defer] `loadStory(text)` return value discarded in `handleFileChange` — called for validation side-effects only; raw JSON saved separately via `JSON.parse(text)`; functional but non-obvious contract [apps/web/src/routes/LibraryRoute.tsx:handleFileChange] — deferred, intentional architecture (IDB stores raw wire format, loader re-validates on read)
- [x] [Review][Defer] `_resetDb` exported from production module without env guard — test-only helper is callable from any part of the app [apps/web/src/services/indexedDbService.ts:48] — deferred, consistent with pre-existing pattern (`_resetVocab`, `_resetKanji` in other services)
- [x] [Review][Defer] Manifest ID / UUID collision — a library slug that happens to equal a locally-stored UUID would permanently shadow the local upload with no warning [apps/web/src/routes/ReaderRoute.tsx loader] — deferred, vanishingly unlikely given human-readable slug vs UUID format mismatch
- [x] [Review][Defer] `fetchManifest` called on every reader navigation, no client-side cache — pre-existing issue not introduced here [apps/web/src/routes/ReaderRoute.tsx loader] — deferred, pre-existing gap; browser cache mitigates

## Dev Notes

### IndexedDB Service Implementation

```typescript
// apps/web/src/services/indexedDbService.ts

const DB_NAME = 'nihonnohon-local-stories'
const STORE_NAME = 'stories'
const DB_VERSION = 1

let db: IDBDatabase | null = null

/** Opens (or reuses) the IndexedDB database, creating the object store on first run. */
function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Saves a story JSON object keyed by client-generated UUID. */
export async function saveStory(uuid: string, rawJson: unknown): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const request = tx.objectStore(STORE_NAME).put(rawJson, uuid)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Retrieves a stored story by UUID. Returns null if not found. */
export async function getStory(uuid: string): Promise<unknown | null> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(uuid)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

/** Test-only: close cached db connection so tests open a fresh instance. */
export function _resetDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

**Why module-level singleton:** `openDb()` resolves immediately on subsequent calls by returning the cached `db`. IndexedDB `open()` operations are async — the singleton avoids repeated opens within a session.

**Why `put(value, key)` not `add()`:** `put` is an upsert — safe if the user somehow uploads the same file twice (same UUID collision is impossible with `crypto.randomUUID()`, but is idiomatic IDB).

**Why `_resetDb()` is needed in tests:** `fake-indexeddb/auto` replaces the global `indexedDB` before each test file loads, but the module-level `db` variable persists across tests within the same file. Calling `_resetDb()` in `beforeEach` forces each test to re-open, ensuring isolation.

### Updated ReaderRoute Loader

```typescript
export async function loader({ params }: LoaderFunctionArgs): Promise<StoryModel> {
  if (!params.storyId) throw new Response('Not Found', { status: 404 })
  const storyId = params.storyId
  await Promise.all([initVocab(), initKanji()])

  // Path 1: manifest lookup for library stories
  const manifest = await fetchManifest()
  const entry = manifest.find(e => e.id === storyId)
  if (entry) {
    const res = await fetch(`/stories/${entry.filename}`)
    if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
    return loadStory(await res.json())
  }

  // Path 2: IndexedDB fallback for locally-uploaded stories (UUIDs)
  const rawJson = await getStory(storyId)
  if (rawJson !== null) {
    return loadStory(rawJson)
  }

  // Path 3: Not found in either source
  throw new Response('Gone', { status: 410 })
}
```

**Why status 410 (Gone) for UUID-not-found:** Status 404 is already used for "story ID not in manifest". A distinct status allows `ReaderError` to render a different, contextually helpful message without ambiguity. 410 semantically means "was here, now gone" — which precisely describes an IndexedDB entry that existed on a different device or was cleared.

**Why NOT throw `LoaderError`:** `LoaderError` is an application error for story format/parse failures. A missing UUID is an infrastructure miss, not a format error. Throwing a `Response` lets React Router's error element discriminate the case without pattern-matching on `err.code`.

### Updated ReaderError Component

```tsx
export function ReaderError() {
  const error = useRouteError()
  const isManifestNotFound = isRouteErrorResponse(error) && error.status === 404
  const isStorageNotFound = isRouteErrorResponse(error) && error.status === 410

  let message: string
  if (isManifestNotFound) {
    message = 'Story not found.'
  } else if (isStorageNotFound) {
    message = "This story is not available on this device."
  } else {
    message = 'Failed to load this story.'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-paper-bg p-8 text-center">
      <h1 className="text-paper-text font-semibold mb-2">{message}</h1>
      <Link to="/" className="text-sm underline text-muted">
        ← Back to library
      </Link>
    </div>
  )
}
```

### File Upload Error Messages

```typescript
// Module-level constant — update URL to match actual GitHub repo before shipping
const FORMAT_SPEC_URL =
  'https://github.com/rupertthomas/nihonnohon/blob/main/schemas/story.v1.json'

function errorTitle(code: 'SCHEMA_INVALID' | 'UNSUPPORTED_VERSION' | 'PARSE_FAILED'): string {
  switch (code) {
    case 'SCHEMA_INVALID':
      return "This doesn't look like a valid Nihon no Hon story."
    case 'UNSUPPORTED_VERSION':
      return "This story uses a format version this app doesn't support."
    case 'PARSE_FAILED':
      return "This file couldn't be read as a story."
  }
}
```

**AJV hint display:** For `SCHEMA_INVALID`, the `LoaderError.message` contains `ajv.errorsText(validate.errors)` — e.g. `"Story JSON failed schema validation: data/sentences/0/words must be array"`. Display this below the user-facing title in a monospace font so the hint is readable. Do NOT display raw `err.message` for UNSUPPORTED_VERSION or PARSE_FAILED — it is already user-readable on its own.

### File Upload Flow in LibraryRoute

```typescript
// State and refs
const [uploadError, setUploadError] = useState<LoaderError | null>(null)
const fileInputRef = useRef<HTMLInputElement>(null)
const navigate = useNavigate()

// Dismiss on click-outside
useEffect(() => {
  if (!uploadError) return
  const dismiss = () => setUploadError(null)
  document.addEventListener('click', dismiss)
  return () => document.removeEventListener('click', dismiss)
}, [uploadError])

// File change handler
async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  setUploadError(null)
  const file = e.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (event) => {
    const text = event.target?.result as string
    try {
      // loadStory handles JSON.parse internally — throws LoaderError on any failure
      loadStory(text)
      // If validation passed, parse again to get the object for IDB storage
      const rawJson = JSON.parse(text) as unknown
      const uuid = crypto.randomUUID()
      await saveStory(uuid, rawJson)
      navigate(`/read/${uuid}`)
    } catch (err) {
      if (err instanceof LoaderError) {
        setUploadError(err)
      }
    }
  }
  reader.readAsText(file)
  // Reset so the same file can be re-selected after fixing
  e.target.value = ''
}
```

**Why `reader.readAsText` + pass string to `loadStory`:** `loadStory(text: string)` calls `JSON.parse` internally and wraps `SyntaxError` in `LoaderError('PARSE_FAILED', ...)`. This means PARSE_FAILED is handled automatically without a separate try/catch for `JSON.parse`. The second `JSON.parse(text)` after validation succeeds is safe (text is valid JSON at this point).

**Why `e.target.value = ''` after handling:** Without this reset, the browser suppresses `onChange` if the user picks the same file again. Resetting the input value means re-selecting the same file fires `onChange` normally, allowing the user to try uploading the same corrected file.

**Why `async` handler with `reader.onload`:** FileReader is callback-based, not Promise-based. The `async` on the outer `handleFileChange` is for `await saveStory(...)` and `await navigate(...)` inside the callback. Note that React's synthetic event is not awaitable — the `async function` on `reader.onload` callback is the correct pattern here.

### Testing FileReader in jsdom

jsdom does not implement FileReader. Mock it at the module level:

```typescript
// In LibraryRoute.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock FileReader at global scope
const mockFileReader = {
  readAsText: vi.fn(),
  onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
  result: null as string | null,
}
vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))

// Mock loader dependencies
vi.mock('@/services/indexedDbService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/indexedDbService')>()
  return { ...mod, saveStory: vi.fn().mockResolvedValue(undefined) }
})

vi.mock('@nihonnohon/story-loader', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@nihonnohon/story-loader')>()
  return { ...mod, loadStory: vi.fn(), LoaderError: mod.LoaderError }
})

// Mock useNavigate
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLoaderData: vi.fn(),
    useRouteError: vi.fn(),
    useRevalidator: vi.fn(),
    useNavigate: vi.fn(),
  }
})

import { useLoaderData, useRouteError, useRevalidator, useNavigate } from 'react-router-dom'
import { saveStory } from '@/services/indexedDbService'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'

// Helper to simulate a file selection and FileReader load
function simulateFileLoad(text: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([text], 'story.json', { type: 'application/json' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
  // Simulate FileReader.onload callback
  act(() => {
    if (mockFileReader.onload) {
      mockFileReader.result = text
      mockFileReader.onload({ target: mockFileReader } as unknown as ProgressEvent<FileReader>)
    }
  })
}
```

**Example test for valid upload:**
```typescript
it('valid file upload: calls saveStory and navigates', async () => {
  const mockNavigate = vi.fn()
  vi.mocked(useNavigate).mockReturnValue(mockNavigate)
  vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
  vi.mocked(useLoaderData).mockReturnValue(fixtures)
  vi.mocked(loadStory).mockReturnValue(baseStory)

  renderLibrary()
  fireEvent.click(screen.getByRole('button', { name: 'Load a story from your device' }))
  await simulateFileLoad('{"schema_version":"1",...}')

  expect(vi.mocked(saveStory)).toHaveBeenCalledWith(
    expect.stringMatching(/^[0-9a-f-]{36}$/),  // UUID shape
    expect.any(Object),
  )
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/read\//))
})
```

**Example test for SCHEMA_INVALID:**
```typescript
it('SCHEMA_INVALID: shows inline error with hint and spec link', async () => {
  vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
  vi.mocked(useLoaderData).mockReturnValue(fixtures)
  vi.mocked(loadStory).mockImplementation(() => {
    throw new LoaderError('SCHEMA_INVALID', 'Story JSON failed schema validation: data/sentences/0/words must be array')
  })

  renderLibrary()
  await simulateFileLoad('{"schema_version":"1"}')

  expect(screen.getByText("This doesn't look like a valid Nihon no Hon story.")).toBeInTheDocument()
  expect(screen.getByText(/data\/sentences\/0\/words must be array/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View the story format documentation' })).toBeInTheDocument()
})
```

### ReaderRoute Loader Tests — IndexedDB Fallback

```typescript
// Add to the existing 'loader' describe block in ReaderRoute.test.tsx

import { getStory } from '@/services/indexedDbService'

// Add to vi.mock block at top of file:
// vi.mock('@/services/indexedDbService', async (importOriginal) => {
//   const mod = await importOriginal<...>()
//   return { ...mod, getStory: vi.fn() }
// })

describe('loader — IndexedDB fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns StoryModel from IndexedDB when ID not in manifest', async () => {
    vi.mocked(fetchManifest).mockResolvedValue([])
    vi.mocked(getStory).mockResolvedValue({ schema_version: '1' })
    vi.mocked(loadStory).mockReturnValue(baseStory)

    const result = await loader({
      params: { storyId: 'some-uuid' },
      request: new Request('http://localhost/read/some-uuid'),
    } as LoaderFunctionArgs)

    expect(result).toEqual(baseStory)
    expect(vi.mocked(getStory)).toHaveBeenCalledWith('some-uuid')
  })

  it('throws a 410 Response when neither manifest nor IndexedDB has the ID', async () => {
    vi.mocked(fetchManifest).mockResolvedValue([])
    vi.mocked(getStory).mockResolvedValue(null)

    const error = await loader({
      params: { storyId: 'missing-uuid' },
      request: new Request('http://localhost/read/missing-uuid'),
    } as LoaderFunctionArgs).catch(e => e)

    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(410)
  })
})

describe('ReaderError — storage not found (Story 3.4)', () => {
  it('renders "isn\'t available" message for status 410', () => {
    vi.mocked(useRouteError).mockReturnValue({
      status: 410, statusText: 'Gone', internal: true, data: '',
    })
    vi.mocked(isRouteErrorResponse).mockReturnValue(true)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText(
      /This story is not available on this device\./
    )).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })
})
```

### What This Story Does NOT Include

- Vocabulary panel or grammar panel — Epic 4 scope
- Any changes to the `ReaderRoute` component function body (structurally frozen)
- Any changes to stores, services other than `indexedDbService`
- Any changes to `storyManifest.ts`, `router.tsx` (error element already added in 3.3)
- E2E tests for file upload — Epic 4 Story 4.4 scope (see `e2e/file-upload.spec.ts`)

### Files Being Updated (READ BEFORE TOUCHING)

**`apps/web/src/routes/ReaderRoute.tsx`**
- Current loader: throws 404 immediately when storyId not in manifest
- This story changes: add IndexedDB fallback between manifest miss and the throw; throw 410 (not 404) for the UUID-not-found case
- Current `ReaderError`: handles status 404 and generic fallback
- This story changes: add `isStorageNotFound` branch for status 410
- Must preserve: `buildSupplementMap` function; entire `ReaderRoute` component body; all existing test behaviour for 404 and generic error cases

**`apps/web/src/routes/LibraryRoute.tsx`**
- Current: placeholder "Load a story from your device" button in empty state only, no functionality
- This story changes: remove placeholder button from empty state; add always-visible upload CTA with real file picker, error state, and IndexedDB+navigate flow
- Must preserve: all filter logic, empty state layout, `LibraryError` component unchanged

**`apps/web/src/__tests__/ReaderRoute.test.tsx`**
- Current: 130 tests (Story 3.3), `vi.mock` covers `fetchManifest`, `loadStory`, `initVocab`, `initKanji`, `useLoaderData`, `useRouteError`, `isRouteErrorResponse`
- This story changes: add `vi.mock` for `indexedDbService`; add `getStory` import; add 3 new tests

**`apps/web/src/__tests__/LibraryRoute.test.tsx`**
- Current: 10 tests (Story 3.2), no mocks for `loadStory`, `saveStory`, `useNavigate`
- This story changes: add mocks for `indexedDbService`, `@nihonnohon/story-loader`, `useNavigate`, and `FileReader`; add ~5 new tests

### Project Structure Notes

**New files:**
- `apps/web/src/services/indexedDbService.ts`
- `apps/web/src/__tests__/indexedDbService.test.ts`

**New devDependency:**
- `fake-indexeddb` — in `apps/web/package.json`; import as `'fake-indexeddb/auto'` at test file top

**File organization compliance:**
- `indexedDbService.ts` in `apps/web/src/services/` ✅ (architecture: browser-runtime concerns)
- Test in `apps/web/src/__tests__/` ✅
- Upload error state local to `LibraryRoute` — no store needed (ephemeral per-session UI state)

**`crypto.randomUUID()`:** Available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) under HTTPS or localhost. No polyfill needed for the browser matrix in NFR12.

**`FORMAT_SPEC_URL` constant:** Module-level in `LibraryRoute.tsx`. Update the GitHub path to match the actual repo URL before v1 ships. The schema file is at `schemas/story.v1.json` in the monorepo root.

### References

- IndexedDB service: [architecture.md — Data Architecture: "Local file upload persistence"](../_bmad-output/planning-artifacts/architecture.md)
- Route resolution order (manifest → IndexedDB → not-found): [architecture.md — Route resolution order](../_bmad-output/planning-artifacts/architecture.md)
- UUID-not-found error message verbatim: [architecture.md — "IndexedDB story-not-found error state"](../_bmad-output/planning-artifacts/architecture.md)
- Upload UX spec: [epics.md — UX-DR15](../_bmad-output/planning-artifacts/epics.md)
- Inline error messages (SCHEMA_INVALID / UNSUPPORTED_VERSION / PARSE_FAILED): [epics.md — Story 3.4 ACs](../_bmad-output/planning-artifacts/epics.md)
- `LoaderError` class with `code` and `message`: `packages/story-loader/src/errors.ts`
- `loadStory()` string overload (parses + validates): `packages/story-loader/src/index.ts`
- React Router v6 error handling: `useRouteError()`, `isRouteErrorResponse()`, `throw new Response(...)`
- `fake-indexeddb` usage: `import 'fake-indexeddb/auto'` replaces global `indexedDB` in test files

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Test fix: `renderLibrary` helper was overriding `useNavigate` mock with a fresh `vi.fn()` — resolved by passing `navigate` as an optional parameter to `renderLibrary(entries, navigate)` so the valid-upload test could inject its own `mockNavigate`.
- Behavior change: the old loader test `'throws a 404 when not in manifest'` was superseded by the new IDB fallback — updated to `'throws a 410 when not in manifest and not in IndexedDB'` with `getStory` mocked to return `null`; mock default changed from `vi.fn()` (returns `undefined`) to `vi.fn().mockResolvedValue(null)` to prevent `loadStory(undefined)` being called in other tests.

### Completion Notes List

- Created `indexedDbService.ts`: module-level singleton IDB connection (`nihonnohon-local-stories`, v1), `saveStory`/`getStory` as Promise wrappers around IDB transactions, `_resetDb()` for test isolation.
- Created `indexedDbService.test.ts`: 2 tests using `fake-indexeddb/auto` against real in-memory IDB — round-trip save/retrieve and null return for unknown UUID.
- Updated `ReaderRoute.tsx` loader: 3-path resolution (manifest → IndexedDB → 410). `ReaderError` extended with `isStorageNotFound` branch (status 410) rendering "This story is not available on this device.". `ReaderRoute` component body unchanged.
- Updated `ReaderRoute.test.tsx`: 3 new tests (IDB hit returns StoryModel, IDB miss throws 410, ReaderError for 410). Existing 404-loader test superseded → updated to 410 with explicit IDB-miss mock.
- Updated `LibraryRoute.tsx`: always-visible "Load a story from your device" button with hidden `<input type="file">`, `FileReader` flow, `LoaderError` discrimination, inline error display, click-outside dismiss via `useEffect`. Placeholder button removed from empty state.
- Updated `LibraryRoute.test.tsx`: FileReader global mock, 5 new tests covering always-visible trigger, valid upload, and all 3 error codes. `renderLibrary` extended to accept optional `navigate` param.
- Installed `fake-indexeddb` as devDependency in `apps/web`.
- Final counts: 139 tests pass (9 new), 0 TypeScript errors.

### File List

- `apps/web/src/services/indexedDbService.ts` (NEW)
- `apps/web/src/__tests__/indexedDbService.test.ts` (NEW)
- `apps/web/src/routes/ReaderRoute.tsx` (UPDATED — loader + ReaderError)
- `apps/web/src/__tests__/ReaderRoute.test.tsx` (UPDATED — IDB mock + 3 new tests)
- `apps/web/src/routes/LibraryRoute.tsx` (UPDATED — file upload wired)
- `apps/web/src/__tests__/LibraryRoute.test.tsx` (UPDATED — FileReader mock + 5 new tests)
- `apps/web/package.json` (UPDATED — fake-indexeddb devDependency)
- `pnpm-lock.yaml` (UPDATED — lockfile)
