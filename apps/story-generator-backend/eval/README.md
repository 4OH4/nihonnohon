# Story-generation eval set

A benchmark for the three quality dimensions we want to improve in the story-generation
backend: **word segmentation**, **dictionary-form derivation**, and **ruby (furigana)
extraction**. See [`docs/story-generation-pipeline.md`](../../../docs/story-generation-pipeline.md)
for how these fit the current pipeline.

## Design decisions

- **Benchmark input is frozen Japanese.** Each gold sentence has a fixed `ja` string. The
  system under test receives `ja` and must reproduce the segmentation, dictionary forms, and
  ruby. Japanese text is non-deterministic across generations, so fixing it is the only way to
  get a reproducible, comparable benchmark for these three per-word properties. Translation
  quality (English → which Japanese) is deliberately **out of scope** here — measure that
  separately.
- **The system under test is a black box.** The harness only compares its `ja → annotations`
  output to gold. It makes **no assumption** that segmentation and enrichment are separate steps,
  so it works for the current LLM-split + SudachiPy pipeline and for a future agentic system that
  may fuse or eliminate the enrichment step.
- **Ground truth is a slim, per-word projection** — not a full v2 story JSON. It carries only the
  fields relevant to the three targets, anchored to their sentence for context.
- **Gold is authored by an AI model directly** (sentence-by-sentence), then human-verified —
  *not* seeded from the enrichment pipeline, which would bake in the very errors we are measuring.

## Files

```
eval/
  gold/eval-genki6-daily-life.json   # frozen ground truth (VERIFY before trusting)
  run_eval.py                        # scoring harness + reference baseline adapter
  README.md
```

## Gold format

```jsonc
{
  "id": "eval-genki6-daily-life",
  "chapter": 6,
  "english_source": "...",           // kept for context; not scored
  "conventions": { ... },            // self-documenting field notes
  "sentences": [
    {
      "id": "s01",
      "ja": "私は毎朝六時に起きます。",   // FROZEN benchmark input
      "en": "I get up at six every morning.",  // context; not scored
      "words": [
        { "surface": "私", "dict": "私", "ruby": "私[わたし]", "pos": "pron" },
        { "surface": "起きます", "dict": "起きる", "ruby": "起[お]きます", "pos": "v1" },
        ...
      ]
    }
  ]
}
```

Per word:

| Field | Scored? | Meaning |
|-------|---------|---------|
| `surface` | **yes** (segmentation) | The token; `"".join(surface)` must equal `ja`. |
| `dict` | **yes** (content words) | Dictionary/lemma form of the token's head word. |
| `ruby` | **yes** (kanji tokens) | `kanji-run[reading]`, okurigana bare; canonical per-word (no first-occurrence suppression). Pure-kana tokens repeat the surface. |
| `pos` | no | `pron n v1 v5 v-irr adj-i adj-na adv conj prt aux punct` — used only to scope metrics. |

## Scoring

Because `ja` is fixed, the system's output and the gold are both partitions of the **same**
string, so the harness aligns them by character offset. This separates segmentation errors from
annotation errors:

- **Segmentation** — micro-averaged boundary precision / recall / F1 over internal cut points,
  plus per-sentence exact match.
- **Dictionary form** — over gold content words. `accuracy_strict` counts a segmentation
  boundary miss as wrong; `accuracy_aligned` scores only boundary-matched tokens (isolates
  dict-form quality from segmentation).
- **Ruby** — same strict/aligned split, over gold tokens containing kanji.

## Running

```bash
# from apps/story-generator-backend (needs sudachipy + jamdict installed)
python eval/run_eval.py                     # default gold, SudachiPy baseline adapter
python eval/run_eval.py eval/gold/other.json
```

The bundled `sudachi-baseline` adapter uses SudachiPy for **both** segmentation and enrichment.
It runs offline (no API key) and exists to exercise the harness — it is *not* the production
system, which currently segments with the LLM.

### Adding a system-under-test

An adapter is any `Callable[[str], list[dict]]` returning `{surface, dict, ruby, pos?}` per word.
Add one and wire it into `main()`:

- **Current production pipeline** — a Gemini call that segments the given `ja` under the prompt's
  segmentation rules, then `EnrichmentPipeline.enrich_sentence`. (Needs `GEMINI_API_KEY`.)
- **Agentic system** — whatever the new approach exposes, as long as it maps `ja → annotations`.

## Baseline snapshot (SudachiPy adapter)

First run against the unverified gold, for reference:

| Metric | Value |
|--------|-------|
| Segmentation boundary F1 | 0.889 |
| Segmentation sentence exact-match | 0.000 |
| Dictionary form (aligned) | 1.000 |
| Dictionary form (strict) | 0.610 |
| Ruby (aligned) | 0.895 |
| Ruby (strict) | 0.515 |

The gap between *aligned* and *strict* is almost entirely segmentation: SudachiPy's word
boundaries differ from the gold convention (e.g. it splits です off adjectives and うます-endings
off stems), so no sentence matches exactly even though the annotations of matched tokens are
near-perfect. This is exactly the segmentation signal the eval is meant to surface.

## Extending

- Add more stories as `gold/<id>.json` (same shape). The harness takes a gold path argument.
- Keep the append-only spirit: correct entries in place, do not renumber sentence `id`s.
- When adding non-Genki-6 stories, note the chapter so segmentation/vocab expectations are clear.
