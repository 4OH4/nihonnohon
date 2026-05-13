# Story 3.2: Library Route & Difficulty Filter

Status: done

## Story

As a **reader**,
I want to filter the story library by learning source and chapter or JLPT level,
so that I can find stories calibrated to exactly where I am in my studies without scrolling through irrelevant content.

## Acceptance Criteria

**AC1 — LibraryRoute loads manifest and renders StoryCards**

Given the app is opened at `/`
When `LibraryRoute` loads via its React Router `loader`
Then `manifest.json` is fetched once; all stories are displayed as `StoryCard` components; if the manifest fetch fails, an error element renders a user-friendly message with a retry option

**AC2 — Library page structure and SEO**

Given the library page
When rendered
Then `<main>` semantic element wraps the story list; `<title>` and `<meta name="description">` are set for basic SEO; the nihonnohon logo is prominent in the library header with no back-link (library variant)

**AC3 — Source filter narrows results immediately**

Given a source is selected in the source filter (native `<select>` with associated `<label>`)
When the selection changes
Then the library immediately narrows to stories matching that source; the chapter/level dropdown updates its options to valid chapters for the selected source; no Apply button required

**AC4 — Combined source + chapter filter**

Given both source and chapter filters are set
When applied
Then only stories matching both criteria are shown; library updates immediately

**AC5 — "All" source hides chapter filter**

Given `"All"` is selected as the source
When rendered
Then chapter/level dropdown is hidden or disabled; all stories are shown

**AC6 — Empty state**

Given the active filter combination matches no stories
When rendered
Then shows `"No stories found for this selection."` in `muted` colour; two actions present: "Reset filter" button and `"Load a story from your device"` CTA (Story 3.4 wires the CTA — for now a placeholder `<button>` with no handler)

**AC7 — Tests**

Given `LibraryRoute.test.tsx` and `apps/web/src/__tests__/storyManifest.test.ts`
When run
Then `LibraryRoute.test.tsx` covers: manifest loaded and StoryCards rendered; source filter narrows results; chapter filter further narrows; all-sources shows all; empty state with reset action; manifest fetch failure shows error message; `storyManifest.test.ts` covers `isManifestEntry` and `fetchManifest` boundary cases

## Tasks / Subtasks

- [x] Task 1: Add `fetchManifest()` and difficulty parsing to `apps/web/src/utils/storyManifest.ts` (AC1, AC3)
  - [x] Export `fetchManifest(): Promise<ManifestEntry[]>` — fetches `/stories/manifest.json`, throws on non-ok response, filters array with `isManifestEntry`
  - [x] Export `parseDifficultySource(difficulty: string): DifficultySource | null` — extracts source from difficulty string (see Dev Notes)
  - [x] Export `parseDifficultyChapter(difficulty: string, source: DifficultySource): string` — extracts chapter/level substring
  - [x] Export `type DifficultySource = 'Genki I' | 'Genki II' | 'JLPT'`

- [x] Task 2: Update `apps/web/src/components/AppBar.tsx` (AC2)
  - [x] Add optional prop `variant?: 'reader' | 'library'` (default: `'reader'`)
  - [x] When `variant === 'library'`: omit the `← Library` link; logo (`日本の本`) only, centred or right-aligned
  - [x] Existing ReaderRoute passes no prop → stays `'reader'` → no regression

- [x] Task 3: Implement `LibraryRoute.tsx` — loader and component (AC1–AC6)
  - [x] Export `loader(): Promise<ManifestEntry[]>` — calls `fetchManifest()`; errors propagate to React Router error element
  - [x] `useLoaderData() as ManifestEntry[]` inside the component
  - [x] `useState<DifficultySource | 'All'>('All')` for source; `useState<string>('All')` for chapter
  - [x] `useMemo` for `availableSources`, `availableChapters`, `filteredEntries` (see Dev Notes)
  - [x] Source `<select>` with `<label>`: options "All" + unique sources from manifest
  - [x] Chapter `<select>` with `<label>`: hidden (`hidden` class) when source is 'All'; otherwise shows unique chapters for the selected source; resets to 'All' when source changes
  - [x] Story list: maps `filteredEntries` → `<StoryCard entry={e} key={e.id} />`
  - [x] Empty state: "No stories found for this selection." (muted) + Reset Filter button + Load from device placeholder button
  - [x] `<AppBar variant="library" />` at top
  - [x] `<main>` wraps story list

- [x] Task 4: Export `LibraryError` component from `LibraryRoute.tsx` (AC1)
  - [x] Use `useRouteError()` and `useRevalidator()` from react-router-dom
  - [x] Render: "Couldn't load the story library." + Retry button that calls `revalidator.revalidate()`

