// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Mock DOM-touching lib functions used by save() inside the store
vi.mock('@/lib/validateStoryJson', () => ({
  validateStoryJson: vi.fn(() => []),
}))
vi.mock('@/lib/downloadStoryFile', () => ({
  downloadStoryFile: vi.fn(),
}))

import { act, render, screen, fireEvent } from '@testing-library/react'
import { OutputPanel } from '../components/OutputPanel'
import { useAuthoringStore } from '../stores/authoringStore'
import { validateStoryJson } from '@/lib/validateStoryJson'

// Helper: reach output-clean with storedInputs set (mirrors production flow)
const reachOutputClean = (json = '{}') => {
  useAuthoringStore.getState().generate()        // sets storedInputs, enters generating
  useAuthoringStore.getState()._setOutputJson(json)  // enters output-clean
}

describe('OutputPanel', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('has h-0 class when phase is idle', () => {
    const { container } = render(<OutputPanel />)
    const section = container.querySelector('[aria-label="Generated story output"]')
    expect(section).toHaveClass('h-0')
  })

  it('does not have h-0 when phase is output-clean', () => {
    reachOutputClean('{"test":true}')
    const { container } = render(<OutputPanel />)
    const section = container.querySelector('[aria-label="Generated story output"]')
    expect(section).not.toHaveClass('h-0')
  })

  it('does not have h-0 when phase is output-dirty', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    const { container } = render(<OutputPanel />)
    const section = container.querySelector('[aria-label="Generated story output"]')
    expect(section).not.toHaveClass('h-0')
  })

  it('shows textarea with outputJson content', () => {
    reachOutputClean('{"key":"value"}')
    render(<OutputPanel />)
    const ta = screen.getByLabelText(/generated story json/i)
    expect(ta).toHaveValue('{"key":"value"}')
  })

  it('textarea change moves phase to output-dirty and syncs outputJson to store', () => {
    reachOutputClean()
    render(<OutputPanel />)
    const ta = screen.getByLabelText(/generated story json/i)
    fireEvent.change(ta, { target: { value: '{edited}' } })
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
    expect(useAuthoringStore.getState().outputJson).toBe('{edited}')
  })

  it('shows "Unsaved edits" when outputIsDirty', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    expect(screen.getByText('Unsaved edits')).toBeInTheDocument()
  })

  it('does not show "Unsaved edits" when output-clean', () => {
    reachOutputClean()
    render(<OutputPanel />)
    expect(screen.queryByText('Unsaved edits')).not.toBeInTheDocument()
  })

  it('Re-run button is visible in output-clean', () => {
    reachOutputClean()
    render(<OutputPanel />)
    expect(screen.getByRole('button', { name: /re-run/i })).toBeInTheDocument()
  })

  it('Re-run from output-clean calls rerun() without showing warning', () => {
    reachOutputClean()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('Re-run from output-dirty shows RerunWarning', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/re-running will replace your edits/i)).toBeInTheDocument()
  })

  it('Re-run from output-dirty does not immediately fire rerun()', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
  })

  it('RerunWarning Discard button calls rerun() and hides warning', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: /discard my edits/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('RerunWarning Cancel hides warning and keeps output-dirty', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
  })
})

describe('OutputPanel — Save & Download button', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(validateStoryJson).mockReturnValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('is not in the DOM when phase is idle (panel is collapsed)', () => {
    render(<OutputPanel />)
    expect(screen.queryByRole('button', { name: /save & download/i })).not.toBeInTheDocument()
  })

  it('is not aria-disabled when phase is output-clean with outputJson set', () => {
    reachOutputClean('{"id":"x"}')
    render(<OutputPanel />)
    const btn = screen.getByRole('button', { name: /save & download/i })
    expect(btn).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('is aria-disabled when outputJson is null despite being in an output-visible phase', () => {
    // Force output-clean with null outputJson (edge case — shouldn't occur in prod,
    // but verifies the aria-disabled guard fires on canSave = false)
    reachOutputClean('{}')
    act(() => useAuthoringStore.setState({ outputJson: null }))
    render(<OutputPanel />)
    // OutputPanel is visible because phase is output-clean...
    // ...but canSave is false because outputJson is null
    const btn = screen.getByRole('button', { name: /save & download/i })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('calls store.save() when clicked in output-clean phase', () => {
    reachOutputClean('{"id":"x"}')
    const saveSpy = vi.spyOn(useAuthoringStore.getState(), 'save')
    render(<OutputPanel />)
    fireEvent.click(screen.getByRole('button', { name: /save & download/i }))
    expect(saveSpy).toHaveBeenCalled()
  })

  it('shows ValidationErrorList when store has validationErrors', () => {
    reachOutputClean('{}')
    act(() => {
      useAuthoringStore.setState({
        validationErrors: [{ rule: 'JSON_PARSE', message: 'bad json' }],
      })
    })
    render(<OutputPanel />)
    // ValidationErrorList uses role="alert"; RerunWarning also uses role="alert" but is not shown here
    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1 validation error/i)).toBeInTheDocument()
    expect(screen.getByText('JSON_PARSE')).toBeInTheDocument()
  })

  it('shows toast when downloadToastId is set in the store', async () => {
    reachOutputClean('{}')
    render(<OutputPanel />)
    act(() => {
      useAuthoringStore.setState({ downloadToastId: 'my-story' })
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Downloaded my-story.json')
  })

  it('clears _clearDownloadToast after toast appears', async () => {
    reachOutputClean('{}')
    render(<OutputPanel />)
    act(() => {
      useAuthoringStore.setState({ downloadToastId: 'my-story' })
    })
    await screen.findByRole('status')
    // _clearDownloadToast should have been called, resetting the store's downloadToastId
    expect(useAuthoringStore.getState().downloadToastId).toBeNull()
  })
})

describe('OutputPanel — StatsBar', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('shows stats when outputJson is set', () => {
    const json = JSON.stringify({
      schema_version: '1',
      id: 'test',
      grammar: ['〜です', '〜ます'],
      vocab_supplement: [],
      sentences: [
        { id: 's1', words: ['a', 'b'], vocab_keys: [1, null], grammar: [0] },
        { id: 's2', words: ['c'], vocab_keys: [null], grammar: [1] },
      ],
    })
    reachOutputClean(json)
    render(<OutputPanel />)
    // s1 has vocab_key 1 (non-null), s2 has null only — unique non-null keys = {1} → 1 item
    expect(screen.getByText(/2 sentences/i)).toBeInTheDocument()
    expect(screen.getByText(/1 vocab item/i)).toBeInTheDocument()
    expect(screen.getByText(/2 grammar patterns/i)).toBeInTheDocument()
  })

  it('does not show stats before generation', () => {
    render(<OutputPanel />)
    expect(screen.queryByText(/sentences/i)).not.toBeInTheDocument()
  })
})
