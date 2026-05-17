# Story 1.2: Backend Project Scaffold

Status: done

## Story

As a developer,
I want the Python backend scaffolded with its complete directory structure, data loader, validator, Pydantic codegen pipeline, and test harness skeleton,
so that the M0 spike and all subsequent M1 backend stories build on a working, testable foundation.

## Acceptance Criteria

**AC1 — Backend directory created with project files:**
Given `apps/story-generator-backend/` does not exist,
when the directory is created with `pyproject.toml`, `requirements.txt`, `Makefile`, `.env`, `.env.example`, and `README.md`,
then `pip install -r requirements.txt` installs `google-adk`, `ag-ui-protocol>=0.1.18`, `pydantic>=2.0`, `datamodel-code-generator`, `python-dotenv`, `jsonschema`; the `.env` file is gitignored; `.env.example` documents `GEMINI_API_KEY=` and `ALLOWED_ORIGIN=http://localhost:5174`.

**AC2 — Pydantic model codegen works:**
Given `packages/schema/schemas/story.v1.json` exists,
when `make generate-models` is run from `apps/story-generator-backend/`,
then `src/story_generator/models.py` is created with Pydantic v2 models and the header `# AUTO-GENERATED from story.v1.json — do not edit manually`; the file contains a model for `vocab_supplement` entries that includes the `key` field.

**AC3 — Data loader reads both CSVs:**
Given `resources/genki1vocab.csv` and `resources/Genki_grammar_for_AI_generation.csv` exist,
when `load_vocab_data(path)` and `load_grammar_data(path)` are called in `data_loader.py`,
then both return frozen dataclasses; neither raises; the vocab map is keyed by the numeric ID column; chapter groupings are preserved.

**AC4 — Validator interface and behaviour:**
Given a story dict with a missing required field (e.g., `title` absent),
when `validate(story_dict)` is called in `validator.py`,
then it returns `ValidationResult(valid=False, errors=[ValidationError(code='MISSING_FIELD', message=..., sentence_index=None)])`; it never raises an exception under any input.

**AC5 — Test harness with three passing tests:**
Given `tests/__init__.py`, `tests/test_validator.py`, and `tests/test_contract.py` exist,
when `make test` is run,
then: (1) `validate()` returns `valid=False` on a missing required field; (2) `validate()` never raises on arbitrary dict input; (3) `test_contract.py` imports successfully and its fixture test is marked `pytest.skip` pending Story 1.3 fixture.

## Tasks / Subtasks

- [x] AC1: Create `apps/story-generator-backend/` project scaffold
  - [x] `pyproject.toml` (pytest config: `testpaths = ["tests"]`, project name, Python ≥3.11)
  - [x] `requirements.txt` (all six deps with pinned minimums — see Dev Notes)
  - [x] `Makefile` with `dev`, `generate-models`, `test` targets (exact content in Dev Notes)
  - [x] `.env` (gitignored; skeleton with empty values) + `.env.example` (documented keys)
  - [x] `README.md` (brief, links architecture doc)
  - [x] Verify `.env` is covered by root `.gitignore` (it is — `/.env` pattern exists)
- [x] Create Python package skeleton
  - [x] `src/story_generator/__init__.py` (empty)
  - [x] `src/story_generator/data_loader.py` (see exact interface in Dev Notes)
  - [x] `src/story_generator/validator.py` (see exact interface; completely replaces old stub)
  - [x] `src/story_generator/models.py` — run `make generate-models` to produce this; do NOT hand-write it
  - [x] `src/story_generator/agent.py` — stub only; full implementation in Story 2.2
  - [x] `src/story_generator/tools.py` — stub only; implementation in Story 3.1 (M2)
  - [x] `src/story_generator/main.py` — stub only; full implementation in Story 2.2
- [x] AC5: Create test harness
  - [x] `tests/__init__.py` (empty)
  - [x] `tests/test_validator.py` (two tests — see Dev Notes)
  - [x] `tests/test_contract.py` (one `pytest.skip` fixture test — see Dev Notes)
