import { useEffect, useRef } from 'react'
import { useAuthoringStore } from '@/stores/authoringStore'
import timeouts from '../../../../config/timeouts.json'

/** AG-UI event types per ADR-004. */
type AgUiEvent =
  | { type: 'RUN_STARTED'; runId: string }
  | { type: 'TEXT_MESSAGE_CHUNK'; delta: string }
  | { type: 'RUN_FINISHED'; resultType: 'story' | 'proposal'; content: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'RUN_CANCELLED'; runId: string }
  | { type: 'AGENT_STATUS'; message: string }

const FIRST_EVENT_TIMEOUT_MS = 3_000
const GENERATION_TIMEOUT_MS = (timeouts.generationTimeoutS + timeouts.frontendMarginS) * 1_000

/**
 * Manages the full SSE lifecycle for AG-UI generation.
 * Owns event parsing, timeout enforcement, and cancellation dispatch.
 * Components must not instantiate EventSource directly — consume this hook instead.
 *
 * @param createEventSource - Injectable factory for testability; defaults to native EventSource.
 */
export function useAgUiRun(
  createEventSource: (url: string) => EventSource = (url) => new EventSource(url),
): void {
  const store = useAuthoringStore()
  const esRef               = useRef<EventSource | null>(null)
  const bufferRef           = useRef<string>('')
  const firstEventRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const genTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const agentStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef            = useRef(store.phase)

  // Keep phaseRef current so async timeout callbacks can read the latest phase
  phaseRef.current = store.phase

  useEffect(() => {
    // Only open an SSE connection when entering generating phase
    if (store.phase !== 'generating' || !store.runId) return

    const {
      runId,
      storedInputs,
      _setOutputJson,
      _setProposalText,
      _setError,
      _resolveCancel,
      _markRunStarted,
      _setAgentStatus,
    } = store

    // Use storedInputs snapshot for ALL URL params — captured at generate() time.
    // This ensures the SSE URL is fully consistent with the runId regardless of
    // any concurrent user edits to inputs or settings.
    const inputText            = storedInputs?.inputText            ?? store.inputText
    const chapterTarget        = storedInputs?.chapterTarget        ?? store.chapterTarget
    const steeringInstructions = storedInputs?.steeringInstructions ?? store.steeringInstructions
    const pathMode             = storedInputs?.pathMode             ?? store.pathMode
    const temperature          = storedInputs?.temperature          ?? store.temperature
    const grammarDist          = storedInputs?.grammarDist          ?? store.grammarDist
    const topicText            = storedInputs?.topicText            ?? ''
    const englishDraft         = storedInputs?.englishDraft         ?? ''
    const targetWordCount      = storedInputs?.targetWordCount      ?? 0

    // Build query string
    const params = new URLSearchParams({
      runId,
      inputText,
      chapter: chapterTarget,
      pathMode,
      temperature: String(temperature),
      grammar_distribution: String(grammarDist),
    })
    if (steeringInstructions) {
      params.set('steeringInstructions', steeringInstructions)
    }
    // Path B params — topic and englishDraft are mutually exclusive:
    // phase 1 sends topic (backend routes on "B" + topic → English proposal)
    // phase 2 sends englishDraft only (backend routes on "B" + englishDraft → Japanese story)
    // Sending both would trigger phase 1 routing even during phase 2.
    if (pathMode === 'B') {
      if (englishDraft) {
        params.set('englishDraft', englishDraft)
      } else if (topicText) {
        params.set('topic', topicText)
        if (targetWordCount > 0) params.set('target_word_count', String(targetWordCount))
      }
    }

    const url = `/run_sse?${params.toString()}`
    bufferRef.current = ''

    const es = createEventSource(url)
    esRef.current = es
    let receivedFinished = false

    // 3-second first-event timeout: if no RUN_STARTED arrives, health-check the backend
    firstEventRef.current = setTimeout(async () => {
      if (phaseRef.current !== 'generating') return
      try {
        const res = await fetch('/health', { signal: AbortSignal.timeout(5_000) })
        if (!res.ok) throw new Error('unhealthy')
      } catch {
        // P7: Re-check phase after the async health-check wait — may have changed during the fetch
        if (phaseRef.current === 'generating') {
          _setError('BACKEND_UNAVAILABLE', 'Connection lost — your inputs are preserved. Check the backend and retry.')
          es.close()
        }
      }
    }, FIRST_EVENT_TIMEOUT_MS)

    // 60-second generation timeout
    genTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current !== 'generating') return
      _setError('TIMEOUT', 'This took longer than expected — your inputs are preserved. Try again.')
      es.close()
    }, GENERATION_TIMEOUT_MS)

    const clearTimers = () => {
      if (firstEventRef.current)       clearTimeout(firstEventRef.current)
      if (genTimeoutRef.current)       clearTimeout(genTimeoutRef.current)
      if (agentStatusTimerRef.current) clearTimeout(agentStatusTimerRef.current)
    }

    es.onmessage = (event: MessageEvent) => {
      let parsed: AgUiEvent
      try {
        parsed = JSON.parse(event.data as string) as AgUiEvent
      } catch {
        return
      }

      switch (parsed.type) {
        case 'AGENT_STATUS': {
          // Debounce rapid thinking-chunk arrivals to limit aria-live announcement rate
          if (agentStatusTimerRef.current) clearTimeout(agentStatusTimerRef.current)
          const msg = parsed.message
          agentStatusTimerRef.current = setTimeout(() => { _setAgentStatus(msg) }, 500)
          break
        }

        case 'RUN_STARTED':
          // Cancel the first-event timeout — we have a response
          if (firstEventRef.current) clearTimeout(firstEventRef.current)
          _markRunStarted()
          break

        case 'TEXT_MESSAGE_CHUNK':
          // Accumulate in hook-internal buffer only — never write to store during streaming
          bufferRef.current += parsed.delta
          break

        case 'RUN_FINISHED':
          clearTimers()
          receivedFinished = true
          es.close()
          // P4: Use assembled buffer exclusively — do not fall back to parsed.content.
          // The buffer is the canonical output; parsed.content is not defined as a valid
          // complete-output field in ADR-004.
          if (parsed.resultType === 'story') {
            _setOutputJson(bufferRef.current)
          } else {
            _setProposalText(bufferRef.current)
          }
          bufferRef.current = ''
          break

        case 'ERROR':
          clearTimers()
          es.close()
          _setError(parsed.code, parsed.message)
          break

        case 'RUN_CANCELLED':
          clearTimers()
          es.close()
          _resolveCancel()
          break
      }
    }

    es.onerror = () => {
      if (receivedFinished) return
      clearTimers()
      es.close()
      _setError(
        'BACKEND_UNAVAILABLE',
        'Connection lost — your inputs are preserved. Check the backend and retry.',
      )
    }

    return () => {
      clearTimers()
      es.close()
      esRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.phase, store.runId])

  // Handle cancel dispatch: send POST /cancel/{runId}
  useEffect(() => {
    if (store.phase !== 'cancelling' || !store.runId) return
    const { runId, _setError } = store

    fetch(`/cancel/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CANCEL', runId }),
    }).catch(() => {
      // P2: Guard against corrupting state if phase has already moved past cancelling
      // (e.g., RUN_CANCELLED arrived via SSE before this fetch failed)
      if (useAuthoringStore.getState().phase === 'cancelling') {
        _setError('BACKEND_UNAVAILABLE', 'Connection lost — your inputs are preserved. Check the backend and retry.')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.phase])
}
