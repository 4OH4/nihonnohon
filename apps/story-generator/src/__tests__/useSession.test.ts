// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { act, renderHook } from '@testing-library/react'
import { useSession, SESSION_KEY } from '@/hooks/useSession'
import { useAuthoringStore } from '@/stores/authoringStore'

// Helpers
const writeSession = (overrides: Record<string, unknown> = {}) => {
  const base = {
    version: 1,
    phase: 'output-clean',
    inputText: 'A sample story',
    chapterTarget: 'Genki I Ch.3',
    steeringInstructions: '',
    pathMode: 'A',
    temperature: 1.0,
    grammarDist: 1,
    outputJson: '{"id":"test"}',
    outputIsDirty: false,
    proposalText: null,
    ...overrides,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(base))
}

describe('useSession — hydration on mount', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  it('is a no-op when no session is stored', () => {
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('ignores session with version mismatch', () => {
    writeSession({ version: 2 })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('ignores invalid JSON in localStorage', () => {
    localStorage.setItem(SESSION_KEY, 'not-valid-json{{{')
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('ignores non-object stored value', () => {
    localStorage.setItem(SESSION_KEY, '"just a string"')
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('restores output-clean session and sets sessionRestored', () => {
    writeSession({ phase: 'output-clean', outputJson: '{}', outputIsDirty: false })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputJson).toBe('{}')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('restores output-dirty session with outputIsDirty latch', () => {
    writeSession({ phase: 'output-dirty', outputJson: '{"edited":true}', outputIsDirty: true })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('maps stale generating phase + outputJson → output-clean', () => {
    writeSession({ phase: 'generating', outputJson: '{"stale":true}', outputIsDirty: false })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputJson).toBe('{"stale":true}')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('maps stale cancelling phase + outputJson → output-clean', () => {
    writeSession({ phase: 'cancelling', outputJson: '{"stale":true}' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })

  it('maps stale downloading phase + outputJson → output-clean', () => {
    writeSession({ phase: 'downloading', outputJson: '{"stale":true}' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })

  it('restores proposal phase when proposalText is present', () => {
    writeSession({ phase: 'proposal', proposalText: 'My English draft.', outputJson: null })
    renderHook(() => useSession())
    const st = useAuthoringStore.getState()
    expect(st.phase).toBe('proposal')
    expect(st.proposalText).toBe('My English draft.')
  })

  it('maps proposal phase to idle when proposalText is null and no outputJson', () => {
    writeSession({ phase: 'proposal', proposalText: null, outputJson: null, inputText: 'hi' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('maps proposal phase to output-clean when proposalText is null but outputJson present', () => {
    writeSession({ phase: 'proposal', proposalText: null, outputJson: '{"id":"x"}' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })

  it('proposalText triggers sessionRestored banner', () => {
    writeSession({ phase: 'proposal', proposalText: 'Draft here.', inputText: '', outputJson: null })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('restores topicText and chapter alongside proposalText', () => {
    writeSession({
      phase: 'proposal',
      proposalText: 'A story about Ken.',
      topicText: 'Ken at the park',
      chapterTarget: 'Genki I Ch.5',
      pathMode: 'B',
      outputJson: null,
    })
    renderHook(() => useSession())
    const st = useAuthoringStore.getState()
    expect(st.phase).toBe('proposal')
    expect(st.proposalText).toBe('A story about Ken.')
    expect(st.topicText).toBe('Ken at the park')
    expect(st.chapterTarget).toBe('Genki I Ch.5')
  })

  it('maps stale generating phase + no outputJson → idle with inputs', () => {
    writeSession({
      phase: 'generating',
      outputJson: null,
      inputText: 'My story',
      chapterTarget: 'Genki I Ch.5',
      outputIsDirty: false,
    })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().inputText).toBe('My story')
    expect(useAuthoringStore.getState().chapterTarget).toBe('Genki I Ch.5')
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('idle session with empty inputs → no banner', () => {
    writeSession({
      phase: 'idle',
      inputText: '',
      chapterTarget: '',
      outputJson: null,
      outputIsDirty: false,
    })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().sessionRestored).toBe(false)
  })

  it('idle session with only steeringInstructions → shows banner', () => {
    writeSession({
      phase: 'idle',
      inputText: '',
      chapterTarget: '',
      outputJson: null,
      outputIsDirty: false,
      steeringInstructions: 'Use simple vocabulary',
    })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
    expect(useAuthoringStore.getState().steeringInstructions).toBe('Use simple vocabulary')
  })

  it('sanitizes outputIsDirty=true when outputJson is null', () => {
    writeSession({ phase: 'idle', outputJson: null, outputIsDirty: true, inputText: 'My story' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })

  it('restores temperature and grammarDist', () => {
    writeSession({ temperature: 1.5, grammarDist: 2 })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().temperature).toBe(1.5)
    expect(useAuthoringStore.getState().grammarDist).toBe(2)
  })

  it('restores pathMode', () => {
    writeSession({ pathMode: 'B' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().pathMode).toBe('B')
  })
})

describe('useSession — topicText persistence', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  it('restores topicText from session', () => {
    writeSession({ topicText: 'library study', outputJson: null, inputText: '' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().topicText).toBe('library study')
  })

  it('topicText non-empty triggers sessionRestored banner', () => {
    writeSession({ topicText: 'coffee trip', outputJson: null, inputText: '', chapterTarget: '' })
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().sessionRestored).toBe(true)
  })

  it('falls back to empty string when session has no topicText (older session)', () => {
    writeSession({ outputJson: null, inputText: 'A story' })
    // writeSession does not include topicText — simulates older session format
    renderHook(() => useSession())
    expect(useAuthoringStore.getState().topicText).toBe('')
  })

  it('persists topicText to localStorage via a phase-change write', async () => {
    // topicText is written in the session state on any write (phase change triggers immediate write)
    renderHook(() => useSession())
    act(() => {
      useAuthoringStore.getState().setTopicText('market visit')
      // Phase change triggers immediate (non-debounced) write that includes current state
      useAuthoringStore.getState()._setOutputJson('{"id":"x"}')
    })
    await act(async () => {})

    const stored = localStorage.getItem(SESSION_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!) as Record<string, unknown>
    expect(parsed.topicText).toBe('market visit')
  })
})

describe('useSession — subscription / persistence', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  afterEach(() => {
    useAuthoringStore.getState()._reset()
    localStorage.clear()
  })

  it('writes session immediately on phase change', async () => {
    renderHook(() => useSession())

    // Trigger a phase change (generate() needs inputText and chapterTarget)
    act(() => {
      useAuthoringStore.getState()._setOutputJson('{"id":"x"}')  // → output-clean
    })
    // Phase change → immediate write; no need to wait for debounce
    await act(async () => {})

    const stored = localStorage.getItem(SESSION_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.phase).toBe('output-clean')
    expect(parsed.outputJson).toBe('{"id":"x"}')
  })

  it('removes localStorage when store is cleared to default', async () => {
    // Pre-populate so there's something to remove
    writeSession()
    renderHook(() => useSession())

    act(() => {
      useAuthoringStore.getState().clear()
    })
    // clear() triggers phase → idle (phase change = immediate write)
    await act(async () => {})

    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('persists proposalText to localStorage on phase change', async () => {
    renderHook(() => useSession())
    act(() => {
      useAuthoringStore.getState()._setProposalText('My proposal draft.')
    })
    await act(async () => {})
    const raw = localStorage.getItem(SESSION_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.phase).toBe('proposal')
    expect(parsed.proposalText).toBe('My proposal draft.')
  })

  it('write survives localStorage errors gracefully', async () => {
    // Make setItem throw to simulate quota exceeded
    const origSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    renderHook(() => useSession())
    // Should not throw
    act(() => {
      useAuthoringStore.getState()._setOutputJson('{}')
    })
    await act(async () => {})

    // Restore
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(origSetItem)
  })
})
