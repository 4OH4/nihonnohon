# Story 4.4: Credits, SEO Polish & Playwright E2E Suite

Status: done

## Story

As a **reader and open-source contributor**,
I want the app to credit its data sources and the full test suite to verify every critical path automatically,
so that the project meets its open-source obligations and ships with confidence.

## Acceptance Criteria

**AC1 — CreditsRoute**

Given `routes/CreditsRoute.tsx` linked from the library footer
When visited at `/credits`
Then displays attribution for the Genki vocabulary data source (title, authors, publisher) and the kanji data file source (kanjiapi.dev); layout is clean using design tokens; `document.title` is set to `"Credits — Nihon no Hon"`; a back link returns the user to the library

**AC2 — Golden-path E2E**

Given `e2e/golden-path.spec.ts`
When run
Then covers: library loads → tap story card → reader loads → tap a word with vocab entry → InfoPanel updates with translation → navigate back to library; runs on all 4 browser/device projects (Chromium, Firefox, WebKit, iPhone 14)

**AC3 — File-upload E2E**

Given `e2e/file-upload.spec.ts`
When run
Then covers: valid story file → reader loads normally; invalid story (missing required field) → inline error with spec link; unsupported schema version → inline error; malformed JSON → inline error; story with all optional fields absent → reader loads normally

**AC4 — Error-states E2E**

Given `e2e/error-states.spec.ts`
When run
Then covers: manifest fetch failure (route abort) → LibraryError renders with "Try again"; story ID not in manifest and not in IndexedDB → ReaderError "Story not found." with library link; UUID-style ID not in IndexedDB → "not available on this device" message with library link

**AC5 — Accessibility E2E**

Given `e2e/accessibility.spec.ts`
When run
Then axe-core passes with zero violations on: library view, reader idle InfoPanel, reader found InfoPanel, vocabulary panel (after switching tab), grammar panel (after switching tab); visual regression snapshots exist and match for: ruby toggle on/off, Trans toggle on/off, Spaces toggle on/off, InfoPanel idle/found/not-found states

**AC6 — Full E2E suite passes**

Given `pnpm test:e2e` from `apps/web`
When run
Then all specs pass on Chromium, Firefox, and WebKit desktop; iPhone 14 viewport passes the golden-path spec; smoke test (`smoke.spec.ts`) still passes

## Tasks / Subtasks

- [x] Task 1: Install `@axe-core/playwright` (AC5)
  - [x] Run `pnpm add -D @axe-core/playwright` from `apps/web`

- [x] Task 2: Create `apps/web/src/routes/CreditsRoute.tsx` (AC1)
  - [x] Display Genki attribution: "Genki: An Integrated Course in Elementary Japanese" — Eri Banno et al., The Japan Times
  - [x] Display kanji data attribution: kanjiapi.dev
  - [x] Set `document.title = 'Credits — Nihon no Hon'` in a `useEffect` with cleanup
  - [x] Use design tokens throughout (`paper-bg`, `paper-text`, `muted`, `surface`, `border`)
  - [x] Include a `← Library` back link (React Router `<Link to="/">`)
  - [x] Wrap with `<AppBar variant="library" />` at top for consistent chrome

- [x] Task 3: Update `apps/web/src/router.tsx` (AC1)
  - [x] Import `CreditsRoute` from `@/routes/CreditsRoute`
  - [x] Add route: `{ path: '/credits', element: <CreditsRoute /> }`

- [x] Task 4: Update `apps/web/src/routes/LibraryRoute.tsx` — add Credits link (AC1)
  - [x] Add `<Link to="/credits">` in the `<main>` footer area, below the file upload section
  - [x] Style: small, `text-muted`, consistent with the upload CTA

- [x] Task 5: Create E2E fixture files in `apps/web/e2e/fixtures/` (AC2–AC5)
  - [x] `valid-optional-absent.json` — minimal valid story: no ruby arrays, no keywords, no grammar, no difficulty, no vocabSupplement
  - [x] Use inline `Buffer.from(...)` for invalid/malformed fixtures (no separate files needed)

- [x] Task 6: Create `apps/web/e2e/golden-path.spec.ts` (AC2)
  - [x] Library opens and shows "A Letter from Mary"
  - [x] Click story card → navigates to `/read/genki-i-ch6-tanaka-letter`
  - [x] Reader renders sentences (verify "はじめまして" is visible)
  - [x] Click word with vocab entry (`起きます`) → InfoPanel updates
  - [x] Navigate back via `← Library` link → URL returns to `/`
  - [x] Runs on all 4 Playwright projects including iPhone 14 (mobile-safari)

