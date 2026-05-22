// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

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

describe('GenerationProgress — Thinking hint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useAuthoringStore.getState()._reset()
  })

  it('renders "Thinking: " hint when agentStatus is set', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._setAgentStatus('Planning the structure…')
    render(<GenerationProgress />)
    expect(screen.getByText('Generating story…')).toBeInTheDocument()
    expect(screen.getByText('Thinking: Planning the structure…')).toBeInTheDocument()
  })

  it('does not render hint paragraph when agentStatus is null', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    render(<GenerationProgress />)
    expect(screen.getByText('Generating story…')).toBeInTheDocument()
    expect(screen.queryByText(/^Thinking:/)).toBeNull()
  })

  it('does not render hint when agentRunStarted is false', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._setAgentStatus('Some hint')
    render(<GenerationProgress />)
    expect(screen.queryByText(/^Thinking:/)).toBeNull()
  })

  it('word-boundary-truncates hint longer than 80 chars', () => {
    // Build a 20-word hint clearly over 80 chars using simple space-separated words
    const longHint = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ')
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._setAgentStatus(longHint)
    render(<GenerationProgress />)

    const hint = screen.getByText(/^Thinking: /)
    const displayed = hint.textContent ?? ''
    // Must end with ellipsis
    expect(displayed).toMatch(/…$/)
    // Strip "Thinking: " (10 chars) and trailing "…" to get the truncated hint
    const truncated = displayed.slice(10, -1)  // "Thinking: " is 10 chars
    // The character at the cut point must be a word boundary in the original string:
    // longHint[truncated.length] must be a space (or end of string)
    const nextChar = longHint[truncated.length]
    expect(nextChar === ' ' || nextChar === undefined).toBe(true)
  })

  it('shows full hint when agentStatus is exactly 80 chars', () => {
    const exactly80 = 'a'.repeat(80)
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._setAgentStatus(exactly80)
    render(<GenerationProgress />)
    expect(screen.getByText(`Thinking: ${exactly80}`)).toBeInTheDocument()
  })

  it('hint not shown during cancelling phase', () => {
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._setAgentStatus('Thinking…')
    useAuthoringStore.getState().cancel()
    render(<GenerationProgress />)
    expect(screen.queryByText(/^Thinking:/)).toBeNull()
  })
})
