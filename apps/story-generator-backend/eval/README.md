# Story-generation eval set

A benchmark for the three quality dimensions we want to improve in the story-generation
backend: **word segmentation**, **dictionary-form derivation**, and **ruby (furigana)
extraction**. See [`docs/story-generation-pipeline.md`](../../../docs/story-generation-pipeline.md)
for how these fit the current pipeline.

## Design decisions

- **Benchmark input is frozen Japanese.** Each gold sentence has a fixed `ja` string, authored
  and human-verified at **sentence granularity** — that's the right granularity for curation and
  diagnostics (per-sentence `id`/`en`/review). Japanese text is non-deterministic across
  generations, so fixing it is the only way to get a reproducible, comparable benchmark for these
  three per-word properties. Translation quality (English → which Japanese) is deliberately
  **out of scope** here — measure that separately.
- **Adapter-invocation granularity is the whole story, not the sentence.** The harness joins a
  story's gold sentences into one continuous string and calls the adapter **once per story** —
  matching production, where `generate()` sends Stage 2 the entire story as one Gemini call, with
  no join/split logic anywhere in `agent.py`. Calling per-sentence instead would hand the adapter
  pre-isolated sentence boundaries for free and never exercise its actual ability to split
  continuous prose — exactly what production has to do. Both adapters (`sudachi-baseline` and
  `gemini-analysis`) go through the identical whole-story protocol, keeping the comparison fair.
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
  gold/                              # frozen ground truth — 10 Genki stories (VERIFY before trusting)
    eval-genki4-day-out.json         #   one file per story (chapters 4,6,8,10,12,14,16,18,20,22);
    ...                              #   pass the gold/ directory to run and aggregate all 10 at once
    eval-genki22-raising-children.json
  run_eval.py                        # harness: scoring, CLI, run-logging, adapter dispatch
  adapters/
    __init__.py                      # Adapter type alias + ADAPTERS registry {name: factory}
    sudachi_baseline.py              # sudachi-baseline: SudachiPy for both steps (offline)
    gemini_analysis.py               # gemini-analysis: current production pipeline
  results/                           # gitignored — timestamped {raw,metrics} run archives
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

Because the full-story `ja` is fixed, the system's output and the flattened gold word list are
both partitions of the **same** string, so the harness aligns them by character offset across the
whole story. This separates segmentation errors from annotation errors:

- **Segmentation** — micro-averaged boundary precision / recall / F1 over internal cut points,
  plus per-sentence exact match.
- **Dictionary form** — over gold content words. `accuracy_strict` counts a segmentation
  boundary miss as wrong; `accuracy_aligned` scores only boundary-matched tokens (isolates
  dict-form quality from segmentation).
- **Ruby** — same strict/aligned split, over gold tokens containing kanji.

Sentence-boundary correctness is **not** a separate metric — it falls out automatically as a
subset of word-boundary correctness. A gold sentence's final token always ends in `。`/`？`, which
already produces a boundary at that sentence's end offset in the flattened gold boundary set; if
the predicted output also has a boundary there, that's a correctly-identified sentence split, with
zero extra bookkeeping. `sentence_exact_match` is derived the same way: for each gold sentence's
known `[start, end)` offset range in the full story, the harness checks whether the predicted
spans exactly tile that range with matching surfaces — no reliance on the adapter reporting its
own sentence boundaries.

## Running

```bash
# from apps/story-generator-backend (needs sudachipy + jamdict installed)
python eval/run_eval.py                                    # default gold, sudachi-baseline, offline
python eval/run_eval.py eval/gold/other.json
python eval/run_eval.py eval/gold/                          # directory: aggregate every *.json inside
python eval/run_eval.py --adapter gemini-analysis           # current production pipeline (needs GEMINI_API_KEY)
python eval/run_eval.py --out-dir /tmp/eval-results         # custom result-file directory
```

`--adapter` selects the system under test from the `ADAPTERS` registry (`eval/adapters/`);
`sudachi-baseline` is the default and stays fully offline — no key, no network. Only the chosen
adapter is ever built, so selecting the default never touches `GEMINI_API_KEY` or the network.

