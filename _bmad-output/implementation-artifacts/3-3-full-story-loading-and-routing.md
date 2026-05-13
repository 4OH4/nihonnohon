# Story 3.3: Full Story Loading & Routing

Status: review

## Story

As a **reader**,
I want story URLs to be permanent and shareable, and the reader to load any library story by its ID,
so that I can bookmark or share a link to a specific story and it will always work.

## Acceptance Criteria

**AC1 — Loader uses manifest lookup + dynamic fetch**

Given the user navigates to `/read/genki-i-ch6-tanaka-letter`
When the `ReaderRoute` loader executes
Then it reads `storyId` from route params; fetches the manifest; finds the matching entry; fetches `/stories/${entry.filename}`; passes the response through `loadStory()`; returns a `StoryModel`; the `ReaderRoute` component is structurally unchanged

**AC2 — Story not found renders error element**

Given a story ID not found in the manifest
When the loader runs
Then throws a `Response` with `status: 404`; React Router mounts the `ReaderError` error element which renders `"Story not found."` and a `← Back to library` link

**AC3 — vercel.json SPA rewrite works on hard-refresh**

Given the `vercel.json` at repo root (`{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`)
When a user hard-refreshes at `/read/genki-i-ch6-tanaka-letter`
Then the app loads correctly — no 404 from Vercel; this is already in place from Story 1.4, verify it is still present

**AC4 — router.tsx has error element on reader route**

Given `router.tsx`
When reviewed
Then the `/read/:storyId` route has both `loader: readerLoader` and `errorElement: <ReaderError />`

**AC5 — All Epic 2 component ACs preserved; new tests added**

Given `ReaderRoute.test.tsx`
When run
Then all 11 existing tests pass unchanged (preserved); the file has a comment header documenting which ACs are preserved vs superseded vs new; new describe blocks cover: `ReaderError` renders correctly for 404 and non-404 errors; the loader function returns StoryModel for a found story and throws for a missing ID

## Tasks / Subtasks

- [x] Task 1: Update `apps/web/src/routes/ReaderRoute.tsx` — replace loader + add ReaderError (AC1, AC2)
  - [x] Add `import type { LoaderFunctionArgs } from 'react-router-dom'` and `import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'`
  - [x] Add `import { fetchManifest } from '@/utils/storyManifest'`
  - [x] Replace loader signature to accept `{ params }: LoaderFunctionArgs`
  - [x] Loader body: `const storyId = params.storyId!` → `await Promise.all([initVocab(), initKanji()])` → `fetchManifest()` → `manifest.find(e => e.id === storyId)` → throw `new Response('Not Found', { status: 404 })` if not found → `fetch('/stories/${entry.filename}')` → `loadStory()`
  - [x] Export `ReaderError` component: uses `useRouteError()` + `isRouteErrorResponse()` to distinguish 404 from other errors; renders the appropriate message + `<Link to="/">← Back to library</Link>`
  - [x] **Do NOT change** the `ReaderRoute` component function body — it is structurally frozen from Epic 2

- [x] Task 2: Update `apps/web/src/router.tsx` — add error element to reader route (AC4)
  - [x] Import `ReaderError` from `@/routes/ReaderRoute`
  - [x] Add `errorElement: <ReaderError />` to the `/read/:storyId` route entry

- [x] Task 3: Verify `apps/web/vercel.json` SPA rewrite is still present (AC3)
  - [x] Read `vercel.json` at repo root and confirm `rewrites` rule is intact — no change needed, just verify

