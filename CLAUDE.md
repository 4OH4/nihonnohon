# nihonnohon — agent guide

**Before implementing any code, read [`_bmad-output/project-context.md`](_bmad-output/project-context.md).** It is the authoritative, LLM-optimized rules file: technology stack, TypeScript / framework / testing / styling conventions, the reader interaction contract, and the critical anti-patterns. Follow it exactly; when in doubt, prefer the more restrictive option.

## Where things live

- **Agent rules (read first):** [`_bmad-output/project-context.md`](_bmad-output/project-context.md)
- **UI-behaviour rationale (the "why"):** [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md)
- **Architecture, data models, dev guide:** [`docs/`](docs/) (start at [`docs/index.md`](docs/index.md))

## Common commands

- `pnpm build` — full monorepo build (Turbo; packages before app)
- `pnpm typecheck` — type-check all packages and the app
- `pnpm test:unit` — Vitest unit tests (run inside a package or `apps/web`)
- `pnpm test:e2e` — Playwright E2E (run from `apps/web`)
- `pnpm dev` — Vite dev server (run from `apps/web`)

## Non-negotiables

- Monorepo: pnpm workspaces + Turborepo. Rebuild changed packages before running the app dev server.
- For any UI change affecting CSS visibility, spacing, or layout, **verify in a browser** (`pnpm dev`) before marking it done — store-only tests cannot catch a "setter without consumer" bug.
- `vocab.json` and `kanji-data.json` are fetched at runtime from `public/`; never import them as modules.
- Only the custom Tailwind design tokens are on-brand — no arbitrary colours.
