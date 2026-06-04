# Deferred Work

## Deferred from: code review of se2-3-schema-and-type-updates (2026-06-04)

- **`pos: ""` schema allows empty string:** `"type": "string"` has no `minLength:1` on the `pos` property; `""` is a valid sentinel for "unknown POS" in the enrichment pipeline but causes `if (entry.pos)` to treat it as absent. Consider `minLength:1` with an explicit "unknown" code if a stricter contract is needed later. [`packages/schema/schemas/story.v2.json`]
- **`keywords`/`vocabSupplement` share `VocabSupplementEntry`:** Both arrays are typed with the same interface; `pos`/`dictionaryForm` can silently appear on keyword entries. If these collections need divergent shapes in future, consider separate interfaces. [`packages/schema/src/types.ts`]
- **`key: e.key!` non-null assertion:** Pre-existing pattern in `mapVocabEntry`; AJV validates `key` as required so the assertion is safe, but an explicit `?? 0` fallback would be clearer. [`packages/story-loader/src/v2.ts`]

## Deferred from: code review of se2-2-updated-generation-pipeline (2026-06-04)

- **`_lookup_genki_id` falsy-zero pattern:** `or` chain would misclassify row ID 0 as not-found; safe with IDs 1–1172 but latent. Prefer `if (v := ...) is not None` pattern when revisiting. [`enrichment.py:_lookup_genki_id`]
- **`vocab_supplement` translation empty string:** When neither Genki nor JMdict has a gloss, `translation` is `""`. Consider a fallback or explicit null. [`enrichment.py:build_enriched_story`]
- **`valid_story.json` fixture lacks `pos`/`dictionary_form`:** Test fixture represents old-format stories; se2-3 schema work will address this. [`tests/fixtures/valid_story.json`]
- **`supp_key_counter` theoretical collision:** Supplement keys start at 10000; would collide if Genki CSV ever exceeds 9999 rows. Add an assertion at load time if CSV grows significantly. [`enrichment.py`]
- **`感動詞` interjection pos_code="":** Interjections classified as punctuation in `build_enriched_story`, missing a vocab key. Pre-existing `_pos_code` design decision. [`enrichment.py`]
- **`load_genki_key_index` no header guard:** `int(row[0])` would raise on a header row. Pre-existing pattern from `load_genki_index`; CSV has no header. [`enrichment.py:load_genki_key_index`]

## Deferred from: code review of se2-1-enrichment-module (2026-06-04)

- **`_pos_code` empty `conj_type` → silent v1 fallback:** SudachiPy returning `""` for 活用型 on dictionary-form verb tokens causes silent v1 label; consider a warning or `""` → explicit unknown code. [`enrichment.py`]
- **`_annotate_morpheme` theoretical empty kanji_reading:** If `reading_hira` is shorter than `surface` (cannot occur with valid SudachiPy output), `kanji_reading` becomes `""` producing `食[]べ`. Add an assertion guard if input validation is introduced upstream. [`enrichment.py`]
- **`enrich_sentence` imports `sudachipy` inside method:** `import sudachipy` and `sudachipy.SplitMode.C` inside the loop body on every call; move import to module level or constructor. [`enrichment.py`]
- **`lookup_gloss` `str(Gloss)` format not verified:** `str(glosses[0])` relies on Jamdict's `Gloss.__str__` which may include language tags or metadata. Confirm format is clean English only. [`enrichment.py`]
- **`_dominant_pos` and `_derive_dictionary_form` duplicate `_AUXILIARY_POS` filtering:** Both independently build `content` list. Consider extracting `_content_morphemes(morphemes)` helper to keep in sync. [`enrichment.py`]

## Deferred from: code review of se1-6-story-generator-frontend-v2-compatibility (2026-06-04)

- **No test asserts `schema_version: "1"` still accepted:** Stage 2 test suite covers `"2"` (accepted) and `"3"` (rejected) but not the `!== '1'` branch. Add `it('accepts "1" as a valid schema_version')` to the Stage 2 suite. [`apps/story-generator/src/__tests__/validateStoryJson.test.ts`]

- **v1 stories with ruby mismatch now pass client-side validator:** `validateStoryJson` no longer checks `ruby` parallel-array parity; per spec, v1 ruby validation is intentionally removed. If a user edits generated output to add a malformed v1 `ruby` field, the validator won't catch it — the loader will reject it at runtime. The proper fix is AJV-based schema validation in the client, not custom array checks. [`apps/story-generator/src/lib/validateStoryJson.ts:76`]
- **Error message hardcodes `"1" or "2"` and will be stale when v3 is added:** Stage 2 is an open whitelist; when a v3 schema is introduced, both the condition and the user-facing message string must be updated in tandem. Pre-existing design pattern throughout the validator. [`apps/story-generator/src/lib/validateStoryJson.ts:38-44`]
- **Duplicate `vocab_supplement` keys silently valid:** `supplementalKeys` Set deduplicates duplicate-key entries silently; no error or warning surfaced to the user. Pre-existing, unrelated to this story. [`apps/story-generator/src/lib/validateStoryJson.ts:67-71`]
- **Empty sentence (`words: []`, no `vocab_keys`) passes all 8 validation stages:** A sentence with no words and no vocab_keys has nothing to check and is considered valid. Pre-existing, unrelated to this story. [`apps/story-generator/src/lib/validateStoryJson.ts:75`]

## Deferred from: code review of se1-5-story-generator-backend-v2-format (2026-06-04)

- **Empty reading bracket `食[]` passes validation:** `[` has a matching `]` but reading content is empty; spec only requires closed bracket preceded by kanji. Outside spec scope. [`validator.py` `_validate_word_annotation`]
- **Orphan `]` and nested brackets not detected:** Validator iterates `[` only; a stray `]` or nested `食[た[inner]]` is not flagged. Beyond spec requirements; `parseInlineRuby` handles gracefully. [`validator.py` `_validate_word_annotation`]
- **No `schema_version` gate on bracket validation:** Bracket check runs on v1 and v2 stories alike. Backend only validates freshly-generated v2 output; v1 words never contain `[`. [`validator.py` `validate()`]
- **String `"null"` in `words` array not coerced:** `_coerce_string_nulls` was narrowed to `vocab_keys`; a Gemini hallucination of `"null"` in `words` would pass as a valid token and render literally. Pre-existing gap — `words` coercion was never in scope. [`agent.py` `_coerce_string_nulls`]
- **Only first malformed `[` per word reported:** `_validate_word_annotation` returns early on the first error; a word with two bad brackets only surfaces one error. Diagnostic quality only; story is still correctly rejected. [`validator.py` `_validate_word_annotation`]
- **Agent truncates `ValidationResult.errors` to first 3:** `result.errors[:3]` in the error message; more than three validation failures produce an incomplete diagnostic. Pre-existing behaviour. [`agent.py` ~L507]
- **Bracket-not-preceded-by-kanji test asserts word in message only:** Test checks `"は[な]" in e.message` but not the explanatory phrase. Behaviour is correct; additional assertion is improvement only. [`tests/test_validator.py`]

## Deferred from: code review of se1-4-reader-ui-per-segment-rendering (2026-06-04)

