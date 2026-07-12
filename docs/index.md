---
generated: 2026-05-13
scan_level: deep
---

# Nihon no Hon — Documentation Index

**Primary entry point for AI-assisted development.** Start here before implementing any feature or fix.

---

## Project Overview

- **Type:** Monorepo (pnpm workspaces + Turborepo) with 3 documented parts
- **Primary Language:** TypeScript (strict ESM)
- **Architecture:** Component-based SPA with versioned story format contract

| Part | Path | Type |
|------|------|------|
| Web App | `apps/web` | React 18 SPA |
| Schema | `packages/schema` | TypeScript + JSON Schema library |
| Story Loader | `packages/story-loader` | AJV validation + transform library |

---

## Quick Reference

### Web App (`apps/web`)
- **Entry point:** `apps/web/src/main.tsx` → `App.tsx` → `router.tsx`
- **Routes:** `/` (LibraryRoute) · `/read/:storyId` (ReaderRoute) · `/credits` (CreditsRoute)
- **Stores:** `lookupStore` (word lookup state) · `preferenceStore` (persisted settings)
- **Services:** `vocabService` · `kanjiService` · `indexedDbService`
- **Architecture pattern:** Loader-per-route, Zustand state, singleton service init
- **Dev command:** `turbo dev` (from repo root)

### Schema Package (`packages/schema`)
- **Key exports:** `StoryModel`, `SentenceModel`, `VocabEntry`, `KanjiEntry`, `LookupState`
- **Schema file:** `packages/schema/schemas/story.v1.json` (JSON Schema Draft-07)

### Story Loader Package (`packages/story-loader`)
- **Public API:** `loadStory(rawJson): StoryModel`, `LoaderError`
- **Error codes:** `PARSE_FAILED` · `SCHEMA_INVALID` · `UNSUPPORTED_VERSION`

---

## Generated Documentation

| Document | Description |
|----------|-------------|
| [project-overview.md](./project-overview.md) | Executive summary, tech stack, repo structure |
| [architecture-web.md](./architecture-web.md) | Full architecture of the React SPA |
| [architecture-schema.md](./architecture-schema.md) | Story format contract and type definitions |
| [architecture-story-loader.md](./architecture-story-loader.md) | Versioned loader and validation pipeline |
| [component-inventory-web.md](./component-inventory-web.md) | All UI components with descriptions |
| [data-models.md](./data-models.md) | TypeScript interfaces and story JSON schema |
| [integration-architecture.md](./integration-architecture.md) | How parts interact and data flows |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated directory structure |
| [development-guide.md](./development-guide.md) | Setup, build, test, deploy |
| [story-generation-pipeline.md](./story-generation-pipeline.md) | How a topic/story becomes a JSON story file; where Genki/kanji data enters (baseline for quality work) |

---

## Existing Documentation

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | One-line project description |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Contributor guide (code locations, conventions) |
| [adr/001-monorepo-turborepo.md](./adr/001-monorepo-turborepo.md) | Why Turborepo + pnpm workspaces |
| [adr/002-json-schema-over-zod.md](./adr/002-json-schema-over-zod.md) | Why JSON Schema over Zod |
| [adr/003-story-generator-out-of-scope.md](./adr/003-story-generator-out-of-scope.md) | Story generator scope |
| [../packages/schema/SCHEMA_CHANGELOG.md](../packages/schema/SCHEMA_CHANGELOG.md) | Story format version history |

---

## Getting Started

```bash
pnpm install
turbo dev
# App at http://localhost:5173
```

See [development-guide.md](./development-guide.md) for the full setup, testing, and deployment guide.

---

## For AI Agents

- Read [architecture-web.md](./architecture-web.md) before implementing any web feature.
- Read [data-models.md](./data-models.md) before touching story format or types.
- Read [integration-architecture.md](./integration-architecture.md) before adding cross-package dependencies.
- Read the project context at `_bmad-output/project-context.md` for coding rules and anti-patterns.
