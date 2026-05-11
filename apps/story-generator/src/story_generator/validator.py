"""
Story validator stub for nihonnohon story format.

Validates a story JSON file against the story.v1.json schema.
Out of scope for v1 sprint — stub documents the intended interface.
"""
import json
import sys
from pathlib import Path
import jsonschema


SCHEMA_PATH = Path(__file__).parents[4] / "packages" / "schema" / "schemas" / "story.v1.json"


def validate_story(story_path: str) -> bool:
    """Validate a story JSON file against story.v1.json schema."""
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)
    with open(story_path) as f:
        story = json.load(f)
    try:
        jsonschema.validate(instance=story, schema=schema)
        print(f"✓ {story_path} is valid")
        return True
    except jsonschema.ValidationError as e:
        print(f"✗ {story_path}: {e.message}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python validator.py <story.json>")
        sys.exit(1)
    success = validate_story(sys.argv[1])
    sys.exit(0 if success else 1)
