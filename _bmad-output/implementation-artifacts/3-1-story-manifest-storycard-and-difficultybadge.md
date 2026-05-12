# Story 3.1: Story Manifest, StoryCard & DifficultyBadge

Status: done

## Story

As a **reader**,
I want to see all available stories in a library with their title, difficulty label, and description,
so that I can quickly identify stories matched to my current learning level before opening one.

## Acceptance Criteria

**AC1 — manifest.json structure**

Given `apps/web/public/stories/manifest.json`
When reviewed
Then it is a JSON array; each entry has: `id` (permanent slug), `filename`, `title`, `titleJa`, `difficulty` (string or absent), `language`, `description`; the `genki-i-ch6-tanaka-letter` story from Epic 2 has an entry; adding a new story requires only appending an entry — no code change

**AC2 — StoryCard renders all metadata**

Given a `StoryCard` with a story that has a `difficulty` value
When rendered
Then shows English title (bold), Japanese title (Noto Sans JP, `muted`, smaller), `DifficultyBadge`, and description excerpt (1–2 lines max); hover state applies `accent` border; default state has `border` border; the card navigates to `/read/:id` on tap

**AC3 — DifficultyBadge with difficulty**

Given a `DifficultyBadge` with a difficulty string
When rendered
Then is a rounded pill with `accent-subtle` background, `accent` border, small text; content matches the difficulty string (e.g. `"Genki I Ch.6"` or `"JLPT N4"`); has `aria-label` with the full difficulty string

**AC4 — DifficultyBadge absent when no difficulty**

Given a `StoryCard` where `difficulty` is absent or `null`
When rendered
Then `DifficultyBadge` is NOT rendered — no empty pill, no placeholder text

**AC5 — Component tests**

Given `StoryCard.test.tsx` and `DifficultyBadge.test.tsx`
When run
Then cover: all metadata fields rendered; navigation link to `/read/:id`; badge present when difficulty exists; badge absent when difficulty missing or null; `aria-label` on badge

## Tasks / Subtasks

- [x] Task 1: Create `apps/web/public/stories/manifest.json` (AC1)
  - [x] Write JSON array with one entry for `genki-i-ch6-tanaka-letter`
  - [x] Match story metadata from the existing `genki-i-ch6-tanaka-letter.json` (title, titleJa, difficulty, language, description)
  - [x] Verify no code changes are needed to add entries — file is pure data

- [x] Task 2: Create `apps/web/src/utils/storyManifest.ts` (AC1, AC2)
  - [x] Define and export `ManifestEntry` interface with fields: `id`, `filename`, `title`, `titleJa`, `difficulty` (optional string or null), `language`, `description`
  - [x] Export `isManifestEntry(obj: unknown): obj is ManifestEntry` type guard
  - [x] Leave `fetchManifest()` for Story 3.2 — do NOT add it here
  - [x] Add JSDoc docstring to both exports

- [x] Task 3: Create `apps/web/src/components/DifficultyBadge.tsx` (AC3, AC4)
  - [x] Accept prop: `difficulty: string`
  - [x] Render a `<span>` pill: `accent-subtle` bg, `accent` border, rounded, small text
  - [x] Set `aria-label={difficulty}` on the span
  - [x] Text content is the raw difficulty string (no reformatting)
  - [x] Use `cn()` for all class composition
  - [x] JSDoc docstring on the exported function

- [x] Task 4: Create `apps/web/src/components/StoryCard.tsx` (AC2, AC4)
  - [x] Import `ManifestEntry` from `@/utils/storyManifest`
  - [x] Accept prop: `entry: ManifestEntry`
  - [x] Render as a `<Link to={`/read/${entry.id}`}>` (react-router-dom `Link`)
  - [x] Layout order: English title → Japanese title → DifficultyBadge → description
  - [x] English title: bold, `paper-text`, 1rem
  - [x] Japanese title: `font-ja`, `text-muted`, smaller (`text-sm`), `lang="ja"`
  - [x] DifficultyBadge: only rendered when `entry.difficulty != null`
  - [x] Description: `text-sm text-muted`, max 2 lines (`line-clamp-2`)
  - [x] Border: `border-border` by default; `hover:border-accent` on hover; `transition-colors`
  - [x] Use `cn()` for all class composition
  - [x] JSDoc docstring on the exported function

- [x] Task 5: Create `apps/web/src/__tests__/DifficultyBadge.test.tsx` (AC3, AC4, AC5)
  - [x] Test: renders difficulty text content
  - [x] Test: has `aria-label` matching the difficulty string
  - [x] Test: has `accent-subtle` and `accent` styling classes

