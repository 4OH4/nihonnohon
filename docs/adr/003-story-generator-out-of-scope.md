# ADR 003: Story Generator Out of Scope

**Status:** Accepted
**Date:** 2026-05-11

## Context

nihonnohon requires real Japanese story content to ship. A story-generator tool using LLM APIs
(e.g. Gemini) was discussed as part of the project — it would take Genki vocabulary data and
produce valid story JSON that authors can review and publish.

Including the story-generator in the same development sprint as the nihonnohon web app would:
- Add Python tooling, LLM API key management, and prompt engineering scope.
- Require coordinated schema freezes before authoring can begin.
- Increase sprint scope significantly beyond the web app MVP.

## Decision

The story-generator is a separate project. `apps/story-generator/` is a placeholder in the
monorepo that documents the interface contract. It is excluded from the pnpm workspace
(`pnpm-workspace.yaml` does not list `apps/story-generator`) because it is a Python project,
not a Node.js package.

nihonnohon ships v1 with a hand-crafted story fixture (`genki-i-ch6-tanaka-letter.json`)
to enable development. The story-generator can be developed independently once the schema
contract (`story.v1.json`) is frozen.

## Consequences

- **nihonnohon v1 uses a hand-crafted fixture story** for development and the initial release.
- **The story-generator is developed independently**, consuming `story.v1.json` as its contract.
- **`apps/story-generator` must NOT be added to `pnpm-workspace.yaml`** — pnpm would attempt
  to install it as a Node.js package, which it is not.
- **Schema coordination required:** Breaking changes to `story.v1.json` must be coordinated
  with the story-generator project before the version is bumped.
- **v1 soft dependency:** At least one valid, readable story is required before nihonnohon v1
  can ship; this comes from the hand-crafted fixture, not the generator.
