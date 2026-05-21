// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { render, screen, fireEvent } from '@testing-library/react'
import { ModeToggle } from '../components/ModeToggle'
import { useAuthoringStore } from '../stores/authoringStore'

describe('ModeToggle', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('renders a tablist container', () => {
    render(<ModeToggle />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('renders two tab buttons', () => {
    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveTextContent('Convert a story')
    expect(tabs[1]).toHaveTextContent('Generate from topic')
  })

  it('marks the active mode as aria-selected="true"', () => {
    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    // Default mode is A
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('updates pathMode in store when a tab is clicked', () => {
    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    expect(useAuthoringStore.getState().pathMode).toBe('B')
  })

  it('clears outputJson when switching modes', () => {
    useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    expect(useAuthoringStore.getState().outputJson).toBeTruthy()

    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])  // switch A → B

    expect(useAuthoringStore.getState().outputJson).toBeNull()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })
})

describe('ModeToggle — dirty output warning', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('switches immediately when outputIsDirty is false', () => {
    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    expect(useAuthoringStore.getState().pathMode).toBe('B')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows dirty warning strip instead of switching when outputIsDirty is true', () => {
    useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    useAuthoringStore.getState()._markDirty()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)

    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])  // try to switch to B

    // Mode should NOT have changed yet
    expect(useAuthoringStore.getState().pathMode).toBe('A')
    // Warning strip should appear
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/discard your edited output/i)).toBeInTheDocument()
  })

  it('[Switch anyway] confirms the switch and dismisses the strip', () => {
    useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    useAuthoringStore.getState()._markDirty()

    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])

    fireEvent.click(screen.getByText('Switch anyway'))
    expect(useAuthoringStore.getState().pathMode).toBe('B')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('[Cancel] dismisses the strip without switching', () => {
    useAuthoringStore.getState()._setOutputJson('{"id":"test"}')
    useAuthoringStore.getState()._markDirty()

    render(<ModeToggle />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])

    fireEvent.click(screen.getByText('Cancel'))
    expect(useAuthoringStore.getState().pathMode).toBe('A')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