- [x] Task 6: Create `apps/web/src/__tests__/StoryCard.test.tsx` (AC2, AC4, AC5)
  - [x] Wrap all renders in `<MemoryRouter>` (StoryCard uses `Link`)
  - [x] Test: renders English title, Japanese title, description
  - [x] Test: renders DifficultyBadge when difficulty is present
  - [x] Test: does NOT render DifficultyBadge when difficulty is null
  - [x] Test: does NOT render DifficultyBadge when difficulty field is undefined/absent
  - [x] Test: link `href` is `/read/${entry.id}`

- [x] Task 7: Run unit tests (AC5)
  - [x] Run `pnpm test:unit` inside `apps/web` — all existing tests pass; new tests pass

### Review Findings

- [x] [Review][Decision] Difficulty string format — resolved: `"Genki I Ch.6"` (no interpunct) is canonical per AC3; UX-DR8 interpunct example dismissed as noise
- [x] [Review][Patch] English title uses `font-semibold` but AC2 and UX-DR7 require `font-bold` [StoryCard.tsx:20]
- [x] [Review][Patch] `isManifestEntry` accepts non-string `difficulty` (e.g. `42`, `true`) — add `!('difficulty' in e) || e.difficulty === null || typeof e.difficulty === 'string'` check [storyManifest.ts:13-23]
- [x] [Review][Patch] `isManifestEntry` accepts empty-string `id`, producing a broken `/read/` route — add `e.id.length > 0` guard [storyManifest.ts:16]
- [x] [Review][Patch] `StoryCard` uses `entry.difficulty != null` which passes empty-string `""`, rendering a blank badge — change to truthy check `entry.difficulty` [StoryCard.tsx:22]
- [x] [Review][Defer] `ReaderRoute` loader hardcoded to genki story — will silently serve wrong content if a second manifest entry is added — deferred, Story 3.3 scope [ReaderRoute.tsx:29]
- [x] [Review][Defer] `manifest.json` has no build-time schema validation — a typo silently drops the story from the library — deferred, Story 3.2 adds `fetchManifest` with `isManifestEntry` per entry [manifest.json]
- [x] [Review][Defer] No unit tests for `isManifestEntry` type guard boundary cases — deferred, Story 3.2 AC explicitly scopes these tests [storyManifest.ts]
- [x] [Review][Defer] `StoryCard` link announces full concatenated text (title + Japanese + description) to AT — deferred, standard card-link pattern, design-level concern [StoryCard.tsx]
- [x] [Review][Defer] `filename` field in `ManifestEntry` creates an implicit `id + ".json"` invariant with no enforcement — deferred, architectural decision defined in epics spec [storyManifest.ts:5]

## Dev Notes

### manifest.json Content

Create `apps/web/public/stories/manifest.json` as a JSON array:

```json
[
  {
    "id": "genki-i-ch6-tanaka-letter",
    "filename": "genki-i-ch6-tanaka-letter.json",
    "title": "A Letter from Mary",
    "titleJa": "メアリーさんのてがみ",
    "difficulty": "Genki I Ch.6",
    "language": "Japanese",
    "description": "Mary writes a letter about her daily routine as a university student in Japan."
  }
]
```

This matches the metadata in the story file created in Story 2.5. The `id` is the permanent slug used as the URL parameter in `/read/:storyId`. IDs are permanent — never reorder or reuse.

### ManifestEntry Type (`utils/storyManifest.ts`)

```typescript
/** A single entry in the story manifest. */
export interface ManifestEntry {
  id: string
  filename: string
  title: string
  titleJa: string
  difficulty?: string | null
  language: string
  description: string
}

/** Type guard for ManifestEntry — validates that an unknown object has all required fields. */
export function isManifestEntry(obj: unknown): obj is ManifestEntry {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.filename === 'string' &&
    typeof e.title === 'string' &&
    typeof e.titleJa === 'string' &&
    typeof e.language === 'string' &&
    typeof e.description === 'string'
  )
}
```

**CRITICAL — Story 3.2 boundary:** Do NOT add `fetchManifest()` here. Story 3.2 adds it. The type and guard are enough for StoryCard to work.

### DifficultyBadge Component

