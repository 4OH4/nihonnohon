import { render, screen, fireEvent } from '@testing-library/react'
import { OutputPanel } from '../components/OutputPanel'
import { useAuthoringStore } from '../stores/authoringStore'

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
