---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
status: complete
completedAt: "2026-05-08"
releaseMode: phased
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-nihonnohon.md"
  - "_bmad-output/planning-artifacts/product-brief-nihonnohon-distillate.md"
briefCount: 2
researchCount: 0
brainstormingCount: 0
projectDocsCount: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: language_learning
  complexity: low-medium
  projectContext: greenfield
---

# Product Requirements Document - nihonnohon

**Author:** RT
**Date:** 2026-05-08

## Executive Summary

Nihon no Hon ("Japan's Book") is an open-source, offline-capable web reader for language learners, starting with Japanese. It targets the specific problem of comprehensible input scarcity: learners at the intermediate-beginner stage (Genki I/II, JLPT N5–N3) find available reading material either too elementary or far beyond their vocabulary. No existing open-source tool bridges this gap with curriculum-aligned content, a portable story format, and a focused prose reading experience in one package.

The reader displays all story sentences as a continuous, scrollable document. Tapping any word surfaces its English translation, hiragana pronunciation, and kanji breakdown, sourced from the Genki vocabulary data (accessed by explicit vocabulary ID) and a kanji data file. Ruby characters (reading annotations above kanji) can be toggled on or off. Stories are defined in a purpose-built JSON format carrying difficulty metadata (Genki chapter reference or JLPT level), author-annotated word segmentation and ruby character data, a vocabulary supplement for terms outside the app dictionary, and optional per-sentence audio links. The story format is designed as an open spec — portable, community-shareable, and language-agnostic.

Japanese is the first-class implementation. The architecture is designed to support additional languages without a rebuild.

v1 ships as a static web app with local story loading — no backend, no server dependency.

### What Makes This Special

Three capabilities combined that no open-source reader currently offers:

1. **Curriculum-granular difficulty.** Stories carry Genki chapter or JLPT level labels, not coarse beginner/intermediate/advanced buckets. Learners mid-textbook can filter to exactly what they've studied.
2. **Open, portable story format.** The JSON story format is a spec, not a lock-in. Authors create and distribute stories independently of any platform — the Anki deck model applied to reading.
3. **Prose-first experience.** Existing open tools target manga (Mokuro) or general web browsing (Yomitan). This is built specifically for text stories, with a continuous scrollable reading surface and instant inline word lookup via a persistent info panel.

The core bet mirrors Anki's success: openness and community extensibility matter more than any single feature. The format *is* the product, as much as the reader UI.

Planned future capabilities — audio playback, a community story-sharing hub, and an AI pipeline to simplify any native text to a target proficiency level — extend the product without changing its v1 foundations.

## Project Classification

| Attribute | Value |
|---|---|
| Project Type | Web App (SPA, internet-required; offline-capable once loaded, no backend) |
| Domain | Language Learning (EdTech-adjacent) |
| Complexity | Low-Medium |
| Project Context | Greenfield |
| Licence | Open source, permissive |

## Success Criteria

### User Success

- Learners can find a story matched to their current Genki chapter or JLPT level and read it without friction
- Word tap surfaces translation, hiragana reading, and kanji breakdown with no perceptible latency — lookup feels instant
- Ruby character annotations can be toggled on or off at any point without interrupting the reading session
- Stories load correctly from both the hosted library and from a locally uploaded story file
- App functions correctly on modern mobile and desktop browsers

### Business Success

- RT uses the app for personal Japanese reading practice on an ongoing basis
- v1 ships with 1 example story demonstrating the format and difficulty labelling
- Codebase is portfolio-ready: clean, well-documented, with test coverage on important and testable features
- At least one external story submission or code contribution received within six months of public release

### Technical Success

- Word lookup latency is imperceptible — no visible delay between tap and popup
- App deploys as a static website — no backend or server-side component required
- Local story file upload works across mobile and desktop browsers
- Story JSON format is documented as an open spec, usable by third parties without the app

### Measurable Outcomes

| Outcome | Target | Timeframe |
|---|---|---|
| Example stories shipped | 1 | v1 launch |
| Browser compatibility | Modern mobile + desktop | v1 launch |
| External contribution | 1+ story or PR | 6 months post-launch |
| Portfolio citation | Codebase standalone | v1 launch |

## Product Scope

### MVP — v1

