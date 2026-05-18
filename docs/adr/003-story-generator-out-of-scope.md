# ADR 003: Story Generator — Separate Project with Split Frontend/Backend

**Status:** Superseded (updated 2026-05-15; original decision 2026-05-11)
**Date:** 2026-05-11
**Updated:** 2026-05-15

## Context

nihonnohon requires real Japanese story content to ship. A story-generator tool using LLM APIs
(e.g. Gemini) was discussed as part of the project — it would take Genki vocabulary data and
produce valid story JSON that authors can review and publish.

Including the story-generator in the same development sprint as the nihonnohon web app would:
- Add Python tooling, LLM API key management, and prompt engineering scope.
- Require coordinated schema freezes before authoring can begin.
- Increase sprint scope significantly beyond the web app MVP.

## Original Decision (2026-05-11)

The story-generator is a separate project. `apps/story-generator/` was a placeholder in the
monorepo documenting the interface contract, excluded from `pnpm-workspace.yaml` because it
was a Python project.

## Updated Decision (2026-05-15)

The story authoring tool has been fully specified (see PRD and architecture document) and is
now actively developed. It consists of two separate directories with different workspace membership:

**`apps/story-generator/`** — React/Vite SPA frontend
- **IS added to `pnpm-workspace.yaml`** — it is a Node.js package
- Access to shared tooling: `@nihonnohon/typescript-config`, `@nihonnohon/eslint-config`
- Participates in the Turborepo pipeline

**`apps/story-generator-backend/`** — Python ADK backend
- **Must NOT be added to `pnpm-workspace.yaml`** — it is a Python project, not Node.js
- Contains the ADK agent server, Pydantic models (generated from `story.v1.json`), and
  reference data loader
- Existing `apps/story-generator/` Python skeleton (`validator.py`, `requirements.txt`, etc.)
  has been migrated here

## Consequences

- **nihonnohon v1 uses a hand-crafted fixture story** for development and the initial release.
- **`apps/story-generator/`** is the React frontend — a normal pnpm workspace member.
- **`apps/story-generator-backend/`** is the Python backend — excluded from pnpm workspace.
- **`apps/story-generator-backend` must NOT be added to `pnpm-workspace.yaml`** — pnpm would
  attempt to install it as a Node.js package, which it is not.
- **Schema coordination required:** Breaking changes to `story.v1.json` must be coordinated
  with the story-generator backend. The Pydantic models in `apps/story-generator-backend/` are
  auto-generated from `story.v1.json` via `make generate-models` — regenerate after any schema change.
- **v1 soft dependency:** At least one valid, readable story is required before nihonnohon v1
  can ship; this is now expected to come from the story authoring tool (M0+M1) rather than the
  hand-crafted fixture.
