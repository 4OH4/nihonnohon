import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { LoaderFunctionArgs } from 'react-router-dom'
import { ReaderRoute, ReaderError, loader } from '@/routes/ReaderRoute'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { _initVocabFromData, _resetVocab, initVocab } from '@/services/vocabService'
import { _initKanjiFromData, _resetKanji, initKanji } from '@/services/kanjiService'
import { fetchManifest } from '@/utils/storyManifest'
import { loadStory } from '@nihonnohon/story-loader'
import type { StoryModel, VocabEntry, KanjiEntry } from '@nihonnohon/schema'

// ─── Mock react-router-dom ────────────────────────────────────────────────────
// ReaderRoute relies on useLoaderData() from React Router. In component tests we
// bypass the router machinery and inject story data directly via this mock.
// ReaderError relies on useRouteError() and isRouteErrorResponse().

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLoaderData: vi.fn(),
    useRouteError: vi.fn(),
    isRouteErrorResponse: vi.fn(),
  }
})

// Globally mock loader dependencies so component tests are unaffected
// and loader unit tests can control their return values.
vi.mock('@/utils/storyManifest', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/storyManifest')>()
  return { ...mod, fetchManifest: vi.fn() }
})

vi.mock('@nihonnohon/story-loader', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@nihonnohon/story-loader')>()
  return { ...mod, loadStory: vi.fn() }
})

vi.mock('@/services/vocabService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/vocabService')>()
  return { ...mod, initVocab: vi.fn().mockResolvedValue(undefined) }
})

vi.mock('@/services/kanjiService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/kanjiService')>()
  return { ...mod, initKanji: vi.fn().mockResolvedValue(undefined) }
})

vi.mock('@/services/indexedDbService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/indexedDbService')>()
  return { ...mod, getStory: vi.fn().mockResolvedValue(null) }
})

// Import after mocks are set up
import { useLoaderData, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { getStory } from '@/services/indexedDbService'

// ─── AC Tracking ─────────────────────────────────────────────────────────────
// PRESERVED (Story 2.5 — component tests, updated counts):
//   - renders all sentences in document order
//   - InfoPanel idle state shows story title
//   - word tap updates InfoPanel to found state
//   - Escape key resets InfoPanel to idle
//   - ToolBar has exactly 3 interactive controls (UPDATED from 2 — Story 4.3)
//   - ルビ label is "ルビ" for Japanese, "Ruby" otherwise
//   - ruby toggle uses visibility:hidden not display:none
//   - Trans toggle shows translations
//   - vocab supplement takes precedence over main dict
//   - supplement word with null vocabKey is tappable via supplement
//
// PRESERVED (Story 3.3):
//   - ReaderError renders "Story not found." for 404
//   - ReaderError renders fallback for non-404
//   - ReaderError always shows Back to library link
//   - loader returns StoryModel when story ID found in manifest
//
// SUPERSEDED (Story 3.4):
//   - "loader throws 404 when not in manifest" → now throws 410 (tries IndexedDB first)
//
// SUPERSEDED (Story 2.5):
//   - loader hardcoded to fetch genki-i-ch6-tanaka-letter.json
//   (component tests mock useLoaderData directly — loader body was never called)
//
// PRESERVED (Story 3.4):
//   - loader calls getStory when manifest misses
//   - loader returns StoryModel from IndexedDB hit
//   - loader throws 410 Response when IndexedDB also misses
//   - ReaderError renders "not available on this device" for status 410
//
// NEW (Story 4.3):
//   - ToolBar has exactly 3 controls (updated from 2)
//   - SettingsMenu opens with spacing and text size controls
//   - A+ sets textSize to 'large' in preferenceStore
//   - Bottom tab bar renders Story/Vocabulary/Grammar tabs
//   - Vocabulary tab shows VocabPanel
//   - Grammar tab shows GrammarPanel

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
    // MemoryRouter provides Link context for AppBar's back link and ReaderError
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

// ─── Component Tests (PRESERVED from Story 2.5) ──────────────────────────────

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

  it('ToolBar has exactly 3 interactive controls', () => {
    renderRoute()
    const toolbar = screen.getByRole('toolbar')
    const buttons = within(toolbar).getAllByRole('button')
    expect(buttons).toHaveLength(3)
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
        { key: 1, word: '食べる', hiragana: 'たべる', translation: 'to eat (supplement)' },
      ],
      sentences: [{
        id: 's1',
        words: ['食べる'],
        ruby: ['たべる'],
        vocabKeys: [1],
        translation: null,
        grammar: [],
      }],
    }

    renderRoute(storyWithSupplement)
    fireEvent.click(screen.getByRole('button', { name: '食べる' }))
    // Supplement entry appears in InfoPanel and VocabPanel (CSS hides one in practice)
    expect(screen.getAllByText('to eat (supplement)').length).toBeGreaterThan(0)
    expect(screen.queryByText('to eat')).not.toBeInTheDocument()
  })

  it('SettingsMenu opens with spacing and text size controls', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('Spaces')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeInTheDocument()
  })

  it('A+ button updates textSize to large and sets --story-font-size CSS property', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(usePreferenceStore.getState().textSize).toBe('large')
    // Verify the CSS custom property is set on the story container
    const storyContainer = screen.getAllByRole('group')[0].parentElement as HTMLElement
    expect(storyContainer.style.getPropertyValue('--story-font-size')).toBe('1.5rem')
  })

  it('renders bottom tab bar with Story, Vocabulary, Grammar tabs', () => {
    renderRoute()
    expect(screen.getByRole('tab', { name: 'Story' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Vocabulary' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Grammar' })).toBeInTheDocument()
  })

  it('clicking Vocabulary tab shows vocab panel empty state', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('tab', { name: 'Vocabulary' }))
    // VocabPanel renders in both mobile and desktop slots (CSS hides one at runtime)
    expect(screen.getAllByText('No vocabulary defined for this story.').length).toBeGreaterThan(0)
  })

  it('clicking Grammar tab shows grammar panel empty state', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('tab', { name: 'Grammar' }))
    // GrammarPanel renders in both mobile and desktop slots (CSS hides one at runtime)
    expect(screen.getAllByText('No grammar notes for this story.').length).toBeGreaterThan(0)
  })

  it('supplement word with null vocabKey is tappable via supplement', () => {
    const storyWithSupplement: StoryModel = {
      ...baseStory,
      vocabSupplement: [
        { key: 2001, word: 'まいあさ', hiragana: 'まいあさ', translation: 'every morning' },
      ],
      sentences: [{
        id: 's1',
        words: ['まいあさ'],
        ruby: [null],
        vocabKeys: [null],
        translation: null,
        grammar: [],
      }],
    }

    renderRoute(storyWithSupplement)
    fireEvent.click(screen.getByRole('button', { name: 'まいあさ' }))
    // 'every morning' appears in InfoPanel and VocabPanel (CSS hides one in practice)
    expect(screen.getAllByText('every morning').length).toBeGreaterThan(0)
  })
})

