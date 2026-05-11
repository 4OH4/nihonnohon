# Story 1.5: Monorepo Pipeline, CI & Project Scaffolding

Status: done

## Story

As a **developer or external contributor**,
I want the full Turborepo pipeline, GitHub Actions CI, and project documentation in place,
so that every PR is automatically verified and the project is ready for open-source contribution from day one.

## Acceptance Criteria

1. **Given** `turbo.json` at repo root **When** reviewed **Then** defines all required tasks: `build-vocab` (inputs: build-vocab.ts + genki-vocab.csv, outputs: apps/web/public/vocab.json, cache: true); `build` (dependsOn: ^build, build-vocab); `dev` (dependsOn: ^build, build-vocab, persistent: true, cache: false); `typecheck` (dependsOn: ^build); `test:unit` (dependsOn: ^build, build-vocab); `test:e2e` (dependsOn: build, cache: false); `lint` (no dependsOn)

2. **Given** `scripts/build-vocab.ts` runs with `scripts/data/genki-vocab.csv` present **When** `turbo build-vocab` executes **Then** generates `apps/web/public/vocab.json` as a sorted, deterministic JSON array of `VocabEntry` objects; every entry has `id: number`, `word: string`, `reading: string`, `meaning: string`, `lesson: string`; `vocab.json` is listed in `.gitignore`; a unit test validates a sample output matches the `VocabEntry` shape

3. **Given** `.github/workflows/ci.yml` **When** a PR is submitted **Then** pipeline runs in order: `pnpm install` → `turbo lint` → `turbo typecheck` → `turbo test:unit` → `turbo test:e2e` → `turbo build`; all steps must pass; `test:unit` and `test:e2e` are separate pipeline tasks (no Vite/Playwright port collision)

4. **Given** Playwright is configured in `apps/web/playwright.config.ts` **When** `turbo test:e2e` runs **Then** config includes `baseURL`, `webServer` config, `testDir: 'e2e/'`, and `devices` including `'iPhone 14'`; `e2e/smoke.spec.ts` passes — it asserts the app loads at `/` with HTTP 200 and the page `<title>` is non-empty; CI runs this smoke test on every PR *(Playwright config and smoke.spec.ts already created in Story 1.4 — this AC verifies turbo wires them into CI)*

5. **Given** `apps/story-generator/README.md` **When** reviewed **Then** documents: purpose (AI story authoring tool, separate project, out of nihonnohon scope), contract (consumes `story.v1.json` + `genki-vocab.csv`, produces valid schema version `"1"` JSON), and validation instructions; `apps/story-generator/src/story_generator/validator.py` exists as a documented stub

6. **Given** `docs/adr/` directory **When** reviewed **Then** contains three ADRs with consistent structure (title, status: Accepted, context, decision, consequences): `001-monorepo-turborepo.md`, `002-json-schema-over-zod.md`, `003-story-generator-out-of-scope.md`

7. **Given** `CONTRIBUTING.md` at repo root **When** reviewed **Then** covers: first-time setup (`pnpm install`), dev workflow (`turbo dev`), test commands, package conventions ("Where does code go?" table from architecture), and the schema version bump contract

8. **Given** `pnpm install && turbo build` from repo root **When** complete **Then** exits 0; `turbo test:unit` exits 0; CI smoke test passes on a clean checkout

## Tasks / Subtasks

- [x] Task 1: Update `turbo.json` — complete pipeline definition (AC: 1)
  - [x] Add `build-vocab` task with inputs, outputs, cache: true
  - [x] Update `build` task: dependsOn `["^build", "build-vocab"]`, outputs `["dist/**"]`
  - [x] Update `dev` task: dependsOn `["^build", "build-vocab"]`, persistent: true, cache: false
  - [x] Keep `typecheck` task: dependsOn `["^build"]` (already correct)
  - [x] Add `test:unit` task: dependsOn `["^build", "build-vocab"]`
  - [x] Add `test:e2e` task: dependsOn `["build"]`, cache: false
  - [x] Keep `lint` task: no dependsOn (already correct)

- [x] Task 2: Create `scripts/` infrastructure (AC: 2)
  - [x] Copy `resources/genki1vocab.csv` to `scripts/data/genki-vocab.csv` (exact copy — do not transform)
  - [x] Add `tsx` to root `package.json` devDependencies: `"tsx": "^4.0.0"`
  - [x] Add `"build-vocab": "tsx scripts/build-vocab.ts"` to root `package.json` scripts
  - [x] Add `"test:unit": "turbo test:unit"` and `"test:e2e": "turbo test:e2e"` to root `package.json` scripts
  - [x] Create `scripts/build-vocab.ts` per Dev Notes — exact VocabEntry shape, deterministic output, sorted by id
  - [x] Run `pnpm install` to install tsx