- [x] Task 5: Update `apps/web/src/router.tsx` (AC1)
  - [x] Import `loader as libraryLoader` and `LibraryError` from `@/routes/LibraryRoute`
  - [x] Add `loader: libraryLoader` and `errorElement: <LibraryError />` to the `/` route

- [x] Task 6: Update `apps/web/index.html` for SEO (AC2)
  - [x] Add `<meta name="description" content="Nihon no Hon — read Japanese stories at your level with instant word lookup and kanji breakdown." />` inside `<head>`
  - [x] `<title>Nihon no Hon</title>` is already correct — do not change it

- [x] Task 7: Write `apps/web/src/__tests__/storyManifest.test.ts` (AC7)
  - [x] Test `isManifestEntry` boundary cases: valid entry; missing `description`; empty `id`; non-string `difficulty`; `difficulty: null`; `difficulty` absent; non-object input
  - [x] Test `parseDifficultySource`: each source pattern; unrecognised string returns null
  - [x] Test `parseDifficultyChapter`: extracts correct chapter substring per source
  - [x] Test `fetchManifest`: happy path with valid array; filters out invalid entries; throws on non-ok response

- [x] Task 8: Write `apps/web/src/__tests__/LibraryRoute.test.tsx` (AC1–AC7)
  - [x] Mock `useLoaderData` via `vi.mock('react-router-dom')` (same pattern as ReaderRoute.test.tsx)
  - [x] Wrap renders in `<MemoryRouter>` for `StoryCard` Link context
  - [x] Test: all manifest entries rendered as story cards
  - [x] Test: source filter change narrows results
  - [x] Test: chapter filter further narrows (requires stories with same source, different chapter)
  - [x] Test: selecting 'All' source shows all stories and hides chapter filter
  - [x] Test: empty state shows message and reset button; clicking reset shows all stories
  - [x] Test: manifest fetch failure — render error component and check message
  - [x] `afterEach`: no store teardown needed (no Zustand stores used in this route)

- [x] Task 9: Run full test suite (AC7)
  - [x] `pnpm test:unit` inside `apps/web` — all existing 94 tests pass; new tests pass

### Review Findings

- [x] [Review][Patch] Remove unused `useRouteError` import from `LibraryRoute.tsx` — dead code that will cause lint warnings [LibraryRoute.tsx:3]
- [x] [Review][Patch] Active filter `<select>` elements always use `border-border bg-surface`; UX-DR10 requires `accent-subtle` bg + `accent` border when a non-All filter is active — converted `selectClass` to a function taking `active: boolean` [LibraryRoute.tsx:36-39]
- [x] [Review][Defer] `parseDifficultyChapter` returns empty string for a malformed prefix-only difficulty (e.g. `"Genki I"` with no chapter) — deferred, requires difficulty format validation layer beyond what `isManifestEntry` currently enforces [storyManifest.ts]
- [x] [Review][Defer] `fetchManifest` silently drops invalid entries with no dev-mode `console.warn` — deferred, intentional design per JSDoc; low discoverability cost in v1 [storyManifest.ts]
- [x] [Review][Defer] "Load a story from your device" button has no `onClick` — deferred, intentional placeholder per story spec; Story 3.4 wires the file picker [LibraryRoute.tsx]
- [x] [Review][Defer] Chapter `<select>` value can be stale if revalidation removes a chapter that was previously selected — deferred, very unlikely with static manifest; Story 3.3 addresses manifest reloading [LibraryRoute.tsx]
- [x] [Review][Defer] `availableChapters` uses default string sort — "Ch.10" sorts before "Ch.9" for multi-digit chapters — deferred, no current impact with one story; address when multi-chapter sources are added [LibraryRoute.tsx]
- [x] [Review][Defer] `ReaderRoute` loader ignores `:storyId` param and fetches hardcoded story — deferred, pre-existing known placeholder; Story 3.3 replaces loader body [ReaderRoute.tsx]
- [x] [Review][Defer] `<title>` is static HTML, not set per-route — deferred, satisfies AC2 "basic SEO" for a static SPA where library is the only landing page [index.html]

## Dev Notes

### CRITICAL: No Radix UI Installed

The project **does not have `@radix-ui/react-select` or any Radix UI packages** in `apps/web/package.json`. The epics spec says "Radix `Select`" but this is aspirational. **Use native HTML `<select>` elements styled with Tailwind** — this satisfies all ACs without new dependencies.

