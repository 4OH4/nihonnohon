import { render, screen, act } from '@testing-library/react'
import { BackendStatus } from '../components/BackendStatus'

describe('BackendStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows "Checking…" initially before first fetch resolves', () => {
    // fetch hangs — never resolves during this test
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<BackendStatus />)
    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })

  it('shows "Backend connected" and green dot when /health returns 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    render(<BackendStatus />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Backend connected')).toBeInTheDocument()
    // Green dot has bg-success class
    const dot = document.querySelector('[aria-hidden="true"]')
    expect(dot).toHaveClass('bg-success')
  })

  it('shows "Backend unavailable" and warning dot when /health fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    render(<BackendStatus />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()
    const dot = document.querySelector('[aria-hidden="true"]')
    expect(dot).toHaveClass('bg-warning')
  })

  it('shows "Backend unavailable" when /health returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    render(<BackendStatus />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()
  })

  it('has aria-live="polite" on the label text', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<BackendStatus />)
    const liveEl = document.querySelector('[aria-live="polite"]')
    expect(liveEl).toBeInTheDocument()
  })
})