// ─── ReaderError Tests (NEW — Story 3.3) ─────────────────────────────────────

describe('ReaderError', () => {
  it('renders "Story not found." for a 404 route error', () => {
    vi.mocked(useRouteError).mockReturnValue({
      status: 404, statusText: 'Not Found', internal: true, data: '',
    })
    vi.mocked(isRouteErrorResponse).mockReturnValue(true)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText('Story not found.')).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })

  it('renders fallback message for non-404 errors', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('Network error'))
    vi.mocked(isRouteErrorResponse).mockReturnValue(false)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText('Failed to load this story.')).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })
})

// ─── Loader Unit Tests (NEW — Story 3.3) ─────────────────────────────────────

describe('loader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns StoryModel when story ID is found in manifest', async () => {
    const entry = {
      id: 'test-story',
      filename: 'test-story.json',
      title: 'T',
      titleJa: 'T',
      language: 'ja',
      description: 'd',
    }
    vi.mocked(fetchManifest).mockResolvedValue([entry])
    vi.mocked(loadStory).mockReturnValue(baseStory)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

    const result = await loader({
      params: { storyId: 'test-story' },
      request: new Request('http://localhost/read/test-story'),
    } as LoaderFunctionArgs)

    expect(result).toEqual(baseStory)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/stories/test-story.json')
  })

  it('throws a 410 Response when story ID is not in manifest and not in IndexedDB', async () => {
    // Supersedes Story 3.3 "throws 404 when not in manifest" — loader now tries IndexedDB first
    vi.mocked(fetchManifest).mockResolvedValue([])
    vi.mocked(getStory).mockResolvedValue(null)

    const error = await loader({
      params: { storyId: 'nonexistent' },
      request: new Request('http://localhost/read/nonexistent'),
    } as LoaderFunctionArgs).catch(e => e)

    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(410)
  })
})

// ─── Loader Tests — IndexedDB Fallback (NEW — Story 3.4) ─────────────────────

describe('loader — IndexedDB fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns StoryModel from IndexedDB when ID not in manifest', async () => {
    vi.mocked(fetchManifest).mockResolvedValue([])
    vi.mocked(getStory).mockResolvedValue({ schema_version: '1' })
    vi.mocked(loadStory).mockReturnValue(baseStory)

    const result = await loader({
      params: { storyId: 'some-uuid' },
      request: new Request('http://localhost/read/some-uuid'),
    } as LoaderFunctionArgs)

    expect(result).toEqual(baseStory)
    expect(vi.mocked(getStory)).toHaveBeenCalledWith('some-uuid')
  })
})

// ─── ReaderError — Storage Not Found (NEW — Story 3.4) ───────────────────────

describe('ReaderError — storage not found', () => {
  it('renders "not available on this device" for status 410', () => {
    vi.mocked(useRouteError).mockReturnValue({
      status: 410, statusText: 'Gone', internal: true, data: '',
    })
    vi.mocked(isRouteErrorResponse).mockReturnValue(true)
    render(<MemoryRouter><ReaderError /></MemoryRouter>)
    expect(screen.getByText('This story is not available on this device.')).toBeInTheDocument()
    expect(screen.getByText('← Back to library')).toBeInTheDocument()
  })
})
