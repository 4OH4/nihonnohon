This section covers colour tokens, typography, layout/breakpoints, all component specs, interaction patterns, navigation flows, graceful degradation, empty states, error patterns, and accessibility specs. Part 3 of 3 from architecture.md, prd.md, ux-design-specification.md.

## Colour Tokens
- paper-bg: #FDF6E3 (reading view background)
- paper-text: #1C1C1C (story text, primary UI text)
- surface: #FFFFFF (info panel, library cards, chrome)
- surface-subtle: #F5F5F0 (secondary panels, hover states)
- accent: #C8A85A (active toggle, selected filter, accent border)
- accent-subtle: #F5EDD6 (hover on word tokens, selected sentence bg)
- muted: #6B6B6B (secondary text — difficulty labels, sentence position)
- border: #E0D8C8 (dividers, card borders)
- error: #C0392B (validation errors)
- translation: #4A7B9D (sentence translations, italic)
- WCAG 2.1 AA verified: paper-text on paper-bg ≈14:1; paper-text on surface ≈18:1; muted on surface ≈5.7:1 (AA large text only; used only for secondary labels)

## Typography
- UI text: Inter (system-ui fallback)
- Japanese story text: Noto Sans JP + system CJK fallback
- InfoPanel: Inter for English labels; Noto Sans JP for hiragana/kanji
- Story text base: 1.25rem/20px (user-adjustable; three settings via CSS custom property `--story-font-size`; small=1rem, medium=1.25rem, large=1.5rem)
- Ruby annotations: 0.6em relative to word token
- InfoPanel primary (translation): 1.125rem/18px
- InfoPanel secondary (hiragana, kanji labels): 0.875rem/14px
- Library UI: 1rem/16px
- Captions/labels: 0.75rem/12px
- rem/em for typography; %/ch for widths; avoid fixed px for layout

## Spacing & Layout
- Base unit: 8px (Tailwind default)
- Reading view padding: generous horizontal margins; content never touches viewport edges
- Reading view max-width ~65ch (calibrated for Japanese text line length)
- Library cards: 3–4 cards visible above fold on mobile without scrolling
- Semantic HTML: main for story/library; nav for tab bar; header for app bar

## Responsive Layout
- Mobile-first; one primary structural breakpoint: lg (1024px)
- <1024px (smartphone portrait, tablet portrait): single column; InfoPanel full-width top; toolbar below; story fills remaining height; Story/Vocabulary/Grammar via bottom tab bar
- ≥1024px (tablet landscape, desktop): InfoPanel full-width top; story left column (max-width ~65ch); vocabulary/grammar right panel with Vocabulary/Grammar tabs; bottom tab bar replaced
- Smartphone landscape: not supported; portrait layout displays but not optimised; CSS @media (orientation: landscape) and (max-width: 767px) nudge may be added
- Story area height: calc(100dvh − panel − toolbar − tab bar); use dvh for iOS Safari
- InfoPanel: min-h fixed; overflow-y: auto if content exceeds

## Design System
- Tailwind CSS + Radix UI / shadcn/ui (headless); tokens defined as Tailwind theme extensions in tailwind.config.ts
- Radix primitives used for: Tabs, Select, ScrollArea, Toggle (focus management, ARIA, keyboard)
- Tailwind mobile-first; lg: prefix for desktop overrides
- ToolBar: ruby toggle + translation toggle + settings icon (⚙) only
- SettingsMenu: new component, src/components/SettingsMenu.tsx; Radix UI Popover triggered by ⚙; contains spacing toggle + text size controls

## Component Build Phases
- Phase 1 (core reading — M1): WordToken, InfoPanel, KanjiBreakdown, SentenceBlock, AppBar, ToolBar
- Phase 2 (library/nav): StoryCard, DifficultyBadge, library filter UI (Radix Select), file upload trigger
- Phase 3 (vocab/grammar): VocabItem, vocabulary list layout, grammar list layout, Radix Tabs integration

