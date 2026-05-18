# story-generator-backend

Python ADK backend for the nihonnohon Story Authoring Tool.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

## Commands

| Command | Description |
|---|---|
| `make dev` | Start backend (port 8000) and frontend (port 5174) together |
| `make generate-models` | Regenerate `src/story_generator/models.py` from `story.v1.json` |
| `make test` | Run pytest test suite |

## M0 Spike

Generates a fixture story to prove Gemini can produce schema-valid output in a single call.

```bash
# From apps/story-generator-backend/ with .env configured:
make spike

# or directly:
PYTHONPATH=src python3 -m story_generator.spike
```

**Expected output:**

```
Loading curriculum data from .../resources ...
  Vocab entries Ch.1-8: 421
  Grammar points Ch.1-8: 46

Prompt length: ~22,000 chars

Calling Gemini API (gemini-2.5-flash) ...
  Response received
  OK jsonschema validation passed
  OK Parallel arrays consistent
  OK Pydantic model_validate passed

OK M0 spike complete -- fixture written to tests/fixtures/valid_story.json
  Story id:   genki-i-ch8-...
  Sentences:  ~9
```

The fixture `tests/fixtures/valid_story.json` is used by `tests/test_contract.py` to verify
`loadStory()` from `@nihonnohon/story-loader` accepts the generated output.

## Architecture

See [architecture-story-authoring-tool.md](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md) for the full design.

Key points:
- `models.py` is **auto-generated** — never edit it by hand; run `make generate-models` instead
- `DATA_DIR` env var (default `../../resources`) resolves to the monorepo `resources/` folder
- This directory is **not** a pnpm workspace member (see ADR-003)