- [x] Task 4: Update `apps/web/src/__tests__/ReaderRoute.test.tsx` — add ReaderError tests + loader test (AC5)
  - [x] Add a comment block at the top of the test file (after imports) documenting:
    - **PRESERVED (all 11 existing tests):** all component behaviour from Story 2.5
    - **SUPERSEDED:** the hardcoded loader URL (`/stories/genki-i-ch6-tanaka-letter.json`) — tests mock `useLoaderData` directly so the loader body was never invoked in component tests
    - **NEW:** `ReaderError` component tests; `loader` unit tests
  - [x] Add `useRouteError` and `isRouteErrorResponse` to the `vi.mock('react-router-dom')` mock factory
  - [x] Add `describe('ReaderError', ...)` with tests:
    - Renders `"Story not found."` when `useRouteError()` returns a route error response with status 404
    - Renders `"Failed to load this story."` for a generic Error
    - Renders a `← Back to library` link in both cases
  - [x] Add `describe('loader', ...)` with tests for the loader function using global vi.mocks for fetchManifest and loadStory
  - [x] Existing `beforeEach` / `afterEach` teardown is unchanged

- [x] Task 5: Run full test suite (AC5)
  - [x] `pnpm test:unit` inside `apps/web` — all 126 existing tests pass; 4 new tests pass (130 total)

### Review Findings

- [ ] [Review][Patch] Replace `params.storyId!` non-null assertion with explicit guard: `if (!params.storyId) throw new Response('Not Found', { status: 404 })` [ReaderRoute.tsx:28]
- [ ] [Review][Patch] `ReaderError` has no `<h1>` — screen readers get no heading hierarchy on the error page; add `<h1>` above the message [ReaderRoute.tsx:38-48]
- [x] [Review][Defer] `initVocab`/`initKanji` failure renders "Failed to load this story." with no retry button (unlike `LibraryError`) — deferred, retry not in AC2 scope for v1 [ReaderRoute.tsx:29]
- [x] [Review][Defer] All non-404 errors (CDN 404 on file, `LoaderError`, `SyntaxError`) produce the same generic message with no logging — deferred, intentional v1 design; observability pass needed before production [ReaderRoute.tsx:32-33]
- [x] [Review][Defer] 404 loader test does not assert that `initVocab`/`initKanji` were called before the throw — deferred, low value; doesn't affect correctness [ReaderRoute.test.tsx]
- [x] [Review][Defer] No catch-all route for unrecognised paths — shows unstyled React Router default error UI — deferred, pre-existing gap not introduced by this story [router.tsx]
- [x] [Review][Defer] `buildSupplementMap` synthetic IDs may be stale in `lookupStore` when navigating between stories — deferred, pre-existing behaviour not caused by this diff [ReaderRoute.tsx]

## Dev Notes

### Loader Implementation

```typescript
import type { LoaderFunctionArgs } from 'react-router-dom'

export async function loader({ params }: LoaderFunctionArgs): Promise<StoryModel> {
  const storyId = params.storyId!          // route pattern guarantees this is present
  await Promise.all([initVocab(), initKanji()])
  const manifest = await fetchManifest()
  const entry = manifest.find(e => e.id === storyId)
  if (!entry) throw new Response('Not Found', { status: 404 })
  const res = await fetch(`/stories/${entry.filename}`)
  if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
  return loadStory(await res.json())
}
```

**Why `throw new Response('Not Found', { status: 404 })`:** This is the React Router v6 canonical way to signal a 404 from a loader. It makes `isRouteErrorResponse(error)` return `true` in the error element, allowing the error UI to distinguish 404s from network failures. Compare with `throw new Error(...)` which is a generic crash.

**`initVocab()` and `initKanji()` are idempotent:** They fetch once and cache. Calling them in the loader every navigation is safe — they no-op on repeat calls.

**`fetchManifest()` on every navigation:** The manifest is a small JSON file. In v1 there is no client-side manifest caching; the browser cache handles repeated fetches. Do not add memoization to `fetchManifest` in this story.

### ReaderError Component

```tsx
export function ReaderError() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-paper-bg p-8 text-center">
      <p className="text-paper-text mb-4">
        {isNotFound ? 'Story not found.' : 'Failed to load this story.'}
      </p>
      <Link to="/" className="text-sm underline text-muted">
        ← Back to library
      </Link>
    </div>
  )
}
```