## InfoPanel Component
- Persistent fixed-height top panel; never hidden; content swaps only; zero layout shift
- Height: fixed ~110–140px mobile; same height in both states
- Resting state (idle): story title + difficulty label + language metadata (never blank)
- Lookup state (found): selected word (Japanese, large) → English translation (large, first) → hiragana reading → KanjiBreakdown row
- Not-found state: "No entry for [word]" in muted colour (not error styling; confirms tap registered)
- Content swap: immediate, no animation
- Desktop lg breakpoint: splits into two columns (lookup left, story context right)
- aria-live="polite"; aria-label="Word lookup panel"

## WordToken Component
- Atomic unit: author-segmented word + optional ruby annotation above
- States: default (plain on paper-bg) | hover (accent-subtle bg) | active (accent-subtle bg + 2px accent bottom border)
- Variants: with ruby / without ruby (controlled by ruby toggle); no ruby = no space reserved above
- Tap/click triggers lookup; InfoPanel updates; silent ignore if no entry
- role="button"; tabindex="0"; aria-label with word text; lang="ja"; Enter/Space triggers lookup
- Touch target: padded beyond visible glyph to meet 44×44px minimum
- Ruby: `<ruby>/<rt>` with visibility:hidden toggle (never display:none — causes reflow)
- white-space: nowrap on token container

## KanjiBreakdown Component
- Horizontal row of kanji items: large kanji character above + small meaning label below
- Source: KANJIDIC2; meaning = primary English gloss
- Hidden when looked-up word contains no kanji
- Max 4–5 kanji visible; row scrolls beyond that

