import { render, screen, fireEvent, act } from '@testing-library/react'
import { ProposalPanel } from '../components/ProposalPanel'
import { useAuthoringStore } from '../stores/authoringStore'

describe('ProposalPanel', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  // ─── Visibility ───────────────────────────────────────────────────────────

  it('is hidden (h-0) when phase is idle', () => {
    const { container } = render(<ProposalPanel />)
    const section = container.querySelector('section')!
    expect(section.classList.contains('h-0')).toBe(true)
    // Textarea not rendered when hidden
    expect(screen.queryByRole('textbox', { name: /english story proposal/i })).not.toBeInTheDocument()
  })

  it('is hidden when phase is output-clean', () => {
    act(() => {
      useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    })
    const { container } = render(<ProposalPanel />)
    const section = container.querySelector('section')!
    expect(section.classList.contains('h-0')).toBe(true)
  })

  it('is visible and shows textarea when phase is proposal', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('Ken went to the park.')
    })
    render(<ProposalPanel />)
    const textarea = screen.getByRole('textbox', { name: /english story proposal/i })
    expect(textarea).toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toBe('Ken went to the park.')
  })

  // ─── Textarea editing ─────────────────────────────────────────────────────

  it('updates proposalText in store when textarea changes', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('Original text.')
    })
    render(<ProposalPanel />)
    const textarea = screen.getByRole('textbox', { name: /english story proposal/i })
    fireEvent.change(textarea, { target: { value: 'Edited text.' } })
    expect(useAuthoringStore.getState().proposalText).toBe('Edited text.')
  })

  // ─── Convert to Japanese button ───────────────────────────────────────────

  it('renders Convert to Japanese button when in proposal phase', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('Some proposal.')
    })
    render(<ProposalPanel />)
    expect(screen.getByRole('button', { name: /convert to japanese/i })).toBeInTheDocument()
  })

  it('calls approve() when Convert to Japanese is clicked', () => {
    const approveSpy = vi.spyOn(useAuthoringStore.getState(), 'approve')
    act(() => {
      // Set mode/chapter before proposalText so setPathMode doesn't reset phase
      useAuthoringStore.getState().setPathMode('B')
      useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
      useAuthoringStore.getState()._setProposalText('A story proposal.')
    })
    render(<ProposalPanel />)
    fireEvent.click(screen.getByRole('button', { name: /convert to japanese/i }))
    expect(approveSpy).toHaveBeenCalledTimes(1)
    approveSpy.mockRestore()
  })

  it('disables Convert to Japanese when proposal textarea is empty', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('')
    })
    render(<ProposalPanel />)
    const btn = screen.getByRole('button', { name: /convert to japanese/i })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    expect(btn).toBeDisabled()
  })

  it('disables Convert to Japanese when proposal is whitespace only', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('   ')
    })
    render(<ProposalPanel />)
    const btn = screen.getByRole('button', { name: /convert to japanese/i })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('enables Convert to Japanese when proposal has content', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('A story.')
    })
    render(<ProposalPanel />)
    const btn = screen.getByRole('button', { name: /convert to japanese/i })
    expect(btn).not.toBeDisabled()
    expect(btn).toHaveAttribute('aria-disabled', 'false')
  })

  // ─── Regenerate button ────────────────────────────────────────────────────

  it('renders Regenerate button when in proposal phase', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('A draft.')
    })
    render(<ProposalPanel />)
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('calls generate() when Regenerate is clicked', () => {
    const generateSpy = vi.spyOn(useAuthoringStore.getState(), 'generate')
    act(() => {
      // Set mode/chapter BEFORE proposalText so setPathMode doesn't reset phase
      useAuthoringStore.getState().setPathMode('B')
      useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
      useAuthoringStore.getState().setTopicText('A topic.')
      useAuthoringStore.getState()._setProposalText('A draft.')
    })
    render(<ProposalPanel />)
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(generateSpy).toHaveBeenCalledTimes(1)
    generateSpy.mockRestore()
  })

  it('transitions to generating phase when Regenerate clicked', () => {
    act(() => {
      // Set mode/chapter BEFORE proposalText so setPathMode doesn't reset phase
      useAuthoringStore.getState().setPathMode('B')
      useAuthoringStore.getState().setChapterTarget('Genki I Ch.5')
      useAuthoringStore.getState().setTopicText('My topic.')
      useAuthoringStore.getState()._setProposalText('A draft.')
    })
    render(<ProposalPanel />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    })
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  // ─── Error note ───────────────────────────────────────────────────────────

  it('shows inline error note when errorCode is set in proposal phase', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('A draft.')
      useAuthoringStore.setState({ errorCode: 'TIMEOUT', errorMessage: 'Timed out — try again.' })
    })
    render(<ProposalPanel />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toContain('Timed out — try again.')
  })

  it('shows fallback error message when errorMessage is null but errorCode is set', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('A draft.')
      useAuthoringStore.setState({ errorCode: 'TIMEOUT', errorMessage: null })
    })
    render(<ProposalPanel />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Conversion failed')
  })

  it('does NOT show error note when errorCode is null', () => {
    act(() => {
      useAuthoringStore.getState()._setProposalText('A draft.')
      // errorCode defaults to null
    })
    render(<ProposalPanel />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