- [x] Task 3: Wire Vitest into apps/web and create build-vocab unit test (AC: 2, 8)
  - [x] Add `"test:unit": "vitest run"` to `apps/web/package.json` scripts
  - [x] Add `"vitest": "^3.0.0"`, `"@vitest/coverage-v8": "^3.0.0"`, `"jsdom": "^25.0.0"` to apps/web devDependencies
  - [x] Update `apps/web/vite.config.ts` — add `test` block with jsdom environment, globals: true, exclude e2e/
  - [x] Create `apps/web/src/__tests__/buildVocab.test.ts` per Dev Notes — validates VocabEntry shape using generated vocab.json; uses `// @vitest-environment node` directive
  - [x] Run `pnpm install` to install vitest/jsdom

- [x] Task 4: Wire ESLint for apps/web — resolves deferred-work from Story 1.4 (AC: 3, 8)
  - [x] Update `packages/eslint-config/package.json` — added `eslint-plugin-boundaries ^5.0.0`, `eslint-plugin-react ^7.37.0`, `eslint-plugin-react-hooks ^4.6.2` as dependencies; peerDependencies added
  - [x] Update `packages/eslint-config/index.js` — added eslint-plugin-boundaries with import boundary rules
  - [x] Update `packages/eslint-config/react.js` — React + TypeScript rules that apps/web extends
  - [x] Create `apps/web/.eslintrc.cjs` — extends `@nihonnohon/eslint-config/react`
  - [x] Add `"@typescript-eslint/eslint-plugin": "^7.0.0"` and `"@typescript-eslint/parser": "^7.0.0"` to apps/web devDependencies
  - [x] Run `pnpm install`; `turbo lint` exits 0

- [x] Task 5: Create GitHub Actions CI pipeline (AC: 3)
  - [x] Create `.github/` directory at repo root
  - [x] Create `.github/workflows/ci.yml` with exact pipeline order and Playwright browser install step

- [x] Task 6: Create `apps/story-generator/` placeholder (AC: 5)
  - [x] Create `apps/story-generator/README.md`
  - [x] Create `apps/story-generator/src/story_generator/__init__.py` (empty)
  - [x] Create `apps/story-generator/src/story_generator/validator.py` — documented stub
  - [x] Create `apps/story-generator/requirements.txt` with `jsonschema>=4.0.0`
  - [x] Verified `apps/story-generator` is NOT in `pnpm-workspace.yaml`

- [x] Task 7: Create ADRs (AC: 6)
  - [x] Create `docs/adr/` directory
  - [x] Create `docs/adr/001-monorepo-turborepo.md`
  - [x] Create `docs/adr/002-json-schema-over-zod.md`
  - [x] Create `docs/adr/003-story-generator-out-of-scope.md`

- [x] Task 8: Create `CONTRIBUTING.md` at repo root (AC: 7)
  - [x] Created `CONTRIBUTING.md` with all required sections

- [x] Task 9: Final verification (AC: 8)
  - [x] `pnpm install` from repo root — exits 0
  - [x] `pnpm run build-vocab` — generates `apps/web/public/vocab.json` (1172 entries)
  - [x] `pnpm --filter @nihonnohon/web build` — exits 0; dist/ produced
  - [x] `pnpm --filter @nihonnohon/web lint` — exits 0 (no ESLint errors)
  - [x] `pnpm --filter @nihonnohon/web typecheck` — exits 0
  - [x] `pnpm --filter @nihonnohon/story-loader test:unit` — 14/14 pass
  - [x] `pnpm --filter @nihonnohon/web test:unit` — 5/5 pass (buildVocab.test.ts)
  - [x] Playwright smoke test (chromium) — 1/1 pass

### Review Findings (Senior Developer Review — 2026-05-12)

**Outcome:** Changes Requested — 5 patches, 5 defers.

#### Patches

- [x] [Review][Patch] Fix CSV parser: replace naive split(',') with RFC 4180 quote-aware parseCSVLine() [scripts/build-vocab.ts] — 19 entries had commas in their meaning fields (e.g. "to stay (at a hotel, etc.)"); naive split corrupted lesson numbers to "Genki I Intro" for all affected rows; now correctly parsed
- [x] [Review][Patch] Add console.warn when lesson number parses as NaN [scripts/build-vocab.ts] — silent `isNaN → 0` masks malformed CSV rows; warning makes corruption visible during build
- [x] [Review][Patch] Validate each CSV line produces exactly 4 parts; warn if not [scripts/build-vocab.ts] — surfaces future comma-in-field issues immediately
- [x] [Review][Patch] Strengthen sequential-ID assertion to validate all intermediate IDs [apps/web/src/__tests__/buildVocab.test.ts] — replaced trivial `ids[last] === length` with `ids.every((id, i) => id === i + 1)`
- [x] [Review][Patch] Pin pnpm to exact version 11.0.9 in CI workflow [.github/workflows/ci.yml] — matches `packageManager` field in package.json
- [x] [Review][Patch] Remove `node: false` from react.js ESLint env [packages/eslint-config/react.js] — ESLint env flags cannot be unset by child configs; was a misleading no-op