- Hosted static web app (internet required to access app)
- Story library with two-level difficulty filter (learning source → chapter or JLPT level)
- Local story loading: upload a story JSON file from your device
- Continuous scrollable story display (all sentences visible simultaneously)
- Word tap → persistent info panel showing English translation, hiragana reading, and kanji breakdown (Genki vocabulary data + kanji data file)
- Ruby character toggle: show/hide reading annotations above kanji
- Word spacing toggle: show/hide inter-word spaces
- Adjustable text size in reader view
- Mobile and desktop browser support
- Open, documented JSON story format (spec-level documentation)
- 1 example story shipped with the app

### Growth Features (Post-MVP)

- Audio playback per sentence and full story (story format already accommodates audio links)
- Mobile app wrappers with offline story downloading (Capacitor or similar — not a rebuild)
- Community story-sharing hub: browse, upload, and download stories (Anki Web analogue)
- Personal study list — flag words from the info panel, persist across sessions
- Quiz and study mode for study list words, with image mnemonics

### Vision (Future)

- AI simplification pipeline: ingest any Japanese text, output a version calibrated to a target Genki chapter or JLPT level
- Multi-language support: extend reader and story format to languages beyond Japanese (architecture designed for this from v1)
- Story authoring tooling to support community content creation

## User Journeys

### Journey 1: First-Time Reader — Happy Path

**Persona: Kenji** — 28, studying Japanese with Genki I, just finished Chapter 6. He's done every textbook exercise but hasn't tried reading real prose yet. He found the app linked in a r/LearnJapanese thread titled "finally something that works at my level."

**Opening scene:** Kenji opens the app on his laptop during an evening study session. He lands on the story library. He selects his learning source — **Genki I** — then filters by chapter — **Ch.6**. The library narrows to matching stories. He picks *A Letter from Tanaka-san* and opens it.

**Rising action:** The story displays the first sentence. He reads it slowly — he recognises most words, but one compound stops him. He taps it. A popup appears instantly: the English meaning, the hiragana reading, and a breakdown of each kanji in the word. No lag, no page load — it's just there. He reads on. A few more taps. He's not translating every word, just catching the ones he needs.

**Climax:** By the end of the story he's read something in Japanese, understood it, and it didn't feel like a test. He looked up a handful of words and understood the rest on his own.

**Resolution:** He closes the app feeling like his Japanese is actually usable for something, not just confined to textbook drills.

**Capabilities revealed:** Two-level story library filter (learning source → chapter/level), continuous scrollable display, word tap → persistent info panel (translation, hiragana, kanji breakdown), instant lookup latency.

---

### Journey 2: Returning Reader — Self-Testing with Ruby Characters

**Persona: Kenji (again)** — one week later, a bit more confident.

**Opening scene:** He returns to the app and picks a story he's already read. This time he turns ruby characters off before he starts — he wants to see if he can read the kanji cold.

**Rising action:** He works through the first few sentences without tapping. Then he hits a kanji he can't parse. He toggles ruby characters back on just for that moment, reads the annotation, toggles off again and continues. The toggle is instant — no disruption, no re-render flash.

**Climax:** He makes it through the whole first sentence without tapping anything. That small win lands.

**Resolution:** He starts a new story at Genki I Ch.7. He's beginning to see the progress.

**Capabilities revealed:** Ruby character toggle (per-session, instant), re-reading previously read stories, story progression across difficulty levels.

---

### Journey 3: Local Story Loader — Community Content

**Persona: Priya** — learning Japanese at N4 level, active on WaniKani forums. She finds a GitHub gist shared by another learner: a story JSON file set at JLPT N4 difficulty, focused on vocabulary from her current WaniKani level.

**Opening scene:** She downloads the `.json` file to her phone. She opens the app in her mobile browser and sees the "Load a story from your device" option alongside the built-in library.

**Rising action:** She selects the file from her device. The story appears — correctly formatted, difficulty label displaying N4, vocabulary supplement entries showing for the two proper nouns in the story. Ruby character annotations render above the kanji as expected.

**Climax:** She reads it exactly as she would a built-in story. Word tap works. Ruby character toggle works. The community story is indistinguishable from a shipped one.

**Resolution:** She shares the link to the app back in the WaniKani thread, alongside the story file. The format does what it's supposed to: it travels.