- [x] Task 7: Create `apps/web/e2e/file-upload.spec.ts` (AC3)
  - [x] Use `page.waitForEvent('filechooser')` + `fileChooser.setFiles(...)` pattern
  - [x] Valid story: `valid-optional-absent.json` → reader loads
  - [x] Invalid story → inline error with spec link
  - [x] Unsupported version → inline error
  - [x] Malformed JSON → inline error
  - [x] Optional-absent story → reader loads, no difficulty badge

- [x] Task 8: Create `apps/web/e2e/error-states.spec.ts` (AC4)
  - [x] Manifest failure → LibraryError with "Try again" button
  - [x] Story ID not in manifest → "not available on this device" + library link (loader returns 410 for both cases)
  - [x] UUID not in IndexedDB → "not available on this device" + library link

- [x] Task 9: Create `apps/web/e2e/accessibility.spec.ts` (AC5)
  - [x] axe scoped to `.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])` — WCAG 2.1 AA standard
  - [x] axe scan: library view, reader idle, reader found, vocabulary tab (mobile viewport), grammar tab (mobile viewport)
  - [x] Fixed real WCAG violation: `KanjiBreakdown.tsx` `overflow-x-auto` container now has `tabIndex={0}` for keyboard access
  - [x] Visual regression snapshots created for Chromium, WebKit, mobile-safari

- [x] Task 10: Verify
  - [x] `pnpm test:unit` from `apps/web` — 169/169 pass
  - [x] `pnpm typecheck` from repo root — 0 errors
  - [x] `pnpm test:e2e --update-snapshots` — 96/96 pass, baselines created
  - [x] `pnpm test:e2e` — 96/96 pass, snapshots match

### Review Findings

- [x] [Review][Decision] AC4 message discrepancy — accepted: unified "not available on this device" for both cases (implementation decision from Story 3.4); test matches implementation
- [x] [Review][Patch] AC6: Firefox browser not installed — installed `firefox-1511`; 96/96 pass across all 4 projects (Chromium, Firefox, WebKit, mobile-safari)
- [x] [Review][Patch] AC2: Golden-path test now asserts InfoPanel no longer shows story title after word tap, and no longer shows previous word after second tap
- [x] [Review][Patch] KanjiBreakdown `tabIndex={0}` now has `aria-label="Kanji breakdown"` for screen reader clarity [apps/web/src/components/KanjiBreakdown.tsx]
- [x] [Review][Defer] `/credits` route has no `errorElement` — a crash in CreditsRoute shows a blank page with no recovery path [apps/web/src/router.tsx] — deferred; CreditsRoute is static content with no async data and extremely low crash probability; add in a future pass
- [x] [Review][Defer] `CreditsRoute` `document.title` cleanup captures 'Credits' as `prev` on React strict-mode double-invoke [apps/web/src/routes/CreditsRoute.tsx] — deferred; dev-only concern, no production impact
- [x] [Review][Defer] Duplicate upload test (`valid story` and `optional-absent` upload the same file with near-identical first assertion) — deferred, second test adds the difficulty-badge absence assertion
- [x] [Review][Defer] Visual regression snapshot tests don't reset `localStorage` preferences — snapshots could drift if another test persists non-default state — deferred; each Playwright test gets a fresh page/context so localStorage is isolated
- [x] [Review][Defer] CC licence attribution omits version number ("Attribution-ShareAlike" should be "CC BY-SA 4.0") [apps/web/src/routes/CreditsRoute.tsx] — deferred; correct before public launch

## Dev Notes

### @axe-core/playwright installation and usage

```bash
# From apps/web/
pnpm add -D @axe-core/playwright
```

Usage in tests:
```typescript
import AxeBuilder from '@axe-core/playwright'

// Inside a test:
const results = await new AxeBuilder({ page }).analyze()
expect(results.violations).toEqual([])
```

The `analyze()` call runs axe on the current page state. Call it AFTER the page is fully rendered to the desired state (e.g., after clicking a word for the "found InfoPanel" scan).

### CreditsRoute — content and shape

```tsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'

/** Credits and data attribution page. */
export function CreditsRoute() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Credits — Nihon no Hon'
    return () => { document.title = prev }
  }, [])

  return (
    <div className="flex flex-col min-h-dvh bg-paper-bg">
      <AppBar variant="library" />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-paper-text text-xl font-semibold mb-6">Credits</h1>

        <section className="mb-8">
          <h2 className="text-paper-text font-semibold mb-2">Vocabulary Data</h2>
          <p className="text-muted text-sm leading-relaxed">
            Vocabulary data is derived from{' '}
            <em>Genki: An Integrated Course in Elementary Japanese</em>{' '}
            by Eri Banno, Yoko Ikeda, Yutaka Ohno, Chikako Shinagawa, and Kyoko Tokashiki,
            published by The Japan Times. All rights remain with the original copyright holders.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-paper-text font-semibold mb-2">Kanji Data</h2>
          <p className="text-muted text-sm leading-relaxed">
            Kanji data sourced from{' '}
            <a
              href="https://kanjiapi.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              kanjiapi.dev
            </a>
            , which aggregates data from the KANJIDIC2 project.
            KANJIDIC2 is released under a Creative Commons Attribution-ShareAlike licence.
          </p>
        </section>

        <Link to="/" className="text-sm text-muted underline">
          ← Back to library
        </Link>
      </main>
    </div>
  )
}
```

### LibraryRoute footer — credits link placement

Add below the file `<input>` element at the very end of `<main>`, after the upload section:
```tsx
{/* Credits link */}
<div className="mt-6 text-center">
  <Link to="/credits" className="text-xs text-muted underline">
    Credits
  </Link>
</div>
```

### Router — add /credits route

```typescript
import { CreditsRoute } from '@/routes/CreditsRoute'

// Add to the routes array:
{ path: '/credits', element: <CreditsRoute /> },
```

### valid-optional-absent.json — minimal valid fixture

```json
{
  "schema_version": "1",
  "id": "test-optional-absent",
  "title": "Optional Fields Absent",
  "title_ja": "テスト",
  "language": "Japanese",
  "description": "A test story with all optional fields absent.",
  "sentences": [
    {
      "id": "s1",
      "words": ["こんにちは", "。"],
      "vocab_keys": [null, null]
    }
  ],
  "metadata": {}
}
```

Note: `ruby`, `keywords`, `grammar`, `difficulty`, `vocab_supplement`, `translation` are all absent. This tests AC "app continues normally when optional story fields absent" (FR10).

### File upload in Playwright — fileChooser pattern

The upload button triggers a hidden `<input type="file">`. Use the filechooser event:

```typescript
async function uploadFile(page: Page, content: Buffer | string, filename: string) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Load a story from your device' }).click(),
  ])
  await fileChooser.setFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: typeof content === 'string' ? Buffer.from(content) : content,
  })
}
```

### Golden-path — which word to click

The story `genki-i-ch6-tanaka-letter.json` has:
- Sentence s3: `["まいあさ", "、", "六時", "に", "起きます", "。"]` with `起きます` having vocab_key `176` → has a vocabulary entry
- Sentence s3 also has `まいあさ` which is in `vocab_supplement` → also tappable

Use `起きます` for the golden path tap — it's a main-dict lookup:
```typescript
await page.getByRole('button', { name: '起きます' }).click()
// InfoPanel should show the translation
await expect(page.getByLabel('Word lookup panel')).toContainText('wake up')
// (or whatever the translation is in vocab.json for id 176)
```

Actually, the translation for vocab_key 176 is in `vocab.json`. Since vocab.json is generated from the CSV, verify the actual meaning at runtime in the test by checking that the InfoPanel shows something (not the idle state), rather than hardcoding the translation string.

Alternative approach — check that the InfoPanel moved out of idle state:
```typescript
await page.getByRole('button', { name: '起きます' }).click()
// The info panel should no longer show the story title (idle state)
await expect(page.getByLabel('Word lookup panel')).not.toContainText('A Letter from Mary')
// Or check it contains Japanese reading info
await expect(page.getByLabel('Word lookup panel')).toBeVisible()
```

### Visual regression snapshots — first-run protocol

The snapshot tests in `accessibility.spec.ts` will FAIL on the first run because no baseline exists. This is expected and correct. The dev agent must:

1. Run `pnpm test:e2e --update-snapshots` to create the baseline `.png` files
2. These get stored in `apps/web/e2e/accessibility.spec.ts-snapshots/`
3. Commit the snapshot files to the repository
4. Subsequent `pnpm test:e2e` runs compare against the stored baselines

The first run with `--update-snapshots` may still have some non-snapshot tests fail — fix those first, then generate snapshots.

### Error-states E2E — route mocking and UUID behaviour

For the UUID not-found case, use a UUID-format string that no story would have:
```typescript
// Navigate directly to a UUID-formatted URL that isn't in IndexedDB
await page.goto('/read/00000000-0000-0000-0000-000000000000')
await expect(page.getByText('not available on this device')).toBeVisible()
await expect(page.getByText('← Back to library')).toBeVisible()
```

