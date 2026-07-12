# ADR 006: Python-Side Tokenization and Vocabulary Enrichment

**Status:** Accepted
**Date:** 2026-06-04

## Context

The story generator backend asks Gemini to produce a complete `story.v2.json`-compliant
object in a single LLM call. Among other things, this requires the model to:

1. Translate the English source into natural Japanese
2. Segment the Japanese into pedagogically useful word units
3. Annotate each kanji with correct inline furigana (`漢字[よみ]` format per ADR 005)
4. Assign a Genki curriculum vocab key to each word that appears in the curriculum
5. Build a `vocab_supplement` array for words outside the curriculum, with correct key
   offsets and accurate English definitions

Steps 4 and 5 require the model to maintain a strict parallel array invariant between
`words[]` and `vocab_keys[]`. In practice the model frequently miscounts, assigns wrong
keys, or omits entries from `vocab_supplement`, causing the story to fail validation and
requiring a retry or manual correction.

Additionally, furigana readings are recalled from training data rather than looked up
deterministically, so occasional incorrect readings appear — particularly for less common
kanji or context-dependent readings.

### What the LLM does well vs. what it does poorly

| Task | LLM suitability |
|---|---|
| Translate English → natural Japanese | Excellent |
| Choose pedagogically appropriate vocabulary | Excellent |
| Segment sentences into learner-friendly word units | Good with clear instructions |
| Annotate kanji with correct readings | Acceptable but not deterministic |
| Map words to curriculum keys in a parallel array | Poor — frequent count errors |
| Build vocab_supplement with correct key offsets | Poor — frequently incomplete |

The LLM is being asked to do both creative and clerical tasks simultaneously. The clerical
tasks (parallel array construction, dictionary lookups) are the source of nearly all
validation failures.

### Available tools

**SudachiPy** (Apache 2.0) is a production-quality Japanese morphological analyser with
a Rust backend and Python bindings. Given a Japanese word string, it returns:
- The reading (katakana, convertible to hiragana)
- The dictionary (lemma) form — e.g. `食べます` → `食べる`, `勉強して` → `勉強する`
- A detailed part-of-speech tuple including verb conjugation type

**Genki vocab CSV** (`resources/genki1vocab.csv`) contains 1,172 entries (IDs 1–1172)
covering Genki I and II vocabulary through chapter 23. Each entry has a unique row ID,
hiragana reading(s), optional kanji form, English definition, and chapter number.

**jamdict** (MIT) wraps JMdict — the canonical open Japanese-English dictionary — in a
Python API. Provides fallback definitions for words outside the Genki curriculum.

Together these tools can deterministically produce everything currently delegated to the
LLM for steps 3–5.

### Options considered

**Option A — Prompt engineering only**
Invest more effort in the Gemini prompt: more examples, stricter output constraints,
chain-of-thought on the parallel array construction. This has been the approach to date.
Improvements are incremental; the root cause (counting in long parallel arrays) is
a known LLM weakness that prompting does not reliably fix.

**Option B — Full Python tokenization**
Remove the LLM from word segmentation entirely. Use SudachiPy to tokenize the Japanese
sentence and merge morphemes into word units using grammatical rules (e.g. attach polite
verb endings to stems). This removes the LLM from a task it does well — choosing
semantically appropriate word boundaries for a learner — and requires complex post-
processing rules to recover pedagogical segmentation.

**Option C — Hybrid: LLM for translation and segmentation, Python for enrichment**
The LLM translates and segments; Python does everything else. Specifically:
- LLM returns: `[{english, japanese, words: [surface strings]}]`
- Python computes: furigana, dictionary forms, POS codes, Genki key mapping,
  vocab_supplement construction

This preserves what the LLM does well (language and pedagogy) while eliminating its
involvement in the tasks it does poorly (parallel array bookkeeping).

## Decision

Adopt **Option C**.

The LLM prompt is simplified to request only sentences plus a word boundary list. After
receiving the response, a new `EnrichmentPipeline` class in `enrichment.py` processes
each word using SudachiPy, the Genki vocab index, and jamdict to produce all derived
fields deterministically.

