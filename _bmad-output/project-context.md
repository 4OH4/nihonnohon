---
project_name: 'nihonnohon'
user_name: 'RT'
date: '2026-05-12'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Monorepo**
- Package manager: pnpm (workspaces)
- Build orchestration: Turborepo 2.9.12

**Frontend app** (`apps/web`)
- React 18.3.1
- Vite 5.3.0
- TypeScript 5.5.0 (strict mode, bundler moduleResolution, ES2022 target)
- react-router-dom 6.24.0
- Zustand 4.5.4
- Tailwind CSS 3.4.0
- shadcn/ui (default style, no CSS variables)
- clsx 2.1.0 + tailwind-merge 2.3.0 (via `cn()` utility)

**Internal packages**
- `@nihonnohon/schema` — TypeScript types + JSON Schema for story format
- `@nihonnohon/story-loader` — versioned story loader; AJV 8.17.1 for validation
- `@nihonnohon/typescript-config` — shared tsconfig base
- `@nihonnohon/eslint-config` — shared ESLint config

**Package build:** tsup 8.5.1 (dual CJS+ESM output per package)

**Testing**
- Vitest 3.0.0 (unit tests, jsdom environment)
- Playwright 1.44.0 (E2E tests)

**TypeScript installed version:** 5.9.3 (pnpm lock)

## Language-Specific Rules

### TypeScript

- `strict: true` everywhere — no implicit any, no loose nulls
- `moduleResolution: "bundler"` — do not use `"node"` or `"node16"`
- All source uses ESM (`"type": "module"` in web app)
- Wire format (story JSON) is **snake_case**; internal TypeScript model is **camelCase** — transformation happens exclusively inside the loader, nowhere else
- Wire → model interfaces are defined in `v1.ts` as `Wire*` types; never leak them outside the loader
- `SentenceModel.grammar` is `number[]` (indices into `StoryModel.grammar`); `StoryModel.grammar` is `string[]` — do not mix up
- `KanjiEntry.kw` is the short Heisig keyword (label in UI); `KanjiEntry.m` is the full meanings array (shown in detail view) — do not treat them as interchangeable

### Imports

- Internal monorepo packages: `@nihonnohon/<name>` (workspace references, always available)
- Path alias `@/` maps to `apps/web/src/` — use it for all intra-app imports
- Utility function for class merging: `import { cn } from '@/lib/utils'`
- Do not use relative `../../` paths when `@/` or `@nihonnohon/*` applies

## Framework-Specific Rules

### React & Routing

- Routes live in `apps/web/src/routes/` as named exports (PascalCase, e.g. `ReaderRoute`)
- Router is `createBrowserRouter` from react-router-dom 6; route params accessed via `useParams()`
- Story reader route: `/read/:storyId`; library route: `/`
- Components are `.tsx` files, PascalCase filenames matching the export name

### State Management (Zustand)

- Stores live in `apps/web/src/stores/`, camelCase + `Store` suffix (e.g. `lookupStore.ts`)
- Always export the hook directly: `export const useXxxStore = create<...>()(...)` — no default exports
- Preference store uses `persist` middleware; persisted under localStorage key `nihonnohon-preferences`
- `LookupState` is a discriminated union — always switch on `.status` (`'idle' | 'found' | 'not-found'`), never access `.entry` without checking status first
- Include `_reset` alongside `reset` in stores that need test teardown

### Styling (Tailwind + shadcn/ui)

- Custom design tokens (must use these, not arbitrary colours): `paper-bg`, `paper-text`, `surface`, `surface-subtle`, `accent`, `accent-subtle`, `muted`, `border`, `error`, `translation`
- Japanese text: always apply `font-ja` class (Noto Sans JP)
- shadcn/ui uses **no CSS variables** (`cssVariables: false`) — do not add `var(--*)` colour refs
- UI primitives go in `apps/web/src/components/ui/`; feature components in `apps/web/src/components/`
- Always compose classes with `cn()` — never raw string concatenation

### Data Loading

- `vocab.json` and `kanji-data.json` are served from `apps/web/public/` — fetch at runtime, do not import them as modules
- Vocabulary is an array loaded into a `Map<number, VocabEntry>` keyed by `VocabEntry.id`
- Kanji data is a JSON object keyed by the literal kanji character (e.g. `{"食": {...}}`)
- Both are O(1) lookups; no async after initial load

## Testing Rules

### Unit Tests (Vitest)

- Unit test files live in `apps/web/src/__tests__/` (app) or alongside source in packages
- Test files named `*.test.ts` or `*.test.tsx`
- Vitest globals are enabled (`globals: true`) — no need to import `describe`/`it`/`expect`
- Default test environment: `jsdom` (set in `vite.config.ts`)
- For tests that must run in Node (e.g. file system reads): add `// @vitest-environment node` as the first line of the file
- Package unit tests run via `pnpm test:unit` inside the package; app unit tests via `pnpm test:unit` in `apps/web`