## SentenceBlock Component
- Container: WordToken row (flex-wrap, paper-bg) + optional translation below
- Trans off: word row only; Trans on: word row + translation (italic, #4A7B9D)
- Missing translation + Trans on: nothing shown below that sentence (no blank line)
- isSelected: selectedSentenceId === sentence.id; selected → bg-accent-subtle (#F5EDD6)
- Sentence container tap → selectSentence(sentenceId); resets lookupState to idle

## AppBar Component
- Reader anatomy: back link (← Library) left; 日本の本 logo right
- Library anatomy: logo centred or right; no back link
- Logo: var(--font-ja), muted colour, 15px; decorative only (not a home button)
- Back link: proper anchor/button; aria-label="Back to library"
- Implementation: surface bg; border-bottom 1px solid border

## ToolBar Component
- Button order left-to-right: ルビ · Trans · ⚙ (settings icon)
- Toggle states: Off = surface bg + border + muted text; On = accent-subtle bg + accent border + paper-text
- ルビ label derived from story language field; Japanese → ルビ; fallback → "Ruby"
- SettingsMenu (Radix Popover, triggered by ⚙): spacing toggle + A−/A/A+ text size controls
- A−/A+ adjust `--story-font-size` CSS custom property on story container; A resets to default

## StoryCard Component
- Anatomy: English title (bold) · Japanese title (muted, smaller, var(--font-ja)) · DifficultyBadge · description excerpt (1–2 lines max)
- States: default | hover (accent border)
- Tap opens reader view

## DifficultyBadge Component
- Rounded pill; accent-subtle bg; accent border; small text
- Content: "Genki I · Ch.6" or "JLPT N4"
- Not rendered when difficulty field absent (blank not shown, not "Unspecified")
- aria-label with full difficulty string

## VocabItem Component
- Anatomy: word (large, font-ja) · reading (smaller, muted, font-ja) · translation (regular)
- States: default | hover (accent-subtle bg) | active (persists while InfoPanel shows this word)
- Tap triggers same lookup mechanic as WordToken → InfoPanel updates

## Vocabulary & Grammar Panels
- Vocabulary panel: merged keyword list + supplement entries; tapping any entry opens lookup in InfoPanel
- Grammar panel: display-only; no interaction; indices from SentenceModel.grammar reference StoryModel.grammar string array
- Grammar tab: derive selectedSentence from selectedSentenceId; applicableIndices = selectedSentence?.grammar ?? null; grammar points with index in applicableIndices → bg-accent-subtle border border-accent; others → text-muted; if no sentence selected → all grammar points equal weight

## Core Interaction Loop
- Read sentence → tap unknown word → InfoPanel updates instantly → continue reading (no dismissal needed)
- Lookup must be sub-100ms; no loading state, no spinner; reading position never lost
- Silent failure on words with no dictionary/supplement entry — tap ignored, no error
- Story completion: return to library via app bar back button only
- No onboarding screen — land directly in library

## Tab Navigation
- Mobile tab bar: Story | Vocabulary | Grammar; active = accent bottom border + paper-text label; inactive = muted text; immediate switch, no animation
- Scroll position in story preserved when switching tabs and returning
- Desktop right panel: Vocabulary | Grammar tabs; same visual treatment; story column unaffected
- Radix Tabs used for tab primitives

## Difficulty Filter
- Two-level: source selector (Genki I / Genki II / JLPT / All) always visible; chapter/level selector updates to valid options for selected source
- Selecting "All sources" hides/disables chapter/level selector
- Library updates immediately on each selection — no Apply button
- Active filter dropdowns: accent-subtle bg + accent border
- Radix Select used for filter dropdowns

## File Upload Flow
- Trigger: "Load a story from your device" CTA at bottom of library list
- Platform native file picker — no custom UI
- Validation: required fields missing → error; optional fields missing → load anyway (graceful degradation)
- Valid file → reader view loads immediately (no intermediate success screen)
- Invalid file → inline error below upload trigger (not modal); dismissible by tapping elsewhere or selecting library story

## Error Patterns
- File validation error: "This doesn't look like a valid Nihon no Hon story." + specific hint (e.g. "The 'sentences' field is missing or not an array") + link "View the story format documentation"
- Error colour: #C0392B; inline placement; not modal
- Dictionary unavailable: silent ignore, no error
- UNSUPPORTED_VERSION: React Router ErrorBoundary → message + link to library
- UUID not found (PARSE_FAILED): "This story isn't available — it may have been loaded on another device or the data was cleared." + link to library

## Empty States
- Library no match: "No stories found for this selection." + reset filter action + load from device action; muted text; no illustration
- Vocabulary panel empty: "No vocabulary defined for this story."
- Grammar panel empty: "No grammar notes for this story."
- InfoPanel resting: always shows story title + difficulty + language; never blank

## Graceful Degradation
- No ruby array on sentence → words render without annotations; toggle has no effect for that sentence
- No translation on sentence → Trans toggle shows nothing below (no blank line)
- No keywords list → vocabulary panel shows supplement only or empty state
- No grammar array → grammar panel shows empty state
- No difficulty field → DifficultyBadge not rendered
- No language field → ルビ button label falls back to "Ruby"

## Accessibility Specs
- WCAG 2.1 AA target; all interactive elements 44×44px minimum touch targets
- Toggle states use colour + border change (not colour alone)
- Active WordToken uses bottom border + background tint (not colour alone)
- Screen reader: not targeted v1; aria-live="polite" on InfoPanel; semantic HTML throughout
- No animations in v1; no prefers-reduced-motion needed
- Keyboard: InfoPanel Escape dismisses focus; WordToken Enter/Space; tab bar keyboard navigable
- Filter dropdowns: native select or Radix Select with associated label
- lang="ja" on every element rendering Japanese text — no exceptions

## Anti-Patterns (explicitly rejected)
- Floating popups (Yomitan model): cause layout shift, require dismissal — rejected in favour of persistent panel
- Blank panel resting state (Readle): wasted real estate — always show story context
- Opaque word lookup (Readle): shows translation only — nihonnohon exposes kanji components
- Gamification chrome: no streaks, scores, progress bars, notifications

## v2 Considerations (not v1 scope)
- User account entry point: top-right AppBar (occupied by logo in v1 reader; library top-right left free)
- Settings page: future nav entry in app bar
- Community story catalog: secondary tab or library section
- Kanji from vocabulary entries queued for kanji learning module (kanji breakdown panel is visual foundation)
