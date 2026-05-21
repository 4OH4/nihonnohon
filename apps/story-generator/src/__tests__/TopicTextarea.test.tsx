// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopicTextarea } from '../components/TopicTextarea'
import { useAuthoringStore } from '../stores/authoringStore'

describe('TopicTextarea', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.stubGlobal('fetch', vi.fn())
    // Set a chapter so the suggest button is enabled by default for most tests
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
    vi.restoreAllMocks()
  })

  // — Rendering —

  it('renders textarea with placeholder', () => {
    render(<TopicTextarea />)
    expect(screen.getByPlaceholderText(/describe the topic/i)).toBeInTheDocument()
  })

  it('shows "✦ Suggest a topic" button when topic is empty', () => {
    render(<TopicTextarea />)
    expect(screen.getByText('✦ Suggest a topic')).toBeInTheDocument()
  })

  it('shows "Replace topic" button when topic has content', () => {
    useAuthoringStore.getState().setTopicText('A student visits the library')
    render(<TopicTextarea />)
    expect(screen.getByText('Replace topic')).toBeInTheDocument()
  })

  it('textarea reflects topicText from store', () => {
    useAuthoringStore.getState().setTopicText('café study session')
    render(<TopicTextarea />)
    const ta = screen.getByPlaceholderText(/describe the topic/i) as HTMLTextAreaElement
    expect(ta.value).toBe('café study session')
  })

  it('updates topicText in store on textarea change', () => {
    render(<TopicTextarea />)
    fireEvent.change(screen.getByPlaceholderText(/describe the topic/i), {
      target: { value: 'new topic' },
    })
    expect(useAuthoringStore.getState().topicText).toBe('new topic')
  })

  // — Suggest button (empty state) —

  it('clicking "Suggest a topic" with empty field calls POST /suggest-topic', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ topic: 'Ken goes to the library.' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<TopicTextarea />)
    await act(async () => {
      fireEvent.click(screen.getByText('✦ Suggest a topic'))
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/suggest-topic',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(useAuthoringStore.getState().topicText).toBe('Ken goes to the library.')
  })

  it('populates textarea from suggest-topic response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ topic: 'market day' }),
    }))

    render(<TopicTextarea />)
    await act(async () => {
      fireEvent.click(screen.getByText('✦ Suggest a topic'))
    })

    const ta = screen.getByPlaceholderText(/describe the topic/i) as HTMLTextAreaElement
    expect(ta.value).toBe('market day')
  })

  it('shows error toast when suggest-topic fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<TopicTextarea />)
    await act(async () => {
      fireEvent.click(screen.getByText('✦ Suggest a topic'))
    })

    expect(screen.getByText('Could not fetch suggestion')).toBeInTheDocument()
  })

  it('shows error toast when fetch returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<TopicTextarea />)
    await act(async () => {
      fireEvent.click(screen.getByText('✦ Suggest a topic'))
    })

    expect(screen.getByText('Could not fetch suggestion')).toBeInTheDocument()
  })

  // — SuggestConfirm strip (has-content state) —

  it('clicking "Replace topic" when topic is non-empty shows SuggestConfirm strip', () => {
    useAuthoringStore.getState().setTopicText('existing topic')
    render(<TopicTextarea />)
    fireEvent.click(screen.getByText('Replace topic'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/replace your current topic/i)).toBeInTheDocument()
  })

  it('SuggestConfirm [Yes, replace] fires the suggest request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ topic: 'replacement topic' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    useAuthoringStore.getState().setTopicText('old topic')

    render(<TopicTextarea />)
    fireEvent.click(screen.getByText('Replace topic'))
    await act(async () => {
      fireEvent.click(screen.getByText('Yes, replace'))
    })

    expect(mockFetch).toHaveBeenCalledWith('/suggest-topic', expect.any(Object))
    expect(useAuthoringStore.getState().topicText).toBe('replacement topic')
  })

  it('SuggestConfirm [Cancel] dismisses the strip without calling fetch', () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    useAuthoringStore.getState().setTopicText('existing topic')

    render(<TopicTextarea />)
    fireEvent.click(screen.getByText('Replace topic'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('SuggestConfirm Escape key dismisses the strip', () => {
    useAuthoringStore.getState().setTopicText('existing topic')
    render(<TopicTextarea />)
    fireEvent.click(screen.getByText('Replace topic'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('SuggestConfirm appearance calls onConfirmOpen(true)', () => {
    const onConfirmOpen = vi.fn()
    useAuthoringStore.getState().setTopicText('topic')
    render(<TopicTextarea onConfirmOpen={onConfirmOpen} />)
    fireEvent.click(screen.getByText('Replace topic'))
    expect(onConfirmOpen).toHaveBeenCalledWith(true)
  })

  it('SuggestConfirm Cancel calls onConfirmOpen(false)', () => {
    const onConfirmOpen = vi.fn()
    useAuthoringStore.getState().setTopicText('topic')
    render(<TopicTextarea onConfirmOpen={onConfirmOpen} />)
    fireEvent.click(screen.getByText('Replace topic'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onConfirmOpen).toHaveBeenCalledWith(false)
  })

  // — Debounce —

  it('debounce: second click within 300ms does not open a second confirm strip', () => {
    vi.useFakeTimers()
    useAuthoringStore.getState().setTopicText('topic')

    render(<TopicTextarea />)
    fireEvent.click(screen.getByText('Replace topic'))
    // First click → strip visible
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Dismiss strip and immediately click again (within 300ms debounce)
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByText('Replace topic'))
    // Second click within window is ignored → no second alert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  // — sessionRestored clearing —

  it('typing in textarea clears sessionRestored when it is true', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<TopicTextarea />)
    fireEvent.change(screen.getByPlaceholderText(/describe the topic/i), {
      target: { value: 'new topic text' },
    })
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  // — Chapter guard on suggest button —

  it('suggest button is disabled when no chapter is selected', () => {
    // Clear the chapter that beforeEach sets
    act(() => useAuthoringStore.getState().setChapterTarget(''))
    render(<TopicTextarea />)
    const btn = screen.getByText('✦ Suggest a topic').closest('button')
    expect(btn).toBeDisabled()
  })

  it('suggest button is enabled when chapter is selected', () => {
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
    render(<TopicTextarea />)
    const btn = screen.getByText('✦ Suggest a topic').closest('button')
    expect(btn).not.toBeDisabled()
  })

  // — Hint prop —

  it('shows error border when hint is true', () => {
    const { container } = render(<TopicTextarea hint={true} />)
    const ta = container.querySelector('textarea')
    expect(ta).toHaveClass('border-error')
  })

  it('shows hint text when hint is true', () => {
    render(<TopicTextarea hint={true} />)
    expect(screen.getByText('Enter a topic before generating.')).toBeInTheDocument()
  })
})
