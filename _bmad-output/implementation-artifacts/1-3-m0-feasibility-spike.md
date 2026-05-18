# Story 1.3: M0 Feasibility Spike

Status: done

## Story

As a developer,
I want a Python script that generates a schema-valid, curriculum-calibrated Japanese story from a known English source,
so that the core technical assumption (Gemini produces schema-valid parallel arrays via Pydantic structured output) is proven before any UI investment.

## Acceptance Criteria

**AC1 — Spike executes end-to-end:**
Given a hardcoded English source story and target chapter (Genki I Ch.8) in `spike.py`,
when `python -m story_generator.spike` is run from `apps/story-generator-backend/` with a valid `GEMINI_API_KEY`,
then `data_loader.py` loads both CSVs; the system prompt includes cumulative Ch.1–8 vocabulary and grammar; a single Gemini API call is made; a response is received within 60 seconds.

**AC2 — Output passes structural validation:**
Given the Gemini response arrives,
when Pydantic parses it to `NihonNoHonStoryV1`,
then `jsonschema.validate()` against `story.v1.json` passes with no errors; `words`, `ruby`, and `vocab_keys` arrays are equal length in every sentence.

**AC3 — Contract test passes:**
Given the schema-valid story JSON written to `tests/fixtures/valid_story.json`,
when `loadStory()` is called via Node subprocess in `test_contract.py`,
then the subprocess exits 0 within 10 seconds; if `node` is not on PATH the test is `pytest.skip("node not available")`; `make test` passes including the contract test.

**AC4 — M0 gate and README:**
Given all three ACs pass,
when the spike is committed,
then `README.md` documents how to run the spike and what output to expect; no M1 UI scope changes are required.

## Tasks / Subtasks

- [x] AC1: Create `src/story_generator/spike.py`
  - [x] `load_dotenv()` + read `GEMINI_API_KEY` from env; exit with clear message if missing
  - [x] Load vocab and grammar CSVs via `load_vocab_data` / `load_grammar_data` using `DATA_DIR` env var
  - [x] `build_system_prompt(vocab_data, grammar_data, chapter)` — cumulative Ch.1–N vocab + grammar (see Dev Notes)
  - [x] Call Gemini with `response_mime_type="application/json"` (see Dev Notes for exact API)
  - [x] Parse response JSON string; validate with `jsonschema.validate()` against `story.v1.json`
  - [x] Also parse with `NihonNoHonStoryV1.model_validate()` to confirm Pydantic compatibility
  - [x] Check parallel array parity for every sentence; print which sentence fails if any
  - [x] Write output to `tests/fixtures/valid_story.json` (UTF-8, no BOM; create `tests/fixtures/` if absent)
  - [x] Print clear success/failure summary to stdout
- [x] Add `spike` target to `Makefile`
- [x] AC3: Activate `tests/test_contract.py`
  - [x] Remove `@pytest.mark.skip` decorator from `test_load_story_contract`
  - [x] Confirm `packages/story-loader/dist/index.js` exists (it does — already built)
  - [x] Ensure the fixture path and Node require path in the test are correct (see Dev Notes)
- [x] AC1: Run spike against Gemini API and confirm it completes
- [x] AC2: Confirm jsonschema and Pydantic validation both pass; parallel arrays correct
- [x] AC3: Run `make test` — all 3 tests pass (2 validator + 1 contract)
- [x] AC4: Update `README.md` with spike usage and expected output

### Review Findings

- [x] [Review][Patch] `response.text` is `None` when Gemini blocks output — `json.loads(None)` raises unhelpful `TypeError`; add None check with clear error before parsing [spike.py]
- [x] [Review][Patch] Skip message `"node not on PATH"` doesn't match spec `"node not available"` [tests/test_contract.py]
- [x] [Review][Defer] FIXTURE_PATH / DATA_DIR are CWD-relative with no validation — correct via Makefile; misleading if run manually from wrong dir — deferred: spike is a one-off tool, Makefile is the approved entry point
- [x] [Review][Defer] No enforced 60-second Gemini timeout — AC1 describes observed behavior; enforcement belongs in Story 2.2 production backend
- [x] [Review][Defer] Raw Gemini response not saved on success — useful for debugging variance; deferred: low priority for a feasibility spike
- [x] [Review][Defer] Markdown fence stripping not implemented — low risk with `response_mime_type="application/json"`

## Dev Notes

### What this spike proves (and what it doesn't)

The M0 gate answers one question: **can Gemini produce a structurally valid, curriculum-calibrated Japanese story JSON in a single call?** If yes, M1 UI work begins. If no, M1 scope is reconsidered.

"Structurally valid" means: schema valid + parallel arrays intact + `loadStory()` succeeds.  
"Curriculum-calibrated" is approximated in M0 by prompt-grounding (CSVs in the system prompt). M2 adds programmatic verification.

### Gemini API usage (google-genai SDK)