- [x] AC3: Manually verify data_loader — 1172 vocab entries, 24 chapters; 23 grammar chapters loaded
- [x] AC2: Run `make generate-models` and confirm models.py contains VocabEntry model with `key` field
- [x] AC5: Run `make test` — 2 passed, 1 skipped (contract test, as expected)
- [x] Clean up old Python placeholder content from `apps/story-generator/`
  - [x] Remove `apps/story-generator/requirements.txt`
  - [x] Remove `apps/story-generator/src/` directory
  - [x] Update `apps/story-generator/README.md` to remove Python references

### Review Findings

- [x] [Review][Patch] Makefile `/tmp` path fails on Windows — replace `cat - ... > /tmp/models_tmp.py && mv` with `python3 -c` string prepend [Makefile:generate-models]
- [x] [Review][Patch] Grammar CSV BOM causes KeyError — `load_grammar_data` uses `encoding="utf-8"`; should be `"utf-8-sig"` to strip BOM if present [data_loader.py:load_grammar_data]
- [x] [Review][Patch] Test assertion `"title" in e.message` also matches `"title_ja"` — tighten to exact message string [tests/test_validator.py:test_validate_missing_field_returns_invalid]
- [x] [Review][Defer] Duplicate vocab ID in CSV silently overwrites `by_id` entry [data_loader.py:load_vocab_data] — deferred: trusted startup data; silent overwrite is low risk; warn log can be added in Story 2.2
- [x] [Review][Defer] `ValidationResult` mutable `errors` list despite `frozen=True` [validator.py:ValidationResult] — deferred: no external callers yet; harden API surface in Story 2.2
- [x] [Review][Defer] `requirements.txt` has no pinned versions [requirements.txt] — deferred: lockfile strategy is an infrastructure decision beyond Story 1.2 scope
- [x] [Review][Defer] Malformed CSV rows (bad int conversion) raise `ValueError` uncaught [data_loader.py] — deferred: trusted reference data; fail-fast at startup is correct behavior

## Dev Notes

### Directory structure to create

```
apps/story-generator-backend/
├── pyproject.toml
├── requirements.txt
├── Makefile
├── .env                        ← gitignored; GEMINI_API_KEY=, ALLOWED_ORIGIN=
├── .env.example                ← committed; GEMINI_API_KEY=, ALLOWED_ORIGIN=http://localhost:5174
├── README.md
├── src/
│   └── story_generator/
│       ├── __init__.py
│       ├── main.py             ← stub
│       ├── agent.py            ← stub
│       ├── models.py           ← AUTO-GENERATED (run make generate-models)
│       ├── tools.py            ← stub
│       ├── validator.py        ← IMPLEMENT THIS (see interface below)
│       └── data_loader.py      ← IMPLEMENT THIS (see interface below)
└── tests/
    ├── __init__.py
    ├── test_validator.py
    └── test_contract.py
```

### requirements.txt (exact content)

```
google-adk
ag-ui-protocol>=0.1.18
pydantic>=2.0
datamodel-code-generator
python-dotenv
jsonschema
```

### pyproject.toml

```toml
[project]
name = "story-generator-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = []

[tool.pytest.ini_options]
testpaths = ["tests"]
```

### Makefile (exact content, note tab indentation required)

```makefile
.PHONY: dev generate-models test

generate-models:
	datamodel-codegen \
	  --input ../../packages/schema/schemas/story.v1.json \
	  --input-file-type jsonschema \
	  --output-model-type pydantic_v2.BaseModel \
	  --output src/story_generator/models.py
	@printf '# AUTO-GENERATED from story.v1.json — do not edit manually\n' | \
	  cat - src/story_generator/models.py > /tmp/models_tmp.py && \
	  mv /tmp/models_tmp.py src/story_generator/models.py

dev:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; true
	@lsof -ti:5174 | xargs kill -9 2>/dev/null; true
	python -m uvicorn story_generator.main:app --port 8000 --reload & \
	BACKEND_PID=$$!; \
	trap "kill $$BACKEND_PID 2>/dev/null" EXIT; \
	cd ../story-generator && pnpm dev

test:
	pytest
```

