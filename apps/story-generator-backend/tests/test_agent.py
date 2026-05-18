"""Tests for StoryGeneratorAgent with injectable mock Gemini client.

No GEMINI_API_KEY is required — all tests use the injection seam.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "valid_story.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _collect(async_gen) -> list[dict]:
    """Consume an async generator synchronously and return a list of events."""
    async def _run():
        return [e async for e in async_gen]

    return asyncio.run(_run())


def make_mock_client(fixture_json: str):
    """Return a callable matching agent._get_caller() interface.

    Accepts (model, contents, config) and returns a response-like object with .text.
    """
    return lambda model, contents, config: SimpleNamespace(text=fixture_json)


@pytest.fixture(scope="module")
def fixture_json() -> str:
    return FIXTURE_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def vocab_data():
    from story_generator.data_loader import load_vocab_data
    data_dir = Path(__file__).parents[3] / "resources"
    return load_vocab_data(data_dir / "genki1vocab.csv")


@pytest.fixture(scope="module")
def grammar_data():
    from story_generator.data_loader import load_grammar_data
    data_dir = Path(__file__).parents[3] / "resources"
    return load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_events_emitted_in_order(vocab_data, grammar_data, fixture_json):
    """RUN_STARTED arrives first; RUN_FINISHED arrives last and has resultType='story'."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json)
    )
    events = _collect(
        agent.generate(run_id="test-run-1", input_text="A test story.", chapter="Genki I Ch.3")
    )
    types = [e["type"] for e in events]

    assert types[0] == "RUN_STARTED", f"Expected RUN_STARTED first, got: {types}"
    assert "RUN_FINISHED" in types, f"RUN_FINISHED missing from: {types}"
    assert types[-1] == "RUN_FINISHED", f"Expected RUN_FINISHED last, got: {types}"

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "story"
    assert finished["content"]  # non-empty JSON


def test_run_started_echoes_run_id(vocab_data, grammar_data, fixture_json):
    """RUN_STARTED event echoes the client-provided runId."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json)
    )
    events = _collect(
        agent.generate(run_id="my-run-42", input_text="x", chapter="Genki I Ch.1")
    )
    started = next(e for e in events if e["type"] == "RUN_STARTED")
    assert started["runId"] == "my-run-42"


def test_system_prompt_includes_cumulative_vocab_up_to_chapter(vocab_data, grammar_data, fixture_json):
    """System prompt for Ch.3 includes Ch.1–3 vocab; chapter ceiling is respected."""
    from story_generator.agent import StoryGeneratorAgent

    captured: list[str] = []

    def capturing_client(model, contents, config):
        captured.append(contents)
        return SimpleNamespace(text=fixture_json)

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=capturing_client)
    _collect(agent.generate(run_id="t", input_text="test", chapter="Genki I Ch.3"))

    assert captured, "No Gemini call was made"
    prompt = captured[0]

    # P7: assert the formatted vocab line (ID | hiragana | ...) not bare hiragana,
    # to avoid false positives from single-char particles that appear in prompt template text
    for ch in range(1, 4):
        for entry in vocab_data.by_chapter.get(ch, []):
            vocab_line_prefix = f"  {entry.id} |"
            assert vocab_line_prefix in prompt, (
                f"Ch.{ch} vocab entry id={entry.id} ('{entry.hiragana}') missing from prompt"
            )

    # A Ch.4-only entry must NOT appear in the prompt (ceiling enforced)
    ch1_to_3_ids = {
        e.id
        for ch in range(1, 4)
        for e in vocab_data.by_chapter.get(ch, [])
    }
    for entry in vocab_data.by_chapter.get(4, [])[:5]:
        if entry.id not in ch1_to_3_ids:
            assert f"  {entry.id} |" not in prompt, (
                f"Ch.4-only vocab id={entry.id} should not appear in Ch.3 prompt"
            )
            break


def test_system_prompt_includes_grammar_for_chapter(vocab_data, grammar_data, fixture_json):
    """System prompt includes grammar points up to the requested chapter."""
    from story_generator.agent import StoryGeneratorAgent

    captured: list[str] = []

    def capturing_client(model, contents, config):
        captured.append(contents)
        return SimpleNamespace(text=fixture_json)

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=capturing_client)
    _collect(agent.generate(run_id="t", input_text="test", chapter="Genki I Ch.3"))

    prompt = captured[0]
    for ch in range(1, 4):
        for gp in grammar_data.by_chapter.get(ch, []):
            assert gp.title in prompt, (
                f"Ch.{ch} grammar '{gp.title}' missing from prompt"
            )


def test_validation_failure_emits_error_not_finished(vocab_data, grammar_data):
    """A story with parallel-array mismatch causes ERROR instead of RUN_FINISHED."""
    from story_generator.agent import StoryGeneratorAgent

    bad_story = json.dumps({
        "schema_version": "1",
        "id": "test",
        "title": "Test",
        "title_ja": "テスト",
        "language": "ja",
        "description": "test",
        "sentences": [
            {
                "id": "s01",
                "words": ["a", "b"],
                "ruby": ["r1"],          # length 1 ≠ words length 2
                "vocab_keys": [None, None],
            }
        ],
    })
    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_client=make_mock_client(bad_story)
    )
    events = _collect(
        agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1")
    )

    types = [e["type"] for e in events]
    assert "ERROR" in types, f"Expected ERROR event, got: {types}"
    assert "RUN_FINISHED" not in types, "RUN_FINISHED must not be emitted on validation failure"

    error_event = next(e for e in events if e["type"] == "ERROR")
    assert error_event["code"] == "VALIDATION_ERROR"


def test_invalid_json_response_emits_error(vocab_data, grammar_data):
    """A non-JSON Gemini response causes GENERATION_FAILED ERROR."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_client=make_mock_client("not-valid-json{{{")
    )
    events = _collect(
        agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1")
    )

    assert any(
        e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events
    ), f"Expected GENERATION_FAILED error, got: {events}"


def test_none_response_emits_error(vocab_data, grammar_data):
    """A None .text (Gemini safety filter) causes GENERATION_FAILED ERROR."""
    from story_generator.agent import StoryGeneratorAgent

    none_client = lambda model, contents, config: SimpleNamespace(text=None)  # noqa: E731
    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=none_client)
    events = _collect(
        agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1")
    )

    assert any(
        e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events
    ), f"Expected GENERATION_FAILED error, got: {events}"


def test_cancel_before_gemini_call(vocab_data, grammar_data, fixture_json):
    """If cancel_event is set before the Gemini call, RUN_CANCELLED is emitted."""
    from story_generator.agent import StoryGeneratorAgent
    import asyncio

    cancel = asyncio.Event()
    cancel.set()  # pre-set

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json)
    )
    events = _collect(
        agent.generate(
            run_id="t", input_text="x", chapter="Genki I Ch.1",
            cancel_event=cancel,
        )
    )

    types = [e["type"] for e in events]
    assert "RUN_CANCELLED" in types, f"Expected RUN_CANCELLED, got: {types}"
    assert "RUN_FINISHED" not in types


