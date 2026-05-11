This section covers project identity, users, scope, FRs, NFRs, domain constraints/licensing, success criteria, and risks. Part 1 of 3 from architecture.md, prd.md, ux-design-specification.md.

## Project Identity
- Name: Nihon no Hon ("Japan's Book"); open-source static SPA web reader for Japanese language learners
- Author: RT; Date: 2026-05-08; Greenfield; Low-Medium complexity
- Status: READY FOR IMPLEMENTATION (completedAt: 2026-05-11)
- Core bet: open portable JSON story format as community flywheel (Anki model applied to reading)

## Target Users
- Primary: intermediate-beginner Japanese learners (Genki I/II, JLPT N5–N3); reads evenings/commute; uses Anki/Yomitan
- Secondary: story author (advanced learner/teacher); creates story JSON; needs frictionless test-and-iterate path

## Scope: In (v1 MVP)
- Hosted static SPA; no backend; no server-side rendering; no accounts; no gamification
- Story library with two-level difficulty filter (learning source → Genki chapter or JLPT level)
- Local story file upload with format validation and user-legible errors + spec link
- Sentence-by-sentence scrollable story display; all sentences visible simultaneously
- Author-annotated word segmentation: parallel words/ruby/vocabKeys arrays per sentence
- Word tap popup: English translation, hiragana reading, kanji breakdown (JMdict/EDICT + KANJIDIC2, bundled)
- Ruby toggle (show/hide, instant); word spacing toggle; adjustable text size (≥3 sizes)
- Paper-tone reading aesthetic: black text on light yellow background; WCAG AA contrast
- Open documented JSON story format spec (standalone, explicitly licensed)
- 1 example story v1 (reduced from 5; decouples v1 reader completion from authoring tool timeline)
- Credits/About section with JMdict/EDICT + KANJIDIC2 attribution
- Basic landing page meta tags (title, description, Open Graph)
- Vocabulary panel (keyword vocab + supplement) and grammar points panel; two-column on wide; tabbed on narrow
- Multilingual architecture preserved (language field, language-agnostic loader) but only Japanese/Genki implemented v1

## Scope: Out v1
- Audio playback (audioUrl field present in schema; playback deferred)
- Offline capability (deferred to future mobile apps)
- Advanced/morphological dictionary; de-inflection
- Story generator/authoring tool (placeholder only; out of pnpm workspace)
- Screen reader support for Japanese text
- Dynamic ruby inference
- Personal study list; quiz/study mode
- Per-story SEO meta tags

## Milestones
- M1 (Minimum Viable Reader): file upload OR hardcoded story → reader view; SentenceBlock all sentences; WordToken tap → InfoPanel (idle/found/not-found); sentence selection highlight; ruby toggle; translation toggle; AppBar back link
- M1 NOT required: story library UI, vocab panel, grammar panel, tab navigation, SettingsMenu, two-column desktop layout, Credits
- M2 (Full v1): all 44 FRs complete — story library + difficulty filter, vocab + grammar panels, tab navigation (mobile) + two-column layout (desktop), SettingsMenu, CreditsRoute, responsive layout verified across browser matrix
- v1 Ship Condition: M2 complete + 1 valid story from AI authoring tool passes schema validation and renders correctly

## Functional Requirements
### Story Discovery
- FR1: Browse all stories in library view
- FR2: Filter by learning source (Genki I, Genki II, JLPT, etc.)
- FR3: Filter by difficulty level within selected learning source
- FR4: View story metadata (title, difficulty label, description) before opening
- FR5: Stories with missing/unrecognised difficulty label shown with blank difficulty field — no error, no omission

### Story Loading
- FR6: Open story from built-in library
- FR7: Load story from locally stored device file
- FR8: Validate uploaded story files against format spec on load
- FR9: Display user-legible error + spec link on validation failure
- FR10: Continue functioning normally when optional story fields absent

### Reading
- FR11: Display all sentences as continuous scrollable document, each sentence on new line
- FR12: Toggle sentence-level English translations on/off; when on, translation appears beneath corresponding sentence
- FR13: Render each word as distinct, individually selectable element
- FR14: Render vocabulary supplement entries for author-defined terms not in app dictionary

### Word Lookup
- FR15: Select word to open lookup popup
- FR16: Popup displays English translation(s)
- FR17: Popup displays hiragana reading
- FR18: Popup displays kanji component breakdown
- FR19: No popup if word has no dictionary entry — tap silently ignored
- FR20: Vocabulary supplement entry takes precedence over app dictionary
- FR21: Dismiss word lookup popup
- FR22: Scroll popup content via keyboard navigation

### Reading Aids
- FR23: Toggle ruby character annotations on/off
- FR24: When ruby on, render author-provided annotations above annotated words
- FR25: Toggle inter-word spacing on/off
- FR26: Adjust text size in reader view