**Makefile gotcha:** Every recipe line must be indented with a **real tab character**, not spaces. Most editors convert tabs to spaces — verify with `cat -A Makefile` and confirm `^I` at the start of recipe lines.

### validator.py interface (complete implementation for Story 1.2)

The new `validator.py` is **not** based on the old stub (`validate_story(path: str) -> bool`). It has a completely different interface. Do not port any code from the old stub.

```python
"""Structural validator for nihonnohon story dicts."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ValidationError:
    code: str            # MISSING_FIELD | PARALLEL_ARRAY_MISMATCH | ... (more added in Story 2.2)
    message: str
    sentence_index: int | None  # None when error is not sentence-specific


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    errors: list[ValidationError]


# Required top-level fields per story.v1.json
_REQUIRED_FIELDS = {"schema_version", "id", "title", "title_ja", "language", "description", "sentences"}


def validate(story_dict: dict) -> ValidationResult:
    """Validate structural invariants of a story dict. Never raises."""
    # Story 1.2 scope: required-field check only.
    # Parallel array parity, grammar indices, vocab key resolution added in Story 2.2.
    try:
        errors: list[ValidationError] = []
        missing = _REQUIRED_FIELDS - set(story_dict.keys())
        for field in sorted(missing):
            errors.append(ValidationError(
                code="MISSING_FIELD",
                message=f"Required field '{field}' is absent.",
                sentence_index=None,
            ))
        return ValidationResult(valid=not errors, errors=errors)
    except Exception as exc:  # noqa: BLE001
        return ValidationResult(
            valid=False,
            errors=[ValidationError(code="VALIDATION_ERROR", message=str(exc), sentence_index=None)],
        )
```

**Critical:** The outer `try/except Exception` ensures `validate()` never raises, satisfying AC4 and test (2).

### data_loader.py interface

**CSV column layouts (no header in vocab CSV; grammar CSV has a header):**

`genki1vocab.csv` columns (0-indexed):
- [0] id — integer, 1-based, unique
- [1] hiragana
- [2] kanji (may be empty string)
- [3] translation
- [4] chapter — integer

`Genki_grammar_for_AI_generation.csv` columns (has header row):
- Chapter — integer
- Grammar Point — string (e.g. "1.1")
- Descriptive Title — string
- Detailed Summary and Scope — string

```python
"""CSV data loaders for curriculum reference data. Called once at backend startup."""
import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VocabEntry:
    id: int
    hiragana: str
    kanji: str
    translation: str
    chapter: int


@dataclass(frozen=True)
class GrammarPoint:
    chapter: int
    point: str       # e.g. "1.1"
    title: str
    summary: str


@dataclass(frozen=True)
class VocabData:
    """Vocab keyed by numeric id; also grouped by chapter."""
    by_id: dict[int, VocabEntry]           # O(1) lookup by id
    by_chapter: dict[int, list[VocabEntry]] # cumulative ceiling grouping


@dataclass(frozen=True)
class GrammarData:
    """Grammar points grouped by chapter."""
    by_chapter: dict[int, list[GrammarPoint]]


def load_vocab_data(path: str | Path) -> VocabData:
    """Load genki1vocab.csv into frozen VocabData. Never raises on valid file."""
    ...


def load_grammar_data(path: str | Path) -> GrammarData:
    """Load Genki_grammar_for_AI_generation.csv into frozen GrammarData. Never raises on valid file."""
    ...
```

Key implementation notes:
- Vocab CSV has **no header row** — start reading from row 0
- Grammar CSV **has a header row** — use `csv.DictReader`
- Both return frozen dataclasses (use `@dataclass(frozen=True)` throughout)
- `VocabData.by_chapter` maps each chapter number to the list of entries for that chapter; the agent builds cumulative ceilings by taking `union(by_chapter[1..N])`

### models.py — always generated, never hand-edited

Run `make generate-models` from `apps/story-generator-backend/`. Do not write `models.py` by hand. The Makefile target prepends the `# AUTO-GENERATED` header automatically.

