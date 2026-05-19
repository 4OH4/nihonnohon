import { renderHook, act } from '@testing-library/react'
import { useAgUiRun } from '../hooks/useAgUiRun'
import { useAuthoringStore } from '../stores/authoringStore'
import timeouts from '../../../../config/timeouts.json'

// Minimal mock that captures onmessage/onerror so tests can fire events
class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  private _closed = false

  close() {
    this._closed = true
  }

  isClosed() {
    return this._closed
  }

  /** Fire a message event with JSON-serialised data. */
  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

// ─── Shared setup helper ─────────────────────────────────────────────────────

/** Puts the store in generating phase with inputs set and returns the mockEs + factory. */
function setupGenerating(
  inputText = 'A story about Tanaka.',
  chapter = 'Genki I Ch.6',
  steering = '',
) {
  const mockEs = new MockEventSource()
  const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
  const store = useAuthoringStore.getState()
  store.setInputText(inputText)
  store.setChapterTarget(chapter)
  if (steering) store.setSteeringInstructions(steering)
  store.generate()
  return { mockEs, factory }
}

// ─── Existing test: RUN_FINISHED mapping (from Story 2.1) ────────────────────

describe('useAgUiRun — RUN_FINISHED mapping', () => {
  beforeEach(() => {
    vi.useFakeTimers()  // P8: prevent 3s/60s timeouts from leaking into teardown
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('RUN_FINISHED (story) commits assembled buffer and transitions to output-clean', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)

    // Set phase to generating BEFORE rendering so the hook opens the connection on mount
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().phase).toBe('generating')

    renderHook(() => useAgUiRun(factory))

    // Factory must have been called — hook opened the SSE connection
    expect(factory).toHaveBeenCalledTimes(1)

    // Emit chunks to fill the buffer, then RUN_FINISHED to commit
    // P4: the hook uses the assembled buffer, not parsed.content
    act(() => {
      mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: '{"id"' })
      mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: ':"test"}' })
      mockEs.emit({ type: 'RUN_FINISHED', resultType: 'story', content: '' })
    })

    // Store state assertions (synchronous — Zustand updates are immediate)
    expect(useAuthoringStore.getState().outputJson).toBe('{"id":"test"}')
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })
})

// ─── AC1: SSE URL construction ───────────────────────────────────────────────

describe('useAgUiRun — SSE URL construction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useAuthoringStore.getState()._reset()
  })

  it('factory called with URL containing all required params', () => {
    const { mockEs: _es, factory } = setupGenerating()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledTimes(1)
    const url = factory.mock.calls[0][0] as string
    const params = new URLSearchParams(url.split('?')[1])

    expect(params.get('inputText')).toBe('A story about Tanaka.')
    expect(params.get('chapter')).toBe('Genki I Ch.6')
    expect(params.get('pathMode')).toBe('A')
    expect(params.get('temperature')).toBe('1')
    expect(params.get('grammar_distribution')).toBe('1')
    expect(params.get('runId')).toBeTruthy()
  })

  it('steeringInstructions omitted from URL when empty', () => {
    const { factory } = setupGenerating('A story.', 'Genki I Ch.3', '')

    renderHook(() => useAgUiRun(factory))

    const url = factory.mock.calls[0][0] as string
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.has('steeringInstructions')).toBe(false)
  })

  it('steeringInstructions included in URL when set', () => {
    const { factory } = setupGenerating('A story.', 'Genki I Ch.3', 'Use simple sentences.')

    renderHook(() => useAgUiRun(factory))

    const url = factory.mock.calls[0][0] as string
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('steeringInstructions')).toBe('Use simple sentences.')
  })

  it('URL runId matches the store runId at generate() time', () => {
    const { factory } = setupGenerating()
    const expectedRunId = useAuthoringStore.getState().runId!

    renderHook(() => useAgUiRun(factory))

    const url = factory.mock.calls[0][0] as string
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('runId')).toBe(expectedRunId)
  })
})

// ─── AC2: RUN_STARTED handling ───────────────────────────────────────────────

describe('useAgUiRun — RUN_STARTED handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useAuthoringStore.getState()._reset()
  })

  it('RUN_STARTED cancels first-event timeout so no error fires at 3s', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    // RUN_STARTED arrives before the 3s window
    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
    })

    // Advance past the 3s window — no error should fire
    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(useAuthoringStore.getState().phase).toBe('generating')
    expect(useAuthoringStore.getState().errorCode).toBeNull()
  })
})

