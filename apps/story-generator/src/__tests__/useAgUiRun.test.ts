import { renderHook, act } from '@testing-library/react'
import { useAgUiRun } from '../hooks/useAgUiRun'
import { useAuthoringStore } from '../stores/authoringStore'

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
