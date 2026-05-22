// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { WordToken } from '@/components/WordToken'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initVocabFromData, _resetVocab } from '@/services/vocabService'
import type { VocabEntry } from '@nihonnohon/schema'

const vocabFixture: VocabEntry[] = [
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
]

const DEFAULT_PREFS = {
  rubyVisible: true,
  spacingVisible: false,
  transVisible: false,
  textSize: 'medium' as const,
  activeTab: 'story' as const,
}

beforeEach(() => {
  _initVocabFromData(vocabFixture)
})

afterEach(() => {
  act(() => {
    useLookupStore.getState()._reset()
    usePreferenceStore.setState(DEFAULT_PREFS)
  })
  localStorage.clear()
  _resetVocab()
})

describe('WordToken', () => {
  it('renders with role=button and aria-label', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    expect(screen.getByRole('button', { name: '食べる' })).toBeInTheDocument()
  })

  it('rt element has invisible class when rubyVisible is false', () => {
    act(() => { usePreferenceStore.setState({ rubyVisible: false }) })
    const { container } = render(
      <WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.classList.contains('invisible')).toBe(true)
  })

  it('rt element does NOT use display:none for ruby toggle', () => {
    act(() => { usePreferenceStore.setState({ rubyVisible: false }) })
    const { container } = render(
      <WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.style.display).not.toBe('none')
  })

  it('rt element has no invisible class when rubyVisible is true', () => {
    const { container } = render(
      <WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.classList.contains('invisible')).toBe(false)
  })

  it('click calls lookup for a valid vocabKey', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    const state = useLookupStore.getState()
    expect(state.lookupState).toMatchObject({ status: 'found', word: '食べる' })
    expect(state.selectedSentenceId).toBe('s1')
  })

  it('Enter keydown calls lookup', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    fireEvent.keyDown(screen.getByRole('button', { name: '食べる' }), { key: 'Enter' })
    expect(useLookupStore.getState().lookupState).toMatchObject({ status: 'found', word: '食べる' })
  })

  it('Space keydown calls lookup', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    fireEvent.keyDown(screen.getByRole('button', { name: '食べる' }), { key: ' ' })
    expect(useLookupStore.getState().lookupState).toMatchObject({ status: 'found', word: '食べる' })
  })

  it('click is silently ignored when vocabKey is null', () => {
    render(<WordToken word="は" ruby={null} vocabKey={null} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'は' }))
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('click is silently ignored when lookupVocab returns null (unknown id)', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={999} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('active word shows accent-subtle and accent border classes', () => {
    const { rerender } = render(
      <WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />
    )
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    rerender(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    const btn = screen.getByRole('button', { name: '食べる' })
    expect(btn.classList.contains('bg-accent-subtle')).toBe(true)
    expect(btn.classList.contains('border-b-2')).toBe(true)
    expect(btn.classList.contains('border-accent')).toBe(true)
  })

  it('non-active word does not have accent-subtle background', () => {
    render(<WordToken word="食べる" ruby="たべる" vocabKey={42} sentenceId="s1" />)
    const btn = screen.getByRole('button', { name: '食べる' })
    expect(btn.classList.contains('bg-accent-subtle')).toBe(false)
  })
})