- **`vocabKeys` length not validated vs `tokens` in UI layer:** `sentence.vocabKeys[i]` is accessed by index without checking that `vocabKeys.length === tokens.length`; a shorter array silently yields `undefined ?? null` for trailing tokens, suppressing vocab lookup. Pre-existing; loader validates at load time, UI trusts loader output. [`apps/web/src/components/SentenceBlock.tsx:48`]
- **Inner `<ruby>` elements carry no explicit `lang` attribute:** The outer `<span lang="ja">` wrapper sets language; inner `<ruby>` elements inherit it. No functional impact; noted in case any CSS or screen-reader rule targets `ruby[lang="ja"]` directly. [`apps/web/src/components/WordToken.tsx:64`]
- **Empty `segments[]` array produces invisible focusable `<span role="button">`:** `parseInlineRuby('')` returns `{ surface: '', segments: [] }`, which renders a zero-width focusable button with an empty aria-label. AJV `story.v2.json` schema does not permit empty word strings; v1 shim inherits the same constraint from the v1 wire schema. Unreachable in practice. [`apps/web/src/components/WordToken.tsx:62`]
- **supplementMap key mismatch if supplement `word` field contains inline bracket notation:** `supplementMap.get(token.surface)` uses the parsed, bracket-stripped surface; if a `vocabSupplement[].word` value in JSON uses bracket notation, its surface-stripped form would not match. Supplement entries never contain inline ruby markup in practice. [`apps/web/src/components/SentenceBlock.tsx:50`]
- **`seg.ruby === ""` from v1 shim renders empty `<rt>` visible when `rubyVisible: true`:** `v1.ts` passes `rubyArr[i] ?? null` directly; an empty-string ruby value in a v1 word passes the `seg.ruby !== null` guard and renders `<ruby>word<rt></rt></ruby>`. V1 wire format never uses bracket notation in word strings; this is theoretical only. [`packages/story-loader/src/v1.ts:109`]
- **Space key `handleActivate` calls `stopPropagation()` but not `preventDefault()`:** On `<span role="button">`, a Space keypress triggers lookup but also scrolls the page because `preventDefault()` is not called. Pre-existing — the old `<ruby role="button">` had the same handler. [`apps/web/src/components/WordToken.tsx:57`]
- **`token.surface` is empty string from orphan-bracket input:** A word like `[foo]` parsed by `parseInlineRuby` discards all bracket content, yielding `surface: ""` — the rendered `<span role="button">` is zero-width with an empty `aria-label`. AJV enforces `minLength:1` on wire strings (catching `""` directly), but bracket-only input like `[foo]` passes AJV as a non-empty string while producing an empty surface. Root cause is in the parser (se1-1). [`apps/web/src/components/WordToken.tsx:44`]
- **Two `WordToken` instances with identical surface in one sentence both activate simultaneously:** `isActive` checks `activeWord === token.surface` with no index/position discriminator; clicking either token activates both. `lookupState` stores only `word: string`. Pre-existing store design limitation. [`apps/web/src/components/WordToken.tsx:27`]
- **AC5 — No explicit integration test loading a v1 story through the shim to verify rendered output:** The rendering of single-segment tokens (the shim's output shape) is fully covered by `makeToken()`-based tests, but no test is explicitly labelled as the v1 shim path. Documentation clarity gap only.
- **`supplementEntry` override path not tested under new `token: ParsedWord` prop shape:** None of the new tests pass a non-null `supplementEntry`. Behaviour is unchanged from before the migration; pre-existing coverage gap. [`apps/web/src/__tests__/WordToken.test.tsx`]
- **`<span role="button">` vs native `<button>` — built-in keyboard accessibility:** Native `<button>` suppresses Space-scroll by default and doesn't require explicit `tabIndex={0}`. Change was architecturally necessary (nested `<ruby>` elements require a non-`<ruby>` outer wrapper); valid ARIA pattern. Revisit if an a11y audit flags it. [`apps/web/src/components/WordToken.tsx:45`]

## Deferred from: code review of se1-3-loader-v2-and-v1-shim (2026-06-04)

- **Shared AJV `validate.errors` mutable under concurrent calls:** Module-level `const validate = ajv.compile(schema)` in `v2.ts` (and identically in `v1.ts`) means `validate.errors` is a shared mutable reference; concurrent `loadStory()` calls could read stale errors. Pre-existing pattern; loader is currently synchronous. [`v2.ts:9-10`]
- **`mapVocabEntry` duplicated verbatim between `v1.ts` and `v2.ts`:** Both files define an identical private `mapVocabEntry`. A bug fix in one will not propagate to the other. By design in the versioned-loader architecture where each version file is self-contained. [`v1.ts:100`, `v2.ts:91`]
- **v1 shim `surface` contains bracket markup if a v1 payload word contains inline notation:** A v1 word like `"食[た]"` would produce `token.surface = "食[た]"` (brackets included) and a flat ruby annotation on the same token. Theoretical only — well-formed v1 stories never use inline bracket notation in words. [`v1.ts:108-111`]
- **`sentence.grammar` indices not bounds-checked against `story.grammar.length` in `v2.ts`:** An index beyond the story-level grammar array length is stored without validation; consumers get `undefined` entries. Pre-existing in `v1.ts`; grammar panel handles out-of-range indices gracefully. [`v2.ts:60-69`]

## Deferred from: code review of se1-2-internal-type-changes (2026-06-04)

- **`parseInlineRuby` orphan-bracket handler silently discards bracket content:** An orphan `[` outside kanji context causes the bracket and its contents to be discarded from `surface`, so `token.surface` diverges from the original input string. Pre-existing from se1-1. [`parseInlineRuby.ts:68-70`]

## Deferred from: code review of se1-1-inline-ruby-parser-and-v2-schema (2026-06-04)

- **CJK Extension A (U+3400–U+4DBF) excluded from `isKanji`:** No kyouiku/joyo kanji fall in this block; spec explicitly defines range as 0x4E00–0x9FFF. Revisit if classical/rare character support is needed. [`parseInlineRuby.ts:19`]
- **Surrogate-pair iteration for CJK Extension B+ characters:** Characters at U+20000+ are not used in modern Japanese; theoretical only for this app. [`parseInlineRuby.ts:40`]
- **`metadata` object uses `additionalProperties: true` while AC1 says "every object node":** Pre-existing from v1; metadata is an intentional open escape-hatch. [`story.v2.json:66`]

## Deferred from: code review of supp-1-gemini-thinking-live-status (2026-05-19)

- **Thought text forwarded verbatim to client with no sanitisation:** React escapes HTML so XSS is not a concern; Unicode bidirectional control characters are a cosmetic edge case. Acceptable for v1. [agent.py — both streaming loops]
- **Hint disappears during cancelling phase:** The `phase === 'generating'` guard is intentional per spec; the hint disappearing on Stop is acceptable v1 UX. Revisit if UX feedback identifies this as jarring. [GenerationProgress.tsx:122]
- **API key rotation staleness in `_get_stream_caller`:** Pre-existing identical pattern in `_get_caller`; both cache the client on first use. Not introduced by this story. [agent.py:_get_stream_caller]
- **`AGENT_STATUS` yielded inside `try` — disconnect during streaming:** If the ASGI layer disconnects mid-stream, the yield raises and is caught by `except Exception`, emitting an ERROR event the disconnected client never receives. Pre-existing pattern for all yields in generate(); no regression. [agent.py]

## Deferred from: code review of 3-2-topic-input-suggest-topic-button-and-mode-activation (2026-05-18)

- **`doSuggest` silently dropped if `isSuggesting` true when `handleConfirmReplace` fires:** Unreachable in normal UI flow (SuggestConfirm strip only opens when `isSuggesting === false`). Defensive: add AbortController or allow the second call to proceed when confirm was explicitly clicked. [TopicTextarea.tsx]
- **`pendingMode` stale when `outputIsDirty` clears externally while ModeToggle strip is showing:** If an external action (e.g., generation completing) resets `outputIsDirty` while the dirty-mode-switch confirmation strip is visible, `pendingMode` stays set and the strip remains open. Single-user v1 — external reset during confirmation window is practically impossible. [ModeToggle.tsx]
- **`doSuggest` overwrites user-typed content during in-flight request:** If the user types into the topic textarea while a suggest-topic fetch is in-flight, `setTopicText(data.topic)` unconditionally replaces it. Add `AbortController` or a staleness check if user edits during fetch become a problem. [TopicTextarea.tsx]
- **No Escape key handler on ModeToggle dirty-output warning strip:** The SuggestConfirm strip has Escape; the ModeToggle warning strip does not. AC6 does not require Escape — inconsistency noted for a future accessibility pass. [ModeToggle.tsx]
- **Debounce blocks re-click within 300ms after SuggestConfirm Cancel:** Expected behaviour, confirmed by test. UX quirk: user must wait 300ms after cancelling a replace before the button responds again. [TopicTextarea.tsx]
- **`approve()` snapshots live `topicText` not the phase-1 `storedInputs.topicText`:** If the user edits the topic field between phase 1 (English proposal) and phase 2 (Japanese conversion), `storedInputs.topicText` in the phase-2 snapshot reflects the edited value, not the original. Story 3.3 owns the approval flow — revisit if this creates a mismatch. [authoringStore.ts]
- **No `AbortController`; unmounting `TopicTextarea` during in-flight `/suggest-topic` may call `setTopicText` on stale component:** React 18 should suppress the state update, but no cancellation signal is sent to the backend. Consistent with existing backend-fetch patterns in the app. [TopicTextarea.tsx]

## Deferred from: code review of 3-1-path-b-backend-english-generation-and-suggest-topic-endpoints (2026-05-18)

- **Cooldown timestamp set before Gemini call:** `_suggest_topic_cooldowns[chapter] = now` is written before the async call completes, so a timeout locks the chapter for 2 seconds before a retry is allowed. Acceptable for v1 — 2s retry delay is minor. [main.py:suggest_topic]
- **Concurrent suggest-topic cooldown race:** Two simultaneous requests for the same chapter can both pass the `now - last_call < 2.0` check before either writes to the dict. Asyncio cooperative multitasking means this only matters under multi-worker deployment — same known limitation as `_active_runs`. [main.py:suggest_topic]
- **Per-chapter vs per-session cooldown:** AC4 specifies "per-session" cooldown; implementation keys by chapter string. In v1 with no authentication, per-chapter is an effective approximation — the concept of "session" is undefined without a session ID. Revisit if auth is added. [main.py:suggest_topic]
- **Both `topic` + `english_draft` set in same request → phase 1 silently wins:** The `if path_mode == "B" and topic` branch fires first, discarding `english_draft`. The two-request protocol prevents correctly-written clients from sending both. No guard needed for v1. [agent.py:generate]
- **Large text in GET query params for `topic`/`english_draft`:** Long or multi-line text in URL query strings can hit server/proxy length limits. Consistent with the pre-existing `inputText` GET param pattern. Architectural concern for a future refactor to use a POST body. [main.py:run_sse]
- **NFR14 timeout boundary not unit-tested:** The `asyncio.wait_for(9.0s)` path in `suggest_topic` is exercised only in integration. Fake-clock/timer injection not in scope for v1 test suite. [main.py / tests/test_agent.py]
- **`_suggest_topic_cooldowns` dict never pruned:** Module-level dict grows by one entry per unique chapter string seen. Bounded in practice by the small set of valid Genki chapters. Consistent with `_active_runs` pattern — same caveat applies. [main.py]

## Deferred from: code review of 2-9-session-persistence-clear-and-content-provenance (2026-05-18)

- **`sessionRestored` banner not cleared by SettingsPanel changes (temperature/grammarDist/pathMode):** Changing settings after a restored session leaves the "Restored from previous session" banner visible. Minor UX issue; SettingsPanel is a separate component from InputPanel and wiring dismissal there adds complexity for little value in v1. [InputPanel.tsx / useSession.ts]
- **`parsed as SessionState` skips field-level type validation:** After the `version === 1` check, the parsed object is cast to `SessionState` without verifying individual field types (e.g., `grammarDist: 5`, `temperature: "hot"`). Single-user tool with self-written sessions makes corruption unlikely; acceptable for v1. Add field guards if the session format is ever user-editable or externally supplied. [useSession.ts]
- **`localStorage.setItem` quota exception silently swallowed:** Large `outputJson` values can cause quota-exceeded errors that are caught and discarded. Per spec, graceful degradation without blocking is the required behaviour; no user notification needed for v1. [useSession.ts]
- **`prevPhase` not reset on remount (Strict Mode double-invoke):** In React Strict Mode, the subscribe effect mounts → unmounts → remounts; `prevPhase` is re-captured at second mount from current store state, potentially missing a phase transition that occurred in the gap. Dev-only concern; no production impact. [useSession.ts]
- **Stale debounce races phase-change write:** If a debounced write timer is queued and a phase change fires before the timer callback enters the JS task queue, the phase-change path cancels the timer — but if the timer already queued, a stale snapshot could overwrite the correct phase-tagged save. Practically impossible in a browser's single-threaded event loop; acceptable for v1. [useSession.ts]
- **`clear()` removes localStorage session via subscription, not directly:** `clear()` triggers `isClearedState → true` which triggers the subscriber to call `localStorage.removeItem()`. If `useSession` is unmounted when `clear()` is called, the removal doesn't happen. In the current UI, `clear()` is only callable from mounted components that always have `useSession` mounted. [authoringStore.ts / useSession.ts]

## Deferred from: code review of 2-8-client-side-validation-suite-story-download-and-statsbar (2026-05-18)

- **Transient `'downloading'` phase in synchronous `save()`:** Zero-tick intermediate state between the two `set()` calls in `save()`; React 18 batches synchronous Zustand updates so this phase is never rendered. Cosmetic; no observable effect. [authoringStore.ts]
- **Vocab key upper bound not checked:** Positive integers ≥1 are accepted as valid Genki vocab IDs without an upper bound check. Intentional design tradeoff (frontend lacks the Genki CSV); documented in story spec. [validateStoryJson.ts]
- **Non-object sentence elements silently skip per-sentence validation:** A `sentences` array containing a primitive (null, number, string) results in all per-sentence checks being skipped for that entry with no error. Backend structural validation prevents this in generated output; treat as adversarial input guard. [validateStoryJson.ts]
- **Non-numeric `vocab_supplement[].key` causes false-positive `VOCAB_KEY_UNRESOLVED`:** `v.key as number` casts without a type guard; a string key produces `NaN` in the supplementalKeys Set, making `supplementalKeys.has(NaN)` always false and incorrectly flagging sentence vocab_keys that reference the malformed entry. Backend enforces schema; low risk. [validateStoryJson.ts]
- **`ValidationErrorList` uses array-index as React `key`:** When the error list shrinks or reorders on re-validation, React reconciles by index and may re-announce the wrong error via `role="alert"`. Minor a11y issue; not critical for v1. [ValidationErrorList.tsx]
- **No test for Save & Download button state during `'downloading'` phase:** The transient `'downloading'` phase has no test coverage. Safe to skip for v1. [OutputPanel.test.tsx]

## Deferred from: code review of 2-7-output-panel-dirty-state-and-re-run (2026-05-18)

- **UX-DR5 deviation — JS gutter + textarea instead of `<pre>` + CSS counter-increment:** `JsonOutput` uses a `<div>` gutter with JS-computed line numbers and a `<textarea>`, not the `<pre>` + `counter-increment` approach specified in UX-DR5. The story spec explicitly specified the gutter-div approach. Fixing requires a full component redesign (contenteditable `<pre>` or switch to CodeMirror). Defer to a future polish story. [JsonOutput.tsx]
- **`rerun()` does not clear `proposalApproved`:** After a Path B run where `approve()` set `proposalApproved: true`, calling `rerun()` leaves the flag stale. Pre-existing on `generate()` too. Scope to Story 4.x when Path B is wired up. [authoringStore.ts:131]
- **Single-frame `editedValue = null` before first useEffect on output-clean entry:** On the render cycle immediately after `output-clean` is reached, `editedValue` is null and `JsonOutput` receives `""` for one frame before the sync effect fires. Imperceptible; tests pass via `act()`. [OutputPanel.tsx:29]
- **Latent stale `editedValue` after rerun if future phases reach output-dirty without going through output-clean:** Non-triggerable with the current phase machine (`_markDirty` only transitions from output-clean → output-dirty). Guard if new phases are added. [OutputPanel.tsx]
- **Escape keydown attached to `document` without `stopPropagation`:** If `OutputPanel` is ever rendered inside a Sheet or Dialog that also handles Escape, pressing Escape dismisses the RerunWarning AND closes the parent overlay. Not an issue in the current flat layout. [OutputPanel.tsx:52]
- **Double `_setOutputJson` while in `output-clean` re-syncs `editedValue`, discarding user edits:** The `useEffect([phase, outputJson])` would fire again if `outputJson` changed while already in `output-clean`. `RUN_FINISHED` is a terminal event — this is unreachable in production. [OutputPanel.tsx:29]

## Deferred from: code review of 2-6-generation-ui-progress-display-stop-button-and-inputsection-collapse (2026-05-18)

- **`useAgUiRun` `?? store.*` fallback contradicts AC7:** `storedInputs?.pathMode ?? store.pathMode` (and temperature/grammarDist) falls back to live store reads, which AC7 explicitly prohibits. Unreachable in production — `generate()` always sets `storedInputs` before the effect fires. Consistent with pre-existing pattern for inputText/chapterTarget. [useAgUiRun.ts:53]
- **`agentRunStarted` not reset in `_setError`/`_resolveCancel`:** `agentRunStarted` can be `true` when phase returns to `idle` or `error`. No visible impact — all rendering paths gate on phase. `generate()` always resets it on the next run. [authoringStore.ts:171,175]
- **Elapsed timer can tick one extra second after `generating` ends:** Standard `setInterval` race — the tick already queued before cleanup runs can fire one more time. Cosmetic only; no data impact. [GenerationProgress.tsx:47]

## Deferred from: code review of 2-5-ag-ui-sse-lifecycle-and-store-integration (2026-05-17)

- **AC2 timer-cleared proof is indirect:** The test verifies no error fires after 5s following RUN_STARTED, but does not prove `clearTimeout` was actually called. A direct proof would require injecting spy timers. Acceptable for v1. [useAgUiRun.test.ts]
- **AC4 proposal single-chunk emission:** Proposal buffer path tested with one chunk; the story buffer path (multi-chunk) is tested separately. Cover multi-chunk proposal if the proposal path gains independent buffer logic. [useAgUiRun.test.ts]
- **AC9 mockEs.close() not verified on cancel:** The SSE connection close on cancellation is handled by the hook's useEffect cleanup (called when phase changes away from generating), not directly asserted. [useAgUiRun.test.ts]
- **No re-render test with changed createEventSource factory:** If the hook consumer re-renders with a new factory, the old EventSource should be closed. Not required by Story 2.5 ACs. [useAgUiRun.test.ts]
- **No test for non-generating phase on hook mount:** The no-op guard `if (store.phase !== 'generating' || !store.runId) return` is not directly exercised. Covered implicitly by store phase guards in authoringStore.test.ts. [useAgUiRun.test.ts]

## Deferred from: code review of 2-4-input-panel-chapter-selector-and-scopechip (2026-05-17)

- **`useBackendStatus` concurrent in-flight fetches:** Pre-existing — see 2-3 deferred section. Also surfaced again in 2-4 context via the `InputPanel` consuming the hook. [useBackendStatus.ts]
- **`useAgUiRun` 3s first-event timeout calls `_setError` after component unmounts:** On the success path `phaseRef.current` is read, but if the component unmounts during the 3s+5s window, the ref holds a stale value and `_setError` may fire on a newly-mounted store instance. Pre-existing; Story 2.5 owns the `useAgUiRun` lifecycle. [useAgUiRun.ts]
- **React concurrent-mode potential tear from separate `useAuthoringStore` subscriptions in `InputPanel`:** `inputText` and `chapterTarget` each use separate `useAuthoringStore` calls, theoretically readable in different render passes. Consolidate to a single combined selector if concurrent-mode tearing becomes observable. Not a current issue with synchronous Zustand. [InputPanel.tsx]
- **No visible indicator on steering toggle when hidden instructions are present:** If the user types steering instructions, collapses the panel, and forgets, the instructions are silently included in the next `generate()` call. A badge or dot on the toggle button would make this visible. Enhancement for a future story. [InputPanel.tsx]
- **`focus-visible` without `:focus` fallback for older browsers:** Pre-existing pattern across the whole app (all interactive elements); all deployment targets use modern browsers with `:focus-visible` support. [InputPanel.tsx, ScopeChip.tsx and throughout]

## Deferred from: code review of 2-3-app-shell-backendstatus-modetoggle-and-settingspanel (2026-05-17)

- **Concurrent in-flight `fetch()` in `useBackendStatus`:** No abort of previous call when re-trigger fires. Single-user v1; address if concurrent load grows. [useBackendStatus.ts]
- **`AbortSignal.timeout` browser support:** Requires Safari ≥ 16.4. All deployment targets meet this; document and accept. [useBackendStatus.ts]
- **`proposalText` not cleared on mode switch:** Stale Path B proposal persists if user switches modes. M3 / Path B scope — Story 4.x. [authoringStore.ts]
- **`storedInputs` snapshot missing `pathMode` and `temperature`:** Re-run URL construction in Story 2.6 will need to extend the snapshot; deferred intentionally. [authoringStore.ts / useAgUiRun.ts]
- **`save()` doesn't return from `downloading` phase:** No `output-clean` transition on download completion. Story 2.8 scope. [authoringStore.ts]
- **`useAuthoringStore()` full subscription in components:** Components subscribe to entire store; potential unnecessary re-renders at scale. Address when profiling shows need. [ModeToggle.tsx, SettingsPanel.tsx, BackendStatus.tsx]

## Deferred from: code review of 2-2-m1-production-backend-agent-sse-endpoints-and-cancellation (2026-05-17)

- **Dangling threads on asyncio.TimeoutError:** `asyncio.to_thread` threads can't be cancelled; after a 55s timeout the OS thread continues until TCP timeout. Under concurrent load threads pile up. Single-user v1 won't hit this; address in M2 if concurrent usage grows. [agent.py]
- **`_active_runs` multi-worker isolation:** Each uvicorn worker has its own dict; cancel routed to different worker silently does nothing. v1 uses single worker; v2 (Cloud Run) will need a shared store (Redis, etc.). [main.py]
- **`cancel` always returns `{"ok": True}`:** No 404 for unknown run_id; idempotent cancel is acceptable for v1. [main.py]
- **TEXT_MESSAGE_CHUNK + RUN_FINISHED both carry full JSON:** Doubles bandwidth per generation. Functionally correct; use Gemini streaming response in M2 to send true incremental chunks. [agent.py]
- **`path_mode` accepted but unused:** Path B (Generate from topic) is M3 scope. Wire `path_mode` into agent logic in Story 4.1. [agent.py]
- **Ch.0 vocab entries excluded from prompts:** `build_system_prompt` loops `range(1, chapter+1)` matching spike.py pattern; Ch.0 greetings (おはよう, etc.) are never included. Intentional curriculum design — revisit if greetings are needed. [agent.py]
- **Health 503 only for absent key, not invalid/revoked key:** Validating key correctness requires a Gemini API call, inappropriate for a health endpoint. Accept this limitation; add a separate "connection test" endpoint in v2 if needed. [main.py]

## Deferred from: code review of 2-1-frontend-project-scaffold-state-machine-and-ag-ui-hook (2026-05-17)

- **`clear()` during generating leaves SSE open until next render:** `clear()` is valid from any phase but the SSE cleanup runs asynchronously. Add UI guard in Story 2.6 when components bind `clear()` to the generating phase. [authoringStore.ts / useAgUiRun.ts]
- **`steeringInstructions` empty-string ambiguity:** Empty field sends no param; non-empty sends the value. If the backend distinguishes missing vs empty, silent mismatch. Confirm API contract in Story 2.2. [useAgUiRun.ts]
- **`crypto.randomUUID()` secure-context requirement:** Only safe on localhost and HTTPS. If ever previewed over plain HTTP (staging), throws and breaks generation. All deployment targets use localhost/HTTPS so not a practical issue for v1. [authoringStore.ts]
- **`_resolveCancel()` leaves `storedInputs` intact:** Cancelled run leaves a Re-run snapshot. Whether the cancelled inputs should persist or be cleared is a product decision; resolve when building Re-run in Story 2.6. [authoringStore.ts]
- **`generate()` from error doesn't clear `outputJson`:** Stale output from a prior successful run persists while retrying. No component reads `outputJson` directly in Story 2.1 so no visible effect; clear it in the error-retry path when output display is wired up in Story 2.7. [authoringStore.ts]
- **`approve()` doesn't clear `proposalText`/`outputJson`:** Stale Path A output persists when entering Path B approval flow. Scope to Story 4.3. [authoringStore.ts]

## Deferred from: code review of 1-3-m0-feasibility-spike (2026-05-17)

- **CWD-relative FIXTURE_PATH / DATA_DIR:** Spike uses relative paths that only resolve correctly when invoked via `make spike` from `apps/story-generator-backend/`. Add a CWD assertion or resolve paths relative to `__file__` when this script is promoted to a reusable tool. [spike.py]
- **No enforced Gemini timeout:** AC1 documents the 60-second expectation but the Gemini call has no programmatic timeout. Add request timeout in the production `agent.py` (Story 2.2). [spike.py]
- **Raw LLM response not persisted:** On a successful run the raw JSON string from Gemini is discarded. Consider writing it alongside the fixture for debugging variance between runs. [spike.py]
- **No markdown fence stripping:** If `response_mime_type="application/json"` fails to prevent a code-fence wrapper, `json.loads` will fail without a helpful diagnostic. Strip ` ```json … ``` ` fences as a defensive fallback in the production agent. [spike.py, agent.py Story 2.2]

## Deferred from: code review of 1-2-backend-project-scaffold (2026-05-16)

- **Duplicate vocab ID silent overwrite:** `by_id[entry.id] = entry` in `load_vocab_data` silently replaces earlier entries with identical IDs. Trusted reference data makes this low-risk for now; add a warning log or assertion in Story 2.2. [data_loader.py:load_vocab_data]
- **`ValidationResult` mutable list despite `frozen=True`:** `frozen=True` prevents attribute reassignment but not `errors.append(...)`. No external callers yet — harden the API surface (use tuple) in Story 2.2 when the validator interface stabilises. [validator.py:ValidationResult]
- **Unpinned `requirements.txt`:** All deps except `ag-ui-protocol` are unpinned. Reproducibility risk grows over time. Lock versions or add a `pip-compile`-generated lockfile when the backend dependency set stabilises. [requirements.txt]
- **Uncaught `ValueError` on malformed CSV rows:** `int(row[0])` and `int(row["Chapter"])` raise `ValueError` on bad data. Fail-fast at startup is correct for trusted reference data; add validation with a clear error message if the CSVs ever come from an external source. [data_loader.py]

## Deferred from: code review of 4-4-credits-seo-polish-and-playwright-e2e-suite (2026-05-13)

- **`/credits` route missing `errorElement`:** A render crash in CreditsRoute shows a blank page with no recovery path. CreditsRoute is static-only today so risk is very low, but consistency with other routes (which have `errorElement`) would be cleaner. Add `errorElement: <LibraryError />` when error boundaries are reviewed. [router.tsx]
- **`CreditsRoute` `document.title` strict-mode double-invoke:** React 18 strict mode runs effects twice; on second mount, `prev` has already been set to `'Credits — Nihon no Hon'`, so the cleanup restores the wrong title. Production-only effects don't double-invoke; dev-only concern. Revisit if title restoration bugs surface. [CreditsRoute.tsx]
- **CC licence version number precision:** Attribution text says "Creative Commons Attribution-ShareAlike licence" without specifying "4.0 International". Technically incomplete; correct to "CC BY-SA 4.0" before public v1 release. [CreditsRoute.tsx]
- **Duplicate E2E upload tests:** `'valid story file — reader loads'` and `'optional-fields-absent story — reader loads normally'` both upload the same fixture. Second test is retained for its difficulty-badge absence assertion, but the first sentence overlap could be trimmed.
- **Visual regression snapshot baseline drift:** Snapshot tests don't explicitly reset `localStorage` between runs. Each Playwright test gets a fresh page context so this is currently safe, but worth noting if shared-context patterns are introduced.

## Deferred from: code review of 4-3-responsive-layout-and-settingsmenu (2026-05-13)

- **Desktop right-panel tab label duplication:** Desktop tab buttons compute label via `tab.charAt(0).toUpperCase() + tab.slice(1)` rather than looking up from the `TABS` constant used by the mobile tab bar. A future label rename diverges silently between mobile and desktop. [ReaderRoute.tsx — desktop right panel tab buttons]
- **`activeTab` localStorage not validated:** Persisted `activeTab` is rehydrated without checking it's one of `'story' | 'vocabulary' | 'grammar'`. An invalid stored value causes an unknown tab state on startup. Guard belongs in preferenceStore `migrate` or `onRehydrateStorage` callback. [preferenceStore.ts]
- **No test for bottom tab bar absence on desktop:** The `lg:hidden` class is CSS-based and unverifiable in jsdom. Cover in Playwright E2E suite (Story 4.4). [ReaderRoute.test.tsx]
- **No test for story scroll restoration on tab switch:** jsdom does not implement `scrollTop` behavior. Cover in Playwright E2E suite (Story 4.4). [ReaderRoute.test.tsx]
- **`getAllByText().length > 0` assertions could be more precise:** Four ReaderRoute tests use `toBeGreaterThan(0)` instead of an exact count — acceptable given CSS-responsive dual DOM rendering but hides count regressions. Consider tightening when layout is stable. [ReaderRoute.test.tsx]

## Deferred from: code review of 4-2-grammar-panel-and-sentence-highlighting (2026-05-13)

- **Out-of-bounds SentenceModel.grammar indices silently mute all items:** If a sentence's `grammar: number[]` contains an index beyond `StoryModel.grammar.length - 1`, that index is added to `highlightedIndices` but never matches any `i`, so all items are muted despite no valid highlighted index. Silent-correct in practice (loader architecture forbids UI re-validation); address if a story authoring quality issue produces out-of-range grammar references. [GrammarPanel.tsx:17]
- **Stale selectedSentenceId (ID not in sentences prop) causes unexpected all-muted state:** When `sentences.find()` returns `undefined` (ID from store doesn't match any sentence in the prop), `activeSentence` is `null` so all items are muted even though the UI appears to have a selection. Indistinguishable from a valid empty-grammar sentence. Parent integration (Story 4.3) must pass `story.sentences` consistently; this cannot occur in correct usage. [GrammarPanel.tsx:15]
- **Empty-string grammar points render invisible list items:** A `""` entry in `StoryModel.grammar` produces a `<li>` with no visible text but real vertical height. Data quality constraint belongs in schema/loader layer; grammar point `minLength: 1` is not currently enforced by the schema. [GrammarPanel.tsx:32]

## Deferred from: code review of 4-1-vocabulary-panel-and-vocabitem (2026-05-13)

- **`isActive` word-string matching:** Two entries sharing the same `word` value (homophone across keywords and supplement lists) both render as active simultaneously. Author-controlled data makes this unlikely; address if story authoring tooling allows duplicates. [VocabItem.tsx:9]
- **`lesson: 'supplement'` assigned to keyword entries:** `toVocabEntries` labels all converted entries as `'supplement'` regardless of source; no downstream code currently branches on this field for panel entries. Revisit if keyword/supplement distinction is exposed in UI. [VocabPanel.tsx:11]
- **Two `useLookupStore` selectors in `VocabItem`:** `lookup` and `lookupState` are separate `useLookupStore()` calls, causing two re-renders per state change. Combine into a single selector or use `useShallow` if profiling identifies this as a bottleneck. [VocabItem.tsx:7-8]
- **No `aria-label` on `role="button"` div:** Screen readers concatenate all three child spans (word+reading+translation) as the button name. Explicit `aria-label` with the Japanese word would be cleaner; revisit in Story 4.4 full accessibility audit. [VocabItem.tsx:17]
- **Empty/whitespace `word` field passes silently to lookup:** `toVocabEntries` applies no guard; an empty word would render an empty InfoPanel heading. Schema/loader responsibility; add a guard if authoring tools can produce empty word fields. [VocabPanel.tsx:5]

## Deferred from: code review of 3-4-local-file-upload-and-validation (2026-05-13)

- **`saveStory` resolves before transaction commits:** `request.onsuccess` fires before `tx.oncomplete`; use `tx.oncomplete` to resolve and wire `tx.onerror`/`tx.onabort` to reject so callers get a real rejection on quota-exceeded or abort. [indexedDbService.ts:29]
- **Non-`LoaderError` from `saveStory` silently swallowed:** The `catch` block in `handleFileChange` only handles `LoaderError`; a native IDB rejection (quota, permission) is discarded with no user feedback. Add a fallback `else` branch with a generic error message. [LibraryRoute.tsx:handleFileChange]
- **Concurrent `openDb()` race:** If two callers both see `db === null` before the first open settles, each fire a separate `indexedDB.open()`. Benign today (no parallel IDB calls in current flows), but the unclosed extra connection will block future DB version upgrades.
- **`loadStory(text)` return value discarded in `handleFileChange`:** Called purely for validation; raw JSON stored via a separate `JSON.parse(text)`. Contract works correctly (IDB stores wire format; loader re-validates on read) but is non-obvious to future readers.
- **`_resetDb` exported from production module without env guard:** Test-only helper is callable from any app code. Consistent with `_resetVocab`/`_resetKanji` precedent; consider a `TEST_ONLY` comment or moving to a separate test-utils module if the pattern grows.
- **Manifest ID / UUID collision:** A library slug equal to a locally-stored UUID would shadow the local upload permanently (manifest checked first). Vanishingly unlikely given human-readable slug vs UUID formats, but worth noting before any non-slug manifest IDs are introduced.
- **`fetchManifest` called on every reader navigation:** No client-side cache; pre-existing gap. Browser cache mitigates in practice. Relevant if latency SLOs are tightened.

## Deferred from: code review of 2-5-minimum-viable-reader-route (2026-05-13)

- **`buildSupplementMap` not memoized:** Called on every render of `ReaderRoute`, allocating a new `Map` each time. Wrap with `useMemo(() => buildSupplementMap(story.vocabSupplement), [story.vocabSupplement])` before adding `React.memo` to `SentenceBlock` in a future refactor.

## Deferred from: code review of 3-3-full-story-loading-and-routing (2026-05-13)

- **`ReaderError` has no retry button:** `LibraryError` offers "Try again" via `useRevalidator`; `ReaderError` only links back to library. If `initVocab`, `initKanji`, or manifest fetch fail transiently, the user has no recovery path except navigating away. Add a retry affordance before v1 ships.
- **All non-404 loader errors produce the same generic message with no logging:** `LoaderError` (schema invalid, unsupported version), CDN 404 on story file, and `SyntaxError` from malformed JSON all show "Failed to load this story." with no distinguishing information and no `console.error`. Add error logging before production.
- **No catch-all route:** Paths like `/about`, `/credits`, or `/read/` (trailing slash, no segment) show the unstyled React Router default error UI. A root-level `errorElement` on the router would brand all unmatched paths.
- **`buildSupplementMap` synthetic IDs (-1, -2, …) can be stale in `lookupStore` across story navigations:** The lookup store is not reset on route change. If a user has a supplement word in the InfoPanel from Story A and navigates to Story B, the stale `entry` object remains until a new word is tapped. Reset `lookupStore` on loader entry or add navigation-based teardown.

## Deferred from: code review of 3-2-library-route-and-difficulty-filter (2026-05-13)

- **`parseDifficultyChapter` empty-string edge case:** A manifest entry with `difficulty: "Genki I"` (no space+chapter after the prefix) causes `parseDifficultyChapter` to return `""`, which appears as a blank `<option>` in the chapter dropdown. Requires difficulty format validation beyond type-checking in `isManifestEntry`.
- **`fetchManifest` silent invalid-entry drop:** Invalid manifest entries are filtered without a `console.warn`. Debugging manifest authoring errors in dev is harder than necessary. Add dev-mode warning before v1 ships.
- **`availableChapters` lexicographic sort:** Default `Array.sort()` puts `"Ch.10"` before `"Ch.9"`. No current impact with one story; fix with a numeric-component sort when multi-chapter sources are added.
- **Chapter select stale after revalidation:** If revalidation removes a currently-selected chapter, the `<select>` shows a stale value and the empty state is shown with no automatic reset. Reset `chapter` to `'All'` in a `useEffect` watching `availableChapters` if needed.
- **Static `<title>` not route-specific:** Library page shares the same `<title>` as all other routes. Acceptable for "basic SEO" in v1 but will need dynamic title management (e.g. `document.title` in `useEffect`) before v2 if the reader route needs a story-specific title.

## Deferred from: code review of 3-1-story-manifest-storycard-and-difficultybadge (2026-05-13)

- **`ReaderRoute` loader hardcoded:** Fetches `genki-i-ch6-tanaka-letter.json` unconditionally — will silently serve the wrong story if a second manifest entry is clicked. Story 3.3 replaces the loader body. [ReaderRoute.tsx:29]
- **`manifest.json` no build-time validation:** A hand-edit typo silently drops a story entry from the library with no developer warning. Story 3.2 adds `fetchManifest()` with `isManifestEntry` per-entry validation at runtime; a CI schema check would catch this earlier.
- **No unit tests for `isManifestEntry` type guard:** Boundary cases (non-string `difficulty`, empty `id`) are untested. Story 3.2 AC explicitly requires these tests.
- **`StoryCard` link AT name:** The accessible name of the `<Link>` is the full concatenation of title + Japanese title + description — can produce a noisy AT experience in a long list. Standard card-link pattern; consider `aria-labelledby` scoping in a future accessibility pass.
- **`filename` field coupling:** `ManifestEntry.filename` creates an implicit `id + ".json"` invariant that is not enforced anywhere. If it always equals `id + ".json"`, the field is redundant; if it can differ, the divergence is undocumented. Architectural decision in epics spec — revisit before adding non-trivially-named stories.
- **Duplicate supplement word entries silently drop:** `buildSupplementMap` iterates with index, so if `vocabSupplement` has two entries with the same `word`, the last one wins in the `Map` with no warning. Add a dedup check or dev-mode warning when building the map.
- **No `errorElement` on `/read/:storyId` route:** `loadStory()` rejection and fetch failures surface as an unhandled React crash. Epic 3 adds `ErrorBoundary` per spec — route error element must be added there.
- **`res.json()` on non-JSON 200 response throws unformatted `SyntaxError`:** CDN or proxy 200 HTML error pages produce a confusing error. Catch `SyntaxError` separately in the loader and throw a user-facing message; coordinate with Epic 3 error boundary work.
- **`loader()` body not directly unit tested:** The exported loader function is never called in `ReaderRoute.test.tsx`; tests mock `useLoaderData` only. The loader is intentionally thin (Epic 3 replaces it), but a loader integration test (mocking `fetch`) would close this gap post-Epic 3.

## Deferred from: code review of 2-4-infopanel-and-kanjibreakdown-components (2026-05-12)

- **kanjiService race:** `lookupKanji` returns null if `initKanji` hasn't resolved when `KanjiBreakdown` first mounts. Breakdown silently disappears; no re-render when map becomes available. Pre-existing architecture; revisit if kanji data is ever lazily loaded post-route.
- **Empty label span:** When `KanjiEntry.kw === null` and `m` is an empty array, `kw ?? m[0] ?? ''` emits an empty `<span>` with font metrics but no visible text. Unlikely with real kyouiku kanji data; address if data quality issues arise.
- **aria-live verbosity:** No `aria-atomic` on the InfoPanel live region — KanjiBreakdown chip text is announced alongside word/meaning/reading on each lookup update, potentially producing verbose AT readout for words with many kanji. Revisit during Story 4.4 full a11y audit.

## Deferred from: code review of 2-3-wordtoken-and-sentenceblock-components (2026-05-12)

- `WordToken` renders `<rt>` with empty string when `ruby` is null. Some screen readers may announce the empty annotation or add an awkward pause. Fix: conditionally omit `<rt>` when `ruby` is null, or add `aria-hidden` when empty. Defer until fuller a11y audit in Story 4.4.

## Deferred from: code review of 2-2-lookup-and-preference-stores (2026-05-12)

- `preferenceStore.ts` `partialize` manually enumerates all five state fields — adding a new persisted field requires remembering to update this list; a missed field silently loses persistence. Consider an `Omit<state, keyof actions>` type approach if the store grows.
- `lookupStore.lookup` accepts empty-string `word` and `sentenceId` without validation — not a concern for valid callers (loader enforces `minLength:1` via AJV), but worth a runtime guard if the service is ever called from untrusted paths.
- `usePreferenceStore` persist config has no `version` or `migrate` option — a future union change to `textSize` or `activeTab` will silently rehydrate stale values. Add a `version` and `migrate` function when either field's union is narrowed or extended.

## Deferred from: code review of 2-1-vocabulary-and-kanji-data-services (2026-05-12)

- Test-only exports (`_initVocabFromData`, `_resetVocab`, `_initKanjiFromData`, `_resetKanji`) are exported from production modules with only a naming convention as guard; no compile-time or package-boundary enforcement. Acceptable for v1; revisit if these are misused.
- `kanji-data.json` entries have a `char` field that duplicates the top-level object key — if these ever diverge (copy-paste error), `lookupKanji` returns an entry whose `entry.char` is inconsistent with the key used to retrieve it. Add a build-time consistency assertion if the file is ever regenerated.
- Duplicate `id` values in `vocab.json` would silently drop earlier entries in the `Map` constructor (`new Map(data.map(e => [e.id, e]))`). Architecture prevents this (append-only CSV, stable IDs), but a build-vocab guard would make it explicit.

## Deferred from: code review of 1-5-monorepo-pipeline-ci-and-project-scaffolding (2026-05-12)

- `eslint-plugin-boundaries` path patterns may not match when linting from workspace directory — `pattern: 'packages/*'` and `pattern: 'apps/*'` in `packages/eslint-config/index.js` require `basePath` pointing to the repo root to resolve correctly; without it the boundary rules may silently never fire. Investigate and add `basePath` configuration in a follow-up.
- `scripts/build-vocab.ts` uses `process.cwd()` instead of `import.meta.url` — intentional design choice for turbo root task context; if ever run outside turbo (e.g., directly via `tsx`), paths will break. Low risk while turbo manages the task.
- Header row safety in `scripts/build-vocab.ts` — no skip logic if `scripts/data/genki-vocab.csv` ever gains a header row; headerless format is intentional. Add a guard when format changes.
- `buildVocab.test.ts` reads `vocab.json` at module scope — produces an opaque ENOENT crash if the file is missing. Acceptable within turbo pipeline (enforced by `dependsOn: build-vocab`); refactor to `beforeAll` if running tests outside turbo becomes common.
- `@typescript-eslint` v7 + TypeScript 5.5 — resolved v7.18.0 supports TypeScript 5.5; monitor if upgrading TypeScript past 5.5 triggers compatibility issues before moving to `@typescript-eslint` v8.

## Deferred from: code review of 1-4-web-app-scaffold (2026-05-11)

- No ESLint config in `apps/web` — `apps/web/package.json` declares `"lint": "eslint ."` and depends on `@nihonnohon/eslint-config`, but no `.eslintrc.*` or `eslint.config.*` exists; `turbo lint` will fail for this package. Full eslint wiring (including `eslint-plugin-boundaries`) is Story 1.5 scope.

## Deferred from: code review of 1-3-story-loader-package (2026-05-11)

- `vocab_keys` values not bounds-checked against `vocab_supplement` array length — semantic validation out of scope for loader; Story 2 components handle safe indexing.
- `sentence.grammar` indices not bounds-checked against `StoryModel.grammar` array — grammar panel (Story 4.2) handles out-of-range indices gracefully.
- Duplicate `sentence.id` values not checked for uniqueness — not required by AC3; relevant when navigation by id is implemented.
- No `ajv-formats` plugin for URI validation of `audio_url` — audio_url stored but not played in v1; URI validation belongs with the audio feature.
- No `sourcemap: true` in `packages/story-loader/tsup.config.ts` — add alongside schema package when debugging compiled outputs becomes needed.
- AJV `validate.errors` mutation not concurrency-safe — loader is synchronous; not a concern until async refactor.

## Deferred from: code review of 1-2-schema-package-and-story-format-contract (2026-05-11)

- `story-loader/package.json` `main`/`types` still point at `./src/index.ts` — same class of fix as schema package; Story 1.3 must update to `./dist/` paths before the loader is consumable from built contexts.
- `apps/web` has no declared `@nihonnohon/schema` workspace dependency — Story 1.4 adds it when apps/web scaffold is created.
- `audio_url` has no URI format validation in `story.v1.json` — audio playback is out of scope for v1; add `"format": "uri"` when audio feature is implemented.
- No `sourcemap: true` in `packages/schema/tsup.config.ts` — optional quality-of-life improvement; add if debugging compiled outputs becomes needed.
- `ruby`/`words` parallel array length not enforced in JSON Schema — Draft-07 cannot enforce cross-field array equality; story-loader (Story 1.3) must validate mismatched parallel array lengths and throw `LoaderError('SCHEMA_INVALID', ...)`.



## Deferred from: code review of 1-1-monorepo-initialization (2026-05-11)

- Package `exports` map in `packages/schema` and `packages/story-loader` points to non-existent `dist/index.{mjs,js,d.mts,d.ts}` — placeholder shape for Story 1.2/1.3 tsup build; consumers cannot resolve these packages under Node ESM resolution until tsup builds them.
- Turbo tasks (`build`, `dev`, `lint`, `typecheck`) are no-ops on the empty package and app stubs — actual scripts added in Stories 1.2–1.5. Risk: silent success masks real failures during this scaffold-only state.
- ESLint config (`packages/eslint-config`) uses legacy CommonJS `.eslintrc`-style. Won't work with ESLint 9 flat config; lacks `eslint` peer dependency. Spec defers full config (including `eslint-plugin-boundaries`) to Story 1.5.
- `.gitignore` missing common ignore entries that will be needed later: `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `.eslintcache`. Add when Story 1.4 introduces Vitest and Story 1.5 introduces Playwright.
- `packages/typescript-config/base.json` uses `module: ESNext` + `moduleResolution: bundler`. This is correct for Vite/tsup consumers but won't suit `apps/api` Node runtime when it's implemented. Decision: add a separate `node.json` preset or accept the compromise — defer until apps/api is real.
- `packages/typescript-config/react-library.json` extends base but declares no React peer dep contract — any consumer (currently only the future apps/web) must supply `react` and `@types/react` themselves. Story 1.4 concern.
- `turbo.json` task is named `typecheck` while the spec's Dev Notes parenthetically referenced `check-types` as the default scaffold name. Both root `package.json` scripts and `turbo.json` are internally consistent with `typecheck`. Spec is permissive — no rename needed.


## Deferred from: code review of 3-3-english-proposal-review-and-convert-to-japanese (2026-05-19)

- **"Convert to Japanese" not disabled when backend unavailable:** ProposalPanel doesn't read `backendStatus`; inconsistent with InputPanel's Generate button guard. Acceptable for v1 since error recovery (restoring to proposal on failure) works correctly. [ProposalPanel.tsx]
- **Collapsed summary blank if storedInputs is null in proposal phase:** Only reachable via direct store manipulation; normal UX flow always creates storedInputs before entering proposal via generate(). [InputPanel.tsx]
- **useSession discards proposalText on stale-phase restore:** Intentional — Story 3.4 will add `proposalText` to `SessionState` and remove 'proposal' from STALE_PHASES. [useSession.ts]
- **"Regenerate" lacks aria-label distinguishing it from InputPanel's "Generate":** Low a11y gap; defer to accessibility pass. [ProposalPanel.tsx]

## Deferred from: code review of 3-4-story-length-settings-and-path-b-session-restore (2026-05-19)

- **No upper-bound on `target_word_count` in backend:** Frontend enforces max 1000 via `Math.min(v, MAX_TARGET_WORD_COUNT)` but a direct API call can pass any integer. Acceptable for v1 local-only use. [main.py]
- **`target_word_count` included in phase 2 SSE URL:** When `approve()` fires the Japanese conversion, `target_word_count` is still in the URL params even though the backend ignores it in phase 2. Harmless but could add a comment clarifying it's phase-1-only. [useAgUiRun.ts]
- **En-dash in default length hint:** `"~150–300 words"` uses Unicode en-dash (–) while the rest of the prompt uses hyphen-minus. Cosmetic inconsistency. [agent.py]
- **`isClearedState` check does not include `topicText`:** Pre-existing issue; not introduced by this story. The cleared-state detection could be audited for completeness. [useSession.ts]
