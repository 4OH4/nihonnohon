---
type: bmad-distillate
sources:
  - "../architecture.md"
  - "../prd.md"
  - "../ux-design-specification.md"
downstream_consumer: "epics and stories creation"
created: "2026-05-11"
token_estimate: 5800
parts: 3
---

- Distilled from: architecture.md, prd.md, ux-design-specification.md
- Consumer: epics and stories creation
- Sections: 3 (requirements, architecture, ux-components)
- Project nihonnohon; static SPA; no backend v1; Vercel hosted; internet required at load
- Two milestones: M1 (minimum viable reader) and M2 (full v1); v1 ship condition = M2 complete + 1 valid story renders

## Section Manifest
- 01-requirements.md: scope, FRs, NFRs, licensing, success criteria, risks
- 02-architecture.md: tech stack, types, state, routing, patterns, file structure
- 03-ux-components.md: design tokens, component specs, interactions, flows

## Cross-Cutting Items
- TypeScript strict mode throughout all packages and apps
- WCAG 2.1 AA: target in both NFRs and component specs; colour tokens all verified ≥4.5:1
- Browser matrix (single source): last 2 major versions Chrome, Firefox, Safari, Edge; touch on iOS Safari + Android Chrome; no IE11
- Tailwind CSS + shadcn/ui + Radix UI: design system used across architecture and all components; tokens defined in tailwind.config.ts
- Word tap → lookup ≤100ms (O(1) Map); no loading state; no spinner; silent failure on no-entry
- Parallel array invariant: words/ruby/vocabKeys MUST be equal length per sentence; enforced by loader
- Schema boundary: packages/schema/schemas/story.v1.json is contract between nihonnohon loader and AI authoring tool; schema column schema frozen before authoring tool development begins
- AJV validates snake_case wire format FIRST; transform to camelCase StoryModel AFTER; never validate partially-transformed object
- Vocabulary supplement + keyword list share schema {word, hiragana, translation}; both merged in reader vocabulary panel
- InfoPanel persistent fixed-height; resting state always shows story title + difficulty + language (never blank)
- StoryModel.grammar = string[] (descriptions); SentenceModel.grammar = number[] (indices into StoryModel.grammar) — must not be conflated
