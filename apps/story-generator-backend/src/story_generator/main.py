"""FastAPI application entry point for the nihonnohon Story Authoring Tool backend."""
from __future__ import annotations

import asyncio
import datetime
import json
import logging
import logging.handlers
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

load_dotenv()

# ---------------------------------------------------------------------------
# Logging — configured before anything else so library loggers are captured
# ---------------------------------------------------------------------------


class _JsonLLMPerfFormatter(logging.Formatter):
    """Formats llm_perf log records as a single JSON line per Gemini call."""

    def format(self, record: logging.LogRecord) -> str:
        doc = {
            "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds"),
            "activity": getattr(record, "activity", ""),
            "run_id": getattr(record, "run_id", ""),
            "elapsed_ms": getattr(record, "elapsed_ms", 0),
            "response_chars": getattr(record, "response_chars", 0),
            "status": getattr(record, "status", "ok"),
        }
        return json.dumps(doc, ensure_ascii=False)


def _configure_logging() -> None:
    """Set up logging from LOG_LEVEL env var (default INFO).

    INFO:  generation lifecycle events (start, finish, errors, validation failures)
    DEBUG: full prompts and raw LLM responses in addition to the above
    """
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    # google.genai INFO shows API request lifecycle; DEBUG includes full payloads
    logging.getLogger("google.genai").setLevel(level)
    # httpx at DEBUG logs raw HTTP bodies — only useful when troubleshooting auth/network
    logging.getLogger("httpx").setLevel(logging.WARNING if level > logging.DEBUG else logging.DEBUG)
    # Keep uvicorn/fastapi access logs at their default level
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    # ---------------------------------------------------------------------------
    # LLM performance log — one JSON line per Gemini call, cloud-ingest ready
    # ---------------------------------------------------------------------------
    perf_log_path = Path(os.environ.get("LLM_PERF_LOG", "logs/llm_perf.jsonl"))
    perf_log_path.parent.mkdir(parents=True, exist_ok=True)
    _perf_handler = logging.handlers.TimedRotatingFileHandler(
        perf_log_path, when="W0", backupCount=4, encoding="utf-8"
    )
    _perf_handler.setFormatter(_JsonLLMPerfFormatter())
    _perf_logger = logging.getLogger("llm_perf")
    _perf_logger.setLevel(logging.INFO)
    _perf_logger.addHandler(_perf_handler)
    _perf_logger.propagate = False


_configure_logging()

logger = logging.getLogger(__name__)
_perf_logger = logging.getLogger("llm_perf")


def _load_timeout_config() -> dict:
    """Load timeout values from config/timeouts.json at the repo root.

    Falls back to hardcoded defaults if the file is missing so tests and
    isolated runs don't require the config file to be present.
    """
    defaults = {"generationTimeoutS": 55.0, "suggestTopicTimeoutS": 9.0, "frontendMarginS": 5.0}
    config_path = Path(__file__).parents[4] / "config" / "timeouts.json"
    try:
        with open(config_path) as f:
            return {**defaults, **json.load(f)}
    except FileNotFoundError:
        logger.warning("config/timeouts.json not found — using default timeouts")
        return defaults


_timeouts = _load_timeout_config()
_GENERATION_TIMEOUT_S: float = float(_timeouts["generationTimeoutS"])
_SUGGEST_TOPIC_TIMEOUT_S: float = float(_timeouts["suggestTopicTimeoutS"])

# ---------------------------------------------------------------------------
# Module-level state — loaded once at startup
# ---------------------------------------------------------------------------

_vocab_data = None
_grammar_data = None

# Registry of in-flight runs: runId → cancel Event
_active_runs: dict[str, asyncio.Event] = {}

# Per-chapter cooldown tracking for /suggest-topic: chapter → last-call monotonic timestamp
_suggest_topic_cooldowns: dict[str, float] = {}

_SUGGEST_TOPIC_COOLDOWN_S = 2.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load CSV reference data once at startup; no per-request file I/O."""
    global _vocab_data, _grammar_data  # noqa: PLW0603

    data_dir = Path(os.environ.get("DATA_DIR", "../../resources"))
    from story_generator.data_loader import load_grammar_data, load_vocab_data

    _vocab_data = load_vocab_data(data_dir / "genki1vocab.csv")
    _grammar_data = load_grammar_data(data_dir / "Genki_grammar_for_AI_generation.csv")
    yield


app = FastAPI(lifespan=lifespan)

_allowed_origin = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5174")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_allowed_origin],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> JSONResponse:
    """Health check. Exempt from CORS restrictions — always returns Allow-Origin: *."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if api_key:
        body, status_code = {"status": "ok"}, 200
    else:
        body, status_code = {"status": "unavailable"}, 503
    response = JSONResponse(content=body, status_code=status_code)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.get("/run_sse")
