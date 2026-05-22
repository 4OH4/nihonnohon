// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu } from '@/components/SettingsMenu'
import { usePreferenceStore } from '@/stores/preferenceStore'

const DEFAULT_PREFS = {
  spacingVisible: false,
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

  it('clicking trigger opens popover with Spaces and text size controls', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('Spaces')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Medium text/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeInTheDocument()
  })

  it('Spaces toggle updates spacingVisible in store', () => {
    render(<SettingsMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(usePreferenceStore.getState().spacingVisible).toBe(true)
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
