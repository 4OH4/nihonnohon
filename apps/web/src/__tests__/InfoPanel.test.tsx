import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { InfoPanel } from '@/components/InfoPanel'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initKanjiFromData, _resetKanji } from '@/services/kanjiService'
import type { StoryModel, VocabEntry, KanjiEntry } from '@nihonnohon/schema'

const storyFixture: StoryModel = {
  schemaVersion: '1',
  id: 'test-story',
  title: 'Test Story',
  titleJa: 'テスト',
  language: 'Japanese',
  difficulty: 'Genki I Ch.6',
  description: 'A test story.',
  keywords: [],
  grammar: [],
  vocabSupplement: [],
  sentences: [],
  metadata: {},
}

const storyNoDifficulty: StoryModel = { ...storyFixture, difficulty: null }

const vocabEntry: VocabEntry = {
  id: 42,
  word: '食べる',
  reading: 'たべる',
  meaning: 'to eat',
  lesson: 'Genki I Ch.3',
}

const hiraganaEntry: VocabEntry = {
  id: 7,
  word: 'たべる',
  reading: 'たべる',
  meaning: 'to eat (hiragana)',
  lesson: 'Genki I Ch.3',
}

const kanjiData: Record<string, KanjiEntry> = {
  '食': { char: '食', kw: 'eat', m: ['eat', 'food'], onY: ['ショク'], kunY: ['た.べる'] },
}

const DEFAULT_PREFS = {
  rubyVisible: true,
  spacingVisible: false,
  transVisible: false,
  textSize: 'medium' as const,
  activeTab: 'story' as const,
}

afterEach(() => {
  act(() => {
    useLookupStore.getState()._reset()
    usePreferenceStore.setState(DEFAULT_PREFS)
  })
  localStorage.clear()
  _resetKanji()
})

describe('InfoPanel', () => {
  it('idle state shows story title, difficulty, and language', () => {
    render(<InfoPanel story={storyFixture} />)
    expect(screen.getByText('Test Story')).toBeInTheDocument()
    expect(screen.getByText('Genki I Ch.6')).toBeInTheDocument()
    expect(screen.getByText('Japanese')).toBeInTheDocument()
  })

  it('idle state omits difficulty when story.difficulty is null', () => {
    render(<InfoPanel story={storyNoDifficulty} />)
    expect(screen.getByText('Test Story')).toBeInTheDocument()
    expect(screen.queryByText('Genki I Ch.6')).toBeNull()
    expect(screen.getByText('Japanese')).toBeInTheDocument()
  })

  it('panel has aria-live="polite" and aria-label="Word lookup panel"', () => {
    const { container } = render(<InfoPanel story={storyFixture} />)
    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveAttribute('aria-live', 'polite')
    expect(panel).toHaveAttribute('aria-label', 'Word lookup panel')
  })

  it('found state shows word, translation, and hiragana reading', () => {
    act(() => {
      useLookupStore.getState().lookup('食べる', vocabEntry, 's1')
    })
    render(<InfoPanel story={storyFixture} />)
    expect(screen.getByText('食べる')).toBeInTheDocument()
    expect(screen.getByText('to eat')).toBeInTheDocument()
    expect(screen.getByText('たべる')).toBeInTheDocument()
  })

  it('found state with kanji word shows KanjiBreakdown entry', () => {
    _initKanjiFromData(kanjiData)
    act(() => {
      useLookupStore.getState().lookup('食べる', vocabEntry, 's1')
    })
    render(<InfoPanel story={storyFixture} />)
    // KanjiBreakdown renders 食 with its kw label
    expect(screen.getByText('食')).toBeInTheDocument()
    expect(screen.getByText('eat')).toBeInTheDocument()
  })

  it('found state with hiragana-only word renders no KanjiBreakdown content', () => {
    _initKanjiFromData({})
    act(() => {
      useLookupStore.getState().lookup('たべる', hiraganaEntry, 's1')
    })
    render(<InfoPanel story={storyFixture} />)
    // KanjiBreakdown returns null — the labelled region should not be in the DOM
    expect(screen.queryByLabelText('Kanji breakdown')).toBeNull()
  })

  it('not-found state shows muted "No entry for" message', () => {
    act(() => {
      useLookupStore.getState().lookup('zzz', null, 's1')
    })
    render(<InfoPanel story={storyFixture} />)
    expect(screen.getByText(/No entry for/)).toBeInTheDocument()
    expect(screen.getByText(/zzz/)).toBeInTheDocument()
  })

  it('Escape key resets to idle state', () => {
    act(() => {
      useLookupStore.getState().lookup('食べる', vocabEntry, 's1')
    })
    render(<InfoPanel story={storyFixture} />)
    expect(useLookupStore.getState().lookupState.status).toBe('found')

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('Escape key has no effect when already idle', () => {
    render(<InfoPanel story={storyFixture} />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
    expect(screen.getByText('Test Story')).toBeInTheDocument()
  })
})