### Furigana generation

Each word string from Gemini is tokenised by SudachiPy (split mode C). For each
morpheme, the reading is obtained and then the okurigana (trailing kana matching between
surface and reading) is stripped before bracketing — so only the kanji span is annotated:

```
食べます  →  食[た]べます      (not 食べます[たべます])
勉強する  →  勉強[べんきょう]する
帰って    →  帰[かえ]って
```

By default, furigana is added only on the **first occurrence** of each dictionary form
across the full story (standard Japanese publishing practice). All occurrences can be
annotated via a flag.

### Vocabulary key assignment

After enriching each word, keys are assigned as follows:

- If the word's `dictionary_form` matches a Genki CSV entry (checked by kanji form
  first, then kana reading; first occurrence in the CSV wins on duplicates) →
  `vocab_keys[i]` = the Genki row ID (1–1172)
- If the word is a content word with no Genki match → assigned a key ≥ 10000; an entry
  is added to `vocab_supplement`; the same key is reused for repeated occurrences
- Particles, auxiliaries, and punctuation → `vocab_keys[i]` = `null`

This makes the parallel array invariant a guaranteed property of the pipeline output,
not a constraint placed on the LLM.

### POS codes

A simplified JMdict-compatible set derived from SudachiPy's conjugation type field:

| Code | SudachiPy source |
|---|---|
| `v1` | `*一段-*` conjugation type |
| `v5` | `五段-*` conjugation type |
| `v-irr` | `サ行変格` / `カ行変格`; also 名詞+する compounds |
| `adj-i` | `形容詞` major POS |
| `adj-na` | `形状詞` major POS |
| `adv` | `副詞` |
| `pron` | `代名詞` |
| `conj` | `接続詞` |
| `pref` | `接頭辞` |
| `suff` | `接尾辞` |
| `prt` | `助詞` |
| `n` | `名詞` (not a suru-verb compound) |

POS codes are stored as an optional `pos` field on `vocab_supplement` entries, alongside
an optional `dictionary_form` field. Both are additive to the existing `vocabEntry`
schema — no version bump.

### Segmentation validation

After receiving Gemini's word list, Python verifies:

```python
"".join(w for w in words) == japanese_sentence
```

A mismatch indicates malformed segmentation and triggers a retry. This is the primary
reliability safeguard and replaces the parallel array validator as the first line of
defence.

### Reference implementation

`apps/story-generator-backend/dev/tokenize_prototype.py` is a self-contained prototype
demonstrating the full pipeline with a hardcoded test story. It was developed and
validated prior to writing this ADR and serves as the reference for `enrichment.py`.

## Consequences

- **Parallel array invariant is guaranteed by construction.** Validation failures caused
  by LLM miscounting are eliminated.
- **Furigana is deterministic.** Readings come from SudachiPy's morphological dictionary,
  not LLM recall. First-occurrence suppression is mechanical.
- **Genki definitions are authoritative.** Definitions for curriculum vocabulary come
  directly from the Genki CSV; JMdict provides accurate fallbacks for other words.
- **LLM prompt is simpler and more focused.** Removing the clerical tasks makes the
  prompt shorter and the model's creative task clearer.
- **New runtime dependencies.** The backend requires `sudachipy`, `sudachidict-core`
  (~70 MB), `jamdict`, and `jamdict-data-fix` (Windows) or `jamdict-data` (Linux).
  SudachiPy's dictionary initialisation (~1–2 s) must happen at app startup, not
  per-request.
- **Gemini CSV is a stable contract.** Vocab keys 1–1172 are row IDs. The CSV must be
  treated as append-only; reordering would silently corrupt all story files.
- **Word segmentation is still LLM-dependent.** If Gemini segments poorly, furigana and
  vocab lookups operate on the wrong units. The segmentation prompt and the join-equality
  guard are the main levers for this.
- **Existing stories are unaffected.** The schema change is purely additive (optional
  `pos` and `dictionary_form` on `vocab_supplement` entries). All committed story files
  remain valid without migration.
