"""Cross-language contract test: loadStory() from @nihonnohon/story-loader.

Full test activated in Story 1.3 when a fixture JSON file is produced by the M0 spike.
"""
import shutil
import subprocess

import pytest


@pytest.mark.skip(reason="Fixture JSON not yet available — activated in Story 1.3")
def test_load_story_contract():
    """loadStory() accepts a fixture produced by the backend without throwing."""
    if not shutil.which("node"):
        pytest.skip("node not on PATH")

    fixture_path = "tests/fixtures/valid_story.json"
    # Resolve the built story-loader CJS entry relative to the monorepo root.
    # Story 1.3 will adjust this path once the dist is confirmed built.
    script = (
        "const { loadStory } = require('../../packages/story-loader/dist/index.js');"
        f"const s = require('fs').readFileSync('{fixture_path}', 'utf8');"
        "loadStory(s); console.log('ok');"
    )
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