`google-adk` depends on `google-genai`. Install with `pip install -r requirements.txt`. The import path is `from google import genai`.

```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

response = client.models.generate_content(
    model="gemini-2.5-flash",           # recommended for structured output
    contents=prompt,                     # single string is fine for a non-chat call
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        # Do NOT pass response_schema here for the spike.
        # NihonNoHonStoryV1 contains RootModel and Enum types that can
        # cause schema conversion issues. Use plain JSON mode + manual
        # Pydantic parsing instead — this satisfies AC2's "Pydantic structured
        # output maps it to the generated story model" requirement.
    ),
)

raw_json: str = response.text
```

Then parse and validate:
```python
import json, jsonschema
from story_generator.models import NihonNoHonStoryV1

story_dict = json.loads(raw_json)

# Jsonschema validation
with open(schema_path) as f:
    schema = json.load(f)
jsonschema.validate(instance=story_dict, schema=schema)

# Pydantic validation
story_model = NihonNoHonStoryV1.model_validate(story_dict)
```

**Why not `response_schema=NihonNoHonStoryV1`?**  
The generated model uses `Word = RootModel[constr(min_length=1)]` and `SchemaVersion` as an Enum — both cause schema conversion issues in `google-genai`'s Pydantic→JSON-Schema mapper. Plain JSON mode (`response_mime_type="application/json"` without `response_schema`) is more reliable for complex nested schemas and fully satisfies the AC. Story 2.2 can revisit structured schema enforcement.

**Timeout:** Gemini calls in the 60-second window are network-dependent. The spike has no explicit timeout — if the call hangs, `Ctrl+C` is fine. AC1 just requires a response is received within 60 seconds.

### System prompt structure