The positional `gold` argument accepts either a single gold JSON file (unchanged behavior) or a
directory — resolved with a non-recursive `*.json` glob, sorted for deterministic ordering, and
scored per-file with results aggregated across the whole set. A directory with no matching `*.json`
files is a clear CLI error, not a silent empty run.

- **`sudachi-baseline`** (`eval/adapters/sudachi_baseline.py`) — SudachiPy for **both**
  segmentation and enrichment. Reference-only; not the production system.
- **`gemini-analysis`** (`eval/adapters/gemini_analysis.py`) — the **current production
  pipeline**: drives `StoryGeneratorAgent._run_stage2_analysis` — the exact seam `generate()`
  itself calls for Stage 2 — so the prompt text, model, and `GenerateContentConfig`
  (temperature fixed at `STAGE2_TEMPERATURE`, thinking budget, streaming) are byte-for-byte what
  production sends, not a re-implementation. `target_chapter` is always `None`: this matches the
  *only* Path-C
  ("Japanese story") UI configuration that leaves the pasted Japanese unmodified — choosing
  "Unspecified" skips Stage 1 entirely, while any real chapter runs Stage 1's JA→JA rewrite
  first, which would mean Stage 2 is no longer analysing the frozen gold `ja` this harness
  scores against. `EnrichmentPipeline.enrich_sentence` then derives dict form / ruby / POS per
  surface word — the same enrichment layer `sudachi-baseline` uses, so the two adapters differ
  only in *who segments*. Requires `GEMINI_API_KEY` (loaded from a repo `.env` via
  `python-dotenv`); raises a clear `RuntimeError` if missing.

### Run archiving

Every run writes two timestamped, provenance-tagged JSON files into `--out-dir` (default
`eval/results/`, gitignored — these are run artifacts, not committed):

