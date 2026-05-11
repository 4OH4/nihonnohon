# Story 1.4: Web App Scaffold

Status: review

## Story

As a **developer**,
I want the `apps/web` SPA scaffold running with React Router, Tailwind design tokens, and Zustand store skeletons,
so that all subsequent stories build on a consistent, type-safe foundation without re-doing infrastructure.

## Acceptance Criteria

1. **Given** `turbo dev` is run from repo root **When** the dev server starts **Then** the app loads at localhost without console errors; routes `/` and `/read/:storyId` both render placeholder content without crashing

2. **Given** `turbo build` is run **When** build completes **Then** `apps/web/dist/` contains a deployable static bundle; exit code 0; AJV v8 CommonJS import chain is confirmed working in the Vite/ESM build (no build error from AJV, verifying Story 1.3's assumption)

3. **Given** `apps/web/tailwind.config.ts` **When** reviewed **Then** theme extends with all nine design tokens: `paper-bg: #FDF6E3`, `paper-text: #1C1C1C`, `surface: #FFFFFF`, `surface-subtle: #F5F5F0`, `accent: #C8A85A`, `accent-subtle: #F5EDD6`, `muted: #6B6B6B`, `border: #E0D8C8`, `error: #C0392B`; `fontFamily.ja` set to `['Noto Sans JP', 'system-ui', 'sans-serif']`; Noto Sans JP is loaded as a web font in `index.html`

4. **Given** `apps/web/src/stores/lookupStore.ts` **When** reviewed **Then** skeleton defines the `LookupState` discriminated union, `selectedSentenceId: string | null`, and stub functions `lookup`, `selectSentence`, `reset`, `_reset`; compiles with no TypeScript errors

5. **Given** `apps/web/src/stores/preferenceStore.ts` **When** reviewed **Then** skeleton defines all six persisted fields: `rubyVisible: boolean`, `spacingVisible: boolean`, `transVisible: boolean`, `textSize: 'small' | 'medium' | 'large'`, `activeTab: 'story' | 'vocabulary' | 'grammar'`; Zustand `persist` middleware is wired; compiles with no TypeScript errors **And** all six fields are present in the skeleton so Epic 4 stories are purely additive UI wiring

6. **Given** `vercel.json` at repo root **When** reviewed **Then** contains: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

7. **Given** `tsconfig.app.json` and `vite.config.ts` **When** reviewed **Then** both define `@/*` → `./src/*` path alias; `import { useLookupStore } from '@/stores/lookupStore'` resolves correctly; TypeScript strict mode is enabled; `turbo typecheck` exits 0 across all packages

## Tasks / Subtasks

- [x] Task 1: Update `apps/web/package.json` — complete package configuration (AC: 1, 2, 7)
  - [x] Add `name: "@nihonnohon/web"`, `version: "0.0.0"`, `private: true`, `type: "module"`
  - [x] Add `scripts`: `dev: vite`, `build: tsc -b && vite build`, `preview: vite preview`, `typecheck: tsc -b` (story spec said `tsc --noEmit` but that silently checks nothing with project-references `files:[]` root; `tsc -b` is correct), `lint: eslint .`, `test:e2e: playwright test`
  - [x] Add `dependencies`: `react ^18.3.1`, `react-dom ^18.3.1`, `react-router-dom ^6.24.0`, `zustand ^4.5.4`, `@nihonnohon/schema workspace:*`, `@nihonnohon/story-loader workspace:*`, `clsx ^2.1.0`, `tailwind-merge ^2.3.0`
  - [x] Add `devDependencies`: `vite ^5.3.0`, `@vitejs/plugin-react ^4.3.0`, `typescript ^5.5.0`, `@types/react ^18.3.0`, `@types/react-dom ^18.3.0`, `@types/node ^20.0.0`, `tailwindcss ^3.4.0`, `autoprefixer ^10.4.0`, `postcss ^8.4.0`, `@nihonnohon/typescript-config workspace:*`, `@nihonnohon/eslint-config workspace:*`, `@playwright/test ^1.44.0`, `eslint ^8.57.0`

- [x] Task 2: Create base scaffold files (AC: 1, 7)
  - [x] Create `apps/web/index.html` — loads Noto Sans JP from Google Fonts in `<head>`; sets `<title>Nihon no Hon</title>`; div `id="root"`; script src `/src/main.tsx` with `type="module"`
  - [x] Create `apps/web/vite.config.ts` — `@vitejs/plugin-react`; `resolve.alias` using `fileURLToPath(new URL('./src', import.meta.url))`
  - [x] Create `apps/web/tsconfig.json` — project references to `tsconfig.app.json` and `tsconfig.node.json`
  - [x] Create `apps/web/tsconfig.app.json` — extends `@nihonnohon/typescript-config/react-library.json`; `noEmit: true`; `allowImportingTsExtensions: true`; `paths: { "@/*": ["./src/*"] }`; includes `src`
  - [x] Create `apps/web/tsconfig.node.json` — extends base config; `noEmit: true`; includes vite/tailwind/playwright config files
  - [x] Create `apps/web/src/main.tsx` — ReactDOM.createRoot with `<App />`
  - [x] Create `apps/web/src/App.tsx` — renders `<Router />`
  - [x] Create `apps/web/src/router.tsx` — createBrowserRouter with `/` and `/read/:storyId` routes; imports + re-exports `loadStory`/`LoaderError` from `@nihonnohon/story-loader` to verify AJV chain

- [x] Task 3: Configure Tailwind CSS (AC: 3)
  - [x] Create `apps/web/tailwind.config.ts` — exact nine design tokens as Tailwind `theme.extend.colors`; `fontFamily.ja`; content glob covers `./src/**/*.{ts,tsx}`; plus `translation` token (#4A7B9D)
  - [x] Create `apps/web/postcss.config.js` — ESM export with `tailwindcss` + `autoprefixer`
  - [x] Create `apps/web/src/index.css` — `@tailwind base/components/utilities`; `:root { --story-font-size: 1.25rem }`; `ruby` position/align rules; `.word-token { white-space: nowrap }`; `.ruby-hidden rt { visibility: hidden }`

- [x] Task 4: Wire shadcn/ui (supports Epic 2+ component work)
  - [x] Create `apps/web/components.json` — shadcn/ui config with `tailwind.config.ts`, `@/` alias, `rsc: false`, `cssVariables: false`
  - [x] Create `apps/web/src/lib/utils.ts` — `cn()` using `clsx` + `tailwind-merge`
  - [x] `clsx ^2.1.0` and `tailwind-merge ^2.3.0` added to dependencies in Task 1

- [x] Task 5: Create store skeletons (AC: 4, 5)
  - [x] Create `apps/web/src/stores/lookupStore.ts` — exact skeleton per Dev Notes
  - [x] Create `apps/web/src/stores/preferenceStore.ts` — exact skeleton per Dev Notes; fixed TS error by annotating initializer return type as `PreferenceStoreState`

- [x] Task 6: Create route placeholders (AC: 1)
  - [x] Create `apps/web/src/routes/LibraryRoute.tsx` — placeholder `<main>` with heading
  - [x] Create `apps/web/src/routes/ReaderRoute.tsx` — placeholder `<main>` with heading

- [x] Task 7: Create/update `vercel.json` at repo root (AC: 6)
  - [x] Confirmed `vercel.json` did not exist — created new
  - [x] Contains SPA rewrite AND `rootDirectory: "apps/web"`

- [x] Task 8: Set up Playwright infrastructure (Epic 1 note: required in story 1.4)
  - [x] Create `apps/web/playwright.config.ts` — baseURL, webServer, testDir, 4 projects including iPhone 14
  - [x] Create `apps/web/e2e/smoke.spec.ts` — asserts HTTP 200 and non-empty title
  - [x] Ran `playwright install chromium` — Chrome for Testing 147.0.7727.15 installed

- [x] Task 9: Update `.gitignore` at repo root (deferred from Story 1.1 code review)
  - [x] Added `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `.eslintcache`
  - [x] `apps/web/public/vocab.json` already excluded from Story 1.1

- [x] Task 10: Install dependencies and verify (AC: 1, 2, 7)
  - [x] `pnpm install` — 207 packages added (esbuild build scripts approved via `pnpm rebuild esbuild`)
  - [x] `turbo typecheck` — exits 0 across all packages (schema, story-loader, web)
  - [x] `turbo build` — exits 0; `apps/web/dist/` produced (327KB JS, 4.9KB CSS); no AJV build error
  - [x] Playwright smoke test — 1 passed; app loads at localhost:5173 with non-empty title

## Dev Notes

### Current State of apps/web (from Story 1.1)

```
apps/web/
└── package.json    ← stub: { "name": "@nihonnohon/web", "version": "0.0.0", "private": true, "license": "MIT" }
```

Only a package.json stub exists. **Everything else must be created from scratch.**

### AJV v8 Chain Verification — CRITICAL

Story 1.3 put AJV in devDependencies of `@nihonnohon/story-loader` so tsup bundles it into `dist/index.mjs` (~250KB). Vite consuming `@nihonnohon/story-loader` should not encounter AJV directly.

**To satisfy AC 2**, `apps/web` must import from `@nihonnohon/story-loader` in a module included in the Vite build, so that `turbo build` exercises the bundled AJV code. Recommended approach: import `loadStory` and `LoaderError` in `src/router.tsx` as forward references for Epic 2/3:

```tsx
// src/router.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LibraryRoute } from '@/routes/LibraryRoute'
import { ReaderRoute } from '@/routes/ReaderRoute'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'

// loadStory and LoaderError will be used by route loaders from Epic 2 onwards.
// Their presence here confirms the AJV v8 CommonJS → Vite/ESM chain works (Story 1.4 AC 2).
export { loadStory, LoaderError }

const router = createBrowserRouter([
  { path: '/', element: <LibraryRoute /> },
  { path: '/read/:storyId', element: <ReaderRoute /> },
])

export function Router() {
  return <RouterProvider router={router} />
}
```

If the build fails with an AJV-related error (e.g., "exports is not defined", "require is not a function"), check that `@nihonnohon/story-loader` has been built (`turbo build --filter=@nihonnohon/story-loader`) and that `dist/` exists before running `turbo build` for apps/web.

### lookupStore.ts — Exact Skeleton

```ts
// src/stores/lookupStore.ts
import { create } from 'zustand'
import type { LookupState, VocabEntry } from '@nihonnohon/schema'

interface LookupStoreState {
  lookupState: LookupState
  selectedSentenceId: string | null
  lookup: (word: string, entry: VocabEntry | null, sentenceId: string) => void
  selectSentence: (sentenceId: string) => void
  reset: () => void
  _reset: () => void
}

const initialState = {
  lookupState: { status: 'idle' } as LookupState,
  selectedSentenceId: null as string | null,
}

export const useLookupStore = create<LookupStoreState>()((set) => ({
  ...initialState,
  lookup: (_word, _entry, _sentenceId) => {
    // Full implementation in Story 2.2
  },
  selectSentence: (_sentenceId) => {
    // Full implementation in Story 2.2
  },
  reset: () => set(initialState),
  _reset: () => set(initialState),
}))
```

**CRITICAL:** `lookupStore` must NEVER import from `preferenceStore`. These two stores are strictly isolated — both directions.

### preferenceStore.ts — Exact Skeleton

```ts
// src/stores/preferenceStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferenceStoreState {
  rubyVisible: boolean
  spacingVisible: boolean
  transVisible: boolean
  textSize: 'small' | 'medium' | 'large'
  activeTab: 'story' | 'vocabulary' | 'grammar'
}

export const usePreferenceStore = create<PreferenceStoreState>()(
  persist(
    () => ({
      rubyVisible: true,
      spacingVisible: false,
      transVisible: false,
      textSize: 'medium' as const,
      activeTab: 'story' as const,
    }),
    { name: 'nihonnohon-preferences' }
  )
)
```

All 6 fields must be present in the skeleton even though setters are added in Epic 4 — this makes Epic 4 purely additive UI wiring with no structural changes to the store.

**CRITICAL:** `preferenceStore` must NEVER import from `lookupStore`.

### Tailwind Design Tokens — Exact Specification

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'paper-bg': '#FDF6E3',
        'paper-text': '#1C1C1C',
        surface: '#FFFFFF',
        'surface-subtle': '#F5F5F0',
        accent: '#C8A85A',
        'accent-subtle': '#F5EDD6',
        muted: '#6B6B6B',
        border: '#E0D8C8',
        error: '#C0392B',
        translation: '#4A7B9D',
      },
      fontFamily: {
        ja: ['Noto Sans JP', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

### Noto Sans JP — index.html Web Font

Add to `<head>` in `apps/web/index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
```

### vercel.json — Root-Level Config

The architecture specifies `vercel.json` at repo root with both SPA rewrite and `rootDirectory`:
```json
{
  "rootDirectory": "apps/web",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`rootDirectory: "apps/web"` tells Vercel to deploy from the web app's dist folder, not the monorepo root. Without it, Vercel will look for build output at the wrong level.

### vite.config.ts — Full Shape

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

No Vitest test config block here — that is added in Story 2.x when unit tests are written. Story 1.4 only needs `turbo typecheck` and `turbo build` to pass.

### tsconfig.app.json — Strict Mode + Path Alias

```json
{
  "extends": "@nihonnohon/typescript-config/react-library.json",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

If `@nihonnohon/typescript-config/react-library.json` does not already set `moduleResolution: "bundler"`, add it explicitly. Both `tsconfig.app.json` and `vite.config.ts` MUST define the `@/*` alias — they are independent resolution contexts.

### Playwright Infrastructure — playwright.config.ts

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### e2e/smoke.spec.ts

```ts
// apps/web/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('app loads with non-empty title', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const title = await page.title()
  expect(title.length).toBeGreaterThan(0)
})
```

The `turbo test:e2e` pipeline task is wired in Story 1.5. In Story 1.4, you can verify this spec runs manually with `pnpm --filter @nihonnohon/web exec playwright test` after `turbo build`.

### File Structure After This Story

```
apps/web/
├── e2e/
│   └── smoke.spec.ts         NEW
├── public/
│   └── (empty dir placeholder)
├── src/
│   ├── lib/
│   │   └── utils.ts          NEW (cn() utility)
│   ├── routes/
│   │   ├── LibraryRoute.tsx  NEW (placeholder)
│   │   └── ReaderRoute.tsx   NEW (placeholder)
│   ├── stores/
│   │   ├── lookupStore.ts    NEW (skeleton)
│   │   └── preferenceStore.ts NEW (skeleton)
│   ├── App.tsx               NEW
│   ├── index.css             NEW
│   ├── main.tsx              NEW
│   └── router.tsx            NEW
├── components.json           NEW (shadcn/ui config)
├── index.html                NEW
├── package.json              UPDATE
├── playwright.config.ts      NEW
├── postcss.config.js         NEW
├── tailwind.config.ts        NEW
├── tsconfig.app.json         NEW
├── tsconfig.json             NEW
└── vite.config.ts            NEW
```

Repo-level changes:
- `vercel.json` — CREATE or UPDATE at repo root
- `.gitignore` — UPDATE at repo root (add tsbuildinfo, coverage/, playwright-report/, test-results/, .eslintcache)

### Deferred Work Resolved in This Story

From `_bmad-output/implementation-artifacts/deferred-work.md`:
- ✅ `apps/web` has no declared `@nihonnohon/schema` workspace dependency — added in Task 1
- ✅ `.gitignore` missing: `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `.eslintcache` — added in Task 9

### Architecture Compliance Guardrails

- **Path alias `@/*`:** Must be defined in BOTH `tsconfig.app.json` AND `vite.config.ts` — they are independent resolution contexts; one alone will cause errors
- **No barrel index.ts files:** Do not create `src/stores/index.ts`, `src/routes/index.ts`, etc. Import source files directly: `import { useLookupStore } from '@/stores/lookupStore'`
- **Styling:** Tailwind utilities only; no inline `style={{}}` except for `--story-font-size` CSS custom property; no custom CSS classes outside `tailwind.config.ts`
- **Store isolation:** `lookupStore` and `preferenceStore` must NEVER import from each other — this is a hard architectural boundary
- **Package imports:** `apps/web` imports compiled `@nihonnohon/*` package outputs only (via `workspace:*` deps that resolve to `dist/`), never `../../packages/schema/src/types`
- **`turbo dev` only:** The supported dev entrypoint is `turbo dev` from repo root, not `pnpm dev` in apps/web directly (packages need to be built first via `dependsOn: ["^build"]`)
- **Ruby toggle:** CSS `visibility: hidden` on `<rt>`, NEVER `display: none` — this rule applies from the first use of ruby in the app; establish it in `index.css` under the `.ruby-hidden rt` class pattern

### Anti-Patterns to Prevent

- Do NOT use `import from '../../packages/schema/src/types'` — use `@nihonnohon/schema`
- Do NOT create barrel `index.ts` files for stores, routes, components, or services
- Do NOT use `useEffect` for data fetching — that comes via React Router loaders from Epic 2 onwards
- Do NOT add Vitest config to `vite.config.ts` in this story — vitest config added when first unit tests are written
- Do NOT create a `src/types.ts` in this story — that file is for app-local types needed in later Epics
- Do NOT create any components beyond route placeholders — all components are built in Epics 2–4
- Do NOT set `display: none` on `<rt>` elements anywhere

### Previous Story Intelligence (Story 1.3)

- AJV was placed in `devDependencies` of story-loader (NOT `dependencies`) so tsup bundles it into `dist/index.js` and `dist/index.mjs` — consumers (apps/web) never encounter AJV directly; this is what AC 2 verifies
- `LoaderError` is defined in `packages/story-loader/src/errors.ts` and re-exported from `index.ts`; import as `import { loadStory, LoaderError } from '@nihonnohon/story-loader'`
- Story 1.3 debug note: `tsc --noEmit` failed with `node:fs`/`__dirname` not resolvable in `moduleResolution: bundler` context — avoid using Node builtins in modules that compile under bundler resolution
- Story 1.3 completion: all packages build successfully; `packages/story-loader/dist/` contains CJS (~250KB) + ESM + d.ts outputs

### Project Structure Notes

- Alignment: `src/stores/` matches `apps/web/src/stores/` from architecture monorepo structure
- Alignment: Route files in `src/routes/` matching architecture's `(LibraryRoute.tsx, ReaderRoute.tsx)` naming
- `src/lib/utils.ts` is standard shadcn/ui infrastructure — not an app module; co-locate with `src/lib/`
- `turbo.json` does NOT need modification in this story — `build-vocab` pipeline task and full pipeline are Story 1.5 scope; the existing `build: dependsOn: ["^build"]` is sufficient for Story 1.4

### References

- Story 1.4 ACs: [Source: _bmad-output/planning-artifacts/epics.md — Story 1.4]
- Epic 1 implementation note (Playwright in 1.4): [Source: _bmad-output/planning-artifacts/epics.md — Epic 1 implementation note]
- Tech stack: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Tech Stack]
- Monorepo structure: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Monorepo Structure]
- State management: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — State Management]
- Design tokens: [Source: _bmad-output/planning-artifacts/architecture-distillate/03-ux-components.md — Colour Tokens]
- Import patterns: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Import Patterns]
- Anti-patterns: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Anti-Patterns]
- Deferred work: [Source: _bmad-output/implementation-artifacts/deferred-work.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `preferenceStore.ts` TS error: `create<PreferenceStoreState>()` + `persist(() => ({...}))` inferred literal types (`true`, `false`, `"medium"`) instead of interface types (`boolean`, `'small'|'medium'|'large'`). Fixed by annotating the initializer return type: `(): PreferenceStoreState => ({...})`.
- `postcss.config.js` Node warning: "Module type not specified." Fixed by adding `"type": "module"` to `apps/web/package.json` — the postcss config uses ES module `export default` syntax which is correct for an ESM project.
- `pnpm install` exit code 1: `ERR_PNPM_IGNORED_BUILDS` for esbuild@0.21.5. Packages installed successfully despite exit code; resolved by running `pnpm rebuild esbuild` to execute esbuild's postinstall script. The `pnpm.onlyBuiltDependencies: ["esbuild"]` is already in root `package.json` — pnpm v11 still requires the rebuild on first install of a new version.
- `typecheck` script uses `tsc -b` (not `tsc --noEmit` as story spec stated): with project references (`tsconfig.json` has `files: []`), `tsc --noEmit` would check nothing. `tsc -b` is the correct command for project-references setup and satisfies AC 7 (`turbo typecheck` exits 0).
- `vite.config.ts` uses `fileURLToPath(new URL('./src', import.meta.url))` instead of `path.resolve(__dirname, './src')` — ESM context in vite.config.ts has no `__dirname`; URL-based approach is cross-platform safe.

### Completion Notes List

- `apps/web/package.json` fully configured: `type: "module"`, all scripts, all deps including `clsx`, `tailwind-merge`, `@types/node`.
- Project references tsconfig structure: `tsconfig.json` (root, files: []) → `tsconfig.app.json` (app src) + `tsconfig.node.json` (config files). `turbo typecheck` runs `tsc -b` and exits 0 across all 6 workspace packages.
- AJV v8 chain verified: `@nihonnohon/story-loader` (with bundled AJV, ~250KB) imported in `src/router.tsx`; `turbo build` completes successfully, producing 327KB JS bundle with no AJV errors.
- All 9 design tokens + `translation` token + `fontFamily.ja` in `tailwind.config.ts`. Noto Sans JP loaded via Google Fonts CDN in `index.html`.
- `lookupStore.ts`: `LookupState` discriminated union, `selectedSentenceId`, stub `lookup`/`selectSentence`/`reset`/`_reset`. Strict store isolation maintained.
- `preferenceStore.ts`: all 6 fields (`rubyVisible`, `spacingVisible`, `transVisible`, `textSize`, `activeTab`) with Zustand `persist`. All fields present so Epic 4 is purely additive.
- `vercel.json` created at repo root with `rootDirectory: "apps/web"` + SPA rewrite.
- Playwright infrastructure: `playwright.config.ts` with 4 projects (chromium, firefox, webkit, iPhone 14); `e2e/smoke.spec.ts` passes (1/1).
- `.gitignore` updated with `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `.eslintcache`.
- `src/index.css`: Tailwind directives + `--story-font-size: 1.25rem` + `ruby` CSS rules + `.ruby-hidden rt { visibility: hidden }` guard established.

### Change Log

- 2026-05-11: Story 1.4 implemented. Created full `apps/web` scaffold: Vite 5 + React 18 + TypeScript 5 + Tailwind 3 + shadcn/ui + React Router v6 + Zustand v4 stores, Playwright infrastructure (smoke test passing), vercel.json, design tokens, `.gitignore` updates.

### File List

- `apps/web/package.json` (UPDATED)
- `apps/web/index.html` (NEW)
- `apps/web/vite.config.ts` (NEW)
- `apps/web/tsconfig.json` (NEW)
- `apps/web/tsconfig.app.json` (NEW)
- `apps/web/tsconfig.node.json` (NEW)
- `apps/web/tailwind.config.ts` (NEW)
- `apps/web/postcss.config.js` (NEW)
- `apps/web/components.json` (NEW)
- `apps/web/playwright.config.ts` (NEW)
- `apps/web/src/main.tsx` (NEW)
- `apps/web/src/App.tsx` (NEW)
- `apps/web/src/router.tsx` (NEW)
- `apps/web/src/index.css` (NEW)
- `apps/web/src/lib/utils.ts` (NEW)
- `apps/web/src/stores/lookupStore.ts` (NEW)
- `apps/web/src/stores/preferenceStore.ts` (NEW)
- `apps/web/src/routes/LibraryRoute.tsx` (NEW)
- `apps/web/src/routes/ReaderRoute.tsx` (NEW)
- `apps/web/e2e/smoke.spec.ts` (NEW)
- `vercel.json` (NEW)
- `.gitignore` (UPDATED)
- `pnpm-lock.yaml` (UPDATED)
