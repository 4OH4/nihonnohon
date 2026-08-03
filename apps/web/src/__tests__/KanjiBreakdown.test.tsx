// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { KanjiBreakdown } from '@/components/KanjiBreakdown'
import { _initKanjiFromData, _resetKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

const kanjiFixture: Record<string, KanjiEntry> = {
  '食': { char: '食', kw: 'eat', m: ['eat', 'food'], onY: ['ショク'], kunY: ['た.べる'] },
  '日': { char: '日', kw: 'sun', m: ['sun', 'day'], onY: ['ニチ', 'ジツ'], kunY: ['ひ', 'か'] },
  '本': { char: '本', kw: 'root', m: ['root', 'origin', 'book'], onY: ['ホン'], kunY: ['もと'] },
  '無': { char: '無', kw: null, m: ['nothingness', 'none'], onY: ['ム', 'ブ'], kunY: ['な.い'] },
}

// Both helpers notify KanjiBreakdown's subscription, so they run inside act().
beforeEach(() => {
  act(() => _initKanjiFromData(kanjiFixture))
})

afterEach(() => {
  act(() => _resetKanji())
})

describe('KanjiBreakdown', () => {
  it('renders kanji character and kw label for a pure-kanji word', () => {
    render(<KanjiBreakdown word="食" />)
    expect(screen.getByText('食')).toBeInTheDocument()
    expect(screen.getByText('eat')).toBeInTheDocument()
  })

  it('renders each kanji entry for a multi-kanji word', () => {
    render(<KanjiBreakdown word="日本" />)
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('sun')).toBeInTheDocument()
    expect(screen.getByText('本')).toBeInTheDocument()
    expect(screen.getByText('root')).toBeInTheDocument()
  })

  it('renders nothing (null) for a hiragana-only word', () => {
    const { container } = render(<KanjiBreakdown word="たべる" />)
    expect(container.firstChild).toBeNull()
  })

  // One cell per kanji, flat — the row direction is CSS (a column on mobile, a
  // horizontal row at lg), so there are no wrapper rows to balance cells across.
  it('renders one flat cell per kanji', () => {
    render(<KanjiBreakdown word="日本食無" />)
    const region = screen.getByLabelText('Kanji breakdown')
    expect(region.children).toHaveLength(4)
    ;['日', '本', '食', '無'].forEach((c) => expect(screen.getByText(c)).toBeInTheDocument())
  })

  // The cell, not its keyword, owns the width — otherwise the keyword's own
  // max-content sizes the cell and can never wrap inside it (issue #19). Fixed
  // rather than capped, so the characters do not shift between lookups.
  it('fixes the breakdown width so a long keyword wraps rather than widening the panel', () => {
    render(<KanjiBreakdown word="食" />)
    const region = screen.getByLabelText('Kanji breakdown')
    expect(region.className).toContain('w-[45%]')
    expect(region.className).toContain('shrink-0')
    expect(screen.getByText('eat').className).toContain('break-words')
  })

  it('renders nothing (null) for a katakana-only word', () => {
    const { container } = render(<KanjiBreakdown word="タベル" />)
    expect(container.firstChild).toBeNull()
  })

  it('skips hiragana characters in a mixed kanji+hiragana word', () => {
    render(<KanjiBreakdown word="食べる" />)
    expect(screen.getByText('食')).toBeInTheDocument()
    expect(screen.getByText('eat')).toBeInTheDocument()
    // hiragana べ and る should not appear as separate entries
    expect(screen.queryByText('べ')).toBeNull()
    expect(screen.queryByText('る')).toBeNull()
  })

  it('omits a kanji with no entry while still rendering its neighbours', () => {
    // 喫 is absent from the fixture, standing in for a kanji outside the set
    // kanji-data.json covers. It gets no cell — a character with no keyword only
    // repeats what the word already shows.
    render(<KanjiBreakdown word="喫日本" />)
    expect(screen.queryByText('喫')).toBeNull()
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('本')).toBeInTheDocument()
  })

  it('uses entry.m[0] as fallback label when kw is null', () => {
    render(<KanjiBreakdown word="無" />)
    expect(screen.getByText('無')).toBeInTheDocument()
    expect(screen.getByText('nothingness')).toBeInTheDocument()
  })

  it('renders nothing when the kanji map is empty (no recognised chars)', () => {
    _resetKanji()
    _initKanjiFromData({})
    const { container } = render(<KanjiBreakdown word="食べる" />)
    expect(container.firstChild).toBeNull()
  })

  it('applies lang="ja" to each kanji character span', () => {
    render(<KanjiBreakdown word="日" />)
    const span = screen.getByText('日')
    expect(span).toHaveAttribute('lang', 'ja')
  })

  // kanji-data.json is fetched off the critical path, so a word can be looked up
  // before it arrives. The breakdown must fill itself in when the data lands
  // rather than staying empty until the next lookup.
  it('populates itself when the kanji data arrives after render', () => {
    _resetKanji()
    const { container } = render(<KanjiBreakdown word="日本" />)
    expect(container.firstChild).toBeNull()

    act(() => _initKanjiFromData(kanjiFixture))

    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('sun')).toBeInTheDocument()
    expect(screen.getByText('本')).toBeInTheDocument()
  })

  it('renders a kanji that appears twice in the word without deduplication', () => {
    render(<KanjiBreakdown word="日日" />)
    const chars = screen.getAllByText('日')
    expect(chars).toHaveLength(2)
  })
})
