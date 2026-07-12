// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { act, render, screen, fireEvent } from '@testing-library/react'
import { InputPanel } from '../components/InputPanel'
import { useAuthoringStore } from '../stores/authoringStore'

vi.mock('../hooks/useBackendStatus', () => ({
  useBackendStatus: vi.fn(() => 'connected' as const),
}))
import { useBackendStatus } from '../hooks/useBackendStatus'

describe('InputPanel', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('renders textarea with min-h-[200px] class', () => {
    const { container } = render(<InputPanel />)
    const ta = container.querySelector('textarea#input-text')
    expect(ta).toHaveClass('min-h-[200px]')
  })

  it('renders textarea with max-h-[400px] class', () => {
    const { container } = render(<InputPanel />)
    const ta = container.querySelector('textarea#input-text')
    expect(ta).toHaveClass('max-h-[400px]')
  })

  it('updates inputText in store on textarea change', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/english story/i), {
      target: { value: 'Hello world' },
    })
    expect(useAuthoringStore.getState().inputText).toBe('Hello world')
  })

  it('renders chapter select with placeholder, Unspecified, and 23 chapter options', () => {
    render(<InputPanel />)
    const select = screen.getByLabelText(/genki chapter/i)
    expect(select).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    // Path A (default): 1 placeholder + 1 Unspecified + 23 chapters
    expect(options.length).toBe(25)
  })

  it('placeholder option has empty value', () => {
    render(<InputPanel />)
    const placeholder = screen.getByRole('option', { name: /select a chapter/i })
    expect(placeholder).toHaveValue('')
  })

  it('updates chapterTarget in store on chapter change', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.6' },
    })
    expect(useAuthoringStore.getState().chapterTarget).toBe('Genki I Ch.6')
  })

  it('ScopeChip absent when no chapter selected', () => {
    render(<InputPanel />)
    expect(screen.queryByText(/vocab/)).not.toBeInTheDocument()
  })

  it('ScopeChip appears after chapter selection', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.6' },
    })
    expect(screen.getByText('325 vocab')).toBeInTheDocument()
  })

  it('steering instructions collapsed by default', () => {
    render(<InputPanel />)
    expect(screen.queryByLabelText(/optional guidance/i)).not.toBeInTheDocument()
  })

  it('steering toggle expands the steering textarea', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /steering instructions/i }))
    expect(screen.getByLabelText(/optional guidance/i)).toBeInTheDocument()
  })

  it('steering toggle collapses after second click', () => {
    render(<InputPanel />)
    const toggle = screen.getByRole('button', { name: /steering instructions/i })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.queryByLabelText(/optional guidance/i)).not.toBeInTheDocument()
  })

  it('steeringInstructions store updates when steering textarea changes', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /steering instructions/i }))
    fireEvent.change(screen.getByLabelText(/optional guidance/i), {
      target: { value: 'Use simple sentences.' },
    })
    expect(useAuthoringStore.getState().steeringInstructions).toBe('Use simple sentences.')
  })

  it('Generate click with empty textarea shows story hint', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText('Enter your English story before generating.')).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('Generate click with no chapter shows chapter hint', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/english story/i), {
      target: { value: 'A story.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText('Select a chapter before generating.')).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('Generate click with both fields empty shows both hints', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText('Enter your English story before generating.')).toBeInTheDocument()
    expect(screen.getByText('Select a chapter before generating.')).toBeInTheDocument()
  })

  it('Generate click with valid inputs calls generate() and transitions to generating', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/english story/i), {
      target: { value: 'A story.' },
    })
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.6' },
    })
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('story hint disappears when textarea is filled', () => {
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText('Enter your English story before generating.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/english story/i), {
      target: { value: 'A story.' },
    })
    expect(screen.queryByText('Enter your English story before generating.')).not.toBeInTheDocument()
  })

  it('chapter hint disappears when chapter is selected', () => {
    render(<InputPanel />)
    // Show hint first
    fireEvent.change(screen.getByLabelText(/english story/i), { target: { value: 'A story.' } })
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(screen.getByText('Select a chapter before generating.')).toBeInTheDocument()
    // Select chapter
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.3' },
    })
    expect(screen.queryByText('Select a chapter before generating.')).not.toBeInTheDocument()
  })

  it('Generate button disabled when backend is unavailable', () => {
    vi.mocked(useBackendStatus).mockReturnValue('unavailable')
    render(<InputPanel />)
    const btn = screen.getByRole('button', { name: /convert to japanese/i })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('InputPanel — collapse and phase-aware button', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('collapses form fields when phase is generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit inputs/i })).toBeInTheDocument()
  })

  it('shows Stop button when phase is generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument()
  })

  it('Stop button dispatches cancel()', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }))
    expect(useAuthoringStore.getState().phase).toBe('cancelling')
  })

  it('shows Stopping… when phase is cancelling', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    useAuthoringStore.getState().cancel()
    render(<InputPanel />)
    expect(screen.getByText('Stopping…')).toBeInTheDocument()
  })

  it('re-expands form fields when phase returns to idle', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    const { rerender } = render(<InputPanel />)
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    useAuthoringStore.getState()._resolveCancel()
    rerender(<InputPanel />)
    expect(screen.getByLabelText(/english story/i)).toBeInTheDocument()
  })

  it('Edit inputs button manually expands form while generating', () => {
    useAuthoringStore.getState().setInputText('A story.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /edit inputs/i }))
    expect(screen.getByLabelText(/english story/i)).toBeInTheDocument()
  })

  it('collapsed summary shows truncated input text from storedInputs', () => {
    useAuthoringStore.getState().setInputText('A story about Tanaka.')
    useAuthoringStore.getState().setChapterTarget('Genki I Ch.6')
    useAuthoringStore.getState().generate()
    render(<InputPanel />)
    expect(screen.getByText(/A story about Tanaka/)).toBeInTheDocument()
  })

  it('collapses form fields when phase is proposal', () => {
    act(() => {
      useAuthoringStore.getState().setPathMode('B')
      useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
      useAuthoringStore.getState().setTopicText('My topic.')
      useAuthoringStore.getState()._setProposalText('English draft here.')
    })
    render(<InputPanel />)
    // Full form not visible
    expect(screen.queryByLabelText(/genki chapter/i)).not.toBeInTheDocument()
    // Collapsed summary + Edit inputs visible
    expect(screen.getByRole('button', { name: /edit inputs/i })).toBeInTheDocument()
  })

  it('collapsed summary shows topicText for Path B in proposal phase', () => {
    act(() => {
      useAuthoringStore.getState().setPathMode('B')
      useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
      useAuthoringStore.getState().setTopicText('Shopping at the market.')
      useAuthoringStore.getState()._setProposalText('English draft here.')
      // generate() to create storedInputs snapshot with topicText
      useAuthoringStore.getState().generate()
      // restore to proposal after generate creates storedInputs
      useAuthoringStore.getState()._setProposalText('English draft here.')
    })
    render(<InputPanel />)
    expect(screen.getByText(/Shopping at the market/)).toBeInTheDocument()
  })
})