# ---------------------------------------------------------------------------
# Path B tests
# ---------------------------------------------------------------------------


def test_path_b_phase1_emits_proposal(vocab_data, grammar_data):
    """Path B phase 1 (topic → English proposal) emits RUN_FINISHED with resultType='proposal'."""
    from story_generator.agent import StoryGeneratorAgent

    proposal_text = "Ken goes to a coffee shop near the university."
    proposal_client = lambda model, contents, config: SimpleNamespace(text=proposal_text)  # noqa: E731

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=proposal_client)
    events = _collect(
        agent.generate(
            run_id="pb1-test",
            chapter="Genki I Ch.5",
            path_mode="B",
            topic="A student visits a coffee shop",
        )
    )

    types = [e["type"] for e in events]
    assert types[0] == "RUN_STARTED"
    assert "RUN_FINISHED" in types
    assert "ERROR" not in types, f"Unexpected ERROR: {events}"

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "proposal"
    assert finished["content"] == proposal_text


def test_path_b_phase1_strips_proposal_text(vocab_data, grammar_data):
    """Proposal content is stripped of leading/trailing whitespace."""
    from story_generator.agent import StoryGeneratorAgent

    raw_text = "  Ken visits the library.  \n"
    client = lambda model, contents, config: SimpleNamespace(text=raw_text)  # noqa: E731

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=client)
    events = _collect(
        agent.generate(run_id="t", chapter="Genki I Ch.3", path_mode="B", topic="library")
    )

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["content"] == raw_text.strip()


def test_path_b_phase1_none_response_emits_error(vocab_data, grammar_data):
    """Safety-filter None response in Path B phase 1 emits GENERATION_FAILED."""
    from story_generator.agent import StoryGeneratorAgent

    none_client = lambda model, contents, config: SimpleNamespace(text=None)  # noqa: E731
    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=none_client)
    events = _collect(
        agent.generate(run_id="t", chapter="Genki I Ch.1", path_mode="B", topic="test")
    )
    assert any(e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events)
    assert not any(e["type"] == "RUN_FINISHED" for e in events)


def test_path_b_phase2_emits_story(vocab_data, grammar_data, fixture_json):
    """Path B phase 2 (english_draft → Japanese story) emits RUN_FINISHED with resultType='story'."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json))
    events = _collect(
        agent.generate(
            run_id="pb2-test",
            chapter="Genki I Ch.5",
            path_mode="B",
            english_draft="Ken goes to the library to study.",
        )
    )

    types = [e["type"] for e in events]
    assert types[0] == "RUN_STARTED"
    assert types[-1] == "RUN_FINISHED"

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "story"
    assert finished["content"]


def test_path_b_phase2_validation_failure_emits_error(vocab_data, grammar_data):
    """Path B phase 2 enforces the same validation gate as Path A."""
    from story_generator.agent import StoryGeneratorAgent

    bad_story = json.dumps({
        "schema_version": "1",
        "id": "test",
        "title": "Test",
        "title_ja": "テスト",
        "language": "ja",
        "description": "test",
        "sentences": [
            {"id": "s01", "words": ["a", "b"], "ruby": ["r1"], "vocab_keys": [None, None]}
        ],
    })
    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=make_mock_client(bad_story))
    events = _collect(
        agent.generate(
            run_id="t",
            chapter="Genki I Ch.1",
            path_mode="B",
            english_draft="Some English text.",
        )
    )

    assert any(e["type"] == "ERROR" and e["code"] == "VALIDATION_ERROR" for e in events)
    assert not any(e["type"] == "RUN_FINISHED" for e in events)


def test_path_a_unchanged_with_new_params(vocab_data, grammar_data, fixture_json):
    """Existing Path A callers with default topic/english_draft params are unaffected."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_client=make_mock_client(fixture_json))
    events = _collect(
        agent.generate(run_id="pa-test", input_text="A test story.", chapter="Genki I Ch.3")
    )
    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "story"


