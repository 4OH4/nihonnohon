---
title: "Product Brief Distillate: nihonnohon"
type: llm-distillate
source: "product-brief-nihonnohon.md"
created: "2026-05-08"
purpose: "Token-efficient context for downstream PRD creation"
---

# Detail Pack: Nihon no Hon

## Project Context

- **Builder:** RT, solo side project, software engineer by day. Japanese learning is both the use case and the motivation.
- **Dual learning goal:** Building this app to (a) aid personal Japanese reading practice and (b) learn agentic AI coding tools and new web technologies. Tech stack choices matter as learning vehicles, not just implementation decisions.
- **Portfolio intent:** Codebase should be clean, well-documented, and citable as a portfolio piece demonstrating engineering craft. Polish and UX quality matter, not just functionality.
- **No monetisation target.** Open source, permissively licensed, community-first.

## Platform & Architecture Signals

- **Web-first.** v1 is a web app — either local file or hosted static page. No backend required for v1.
- **Mobile later** — native mobile as a wrapper around the web app (e.g. Capacitor/Cordova pattern), not a separate native build.
- **Offline-capable v1** — stories load from local files; no network dependency for core reading experience.
- **Backend deferred** — community hub (upload/download stories) is a separate, later project. v1 has no server-side component.

## Story Document Format (detailed)

- **Format:** JSON. Chosen for flexibility and machine-readability (important for future AI pipeline).
- **Core structure:**
  - List of sentences (ordered)
  - Each sentence: text field + optional audio link field (URL or relative path)
  - Story-level metadata: title, author, difficulty label, language (always Japanese), description
  - Story-level vocabulary supplement: list of `{word, reading, meaning}` entries for proper nouns and unusual terms not covered by the app dictionary
- **Audio design:** Optional per-sentence audio links to support future playback feature. Full-story audio link also anticipated. Audio files are external to the story JSON (linked, not embedded).
- **Dictionary separation:** Core vocabulary and kanji data lives in the app (sourced from JMdict/EDICT open data). Story files carry only exceptions/supplements. This keeps story files lightweight and portable.
- **Difficulty label:** Single field, value is either a Genki chapter reference (e.g. `"Genki I Ch.5"`) or JLPT level (`"N5"`, `"N4"`, etc.). Not a numeric score — a curriculum reference.
- **Open format goal:** Format should be documented and stable enough for third parties to author stories without using this app. Think of it like an open spec.

## Dictionary & Linguistic Data

- **Source:** JMdict/EDICT (open-source Japanese dictionary data). Standard choice, widely used in the Japanese learning tool ecosystem (Yomitan, etc.).
- **Licensing note:** JMdict uses a Creative Commons licence — worth confirming exact attribution requirements during implementation.
- **Kanji data:** JMdict covers vocabulary readings; kanji component/meaning data likely needs KANJIDIC2 (also open, same licence family).
- **Lookup scope per word tap:** English meaning(s), hiragana reading, kanji breakdown (meaning of each kanji character used in the word).

## Reader UX Details

- **Display mode:** Sentence by sentence (not full paragraph/page). User advances through sentences.
- **Word tap:** Inline popup or side panel showing translation, hiragana, kanji breakdown.
- **Furigana toggle:** Show/hide furigana (small hiragana above kanji). Core feature, not optional enhancement. Users may want furigana off when testing themselves.
- **Study list:** User can mark any word or kanji as "unknown" or "difficult" from the word popup. These accumulate in a personal study list for later review.
- **Audio (future):** Per-sentence playback button + full-story playback. Sentence audio plays the recording linked in the story JSON.

## Deferred Features (not v1 — capture for PRD phasing)

| Feature | Phase | Notes |
|---|---|---|
| Audio playback | v2 | Story JSON format already accommodates audio links; player UI deferred |
| Community story hub | Separate project | Upload/download/share stories; Anki Web analogue |
| AI simplification pipeline | v3+ | Ingest any Japanese text → simplify vocabulary/grammar to target Genki chapter or JLPT level using vocabulary lists. Generative AI. This is a significant differentiator with no open-source equivalent. |
| Quiz / study mode | v2+ | Test knowledge of study-list words; RT specifically mentioned image-based mnemonics as a memory aid |
| Image mnemonics | v2+ | Display associated pictures with vocabulary during study to aid memory |
| Mobile native wrappers | v2 | Web wrapper (Capacitor or similar) — not a rebuild |
| Story authoring tool | Not yet discussed | Potential future feature — tooling to help community members create story JSON files |

## Competitive Context (research findings)

- **Yomitan** — browser extension, pop-up dictionary on any webpage. Open source. Does not solve difficulty alignment or provide a curated reader. Requires native-difficulty source material.
- **Mokuro** — open source manga reader, uses OCR to overlay text selection on images. Not applicable to prose text stories.
- **ttu-ebook-reader** — open source e-book reader with Yomitan support. Closer to the space but no difficulty metadata, no story format, no community content model.
- **Migaku** — commercial, immersion-focused, Chrome extension + platform. Paid, closed.
- **Shinobi Japanese** — illustrated stories with tap-to-translate. Commercial, not open source.
- **Anki** — open source flashcard SRS. Not a reader. The community/sharing model is the inspiration, not the product itself. (Note: Anki stewardship transitioning to AnkiHub in 2026.)
- **Key gap confirmed:** No open-source tool combines (a) prose reader, (b) curriculum-aligned difficulty labelling, (c) open/portable story format.

## User's Learning Context (grounding for content decisions)

- Currently studying with **Genki I/II textbook series**.
- Finds reading hard — this is a real pain point, not a hypothetical use case.
- Wants stories aligned to specific Genki chapters: vocabulary and grammar from up to that chapter, with emphasis on the current chapter's new vocabulary.
- Aware of the Anki ecosystem and comfortable with open-source tooling.

## Open Questions (unresolved during discovery)

1. **Tech stack preferences** — RT mentioned wanting to learn new technologies. What frameworks/stack is in scope? (Relevant for architecture phase.)
2. **JMdict licensing** — confirm exact attribution requirements before committing to it as the dictionary source.
3. **Story format versioning** — how will breaking changes to the story JSON format be handled once community stories exist? Needs a versioning strategy.
4. **Furigana data source** — furigana display requires knowing the reading for each kanji in context (readings are context-dependent in Japanese). Does this come from JMdict, or does the story format allow authors to annotate readings explicitly?
5. **Offline dictionary** — bundling JMdict in the web app means a non-trivial asset size. Is a full offline dictionary acceptable, or should lookups be lazy/API-based?
