# Story se3.6: Eval Adapter for Stage 2 + Modular Adapters and Run Logging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **backend developer**,
I want the **Stage-2 analysis prompt wired into the eval harness as a selectable production adapter**,
the harness's **adapters split into their own modules**, and **every run recorded to timestamped result
files** (raw system-under-test output + metrics, tagged with the adapter and git commit),
so that segmentation / dictionary-form / ruby quality of the real pipeline (LLM segmentation +
`EnrichmentPipeline`) can be **benchmarked and the results archived reproducibly** against the frozen
gold and the `sudachi-baseline` snapshot **before the agentic-quality epic begins**.

## Context

This is the **final, optional story of supp-epic-3** (Staged Generation Pipeline). All of se3-1…se3-5
are **done and merged**: se3-3 shipped `build_japanese_analysis_prompt` (the single, universal Stage-2
prompt) and se3-4 wired it into a two-stage `generate()`. The epic's stated payoff is that Stage 2 is
now **one reusable, benchmarkable unit** that "maps directly onto the frozen-input eval harness
(`apps/story-generator-backend/eval/`, `ja → annotations`)". **This story delivers that mapping and
makes the harness a durable benchmarking tool.**

The eval harness (`eval/run_eval.py`, committed in `76f41e8`) is a black-box benchmark: an **adapter**
is any `Callable[[str], list[dict]]` that receives a frozen Japanese sentence and returns one
`{surface, dict, ruby, pos?}` dict per word. It ships **one** adapter today — `sudachi-baseline`
(SudachiPy for *both* segmentation and enrichment, offline, no API key). This story:

1. **Adds a second adapter — `gemini-analysis`** — reproducing the **production** path: Gemini segments
   the sentence under the Stage-2 prompt's Word Segmentation Rules, then
   `EnrichmentPipeline.enrich_sentence` derives dict form / ruby / POS per surface word.
2. **Extracts the adapters into their own modules** (`eval/adapters/`), leaving `run_eval.py` as the
   pure harness (scoring, CLI, run logging, adapter dispatch).
3. **Records every run** — the adapter under test and the current git commit — and **writes two
   timestamped result files** per run (raw SUT output + metrics), so benchmark runs are archived and
   comparable over time.

**Why this matters:** the README already names the `gemini-analysis` adapter as the missing "current
production pipeline" system-under-test (`eval/README.md:96-97`). With it — and with archived,
provenance-tagged result files — the aligned-vs-strict metric gap attributes quality differences to
**LLM segmentation** vs SudachiPy segmentation directly, and each run is reproducible from its recorded
commit. This is precisely the signal and the paper-trail the agentic epic will optimise against.