# ---------------------------------------------------------------------------
# Suggest-topic helper tests
# ---------------------------------------------------------------------------


def test_generate_topic_suggestion_returns_string():
    """_generate_topic_suggestion returns a non-empty string using an injected mock."""
    from story_generator.main import _generate_topic_suggestion

    mock_client = lambda model, contents, config: SimpleNamespace(text="Ken goes to the library.")  # noqa: E731
    result = _generate_topic_suggestion("Genki I Ch.5", gemini_client=mock_client)
    assert isinstance(result, str)
    assert len(result) > 0


def test_generate_topic_suggestion_strips_whitespace():
    """_generate_topic_suggestion strips leading/trailing whitespace from the result."""
    from story_generator.main import _generate_topic_suggestion

    mock_client = lambda model, contents, config: SimpleNamespace(text="  topic with spaces.  ")  # noqa: E731
    result = _generate_topic_suggestion("Genki I Ch.1", gemini_client=mock_client)
    assert result == "topic with spaces."


def test_generate_topic_suggestion_handles_empty_response():
    """_generate_topic_suggestion returns empty string when Gemini returns None."""
    from story_generator.main import _generate_topic_suggestion

    mock_client = lambda model, contents, config: SimpleNamespace(text=None)  # noqa: E731
    result = _generate_topic_suggestion("Genki I Ch.2", gemini_client=mock_client)
    assert result == ""


def test_generate_topic_suggestion_bad_chapter_falls_back_gracefully():
    """A bad chapter string falls back to chapter 1 and still returns a string (does not raise)."""
    from story_generator.main import _generate_topic_suggestion

    mock_client = lambda model, contents, config: SimpleNamespace(text="A simple topic.")  # noqa: E731
    result = _generate_topic_suggestion("not-a-valid-chapter", gemini_client=mock_client)
    assert isinstance(result, str)
    assert len(result) > 0


# ---------------------------------------------------------------------------
# /suggest-topic HTTP endpoint tests
# ---------------------------------------------------------------------------


def test_suggest_topic_endpoint_returns_topic_dict(monkeypatch):
    """POST /suggest-topic returns { 'topic': '<string>' } when the helper succeeds."""
    from fastapi.testclient import TestClient
    import story_generator.main as main_module
    from story_generator.main import app

    # Inject a fast mock that bypasses the real Gemini call
    monkeypatch.setattr(
        main_module,
        "_generate_topic_suggestion",
        lambda chapter, gemini_client=None: "Ken studies at the library.",
    )
    # Reset cooldown state so the test starts fresh
    main_module._suggest_topic_cooldowns.clear()

    client = TestClient(app)
    response = client.post("/suggest-topic", json={"chapter": "Genki I Ch.5"})
    assert response.status_code == 200
    data = response.json()
    assert "topic" in data
    assert data["topic"] == "Ken studies at the library."


def test_suggest_topic_endpoint_returns_500_on_empty_result(monkeypatch):
    """POST /suggest-topic returns 500 when the helper returns an empty string."""
    from fastapi.testclient import TestClient
    import story_generator.main as main_module
    from story_generator.main import app

    monkeypatch.setattr(
        main_module,
        "_generate_topic_suggestion",
        lambda chapter, gemini_client=None: "",
    )
    main_module._suggest_topic_cooldowns.clear()

    client = TestClient(app)
    response = client.post("/suggest-topic", json={"chapter": "Genki I Ch.1"})
    assert response.status_code == 500


def test_suggest_topic_endpoint_enforces_cooldown(monkeypatch):
    """POST /suggest-topic returns 429 on a second request within the cooldown window."""
    from fastapi.testclient import TestClient
    import story_generator.main as main_module
    from story_generator.main import app

    monkeypatch.setattr(
        main_module,
        "_generate_topic_suggestion",
        lambda chapter, gemini_client=None: "A topic.",
    )
    main_module._suggest_topic_cooldowns.clear()

    client = TestClient(app)
    # First request should succeed
    r1 = client.post("/suggest-topic", json={"chapter": "Genki I Ch.3"})
    assert r1.status_code == 200
    # Immediate second request should be throttled
    r2 = client.post("/suggest-topic", json={"chapter": "Genki I Ch.3"})
    assert r2.status_code == 429
