// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu } from '@/components/SettingsMenu'
import { usePreferenceStore } from '@/stores/preferenceStore'

const DEFAULT_PREFS = {
  spacingVisible: false,
  rubyMode: 'all' as const,
  transVisible: false,
  textSize: 'medium' as const,
}

afterEach(() => {
  usePreferenceStore.setState(DEFAULT_PREFS)
  localStorage.clear()
})

describe('SettingsMenu', () => {
  it('renders a settings trigger button', () => {
    render(<SettingsMenu />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('clicking trigger opens popover with toggles and text size controls', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('Spaces')).toBeInTheDocument()
    expect(screen.getByText('Ruby')).toBeInTheDocument()
    expect(screen.getByText('Trans.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ruby:/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medium text/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeInTheDocument()
  })

  it('Spaces toggle updates spacingVisible in store', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spaces' }))
    expect(usePreferenceStore.getState().spacingVisible).toBe(true)
  })

  it('Ruby button cycles all -> supplement -> none -> all', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    // The accessible name carries the current mode, so match on the prefix: the same
    // locator keeps resolving as the label changes under it.
    const ruby = () => screen.getByRole('button', { name: /^Ruby:/ })
    fireEvent.click(ruby())
    expect(usePreferenceStore.getState().rubyMode).toBe('supplement')
    fireEvent.click(ruby())
    expect(usePreferenceStore.getState().rubyMode).toBe('none')
    fireEvent.click(ruby())
    expect(usePreferenceStore.getState().rubyMode).toBe('all')
  })

  it('Ruby button label tracks the current mode', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: /^Ruby:/ })).toHaveTextContent('All')
    fireEvent.click(screen.getByRole('button', { name: /^Ruby:/ }))
    expect(screen.getByRole('button', { name: /^Ruby:/ })).toHaveTextContent('New')
    fireEvent.click(screen.getByRole('button', { name: /^Ruby:/ }))
    expect(screen.getByRole('button', { name: /^Ruby:/ })).toHaveTextContent('Off')
  })

  it('Ruby button shows the accent only while ruby is showing', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const ruby = () => screen.getByRole('button', { name: /^Ruby:/ })
    // Cycled by click rather than setState so each change is act()-wrapped and re-renders.
    expect(ruby()).toHaveClass('bg-accent-subtle')   // all
    fireEvent.click(ruby())
    expect(ruby()).toHaveClass('bg-accent-subtle')   // supplement
    fireEvent.click(ruby())
    expect(ruby()).not.toHaveClass('bg-accent-subtle') // none
  })

  it('Trans toggle updates transVisible in store', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trans.' }))
    expect(usePreferenceStore.getState().transVisible).toBe(true)
  })

  it('A− button sets textSize to small', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }))
    expect(usePreferenceStore.getState().textSize).toBe('small')
  })

  it('A+ button sets textSize to large', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(usePreferenceStore.getState().textSize).toBe('large')
  })

  it('A button resets textSize to medium', () => {
    usePreferenceStore.setState({ textSize: 'large' })
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /Medium text/ }))
    expect(usePreferenceStore.getState().textSize).toBe('medium')
  })

  it('active size button has bg-accent-subtle; inactive buttons do not', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: /Medium text/ })).toHaveClass('bg-accent-subtle')
    expect(screen.getByRole('button', { name: 'Smaller text' })).not.toHaveClass('bg-accent-subtle')
    expect(screen.getByRole('button', { name: 'Larger text' })).not.toHaveClass('bg-accent-subtle')
  })
})
