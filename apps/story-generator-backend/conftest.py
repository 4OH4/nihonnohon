import sys
from pathlib import Path

# Make src/story_generator importable without pip-installing the package.
sys.path.insert(0, str(Path(__file__).parent / "src"))
