---
generated: 2026-05-13
scan_level: deep
---

# Integration Architecture

How the three documented parts — `apps/web`, `packages/schema`, and `packages/story-loader` — interact with each other and with external data sources.

---

## Dependency Graph

```
apps/web
  ├── @nihonnohon/schema        (workspace:*)  — TypeScript types + JSON Schema
  └── @nihonnohon/story-loader  (workspace:*)  — loadStory(), LoaderError

packages/story-loader
  └── @nihonnohon/schema        (workspace:*)  — imports StoryModel, SentenceModel, etc.

packages/schema
  └── (no internal dependencies)
```

---

## Package Boundary Rules

Enforced by `eslint-plugin-boundaries`:

1. `packages/*` **never** imports from `apps/*`
2. `apps/web` imports compiled package outputs only — never source files (`../../packages/*/src/`)
3. Build order enforced by Turborepo: `dependsOn: ["^build"]` ensures packages are built before the web app

---

## Integration Points

### 1. `apps/web` → `@nihonnohon/story-loader`

| Detail | Value |
|--------|-------|
| Call site | `apps/web/src/routes/LibraryRoute.tsx`, `ReaderRoute.tsx` |
| Function | `loadStory(rawJson: string | unknown): StoryModel` |
| Error type | `LoaderError` — codes: `PARSE_FAILED`, `SCHEMA_INVALID`, `UNSUPPORTED_VERSION` |
| Purpose | Validate + transform story JSON from file upload or network fetch |

**Flow:**

```
FileReader.onload / fetch('/stories/...')
  → loadStory(rawJson)
    → detect schema_version
    → LOADERS['1'](data)  (loadV1)
      → AJV validate (story.v1.json)
      → parallel array length check
      → snake_case → camelCase transform
    → StoryModel
```

### 2. `apps/web` → `@nihonnohon/schema` (types)

| Detail | Value |
|--------|-------|
| Import | `import type { StoryModel, VocabEntry, ... } from '@nihonnohon/schema'` |
| Usage | Type annotations throughout routes, components, stores, services |

### 3. `packages/story-loader` → `@nihonnohon/schema`

| Detail | Value |
|--------|-------|
| Import | Types (`StoryModel`, `SentenceModel`, etc.) + schema (`schemas/story.v1.json`) |
| Usage | AJV compiles the JSON Schema at module load; types used in `loadV1` return value |

---

## External Data Sources

### Runtime HTTP fetches (from `apps/web`)

| Resource | URL | Format | Loaded by |
|----------|-----|--------|-----------|
| Vocabulary dictionary | `GET /vocab.json` | `VocabEntry[]` | `vocabService.ts` |
| Kanji dictionary | `GET /kanji-data.json` | `Record<string, KanjiEntry>` | `kanjiService.ts` |
| Story manifest | `GET /stories/manifest.json` | `ManifestEntry[]` | `storyManifest.ts` |
| Story file | `GET /stories/{filename}` | Story JSON (wire format) | `ReaderRoute.tsx` |

All four are served as static files from `apps/web/public/`.

**Caching behaviour:** `vocabService` and `kanjiService` use a module-level singleton pattern — both only fetch once per browser session, with in-flight deduplication for concurrent callers.

### IndexedDB (locally uploaded stories)

Stories uploaded via the file picker are stored in IndexedDB (`nihonnohon-local-stories / stories`), keyed by a client-generated UUID. The reader uses the UUID as the route param and falls back to IndexedDB when the story ID is not found in the manifest.

---

## Data Flow Diagram

```
Library page load
  └─ loader() → fetchManifest() → GET /stories/manifest.json
                                → ManifestEntry[]

Story card click
  └─ navigate(/read/:storyId)

Reader page load
  └─ loader({ params })
       ├─ initVocab()  ──────────────────────────── GET /vocab.json → Map<id, VocabEntry>
       ├─ initKanji()  ──────────────────────────── GET /kanji-data.json → Map<char, KanjiEntry>
       ├─ fetchManifest() → find entry by storyId
       │    ├─ found:   fetch /stories/{filename} → loadStory() → StoryModel
       │    └─ not found: getStory(uuid) from IndexedDB → loadStory() → StoryModel
       └─ StoryModel returned to ReaderRoute

Word tap (WordToken)
  └─ lookupVocab(vocabKey) → VocabEntry | null
       └─ useLookupStore.lookup(word, entry, sentenceId)
            └─ InfoPanel re-renders with entry
                 └─ KanjiBreakdown: [...word].map(char → lookupKanji(char))

Local file upload (LibraryRoute)
  └─ FileReader.readAsText(file)
       └─ onload: loadStory(text) → validate (throws LoaderError on failure)
            └─ saveStory(uuid, rawJson) → IndexedDB
                 └─ navigate(/read/:uuid)
```

---

## Story Format Contract

`packages/schema/schemas/story.v1.json` is the single source of truth consumed by both:
- `@nihonnohon/story-loader` (AJV, TypeScript)
- `apps/story-generator` (jsonschema library, Python — developed independently)

Breaking changes require a version bump, a new loader file, and coordination with the story-generator project. See [ADR 002](./adr/002-json-schema-over-zod.md).
