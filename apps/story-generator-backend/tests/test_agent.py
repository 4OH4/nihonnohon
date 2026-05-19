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
    """Return a callable matching agent._get_caller() interface (blocking path).

    Used only for Path B1 proposal tests and suggest-topic tests that still
    exercise _get_caller(). All generate() paths now use _get_stream_caller().
    """
    return lambda model, contents, config: SimpleNamespace(text=fixture_json)


# ---------------------------------------------------------------------------
# Stream mock helpers
# ---------------------------------------------------------------------------


def make_part(text, thought: bool = False):
    """Create a mock response Part with .text and .thought attributes."""
    return SimpleNamespace(text=text, thought=thought)


def make_chunk(parts: list):
    """Create a mock GenerateContentResponse chunk with candidates[0].content.parts."""
    content = SimpleNamespace(parts=parts)
    candidate = SimpleNamespace(content=content)
    return SimpleNamespace(candidates=[candidate])


def make_mock_stream_client(text: str):
    """Return an async stream callable matching _get_stream_caller's interface.

    _get_stream_caller returns an async function: ``await stream(model, contents, config)``
    returns an async iterable of chunks. The mock wraps an inner async generator so that
    calling stream() produces a coroutine (awaitable), not an async generator directly.
    """
    async def _stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part(text, thought=False)])
        return _gen()

    return _stream


def make_capturing_stream_client(text: str, capture_list: list):
    """Like make_mock_stream_client but also records the prompt passed to Gemini."""
    async def _stream(model, contents, config):
        capture_list.append(contents)
        async def _gen():
            yield make_chunk([make_part(text, thought=False)])
        return _gen()

    return _stream


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
# Core event ordering / Path A
# ---------------------------------------------------------------------------