#### Defers

- [x] [Review][Defer] eslint-plugin-boundaries path patterns may not match when linting from workspace directory — without `basePath` set to repo root, boundary rules may silently never fire; investigate in a follow-up
- [x] [Review][Defer] build-vocab.ts uses process.cwd() instead of import.meta.url — intentional design choice for turbo root task; low risk in practice but fragile if run outside turbo
- [x] [Review][Defer] Header row safety: no skip logic if CSV ever gains a header row — headerless format is intentional; add guard if format changes
- [x] [Review][Defer] buildVocab.test.ts reads vocab.json at module scope (opaque ENOENT if file missing) — acceptable within turbo pipeline; low priority given turbo enforces dependency ordering
- [x] [Review][Defer] @typescript-eslint v7 with TypeScript 5.5 — resolved v7.18.0 supports 5.5; monitor if upgrading TypeScript past 5.5 triggers issues

## Dev Notes

### Current Repo State

```
nihonnohon/                        ← root
├── turbo.json                     UPDATE (missing build-vocab, test:unit, test:e2e tasks)
├── package.json                   UPDATE (add build-vocab script, tsx dep, test:unit/test:e2e scripts)
├── resources/
│   └── genki1vocab.csv            EXISTS ← source data; COPY to scripts/data/genki-vocab.csv
├── apps/
│   ├── web/                       UPDATE (add vitest, .eslintrc.cjs, test:unit script)
│   └── story-generator/           MISSING ← create
├── docs/                          EMPTY ← create adr/ inside
├── packages/
│   └── eslint-config/             UPDATE (add boundaries plugin, react config)
└── scripts/                       MISSING ← create with build-vocab.ts + data/
```

**Deferred work from Story 1.4 resolved here:**
- No ESLint config in apps/web (`turbo lint` fails) — fixed in Task 4

