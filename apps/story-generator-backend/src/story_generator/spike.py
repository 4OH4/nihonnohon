"""M0 feasibility spike: single Gemini call → schema-valid nihonnohon story JSON.

Run from apps/story-generator-backend/:
    python -m story_generator.spike

Requires GEMINI_API_KEY in .env (or environment). Uses DATA_DIR env var for CSV paths
(default: ../../resources relative to CWD).

What this proves: Gemini can produce a structurally valid, curriculum-calibrated Japanese
story JSON in a single call — parallel arrays intact, schema valid, loadStory() compatible.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Hardcoded spike fixtures
# ---------------------------------------------------------------------------

ENGLISH_SOURCE = """
Kenji is a first-year university student in Tokyo.
He is from Osaka and studies economics.
Every day after class, he goes to the library to study Japanese history.
He likes reading, but he finds kanji difficult.
On weekends, he eats ramen with his friends from class.
His friend Yuki is from Kyoto and also likes Japanese food.
They often speak Japanese together to practise.
"""

TARGET_CHAPTER = 8
DIFFICULTY = "Genki I Ch.8"

SCHEMA_PATH = (
    Path(__file__).parents[4] / "packages" / "schema" / "schemas" / "story.v1.json"
)
FIXTURE_PATH = Path("tests/fixtures/valid_story.json")


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def build_system_prompt(vocab_data, grammar_data, chapter: int, english_source: str) -> str:
    """Build the Gemini prompt with cumulative Ch.1–N vocab and grammar."""
    # Cumulative vocab entries up to this chapter
    vocab_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for entry in vocab_data.by_chapter.get(ch, []):
            kanji_part = f" ({entry.kanji})" if entry.kanji else ""
            vocab_lines.append(f"  {entry.id} | {entry.hiragana}{kanji_part} | {entry.translation}")

    vocab_block = "\n".join(vocab_lines) if vocab_lines else "  (none)"

    # Cumulative grammar points up to this chapter
    grammar_lines: list[str] = []
    for ch in range(1, chapter + 1):
        for gp in grammar_data.by_chapter.get(ch, []):
            grammar_lines.append(f"  [Ch{ch} {gp.point}] {gp.title}: {gp.summary}")

    grammar_block = "\n".join(grammar_lines) if grammar_lines else "  (none)"

    return f"""You are a Japanese language curriculum expert generating a graded reader story for learners studying with the Genki I textbook up to Chapter {chapter}.

## Task

Adapt the English source story below into a short Japanese graded reader story. The story must be calibrated to Genki I Chapter {chapter} — use ONLY the vocabulary and grammar patterns listed below.

## English Source Story

{english_source.strip()}

## Curriculum Constraints

### Vocabulary available (cumulative Ch.1–{chapter})
Format: ID | hiragana (kanji) | English meaning
{vocab_block}

### Grammar patterns available (cumulative Ch.1–{chapter})
{grammar_block}

## Output Format

Respond with a single JSON object matching this exact structure:

{{
  "schema_version": "1",
  "id": "<kebab-case identifier embedding difficulty and topic, e.g. genki-i-ch8-student-life>",
  "title": "<English story title>",
  "title_ja": "<Japanese story title>",
  "language": "ja",
  "description": "<1-2 sentence English description of the story>",
  "difficulty": "{DIFFICULTY}",
  "grammar": ["<grammar pattern string 1>", "<grammar pattern string 2>", ...],
  "vocab_supplement": [
    {{"key": <integer starting at 10000>, "word": "<word>", "hiragana": "<reading>", "translation": "<English>"}}
  ],
  "sentences": [
    {{
      "id": "s01",
      "words": ["<word1>", "<word2>", ...],
      "ruby": ["<reading1 or null>", "<reading2 or null>", ...],
      "vocab_keys": [<vocab_id or null>, <vocab_id or null>, ...],
      "translation": "<English translation of this sentence>",
      "grammar": [<index into story-level grammar array>, ...]
    }}
  ]
}}

## Critical Rules

1. **Parallel arrays**: `words`, `ruby`, and `vocab_keys` MUST have the SAME LENGTH for every sentence. This is a hard requirement — mismatched lengths will fail validation.

2. **vocab_keys values**:
   - Use the integer ID from the vocabulary list above if the token matches a listed word
   - Use `null` for particles, punctuation, conjunctions, or any token not in the vocabulary list
   - Supplemental vocabulary (words needed but NOT in the list) must appear in `vocab_supplement` with a unique integer `key` starting at 10000, and that same key used in `vocab_keys`

3. **ruby values**:
   - Provide the hiragana reading for tokens that contain kanji
   - Use `null` for tokens that are already hiragana, katakana, or punctuation

4. **sentence.id**: Use "s01", "s02", etc.

5. **sentence.grammar**: List the 0-based indices into the story-level `grammar` array for patterns used in that sentence.

6. **id field**: Must be suitable as a filename (kebab-case, no spaces, no special characters except hyphens).

7. **Vocabulary discipline**: Only use vocabulary from the provided list or `vocab_supplement`. Do not introduce vocabulary beyond Chapter {chapter} without adding it to `vocab_supplement`.

