# 日本の本 — Nihon no Hon

A Japanese reading practice web app. Read graded stories word-by-word with instant vocabulary lookup, furigana annotations, kanji breakdown, and grammar notes.

---

## Features

- **Word-level vocabulary lookup** — tap any word token to see its meaning, reading, and lesson reference
- **Furigana (ruby) annotations** — toggle hiragana readings above each word on or off
- **Kanji breakdown** — selected words show each kanji character with its Heisig keyword
- **Grammar notes** — story-level grammar points, highlighted for the currently selected sentence
- **Sentence translations** — toggle inline English translations per sentence
- **Story library** — browse built-in stories with source and chapter difficulty filters (Genki I/II, JLPT)
- **Local story upload** — load your own `.json` story file directly from your device
- **Persistent preferences** — ruby, spacing, translation, and text size settings survive page refresh
- **Responsive layout** — two-column reader on desktop; tabbed Story / Vocabulary / Grammar on mobile
- **Accessibility** — ARIA labels and WCAG 2.1 AA coverage via axe-core

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5 (strict), Vite 5 |
| Routing | react-router-dom v6 (`createBrowserRouter`) |
| State | Zustand 4 (`lookupStore`, `preferenceStore`) |
| Styling | Tailwind CSS 3, Radix UI Popover, custom design tokens |
| Schema | JSON Schema Draft-07 (`story.v1.json`) |
| Validation | AJV 8 (TypeScript), `jsonschema` (Python story generator) |
| Monorepo | pnpm 11 workspaces + Turborepo 2 |
| Testing | Vitest 3 (unit), Playwright 1.44 (E2E, 3 browsers) |
| Deployment | Vercel (static SPA, `apps/web` root) |

### Internal packages

| Package | Purpose |
|---------|---------|
| `@nihonnohon/schema` | Shared TypeScript types + JSON Schema story contract |
| `@nihonnohon/story-loader` | Versioned story loader: validate → transform wire→model |
| `@nihonnohon/eslint-config` | Shared ESLint rules |
| `@nihonnohon/typescript-config` | Shared tsconfig bases |

---

## Getting Started

```bash
pnpm install
turbo dev
```

The app runs at `http://localhost:5173`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup, testing, and contribution guide.

---

## Documentation

Comprehensive project documentation is in [`docs/`](./docs/):

- [`docs/index.md`](./docs/index.md) — master documentation index
- [`docs/architecture-web.md`](./docs/architecture-web.md) — web app architecture
- [`docs/data-models.md`](./docs/data-models.md) — story format and TypeScript types
- [`docs/development-guide.md`](./docs/development-guide.md) — dev setup and workflow

---

## Development

This project was designed and implemented using the **[BMAD Method](https://github.com/bmad-method)** with **[Claude Code](https://claude.ai/code)** — an AI-assisted development workflow covering product discovery, architecture, sprint planning, and iterative story implementation.