Full epic:
[`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)
(Story se3-6; §"Stage 2 is a single universal prompt" — "This prompt is also the production adapter for
the eval harness"; §Verification step 3).

> **A small refactor + additive harness features.** You (a) move the existing baseline adapter into a new
> `eval/adapters/` package **verbatim**, (b) add the new `gemini-analysis` adapter beside it, and (c) add
> run-provenance capture + two result-file writers to `run_eval.py`. You touch **no** production code
> (`story_generator/*`), **no** gold data, and **no** scoring math (`score`, `_spans`,
> `_internal_boundaries`). The non-obvious risks: keeping the **default** run offline (no key, no
> network), and invoking each adapter **exactly once** per sentence (the gemini adapter costs a network
> call per sentence — see Dev Notes → "Capture raw output without invoking the adapter twice").

## Acceptance Criteria

1. **AC1 — Adapters live in their own `eval/adapters/` package; the baseline is moved verbatim**
   A new package `apps/story-generator-backend/eval/adapters/` is created with:
   - `sudachi_baseline.py` — `make_sudachi_baseline_adapter` **moved from `run_eval.py` unchanged**
     (same body, same offline behaviour, same field mapping).
   - `gemini_analysis.py` — the new `make_gemini_analysis_adapter` (AC2–AC4).
   - `__init__.py` — exposes the `Adapter` type alias and an `ADAPTERS: dict[str, Callable]` registry
     mapping `"sudachi-baseline"` / `"gemini-analysis"` → their factory functions.
   `run_eval.py` imports `Adapter` and `ADAPTERS` from `adapters` and **no longer defines any adapter
   itself**; it keeps the scoring, reporting, CLI, and (new) run-logging code. Each adapter module
   imports `story_generator.*` and `google.genai` **lazily inside its factory** (never at module top),
   so importing the registry stays cheap and offline.

2. **AC2 — `gemini-analysis` adapter builds the Stage-2 prompt on the frozen `ja` and makes one real Gemini JSON call**
   `make_gemini_analysis_adapter(target_chapter: int | None = None, *, caller=None, pipeline=None,
   grammar_data=None) -> Adapter` returns an adapter that, per `ja`, calls
   `build_japanese_analysis_prompt(grammar_data, ja, target_chapter=<target>, steering_instructions="")`
   (imported from `story_generator.agent`), then issues a **blocking** Gemini call using the **same
   model** (`GEMINI_MODEL`, imported from `story_generator.agent` — do not hardcode) with
   `response_mime_type="application/json"`. It parses the response with `json.loads` and extracts the
   `words` surface list by **flattening `words` across every returned sentence**
   (`[w for s in data["sentences"] for w in s.get("words", [])]`) — the prompt returns full-story JSON
   `{id, title, …, sentences:[{english, japanese, words, grammar}]}`, **not** a flat word list, and may
   split the input into ≥1 sentences.

3. **AC3 — Enrichment and output mapping are identical to the baseline's per-word contract**
   The adapter calls `pipeline.enrich_sentence(words, seen_dict_forms=None)` on the flattened surface
   words and returns, per word, `{"surface": <word>, "dict": e["dictionary_form"], "ruby":
   e["annotated"], "pos": e["pos_code"]}` — the **same** field mapping the baseline uses.
   `seen_dict_forms` **must be `None`** (annotate every kanji word) because the gold ruby is **canonical
   per-word with first-occurrence suppression NOT applied**
   ([gold `conventions.ruby`](../../apps/story-generator-backend/eval/gold/eval-genki6-daily-life.json#L9)).

4. **AC4 — Injectable factory for offline testability**
   The factory mirrors the agent's injectable-client idiom (`agent.py` `gemini_client`/`_get_caller`):
   it accepts an optional injected **caller** (`caller=None`) — a `Callable[[str], str]` mapping prompt →
   raw JSON text — and optional injected `pipeline`/`grammar_data`, constructing the real ones lazily
   only when `None`. This is the seam the AC12 offline test drives.

5. **AC5 — Registry-based selection; default stays `sudachi-baseline` and offline**
   `main()` selects the adapter **by name from `ADAPTERS`** via a `--adapter` flag. `python
   eval/run_eval.py` (no args) still runs the offline `sudachi-baseline` adapter (no `GEMINI_API_KEY`, no
   network) and prints the baseline metrics unchanged. The existing positional gold path keeps working.
   Recommended: `argparse` with `gold` positional (`nargs="?"`, default the bundled Genki-6 gold),
   `--adapter` (`choices=list(ADAPTERS)`, default `"sudachi-baseline"`), and `--out-dir` (default
   `eval/results/`). Build **only the chosen** adapter — never construct `gemini-analysis` unless it was
   selected (it would build the real Gemini client). The `gemini-analysis` factory is called with
   `target_chapter=gold.get("chapter")` (the gold's `chapter` is `6`; grammar tagging is unscored so
   `None` is also acceptable — the gold chapter mirrors production); `sudachi-baseline` takes no args.

6. **AC6 — Both adapters print the identical metric structure via the unchanged scorer**
   Running either adapter over the gold prints the **same** segmentation / dictionary-form / ruby report
   via the existing `score()` + `_print_report()`, with the chosen adapter name shown in the header. **No
   change** to `score()`, `_spans`, `_internal_boundaries`, or `_print_report`'s body — only the adapter
   name label and (new) a printed path to the written result files.

7. **AC7 — `GEMINI_API_KEY` required only for the gemini adapter, with a clear error**
   The real Gemini client is built **lazily inside the factory**. `load_dotenv()` is invoked so a repo
   `.env` `GEMINI_API_KEY` is picked up (python-dotenv is already a backend dependency). If the key is
   missing when the real client is needed, raise `RuntimeError("GEMINI_API_KEY environment variable is
   not set.")` (mirror [`agent.py:372-374`](../../apps/story-generator-backend/src/story_generator/agent.py#L372-L374)).
   The `sudachi-baseline` default path must **never** touch the key or the network.

8. **AC8 — Segmentation errors are the signal, not a crash (no join-invariant guard)**
   The gemini adapter must **not** enforce `"".join(words) == ja` and must **not** call
   `build_enriched_story` (which raises on a join mismatch —
   [`enrichment.py:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L366-L374)).
   It calls `enrich_sentence` directly, which does not enforce the invariant. LLM segmentation that fails
   to reconstruct `ja` is exactly what the harness measures (a boundary miss) — an exception would hide
   that signal.

9. **AC9 — Every run records the adapter under test and the current git commit**
   For each run, `main()` assembles a **run-metadata** block containing at minimum:
   `started_at` (ISO-8601 UTC), `adapter` (the selected name), `adapter_module`
   (`factory.__module__`, e.g. `adapters.gemini_analysis`), `git_commit` (from `git rev-parse HEAD`),
   `gold_id`, `gold_path`, `n_sentences`, and `model` (`GEMINI_MODEL` for the gemini adapter, `null`
   otherwise). `git_commit` is obtained via `subprocess` and **must not fail the run** if git is absent
   or the dir is not a repo (fall back to `"unknown"`); **uncommitted changes are ignored** — record
   `HEAD` regardless (an optional `git_dirty` boolean may be included but is not required).

10. **AC10 — Each run writes two timestamped result files (raw SUT output + metrics) with the metadata header**
    After scoring, `main()` writes two JSON files into `--out-dir` (default `eval/results/`, created if
    missing), both named with the **run-start timestamp** and identifying metadata
    (e.g. `{YYYYMMDDThhmmssZ}__{gold_id}__{adapter}__raw.json` and `…__metrics.json`):
    - **raw** — `{"run": <metadata>, "results": [{"id", "ja", "words": <adapter output for that ja>}, …]}`
      capturing the **exact per-sentence output of the module under test** for every gold sentence.
    - **metrics** — `{"run": <metadata>, "metrics": <the score() return dict>}`.
    Both carry the **same** `run` metadata block (AC9) so the pair is self-describing and the raw output
    is reproducible from its recorded commit. The console still prints the human-readable report (AC6)
    and additionally prints the two written file paths. UTF-8, `ensure_ascii=False` (Japanese stays
    readable). `eval/results/` is added to `apps/story-generator-backend/.gitignore` (mirroring the
    existing `logs/` ignore) — result files are run artifacts, not committed.

11. **AC11 — Each adapter is invoked exactly once per gold sentence**
    The raw capture and the scoring must share a **single** invocation of the adapter per sentence — the
    `gemini-analysis` adapter makes a network call per sentence, so a double pass would double cost and
    could yield two different (non-deterministic) outputs. Capture the raw outputs via a thin wrapper
    that records each `(ja → output)` as `score()` consumes it (see Dev Notes), **not** by running the
    adapter a second time. `score()`'s signature and body stay unchanged.

12. **AC12 — Offline unit test with an injected fake caller (no network)**
    A unit test drives `make_gemini_analysis_adapter` with an **injected stub caller** returning canned
    Stage-2 JSON (a dict with a `sentences` array) and a fake or real `pipeline`, asserting: (a) it
    flattens `words` across sentences, (b) calls `enrich_sentence` and maps `dict`/`ruby`/`pos` from its
    result, (c) returns one entry per surface word in order. No `GEMINI_API_KEY`, no network. Import the
    adapter from the `adapters` package (add the eval dir to `sys.path` or import via `importlib`; record
    the approach). Follow `test_agent.py`'s stub-fixture style
    ([`test_agent.py:58-114`](../../apps/story-generator-backend/tests/test_agent.py#L58-L114)).
    Optionally also assert `_git_commit()` returns a string and never raises. `pytest tests/` stays green.

13. **AC13 — Scope fence: eval-only, no production/gold/scoring-math change**
    Changes are confined to `apps/story-generator-backend/eval/` (new `adapters/` package, `run_eval.py`
    harness edits, `results/` output dir, `README.md` note), one test under `tests/`, and one line in
    `apps/story-generator-backend/.gitignore`. **No** change to `story_generator/agent.py`,
    `enrichment.py`, `data_loader.py`, `validator.py`, `main.py`, the gold file, or the scoring math
    (`score`/`_spans`/`_internal_boundaries`). The Stage-2 prompt and enrichment pipeline are **imported
    and reused verbatim** — never forked, copied, or re-implemented. The baseline adapter is **moved**,
    not rewritten.

## Tasks / Subtasks

- [x] **Task 1: Create the `eval/adapters/` package and move the baseline verbatim** (AC: 1, 13)
  - [x] New `eval/adapters/__init__.py`: define `Adapter = Callable[[str], list[dict]]` (moved from
        `run_eval.py:30`), import both factories, and expose
        `ADAPTERS = {"sudachi-baseline": make_sudachi_baseline_adapter, "gemini-analysis": make_gemini_analysis_adapter}`.
  - [x] New `eval/adapters/sudachi_baseline.py`: move `make_sudachi_baseline_adapter`
        ([`run_eval.py:157-185`](../../apps/story-generator-backend/eval/run_eval.py#L157-L185)) **unchanged**;
        keep its `story_generator`/`sudachipy` imports **inside** the factory (already lazy). Adjust the
        `resources` path if `__file__` depth changed (now `parents[4]/"resources"` — the module sits one
        directory deeper; **verify the resolved path** points at repo-root `resources/`).
  - [x] In `run_eval.py`, delete the moved adapter and the local `Adapter` alias; add
        `from adapters import ADAPTERS, Adapter` (after the existing `sys.path` setup). Keep `has_kanji`
        imported in `run_eval.py` — `score()` still uses it.

- [x] **Task 2: Add the `gemini-analysis` adapter** (AC: 2, 3, 4, 7, 8)
  - [x] New `eval/adapters/gemini_analysis.py` with `make_gemini_analysis_adapter(target_chapter=None, *,
        caller=None, pipeline=None, grammar_data=None)`. Lazily build (only when `None`): `grammar_data`
        via `load_grammar_data(<resources>/Genki_grammar_for_AI_generation.csv)`; `pipeline` via
        `EnrichmentPipeline(<resources>/genki1vocab.csv)`; `caller` via `load_dotenv()` →
        `GEMINI_API_KEY` guard → `from google import genai` → a `def _call(prompt)->str` running
        `client.models.generate_content(model=GEMINI_MODEL, contents=prompt, config=<json+thinking>)` and
        returning `resp.text`. Config: `GenerateContentConfig(response_mime_type="application/json",
        thinking_config=ThinkingConfig(thinking_budget=THINKING_BUDGET))` (import `GEMINI_MODEL`,
        `THINKING_BUDGET`, `build_japanese_analysis_prompt` from `story_generator.agent`;
        `include_thoughts` not needed — blocking call).
  - [x] Inner `adapter(ja)`: build the prompt; `data = json.loads(caller(prompt))`; guard non-dict /
        missing `sentences` with a clear `ValueError`; flatten `words`; `enriched =
        pipeline.enrich_sentence(words, seen_dict_forms=None)`; return the mapped list. **Do not** call
        `build_enriched_story` and **do not** enforce the join-invariant (AC8).

- [x] **Task 3: Run provenance + result-file writers in `run_eval.py`** (AC: 9, 10, 11)
  - [x] Add `_git_commit() -> str`: `subprocess.run(["git","rev-parse","HEAD"], cwd=<repo root>,
        capture_output=True, text=True)`; return the stripped stdout on success, else `"unknown"`; never
        raise (wrap in try/except). Optionally add `_git_dirty()`.
  - [x] In `main()`: compute `started_at = datetime.now(timezone.utc)`; build the `run` metadata dict
        (AC9). Wrap the chosen adapter in a **capturing** closure that appends `{"ja": ja, "words": out}`
        as `score()` calls it, then call `score(gold, capturing_adapter)` (single invocation per
        sentence — AC11). Zip `gold["sentences"]` with the captured list (same order) to attach each
        sentence `id` into the raw records.
  - [x] Write the two files into `--out-dir` (mkdir parents, UTF-8, `ensure_ascii=False`): `…__raw.json`
        (`{"run", "results"}`) and `…__metrics.json` (`{"run", "metrics"}`). Print both paths after the
        report. Add `eval/results/` to `apps/story-generator-backend/.gitignore`.

- [x] **Task 4: Registry-based CLI selection** (AC: 5, 6)
  - [x] Replace the positional-only `argv` parsing
        ([`run_eval.py:215-224`](../../apps/story-generator-backend/eval/run_eval.py#L215-L224)) with
        `argparse`: `gold` positional (`nargs="?"`, default bundled gold), `--adapter`
        (`choices=list(ADAPTERS)`, default `"sudachi-baseline"`), `--out-dir` (default `eval/results/`).
  - [x] Look up `factory = ADAPTERS[args.adapter]`; build the sudachi adapter with no args, the gemini
        adapter with `target_chapter=gold.get("chapter")`. Pass the chosen name to `_print_report(...)`.
  - [x] Confirm `python eval/run_eval.py` (no args) still runs `sudachi-baseline` offline, prints the
        baseline table, and now also writes the two result files.

- [x] **Task 5: Offline unit test** (AC: 12)
  - [x] Add a test building the gemini adapter with `caller=<stub returning canned JSON>` + a fake/real
        `pipeline`, asserting flatten + enrich + field-mapping + ordering. No network, no key. Optionally
        assert `_git_commit()` returns a `str` without raising. Record the eval-module import approach.
  - [x] `pytest tests/ -v` (from `apps/story-generator-backend`) — new test passes, nothing regresses.

- [x] **Task 6: Documentation + manual benchmark run** (AC: 6, 10, 13)
  - [x] Update `eval/README.md`: document the `adapters/` package + registry, the `--adapter`/`--out-dir`
        flags, the two result files + their `run` metadata (adapter, git commit, timestamp), and that
        `gemini-analysis` needs `GEMINI_API_KEY`. Point the "Adding a system-under-test" bullet
        ([`README.md:96-97`](../../apps/story-generator-backend/eval/README.md#L96-L97)) at the shipped adapter.
  - [x] With a valid `GEMINI_API_KEY`, run `python eval/run_eval.py --adapter gemini-analysis`; confirm
        the report prints, the two `results/` files are written with the correct `run` metadata (adapter
        + git commit), and note the numbers in the completion notes (do **not** overwrite the README
        baseline snapshot table — add a second section if recording).

### Review Findings

- [x] [Review][Patch] No per-sentence error resilience during Gemini adapter scoring — resolved: catch failures per sentence (skip-and-continue). Any exception while processing a single sentence during a `--adapter gemini-analysis` run (malformed/non-JSON `caller` output, a response missing `"sentences"`, a sentence with `"words": null`, a non-dict entry in `sentences`, or `resp.text is None` from a safety-blocked/empty Gemini candidate) previously propagated uncaught out of `adapter()` → `_capturing()` → `score()`, aborting `main()` entirely before either result file was written. Fixed: `_capturing()` in `run_eval.py` now catches per-sentence exceptions, prints a warning to stderr, and records an empty `[]` output for that sentence so scoring + file-writing continue for the rest of the gold set. Verified with an injected flaky adapter that fails on sentence 3 of 10 — the run completed all 10 sentences and wrote both result files. [apps/story-generator-backend/eval/run_eval.py]

- [x] [Review][Patch] Add a defensive length assertion before zipping captured output with gold sentences [apps/story-generator-backend/eval/run_eval.py]
- [x] [Review][Patch] Gold file is read with no existence or shape validation — a missing path or a gold JSON without a `"sentences"` key surfaces as a raw unhandled traceback instead of a clear CLI error [apps/story-generator-backend/eval/run_eval.py] — fixed with `parser.error(...)` checks; verified both produce a clean exit-2 CLI error.
- [x] [Review][Patch] Result filenames use second-level timestamp precision with no uniqueness suffix — two runs started within the same second silently overwrite each other's raw/metrics files [apps/story-generator-backend/eval/run_eval.py] — fixed by disambiguating with a short uuid suffix on collision; verified with a forced same-timestamp collision (pre-existing files were left untouched, new run got a `-<hex>` suffixed pair).
- [x] [Review][Patch] `gold_id` (taken verbatim from arbitrary gold-file JSON) is used unsanitized in the result filename stem — an id containing `/`, `:`, or other reserved characters would produce a broken or misplaced path, notably on this Windows-hosted repo [apps/story-generator-backend/eval/run_eval.py] — fixed with `_sanitize_for_filename()`.
- [x] [Review][Patch] README's new "Production-pipeline snapshot" section points to "the archived `results/*gemini-analysis*` pair" as if it were available in-repo, but `eval/results/` is gitignored by this same diff — misleading for anyone reading the README from a fresh checkout [apps/story-generator-backend/eval/README.md] — reworded to state the pair is local-only.
- [x] [Review][Patch] `.gitignore` still ends with no trailing newline — this diff touches the same lines and could have fixed it [apps/story-generator-backend/.gitignore] — fixed.
- [x] [Review][Defer] `run_meta["model"]` is read from the module-level `GEMINI_MODEL` constant rather than derived from the actual injected `caller` — correct today since the only real caller uses the same constant, but would misreport if the injection seam is ever repurposed with a different model outside tests [apps/story-generator-backend/eval/run_eval.py:238] — deferred, no clean fix without changing the caller contract; theoretical only.
- [x] [Review][Defer] `sys.path` insertion to import the top-level `adapters` package is duplicated between `run_eval.py` and `test_eval_gemini_adapter.py`, and risks shadowing any other process-wide module literally named `adapters` [apps/story-generator-backend/eval/run_eval.py, apps/story-generator-backend/tests/test_eval_gemini_adapter.py] — deferred, this is the import mechanism the story's own Dev Notes prescribe; revisiting it is an architecture question beyond this review.

## Dev Notes

### Target file layout after this story

```
eval/
  run_eval.py            # harness ONLY: scoring, _print_report, _git_commit, CLI, run-logging, dispatch
  adapters/
    __init__.py          # Adapter type alias + ADAPTERS registry {name: factory}
    sudachi_baseline.py  # make_sudachi_baseline_adapter  (MOVED verbatim from run_eval.py)
    gemini_analysis.py   # make_gemini_analysis_adapter   (NEW — AC2-4,7,8)
  gold/eval-genki6-daily-life.json   # frozen ground truth (unchanged)
  results/               # NEW — gitignored; timestamped {raw,metrics} run artifacts
  README.md              # updated (Task 6)
```

`python eval/run_eval.py` runs **from `apps/story-generator-backend`**. CPython puts the script's dir
(`eval/`) on `sys.path`, so `from adapters import ADAPTERS` resolves to `eval/adapters/`. `run_eval.py`
already inserts `.../src` on `sys.path` (line 24) so the adapter factories can import `story_generator.*`
— keep that insert **before** `from adapters import …`, and keep every `story_generator`/`google` import
**inside** the factories (lazy) so import order and the offline default are both safe.

### The exact seam the gemini adapter wires (verified anchors)

| Piece | Where | Notes |
|---|---|---|
| `build_japanese_analysis_prompt(grammar_data, japanese_text, *, target_chapter, steering_instructions="")` | [`agent.py:174-259`](../../apps/story-generator-backend/src/story_generator/agent.py#L174-L259) | Returns **full-story JSON** `{id,title,title_ja,description,grammar, sentences:[{english,japanese,words,grammar}]}`. Takes `grammar_data` (no `vocab_data`). |
| `GEMINI_MODEL = "gemini-2.5-flash"`, `THINKING_BUDGET = 16384` | [`agent.py:17-18`](../../apps/story-generator-backend/src/story_generator/agent.py#L17-L18) | Import — don't hardcode. |
| Real blocking client pattern (`genai.Client`, `models.generate_content`, `GEMINI_API_KEY` guard) | [`agent.py:366-386`](../../apps/story-generator-backend/src/story_generator/agent.py#L366-L386) | Mirror the lazy build + error message; the eval call is **blocking/non-streaming**. |
| `EnrichmentPipeline(genki_csv_path)` + `enrich_sentence(words, seen_dict_forms=None) → [{annotated, dictionary_form, reading, pos_code, …}]` | [`enrichment.py:258-335`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L258-L335) | Re-tokenizes each surface word with SudachiPy to derive dict/ruby/pos; does **not** enforce the join-invariant. |
| Baseline adapter (structure + field mapping to preserve on move) | [`run_eval.py:157-185`](../../apps/story-generator-backend/eval/run_eval.py#L157-L185) | Output map: `dict←dictionary_form`, `ruby←annotated`, `pos←pos_code`. |
| `Adapter` type + `score`/`_print_report` (scoring math — do not touch) | [`run_eval.py:30-149,193-224`](../../apps/story-generator-backend/eval/run_eval.py#L30-L149) | `Adapter` alias **moves** to `adapters/__init__.py`. |
| Canonical resource paths | [`main.py:127-136`](../../apps/story-generator-backend/src/story_generator/main.py#L127-L136) | `resources/genki1vocab.csv`, `resources/Genki_grammar_for_AI_generation.csv`. |
| Gold `chapter` (`6`) + ruby convention (no first-occurrence suppression) | [gold JSON](../../apps/story-generator-backend/eval/gold/eval-genki6-daily-life.json) | Drives `target_chapter` and `seen_dict_forms=None`. |

### The gemini adapter == the "current production pipeline" the README already names

`eval/README.md:96-97` lists the missing system-under-test as: *"Current production pipeline — a Gemini
call that segments the given `ja` under the prompt's segmentation rules, then
`EnrichmentPipeline.enrich_sentence`."* — **this story is that adapter, verbatim.** Because
`enrich_sentence` derives dict/ruby via SudachiPy on each LLM-produced surface word, `gemini-analysis`
and `sudachi-baseline` share their enrichment layer and differ only in **who segments** (Gemini vs
SudachiPy) — the aligned-vs-strict gap the benchmark exists to expose.

### The prompt returns a story, not a word list — flatten `sentences`

`build_japanese_analysis_prompt` was designed for a whole story (se3-3). Feeding it one frozen `ja` is
fine — it returns `{…, sentences:[…]}` with (usually) one sentence, but the model may split on internal
punctuation, so **flatten `words` across all returned sentences** rather than assuming `sentences[0]`.
Ignore the metadata and per-sentence `english`/`grammar` — the eval scores only `surface`/`dict`/`ruby`,
aligned by character offset.

### `seen_dict_forms=None` is a hard requirement — a set would corrupt the ruby score

`enrich_sentence` suppresses furigana on repeat dictionary forms **only when `seen_dict_forms` is a set**
([`enrichment.py:304-312`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L304-L312)).
The gold ruby is **canonical per-word — every kanji token carries its reading** (gold `conventions.ruby`;
matches the baseline's `seen_dict_forms=None` at
[`run_eval.py:174`](../../apps/story-generator-backend/eval/run_eval.py#L174)). Pass `None`.

### The default path must stay offline (AC5/AC7) — build the client lazily

`python eval/run_eval.py` with no args runs on machines with **no** `GEMINI_API_KEY` and **no** network.
Two rules keep it so: **never** `from google import genai` at a module top (import inside the factory's
lazy-caller branch), and **never** call `make_gemini_analysis_adapter()` unless `--adapter
gemini-analysis` was chosen (select by name, build only the chosen one). The `caller=None` injection seam
(AC4) also means the unit test never trips the key/network guard.

### Do NOT call `build_enriched_story` (AC8)

Tempting (it already runs `enrich_sentence`) but wrong: it (a) enforces the join-invariant and **raises**
on any LLM segmentation that doesn't reconstruct `ja`
([`enrichment.py:366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L366-L374)),
crashing the benchmark on exactly the segmentation errors it must *measure*, and (b) returns v2 story
JSON, not the flat `{surface,dict,ruby,pos}` the `Adapter` contract needs. Call `enrich_sentence`
directly and map its per-word dicts.

### Capture raw output without invoking the adapter twice (AC11)

`score(gold, adapter)` calls `adapter(s["ja"])` once per gold sentence
([`run_eval.py:85`](../../apps/story-generator-backend/eval/run_eval.py#L85)) and does **not** retain the
outputs. To log the raw SUT output **without** a second pass (critical — the gemini adapter makes a
network call per sentence and is non-deterministic), wrap the chosen adapter in a **capturing closure**
and pass the wrapper to `score()`:

```python
captured: list[dict] = []
def _capturing(ja: str) -> list[dict]:
    out = adapter(ja)
    captured.append({"ja": ja, "words": out})
    return out

results = score(gold, _capturing)
# score() iterates gold["sentences"] in order, so captured is aligned by index:
raw_records = [
    {"id": s["id"], "ja": s["ja"], "words": cap["words"]}
    for s, cap in zip(gold["sentences"], captured)
]
```

This keeps `score()` and its signature untouched (AC13) and guarantees one adapter call per sentence.

### Run provenance and file writing (AC9/AC10)

- **Git commit**: `subprocess.run(["git","rev-parse","HEAD"], cwd=<repo root>, capture_output=True,
  text=True)`. Repo root is `Path(__file__).resolve().parents[3]` from `run_eval.py` (eval→backend→apps→
  repo). Wrap in try/except; on `CalledProcessError`/`FileNotFoundError`/non-zero return, fall back to
  `"unknown"` — the eval must never fail because of git. Ignore dirty state (record `HEAD` regardless);
  an optional `git_dirty` from `git status --porcelain` (non-empty ⇒ dirty) is a nice-to-have only.
- **Timestamp**: one `started_at = datetime.now(timezone.utc)` per run; use `strftime("%Y%m%dT%H%M%SZ")`
  for filenames and `.isoformat()` (or `…"Z"`) for the metadata field — the **same** instant for both
  files so the pair shares a stamp.
- **Filenames**: `f"{ts}__{gold_id}__{adapter}__raw.json"` / `…__metrics.json` in `--out-dir`
  (default `eval/results/`, `mkdir(parents=True, exist_ok=True)`). `gold_id = gold.get("id",
  gold_path.stem)`. Adapter names contain a hyphen — fine in filenames.
- **Contents**: dump with `json.dump(obj, f, ensure_ascii=False, indent=2)` so Japanese stays readable.
  Raw = `{"run": meta, "results": raw_records}`; metrics = `{"run": meta, "metrics": results}`.
- **`.gitignore`**: add `eval/results/` to `apps/story-generator-backend/.gitignore` (which already
  ignores `logs/`). Result files are per-run artifacts, never committed.

### `target_chapter` barely matters here (but pass the gold's chapter)

`target_chapter` only selects the grammar reference block for tagging
([`agent.py:197-198`](../../apps/story-generator-backend/src/story_generator/agent.py#L197-L198)), and
grammar is **not** a scored field. `None` or `6` yield identical `surface`/`dict`/`ruby` metrics. Pass
`gold.get("chapter")` to mirror production; `None` is acceptable if simpler.

### Previous-story intelligence (se3-1…se3-5, all done)

- **The Stage-2 prompt is final and merged** (se3-3, `4f026cf`). Its signature and full-story JSON shape
  are frozen — import and reuse, do not modify (AC13). se3-4 (`e5a7066`) hardened JSON handling **in the
  agent**; the eval adapter does its own light `json.loads` + shape guard.
- **The eval harness landed in `76f41e8`** with the `sudachi-baseline` adapter and the frozen Genki-6
  gold, marked *"HUMAN REVIEW REQUIRED before treating as ground truth"* — this story does **not**
  re-verify or edit the gold; it adds a second system-under-test and run archiving.
- **Injectable-client testability is the established backend pattern**: `StoryGeneratorAgent` takes
  `gemini_client`/`gemini_stream_client`; `test_agent.py` passes stubs
  ([`test_agent.py:58-114`](../../apps/story-generator-backend/tests/test_agent.py#L58-L114)). Mirror it
  with the factory's `caller=None` seam (AC4/AC12).

### Testing notes (AC12)

- **The real adapter cannot be unit-tested against the network** (live key + non-deterministic output).
  Test the **plumbing** with an injected `caller` returning canned Stage-2 JSON, e.g.
  `{"sentences":[{"words":["私","は","起きます"]}]}`, and assert the output maps `enrich_sentence`'s
  result. This isolates "does the adapter flatten + enrich + map correctly" from "is Gemini's
  segmentation good" (the latter is what the *manual* benchmark measures).
- To keep the test SudachiPy-independent, inject a fake `pipeline` whose `enrich_sentence(words,
  seen_dict_forms=None)` returns canned per-word dicts; or use the real pipeline if the env already has
  SudachiPy (as `test_enrichment.py` does).
- **Import caveat:** `eval/adapters/` is not part of the `story_generator` package. From `tests/`, add
  the eval dir to `sys.path` (`sys.path.insert(0, <repo>/apps/story-generator-backend/eval)`) then
  `from adapters.gemini_analysis import make_gemini_analysis_adapter`, or load via `importlib`. Do **not**
  relocate the adapters into the package (breaches AC13 + the self-contained-eval design). Record the
  chosen approach in the completion notes.

### Code style (project-context.md)

- **Succinct docstrings** on the new modules, factories, and helpers; **block comments** for the major
  steps (build prompt → call → flatten → enrich → map; capture → score → write). Match the existing
  `run_eval.py` comment density (module docstring + section banners + per-function docstrings). Do not
  narrate obvious code.
- **Reuse, do not reinvent**: import `GEMINI_MODEL`, `THINKING_BUDGET`, `build_japanese_analysis_prompt`,
  `load_grammar_data`, `EnrichmentPipeline` — no copied prompt text, no re-implemented segmentation. The
  baseline adapter is **moved**, not rewritten.
- Keep the gemini adapter's output map **byte-identical in shape** to the baseline's so `score()` treats
  both uniformly.

### Project Structure Notes

- **No production-code changes**: `story_generator/*` is imported and reused only. New/edited files:
  `eval/adapters/{__init__,sudachi_baseline,gemini_analysis}.py`, `eval/run_eval.py`, `eval/README.md`,
  `eval/results/` (gitignored, created at runtime), one `tests/` file, one `.gitignore` line.
- **No new dependencies:** `google-genai` (via the genai SDK), `python-dotenv`, `sudachipy`,
  `sudachidict-core`, `jamdict`, `jamdict-data-fix` are all in
  [`requirements.txt`](../../apps/story-generator-backend/requirements.txt); `subprocess`/`argparse`/
  `datetime` are stdlib.
- **Run dir:** all `python eval/run_eval.py …` commands run **from `apps/story-generator-backend`** (the
  `sys.path` insert, the `adapters` import, and the `parents[3]/resources` path all assume that layout).
- **Windows note:** the repo is on Windows; `subprocess.run(["git", …])` and `python eval/run_eval.py`
  work cross-platform. `.env` at the repo root supplies `GEMINI_API_KEY` (loaded by `load_dotenv()`).

### References

- [Source: [`_bmad-output/planning-artifacts/supp-epic-3-staged-generation-pipeline.md`](../planning-artifacts/supp-epic-3-staged-generation-pipeline.md)]
  — Story se3-6 ACs (482-503); §"Stage 2 is a single universal prompt" ("also the production adapter for
  the eval harness"); §Verification step 3.
- [Source: [`eval/run_eval.py:30-224`](../../apps/story-generator-backend/eval/run_eval.py)]
  — `Adapter` alias (to move), `make_sudachi_baseline_adapter` (to move, `:157-185`), `score`/
  `_print_report` (unchanged), `main` argv parsing to replace (`:215-224`), the per-sentence adapter call
  in `score` (`:85`) that the capturing wrapper feeds.
- [Source: [`eval/README.md:91-122`](../../apps/story-generator-backend/eval/README.md#L91-L122)]
  — "Adding a system-under-test" names this exact adapter; baseline snapshot table to compare against.
- [Source: [`src/story_generator/agent.py:17-18,174-259,366-386`](../../apps/story-generator-backend/src/story_generator/agent.py#L174-L259)]
  — `GEMINI_MODEL`/`THINKING_BUDGET`; the Stage-2 prompt; the lazy `genai.Client` + key guard to mirror.
- [Source: [`src/story_generator/enrichment.py:258-335,366-374`](../../apps/story-generator-backend/src/story_generator/enrichment.py#L258-L335)]
  — `EnrichmentPipeline`/`enrich_sentence` output keys; the `build_enriched_story` join guard to **avoid**.
- [Source: [`src/story_generator/data_loader.py:70-89`](../../apps/story-generator-backend/src/story_generator/data_loader.py#L70-L89)]
  — `load_grammar_data(path) → GrammarData` for the analysis prompt.
- [Source: [`src/story_generator/main.py:127-136`](../../apps/story-generator-backend/src/story_generator/main.py#L127-L136)]
  — canonical resource paths.
- [Source: [`apps/story-generator-backend/.gitignore`](../../apps/story-generator-backend/.gitignore)]
  — the `logs/` ignore precedent to mirror for `eval/results/`.
- [Source: [`tests/test_agent.py:58-114`](../../apps/story-generator-backend/tests/test_agent.py#L58-L114)]
  — injectable-stub fixture idiom for the offline adapter test.
- [Source: `_bmad-output/project-context.md`] — comment style, reuse-don't-reinvent, no new deps.

## What does NOT belong in this story

- **No change to the Stage-2 prompt, enrichment pipeline, agent, `main.py`, or `data_loader.py`** — import
  and reuse (AC13). Poor Gemini segmentation in the benchmark is the **finding** for the agentic epic, not
  a bug to fix here.
- **No change to the gold file, `score()`, `_spans`, `_internal_boundaries`, or the report body** — only
  new adapters, a registry, run logging, and the `--adapter`/`--out-dir` selectors.
- **No rewrite of the baseline adapter** — it is **moved** into `adapters/sudachi_baseline.py` byte-for-
  byte (only the `resources` path depth is re-verified).
- **No enforcement of the join-invariant / no `build_enriched_story`** — segmentation errors flow through
  as measured boundary misses (AC8).
- **No first-occurrence furigana suppression** — `seen_dict_forms=None` (AC3).
- **No double adapter invocation** — one call per sentence, captured via wrapper (AC11).
- **No committing of result files** — `eval/results/` is gitignored run output (AC10).
- **No making the default run require a key or network** — `sudachi-baseline` stays the offline default
  (AC5/AC7).
- **No segmentation / dictionary-form / ruby *quality* work** — this story builds and archives the
  benchmark, it does not improve the algorithms (that is the next, agentic epic).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pytest tests/ -v` from `apps/story-generator-backend` — 88 passed, 0 failed (86 pre-existing +
  2 new in `test_eval_gemini_adapter.py`).
- `python eval/run_eval.py` (no args, from `apps/story-generator-backend`) — confirmed the
  `sudachi-baseline` default path stays offline and reproduces the exact README baseline
  snapshot (boundary F1 0.889, dict strict/aligned 0.610/1.000, ruby strict/aligned 0.515/0.895);
  wrote the two timestamped result files.
- `python eval/run_eval.py --adapter gemini-analysis` — a real, non-mocked run using the repo's
  `.env` `GEMINI_API_KEY` (loaded via `load_dotenv()`); confirmed the report prints, both result
  files write with correct `run` metadata (`adapter_module=adapters.gemini_analysis`, real
  `git_commit`, `model=gemini-2.5-flash`), and the numbers are recorded in `eval/README.md`
  under "Production-pipeline snapshot".
- Verified the `GEMINI_API_KEY` missing-key guard: with `dotenv.load_dotenv` neutralized and the
  env var cleared, `make_gemini_analysis_adapter(...)` raises
  `RuntimeError("GEMINI_API_KEY environment variable is not set.")` without any network call.

### Completion Notes List

- **Task 1 (AC1, AC13):** Created `eval/adapters/` (`__init__.py`, `sudachi_baseline.py`,
  `gemini_analysis.py`). `make_sudachi_baseline_adapter` moved verbatim into
  `sudachi_baseline.py`; only the `resources` path depth changed (`parents[3]` → `parents[4]`,
  re-verified by the successful offline run reproducing the exact baseline snapshot numbers).
  `run_eval.py` now imports `Adapter`/`ADAPTERS` from `adapters` and defines no adapter itself.
- **Task 2 (AC2-4, AC7-8):** Added `make_gemini_analysis_adapter` — builds the Stage-2 prompt via
  `build_japanese_analysis_prompt`, makes one blocking Gemini call (`GEMINI_MODEL`,
  `THINKING_BUDGET` imported from `story_generator.agent`, JSON response mime type), flattens
  `words` across every returned sentence, and calls `pipeline.enrich_sentence(words,
  seen_dict_forms=None)` directly (never `build_enriched_story`, so a segmentation join mismatch
  is measured, not raised). `caller`/`pipeline`/`grammar_data` are all injectable and built
  lazily only when `None`. The real caller mirrors `agent.py`'s lazy client + `RuntimeError` key
  guard, with `load_dotenv()` invoked first so a repo `.env` key is picked up.
- **Task 3 (AC9-11):** Added `_git_commit()` (subprocess `git rev-parse HEAD`, `cwd`=repo root
  via `parents[3]`, falls back to `"unknown"` on any failure, never raises). `main()` builds the
  `run` metadata block and wraps the selected adapter in a capturing closure passed to `score()`
  so each adapter runs exactly once per sentence — the raw per-sentence output is captured as a
  side effect of scoring, not a second pass. Added `eval/results/` to
  `apps/story-generator-backend/.gitignore`.
- **Task 4 (AC5-6):** Replaced positional-only `argv` parsing with `argparse`: `gold` positional
  (default bundled gold), `--adapter` (`choices=list(ADAPTERS)`, default `sudachi-baseline`),
  `--out-dir` (default `eval/results/`). Only the selected adapter's factory is invoked — the
  `gemini-analysis` factory (and its real Gemini client) is never constructed unless
  `--adapter gemini-analysis` is passed.
- **Task 5 (AC12):** Added `tests/test_eval_gemini_adapter.py`. **Import approach:** the test
  inserts `eval/` onto `sys.path` (mirroring `run_eval.py`'s own `sys.path` setup) and imports
  `adapters.gemini_analysis` and `run_eval._git_commit` directly — `eval/adapters/` intentionally
  stays outside the `story_generator` package (AC13), so this is the same mechanism the harness
  itself uses at runtime. The test injects a stub `caller` returning canned two-sentence Stage-2
  JSON and a `FakeEnrichmentPipeline` (no SudachiPy dependency), asserting the adapter flattens
  words across both sentences, calls `enrich_sentence` exactly once with `seen_dict_forms=None`,
  maps `dict`/`ruby`/`pos` from its result, and preserves surface-word order. A second test
  asserts `_git_commit()` returns a non-empty string and never raises. `grammar_data` was left
  uninjected (`None`) — `load_grammar_data` only does CSV parsing, no network/SudachiPy
  dependency, so it stays fully offline.
- **Task 6 (AC6, AC10, AC13):** Updated `eval/README.md`: new file-tree, `--adapter`/`--out-dir`
  usage, the `gemini-analysis` adapter description, a "Run archiving" section documenting the
  two result files and their `run` metadata, and a rewritten "Adding a system-under-test" section
  pointing at the shipped adapters. Ran `python eval/run_eval.py --adapter gemini-analysis`
  against a real `GEMINI_API_KEY`; recorded the resulting metrics in a new "Production-pipeline
  snapshot" section (the original SudachiPy baseline table is untouched).
- **Scope check (AC13):** No changes to `story_generator/agent.py`, `enrichment.py`,
  `data_loader.py`, `main.py`, the gold file, or `score`/`_spans`/`_internal_boundaries`/
  `_print_report`'s body (only its label argument usage in `main()`). All changes confined to
  `eval/adapters/` (new), `eval/run_eval.py`, `eval/README.md`, `eval/results/` (gitignored,
  runtime-created), one new test file, and one `.gitignore` line.

### File List

- `apps/story-generator-backend/eval/adapters/__init__.py` (new)
- `apps/story-generator-backend/eval/adapters/sudachi_baseline.py` (new — moved from `run_eval.py`)
- `apps/story-generator-backend/eval/adapters/gemini_analysis.py` (new)
- `apps/story-generator-backend/eval/run_eval.py` (modified — adapter dispatch, run provenance,
  result-file writers, argparse CLI)
- `apps/story-generator-backend/eval/README.md` (modified — adapters/registry docs, run
  archiving, production-pipeline snapshot)
- `apps/story-generator-backend/.gitignore` (modified — added `eval/results/`)
- `apps/story-generator-backend/tests/test_eval_gemini_adapter.py` (new)