// ─── AC4: RUN_FINISHED (proposal) ────────────────────────────────────────────

describe('useAgUiRun — RUN_FINISHED proposal flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('RUN_FINISHED (proposal) calls _setProposalText and transitions to proposal', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: 'English draft text.' })
      mockEs.emit({ type: 'RUN_FINISHED', resultType: 'proposal', content: '' })
    })

    expect(useAuthoringStore.getState().proposalText).toBe('English draft text.')
    expect(useAuthoringStore.getState().phase).toBe('proposal')
  })
})

// ─── AC5: RUN_CANCELLED ──────────────────────────────────────────────────────

describe('useAgUiRun — RUN_CANCELLED', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('RUN_CANCELLED transitions to idle with runId cleared', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_CANCELLED', runId: useAuthoringStore.getState().runId })
    })

    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().runId).toBeNull()
  })

  it('RUN_CANCELLED preserves all input fields', () => {
    const { mockEs, factory } = setupGenerating('My story text.', 'Genki I Ch.8')
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'RUN_CANCELLED', runId: useAuthoringStore.getState().runId })
    })

    const state = useAuthoringStore.getState()
    expect(state.inputText).toBe('My story text.')
    expect(state.chapterTarget).toBe('Genki I Ch.8')
  })
})

// ─── AC6: 3-second first-event timeout ──────────────────────────────────────

describe('useAgUiRun — first-event timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    useAuthoringStore.getState()._reset()
  })

  it('3s first-event timeout triggers health check and sets BACKEND_UNAVAILABLE when health fails', async () => {
    // Capture mock to assert fetch was called with /health
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)

    const { factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    // vi.advanceTimersByTimeAsync advances timers AND flushes async microtasks
    // triggered by those timers — required for the async setTimeout callback body
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(fetchMock).toHaveBeenCalledWith('/health', expect.anything())
    expect(useAuthoringStore.getState().phase).toBe('error')
    expect(useAuthoringStore.getState().errorCode).toBe('BACKEND_UNAVAILABLE')
  })

  it('3s first-event timeout does NOT set error when health check succeeds', async () => {
    // Backend is healthy — health check returns 200
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const { factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    // Phase stays generating — health was fine, just slow to start
    expect(useAuthoringStore.getState().phase).toBe('generating')
    expect(useAuthoringStore.getState().errorCode).toBeNull()
  })
})

// ─── AC7: 60-second generation timeout ──────────────────────────────────────

describe('useAgUiRun — generation timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('generation timeout sets TIMEOUT error with the exact spec message', () => {
    const generationTimeoutMs = (timeouts.generationTimeoutS + timeouts.frontendMarginS) * 1_000
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    // Cancel the 3s first-event timer first so it doesn't interfere
    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
    })

    // Advance past the generation timeout (synchronous — the callback is not async)
    act(() => {
      vi.advanceTimersByTime(generationTimeoutMs)
    })

    const state = useAuthoringStore.getState()
    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('TIMEOUT')
    expect(state.errorMessage).toBe(
      'This took longer than expected — your inputs are preserved. Try again.',
    )
  })
})

// ─── AC8: Unexpected stream close ───────────────────────────────────────────

describe('useAgUiRun — stream close behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('onerror without prior RUN_FINISHED sets BACKEND_UNAVAILABLE error', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.onerror?.({} as Event)
    })

    const state = useAuthoringStore.getState()
    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('BACKEND_UNAVAILABLE')
    expect(state.errorMessage).toContain('Connection lost')
  })

  it('onerror after RUN_FINISHED is a no-op (output-clean phase preserved)', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'TEXT_MESSAGE_CHUNK', delta: '{"id":"ok"}' })
      mockEs.emit({ type: 'RUN_FINISHED', resultType: 'story', content: '' })
      // Stream close arrives after successful completion — must not override
      mockEs.onerror?.({} as Event)
    })

    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputJson).toBe('{"id":"ok"}')
  })
})

// ─── AC9: Cancellation POST ──────────────────────────────────────────────────

describe('useAgUiRun — cancellation POST dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    useAuthoringStore.getState()._reset()
  })

  it('cancel() transitions to cancelling and dispatches POST /cancel/{runId}', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { factory } = setupGenerating()
    const expectedRunId = useAuthoringStore.getState().runId!

    renderHook(() => useAgUiRun(factory))

    act(() => {
      useAuthoringStore.getState().cancel()
    })

    expect(useAuthoringStore.getState().phase).toBe('cancelling')
    expect(fetchMock).toHaveBeenCalledWith(
      `/cancel/${expectedRunId}`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ type: 'CANCEL', runId: expectedRunId }),
      }),
    )
  })
})