The prompt must tell Gemini:
1. What to generate (a Japanese graded reader story)
2. The calibration constraints (only use vocab/grammar up to Ch.N)
3. The exact JSON structure to output (explain the schema in natural language — don't embed the raw JSON Schema)
4. The English source story to adapt

**Vocab formatting:** Include the cumulative word list as `id | hiragana | kanji | translation` rows. This can be long (~300–500 entries for Ch.1–8). Keep it readable but don't truncate.

**Grammar formatting:** Include chapter-grouped grammar points as `[ChN] point: title — summary`. Ch.1–8 = ~25–30 points.

**Schema guidance in the prompt (critical):** Explicitly describe in the prompt:
- `words` = list of Japanese word strings (one per token, including punctuation)
- `ruby` = list of hiragana readings, parallel to `words` (null for non-kanji tokens)
- `vocab_keys` = list of integer vocab IDs from the provided list, or null if the token isn't a listed word; **must be the same length as `words` and `ruby`**
- `sentences[].id` = a stable string like `s01`, `s02`, etc.
- `grammar` (story-level) = list of grammar point identifiers used
- `sentence.grammar` = list of integer indices into the story-level grammar array

**Hardcoded fixture:**
```python
ENGLISH_SOURCE = """
Kenji is a first-year university student in Tokyo.
He is from Osaka and studies economics.
Every day after class, he goes to the library to study Japanese history.
He likes reading, but he finds kanji difficult.
On weekends, he eats ramen with his friends from class.
His friend Yuki is from Kyoto and also likes Japanese food.
They often speak Japanese together to practise.
"""

TARGET_CHAPTER = 8  # "Genki I Ch.8"
DIFFICULTY = "Genki I Ch.8"
```

### spike.py file structure

```
apps/story-generator-backend/src/story_generator/spike.py
```

Run as: `python -m story_generator.spike` from `apps/story-generator-backend/`

Module-level entrypoint:
```python
if __name__ == "__main__":
    run_spike()
```

`run_spike()` should:
1. Load `.env` with `python-dotenv`
2. Check `GEMINI_API_KEY` — print a clear message and `sys.exit(1)` if missing
3. Load CSVs from `DATA_DIR` (default `../../resources`)
4. Build prompt
5. Call Gemini (print "Calling Gemini API..." before the call so RT can see it's working)
6. Parse + validate
7. Check parallel arrays
8. Write fixture to `tests/fixtures/valid_story.json`
9. Print `✓ M0 spike complete — fixture written to tests/fixtures/valid_story.json`

### Makefile `spike` target

Add after `test:`:
```makefile
spike:
	python3 -m story_generator.spike
```

### Schema path resolution

The JSON schema lives at `packages/schema/schemas/story.v1.json`. From `apps/story-generator-backend/`, the relative path is `../../packages/schema/schemas/story.v1.json`.

```python
SCHEMA_PATH = Path(__file__).parents[4] / "packages" / "schema" / "schemas" / "story.v1.json"
```
`__file__` = `.../apps/story-generator-backend/src/story_generator/spike.py`  
`parents[4]` = monorepo root ✓

### Activating test_contract.py

The test currently has `@pytest.mark.skip`. After a successful spike run produces `tests/fixtures/valid_story.json`:

1. Remove the `@pytest.mark.skip(...)` decorator
2. The fixture path in the test is `"tests/fixtures/valid_story.json"` — correct (relative to pytest CWD = `apps/story-generator-backend/`)
3. The `require()` path is `'../../packages/story-loader/dist/index.js'` — correct (resolves to `packages/story-loader/dist/index.js` from the monorepo root)
4. `packages/story-loader/dist/index.js` already exists (built in a previous sprint)
5. The test already handles missing `node` with `pytest.skip("node not available")`

The final test should look like:
```python
def test_load_story_contract():
    """loadStory() accepts a fixture produced by the backend without throwing."""
    if not shutil.which("node"):
        pytest.skip("node not available")
    ...
```

Note: remove the `@pytest.mark.skip` but keep the inner `if not shutil.which("node"): pytest.skip(...)` guard.

### DATA_DIR resolution in spike

The spike loads CSVs using `DATA_DIR` env var. When run from `apps/story-generator-backend/`:

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()  # loads .env from CWD or parents

data_dir = Path(os.environ.get("DATA_DIR", "../../resources"))
vocab_data = load_vocab_data(data_dir / "genki1vocab.csv")
grammar_data = load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")
```

`../../resources` from `apps/story-generator-backend/` = monorepo `resources/` ✓

### Previous story learnings (Story 1.2)

- `data_loader.py` uses `utf-8-sig` for grammar CSV (BOM-safe) — nothing to change
- `VocabData.by_chapter` is a `dict[int, list[VocabEntry]]` keyed by chapter int
- `GrammarData.by_chapter` is a `dict[int, list[GrammarPoint]]`; `GrammarPoint.summary` has the full description
- `conftest.py` adds `src/` to `sys.path` — tests import `story_generator.*` without installation

### README.md additions

Add a `## M0 Spike` section:
```markdown
## M0 Spike

Generates a fixture story to prove Gemini can produce schema-valid output.

```bash
# From apps/story-generator-backend/ with .env configured:
make spike

# or:
python -m story_generator.spike
```

Expected output:
- `tests/fixtures/valid_story.json` — a schema-valid story file
- `✓ M0 spike complete` printed to stdout

The fixture is used by `tests/test_contract.py` to verify `loadStory()` compatibility.
```

### References

- Story 1.2 (scaffold): [1-2-backend-project-scaffold.md](_bmad-output/implementation-artifacts/1-2-backend-project-scaffold.md)
- Architecture (M0 gate, ARCH-21): [architecture-story-authoring-tool.md](_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- ADR-004 (event contract — not needed for spike): [docs/adr/004-agui-event-types.md](docs/adr/004-agui-event-types.md)
- story.v1.json: [packages/schema/schemas/story.v1.json](packages/schema/schemas/story.v1.json)
- genki1vocab.csv columns: `id(int), hiragana, kanji, translation, chapter(int)` — no header row
- Genki grammar CSV columns: `Chapter, Grammar Point, Descriptive Title, Detailed Summary and Scope` — has header row
- google-genai docs: https://googleapis.github.io/python-genai/

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Windows console CP1252 encoding blocked `✓` characters in print statements — replaced with ASCII `OK`.
- `python -m story_generator.spike` failed without `PYTHONPATH=src` (package not pip-installed); added to Makefile `spike` target.
- `GEMINI_API_KEY` was empty in `.env` — halted for user to add key before proceeding.
- Spike ran successfully first attempt after key added: 421 vocab entries, 46 grammar points for Ch.1–8; Gemini returned 4,748 chars; all validations passed.

### Completion Notes List

- AC1: `spike.py` implements full pipeline — dotenv load, CSV load, prompt build (~22K chars for Ch.1–8), Gemini `gemini-2.5-flash` call with `response_mime_type="application/json"`, jsonschema + parallel-array + Pydantic validation, fixture write.
- AC2: Generated story `genki-i-ch8-kenji-student-life` — 9 sentences, 7 supplemental vocab entries — passed all three validation layers.
- AC3: `test_contract.py` skip removed; `make test` → **3 passed** (validator ×2, contract ×1).
- AC4: README updated with `make spike` usage and expected output.
- `google-genai 1.75.0` confirmed available via `google-adk` dependency.

### File List

- `apps/story-generator-backend/src/story_generator/spike.py` (new)
- `apps/story-generator-backend/Makefile` (modified — added `spike` target, `PYTHONPATH=src`)
- `apps/story-generator-backend/tests/test_contract.py` (modified — removed `@pytest.mark.skip`)
- `apps/story-generator-backend/tests/fixtures/valid_story.json` (new — generated fixture)
- `apps/story-generator-backend/README.md` (modified — M0 Spike section added)
- `_bmad-output/implementation-artifacts/1-3-m0-feasibility-spike.md` (new — story file)
- `_bmad-output/implementation-artifacts/sprint-status-story-generator.yaml` (modified)