After running, verify the file contains a `VocabEntry`/`VocabSupplementItem` model that includes a `key` field (integer). This was added to `story.v1.json` in commit `b391e25` and must be reflected in the generated models.

### Stub files

`main.py` — minimal stub (Story 2.2 implements the real server):
```python
"""ADK agent server entry point — stub for Story 1.2. Full implementation in Story 2.2."""
# FastAPI / ADK api_server wiring goes here in Story 2.2.
```

`agent.py` — minimal stub:
```python
"""ADK agent definition — stub for Story 1.2. Full implementation in Story 2.2."""
```

`tools.py` — minimal stub:
```python
"""ADK tool definitions for M2 ReAct workflow — stub for Story 1.2. Implementation in Story 3.1."""
```

### Test harness implementation

**tests/test_validator.py** (two tests required for AC5):
```python
from story_generator.validator import validate, ValidationResult


def test_validate_missing_field_returns_invalid():
    """validate() returns valid=False with MISSING_FIELD error when title is absent."""
    result = validate({"schema_version": "1", "id": "x", "title_ja": "x",
                       "language": "ja", "description": "x", "sentences": []})
    assert isinstance(result, ValidationResult)
    assert result.valid is False
    assert any(e.code == "MISSING_FIELD" and "title" in e.message for e in result.errors)


def test_validate_never_raises():
    """validate() must not raise under any input — including None, empty dict, garbage."""
    for bad in [None, {}, {"junk": 123}, [], "string", 42]:
        result = validate(bad)  # type: ignore[arg-type]
        assert isinstance(result, ValidationResult)
        assert result.valid is False
```

**tests/test_contract.py** (one skipped fixture test):
```python
"""Cross-language contract test: loadStory() from @nihonnohon/story-loader.
Full test activated in Story 1.3 when a fixture JSON file is available.
"""
import subprocess
import shutil
import pytest


@pytest.mark.skip(reason="Fixture JSON not yet available — activated in Story 1.3")
def test_load_story_contract():
    """loadStory() accepts a fixture produced by the backend without throwing."""
    if not shutil.which("node"):
        pytest.skip("node not on PATH")
    fixture_path = "tests/fixtures/valid_story.json"
    script = (
        f"const {{loadStory}} = require('@nihonnohon/story-loader');"
        f"const s = require('fs').readFileSync('{fixture_path}', 'utf8');"
        f"loadStory(s); console.log('ok');"
    )
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr
```

Note: The `require('@nihonnohon/story-loader')` path resolution depends on the package being built. In Story 1.3 this test will be updated to use the correct dist path. For now, the skip means this is purely a structural placeholder.

### .env and .gitignore

Root `.gitignore` already contains `.env` (confirmed). A local `.env` file in `apps/story-generator-backend/` is therefore automatically gitignored — no additional `.gitignore` needed in the backend directory.

`.env` (create but do NOT commit):
```
GEMINI_API_KEY=
ALLOWED_ORIGIN=http://localhost:5174
DATA_DIR=../../resources
```

`.env.example` (commit this):
```
# Copy to .env and fill in your values
GEMINI_API_KEY=your_gemini_api_key_here
ALLOWED_ORIGIN=http://localhost:5174
DATA_DIR=../../resources
```

### Migration: clean up old Python placeholder in apps/story-generator/

`apps/story-generator/` was previously a Python placeholder. Story 1.2 moves the Python backend to `apps/story-generator-backend/`. The old Python artefacts must be removed to avoid confusing future agents:

- **Delete:** `apps/story-generator/requirements.txt`
- **Delete:** `apps/story-generator/src/` (contains stub `__init__.py` and `validator.py`)
- **Update:** `apps/story-generator/README.md` — remove references to Python usage and the old stub validator; this directory is now the React frontend (full update in Story 2.1, but remove the misleading parts now)

### Path to resources CSVs from backend

The backend root is `apps/story-generator-backend/`. The CSVs are at `resources/` from the monorepo root. Default path in `.env`: `DATA_DIR=../../resources`. So from the backend CWD, `../../resources/genki1vocab.csv` resolves correctly.

