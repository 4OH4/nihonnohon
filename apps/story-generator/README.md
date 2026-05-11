# story-generator

AI-powered story authoring tool for nihonnohon. This is a separate project,
developed independently from the nihonnohon web app.

## Purpose

Generates valid nihonnohon story JSON files using a commercial LLM API (e.g. Gemini).
The generated stories conform to the story format specification and can be loaded
directly by the nihonnohon app.

## Contract

**Consumes:**
- `packages/schema/schemas/story.v1.json` — JSON Schema defining the story format contract
- `scripts/data/genki-vocab.csv` — Genki vocabulary reference for word selection

**Produces:**
- Valid story JSON conforming to `schema_version: "1"`
- All three parallel arrays (`words`, `ruby`, `vocab_keys`) populated with equal lengths per sentence

## Validation

Use `validator.py` to validate a generated story before use:

```bash
python src/story_generator/validator.py path/to/story.json
```

Requires Python 3.11+ and `pip install -r requirements.txt`.

## Status

Out of scope for the nihonnohon development sprint. This directory is a placeholder
establishing the project boundary and interface contract.

See ADR `docs/adr/003-story-generator-out-of-scope.md` for the rationale.