### Story Authoring Format
- FR27: Define complete story in open JSON format spec
- FR28: Segment sentence into words via parallel word array; optional translation field per sentence
- FR29: Provide ruby annotations via parallel ruby array — optional per sentence; individual elements optional per word (null = no annotation)
- FR30: Include story-level vocabulary supplement: array of {word, hiragana, translation}
- FR31: Specify difficulty label as Genki chapter reference (e.g. "Genki I Ch.6") or JLPT level (e.g. "N4")
- FR32: Specify story language via language field; app uses for language-specific UI labels (e.g. ruby toggle displays ルビ for Japanese)
- FR33: Include optional per-sentence audio link fields (stored but not played v1)
- FR34: Story format spec published as standalone document usable without app
- FR38: Include keyword vocabulary list: array of {word, hiragana, translation}
- FR39: Include grammar learning points: array of strings, each describing a grammar pattern

### Application & Platform
- FR35: Accessible via modern web browser, mobile and desktop
- FR36: Dictionary data attribution for JMdict/EDICT and KANJIDIC2 in Credits/About section
- FR37: Basic discoverability metadata on library/landing page
- FR40: Unified vocabulary panel combining keyword vocab list + supplement entries
- FR41: Tap word in vocabulary panel to open word lookup in InfoPanel
- FR42: View grammar learning points for current story
- FR43: Wide viewport: vocabulary and grammar panels alongside story text in two-column layout
- FR44: Narrow viewport: Story | Vocabulary | Grammar tabs

## Non-Functional Requirements
- NFR1: Word tap → popup <100ms
- NFR2: Ruby toggle and word spacing toggle instant — no visible re-render delay
- NFR3: Text size adjustment instant — no page reload or reflow flash
- NFR4: Local story file load <1s for typical story (<100KB)
- NFR5: Initial page load optimised — dictionary bundle is primary constraint; target non-slow TTI on standard broadband
- NFR6: Fully functional once loaded regardless of network state (bundled dictionary)
- NFR7: WCAG 2.1 AA text contrast in all views
- NFR8: Text size supports ≥3 distinct settings
- NFR9: Word lookup popup dismissible via Escape key
- NFR10: Word lookup popup supports keyboard scrolling when content exceeds visible area
- NFR11: App does not rely on colour alone to convey information
- NFR12: Fully functional in last 2 major versions of Chrome, Firefox, Safari, Edge — desktop and mobile
- NFR13: Touch interactions correct on iOS Safari and Android Chrome
- NFR14: Responsive layout across mobile and desktop — no separate mobile site
- NFR15: Codebase supports external contribution — clear structure, consistent conventions
- NFR16: Automated test coverage on important and testable features
- NFR17: Story format spec versioned; breaking changes identified and documented
- NFR18: Dictionary attribution requirements met in shipped app
- NFR-bundle: ≤150KB gzipped initial bundle; bundle analyser step in CI

## Domain Constraints & Licensing
- JMdict/EDICT: CC BY-SA 4.0 (or similar) — attribution required in app; exact version to confirm before v1 release
- KANJIDIC2: same licence family — same attribution requirement
- App licence (MIT or Apache 2.0 recommended): confirm compatibility with CC BY-SA ShareAlike terms before publishing
- Story format spec: must be explicitly licensed or placed in public domain before community release
- Genki vocabulary: attribution in CreditsRoute (FR36/NFR18)

## Success Criteria
- RT uses app for personal Japanese reading practice on ongoing basis
- v1 ships with 1 valid renderable story (reduced from 5)
- Codebase portfolio-ready: clean, documented, test coverage on important/testable features
- ≥1 external story submission or code contribution within 6 months of public release
- Word lookup latency imperceptible (<100ms tap-to-popup)
- App deploys as fully static website (no backend)
- Local story file upload works on mobile and desktop
- Story JSON format documented as open spec usable by third parties

## Key Risks
- Dictionary bundle size (JMdict + KANJIDIC2 large): evaluate indexed/compressed format; lazy loading if needed
- iOS Safari compatibility quirks: test real device early
- CC BY-SA ShareAlike obligations on codebase: confirm licence compatibility before v1 release
- Story format too complex for community authors: keep minimal; ruby optional per word and per sentence
- AJV CSP assumption: AJV v8 uses `new Function()` — blocked by strict CSP; architecture assumes no strict CSP on Vercel; migrate to AJV standalone pre-compiled validators if CSP added later
- Solo developer bandwidth: scope fixed; no creep without explicit reprioritisation

## Competitive Context (resolved)
- Yomitan: dictionary lookup only — no difficulty alignment, no story format
- Mokuro: open-source manga OCR — not prose text
- ttu-ebook-reader: open-source e-book reader — no difficulty metadata
- Migaku / Shinobi Japanese: closest feature set — commercial, closed
- Gap: no open-source tool combines prose reader + curriculum-granular difficulty + portable community story format