```tsx
import { cn } from '@/lib/utils'

interface DifficultyBadgeProps {
  difficulty: string
}

/** Rounded pill badge displaying a story difficulty label (e.g. "Genki I Ch.6", "JLPT N4"). */
export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return (
    <span
      aria-label={difficulty}
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs',
        'bg-accent-subtle border border-accent text-paper-text',
      )}
    >
      {difficulty}
    </span>
  )
}
```

**No conditional rendering in DifficultyBadge itself** — the parent (StoryCard) is responsible for not rendering DifficultyBadge when difficulty is null/absent. The badge always renders when it receives a `difficulty` prop.

### StoryCard Component

```tsx
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DifficultyBadge } from '@/components/DifficultyBadge'
import type { ManifestEntry } from '@/utils/storyManifest'

interface StoryCardProps {
  entry: ManifestEntry
}

/** Library card for a single story — links to the reader and displays title, difficulty, and description. */
export function StoryCard({ entry }: StoryCardProps) {
  return (
    <Link
      to={`/read/${entry.id}`}
      className={cn(
        'block p-4 rounded border border-border hover:border-accent',
        'transition-colors bg-surface text-paper-text no-underline',
      )}
    >
      <p className="font-semibold text-paper-text">{entry.title}</p>
      <p className="font-ja text-sm text-muted" lang="ja">{entry.titleJa}</p>
      {entry.difficulty != null && <DifficultyBadge difficulty={entry.difficulty} />}
      <p className="text-sm text-muted line-clamp-2 mt-1">{entry.description}</p>
    </Link>
  )
}
```

**Why `Link` not `<a>`:** Enables React Router client-side navigation. Always use `Link` for in-app routes.
**Why `no-underline`:** Tailwind removes the default browser underline on `<a>` elements for cards.
**`entry.difficulty != null`:** This guard is `!== null && !== undefined` (the `!=` null check covers both). The `difficulty` field in ManifestEntry is `string | null | undefined` — this correctly handles all absent-difficulty cases.

### Testing StoryCard

Tests require `MemoryRouter` wrapping because `StoryCard` renders `<Link>`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoryCard } from '@/components/StoryCard'
import type { ManifestEntry } from '@/utils/storyManifest'

const entry: ManifestEntry = {
  id: 'test-story',
  filename: 'test-story.json',
  title: 'Test Story',
  titleJa: 'テスト',
  difficulty: 'Genki I Ch.6',
  language: 'Japanese',
  description: 'A test description for this story.',
}