Return ONLY the JSON object. No markdown, no code fences, no explanation.
"""


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def check_parallel_arrays(story_dict: dict) -> list[str]:
    """Return a list of error messages for any parallel array mismatches."""
    errors: list[str] = []
    for i, sentence in enumerate(story_dict.get("sentences", [])):
        words = sentence.get("words", [])
        ruby = sentence.get("ruby") or []
        vocab_keys = sentence.get("vocab_keys") or []
        sid = sentence.get("id", f"sentence[{i}]")
        if len(ruby) != 0 and len(ruby) != len(words):
            errors.append(
                f"{sid}: words={len(words)} but ruby={len(ruby)} (must match or ruby must be omitted)"
            )
        if len(vocab_keys) != 0 and len(vocab_keys) != len(words):
            errors.append(
                f"{sid}: words={len(words)} but vocab_keys={len(vocab_keys)} (must match or vocab_keys must be omitted)"
            )
    return errors


# ---------------------------------------------------------------------------
# Main spike
# ---------------------------------------------------------------------------

def run_spike() -> None:
    """Execute the M0 feasibility spike."""
    load_dotenv()

    # -- API key check -------------------------------------------------------
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not set. Add it to .env or your environment.", file=sys.stderr)
        sys.exit(1)

    # -- Load curriculum data ------------------------------------------------
    data_dir = Path(os.environ.get("DATA_DIR", "../../resources"))
    print(f"Loading curriculum data from {data_dir.resolve()} …")

    from story_generator.data_loader import load_vocab_data, load_grammar_data
    vocab_data = load_vocab_data(data_dir / "genki1vocab.csv")
    grammar_data = load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")

    ch_vocab_count = sum(
        len(vocab_data.by_chapter.get(ch, []))
        for ch in range(1, TARGET_CHAPTER + 1)
    )
    ch_grammar_count = sum(
        len(grammar_data.by_chapter.get(ch, []))
        for ch in range(1, TARGET_CHAPTER + 1)
    )
    print(f"  Vocab entries Ch.1–{TARGET_CHAPTER}: {ch_vocab_count}")
    print(f"  Grammar points Ch.1–{TARGET_CHAPTER}: {ch_grammar_count}")

    # -- Build prompt --------------------------------------------------------
    prompt = build_system_prompt(vocab_data, grammar_data, TARGET_CHAPTER, ENGLISH_SOURCE)
    print(f"\nPrompt length: {len(prompt):,} chars")

    # -- Call Gemini ---------------------------------------------------------
    print("\nCalling Gemini API (gemini-2.5-flash) …")
    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError:
        print(
            "ERROR: google-genai not installed. Run: pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_json = response.text
    if raw_json is None:
        finish = getattr(response, "candidates", [{}])
        reason = getattr(finish[0] if finish else {}, "finish_reason", "unknown") if finish else "unknown"
        print(f"\nFAILED: Gemini returned no text (finish_reason={reason}). Check safety filters or prompt length.", file=sys.stderr)
        sys.exit(1)
    print(f"  Response received ({len(raw_json):,} chars)")

    # -- Parse JSON ----------------------------------------------------------
    try:
        story_dict = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        print(f"\nFAILED: Response is not valid JSON.\n{exc}", file=sys.stderr)
        print("Raw response:", raw_json[:500], file=sys.stderr)
        sys.exit(1)

    # -- jsonschema validation -----------------------------------------------
    print("\nValidating against story.v1.json …")
    import jsonschema
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema = json.load(f)
    try:
        jsonschema.validate(instance=story_dict, schema=schema)
        print("  OK jsonschema validation passed")
    except jsonschema.ValidationError as exc:
        print(f"\nFAILED: jsonschema validation.\n{exc.message}", file=sys.stderr)
        sys.exit(1)

    # -- Parallel array check ------------------------------------------------
    array_errors = check_parallel_arrays(story_dict)
    if array_errors:
        print("\nFAILED: Parallel array mismatches:", file=sys.stderr)
        for err in array_errors:
            print(f"  {err}", file=sys.stderr)
        sys.exit(1)
    print("  OK Parallel arrays consistent")

    # -- Pydantic validation -------------------------------------------------
    print("  Parsing with NihonNoHonStoryV1 Pydantic model …")
    from story_generator.models import NihonNoHonStoryV1
    try:
        NihonNoHonStoryV1.model_validate(story_dict)
        print("  OK Pydantic model_validate passed")
    except Exception as exc:
        print(f"\nFAILED: Pydantic validation.\n{exc}", file=sys.stderr)
        sys.exit(1)

    # -- Write fixture -------------------------------------------------------
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FIXTURE_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(story_dict, f, ensure_ascii=False, indent=2)
    print(f"\nOK M0 spike complete — fixture written to {FIXTURE_PATH}")
    print(f"  Story id:         {story_dict.get('id', '?')}")
    print(f"  Title:            {story_dict.get('title', '?')}")
    print(f"  Sentences:        {len(story_dict.get('sentences', []))}")
    print(f"  Vocab supplement: {len(story_dict.get('vocab_supplement') or [])}")


if __name__ == "__main__":
    run_spike()