**Edge case — malformed file:** If Priya uploads a file missing a required field (e.g. the `sentences` array), the app displays a clear, friendly error: "This file doesn't look like a valid Nihon no Hon story. Check the story format documentation." It does not crash or silently fail. A link to the format spec is surfaced in the error.

**Capabilities revealed:** Local file upload on mobile and desktop, story format validation with user-legible errors and spec link, vocabulary supplement rendering, ruby character annotation rendering from story data.

---

### Journey 4: Story Author — Creating and Testing a Community Story

**Persona: Marcus** — an advanced Japanese learner who teaches informal Japanese study groups online. He wants to create a short graded story for his Genki I Ch.3 students.

**Opening scene:** He finds the story format documentation (the open spec). It's self-contained: field names, types, an annotated example file — including how to add ruby character annotations per word — and a note on what belongs in the vocabulary supplement vs. the app dictionary.

**Rising action:** He writes the JSON in a text editor. He sets the difficulty to `"Genki I Ch.3"`, writes six short sentences with ruby annotations on kanji, and adds three vocabulary supplement entries. He saves the file and uploads it to test.

**Climax:** The story renders. He reads through it — tapping words, checking popup content, toggling ruby characters on and off. One vocabulary supplement entry isn't appearing. He checks his JSON: a typo in a field name. He fixes it, re-uploads, and it works.

**Resolution:** He shares the `.json` file in his study group's Discord. Students load it on their own devices. No platform dependency — just a file.

**Edge case — unknown word not in dictionary:** Marcus taps a word not in the Genki vocabulary data and not in the vocabulary supplement. Nothing happens — the tap is ignored silently and the info panel is not updated. If the word is in the vocabulary supplement, the supplement entry is shown normally.

**Edge case — context-dependent reading:** Because ruby annotations are author-provided in the story JSON (not dynamically inferred), readings are always correct for the intended context. Authors include the right reading in the annotation. Dynamic ruby generation via dictionary lookup is a future enhancement.

**Capabilities revealed:** Open format spec documentation (including ruby annotation structure), iterative upload-and-test workflow, vocabulary supplement overrides app dictionary, graceful unknown word handling.

---

### Journey 5: Edge Case — Network and Error Resilience

**Persona: Yuki** — studying on her commute, patchy mobile signal.

**Opening scene:** She opens the app at a station with good signal. The story library loads. She selects a story and starts reading.

**Rising action:** The train enters a tunnel. Signal drops.

**Climax:** She taps a word mid-story. The app is a static site — the page is already loaded, and the dictionary data is bundled. The lookup works. She keeps reading. No spinner, no failure state, no lost progress.

**Edge case — tap target on mobile:** She taps a long compound but her finger lands between two words. The app resolves to the nearest word boundary. Tap targets are generous enough to avoid frustration on small screens.

**Edge case — missing difficulty label:** A community story file has no difficulty field. The app displays it in the library with a blank difficulty field rather than hiding it or erroring. The reader still works normally.

**Resolution:** Yuki finishes the story before her stop. The session was uninterrupted.

**Capabilities revealed:** Offline resilience once loaded (static app, bundled dictionary), tap target design on mobile, graceful handling of missing or unrecognised difficulty metadata.

---

### Journey Requirements Summary

| Capability Area | Detail | Revealed By |
|---|---|---|
| Two-level story library filter | Filter by learning source (Genki I, Genki II, JLPT, etc.), then by chapter or level | Journey 1, 5 |
| Continuous scrollable display | Core reading UI | Journeys 1, 2 |
| Instant word tap popup | Translation, hiragana reading, kanji breakdown — imperceptible latency | Journeys 1, 2, 4 |
| Ruby character toggle | Author-annotated in story JSON; show/hide instantly without disruption | Journey 2 |
| Personal study list | Flag words/kanji from popup during reading | Journeys 1, 2 | *(deferred to v2)* |
| Local story file upload | Mobile and desktop browsers | Journeys 3, 4 |
| Story format validation | User-legible errors with link to spec on invalid file | Journeys 3, 4 |
| Vocabulary supplement | Story-level overrides for terms not in app dictionary | Journeys 3, 4 |
| Unknown word handling | Tap ignored silently when word has no dictionary or supplement entry | Journey 4 |
| Open format spec documentation | Including ruby annotation structure and word segmentation | Journey 4 |
| Static app offline resilience | Bundled dictionary; page stays functional after load | Journey 5 |
| Generous tap targets on mobile | Resolves to nearest word boundary | Journey 5 |
| Missing difficulty metadata | Displays with blank difficulty field; reader unaffected | Journey 5 |