def test_events_emitted_in_order(vocab_data, grammar_data, fixture_json):
    """RUN_STARTED arrives first; RUN_FINISHED arrives last and has resultType='story'."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json)
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
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json)
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
    agent = StoryGeneratorAgent(
        vocab_data, grammar_data,
        gemini_stream_client=make_capturing_stream_client(fixture_json, captured),
    )
    _collect(agent.generate(run_id="t", input_text="test", chapter="Genki I Ch.3"))

    assert captured, "No Gemini call was made"
    prompt = captured[0]

    # P7: assert the formatted vocab line (ID | hiragana | ...) not bare hiragana
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
    agent = StoryGeneratorAgent(
        vocab_data, grammar_data,
        gemini_stream_client=make_capturing_stream_client(fixture_json, captured),
    )
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
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(bad_story)
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
        vocab_data, grammar_data,
        gemini_stream_client=make_mock_stream_client("not-valid-json{{{"),
    )
    events = _collect(
        agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1")
    )

    assert any(
        e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events
    ), f"Expected GENERATION_FAILED error, got: {events}"


def test_none_response_emits_error(vocab_data, grammar_data):
    """Empty stream output (safety filter) causes GENERATION_FAILED ERROR."""
    from story_generator.agent import StoryGeneratorAgent

    # A chunk with None text accumulates as '' → empty raw_json → ERROR
    async def none_stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part(None, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=none_stream)
    events = _collect(
        agent.generate(run_id="t", input_text="x", chapter="Genki I Ch.1")
    )

    assert any(
        e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events
    ), f"Expected GENERATION_FAILED error, got: {events}"


def test_cancel_before_gemini_call(vocab_data, grammar_data, fixture_json):
    """If cancel_event is set before the Gemini call, RUN_CANCELLED is emitted."""
    from story_generator.agent import StoryGeneratorAgent

    cancel = asyncio.Event()
    cancel.set()  # pre-set

    # Cancel fires before _get_stream_caller() is reached — stream client not needed
    agent = StoryGeneratorAgent(vocab_data, grammar_data)
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
# AGENT_STATUS — thinking token events
# ---------------------------------------------------------------------------


def test_agent_status_emitted_for_thought_chunks(vocab_data, grammar_data, fixture_json):
    """AGENT_STATUS events are yielded for thought parts before TEXT_MESSAGE_CHUNK."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream_with_thoughts(model, contents, config):
        async def _gen():
            yield make_chunk([make_part("Planning the structure…", thought=True)])
            yield make_chunk([make_part(fixture_json, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream_with_thoughts
    )
    events = _collect(
        agent.generate(run_id="t1", input_text="A story.", chapter="Genki I Ch.3")
    )
    types = [e["type"] for e in events]

    assert "AGENT_STATUS" in types
    status_events = [e for e in events if e["type"] == "AGENT_STATUS"]
    assert status_events[0]["message"] == "Planning the structure…"
    assert types.index("AGENT_STATUS") < types.index("TEXT_MESSAGE_CHUNK")


def test_no_agent_status_when_no_thoughts(vocab_data, grammar_data, fixture_json):
    """No AGENT_STATUS emitted when all stream parts are non-thought content."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json)
    )
    events = _collect(
        agent.generate(run_id="t2", input_text="A story.", chapter="Genki I Ch.3")
    )
    assert all(e["type"] != "AGENT_STATUS" for e in events)


def test_empty_thought_text_not_emitted(vocab_data, grammar_data, fixture_json):
    """AGENT_STATUS is not emitted for thought parts with empty/whitespace text."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream_whitespace_thought(model, contents, config):
        async def _gen():
            yield make_chunk([make_part("   ", thought=True)])
            yield make_chunk([make_part(fixture_json, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream_whitespace_thought
    )
    events = _collect(
        agent.generate(run_id="t3", input_text="A story.", chapter="Genki I Ch.3")
    )
    assert all(e["type"] != "AGENT_STATUS" for e in events)


def test_none_candidates_chunks_skipped(vocab_data, grammar_data, fixture_json):
    """Chunks with candidates=None are skipped without error (SDK issue #226)."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream_with_none_candidates(model, contents, config):
        async def _gen():
            yield SimpleNamespace(candidates=None)      # empty chunk — must be skipped
            yield make_chunk([make_part(fixture_json, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=stream_with_none_candidates
    )
    events = _collect(
        agent.generate(run_id="t4", input_text="A story.", chapter="Genki I Ch.3")
    )
    assert any(e["type"] == "RUN_FINISHED" for e in events)


def test_streaming_timeout_yields_error(vocab_data, grammar_data, fixture_json):
    """Wall-clock deadline exceeded during streaming yields TIMEOUT ERROR."""
    from story_generator.agent import StoryGeneratorAgent

    async def slow_stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part("Thinking…", thought=True)])
            await asyncio.sleep(120)  # deadline fires first
            yield make_chunk([make_part(fixture_json, thought=False)])  # never reached
        return _gen()

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data,
        gemini_stream_client=slow_stream,
        generation_timeout_s=0.01,
    )
    events = _collect(
        agent.generate(run_id="t5", input_text="A story.", chapter="Genki I Ch.3")
    )
    error = next((e for e in events if e["type"] == "ERROR"), None)
    assert error is not None
    assert error["code"] == "TIMEOUT"


# ---------------------------------------------------------------------------
# Path B tests
# ---------------------------------------------------------------------------


def test_path_b_phase1_emits_proposal(vocab_data, grammar_data):
    """Path B phase 1 (topic → English proposal) emits RUN_FINISHED with resultType='proposal'."""
    from story_generator.agent import StoryGeneratorAgent

    proposal_text = "Ken goes to a coffee shop near the university."

    async def proposal_stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part(proposal_text, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=proposal_stream)
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

    async def stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part(raw_text, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=stream)
    events = _collect(
        agent.generate(run_id="t", chapter="Genki I Ch.3", path_mode="B", topic="library")
    )

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["content"] == raw_text.strip()


def test_path_b_phase1_none_response_emits_error(vocab_data, grammar_data):
    """Safety-filter None response in Path B phase 1 emits GENERATION_FAILED."""
    from story_generator.agent import StoryGeneratorAgent

    async def none_stream(model, contents, config):
        async def _gen():
            yield make_chunk([make_part(None, thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=none_stream)
    events = _collect(
        agent.generate(run_id="t", chapter="Genki I Ch.1", path_mode="B", topic="test")
    )
    assert any(e["type"] == "ERROR" and e["code"] == "GENERATION_FAILED" for e in events)
    assert not any(e["type"] == "RUN_FINISHED" for e in events)


def test_path_b_phase1_agent_status_from_thoughts(vocab_data, grammar_data):
    """AGENT_STATUS events are emitted from thinking tokens in Path B phase 1."""
    from story_generator.agent import StoryGeneratorAgent

    async def stream_with_thoughts(model, contents, config):
        async def _gen():
            yield make_chunk([make_part("Drafting the story outline…", thought=True)])
            yield make_chunk([make_part("Ken visits the park.", thought=False)])
        return _gen()

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=stream_with_thoughts)
    events = _collect(
        agent.generate(run_id="pb1-think", chapter="Genki I Ch.3", path_mode="B", topic="park")
    )
    types = [e["type"] for e in events]
    status_events = [e for e in events if e["type"] == "AGENT_STATUS"]
    assert len(status_events) == 1
    assert status_events[0]["message"] == "Drafting the story outline…"
    # AGENT_STATUS must precede TEXT_MESSAGE_CHUNK (AC1 ordering — all paths)
    assert types.index("AGENT_STATUS") < types.index("TEXT_MESSAGE_CHUNK")

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "proposal"
    assert finished["content"] == "Ken visits the park."


def test_path_b_phase2_emits_story(vocab_data, grammar_data, fixture_json):
    """Path B phase 2 (english_draft → Japanese story) emits RUN_FINISHED with resultType='story'."""
    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json)
    )
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
    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(bad_story)
    )
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

    agent = StoryGeneratorAgent(
        vocab_data, grammar_data, gemini_stream_client=make_mock_stream_client(fixture_json)
    )
    events = _collect(
        agent.generate(run_id="pa-test", input_text="A test story.", chapter="Genki I Ch.3")
    )
    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "story"


# ---------------------------------------------------------------------------
# Suggest-topic helper tests (unchanged — use _get_caller blocking path)
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

    monkeypatch.setattr(
        main_module,
        "_generate_topic_suggestion",
        lambda chapter, gemini_client=None: "Ken studies at the library.",
    )
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
    r1 = client.post("/suggest-topic", json={"chapter": "Genki I Ch.3"})
    assert r1.status_code == 200
    r2 = client.post("/suggest-topic", json={"chapter": "Genki I Ch.3"})
    assert r2.status_code == 429


# ---------------------------------------------------------------------------
# Story 3.4: target_word_count in build_proposal_prompt and generate()
# ---------------------------------------------------------------------------


def test_build_proposal_prompt_with_target_word_count():
    """build_proposal_prompt uses target_word_count in the length hint when non-zero."""
    from story_generator.agent import build_proposal_prompt

    prompt = build_proposal_prompt(5, "Ken at the park.", target_word_count=400)
    assert "400" in prompt
    assert "words" in prompt.lower()
    assert "150" not in prompt


def test_build_proposal_prompt_default_length_hint():
    """build_proposal_prompt uses the default length hint when target_word_count is 0."""
    from story_generator.agent import build_proposal_prompt

    prompt = build_proposal_prompt(5, "Ken at the park.", target_word_count=0)
    assert "150" in prompt or "300" in prompt


def test_path_b_phase1_passes_target_word_count(vocab_data, grammar_data):
    """target_word_count flows from generate() through to build_proposal_prompt."""
    from story_generator.agent import StoryGeneratorAgent

    captured_prompts: list[str] = []
    stream_client = make_capturing_stream_client("A short story about Ken.", captured_prompts)

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=stream_client)
    events = _collect(agent.generate(
        run_id="r-wc",
        chapter="Genki I Ch.5",
        path_mode="B",
        topic="Ken at the park",
        target_word_count=250,
        cancel_event=None,
    ))

    finished = next(e for e in events if e["type"] == "RUN_FINISHED")
    assert finished["resultType"] == "proposal"

    assert len(captured_prompts) == 1
    assert "250" in captured_prompts[0]


def test_path_b_phase1_default_length_when_word_count_zero(vocab_data, grammar_data):
    """target_word_count=0 uses default length hint in the prompt."""
    from story_generator.agent import StoryGeneratorAgent

    captured_prompts: list[str] = []
    stream_client = make_capturing_stream_client("A short story.", captured_prompts)

    agent = StoryGeneratorAgent(vocab_data, grammar_data, gemini_stream_client=stream_client)
    _collect(agent.generate(
        run_id="r-wc0",
        chapter="Genki I Ch.5",
        path_mode="B",
        topic="Ken at the library",
        target_word_count=0,
        cancel_event=None,
    ))

    assert len(captured_prompts) == 1
    assert "150" in captured_prompts[0] or "300" in captured_prompts[0]