`data_loader.py` should accept a `Path` or `str` argument so callers can pass the resolved `DATA_DIR` path. Do not hardcode the `../../resources/` relative path inside the loader.

### Project Structure Notes

**No pnpm involvement.** `apps/story-generator-backend/` is explicitly excluded from `pnpm-workspace.yaml` (ADR-003). Do not add a `package.json` here. Python dependencies are managed via `pip` and `requirements.txt`.

**Running make test.** From `apps/story-generator-backend/`, ensure the virtualenv is active and `pip install -r requirements.txt` has been run. Then: `make test`. The three expected outcomes: two tests in `test_validator.py` pass; one test in `test_contract.py` is shown as `SKIPPED`.

### References

- Architecture — full backend structure: [architecture-story-authoring-tool.md](../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md)
- ADR-003 (workspace exclusion): [docs/adr/003-story-generator-out-of-scope.md](docs/adr/003-story-generator-out-of-scope.md)
- story.v1.json schema: [packages/schema/schemas/story.v1.json](packages/schema/schemas/story.v1.json)
- Vocab CSV: [resources/genki1vocab.csv](resources/genki1vocab.csv)
- Grammar CSV: [resources/Genki_grammar_for_AI_generation.csv](resources/Genki_grammar_for_AI_generation.csv)
- Epics story definition: [epics-story-authoring-tool.md — Story 1.2](_bmad-output/planning-artifacts/epics-story-authoring-tool.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `datamodel-codegen` CLI not on PATH; used `python3 -m datamodel_code_generator` instead — updated Makefile accordingly.
- `conftest.py` added to inject `src/` into `sys.path` so pytest can import `story_generator` without pip-installing.
- UnicodeEncodeError on Windows console when printing Japanese from data_loader verify script — irrelevant; data loaded correctly (1172 entries confirmed).

### Completion Notes List

- AC1: Full project scaffold created in `apps/story-generator-backend/`.
- AC2: `make generate-models` (via `python3 -m datamodel_code_generator`) produces `models.py` with `VocabEntry` containing `key: conint(ge=0)` and `vocab_supplement: list[VocabEntry]`.
- AC3: `load_vocab_data` loads 1172 entries across chapters 0–23; `load_grammar_data` loads 23 grammar chapters — both return frozen dataclasses, neither raises.
- AC4: `validate()` returns `ValidationResult(valid=False, errors=[ValidationError(code='MISSING_FIELD', ...)])` on missing field; outer try/except ensures it never raises.
- AC5: `pytest` → 2 passed, 1 skipped. Skipped test is `test_load_story_contract` (awaits Story 1.3 fixture).
- Cleanup: removed `apps/story-generator/requirements.txt` and `apps/story-generator/src/`; updated README.

### File List

- `apps/story-generator-backend/pyproject.toml` (new)
- `apps/story-generator-backend/requirements.txt` (new)
- `apps/story-generator-backend/Makefile` (new)
- `apps/story-generator-backend/.env` (new — gitignored)
- `apps/story-generator-backend/.env.example` (new)
- `apps/story-generator-backend/README.md` (new)
- `apps/story-generator-backend/conftest.py` (new)
- `apps/story-generator-backend/src/story_generator/__init__.py` (new)
- `apps/story-generator-backend/src/story_generator/validator.py` (new)
- `apps/story-generator-backend/src/story_generator/data_loader.py` (new)
- `apps/story-generator-backend/src/story_generator/models.py` (new — generated)
- `apps/story-generator-backend/src/story_generator/agent.py` (new — stub)
- `apps/story-generator-backend/src/story_generator/tools.py` (new — stub)
- `apps/story-generator-backend/src/story_generator/main.py` (new — stub)
- `apps/story-generator-backend/tests/__init__.py` (new)
- `apps/story-generator-backend/tests/test_validator.py` (new)
- `apps/story-generator-backend/tests/test_contract.py` (new)
- `apps/story-generator/requirements.txt` (deleted)
- `apps/story-generator/src/` (deleted)
- `apps/story-generator/README.md` (modified)