### turbo.json — Exact Specification

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build-vocab": {
      "inputs": ["scripts/build-vocab.ts", "scripts/data/genki-vocab.csv"],
      "outputs": ["apps/web/public/vocab.json"],
      "cache": true
    },
    "build": {
      "dependsOn": ["^build", "build-vocab"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build", "build-vocab"],
      "persistent": true,
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test:unit": {
      "dependsOn": ["^build", "build-vocab"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {}
  }
}
```

**Why `build-vocab` appears in `build`, `dev`, and `test:unit` but NOT `typecheck` or `lint`:**
- `build` needs vocab.json (AJV chain verification from Story 1.4)
- `dev` needs vocab.json before hot-reload starts (vocabService fetches on startup)
- `test:unit` needs vocab.json (buildVocab.test.ts reads it)
- `typecheck` and `lint` are static analysis — no runtime data needed

**CRITICAL:** `test:unit` and `test:e2e` are SEPARATE tasks to prevent Playwright's `webServer` from binding the same port (5173) as Vite's test environment. Running them sequentially via two turbo commands in CI avoids this.

### Root package.json — Updates Required

Add these scripts and devDependencies:

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test:unit": "turbo test:unit",
    "test:e2e": "turbo test:e2e",
    "build-vocab": "tsx scripts/build-vocab.ts"
  },
  "devDependencies": {
    "turbo": "^2.9.12",
    "tsx": "^4.0.0"
  }
}
```

`tsx` is the TypeScript executor used to run `scripts/build-vocab.ts` directly without a separate compile step. It uses esbuild internally and is faster than ts-node.

### scripts/data/genki-vocab.csv — Format

**Source:** `resources/genki1vocab.csv` — copy verbatim, no transformation.

**Format:** 4 columns, comma-separated, no header row, UTF-8 encoding:
```
reading,kanji,meaning,lesson_num
```
Examples:
```
おはよう,お早う,Good morning,0
がくせい,学生,student,1
なん／なに,何,what,1
〜ねんせい,〜年生,...year student,1
```

**Notes on data quirks:**
- Multiple alternate readings may be separated by `;` or `/` — take only the first part for both `reading` and `word`
- Kanji column may be empty — use reading as word in that case
- `〜` prefix/suffix in reading/kanji indicates a grammatical particle/suffix — preserve as-is (do NOT strip)
- Lesson 0 = preliminary greetings chapter; lessons 1–12 = Genki I; lessons 13–23 = Genki II
- The file has 1,172 rows (line count from resources/genki1vocab.csv)

### scripts/build-vocab.ts — Complete Implementation

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface VocabEntry {
  id: number
  word: string
  reading: string
  meaning: string
  lesson: string
}

function formatLesson(lessonNum: number): string {
  if (lessonNum === 0) return 'Genki I Intro'
  if (lessonNum <= 12) return `Genki I Ch.${lessonNum}`
  return `Genki II Ch.${lessonNum}`
}

function firstPart(value: string): string {
  return value.split(/[;/]/)[0].trim()
}

const csvPath = resolve(__dirname, 'data/genki-vocab.csv')
const outPath = resolve(__dirname, '../apps/web/public/vocab.json')

const csv = readFileSync(csvPath, 'utf-8')
const lines = csv.split('\n').filter(line => line.trim().length > 0)

const entries: VocabEntry[] = lines.map((line, index) => {
  const parts = line.split(',')
  const rawReading = parts[0]?.trim() ?? ''
  const rawKanji = parts[1]?.trim() ?? ''
  const meaning = parts[2]?.trim() ?? ''
  const lessonNum = parseInt(parts[3]?.trim() ?? '0', 10)

  const reading = firstPart(rawReading)
  const word = rawKanji.length > 0 ? firstPart(rawKanji) : reading

  return {
    id: index + 1,
    word,
    reading,
    meaning,
    lesson: formatLesson(isNaN(lessonNum) ? 0 : lessonNum),
  }
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(entries, null, 2))
console.log(`build-vocab: wrote ${entries.length} entries to ${outPath}`)
```

**Key decisions:**
- `id = index + 1` (1-based) is stable because CSV is append-only
- `firstPart()` handles both `;` and `/` separators for alternate readings
- No sorting by id needed — CSV order IS the stable row order
- `mkdirSync({ recursive: true })` ensures `apps/web/public/` exists before writing
- Output is pretty-printed (`JSON.stringify(entries, null, 2)`) for readability in diffs

### apps/web/vite.config.ts — Add Vitest Config

Add a `test` block to the existing config. The file currently exports:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Update to:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

**Why jsdom as default:** Component tests in Stories 2–4 need DOM APIs. Per-test overrides (like `// @vitest-environment node`) work for file-based tests.

### apps/web/src/__tests__/buildVocab.test.ts

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vocabPath = resolve(__dirname, '../../../public/vocab.json')
const entries = JSON.parse(readFileSync(vocabPath, 'utf-8')) as unknown[]

describe('vocab.json (build-vocab output)', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('every entry has the VocabEntry shape', () => {
    for (const entry of entries as Record<string, unknown>[]) {
      expect(typeof entry.id).toBe('number')
      expect(typeof entry.word).toBe('string')
      expect(typeof entry.reading).toBe('string')
      expect(typeof entry.meaning).toBe('string')
      expect(typeof entry.lesson).toBe('string')
    }
  })

  it('ids are sequential starting at 1', () => {
    const ids = (entries as { id: number }[]).map(e => e.id)
    expect(ids[0]).toBe(1)
    expect(ids[ids.length - 1]).toBe(entries.length)
  })

  it('contains a known Genki I Ch.1 vocabulary entry', () => {
    const student = (entries as { word: string; reading: string; meaning: string; lesson: string }[])
      .find(e => e.reading === 'がくせい')
    expect(student).toBeDefined()
    expect(student!.word).toBe('学生')
    expect(student!.meaning).toContain('student')
    expect(student!.lesson).toBe('Genki I Ch.1')
  })

  it('lesson field uses correct prefix (Genki I / Genki II)', () => {
    const lessons = new Set((entries as { lesson: string }[]).map(e => e.lesson))
    expect(lessons.has('Genki I Intro') || [...lessons].some(l => l.startsWith('Genki I Ch.'))).toBe(true)
  })
})
```

**CRITICAL:** The `// @vitest-environment node` directive overrides the jsdom default for this test file because it uses `fs.readFileSync`. Without it, vitest in jsdom mode will fail on `readFileSync`.

**This test depends on `build-vocab` having run** (turbo handles ordering via `test:unit: dependsOn: ['build-vocab']`). If running manually, run `turbo build-vocab` first.

### ESLint Configuration

**packages/eslint-config/package.json** — update dependencies:
```json
{
  "name": "@nihonnohon/eslint-config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "main": "index.js",
  "peerDependencies": {
    "eslint": ">=8.0.0"
  },
  "dependencies": {
    "eslint-plugin-boundaries": "^5.0.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^4.6.2"
  }
}
```

**packages/eslint-config/index.js** — update base config with boundaries:
```js
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['eslint:recommended'],
  plugins: ['boundaries'],
  env: { node: true, es2022: true },
  settings: {
    'boundaries/elements': [
      { type: 'package', pattern: 'packages/*', mode: 'folder' },
      { type: 'app', pattern: 'apps/*', mode: 'folder' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['package'] },
          { from: 'package', allow: [] },
        ],
      },
    ],
  },
}
```

**packages/eslint-config/react.js** — new React config for apps/web:
```js
/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    './index.js',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: { browser: true, es2022: true, node: false },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
}
```

**apps/web/.eslintrc.cjs** — the missing config file (resolves deferred-work):
```js
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@nihonnohon/eslint-config/react'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'],
}
```

**apps/web devDependencies to add:**
```json
"@typescript-eslint/eslint-plugin": "^7.0.0",
"@typescript-eslint/parser": "^7.0.0"
```

**IMPORTANT:** `apps/web/.eslintrc.cjs` uses `.cjs` extension because `apps/web/package.json` has `"type": "module"`. ESLint 8 looks for `.cjs` extension when the package is ESM-type.

### .github/workflows/ci.yml — Complete Pipeline

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: turbo lint

      - name: Type check
        run: turbo typecheck

      - name: Unit tests
        run: turbo test:unit

      - name: Install Playwright browsers
        run: pnpm --filter @nihonnohon/web exec playwright install --with-deps chromium firefox webkit

      - name: E2E tests
        run: turbo test:e2e

      - name: Build
        run: turbo build
```

**Why Playwright install is between test:unit and test:e2e:**
- `turbo test:unit` does not need browsers — keeps unit test step fast
- Playwright browser install is separate from `pnpm install` (browsers are binary downloads, not npm packages)
- `--with-deps` installs OS-level browser dependencies (required on Ubuntu CI)
- Only Chromium, Firefox, and WebKit needed (matches playwright.config.ts projects)

**CRITICAL: `--frozen-lockfile` in CI** prevents `pnpm install` from updating `pnpm-lock.yaml`. If lock file is out of sync, CI fails fast — forcing the developer to commit the correct lock file.

### apps/story-generator Placeholder

**Directory structure:**
```
apps/story-generator/
├── README.md
├── requirements.txt
└── src/
    └── story_generator/
        ├── __init__.py
        └── validator.py
```

**README.md content:**
```markdown
# story-generator

AI-powered story authoring tool for nihonnohon. This is a separate project,
developed independently from the nihonnohon web app.

## Purpose

Generates valid nihonnohon story JSON files using a commercial LLM API (e.g. Gemini).
The generated stories conform to the story format specification and can be loaded
directly by the nihonnohon app.

## Contract

**Consumes:**
- `packages/schema/schemas/story.v1.json` — JSON Schema defining the story format contract
- `scripts/data/genki-vocab.csv` — Genki vocabulary reference for word selection

**Produces:**
- Valid story JSON conforming to `schema_version: "1"`
- All three parallel arrays (`words`, `ruby`, `vocab_keys`) populated with equal lengths per sentence

## Validation

Use `validator.py` to validate a generated story before use:

```bash
python src/story_generator/validator.py path/to/story.json
```

Requires Python 3.11+ and `pip install -r requirements.txt`.

## Status

Out of scope for the nihonnohon development sprint. This directory is a placeholder
establishing the project boundary and interface contract.

See ADR `docs/adr/003-story-generator-out-of-scope.md` for the rationale.
```

**validator.py stub:**
```python
"""
Story validator stub for nihonnohon story format.

Validates a story JSON file against the story.v1.json schema.
Out of scope for v1 sprint — stub documents the intended interface.
"""
import json
import sys
from pathlib import Path
import jsonschema


SCHEMA_PATH = Path(__file__).parents[4] / "packages" / "schema" / "schemas" / "story.v1.json"


def validate_story(story_path: str) -> bool:
    """Validate a story JSON file against story.v1.json schema."""
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)
    with open(story_path) as f:
        story = json.load(f)
    try:
        jsonschema.validate(instance=story, schema=schema)
        print(f"✓ {story_path} is valid")
        return True
    except jsonschema.ValidationError as e:
        print(f"✗ {story_path}: {e.message}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python validator.py <story.json>")
        sys.exit(1)
    success = validate_story(sys.argv[1])
    sys.exit(0 if success else 1)
