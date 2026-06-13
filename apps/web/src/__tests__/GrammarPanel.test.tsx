// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GrammarPanel } from '@/components/GrammarPanel'
import { useLookupStore } from '@/stores/lookupStore'
import type { SentenceModel } from '@nihonnohon/schema'

const grammar = ['Grammar point A', 'Grammar point B', 'Grammar point C']

const sentences: SentenceModel[] = [
  { id: 's1', tokens: [{ surface: 'word', segments: [{ text: 'word', ruby: null }] }], vocabKeys: [null], translation: null, grammar: [] },
  { id: 's2', tokens: [{ surface: 'word', segments: [{ text: 'word', ruby: null }] }], vocabKeys: [null], translation: null, grammar: [0, 2] },
]

afterEach(() => {
  act(() => { useLookupStore.getState()._reset() })
})

describe('GrammarPanel', () => {
  it('renders all grammar points', () => {
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    expect(screen.getByText('Grammar point A')).toBeInTheDocument()
    expect(screen.getByText('Grammar point B')).toBeInTheDocument()
    expect(screen.getByText('Grammar point C')).toBeInTheDocument()
  })

  it('shows empty state when grammar array is empty', () => {
    render(<GrammarPanel grammar={[]} sentences={sentences} />)
    expect(screen.getByText('No grammar notes for this story.')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('renders all items without highlight or muted when no sentence selected', () => {
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    items.forEach(item => {
      expect(item).toHaveClass('text-paper-text')
      expect(item).not.toHaveClass('bg-accent-subtle')
      expect(item).not.toHaveClass('text-muted')
    })
  })

  it('highlights correct indices and mutes others when sentence with grammar is selected', () => {
    act(() => { useLookupStore.setState({ selectedSentenceId: 's2' }) })
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    // s2 has grammar: [0, 2]
    expect(items[0]).toHaveClass('bg-accent-subtle')
    expect(items[0]).toHaveClass('border-accent')
    expect(items[1]).toHaveClass('text-muted')
    expect(items[1]).not.toHaveClass('bg-accent-subtle')
    expect(items[2]).toHaveClass('bg-accent-subtle')
    expect(items[2]).toHaveClass('border-accent')
  })

  it('mutes all items when selected sentence has grammar: []', () => {
    act(() => { useLookupStore.setState({ selectedSentenceId: 's1' }) })
    render(<GrammarPanel grammar={grammar} sentences={sentences} />)
    const items = screen.getAllByRole('listitem')
    items.forEach(item => {
      expect(item).toHaveClass('text-muted')
      expect(item).not.toHaveClass('bg-accent-subtle')
    })
  })
})