## Domain-Specific Requirements

### Compliance & Regulatory

This product operates in a low-regulation domain (personal language learning tool, no student data, no institutional buyers). There are no applicable regulatory frameworks (COPPA, FERPA, GDPR consent flows, etc.) for v1.

### Legal / Intellectual Property Constraints

**Vocabulary data licensing:**
- The Genki vocabulary data used by the app is sourced from the Genki textbook series. The exact licence terms of the source data must be confirmed before v1 release. Attribution must be displayed in the app in the Credits/About section.
- The kanji data file (keyed by literal kanji character) is a curated subset of kanji information. The source and licence for this data must be documented before v1 release.

**Project licence:**
- The app itself will be released under a permissive open-source licence (MIT or Apache 2.0 recommended). Licence choice should be confirmed compatible with the licence of the vocabulary data source before publishing.

**Story format:**
- The open story JSON format spec should be explicitly licensed (or placed in the public domain) to ensure community authors can freely create and share stories without licence concerns.

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| Genki vocabulary data licence unclear or restrictive | Confirm exact licence terms before v1 release; document source and attribution in Credits/About |
| Attribution omitted in shipped app | Add a Credits/About view (`CreditsRoute`) to the app in v1 |
| Story format ambiguity about licence | Explicitly state the format spec licence in documentation |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Open story format as community infrastructure**

The central innovation is not the reader UI — it is the story format. A well-specified, open JSON format creates the same community flywheel that made Anki the dominant open-source flashcard tool: anyone can author and distribute content without depending on a platform, and the format outlives any single implementation. Applying this model to reading practice is novel in the open-source Japanese learning space. No existing open-source reader has an equivalent portable, community-shareable story format.

**2. Curriculum-granular difficulty alignment**

Existing open-source tools use coarse difficulty buckets (beginner / intermediate / advanced) or no difficulty metadata at all. Nihon no Hon aligns story difficulty to specific Genki textbook chapters and JLPT levels — giving mid-textbook learners a meaningful filter for the first time. This is a gap confirmed by the competitive landscape: no open-source reader offers Genki chapter alignment.

**3. Language-extensible architecture**

Japanese is the first-class implementation. The story format and reader are designed to be language-agnostic from v1 — the format spec does not hard-code Japanese-specific assumptions, and the architecture supports adding new languages without a rebuild. This compounds the community value over time and positions the project beyond a single-language niche.

**4. Author-annotated ruby characters**

Rather than relying on dynamic dictionary inference for ruby character (reading) annotations — which is error-prone due to context-dependent readings in Japanese — the story format carries explicit author-provided annotations. This is a deliberate accuracy-over-automation design decision. Dynamic ruby generation via dictionary lookup is deferred to a future version, when it can be offered as an opt-in enhancement rather than the primary source of truth.

### Market Context & Competitive Landscape

The three-way combination — open prose reader, curriculum-granular difficulty labelling, portable community story format — has no open-source equivalent. Existing tools each solve one part:
- Yomitan: dictionary lookup, no difficulty alignment, no story format
- Mokuro: open source, but manga OCR — not prose text
- ttu-ebook-reader: open source e-book reader, no difficulty metadata, no community content model
- Migaku / Shinobi Japanese: closest feature set, but commercial and closed

The open-source gap is real and the target community (r/LearnJapanese, WaniKani, Anki users) is already culturally aligned with open, community-extensible tooling.

### Validation Approach

- **Format validation:** The open story format is validated by RT authoring the five v1 example stories using it. If authoring is painful, the format needs refinement before community use.
- **Reader validation:** RT uses the app for personal reading practice. If it isn't used, it isn't working.
- **Community validation:** At least one external story submission or code contribution within six months of public release confirms the community model is viable.

### Risk Mitigation

