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

## Architecture

See [architecture-story-authoring-tool.md](../../_bmad-output/planning-artifacts/architecture-story-authoring-tool.md) for the full design.

Key points:
- `models.py` is **auto-generated** — never edit it by hand; run `make generate-models` instead
- `DATA_DIR` env var (default `../../resources`) resolves to the monorepo `resources/` folder
- This directory is **not** a pnpm workspace member (see ADR-003)