```

**requirements.txt:**
```
jsonschema>=4.0.0
```

### ADR Templates

All three ADRs share this structure:

```markdown
# ADR NNN: Title

**Status:** Accepted
**Date:** 2026-05-11

## Context

[Why was this decision needed?]

## Decision

[What was decided?]

## Consequences

[What are the trade-offs and implications?]
```

**001-monorepo-turborepo.md:**
- **Context:** Project has multiple TypeScript packages with cross-dependencies. Need shared types, shared loader logic, and a web app that consumes both. Options: separate repos, a single package, or a monorepo.
- **Decision:** Turborepo + pnpm workspaces. Packages `@nihonnohon/schema` and `@nihonnohon/story-loader` are built independently and consumed by `apps/web` via workspace linking.
- **Consequences:** Task caching (`turbo build` is fast on unchanged packages); enforced package boundaries (`eslint-plugin-boundaries`); `pnpm` required (not npm or yarn); `turbo dev` from repo root is the only supported dev entrypoint (not `pnpm dev` in apps/web directly). Nx was rejected (enterprise overhead). pnpm-only was rejected (no task caching).

**002-json-schema-over-zod.md:**
- **Context:** Story format must be validated in both the nihonnohon loader (TypeScript) and the story-generator (Python). A runtime validation library must be accessible from both environments.
- **Decision:** `story.v1.json` (JSON Schema Draft-07) as the single source of truth. AJV v8 for TypeScript validation; `jsonschema` for Python validation.
- **Consequences:** `story.v1.json` is the canonical contract — changes require updating both tools. Zod was rejected because it is TypeScript-only and cannot be consumed by the Python story-generator. JSON Schema is language-agnostic. `additionalProperties: false` at every node prevents silent field drift.

**003-story-generator-out-of-scope.md:**
- **Context:** nihonnohon requires real Japanese story content to ship. A story-generator tool using LLM APIs was discussed as part of the project. Including it in the same codebase would add Python tooling, LLM API costs, and significant scope to the sprint.
- **Decision:** The story-generator is a separate project. `apps/story-generator/` is a placeholder that documents the contract. It is excluded from the pnpm workspace (Python, not Node.js).
- **Consequences:** nihonnohon ships with a hand-crafted story fixture for v1 development. The story-generator can be developed independently using `story.v1.json` as its contract. Adding `apps/story-generator` to `pnpm-workspace.yaml` would be incorrect — it must remain excluded.

### CONTRIBUTING.md — Required Sections

```markdown
# Contributing to Nihon no Hon