**`isRouteErrorResponse(error)`** checks that the thrown value has `status: number`, `statusText: string`, `internal: boolean`, and `data` field — this is what React Router sets when a `Response` is thrown from a loader.

### router.tsx After This Story

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute, loader as libraryLoader, LibraryError } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader, ReaderError } from '@/routes/ReaderRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute />, loader: libraryLoader, errorElement: <LibraryError /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader, errorElement: <ReaderError /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
```

### ReaderRoute.test.tsx: Mock Update Required

The current mock only covers `useLoaderData`. Add `useRouteError` and `isRouteErrorResponse`:

```typescript
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLoaderData: vi.fn(),
    useRouteError: vi.fn(),
    isRouteErrorResponse: vi.fn(),  // mock so we control branch in ReaderError
  }
})
import { useLoaderData, useRouteError, isRouteErrorResponse } from 'react-router-dom'
```

**Why mock `isRouteErrorResponse`:** It's a plain function (not a hook), but because it inspects internal React Router state structures, it behaves unexpectedly in jsdom. Mocking it lets tests control the `isNotFound` branch directly without relying on internal Response object shape.

### Testing ReaderError

```typescript
describe('ReaderError', () => {
  it('renders "Story not found." for a 404 route error', () => {
    vi.mocked(useRouteError).mockReturnValue({ status: 404, statusText: 'Not Found', internal: true, data: '' })
    vi.mocked(isRouteErrorResponse).mockReturnValue(true)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText('Story not found.')).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })

  it('renders fallback message for non-404 errors', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('Network error'))
    vi.mocked(isRouteErrorResponse).mockReturnValue(false)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText('Failed to load this story.')).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })
})
```

### Testing the Loader Function

The loader is an `async` function. Testing it requires mocking its dependencies. **The challenge:** the existing component tests use `beforeEach(() => _initVocabFromData(...))` to seed real vocab data — if we `vi.mock('@/services/vocabService')` globally it replaces the whole module including `_initVocabFromData`. Use `vi.spyOn` on the already-imported module to avoid this conflict:

```typescript
import { loader } from '@/routes/ReaderRoute'
import * as storyManifest from '@/utils/storyManifest'
import * as vocabService from '@/services/vocabService'
import * as kanjiService from '@/services/kanjiService'
import * as storyLoader from '@nihonnohon/story-loader'

