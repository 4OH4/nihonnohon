"""Registry of eval harness adapters.

An adapter is any ``Callable[[str], list[dict]]`` mapping the frozen Japanese input to
one ``{surface, dict, ruby, pos?}`` dict per word. ``ADAPTERS`` maps a CLI-selectable name
to the adapter's factory function; ``run_eval.py`` builds only the chosen one.
"""
from __future__ import annotations

from typing import Callable

from adapters.gemini_analysis import make_gemini_analysis_adapter
from adapters.sudachi_baseline import make_sudachi_baseline_adapter

#: Adapter contract — given the frozen Japanese input (a whole story's text), return one
#: dict per word token. Each dict must carry: surface, dict, ruby; pos is optional (used
#: only for scoping).
Adapter = Callable[[str], list[dict]]

#: name → factory, selected via `--adapter` on the CLI.
ADAPTERS: dict[str, Callable[..., Adapter]] = {
    "sudachi-baseline": make_sudachi_baseline_adapter,
    "gemini-analysis": make_gemini_analysis_adapter,
}