// ─── AC10: ERROR event ───────────────────────────────────────────────────────

describe('useAgUiRun — ERROR event', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('ERROR event transitions to error with correct code and message', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'ERROR', code: 'GENERATION_FAILED', message: 'LLM call failed' })
    })

    const state = useAuthoringStore.getState()
    expect(state.phase).toBe('error')
    expect(state.errorCode).toBe('GENERATION_FAILED')
    expect(state.errorMessage).toBe('LLM call failed')
  })

  it('ERROR event clears runId', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    act(() => {
      mockEs.emit({ type: 'ERROR', code: 'VALIDATION_ERROR', message: 'Schema invalid' })
    })

    expect(useAuthoringStore.getState().runId).toBeNull()
  })
})

// ─── Story 2.6: RUN_STARTED calls _markRunStarted ────────────────────────────

describe('useAgUiRun — RUN_STARTED calls _markRunStarted', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('RUN_STARTED sets agentRunStarted in store', () => {
    const { mockEs, factory } = setupGenerating()
    renderHook(() => useAgUiRun(factory))

    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)

    act(() => {
      mockEs.emit({ type: 'RUN_STARTED', runId: useAuthoringStore.getState().runId })
    })

    expect(useAuthoringStore.getState().agentRunStarted).toBe(true)
  })
})

// ─── Story 3.2: Path B URL params ────────────────────────────────────────────

describe('useAgUiRun — Path B URL params', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('includes topic param in URL when pathMode=B and topicText non-empty', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setPathMode('B')
    store.setTopicText('café study session')
    store.setChapterTarget('Genki I Ch.5')
    store.generate()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    expect(params.get('topic')).toBe('café study session')
    expect(url).toContain('pathMode=B')
  })

  it('does not include topic param in URL for Path A', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setInputText('A regular story.')
    store.setChapterTarget('Genki I Ch.5')
    store.generate()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    expect(url).not.toContain('&topic=')
    expect(url).toContain('pathMode=A')
  })

  it('includes englishDraft param in URL for Path B approve() flow', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setPathMode('B')
    store.setChapterTarget('Genki I Ch.5')
    store.setTopicText('A topic.')
    store._setProposalText('Ken goes to the library.')
    store.approve()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    // Use URLSearchParams to properly decode + signs from URLSearchParams encoding
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    expect(params.get('englishDraft')).toBe('Ken goes to the library.')
    expect(url).toContain('pathMode=B')
  })

  it('does NOT include topic param in URL for Path B phase 2 (approve flow) — would trigger phase 1 on backend', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setPathMode('B')
    store.setChapterTarget('Genki I Ch.5')
    store.setTopicText('A topic.')              // topic is set in the store
    store._setProposalText('Ken goes to the library.')
    store.approve()                             // phase 2: snapshots englishDraft

    renderHook(() => useAgUiRun(factory))

    const url: string = factory.mock.calls[0][0]
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    // englishDraft must be present; topic must NOT be sent (would route to phase 1)
    expect(params.get('englishDraft')).toBe('Ken goes to the library.')
    expect(params.has('topic')).toBe(false)
  })

  it('includes target_word_count in URL when non-zero in Path B phase 1', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setPathMode('B')
    store.setChapterTarget('Genki I Ch.5')
    store.setTopicText('My topic.')
    store.setTargetWordCount(400)
    store.generate()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    expect(params.get('target_word_count')).toBe('400')
  })

  it('omits target_word_count from URL when targetWordCount is default (600) in Path B', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setPathMode('B')
    store.setChapterTarget('Genki I Ch.5')
    store.setTopicText('My topic.')
    // Default targetWordCount is 600 (medium preset) — should still be included since > 0
    store.generate()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    // Default 600 > 0, so it IS included
    expect(params.get('target_word_count')).toBe('600')
  })

  it('omits target_word_count from URL for Path A', () => {
    const mockEs = new MockEventSource()
    const factory = vi.fn().mockReturnValue(mockEs as unknown as EventSource)
    const store = useAuthoringStore.getState()
    store.setInputText('A story.')
    store.setChapterTarget('Genki I Ch.5')
    store.generate()

    renderHook(() => useAgUiRun(factory))

    expect(factory).toHaveBeenCalledOnce()
    const url: string = factory.mock.calls[0][0]
    expect(url).not.toContain('target_word_count')
  })
})
