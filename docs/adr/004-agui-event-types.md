# ADR 004: AG-UI Event Type Contract

**Status:** Accepted
**Date:** 2026-05-15

## Context

The nihonnohon Story Authoring Tool uses the AG-UI (Agent-User Interaction) protocol for
streaming communication between the Python ADK backend (`apps/story-generator-backend/`) and
the React frontend (`apps/story-generator/`). The frontend hook `useAgUiRun` maps incoming
AG-UI events to Zustand store actions; the backend `agent.py` emits these events via the
`ag-ui-protocol` Python SDK.

Both sides must agree on the exact event types and payload shapes used. This ADR is the
authoritative contract. No event types outside this list may be emitted by the backend or
consumed by `useAgUiRun` without updating this ADR first.

## Decision

The following AG-UI event types are in use. All payloads use camelCase field names per the
`ag-ui-protocol` SDK convention.

### Events emitted by the backend

#### `RUN_STARTED`
Emitted immediately when the backend begins processing a generation request.

```json
{
  "type": "RUN_STARTED",
  "runId": "<string — echoes the client-provided runId query param>"
}
```

#### `TEXT_MESSAGE_CHUNK`
Emitted zero or more times during generation. Carries a partial chunk of the output JSON
string. The frontend accumulates these in a hook-internal buffer; they are never written
directly to the store. The complete assembled content is committed on `RUN_FINISHED`.

```json
{
  "type": "TEXT_MESSAGE_CHUNK",
  "delta": "<string — partial output text>"
}
```

#### `RUN_FINISHED`
Emitted when generation and backend validation have both passed. Carries the complete,
schema-valid story JSON string and a `resultType` discriminator.

```json
{
  "type": "RUN_FINISHED",
  "resultType": "story",
  "content": "<string — complete story JSON>"
}
```

For M3 Path B (English proposal generation), `resultType` is `"proposal"` and `content`
is the English story text:

```json
{
  "type": "RUN_FINISHED",
  "resultType": "proposal",
  "content": "<string — English story proposal text>"
}
```

#### `ERROR`
Emitted when generation fails (LLM error, validation failure, timeout, etc.).

```json
{
  "type": "ERROR",
  "code": "<string — SCREAMING_SNAKE_CASE error code>",
  "message": "<string — human-readable description>"
}
```

Standard `code` values: `GENERATION_FAILED`, `VALIDATION_ERROR`, `TIMEOUT`,
`PARALLEL_ARRAY_MISMATCH`, `SCHEMA_INVALID`, `MISSING_FIELD`.

#### `RUN_CANCELLED`
Emitted after the backend has successfully terminated a generation in response to a
`POST /cancel/{runId}` request.

```json
{
  "type": "RUN_CANCELLED",
  "runId": "<string>"
}
```

### Frontend → Backend (cancel signal)

Cancellation is sent as a standard HTTP POST, not through the SSE stream (SSE is
unidirectional). The payload uses the AG-UI `CANCEL` event type:

```
POST /cancel/{runId}
Content-Type: application/json

{ "type": "CANCEL", "runId": "<string>" }
```

### `useAgUiRun` event mapping

| AG-UI event | Store action |
|---|---|
| `RUN_STARTED` | confirm `phase = 'generating'`; `runId` confirmed |
| `TEXT_MESSAGE_CHUNK` | accumulate `delta` in hook-internal buffer (no store write) |
| `RUN_FINISHED` (`resultType: 'story'`) | `_setOutputJson(content)`; `phase → 'output-clean'` |
| `RUN_FINISHED` (`resultType: 'proposal'`) | `_setProposalText(content)`; `phase → 'proposal'` |
| `ERROR` | `_setError(code, message)`; `phase → 'error'` |
| `RUN_CANCELLED` | `phase → 'idle'`; `runId → null`; inputs preserved |
| unexpected stream close (no `RUN_FINISHED`) | `_setError('BACKEND_UNAVAILABLE', '...')`; `phase → 'error'` |

## Consequences

- `useAgUiRun` is implemented strictly against this event contract.
- `agent.py` emits only the event types listed here.
- Any new event type required by M2 (ReAct tool calls) or M3 (Path B proposal) must be
  added to this ADR before implementation begins.
- The `ag-ui-protocol` Python SDK (v0.1.18) provides the base types; field names follow
  the SDK's camelCase convention throughout.
