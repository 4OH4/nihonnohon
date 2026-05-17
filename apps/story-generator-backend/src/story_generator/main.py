"""FastAPI application entry point for the nihonnohon Story Authoring Tool backend."""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

load_dotenv()

# ---------------------------------------------------------------------------
# Module-level state — loaded once at startup
# ---------------------------------------------------------------------------

_vocab_data = None
_grammar_data = None

# Registry of in-flight runs: runId → cancel Event
_active_runs: dict[str, asyncio.Event] = {}


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
    input_text: str = Query(..., alias="inputText"),
    chapter: str = Query(...),
    path_mode: str = Query("A", alias="pathMode"),
    steering_instructions: str = Query("", alias="steeringInstructions"),
    temperature: float = Query(1.0),
    grammar_distribution: int = Query(1, alias="grammar_distribution"),
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

    agent = StoryGeneratorAgent(_vocab_data, _grammar_data)

    async def event_stream():
        try:
            async for event in agent.generate(
                run_id=run_id,
                input_text=input_text,
                chapter=chapter,
                path_mode=path_mode,
                steering_instructions=steering_instructions,
                temperature=temperature,
                grammar_distribution=grammar_distribution,
                cancel_event=cancel_event,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            _active_runs.pop(run_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/cancel/{run_id}")
async def cancel(run_id: str) -> dict:
    """Signal cancellation for an in-flight generation run."""
    if run_id in _active_runs:
        _active_runs[run_id].set()
    return {"ok": True}
