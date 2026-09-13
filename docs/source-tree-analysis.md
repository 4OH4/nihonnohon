---
generated: 2026-05-13
scan_level: deep
---

# Source Tree Analysis

Annotated directory structure for the nihonnohon monorepo. Excludes `node_modules`, `dist`, `.turbo`, and generated artefacts.

---

## Root

```
nihonnohon/
├── apps/
│   ├── web/                    # PRIMARY: React SPA (user-facing app)
│   └── api/                    # PLACEHOLDER: not implemented in v1
├── packages/
│   ├── schema/                 # Shared TypeScript types + JSON Schema contract
│   ├── story-loader/           # AJV story loader (validates + transforms wire→model)
│   ├── eslint-config/          # Shared ESLint config (react + base presets)
│   └── typescript-config/      # Shared tsconfig base files
├── scripts/
│   ├── build-vocab.ts          # One-time: CSV → public/vocab.json
│   └── build-kanji.ts          # One-time: kanjiapi.dev fetch → public/kanji-data.json
├── resources/
│   ├── genki1vocab.csv         # Source vocabulary (Genki I)
│   └── .ignore/                # Private source data (not committed to git)
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   └── *.md                    # Generated documentation (this directory)
├── .github/workflows/ci.yml    # GitHub Actions CI pipeline
├── turbo.json                  # Turborepo pipeline configuration
├── pnpm-workspace.yaml         # pnpm workspace package list
├── vercel.json                 # Vercel deployment (root build command + SPA rewrite)
└── package.json                # Root scripts (build, dev, lint, typecheck, tests)
```

---

## apps/web — React SPA

```
apps/web/
├── public/
│   ├── vocab.json              # Built vocabulary data (Map<id, VocabEntry> source)
│   ├── kanji-data.json         # Built kanji data (Map<char, KanjiEntry> source)
│   └── stories/
│       ├── manifest.json       # Story library index (array of ManifestEntry)
│       └── *.json              # Story files conforming to story.v1.json schema
├── src/
│   ├── main.tsx                # ENTRY POINT — ReactDOM.createRoot
│   ├── App.tsx                 # Root component — mounts <Router />
│   ├── router.tsx              # createBrowserRouter: 3 routes (/, /read/:storyId, /credits)
│   ├── index.css               # Global CSS (Tailwind imports + font-face)
│   ├── routes/
│   │   ├── LibraryRoute.tsx    # / — Story library with filters + local file upload
│   │   ├── ReaderRoute.tsx     # /read/:storyId — Story reader with panels
│   │   └── CreditsRoute.tsx    # /credits — Data attribution page
│   ├── components/
│   │   ├── AppBar.tsx          # Shared header (library vs reader variant)
│   │   ├── DifficultyBadge.tsx # Pill badge for story difficulty label
│   │   ├── GrammarPanel.tsx    # Grammar notes with sentence highlighting
│   │   ├── InfoPanel.tsx       # Live lookup panel (idle: story meta; found: word entry)
│   │   ├── KanjiBreakdown.tsx  # Kanji characters + Heisig keyword row
│   │   ├── SentenceBlock.tsx   # One sentence rendered as WordTokens
│   │   ├── SettingsMenu.tsx    # Radix Popover with spacing + text-size controls
│   │   ├── StoryCard.tsx       # Library card linking to reader
│   │   ├── ToolBar.tsx         # Ruby toggle, translation toggle, settings button
│   │   ├── VocabItem.tsx       # Single vocabulary entry row
│   │   ├── VocabPanel.tsx      # Full vocabulary list (keywords + supplement)
│   │   └── WordToken.tsx       # Single tappable Japanese word with ruby
│   ├── stores/
│   │   ├── lookupStore.ts      # Zustand: word lookup state + selected sentence
│   │   └── preferenceStore.ts  # Zustand (persist): ruby, spacing, translation, text size, tab
│   ├── services/
│   │   ├── vocabService.ts     # Singleton fetch of /vocab.json → Map<number, VocabEntry>
│   │   ├── kanjiService.ts     # Singleton fetch of /kanji-data.json → Map<string, KanjiEntry>
│   │   └── indexedDbService.ts # IndexedDB CRUD for locally uploaded stories
│   ├── utils/
│   │   ├── storyManifest.ts    # fetchManifest() + difficulty string parsers
│   │   └── textSize.ts         # TEXT_SIZE_VALUES constant map
│   ├── lib/
│   │   └── utils.ts            # cn() — clsx + tailwind-merge helper
│   └── __tests__/              # Vitest unit tests (one per component/service)
├── e2e/                        # Playwright E2E specs
│   ├── golden-path.spec.ts     # Happy-path reader flow
│   ├── accessibility.spec.ts   # axe-core WCAG 2.1 checks
│   ├── file-upload.spec.ts     # Local story upload flow
│   ├── error-states.spec.ts    # Error boundary and not-found states
│   └── smoke.spec.ts           # Basic page load checks
├── vite.config.ts              # Vite + Vitest config (@/ alias, jsdom env)
├── tailwind.config.ts          # Tailwind: custom design tokens + font-ja
├── playwright.config.ts        # Playwright: chromium/firefox/webkit projects
└── package.json                # Web app dependencies and scripts
```

---

## packages/schema

```
packages/schema/
├── src/
│   ├── types.ts                # TypeScript interfaces: VocabEntry, KanjiEntry,
│   │                           #   SentenceModel, StoryModel, LookupState, etc.
│   └── index.ts                # Re-exports all types
├── schemas/
│   └── story.v1.json           # JSON Schema Draft-07 — canonical story format contract
├── SCHEMA_CHANGELOG.md         # History of breaking + non-breaking schema changes
├── tsup.config.ts              # tsup: dual CJS+ESM output
└── package.json                # @nihonnohon/schema
```

---

## packages/story-loader

```
packages/story-loader/
├── src/
│   ├── index.ts                # loadStory(raw) — entry point; LOADERS registry
│   ├── v1.ts                   # loadV1: AJV validation → parallel checks → camelCase transform
│   ├── errors.ts               # LoaderError class with typed code field
│   ├── index.test.ts           # Vitest unit tests for loader
│   └── __fixtures__/           # Test JSON fixtures (valid + invalid stories)
├── tsup.config.ts              # tsup: dual CJS+ESM output
└── package.json                # @nihonnohon/story-loader
```

---

## Critical Entry Points

| Entry Point | Purpose |
|-------------|---------|
| `apps/web/src/main.tsx` | React root mount |
| `apps/web/src/router.tsx` | Route definitions |
| `apps/web/src/routes/LibraryRoute.tsx` | Library loader + upload handler |
| `apps/web/src/routes/ReaderRoute.tsx` | Reader loader + story rendering |
| `packages/story-loader/src/index.ts` | `loadStory()` — public API |
| `packages/schema/src/index.ts` | Type exports |
| `apps/web/public/stories/manifest.json` | Story library manifest |