### E2E Tests (Playwright)

- E2E tests live in `apps/web/e2e/`, file pattern `*.spec.ts`
- Run via `pnpm test:e2e` in `apps/web`
- Do not put E2E tests in `src/__tests__/` — Vitest excludes the `e2e/` folder explicitly

### What to test

- Test loader logic (schema validation, parallel array checks, wire→model transform) in `@nihonnohon/story-loader`
- Test data integrity (vocab.json shape, id sequence) with Vitest unit tests
- Do not unit-test pure Tailwind layout — use Playwright for UI behaviour

## Code Quality & Style Rules

### Naming Conventions

- Components: PascalCase `.tsx` files, named export matching filename (e.g. `ReaderRoute.tsx` → `export function ReaderRoute`)
- Stores: camelCase + `Store` suffix, file and export match (e.g. `lookupStore.ts` → `useLookupStore`)
- Hooks: `use` prefix, camelCase
- Utilities: camelCase, no class wrappers (plain functions)
- Test files: `*.test.ts` / `*.test.tsx`; E2E: `*.spec.ts`

### File Organization (`apps/web/src/`)

```
src/
  routes/       # Route-level components (one per route)
  components/   # Feature components
    ui/         # shadcn/ui primitives
  stores/       # Zustand stores
  hooks/        # Custom React hooks
  lib/          # Utilities (cn, etc.)
  __tests__/    # Vitest unit tests
```

### ESLint

- Config: `@nihonnohon/eslint-config/react` (shared)
- `@typescript-eslint/no-unused-vars`: warn; args prefixed `_` are ignored
- Never suppress with `// eslint-disable` unless adding an explanatory comment

### Comments

- Write succinct JSDoc/TSDoc docstrings for all exported functions and components
- Add inline comments to label major functional blocks within a function body
- Do not narrate obvious code — comments explain structure and intent, not mechanics

## Development Workflow Rules

### Commands

- `pnpm build` — full monorepo build (Turbo, packages before app)
- `pnpm typecheck` — type-check all packages and app
- `pnpm test:unit` — run Vitest unit tests (run inside a specific package or `apps/web`)
- `pnpm test:e2e` — run Playwright E2E tests (run from `apps/web`)
- `pnpm dev` — start Vite dev server (run from `apps/web`)
- Build packages before running app dev server if package source changed

### Monorepo Rules

- All new internal packages follow the `@nihonnohon/<name>` naming convention
- Packages export dual CJS+ESM via tsup; always define both `import` and `require` conditions in `exports` field
- New packages must add `typecheck` and `build` scripts to participate in Turbo pipeline
- The `apps/api` package is a placeholder — do not implement anything there in v1

### Story Format

- `schema_version` is an integer-as-string (`"1"`, `"2"`) — never a plain integer or semver
- Adding a new schema version requires a new loader module (`v2.ts`) registered in the `LOADERS` registry in `index.ts` — never add version logic with if/else chains
- The `vocab.json` CSV-derived file is append-only; row `id` values are permanent and must never be reordered or reused

## Critical Don't-Miss Rules

### Anti-Patterns

- **Never put schema-version logic outside the loader layer.** `StoryModel` is version-agnostic; all wire-format knowledge lives in `packages/story-loader/src/v*.ts`
- **Never access `VocabEntry` by string lookup.** Vocabulary is keyed by numeric `id`; the `vocab_keys` array in `SentenceModel` contains `number | null`, not strings
- **Never assume parallel arrays are equal length in components.** Always trust the loader (which throws on mismatch) — do not re-validate in UI code
- **Never import `vocab.json` or `kanji-data.json` as ES modules.** They are served from `public/` and must be fetched at runtime
- **Never use arbitrary Tailwind colours.** Only the custom tokens defined in `tailwind.config.ts` are on-brand
- **Never add offline/PWA support in v1.** The app requires an internet connection; offline is explicitly deferred

### Edge Cases

- A kanji character absent from `kanji-data.json` is valid — degrade gracefully (omit the kanji breakdown section for that character, do not throw)
- A `vocab_key` of `null` means the token has no vocabulary entry (e.g. punctuation) — this is expected, not an error
- `SentenceModel.translation` can be `null` — components must handle the no-translation case
- `ruby` array entries can be `null` for tokens with no reading annotation

---

## Usage Guidelines

**For AI Agents:** Read this file before implementing any code. Follow all rules exactly as documented. When in doubt, prefer the more restrictive option.

**For Humans:** Keep this file lean and focused on agent needs. Update when the technology stack changes or new non-obvious patterns emerge.

_Last updated: 2026-05-12_