describe('InputPanel — SessionRestoreBanner', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })

  afterEach(() => { useAuthoringStore.getState()._reset() })

  it('shows banner when sessionRestored is true', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    expect(screen.getByText(/restored from previous session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^clear$/i })).toBeInTheDocument()
  })

  it('does not show banner when sessionRestored is false', () => {
    render(<InputPanel />)
    expect(screen.queryByText(/restored from previous session/i)).not.toBeInTheDocument()
  })

  it('Clear button in banner calls store.clear() and resets state', () => {
    act(() => {
      useAuthoringStore.setState({
        sessionRestored: true,
        inputText: 'some text',
        chapterTarget: 'Genki I Ch.3',
      })
    })
    render(<InputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().inputText).toBe('')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('editing story textarea clears sessionRestored', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/english story/i), {
      target: { value: 'new text' },
    })
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('changing chapter selector clears sessionRestored', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.3' },
    })
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('editing steering instructions clears sessionRestored', () => {
    act(() => useAuthoringStore.setState({ sessionRestored: true }))
    render(<InputPanel />)
    // Open the steering instructions collapsible first
    fireEvent.click(screen.getByRole('button', { name: /steering instructions/i }))
    const steeringArea = screen.getByLabelText(/optional guidance/i)
    fireEvent.change(steeringArea, { target: { value: 'Use simple vocabulary' } })
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })
})