| Risk | Mitigation |
|---|---|
| Story format too complex for community authors | Keep format minimal; provide annotated example files and clear spec documentation |
| Language-extensibility assumption breaks in implementation | Validate format spec against a second language (e.g. Korean or Mandarin) as a thought experiment before finalising v1 spec |
| Ruby annotation burden discourages story authorship | Document clearly what's required vs. optional; make ruby annotations optional where stories can omit them |

## Web App Specific Requirements

### Project-Type Overview

Nihon no Hon is a Single-Page Application (SPA) delivered as a hosted static website. All application logic runs client-side — no server-side rendering, no backend requests during normal use. The dictionary data is bundled with the app. Once the page is loaded, the reading experience is fully functional regardless of network state.

### Browser Matrix

| Browser | Desktop | Mobile |
|---|---|---|
| Chrome | Last 2 versions | Last 2 versions |
| Firefox | Last 2 versions | Last 2 versions |
| Safari | Last 2 versions | Last 2 versions (iOS primary) |
| Edge | Last 2 versions | Last 2 versions |

No legacy browser support. No IE11, no pre-Chromium Edge.

### Responsive Design

- App must be fully functional on mobile and desktop browser viewports
- Touch interactions (tap to select word, tap to dismiss popup) are the primary mobile interaction model
- Mouse and tap are assumed as the primary selection mechanisms — keyboard navigation is supplementary, not the primary flow
- Story text, info panel, and library cards must reflow cleanly across viewport sizes
- No separate mobile site or adaptive serving — a single responsive layout

### Visual Design Constraints

- **Colour scheme:** Black text on a light yellow background for the reading view — evokes aged paper, reduces eye strain during extended reading sessions
- **Aesthetic:** Clean and modern; no skeuomorphic clutter beyond the paper-tone background
- **Contrast:** Sufficient contrast ratio between text and background for comfortable readability (WCAG AA as a practical floor, not a compliance target)
- **Text sizing:** User-adjustable text size in the reader view — a core accessibility and comfort feature, not an enhancement

### Performance, Accessibility & Compatibility Targets

Measurable targets for performance, accessibility, and browser compatibility are defined in the Non-Functional Requirements section. Key constraints specific to this platform:

- Vocabulary and kanji data files (Genki vocabulary CSV preprocessed to JSON + kanji character data file) are small — no large dictionary bundle risk; initial bundle target ≤ 150KB gzipped
- Screen reader support for Japanese text is not targeted in v1 — pronunciation rendering is a specialist concern deferred to a future version

### SEO Strategy

- Basic meta tags on the library/landing page (title, description, Open Graph) for discoverability
- Story content is not indexed — stories are app state, not public URL-addressable pages
- No SEO investment beyond landing page basics in v1

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Approach:** Personal utility first — the product is considered successful at v1 if RT uses it for personal Japanese reading practice. Portfolio quality is a parallel constraint, not a secondary one: the codebase must be clean, documented, and demonstrably well-engineered.

**Resource context:** Solo developer, side project. Scope is deliberately bounded to what can be built and polished to a high standard by one person. Breadth is sacrificed for depth and quality.

### MVP Feature Set (v1)

**Core user journeys supported:** All five mapped journeys — first-time reader, returning reader, local story loader, story author testing, and edge case resilience.

**Must-Have Capabilities:**

- Hosted static SPA — mobile and desktop browsers (last 2 versions of Chrome, Firefox, Safari, Edge)
- Story library with two-level difficulty filter (learning source → chapter or JLPT level)
- Local story file upload with format validation and user-legible error messages
- Continuous scrollable reader (all sentences displayed simultaneously)
- Author-annotated word segmentation: each sentence stored as two parallel arrays — segmented words and ruby annotations per word
- Word tap → persistent info panel: English translation, hiragana reading, kanji breakdown (Genki vocabulary data + kanji data file)
- Ruby character toggle (show/hide)
- Word spacing toggle (show/hide inter-word spaces)
- Adjustable text size in reader view
- Paper-tone reading aesthetic (black on light yellow, WCAG AA contrast)
- Open, documented JSON story format spec
- 1 example story
- Credits/About section with Genki vocabulary source attribution

### Post-MVP Features

