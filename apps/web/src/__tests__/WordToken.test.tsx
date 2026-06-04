// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { WordToken } from '@/components/WordToken'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initVocabFromData, _resetVocab } from '@/services/vocabService'
import type { ParsedWord, VocabEntry } from '@nihonnohon/schema'

const vocabFixture: VocabEntry[] = [
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
]

/** Build a single-segment ParsedWord for concise test setup. */
const makeToken = (surface: string, ruby: string | null = null): ParsedWord => ({
  surface,
  segments: [{ text: surface, ruby }],
})

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
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    expect(screen.getByRole('button', { name: '食べる' })).toBeInTheDocument()
  })

  it('rt element has invisible class when rubyVisible is false', () => {
    act(() => { usePreferenceStore.setState({ rubyVisible: false }) })
    const { container } = render(
      <WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.classList.contains('invisible')).toBe(true)
  })

  it('rt element does NOT use display:none for ruby toggle', () => {
    act(() => { usePreferenceStore.setState({ rubyVisible: false }) })
    const { container } = render(
      <WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.style.display).not.toBe('none')
  })

  it('rt element has no invisible class when rubyVisible is true', () => {
    const { container } = render(
      <WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />
    )
    const rt = container.querySelector('rt')!
    expect(rt.classList.contains('invisible')).toBe(false)
  })

  it('click calls lookup for a valid vocabKey', () => {
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    const state = useLookupStore.getState()
    expect(state.lookupState).toMatchObject({ status: 'found', word: '食べる' })
    expect(state.selectedSentenceId).toBe('s1')
  })

  it('Enter keydown calls lookup', () => {
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    fireEvent.keyDown(screen.getByRole('button', { name: '食べる' }), { key: 'Enter' })
    expect(useLookupStore.getState().lookupState).toMatchObject({ status: 'found', word: '食べる' })
  })

  it('Space keydown calls lookup', () => {
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    fireEvent.keyDown(screen.getByRole('button', { name: '食べる' }), { key: ' ' })
    expect(useLookupStore.getState().lookupState).toMatchObject({ status: 'found', word: '食べる' })
  })

  it('click is silently ignored when vocabKey is null', () => {
    render(<WordToken token={makeToken('は')} vocabKey={null} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'は' }))
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('click is silently ignored when lookupVocab returns null (unknown id)', () => {
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={999} sentenceId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('active word shows accent-subtle and accent border classes', () => {
    const { rerender } = render(
      <WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />
    )
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    rerender(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    const btn = screen.getByRole('button', { name: '食べる' })
    expect(btn.classList.contains('bg-accent-subtle')).toBe(true)
    expect(btn.classList.contains('border-b-2')).toBe(true)
    expect(btn.classList.contains('border-accent')).toBe(true)
  })

  it('non-active word does not have accent-subtle background', () => {
    render(<WordToken token={makeToken('食べる', 'たべる')} vocabKey={42} sentenceId="s1" />)
    const btn = screen.getByRole('button', { name: '食べる' })
    expect(btn.classList.contains('bg-accent-subtle')).toBe(false)
  })

  // Per-segment rendering tests

  it('renders per-segment ruby: kanji block with okurigana', () => {
    const token: ParsedWord = {
      surface: '食べる',
      segments: [{ text: '食', ruby: 'た' }, { text: 'べる', ruby: null }],
    }
    const { container } = render(
      <WordToken token={token} vocabKey={null} sentenceId="s1" />
    )
    const rubies = container.querySelectorAll('ruby')
    expect(rubies).toHaveLength(1)
    expect(rubies[0].querySelector('rt')!.textContent).toBe('た')
    expect(container.querySelector('[role="button"]')!.textContent).toContain('べる')
  })

  it('renders per-segment ruby: two annotated kanji with interleaved kana', () => {
    const token: ParsedWord = {
      surface: '付け加える',
      segments: [
        { text: '付', ruby: 'つ' },
        { text: 'け', ruby: null },
        { text: '加', ruby: 'くわ' },
        { text: 'える', ruby: null },
      ],
    }
    const { container } = render(
      <WordToken token={token} vocabKey={null} sentenceId="s1" />
    )
    const rubies = container.querySelectorAll('ruby')
    expect(rubies).toHaveLength(2)
    expect(rubies[0].querySelector('rt')!.textContent).toBe('つ')
    expect(rubies[1].querySelector('rt')!.textContent).toBe('くわ')
  })

  it('renders whole-word annotation as single ruby element (jukujikun)', () => {
    const token: ParsedWord = {
      surface: '大人',
      segments: [{ text: '大人', ruby: 'おとな' }],
    }
    const { container } = render(
      <WordToken token={token} vocabKey={null} sentenceId="s1" />
    )
    const rubies = container.querySelectorAll('ruby')
    expect(rubies).toHaveLength(1)
    expect(rubies[0].querySelector('rt')!.textContent).toBe('おとな')
  })

  it('renders single kanji annotation', () => {
    const token: ParsedWord = {
      surface: '私',
      segments: [{ text: '私', ruby: 'わたし' }],
    }
    const { container } = render(
      <WordToken token={token} vocabKey={null} sentenceId="s1" />
    )
    const rubies = container.querySelectorAll('ruby')
    expect(rubies).toHaveLength(1)
    expect(rubies[0].querySelector('rt')!.textContent).toBe('わたし')
  })

  it('renders no rt elements when all segments have ruby null', () => {
    const { container } = render(
      <WordToken token={makeToken('は')} vocabKey={null} sentenceId="s1" />
    )
    expect(container.querySelectorAll('rt')).toHaveLength(0)
  })

  it('invisible class applies to all rt elements when rubyVisible is false', () => {
    act(() => { usePreferenceStore.setState({ rubyVisible: false }) })
    const token: ParsedWord = {
      surface: '付け加える',
      segments: [
        { text: '付', ruby: 'つ' },
        { text: 'け', ruby: null },
        { text: '加', ruby: 'くわ' },
        { text: 'える', ruby: null },
      ],
    }
    const { container } = render(
      <WordToken token={token} vocabKey={null} sentenceId="s1" />
    )
    const rts = container.querySelectorAll('rt')
    expect(rts).toHaveLength(2)
    rts.forEach(rt => expect(rt.classList.contains('invisible')).toBe(true))
  })
})