If you want to install Radix (`@radix-ui/react-select`), you **MUST HALT and get user approval first** before adding dependencies (per dev workflow rules). Native `<select>` is the recommended path.

### `fetchManifest()` Implementation

```typescript
/** Fetches and validates the story manifest from the public directory. */
export async function fetchManifest(): Promise<ManifestEntry[]> {
  const res = await fetch('/stories/manifest.json')
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`)
  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Manifest is not a JSON array')
  return data.filter(isManifestEntry)
}
```

`isManifestEntry` acts as the filter — invalid entries are silently dropped, not thrown (one bad entry should not break the whole library).

### Difficulty Parsing Utilities

```typescript
export type DifficultySource = 'Genki I' | 'Genki II' | 'JLPT'

/** Extracts the learning source from a difficulty string, or null if unrecognised. */
export function parseDifficultySource(difficulty: string): DifficultySource | null {
  if (difficulty.startsWith('Genki II')) return 'Genki II'  // check II before I
  if (difficulty.startsWith('Genki I')) return 'Genki I'
  if (difficulty.startsWith('JLPT')) return 'JLPT'
  return null
}

/** Extracts the chapter/level portion from a difficulty string for a known source. */
export function parseDifficultyChapter(difficulty: string, source: DifficultySource): string {
  if (source === 'Genki I') return difficulty.slice('Genki I '.length)
  if (source === 'Genki II') return difficulty.slice('Genki II '.length)
  return difficulty.slice('JLPT '.length) // JLPT
}
```

**Why check "Genki II" before "Genki I":** `"Genki II Ch.3".startsWith('Genki I')` is `true`, so order matters.

### Filter State and Derived Data

```tsx
// In LibraryRoute component body:
const entries = useLoaderData() as ManifestEntry[]
const [source, setSource] = useState<DifficultySource | 'All'>('All')
const [chapter, setChapter] = useState<string>('All')

const availableSources = useMemo<DifficultySource[]>(() => {
  const seen = new Set<DifficultySource>()
  entries.forEach(e => {
    if (e.difficulty) {
      const s = parseDifficultySource(e.difficulty)
      if (s) seen.add(s)
    }
  })
  return [...seen].sort()
}, [entries])

const availableChapters = useMemo<string[]>(() => {
  if (source === 'All') return []
  return [...new Set(
    entries
      .filter(e => e.difficulty && parseDifficultySource(e.difficulty) === source)
      .map(e => parseDifficultyChapter(e.difficulty!, source as DifficultySource))
  )].sort()
}, [entries, source])

const filteredEntries = useMemo(() => {
  if (source === 'All') return entries
  return entries.filter(e => {
    if (!e.difficulty) return false
    const s = parseDifficultySource(e.difficulty)
    if (s !== source) return false
    if (chapter === 'All') return true
    return parseDifficultyChapter(e.difficulty, s) === chapter
  })
}, [entries, source, chapter])

const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setSource(e.target.value as DifficultySource | 'All')
  setChapter('All')  // always reset chapter when source changes
}
```

### AppBar Variant

Current AppBar always renders the `← Library` back link. Add an optional prop:

```tsx
interface AppBarProps {
  variant?: 'reader' | 'library'
}

export function AppBar({ variant = 'reader' }: AppBarProps) {
  return (
    <header className={cn('flex items-center justify-between bg-surface px-4 py-2 border-b border-border')}>
      {variant === 'reader' ? (
        <Link to="/" aria-label="Back to library" className="text-sm text-muted hover:text-paper-text transition-colors">
          ← Library
        </Link>
      ) : (
        <span /> // empty span keeps justify-between layout
      )}
      <span className="font-ja text-sm text-muted" lang="ja">日本の本</span>
    </header>
  )
}
```

**Existing ReaderRoute** passes no `variant` prop → defaults to `'reader'` → no regression. No ReaderRoute changes needed.

### LibraryRoute Structure

```tsx
export async function loader(): Promise<ManifestEntry[]> {
  return fetchManifest()
}

export function LibraryError() {
  const revalidator = useRevalidator()
  return (
    <div className="p-8 text-center">
      <p className="text-error mb-4">Couldn't load the story library.</p>
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        className="text-sm underline text-paper-text"
      >
        Try again
      </button>
    </div>
  )
}