describe('InputPanel — Path B mode', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
    // Switch to Path B
    useAuthoringStore.getState().setPathMode('B')
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('renders TopicTextarea in place of English story textarea in Path B', () => {
    render(<InputPanel />)
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/topic/i)).toBeInTheDocument()
  })

  it('shows "Generate" button label in Path B', () => {
    render(<InputPanel />)
    expect(screen.getByRole('button', { name: /^generate$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /convert to japanese/i })).not.toBeInTheDocument()
  })

  it('pre-flight validation checks topicText in Path B (empty topic shows hint)', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(screen.getByText('Enter a topic before generating.')).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('pre-flight validation passes with topicText + chapter in Path B', () => {
    useAuthoringStore.getState().setTopicText('library study')
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^generate$/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('switching from Path B to Path A re-enables Generate button (isConfirmOpen reset)', () => {
    const { rerender } = render(<InputPanel />)
    // Start in Path B (already set in beforeEach), switch to Path A
    act(() => useAuthoringStore.getState().setPathMode('A'))
    rerender(<InputPanel />)
    // After switch, Generate button should reflect Path A label
    expect(screen.getByRole('button', { name: /convert to japanese/i })).toBeInTheDocument()
  })
})

describe('InputPanel — Path C mode', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
    // Switch to Path C (Japanese story)
    act(() => useAuthoringStore.getState().setPathMode('C'))
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('renders a Japanese story textarea carrying font-ja', () => {
    const { container } = render(<InputPanel />)
    const ta = container.querySelector('textarea#input-text')
    expect(ta).toBeInTheDocument()
    expect(screen.getByLabelText(/japanese story/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/english story/i)).not.toBeInTheDocument()
    expect(ta).toHaveClass('font-ja')
  })

  it('updates inputText in store on Japanese textarea change', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/japanese story/i), {
      target: { value: '日本語の物語' },
    })
    expect(useAuthoringStore.getState().inputText).toBe('日本語の物語')
  })

  it('offers the "Unspecified" chapter option in Path C', () => {
    render(<InputPanel />)
    expect(screen.getByRole('option', { name: /unspecified/i })).toBeInTheDocument()
  })

  it('"Unspecified" option value is exactly the "unspecified" sentinel', () => {
    render(<InputPanel />)
    expect(screen.getByRole('option', { name: /unspecified/i })).toHaveValue('unspecified')
  })

  it('hides the ScopeChip and shows helper text when chapter is "unspecified"', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'unspecified' },
    })
    // No ScopeChip (its scope line renders "NN vocab"); regex avoids matching "vocabulary" in the helper
    expect(screen.queryByText(/\d+ vocab/)).not.toBeInTheDocument()
    // Helper text explains the natural-difficulty behaviour
    expect(screen.getByText(/keeps its natural difficulty/i)).toBeInTheDocument()
  })

  it('shows a ScopeChip for a real chapter in Path C', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.6' },
    })
    expect(screen.getByText('325 vocab')).toBeInTheDocument()
  })

  it('shows the "Create story" button label in Path C', () => {
    render(<InputPanel />)
    expect(screen.getByRole('button', { name: /create story/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /convert to japanese/i })).not.toBeInTheDocument()
  })

  it('validation passes with Japanese inputText + "unspecified" chapter', () => {
    useAuthoringStore.getState().setInputText('凍った日本語。')
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'unspecified' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create story/i }))
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('validation blocks generation when Japanese story is empty', () => {
    render(<InputPanel />)
    fireEvent.change(screen.getByLabelText(/genki chapter/i), {
      target: { value: 'Genki I Ch.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create story/i }))
    // Assert the user is told why, not merely that nothing generated — a silent no-op
    // (e.g. button disabled for an unrelated reason) would also leave phase at 'idle'.
    expect(screen.getByText('Enter your Japanese story before generating.')).toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })
})

describe('InputPanel — Unspecified option gating', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('offers "Unspecified" in Path A', () => {
    render(<InputPanel />)
    expect(screen.getByRole('option', { name: /unspecified/i })).toBeInTheDocument()
  })

  it('does NOT offer "Unspecified" in Path B', () => {
    act(() => useAuthoringStore.getState().setPathMode('B'))
    render(<InputPanel />)
    expect(screen.queryByRole('option', { name: /unspecified/i })).not.toBeInTheDocument()
  })
})

describe('InputPanel — content provenance note', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(useBackendStatus).mockReturnValue('connected')
  })

  it('shows provenance note in the expanded form', () => {
    render(<InputPanel />)
    expect(
      screen.getByText(/english source material must be original or appropriately licensed/i)
    ).toBeInTheDocument()
  })
})