describe('loader', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns StoryModel when story ID is found in manifest', async () => {
    const mockEntry = { id: 'test', filename: 'test.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' }
    vi.spyOn(storyManifest, 'fetchManifest').mockResolvedValue([mockEntry])
    vi.spyOn(vocabService, 'initVocab').mockResolvedValue()
    vi.spyOn(kanjiService, 'initKanji').mockResolvedValue()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    vi.spyOn(storyLoader, 'loadStory').mockReturnValue(baseStory)

    const result = await loader({ params: { storyId: 'test' }, request: new Request('/') })
    expect(result).toEqual(baseStory)
    vi.unstubAllGlobals()
  })

  it('throws a 404 Response when story ID is not in manifest', async () => {
    vi.spyOn(storyManifest, 'fetchManifest').mockResolvedValue([])
    vi.spyOn(vocabService, 'initVocab').mockResolvedValue()
    vi.spyOn(kanjiService, 'initKanji').mockResolvedValue()

    const thrown = loader({ params: { storyId: 'missing' }, request: new Request('/') })
    await expect(thrown).rejects.toBeInstanceOf(Response)
    const err = await thrown.catch(e => e as Response)
    expect(err.status).toBe(404)
  })
})
```

**`vi.spyOn` vs `vi.mock`:** `vi.spyOn` replaces individual exports on the already-imported module object, avoiding the need to restructure the entire mock. `vi.restoreAllMocks()` in `afterEach` restores them. This is the pattern to use when you need selective mocking without disturbing other exports in the same module.

### What This Story Does NOT Include

- IndexedDB storage or UUID routing — Story 3.4
- Local file upload — Story 3.4
- Any changes to `LibraryRoute.tsx` or `storyManifest.ts`
- Any changes to the `ReaderRoute` component function body (structurally frozen)
- Any changes to stores, services, or other components

### Files Being Updated (READ BEFORE TOUCHING)

**`apps/web/src/routes/ReaderRoute.tsx`**
- Current loader: hardcoded fetch of `genki-i-ch6-tanaka-letter.json`; returns `StoryModel`
- This story changes: loader body only — accept `LoaderFunctionArgs`; use manifest lookup
- Must preserve: `buildSupplementMap` function; entire `ReaderRoute` component body; all imports for the component

**`apps/web/src/router.tsx`**
- Current: `/read/:storyId` has `loader: readerLoader` but no `errorElement`
- This story changes: add `errorElement: <ReaderError />`; add `ReaderError` to imports

**`apps/web/src/__tests__/ReaderRoute.test.tsx`**
- Current: 11 tests, all use `vi.mock('react-router-dom')` with only `useLoaderData` mocked
- This story changes: extend the mock to include `useRouteError` and `isRouteErrorResponse`; add two new describe blocks; all 11 existing tests must continue to pass unchanged

### Project Structure Notes

**Files to UPDATE:**
- `apps/web/src/routes/ReaderRoute.tsx` — loader body + ReaderError export
- `apps/web/src/router.tsx` — errorElement on reader route
- `apps/web/src/__tests__/ReaderRoute.test.tsx` — extended mock + new tests

**Do NOT create new files** (all changes go in existing files)

**Do NOT modify:**
- `LibraryRoute.tsx`, `storyManifest.ts`, any store/service files
- The `ReaderRoute` component function body (frozen from Epic 2)

### References

- React Router v6 error handling: `throw new Response(...)` from loader; `useRouteError()` + `isRouteErrorResponse()` in error element
- `fetchManifest` already exported from `@/utils/storyManifest` (Story 3.2)
- `vercel.json` SPA rewrite: established in Story 1.4
- `LoaderFunctionArgs` type: exported from `react-router-dom` v6
- `vi.spyOn` for selective mock without module-level mock conflict: Vitest standard pattern
- All 11 existing `ReaderRoute` tests: see current `apps/web/src/__tests__/ReaderRoute.test.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `ReaderRoute.tsx` loader body replaced: accepts `LoaderFunctionArgs`, reads `params.storyId`, calls `fetchManifest()`, finds entry, fetches `/stories/${entry.filename}`, passes through `loadStory()`. Throws `new Response('Not Found', { status: 404 })` for unknown IDs. `ReaderRoute` component body structurally unchanged from Story 2.5.
- `ReaderError` component exported: uses `useRouteError()` + `isRouteErrorResponse()` to distinguish 404 from generic failures; renders appropriate message and `Link` back to library.
- `router.tsx`: added `ReaderError` to imports and `errorElement: <ReaderError />` to `/read/:storyId` route.
- `vercel.json` verified intact: `{ "rootDirectory": "apps/web", "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
- `ReaderRoute.test.tsx`: extended `vi.mock('react-router-dom')` with `useRouteError` and `isRouteErrorResponse`; added global mocks for `fetchManifest`, `loadStory`, `initVocab`, `initKanji` (all keep original exports via spread); added `ReaderError` describe (2 tests) and `loader` describe (2 tests); fixed jsdom URL issue by using `new Request('http://localhost/read/...')` instead of `new Request('/')`.
- 130 tests pass (4 new, 126 pre-existing). Zero regressions across all 14 test files.

### File List

- `apps/web/src/routes/ReaderRoute.tsx` (updated — loader replaced, ReaderError added)
- `apps/web/src/router.tsx` (updated — errorElement on reader route)
- `apps/web/src/__tests__/ReaderRoute.test.tsx` (updated — extended mocks + 4 new tests)