export function LibraryRoute() {
  const entries = useLoaderData() as ManifestEntry[]
  // ... filter state ...

  return (
    <div className="flex flex-col min-h-dvh bg-paper-bg">
      <AppBar variant="library" />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Filter row */}
        <div className="flex gap-4 mb-6">
          <div>
            <label htmlFor="source-filter" className="text-sm text-muted mr-2">Source</label>
            <select id="source-filter" value={source} onChange={handleSourceChange} ...>
              <option value="All">All</option>
              {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {source !== 'All' && (
            <div>
              <label htmlFor="chapter-filter" className="text-sm text-muted mr-2">Chapter</label>
              <select id="chapter-filter" value={chapter} onChange={e => setChapter(e.target.value)} ...>
                <option value="All">All</option>
                {availableChapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Story list or empty state */}
        {filteredEntries.length > 0 ? (
          <ul className="space-y-3">
            {filteredEntries.map(e => (
              <li key={e.id}><StoryCard entry={e} /></li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted mb-4">No stories found for this selection.</p>
            <button type="button" onClick={() => { setSource('All'); setChapter('All') }}
              className="text-sm underline text-paper-text mr-4">
              Reset filter
            </button>
            <button type="button" className="text-sm underline text-muted">
              Load a story from your device
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
```

**"Load a story from your device" button:** No `onClick` handler yet — Story 3.4 wires this up. Must be present as a `<button>` element.

### Router.tsx Update

```tsx
import { LibraryRoute, loader as libraryLoader, LibraryError } from '@/routes/LibraryRoute'
import { ReaderRoute, loader as readerLoader } from '@/routes/ReaderRoute'

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute />, loader: libraryLoader, errorElement: <LibraryError /> },
  { path: '/read/:storyId', element: <ReaderRoute />, loader: readerLoader },
])
```

Note `useRouteError()` and `useRevalidator()` are imported from `react-router-dom`.

### SEO: index.html

Add inside `<head>` (after the viewport meta):
```html
<meta name="description" content="Nihon no Hon — read Japanese stories at your level with instant word lookup and kanji breakdown." />
```

This is sufficient for basic SEO in a static SPA. No react-helmet or dynamic title management needed for v1.

### Testing LibraryRoute

Use the same `vi.mock('react-router-dom')` pattern as `ReaderRoute.test.tsx`:

```tsx
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return { ...mod, useLoaderData: vi.fn(), useRouteError: vi.fn(), useRevalidator: vi.fn() }
})
import { useLoaderData, useRouteError, useRevalidator } from 'react-router-dom'

function renderLibrary(entries: ManifestEntry[]) {
  vi.mocked(useLoaderData).mockReturnValue(entries)
  return render(<MemoryRouter><LibraryRoute /></MemoryRouter>)
}
```

**Filter test requires ≥2 fixture entries** to verify narrowing. Use inline fixtures with different difficulties:
```typescript
const fixtures: ManifestEntry[] = [
  { id: 'story-a', filename: 'a.json', title: 'Story A', titleJa: 'A', language: 'Japanese', description: 'Desc A', difficulty: 'Genki I Ch.6' },
  { id: 'story-b', filename: 'b.json', title: 'Story B', titleJa: 'B', language: 'Japanese', description: 'Desc B', difficulty: 'Genki I Ch.7' },
  { id: 'story-c', filename: 'c.json', title: 'Story C', titleJa: 'C', language: 'Japanese', description: 'Desc C', difficulty: 'JLPT N4' },
]
```

**Source filter test:**
```tsx
it('source filter narrows results', async () => {
  renderLibrary(fixtures)
  fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'JLPT' } })
  expect(screen.getByText('Story C')).toBeInTheDocument()
  expect(screen.queryByText('Story A')).not.toBeInTheDocument()
})
```

**Error component test:**
```tsx
it('LibraryError renders error message', () => {
  vi.mocked(useRouteError).mockReturnValue(new Error('Network error'))
  vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
  render(<MemoryRouter><LibraryError /></MemoryRouter>)
  expect(screen.getByText(/Couldn't load the story library/)).toBeInTheDocument()
})
```

### Testing `fetchManifest` in storyManifest.test.ts

`fetchManifest` calls `fetch()`. Mock it with `vi.stubGlobal('fetch', ...)`:

```typescript
it('returns validated entries from a successful fetch', async () => {
  const data = [{ id: 'a', filename: 'a.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
  const entries = await fetchManifest()
  expect(entries).toHaveLength(1)
  vi.unstubAllGlobals()
})

it('throws on non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  await expect(fetchManifest()).rejects.toThrow('404')
  vi.unstubAllGlobals()
})

it('filters out invalid entries silently', async () => {
  const data = [
    { id: 'valid', filename: 'a.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' },
    { id: '', filename: 'bad.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' }, // empty id
  ]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
  const entries = await fetchManifest()
  expect(entries).toHaveLength(1)
  vi.unstubAllGlobals()
})
```

### Key Patterns from Story 3.1 (Apply Here)

- `cn()` for all class composition
- Design tokens only — never raw hex
- Named export matching filename
- `lang="ja"` on Japanese text
- `font-ja` on Japanese text elements  
- JSDoc on all exported functions
- `MemoryRouter` wrapping in tests for any component using `Link`

### What This Story Does NOT Include

- File picker / local story upload — Story 3.4 wires the "Load from device" button
- IndexedDB — Story 3.4
- Full story loading by manifest lookup — Story 3.3 (ReaderRoute loader body change)
- SettingsMenu / text-size controls — Story 4.3
- Any changes to `ReaderRoute.tsx` component body, stores, or services

### Project Structure Notes

**Files to UPDATE:**
- `apps/web/src/routes/LibraryRoute.tsx` — full rewrite from stub; also exports `loader` and `LibraryError`
- `apps/web/src/components/AppBar.tsx` — add optional `variant` prop (backward-compatible)
- `apps/web/src/utils/storyManifest.ts` — add `fetchManifest`, `parseDifficultySource`, `parseDifficultyChapter`, `DifficultySource` type
- `apps/web/src/router.tsx` — add `libraryLoader` and `errorElement` to `/` route
- `apps/web/index.html` — add `<meta name="description">`

**Files to CREATE:**
- `apps/web/src/__tests__/LibraryRoute.test.tsx`
- `apps/web/src/__tests__/storyManifest.test.ts`

**Do NOT modify:**
- `ReaderRoute.tsx` (Story 3.3)
- `StoryCard.tsx`, `DifficultyBadge.tsx` (Story 3.1 — just import and use)
- Any store or service files

### References

- LibraryRoute loader pattern: [epics.md — Story 3.2 ACs + Epic 3 implementation note]
- Filter UX spec: [epics.md — UX-DR10]
- AppBar library variant: [epics.md — UX-DR5]
- `useRouteError` + `useRevalidator`: react-router-dom v6 API (no install needed)
- `vi.stubGlobal('fetch', ...)`: Vitest global stub for fetch mocking
- Filter fixture approach: use ≥3 entries spanning 2 sources to test all filter branches
- Story 3.1 completion notes: `vi.mock` + MemoryRouter is the proven test pattern for this codebase

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `storyManifest.ts`: added `DifficultySource` type, `parseDifficultySource` (checks "Genki II" before "Genki I" to avoid prefix collision), `parseDifficultyChapter`, and `fetchManifest` (silently filters invalid entries via `isManifestEntry`).
- `AppBar.tsx`: added `variant?: 'reader' | 'library'` prop (defaults to `'reader'`); library variant renders an empty `<span>` placeholder to preserve `justify-between` layout. Existing `<AppBar />` calls with no prop are fully backward-compatible.
- `LibraryRoute.tsx`: full rewrite from stub. Exports `loader`, `LibraryError`, and `LibraryRoute`. Filter uses three `useMemo` hooks for `availableSources`, `availableChapters`, and `filteredEntries`; chapter state resets to 'All' on source change. "Load a story from your device" is a placeholder button with no handler (Story 3.4).
- `router.tsx`: `/` route now has `loader: libraryLoader` and `errorElement: <LibraryError />`.
- `index.html`: added `<meta name="description">` for basic SEO.
- `storyManifest.test.ts` (22 tests): covers `isManifestEntry`, `parseDifficultySource`, `parseDifficultyChapter`, and `fetchManifest` with `vi.stubGlobal('fetch', ...)`.
- `LibraryRoute.test.tsx` (10 tests): covers rendering, source filter, chapter filter, reset, empty state, and error component. Uses `vi.mock('react-router-dom')` + `MemoryRouter` (same pattern as `ReaderRoute.test.tsx`).
- All 126 tests pass (32 new, 94 pre-existing). Zero regressions.

### File List

- `apps/web/src/utils/storyManifest.ts` (updated — added fetchManifest, parseDifficultySource, parseDifficultyChapter, DifficultySource)
- `apps/web/src/components/AppBar.tsx` (updated — added variant prop)
- `apps/web/src/routes/LibraryRoute.tsx` (updated — full implementation from stub)
- `apps/web/src/router.tsx` (updated — library loader + error element)
- `apps/web/index.html` (updated — added meta description)
- `apps/web/src/__tests__/storyManifest.test.ts` (new)
- `apps/web/src/__tests__/LibraryRoute.test.tsx` (new)
