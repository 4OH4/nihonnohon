import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReaderRoute } from '@/routes/ReaderRoute'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initVocabFromData, _resetVocab } from '@/services/vocabService'
import { _initKanjiFromData, _resetKanji } from '@/services/kanjiService'
import type { StoryModel, VocabEntry, KanjiEntry } from '@nihonnohon/schema'

// ─── Mock useLoaderData ───────────────────────────────────────────────────────
// ReaderRoute relies on useLoaderData() from React Router. In tests we bypass
// the router machinery and inject story data directly via this mock.

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return { ...mod, useLoaderData: vi.fn() }
})

// Import after the mock is set up
import { useLoaderData } from 'react-router-dom'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseStory: StoryModel = {
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
  metadata: {},
  sentences: [
    {
      id: 's1',
      words: ['食べる', 'は', '楽しい'],
      ruby: ['たべる', null, 'たのしい'],
      vocabKeys: [1, null, null],
      translation: 'Eating is fun.',
      grammar: [],
    },
    {
      id: 's2',
      words: ['日本語', 'を', '勉強します'],
      ruby: ['にほんご', null, 'べんきょうします'],
      vocabKeys: [null, null, 2],
      translation: 'I study Japanese.',
      grammar: [],
    },
  ],
}

const vocabData: VocabEntry[] = [
  { id: 1, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
  { id: 2, word: '勉強する', reading: 'べんきょうする', meaning: 'to study', lesson: 'Genki I Ch.3' },
]

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderRoute(story: StoryModel = baseStory) {
  vi.mocked(useLoaderData).mockReturnValue(story)
  return render(
    // MemoryRouter provides Link context for AppBar's back link
    <MemoryRouter>
      <ReaderRoute />
    </MemoryRouter>,
  )
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  _initVocabFromData(vocabData)
  _initKanjiFromData(kanjiData)
})

afterEach(() => {
  act(() => {
    useLookupStore.getState()._reset()
    usePreferenceStore.setState(DEFAULT_PREFS)
  })
  localStorage.clear()
  _resetVocab()
  _resetKanji()
  vi.clearAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReaderRoute', () => {
  it('renders all sentences from the story in document order', () => {
    renderRoute()
    expect(screen.getByText('食べる')).toBeInTheDocument()
    expect(screen.getByText('楽しい')).toBeInTheDocument()
    expect(screen.getByText('日本語')).toBeInTheDocument()
    expect(screen.getByText('勉強します')).toBeInTheDocument()
  })

  it('renders InfoPanel in idle state showing story title', () => {
    renderRoute()
    expect(screen.getByText('Test Story')).toBeInTheDocument()
  })

  it('word tap updates InfoPanel to found state', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    expect(screen.getByText('to eat')).toBeInTheDocument()
  })

  it('Escape key resets InfoPanel to idle', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    expect(useLookupStore.getState().lookupState.status).toBe('found')

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useLookupStore.getState().lookupState.status).toBe('idle')
  })

  it('ToolBar has exactly 2 interactive controls', () => {
    renderRoute()
    const toolbar = screen.getByRole('toolbar')
    const buttons = within(toolbar).getAllByRole('button')
    expect(buttons).toHaveLength(2)
  })

  it('ルビ label is "ルビ" when story language is Japanese', () => {
    renderRoute()
    expect(screen.getByRole('button', { name: 'ルビ' })).toBeInTheDocument()
  })

  it('ルビ label is "Ruby" when story language is not Japanese', () => {
    renderRoute({ ...baseStory, language: 'Chinese' })
    expect(screen.getByRole('button', { name: 'Ruby' })).toBeInTheDocument()
  })

  it('ruby toggle: rt elements use invisible class when off, not display:none', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: 'ルビ' }))

    const rtElements = document.querySelectorAll('rt')
    expect(rtElements.length).toBeGreaterThan(0)
    rtElements.forEach((rt) => {
      expect(rt.classList.contains('invisible')).toBe(true)
      expect(rt.style.display).not.toBe('none')
    })
  })

  it('Trans toggle shows translations when on', () => {
    renderRoute()
    expect(screen.queryByText('Eating is fun.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Trans' }))
    expect(screen.getByText('Eating is fun.')).toBeInTheDocument()
    expect(screen.getByText('I study Japanese.')).toBeInTheDocument()
  })

  it('vocab supplement takes precedence over main dict for same word', () => {
    const storyWithSupplement: StoryModel = {
      ...baseStory,
      vocabSupplement: [
        { word: '食べる', hiragana: 'たべる', translation: 'to eat (supplement)' },
      ],
      sentences: [{
        id: 's1',
        words: ['食べる'],
        ruby: ['たべる'],
        vocabKeys: [1],  // id 1 = '食べる' in main vocab with meaning 'to eat'
        translation: null,
        grammar: [],
      }],
    }

    renderRoute(storyWithSupplement)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    expect(screen.getByText('to eat (supplement)')).toBeInTheDocument()
    expect(screen.queryByText('to eat')).not.toBeInTheDocument()
  })

  it('supplement word with null vocabKey is tappable via supplement', () => {
    const storyWithSupplement: StoryModel = {
      ...baseStory,
      vocabSupplement: [
        { word: 'まいあさ', hiragana: 'まいあさ', translation: 'every morning' },
      ],
      sentences: [{
        id: 's1',
        words: ['まいあさ'],
        ruby: [null],
        vocabKeys: [null],  // not in main dict — supplement is the only lookup path
        translation: null,
        grammar: [],
      }],
    }

    renderRoute(storyWithSupplement)
    fireEvent.click(screen.getByRole('button', { name: 'まいあさ' }))
    expect(screen.getByText('every morning')).toBeInTheDocument()
  })
})