describe('StoryCard', () => {
  it('renders English title, Japanese title, and description', () => {
    render(<MemoryRouter><StoryCard entry={entry} /></MemoryRouter>)
    expect(screen.getByText('Test Story')).toBeInTheDocument()
    expect(screen.getByText('テスト')).toBeInTheDocument()
    expect(screen.getByText('A test description for this story.')).toBeInTheDocument()
  })

  it('links to /read/:id', () => {
    render(<MemoryRouter><StoryCard entry={entry} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/read/test-story')
  })

  it('renders DifficultyBadge when difficulty is present', () => {
    render(<MemoryRouter><StoryCard entry={entry} /></MemoryRouter>)
    expect(screen.getByText('Genki I Ch.6')).toBeInTheDocument()
  })

  it('does not render DifficultyBadge when difficulty is null', () => {
    render(<MemoryRouter><StoryCard entry={{ ...entry, difficulty: null }} /></MemoryRouter>)
    expect(screen.queryByText('Genki I Ch.6')).not.toBeInTheDocument()
  })

  it('does not render DifficultyBadge when difficulty is absent', () => {
    const { difficulty: _d, ...entryNoDiff } = entry
    render(<MemoryRouter><StoryCard entry={entryNoDiff} /></MemoryRouter>)
    expect(screen.queryByText('Genki I Ch.6')).not.toBeInTheDocument()
  })
})
```

### Testing DifficultyBadge

No router needed — no `Link` in DifficultyBadge:

```tsx
import { render, screen } from '@testing-library/react'
import { DifficultyBadge } from '@/components/DifficultyBadge'

describe('DifficultyBadge', () => {
  it('renders the difficulty string', () => {
    render(<DifficultyBadge difficulty="Genki I Ch.6" />)
    expect(screen.getByText('Genki I Ch.6')).toBeInTheDocument()
  })

  it('has aria-label matching the difficulty string', () => {
    render(<DifficultyBadge difficulty="JLPT N4" />)
    expect(screen.getByLabelText('JLPT N4')).toBeInTheDocument()
  })

  it('applies accent-subtle and accent-border styling', () => {
    render(<DifficultyBadge difficulty="Genki I Ch.6" />)
    const badge = screen.getByText('Genki I Ch.6')
    expect(badge).toHaveClass('bg-accent-subtle')
    expect(badge).toHaveClass('border-accent')
  })
})
```

### Patterns from Previous Stories (Epic 2)

- **`cn()` for all class composition** — never raw string concatenation ([`lib/utils.ts`](apps/web/src/lib/utils.ts))
- **Named export matching filename** — `DifficultyBadge.tsx` → `export function DifficultyBadge`
- **`lang="ja"` on all Japanese text** — `titleJa` must have `lang="ja"` on its containing element
- **Design tokens only** — use `text-muted`, `border-accent`, `bg-accent-subtle` etc.; never raw hex colours or arbitrary Tailwind values
- **JSDoc on exported functions** — one-line docstring per exported component/function
- **`MemoryRouter` for Link-using components** — any component using `Link` needs router context in tests
- **Vitest globals** — `describe`/`it`/`expect` are available without imports (globals: true in vitest config)
- **No `afterEach(_reset)` needed** — this story's components have no store subscriptions, so no store teardown required

### What This Story Does NOT Include

- `LibraryRoute.tsx` implementation — Story 3.2 replaces the current stub
- `fetchManifest()` in `storyManifest.ts` — Story 3.2 adds this
- Story filtering UI — Story 3.2
- File upload CTA — Story 3.4
- `indexedDbService.ts` — Story 3.4
- Any changes to `ReaderRoute.tsx`, stores, or services

### Project Structure Notes

**New files (CREATE):**
- `apps/web/public/stories/manifest.json`
- `apps/web/src/utils/storyManifest.ts`
- `apps/web/src/components/DifficultyBadge.tsx`
- `apps/web/src/components/StoryCard.tsx`
- `apps/web/src/__tests__/DifficultyBadge.test.tsx`
- `apps/web/src/__tests__/StoryCard.test.tsx`

**Do NOT modify:**
- `apps/web/src/routes/LibraryRoute.tsx` (Story 3.2)
- `apps/web/src/routes/ReaderRoute.tsx` (Story 3.3 replaces loader body)
- `apps/web/src/router.tsx`
- Any store or service files
- Any existing test files

### References

- Manifest structure and StoryCard spec: [epics.md — Story 3.1 ACs]
- StoryCard UX spec: [epics.md — UX-DR7]
- DifficultyBadge UX spec: [epics.md — UX-DR8]
- Design tokens: [project-context.md — Styling (Tailwind + shadcn/ui)]
- File organisation convention: [project-context.md — File Organisation]
- `cn()` import: [project-context.md — Imports]
- Testing conventions: [project-context.md — Unit Tests (Vitest)]
- `MemoryRouter` pattern for Link: [Story 2.5 dev notes — testing with react-router context]
- `isManifestEntry` type guard is unit-tested in Story 3.2 (`utils/storyManifest.ts`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `manifest.json` created with one entry matching the Story 2.5 genki-i-ch6 story metadata exactly; permanent slug `id` field aligns with the route parameter used in `ReaderRoute`.
- `utils/storyManifest.ts` created with `ManifestEntry` interface (`difficulty?: string | null`) and `isManifestEntry` type guard; `fetchManifest()` deliberately omitted — Story 3.2 boundary.
- `DifficultyBadge.tsx`: renders only when called by parent; `aria-label` set directly on the `<span>` so `getByLabelText` works in tests; design tokens `bg-accent-subtle`, `border-accent`, `rounded-full` applied.
- `StoryCard.tsx`: `entry.difficulty != null` guard (covers both `null` and `undefined`) correctly suppresses the badge; `Link` used for client-side navigation; `lang="ja"` on `titleJa` paragraph; `no-underline` prevents browser default anchor underline on the card.
- Tests: `DifficultyBadge` — 4 tests, no router needed. `StoryCard` — 7 tests wrapped in `MemoryRouter`; destructs `difficulty` field to test undefined case. All 94 tests pass (94 total; 11 new; 83 pre-existing — zero regressions).

### File List

- `apps/web/public/stories/manifest.json` (new)
- `apps/web/src/utils/storyManifest.ts` (new)
- `apps/web/src/components/DifficultyBadge.tsx` (new)
- `apps/web/src/components/StoryCard.tsx` (new)
- `apps/web/src/__tests__/DifficultyBadge.test.tsx` (new)
- `apps/web/src/__tests__/StoryCard.test.tsx` (new)
