import { render, screen, fireEvent, act } from '@testing-library/react'
import { GenerationProgress } from '../components/GenerationProgress'
import { useAuthoringStore } from '../stores/authoringStore'

describe('GenerationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('has h-0 class when phase is idle', () => {
    const { container } = render(<GenerationProgress />)
    const section = container.querySelector('[aria-label="Generation progress"]')
    expect(section).toHaveClass('h-0')
  })

  it('does not have h-0 class when phase is generating', () => {
    useAuthoringStore.getState().generate()
    const { container } = render(<GenerationProgress />)
    const section = container.querySelector('[aria-label="Generation progress"]')
    expect(section).not.toHaveClass('h-0')
  })

  it('shows "Connecting…" when generating and agentRunStarted is false', () => {
    useAuthoringStore.getState().generate()
    render(<GenerationProgress />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows "Generating story…" after _markRunStarted', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    render(<GenerationProgress />)
    expect(screen.getByText('Generating story…')).toBeInTheDocument()
  })

  it('shows elapsed timer incrementing during generation', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    render(<GenerationProgress />)
    act(() => { vi.advanceTimersByTime(3_000) })
    expect(screen.getByText('3s')).toBeInTheDocument()
  })

  it('shows TIMEOUT error message', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'any message')
    render(<GenerationProgress />)
    expect(screen.getByText(/This took longer than expected/)).toBeInTheDocument()
  })

  it('shows BACKEND_UNAVAILABLE error message', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('BACKEND_UNAVAILABLE', 'any message')
    render(<GenerationProgress />)
    expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
  })

  it('shows generic error message for other error codes', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('GENERATION_FAILED', 'LLM error')
    render(<GenerationProgress />)
    expect(screen.getByText(/AI service returned an error/)).toBeInTheDocument()
  })

  it('shows Retry button in error phase', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    render(<GenerationProgress />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('Retry button calls generate() and transitions to generating', () => {
    // Inputs must be non-empty for canRetry to enable the button
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    render(<GenerationProgress />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('Retry button is disabled when inputs are empty', () => {
    // _reset() leaves inputText = '' and chapterTarget = ''
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    render(<GenerationProgress />)
    const btn = screen.getByRole('button', { name: /retry/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('has aria-live="polite" on the status text element', () => {
    useAuthoringStore.getState().generate()
    const { container } = render(<GenerationProgress />)
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })

  it('returns to h-0 when phase transitions to output-clean', () => {
    useAuthoringStore.getState().generate()
    const { container, rerender } = render(<GenerationProgress />)
    // Simulate output arrived
    useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    rerender(<GenerationProgress />)
    const section = container.querySelector('[aria-label="Generation progress"]')
    expect(section).toHaveClass('h-0')
  })

  it('does not have h-0 class when phase is cancelling', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState().cancel()
    const { container } = render(<GenerationProgress />)
    const section = container.querySelector('[aria-label="Generation progress"]')
    expect(section).not.toHaveClass('h-0')
  })

  it('shows "Stopping…" label when phase is cancelling', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState().cancel()
    render(<GenerationProgress />)
    expect(screen.getByText('Stopping…')).toBeInTheDocument()
  })

  it('elapsed timer stops incrementing when phase moves to cancelling', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    const { rerender } = render(<GenerationProgress />)
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(screen.getByText('2s')).toBeInTheDocument()
    // Transition to cancelling — timer should freeze
    useAuthoringStore.getState().cancel()
    rerender(<GenerationProgress />)
    act(() => { vi.advanceTimersByTime(3_000) })
    expect(screen.getByText('2s')).toBeInTheDocument()
  })
})