async def run_sse(
    run_id: str = Query(..., alias="runId"),
    input_text: str = Query("", alias="inputText"),
    chapter: str = Query(...),
    path_mode: str = Query("A", alias="pathMode"),
    topic: str = Query("", alias="topic"),
    english_draft: str = Query("", alias="englishDraft"),
    steering_instructions: str = Query("", alias="steeringInstructions"),
    temperature: float = Query(1.0),
    grammar_distribution: int = Query(1, alias="grammar_distribution"),
    target_word_count: int = Query(0, alias="target_word_count"),
) -> StreamingResponse:
    """Open an SSE stream for story generation. Streams AG-UI events per ADR-004."""
    # P2: guard against requests arriving before lifespan completes CSV loading
    if _vocab_data is None or _grammar_data is None:
        async def _startup_error():
            yield 'data: {"type":"ERROR","code":"BACKEND_UNAVAILABLE","message":"Backend is still initializing — please retry in a moment."}\n\n'

        return StreamingResponse(_startup_error(), media_type="text/event-stream")

    cancel_event = asyncio.Event()
    _active_runs[run_id] = cancel_event

    from story_generator.agent import StoryGeneratorAgent

    agent = StoryGeneratorAgent(_vocab_data, _grammar_data, generation_timeout_s=_GENERATION_TIMEOUT_S)

    async def event_stream():
        try:
            async for event in agent.generate(
                run_id=run_id,
                input_text=input_text,
                chapter=chapter,
                path_mode=path_mode,
                topic=topic,
                english_draft=english_draft,
                steering_instructions=steering_instructions,
                temperature=temperature,
                grammar_distribution=grammar_distribution,
                target_word_count=target_word_count,
                cancel_event=cancel_event,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            _active_runs.pop(run_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Suggest-topic endpoint
# ---------------------------------------------------------------------------


class SuggestTopicRequest(BaseModel):
    """Request body for POST /suggest-topic."""

    chapter: str


def _generate_topic_suggestion(chapter: str, gemini_client=None) -> str:
    """Call Gemini to produce a single-sentence topic suggestion for the given chapter.

    Injectable gemini_client follows the same pattern as StoryGeneratorAgent.
    """
    if gemini_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
        from google import genai

        client = genai.Client(api_key=api_key)
        gemini_client = lambda model, contents, config: client.models.generate_content(  # noqa: E731
            model=model, contents=contents, config=config
        )

    # Parse chapter number for the prompt
    try:
        from story_generator.agent import _parse_chapter

        chapter_int = _parse_chapter(chapter)
    except ValueError:
        chapter_int = 1

    prompt = (
        f"Suggest a single topic sentence in English as start point for a short story."
        f"It is intended for a Japanese learner who has studied using the Genki "
        f"textbooks up to Chapter {chapter_int}, and will later be translated into Japanese."
        f"The topic should reflect everyday student life or simple cultural activities appropriate for beginners. "
        f"Return only the topic sentence — no explanation, no punctuation at the end."
        f"Only reply in English language."
    )

    from google.genai import types as genai_types

    # Disable thinking (thinking_budget=0) and cap tokens — keeps latency well under 10s
    # for this lightweight one-sentence utility call (unlike JSON generation which implicitly
    # disables thinking via response_mime_type, plain-text mode enables it by default)
    config = genai_types.GenerateContentConfig(
        temperature=1.0,
        max_output_tokens=64,
        thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
    )
    response = gemini_client("gemini-2.5-flash", prompt, config)
    return (getattr(response, "text", "") or "").strip()


@app.post("/suggest-topic")
async def suggest_topic(request: SuggestTopicRequest) -> dict:
    """Return a single-sentence topic suggestion calibrated to the given chapter.

    Enforces a 2-second per-chapter cooldown. Returns 429 on violation.
    """
    chapter = request.chapter
    now = time.monotonic()
    last_call = _suggest_topic_cooldowns.get(chapter, 0.0)
    if now - last_call < _SUGGEST_TOPIC_COOLDOWN_S:
        raise HTTPException(status_code=429, detail="cooldown")

    _suggest_topic_cooldowns[chapter] = now
    logger.info("suggest-topic chapter=%r", chapter)

    t0 = time.perf_counter()
    try:
        topic = await asyncio.wait_for(
            asyncio.to_thread(_generate_topic_suggestion, chapter),
            timeout=_SUGGEST_TOPIC_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        _perf_logger.info(
            "",
            extra={
                "activity": "Suggest a topic",
                "run_id": "",
                "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                "response_chars": 0,
                "status": "timeout",
            },
        )
        logger.warning("suggest-topic timed out for chapter=%r", chapter)
        raise HTTPException(status_code=504, detail="Suggest-topic timed out.")
    except Exception as exc:  # noqa: BLE001
        _perf_logger.info(
            "",
            extra={
                "activity": "Suggest a topic",
                "run_id": "",
                "elapsed_ms": round((time.perf_counter() - t0) * 1000),
                "response_chars": 0,
                "status": "error",
            },
        )
        logger.error("suggest-topic error for chapter=%r: %s", chapter, exc)
        raise HTTPException(status_code=500, detail=str(exc))

    if not topic:
        logger.warning("suggest-topic returned empty string for chapter=%r", chapter)
        raise HTTPException(status_code=500, detail="Gemini returned no topic suggestion.")

    _perf_logger.info(
        "",
        extra={
            "activity": "Suggest a topic",
            "run_id": "",
            "elapsed_ms": round((time.perf_counter() - t0) * 1000),
            "response_chars": len(topic),
            "status": "ok",
        },
    )
    logger.info("suggest-topic result: %r", topic)
    return {"topic": topic}


@app.post("/cancel/{run_id}")
async def cancel(run_id: str) -> dict:
    """Signal cancellation for an in-flight generation run."""
    if run_id in _active_runs:
        _active_runs[run_id].set()
    return {"ok": True}