## First-time setup

1. Install [pnpm](https://pnpm.io/) (required — npm and yarn are not supported)
2. Clone the repo and install dependencies:
   ```bash
   pnpm install
   ```
3. Build all packages:
   ```bash
   turbo build
   ```

## Development

Start the development server from the repo root:
```bash
turbo dev
```
The app is available at `http://localhost:5173`.

**Important:** Always use `turbo dev` from the repo root, not `pnpm dev` from inside `apps/web`.
The Turborepo pipeline ensures packages are built before the dev server starts.

## Testing

```bash
turbo test:unit     # run Vitest unit tests across all packages
turbo test:e2e      # run Playwright e2e tests (requires the app to build first)
turbo lint          # run ESLint across all packages
turbo typecheck     # run TypeScript type checking across all packages
```

## Where does code go?

| Code type | Location |
|-----------|----------|
| Shared TypeScript types | `packages/schema/src/types.ts` |
| Story JSON schema | `packages/schema/schemas/story.v1.json` |
| Story loading & validation | `packages/story-loader/src/` |
| React components | `apps/web/src/components/` |
| Route-level components | `apps/web/src/routes/` |
| Zustand stores | `apps/web/src/stores/` |
| Data services (vocab, kanji) | `apps/web/src/services/` |
| Pure utilities (no side effects) | `apps/web/src/utils/` |
| App-local TypeScript types | `apps/web/src/types.ts` |
| ADRs and project docs | `docs/` |

## Package conventions

- No barrel `index.ts` re-export files — import source files directly
- `apps/web` imports compiled `@nihonnohon/*` package outputs only — never `../../packages/*/src/`
- `packages/` packages never import from `apps/` (enforced by `eslint-plugin-boundaries`)
- Tailwind utilities only — no custom CSS classes except design token definitions in `tailwind.config.ts`

## Adding a story

To add a story to the built-in library:
1. Place the story JSON in `apps/web/public/stories/`
2. Add an entry to `apps/web/public/stories/manifest.json`
3. No code changes required

Story JSON must conform to `packages/schema/schemas/story.v1.json`. Run the validator to check:
```bash
python apps/story-generator/src/story_generator/validator.py path/to/story.json
```

## Schema version bump contract

Breaking changes to `story.v1.json` require:
1. Increment `schema_version` (e.g. `"1"` → `"2"`)
2. Add a new loader in `packages/story-loader/src/v2.ts`
3. Register it in `packages/story-loader/src/index.ts`
4. Update `SCHEMA_CHANGELOG.md` in `packages/schema/`
5. Coordinate with the story-generator project to update its validation

Non-breaking additions (new optional fields) do NOT require a version bump — `additionalProperties: false` must not be violated.
```

### Architecture Compliance Guardrails

- **`build-vocab` is a ROOT-LEVEL turbo task** — only the root `package.json` should have the `build-vocab` script; do NOT add it to `apps/web/package.json` or any `packages/*`
- **`scripts/build-vocab.ts` uses ESM** (`import`/`export`, `fileURLToPath`) because the root `package.json` does NOT have `"type": "module"` — wait, the root does NOT have `"type": "module"`. This means `.ts` files run via `tsx` behave as CommonJS unless they use `.mts` extension. To be safe, use CommonJS-compatible imports in the build script: `import { readFileSync } from 'fs'` works, but `fileURLToPath(import.meta.url)` requires ESM. Use `path.resolve(__dirname)` instead — but `__dirname` is not available in ESM. Use `tsx` which handles this transparently. Alternatively, use `path.resolve(process.cwd(), 'scripts')` as the base path, since `turbo build-vocab` runs from the repo root.
- **ESLint 8 format** — `apps/web/.eslintrc.cjs` uses the legacy format. Do NOT use `eslint.config.js` (flat config) as apps/web has `eslint: ^8.57.0`
- **`apps/story-generator` MUST stay excluded from pnpm-workspace.yaml** — it is a Python project; adding it would cause pnpm install to fail
- **Do NOT create `vitest.config.ts`** — the vitest configuration lives inside `vite.config.ts` under the `test` key (standard Vite + Vitest co-location pattern)
- **vocab.json is gitignored** — verify `.gitignore` at root has `apps/web/public/vocab.json` (added in Story 1.1)

### Previous Story Intelligence (Story 1.4)

- `vite.config.ts` uses `import path from 'path'` and `path.resolve(__dirname, './src')` — `__dirname` IS available because vite.config.ts runs in a CommonJS-like context via Vite's config loading (despite `type: module` in package.json, Vite processes config files specially). When extending vite.config.ts, keep this pattern.
- `playwright install chromium` was already run locally in Story 1.4 — in CI, all browsers must be installed with `playwright install --with-deps chromium firefox webkit`
- `turbo typecheck` uses `tsc -b` (not `tsc --noEmit`) — this is correct for project references setup; do not change
- `turbo build` produces `apps/web/dist/` (327KB JS, 4.9KB CSS) — the build-vocab output (`vocab.json`) is imported at runtime via fetch, not bundled into the JS output
- `postcss.config.js` uses `export default` (ESM) — this works because `apps/web` has `"type": "module"`

### File Structure After This Story

```
nihonnohon/
├── .github/
│   └── workflows/
│       └── ci.yml                    NEW
├── docs/
│   └── adr/
│       ├── 001-monorepo-turborepo.md NEW
│       ├── 002-json-schema-over-zod.md NEW
│       └── 003-story-generator-out-of-scope.md NEW
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   └── __tests__/
│   │   │       └── buildVocab.test.ts NEW
│   │   └── .eslintrc.cjs             NEW
│   └── story-generator/
│       ├── README.md                 NEW
│       ├── requirements.txt          NEW
│       └── src/
│           └── story_generator/
│               ├── __init__.py       NEW
│               └── validator.py      NEW
├── packages/
│   └── eslint-config/
│       ├── index.js                  UPDATE
│       ├── react.js                  NEW
│       └── package.json              UPDATE
├── scripts/
│   ├── build-vocab.ts                NEW
│   └── data/
│       └── genki-vocab.csv           NEW (copy of resources/genki1vocab.csv)
├── turbo.json                        UPDATE
├── package.json                      UPDATE
└── CONTRIBUTING.md                   NEW
```

apps/web/package.json changes:
- Add `"test:unit": "vitest run"` to scripts
- Add to devDependencies: `vitest ^3.0.0`, `@vitest/coverage-v8 ^3.0.0`, `jsdom ^25.0.0`, `@typescript-eslint/eslint-plugin ^7.0.0`, `@typescript-eslint/parser ^7.0.0`

apps/web/vite.config.ts changes:
- Add `test: { environment: 'jsdom', globals: true, setupFiles: [] }` block

### Anti-Patterns to Prevent

- Do NOT add `build-vocab` script to workspace packages (schema, story-loader, apps/web) — it belongs ONLY at repo root
- Do NOT add `apps/story-generator` to `pnpm-workspace.yaml` — it is intentionally excluded
- Do NOT create `vitest.config.ts` in apps/web — config lives in `vite.config.ts` under `test` key
- Do NOT use `eslint.config.js` (ESLint 9 flat config) — apps/web uses ESLint 8 which needs `.eslintrc.cjs`
- Do NOT use `__dirname` in `scripts/build-vocab.ts` if it causes runtime errors — use `process.cwd()` as the base path instead since turbo runs the script from the repo root
- Do NOT install Playwright browsers in `pnpm install` step — it is a separate step in CI after `test:unit` to avoid port conflicts

### References

- Story 1.5 ACs: [Source: _bmad-output/planning-artifacts/epics.md — Story 1.5]
- Turborepo pipeline spec: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Turborepo Pipeline]
- Monorepo structure: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Monorepo Structure]
- ESLint boundaries: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Architectural Boundaries]
- VocabEntry type: [Source: _bmad-output/planning-artifacts/architecture-distillate/02-architecture.md — Canonical Type Definitions]
- Deferred ESLint work: [Source: _bmad-output/implementation-artifacts/deferred-work.md — Deferred from code review of 1-4]
- Genki data source: [Source: resources/genki1vocab.csv — existing committed file]
- Story 1.4 learnings: [Source: _bmad-output/implementation-artifacts/1-4-web-app-scaffold.md — Dev Notes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **Vitest picked up Playwright e2e specs:** Default vitest glob matched `e2e/smoke.spec.ts`; fixed by adding `exclude: ['**/e2e/**']` to the `test` block in `vite.config.ts`.
- **Wrong vocab.json path in test:** `../../../public/vocab.json` from `src/__tests__/` resolves to `apps/public/vocab.json` (3 levels up from `__tests__` exits `apps/web/src`). Corrected to `../../public/vocab.json` (2 levels up exits to `apps/web/`).
- **`vite.config.ts` uses ESM `fileURLToPath`:** The actual scaffold (Story 1.4) used `fileURLToPath(new URL('./src', import.meta.url))` rather than `path.resolve(__dirname)`. Added `/// <reference types="vitest" />` at the top to enable the `test` property on `defineConfig`.
- **`packages/eslint-config/react.js` already existed:** A stub was present from Story 1.1; updated in place with the React + hooks plugin configuration.

### Completion Notes List

- `turbo.json` updated with all 7 pipeline tasks: `build-vocab` (cached), `build`, `dev`, `typecheck`, `test:unit`, `test:e2e`, `lint`. Build and dev now depend on `build-vocab`.
- `scripts/build-vocab.ts` processes `scripts/data/genki-vocab.csv` (1172 rows) → `apps/web/public/vocab.json`. Lesson 0 = "Genki I Intro", 1-12 = "Genki I Ch.N", 13-23 = "Genki II Ch.N". Uses `process.cwd()` as base path (avoids ESM `__dirname` issues when running via tsx from repo root).
- `scripts/data/genki-vocab.csv` copied verbatim from `resources/genki1vocab.csv` (1172 entries).
- `apps/web` now has `test:unit: vitest run` with vitest 3.2.4 and jsdom 25 installed. The `test` block excludes `e2e/**` to prevent Playwright spec pickup.
- `apps/web/src/__tests__/buildVocab.test.ts` — 5 tests, all passing. Uses `// @vitest-environment node` to enable `fs.readFileSync`. Validates VocabEntry shape, sequential ids, a known entry (`がくせい` → `学生`, Genki I Ch.1), and lesson prefix format.
- ESLint deferred-work resolved: `apps/web/.eslintrc.cjs` extends `@nihonnohon/eslint-config/react`. `eslint-plugin-boundaries` added to `@nihonnohon/eslint-config` with element type definitions for `package` and `app`. `@typescript-eslint/parser` + plugin added to `apps/web`. `turbo lint` exits 0.
- `.github/workflows/ci.yml` — pipeline: checkout → pnpm setup → Node setup → install (frozen-lockfile) → lint → typecheck → test:unit → Playwright browser install → test:e2e → build.
- `apps/story-generator/` placeholder created with README, requirements.txt, `__init__.py`, and `validator.py` stub. Not added to pnpm-workspace.yaml.
- `docs/adr/` directory created with 3 ADRs: 001 (Turborepo rationale), 002 (JSON Schema over Zod), 003 (story-generator out of scope).
- `CONTRIBUTING.md` at repo root covers setup, dev workflow, test commands, code placement table, package conventions, adding stories, and schema version bump contract.
- All tests: story-loader 14/14 passing, apps/web 5/5 passing. Playwright smoke test 1/1 passing.

### Change Log

- 2026-05-11: Story 1.5 implemented. Full Turborepo pipeline wired (`build-vocab`, `test:unit`, `test:e2e`); `scripts/build-vocab.ts` generating 1172-entry `vocab.json`; Vitest added to `apps/web`; ESLint deferred work resolved; GitHub Actions CI; `apps/story-generator/` placeholder; 3 ADRs; `CONTRIBUTING.md`.

### File List

- `turbo.json` (UPDATED)
- `package.json` (UPDATED)
- `pnpm-lock.yaml` (UPDATED)
- `CONTRIBUTING.md` (NEW)
- `scripts/build-vocab.ts` (NEW)
- `scripts/data/genki-vocab.csv` (NEW)
- `.github/workflows/ci.yml` (NEW)
- `apps/web/package.json` (UPDATED)
- `apps/web/vite.config.ts` (UPDATED)
- `apps/web/.eslintrc.cjs` (NEW)
- `apps/web/src/__tests__/buildVocab.test.ts` (NEW)
- `apps/story-generator/README.md` (NEW)
- `apps/story-generator/requirements.txt` (NEW)
- `apps/story-generator/src/story_generator/__init__.py` (NEW)
- `apps/story-generator/src/story_generator/validator.py` (NEW)
- `docs/adr/001-monorepo-turborepo.md` (NEW)
- `docs/adr/002-json-schema-over-zod.md` (NEW)
- `docs/adr/003-story-generator-out-of-scope.md` (NEW)
- `packages/eslint-config/package.json` (UPDATED)
- `packages/eslint-config/index.js` (UPDATED)
- `packages/eslint-config/react.js` (UPDATED)