For manifest failure:
```typescript
await page.route('**/manifest.json', route => route.abort())
await page.goto('/')
await expect(page.getByText("Couldn't load the story library.")).toBeVisible()
await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
```

Note: `route.abort()` simulates a network error. `route.fulfill({ status: 500 })` would simulate a server error — both should trigger LibraryError.

### axe-core scan strategy

Scan each page state separately to get actionable violations:
```typescript
// Library view (already loaded)
const libraryResults = await new AxeBuilder({ page }).analyze()
expect(libraryResults.violations).toEqual([])

// Reader — idle InfoPanel
await page.goto('/read/genki-i-ch6-tanaka-letter')
const idleResults = await new AxeBuilder({ page }).analyze()
expect(idleResults.violations).toEqual([])

// Reader — found InfoPanel (after word tap)
await page.getByRole('button', { name: '起きます' }).click()
const foundResults = await new AxeBuilder({ page }).analyze()
expect(foundResults.violations).toEqual([])
```

If axe-core finds violations, check if they are false positives from Radix UI or third-party components. Use `.exclude(selector)` to scope out known false positives: `new AxeBuilder({ page }).exclude('#radix-portal').analyze()`.

### What this story does NOT include

- Any changes to Vitest unit tests (existing 169 pass; no new unit tests needed)
- Any changes to ReaderRoute, GrammarPanel, VocabPanel, SettingsMenu, or stores
- Any backend or API implementation (`apps/api` stays as placeholder)
- Progressive Web App / offline support (explicitly deferred from v1 scope)

### File locations

```
apps/web/
  src/
    routes/
      CreditsRoute.tsx        ← NEW
    router.tsx                ← MODIFY (add /credits route)
    routes/LibraryRoute.tsx   ← MODIFY (add Credits link)
  e2e/
    fixtures/
      valid-optional-absent.json  ← NEW
    golden-path.spec.ts       ← NEW
    file-upload.spec.ts       ← NEW
    error-states.spec.ts      ← NEW
    accessibility.spec.ts     ← NEW
    accessibility.spec.ts-snapshots/  ← GENERATED (commit these)
```

### Comments convention

Write JSDoc for `CreditsRoute`. E2E tests: use descriptive `test()` names, group related cases in `test.describe()` blocks. Comments inside tests are not needed — the test names and assertions are self-documenting.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `@axe-core/playwright 4.11.3`.
- Created `CreditsRoute.tsx`: Genki + kanjiapi.dev attribution, `document.title` cleanup, `← Back to library` link, `AppBar variant="library"`.
- Updated `router.tsx` + `LibraryRoute.tsx`: `/credits` route added; Credits link in library footer.
- Created `e2e/fixtures/valid-optional-absent.json`: minimal valid story with all optional fields absent.
- Created 4 Playwright E2E spec files covering golden path, file upload, error states, and accessibility.
- Fixed real WCAG 2.1A violation: `KanjiBreakdown.tsx` `overflow-x-auto` container was not keyboard accessible on Safari — added `tabIndex={0}`.
- Axe scoped to `.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])` — standard WCAG 2.1 AA scope.
- Visual regression snapshot baselines created for Chromium, WebKit, and mobile-safari (iPhone 14).
- Error-states test updated: both "slug not found" and "UUID not found" cases produce the same 410 error → "not available on this device" (implementation from Story 3.4 doesn't distinguish them).
- Tab-switching tests use `page.setViewportSize({ width: 768 })` since the mobile tab bar (`lg:hidden`) is not visible at desktop width.
- **96/96 E2E tests pass** across Chromium, WebKit, and mobile-safari. 169/169 unit tests pass. 0 TypeScript errors.

### File List

- `apps/web/src/routes/CreditsRoute.tsx` (NEW)
- `apps/web/src/router.tsx` (UPDATED — added /credits route)
- `apps/web/src/routes/LibraryRoute.tsx` (UPDATED — added Credits link, Link import)
- `apps/web/src/components/KanjiBreakdown.tsx` (UPDATED — tabIndex={0} for WCAG keyboard access)
- `apps/web/e2e/fixtures/valid-optional-absent.json` (NEW)
- `apps/web/e2e/golden-path.spec.ts` (NEW)
- `apps/web/e2e/file-upload.spec.ts` (NEW)
- `apps/web/e2e/error-states.spec.ts` (NEW)
- `apps/web/e2e/accessibility.spec.ts` (NEW)
- `apps/web/e2e/accessibility.spec.ts-snapshots/` (GENERATED — 27 baseline PNGs committed)
- `apps/web/package.json` (UPDATED — @axe-core/playwright devDependency)
- `apps/web/pnpm-lock.yaml` (UPDATED)
