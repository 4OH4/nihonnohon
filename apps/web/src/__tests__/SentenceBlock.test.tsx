// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { SentenceBlock } from '@/components/SentenceBlock'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initVocabFromData, _resetVocab } from '@/services/vocabService'
import type { SentenceModel, VocabEntry } from '@nihonnohon/schema'

const vocabFixture: VocabEntry[] = [
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
]

const sentence: SentenceModel = {
  id: 'sent-1',
  tokens: [
    { surface: '食べる', segments: [{ text: '食べる', ruby: 'たべる' }] },
    { surface: 'は',     segments: [{ text: 'は',     ruby: null }] },
    { surface: '楽しい', segments: [{ text: '楽しい', ruby: 'たのしい' }] },
  ],
  vocabKeys: [42, null, null],
  translation: 'Eating is fun.',
  grammar: [],
}

const sentenceNoTranslation: SentenceModel = {
  ...sentence,
  id: 'sent-2',
  translation: null,
}

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

describe('SentenceBlock', () => {
  it('renders with role=group and aria-label', () => {
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.getByRole('group', { name: 'Sentence 1' })).toBeInTheDocument()
  })

  it('sentenceIndex drives aria-label (1-based)', () => {
    render(<SentenceBlock sentence={sentence} sentenceIndex={2} />)
    expect(screen.getByRole('group', { name: 'Sentence 3' })).toBeInTheDocument()
  })

  it('renders a WordToken for each token', () => {
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.getByRole('button', { name: '食べる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'は' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '楽しい' })).toBeInTheDocument()
  })

  it('spacingVisible: false → gap-x-0 class', () => {
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    expect(group.classList.contains('gap-x-0')).toBe(true)
    expect(group.classList.contains('gap-x-2')).toBe(false)
  })

  it('spacingVisible: true → gap-x-2 class', () => {
    act(() => { usePreferenceStore.setState({ spacingVisible: true }) })
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    expect(group.classList.contains('gap-x-2')).toBe(true)
    expect(group.classList.contains('gap-x-0')).toBe(false)
  })

  it('selected sentence has bg-accent-subtle class', () => {
    act(() => { useLookupStore.setState({ selectedSentenceId: 'sent-1' }) })
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    expect(group.classList.contains('bg-accent-subtle')).toBe(true)
  })

  it('non-selected sentence does not have bg-accent-subtle', () => {
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    expect(group.classList.contains('bg-accent-subtle')).toBe(false)
  })

  it('container click calls selectSentence and resets lookupState to idle', () => {
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    fireEvent.click(group)
    expect(useLookupStore.getState().selectedSentenceId).toBe('sent-1')
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('translation shown when transVisible is true and translation is non-null', () => {
    act(() => { usePreferenceStore.setState({ transVisible: true }) })
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.getByText('Eating is fun.')).toBeInTheDocument()
  })

  it('translation hidden when transVisible is false', () => {
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.queryByText('Eating is fun.')).not.toBeInTheDocument()
  })

  it('translation not rendered when sentence.translation is null', () => {
    act(() => { usePreferenceStore.setState({ transVisible: true }) })
    render(<SentenceBlock sentence={sentenceNoTranslation} sentenceIndex={0} />)
    expect(screen.queryByText('Eating is fun.')).not.toBeInTheDocument()
  })

  it('inline translation shown when this sentence is the translated one (global toggle off)', () => {
    act(() => { useLookupStore.setState({ translatedSentenceId: 'sent-1' }) })
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.getByText('Eating is fun.')).toBeInTheDocument()
  })

  it('inline translation not shown for a different translated sentence', () => {
    act(() => { useLookupStore.setState({ translatedSentenceId: 'other' }) })
    render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    expect(screen.queryByText('Eating is fun.')).not.toBeInTheDocument()
  })

  it('pressing "t" reveals this sentence\'s translation (keyboard fallback for long-press)', () => {
    const { container } = render(<SentenceBlock sentence={sentence} sentenceIndex={0} />)
    const group = container.querySelector('[role="group"]')!
    fireEvent.keyDown(group, { key: 't' })
    expect(useLookupStore.getState().translatedSentenceId).toBe('sent-1')
    expect(screen.getByText('Eating is fun.')).toBeInTheDocument()
  })
})