**Growth (v2):**
- Audio playback per sentence and full story (story format already accommodates audio links)
- Mobile app wrappers with offline story downloading (Capacitor or similar)
- Community story-sharing hub (browse, upload, download)
- Personal study list — flag words from the info panel, persist across sessions
- Quiz and study mode for study list words, with image mnemonics
- Dynamic ruby character generation via dictionary lookup (opt-in, supplements author annotations)

**Vision (v3+):**
- Multi-language support (architecture designed for this from v1)
- Story authoring tooling
- AI simplification pipeline (deferred — out of current scope)

### Resolved Architecture Decisions

| Decision | Resolution |
|---|---|
| Word segmentation | Author-annotated in story JSON; parallel word/ruby arrays per sentence |
| Ruby character source | Author-provided in story JSON for v1; dynamic lookup deferred |
| Ruby array structure | `ruby` array is optional on a sentence; when present, parallel to `words`; individual elements are optional (null/empty = no annotation for that word) |
| Word spacing | UI toggle — show/hide inter-word spaces |
| Dictionary data | Genki vocabulary CSV (preprocessed to JSON at build time, keyed by integer `id`) + kanji data JSON file (keyed by literal kanji character); both fetched and loaded into in-memory Maps at startup — no large bundle |
| Backend | None in v1 — fully static deployment |

### Risk Mitigation Strategy

**Technical risks:**

| Risk | Mitigation |
|---|---|
| iOS Safari compatibility quirks | Test on real iOS Safari early in development; treat as a first-class browser |
| Story authoring burden (word segmentation + ruby annotation) | Provide annotated example files and clear spec; make ruby optional per word and per sentence |

**Market risks:**

| Risk | Mitigation |
|---|---|
| No community adoption | RT is the primary user — personal utility is success independent of community |
| Open story format not adopted externally | Format validated by RT authoring 5 stories before release; if painful, format is refined |

**Resource risks:**

| Risk | Mitigation |
|---|---|
| Solo developer bandwidth | Scope fixed at v1 feature set; no scope creep without explicit reprioritisation |
| Portfolio quality vs. shipping speed | Quality is a stated constraint — not negotiable for this project |

## Functional Requirements

### Story Discovery

- **FR1:** Reader can browse all available stories in a library view
- **FR2:** Reader can filter the story library by learning source (e.g. Genki I, Genki II, JLPT)
- **FR3:** Reader can filter the story library by difficulty level within a selected learning source (e.g. Genki chapter, JLPT level)
- **FR4:** Reader can view story metadata (title, difficulty label, description) for each story before opening it
- **FR5:** Stories with a missing or unrecognised difficulty label are displayed in the library with a blank difficulty field, without error or omission

### Story Loading

- **FR6:** Reader can open a story from the built-in library to begin reading
- **FR7:** Reader can load a story from a locally stored file on their device
- **FR8:** The app validates uploaded story files against the story format spec on load
- **FR9:** The app displays a user-legible error message when an uploaded file fails validation, including a link to the format spec documentation
- **FR10:** The app continues to function normally when optional story fields are absent

### Reading

- **FR11:** Reader can view all sentences of a story as a continuous, scrollable document with each sentence on a new line
- **FR12:** Reader can toggle display of sentence-level English translations on or off; when on, the translation appears beneath its corresponding Japanese sentence
- **FR13:** The app renders each word in a sentence as a distinct, individually selectable element
- **FR14:** The app renders vocabulary supplement entries for terms the story author has defined, when those terms are not covered by the app dictionary

### Word Lookup

- **FR15:** Reader can select a word to view its lookup result in the persistent info panel
- **FR16:** The info panel displays the English translation(s) for the selected word
- **FR17:** The info panel displays the hiragana reading for the selected word
- **FR18:** The info panel displays a kanji component breakdown for the selected word
- **FR19:** When a word has no dictionary entry, the tap/click is ignored silently — the info panel is not updated
- **FR20:** When a word appears in the story's vocabulary supplement, the supplement entry is displayed and takes precedence over the app dictionary
- **FR21:** Reader can reset the info panel to its resting state via the Escape key
- **FR22:** Reader can scroll through the info panel lookup content using keyboard navigation when content exceeds the visible area

### Reading Aids & Display