- **`{timestamp}__{gold_id}__{adapter}__raw.json`** — one record per gold **sentence**, each
  tagged with `story_id` and offset-bucketed from that story's single whole-story adapter call
  (a predicted word belongs to whichever gold sentence's range its start offset falls in — a
  read-only grouping for readability, not a re-split of the adapter's actual output).
- **`{timestamp}__{gold_id}__{adapter}__metrics.json`** — the aggregated `score()`/`aggregate()`
  output, with a `per_story` breakdown keyed by each story's `id`.

Both share a `run` metadata block: `started_at`, `adapter`, `adapter_module`, `git_commit`
(`git rev-parse HEAD`, falling back to `"unknown"` — a run never fails because of git),
`gold_id`, `gold_path`, `n_sentences`, and `model` (the Gemini model for `gemini-analysis`,
`null` for `sudachi-baseline`). This makes the raw output reproducible from its recorded commit
and lets aligned-vs-strict metric gaps be attributed to LLM segmentation vs SudachiPy
segmentation directly, across archived runs.

For a single-file run, `gold_id` is that story's `id` and `gold_path` is a plain string, exactly
as before. For a directory run aggregating N stories, `gold_id` is synthesized as
`{directory_name}[{N} stories]` and `gold_path` is a **list** of every resolved gold file path
(not a single string) — code reading `run_meta.gold_path` programmatically must handle both
shapes. `metrics.json`'s top-level `per_story` key is new: each entry is a full per-story
`score()` result (rates, `per_sentence`, and `counts`), keyed by that story's `id`.

### Adding a system-under-test

An adapter is any `Callable[[str], list[dict]]` returning `{surface, dict, ruby, pos?}` per word.
Add a factory to `eval/adapters/`, import `story_generator.*`/`google.genai` **lazily inside the
factory** (never at module top, so the registry import stays cheap and offline), and register it
in `ADAPTERS` (`eval/adapters/__init__.py`):

- **Agentic system** — whatever the new approach exposes, as long as it maps `ja → annotations`.

## Baseline snapshot (SudachiPy adapter)

Measured over the full **10-story** benchmark (`eval/gold/` — 100 sentences, 442 content
words, 287 kanji words), whole-story protocol (one adapter call per story, matching
production's call granularity). SudachiPy is deterministic — 4 repeat runs were byte-identical,
so a single row stands for all of them:

| Metric | Value |
|--------|-------|
| Segmentation boundary P / R / F1 | 0.808 / 1.000 / 0.894 |
| Segmentation sentence exact-match | 0.170 |
| Dictionary form (aligned) | 0.997 |
| Dictionary form (strict) | 0.663 |
| Ruby (aligned) | 0.866 |
| Ruby (strict) | 0.606 |

The gap between *aligned* and *strict* is almost entirely segmentation: recall is a perfect
1.000 — SudachiPy never *misses* a gold boundary — but precision is only 0.808 because it
**over-splits** relative to the gold convention (e.g. it splits です off adjectives and polite
-ます endings off stems). That over-segmentation is why only 17% of sentences tile exactly even
though the annotations of the boundary-matched tokens are near-perfect (dict 0.997, ruby 0.866
aligned). This is exactly the segmentation signal the eval is meant to surface.

## Production-pipeline snapshot (gemini-analysis adapter)

Driven through the exact production seam (`StoryGeneratorAgent._run_stage2_analysis`,
byte-identical prompt/model/config to `generate()`) at the current production
`STAGE2_TEMPERATURE = 0.2`, over the full **10-story** benchmark. `STAGE2_TEMPERATURE` is fixed
at 0.2 in `agent.py`, decoupled from the user-facing generation-temperature slider (which only
affects Stage 1's prose) — the se3-6 fix, made because segmentation and grammar tagging are
structural tasks, not creative ones, and the model followed the prompt's own segmentation rules
far more reliably at low temperature.

**Stage-2 segmentation still has real run-to-run variance even at this low temperature — a
single run is not representative**, so we report 4 repeat runs (`eval/results/` is gitignored —
this table is the only record):

| Run | boundary F1 | sentence exact | dict (aligned) | dict (strict) | ruby (aligned) | ruby (strict) |
|---|---|---|---|---|---|---|
| 1 | 0.842 | 0.360 | 0.941 | 0.609 | 0.852 | 0.561 |
| 2 | 0.876 | 0.440 | 0.909 | 0.658 | 0.849 | 0.606 |
| 3 | 0.960 | 0.540 | 0.938 | 0.787 | 0.873 | 0.746 |
| 4 | 0.899 | 0.430 | 0.943 | 0.676 | 0.863 | 0.659 |
| **mean** | **0.894** | **0.443** | **0.933** | **0.682** | **0.859** | **0.643** |
| **spread** | 0.842–0.960 | 0.360–0.540 | 0.909–0.943 | 0.609–0.787 | 0.849–0.873 | 0.561–0.746 |

Two of the four runs (runs 1 and 4) had a single story return an empty Stage-2 response —
recorded as an all-miss story per the error-resilience design below, not dropped — which drags
those runs' strict metrics and the means down. Even at `temperature=0.2`, a lone run can still
fail outright, so multi-run evaluation remains the honest way to report these numbers.

Against the deterministic `sudachi-baseline` (boundary F1 0.894, sentence-exact 0.170),
gemini-analysis's whole-story segmentation is more variable but reaches a materially higher
ceiling — boundary F1 up to 0.960 and sentence-exact up to 0.540. Both adapters share the
identical enrichment layer, so the remaining dict/ruby differences trace back to *who segments*,
not to enrichment.

## Extending

- Add more stories as `gold/<id>.json` (same shape). The harness takes a gold path argument —
  point it at a single file, or at the `gold/` directory itself to run and aggregate the whole
  benchmark in one call (`python eval/run_eval.py eval/gold/`) once more stories exist.
- Keep the append-only spirit: correct entries in place, do not renumber sentence `id`s.
- When adding non-Genki-6 stories, note the chapter so segmentation/vocab expectations are clear.
- Each gold file's `id` must be unique across the set — `run_eval.py` errors on a duplicate
  `story_id` when aggregating a directory (avoids a silent `per_story` key collision).
