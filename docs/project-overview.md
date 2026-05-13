---
generated: 2026-05-13
scan_level: deep
---

# Nihon no Hon — Project Overview

**Nihon no Hon** (日本の本) is a Japanese reading-practice web application. Readers select a story from a built-in library (or load their own JSON file), then read it word-by-word with instant vocabulary lookup, furigana (ruby) annotations, kanji breakdown, grammar notes, and sentence translations.

---

## Repository Type

Monorepo — pnpm 11.0.9 workspaces orchestrated by Turborepo 2.9.12.

## Primary Language

TypeScript (ESM, `strict: true` throughout).

## Architecture Type

Component-based Single-Page Application (SPA) with a versioned story format contract shared between the web app and an external story-generator tool.

---

## Tech Stack Summary

| Area | Technology | Version |
|------|-----------|---------|
| Build orchestration | Turborepo | 2.9.12 |
| Package manager | pnpm | 11.0.9 |
| Node.js target | Node.js | 22 (CI) |
| Frontend framework | React | 18.3.1 |
| Build tool | Vite | 5.3.0 |
| Language | TypeScript | 5.5.0 |
| Routing | react-router-dom | 6.24.0 |
| State management | Zustand | 4.5.4 |
| Styling | Tailwind CSS | 3.4.0 |
| UI primitives | Radix UI (Popover) | ^1.1.15 |
| Schema validation | AJV | 8.17.1 |
| Unit testing | Vitest | 3.0.0 |
| E2E testing | Playwright | 1.44.0 |
| Deployment | Vercel | SPA rewrite |

---

## Repository Structure

```
nihonnohon/
├── apps/
│   ├── web/                    # React SPA — the main user-facing application
│   └── api/                    # Placeholder — not implemented in v1
├── packages/
│   ├── schema/                 # TypeScript types + JSON Schema (story format contract)
│   ├── story-loader/           # AJV-based story validation and wire→model transform
│   ├── eslint-config/          # Shared ESLint rules
│   └── typescript-config/      # Shared tsconfig bases
├── scripts/                    # One-time data build scripts (vocab, kanji)
├── resources/                  # Source data (Genki CSV files)
└── docs/                       # ADRs and generated documentation
```

---

## Getting Started

See [development-guide.md](./development-guide.md) for full setup instructions.

```bash
pnpm install
turbo dev
# App runs at http://localhost:5173
```

---

## Generated Documentation

| Document | Description |
|----------|-------------|
| [Architecture — Web App](./architecture-web.md) | Full architecture of the React SPA |
| [Architecture — Schema Package](./architecture-schema.md) | Story format contract and type definitions |
| [Architecture — Story Loader](./architecture-story-loader.md) | Versioned loader and validation pipeline |
| [Component Inventory](./component-inventory-web.md) | All UI components with descriptions |
| [Data Models](./data-models.md) | TypeScript interfaces and story JSON schema |
| [Integration Architecture](./integration-architecture.md) | How packages interact with the web app |
| [Source Tree Analysis](./source-tree-analysis.md) | Annotated directory structure |
| [Development Guide](./development-guide.md) | Setup, build, test, and contribution guide |

## Existing Documentation

| Document | Description |
|----------|-------------|
| [README.md](../README.md) | One-line project summary |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Full contributor guide |
| [ADR 001 — Monorepo with Turborepo](./adr/001-monorepo-turborepo.md) | Why Turborepo was chosen |
| [ADR 002 — JSON Schema over Zod](./adr/002-json-schema-over-zod.md) | Why JSON Schema over Zod |
| [ADR 003 — Story Generator Out of Scope](./adr/003-story-generator-out-of-scope.md) | Story generator scope decision |