- **FR23:** Reader can toggle ruby character annotations on or off
- **FR24:** When ruby display is on, the app renders ruby annotations above words where annotations are present in the story data
- **FR25:** Reader can toggle inter-word spacing on or off
- **FR26:** Reader can adjust the text size in the reader view

### Story Authoring Format

- **FR27:** Story authors can define a complete story using the open, documented JSON format spec
- **FR28:** Story authors can segment a sentence into words using a parallel word array in the sentence data; each sentence may also include an optional `translation` field (string) containing the English translation of that sentence
- **FR29:** Story authors can provide ruby character annotations per word using a parallel ruby array (the array is optional per sentence; each element within it is optional per word)
- **FR30:** Story authors can include a story-level vocabulary supplement — an array of `{word, hiragana, translation}` entries for terms not covered by the app dictionary
- **FR31:** Story authors can specify a difficulty label using either a Genki chapter reference (e.g. "Genki I Ch.6") or a JLPT level (e.g. "N4")
- **FR32:** Story authors can specify the language of a story using a language field (e.g. "Japanese"); the app uses this field to set language-specific UI labels (e.g. the ruby character toggle displays ルビ for Japanese stories)
- **FR33:** Story authors can include optional per-sentence audio link fields in the story data (stored but not played in v1)
- **FR34:** The story format spec is published as a standalone document, usable by third-party authors without the app
- **FR38:** Story authors can include a keyword vocabulary list — an array of `{word, hiragana, translation}` entries for words the story is designed to teach (e.g. chapter vocabulary); uses the same schema as the vocabulary supplement
- **FR39:** Story authors can include grammar learning points — an array of strings, each describing a grammar pattern used in the story

### Application & Platform

- **FR35:** The app is accessible via modern web browser on both mobile and desktop devices
- **FR36:** The app displays vocabulary data attribution for the Genki vocabulary source in a Credits or About section
- **FR37:** The app provides basic discoverability metadata (title, description) on the library/landing page
- **FR40:** Reader can view a unified vocabulary panel for the current story, combining keyword vocabulary list and vocabulary supplement entries
- **FR41:** Reader can tap a word in the vocabulary panel to open the word lookup in the info panel
- **FR42:** Reader can view grammar learning points for the current story
- **FR43:** On wide viewports, vocabulary and grammar panels display alongside the story text in a two-column layout with Vocabulary/Grammar tabs
- **FR44:** On narrow viewports, story text, vocabulary panel, and grammar panel are accessible via tabs (Story | Vocabulary | Grammar)

## Non-Functional Requirements

### Performance

- **NFR1:** Word tap → info panel updates with no perceptible delay (target: under 100ms from tap to panel update)
- **NFR2:** Ruby character toggle and inter-word spacing toggle apply instantly — no visible re-render delay
- **NFR3:** Text size adjustment applies instantly without page reload or content reflow flash
- **NFR4:** Local story file loading completes in under 1 second for typical story sizes (estimated under 100KB per story)
- **NFR5:** Initial page load is optimised — dictionary bundle size is the primary constraint; target a time-to-interactive that does not feel slow on a standard broadband connection
- **NFR6:** The app remains fully functional once loaded, regardless of network state

### Accessibility

- **NFR7:** Text contrast between foreground and background meets WCAG 2.1 AA in all views
- **NFR8:** User-adjustable text size in the reader view supports at least three distinct size settings
- **NFR9:** The info panel is dismissible to its resting state via the Escape key
- **NFR10:** The info panel supports keyboard scrolling when lookup content exceeds the visible area
- **NFR11:** The app does not rely on colour alone to convey information

### Compatibility

- **NFR12:** The app is fully functional in the last two major versions of Chrome, Firefox, Safari, and Edge on both desktop and mobile
- **NFR13:** Touch interactions (tap to select word, tap to dismiss popup) function correctly on iOS Safari and Android Chrome
- **NFR14:** The app layout is responsive and usable across mobile and desktop viewport sizes without a separate mobile site

### Maintainability

- **NFR15:** The codebase is written in a way that supports contribution by external developers — clear structure, consistent conventions, and no unexplained magic
- **NFR16:** Important and testable features have automated test coverage
- **NFR17:** The story format spec is versioned — breaking changes to the format are identified as such and documented
- **NFR18:** Genki vocabulary data attribution requirements are met in the shipped app
