// Mock DOM-touching lib functions so store tests don't require a real DOM
vi.mock('@/lib/validateStoryJson', () => ({
  validateStoryJson: vi.fn(() => []),
}))
vi.mock('@/lib/downloadStoryFile', () => ({
  downloadStoryFile: vi.fn(),
}))

import { useAuthoringStore } from '../stores/authoringStore'
import { validateStoryJson } from '@/lib/validateStoryJson'
import { downloadStoryFile } from '@/lib/downloadStoryFile'

describe('authoringStore — generate() from idle', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('transitions phase to generating', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('assigns a non-null runId', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().runId).toBeTruthy()
  })

  it('does not set outputIsDirty', () => {
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })
})

describe('authoringStore — setPathMode mode-change', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('clears outputJson and resets to idle when mode actually changes', () => {
    useAuthoringStore.getState()._setOutputJson('{"test":true}')
    expect(useAuthoringStore.getState().outputJson).toBeTruthy()
    useAuthoringStore.getState().setPathMode('B')  // A → B
    expect(useAuthoringStore.getState().outputJson).toBeNull()
    expect(useAuthoringStore.getState().phase).toBe('idle')
    expect(useAuthoringStore.getState().pathMode).toBe('B')
  })

  it('is a no-op when same mode is selected', () => {
    useAuthoringStore.getState()._setOutputJson('{"test":true}')
    useAuthoringStore.getState().setPathMode('A')  // already A
    expect(useAuthoringStore.getState().outputJson).toBeTruthy()
  })
})

describe('authoringStore — generate() from error (implicit retry)', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('clears errorCode and errorMessage', () => {
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().errorCode).toBeNull()
    expect(useAuthoringStore.getState().errorMessage).toBeNull()
  })

  it('assigns a new runId', () => {
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().runId).toBeTruthy()
  })

  it('transitions phase to generating without requiring clear()', () => {
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    expect(useAuthoringStore.getState().phase).toBe('error')
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })
})

describe('authoringStore — extended storedInputs', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('generate() captures pathMode, temperature, grammarDist in storedInputs', () => {
    const store = useAuthoringStore.getState()
    store.setTemperature(1.5)
    store.setGrammarDist(2)
    store.generate()
    const { storedInputs } = useAuthoringStore.getState()
    expect(storedInputs?.pathMode).toBe('A')
    expect(storedInputs?.temperature).toBe(1.5)
    expect(storedInputs?.grammarDist).toBe(2)
  })

  it('generate() resets agentRunStarted to false', () => {
    useAuthoringStore.getState()._markRunStarted()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(true)
    // _reset then generate should reset it
    useAuthoringStore.getState()._reset()
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
  })
})

describe('authoringStore — _markRunStarted', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('sets agentRunStarted to true', () => {
    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
    useAuthoringStore.getState()._markRunStarted()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(true)
  })

  it('agentRunStarted is false after _reset()', () => {
    useAuthoringStore.getState()._markRunStarted()
    useAuthoringStore.getState()._reset()
    expect(useAuthoringStore.getState().agentRunStarted).toBe(false)
  })
})

describe('authoringStore — rerun()', () => {
  // Helper: reach output-clean with storedInputs set (mirrors production flow)
  const reachOutputClean = () => {
    useAuthoringStore.getState().generate()   // sets storedInputs, enters generating
    useAuthoringStore.getState()._setOutputJson('{}')  // enters output-clean
  }

  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('transitions from output-clean to generating', () => {
    reachOutputClean()
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('transitions from output-dirty to generating', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('generating')
  })

  it('preserves storedInputs snapshot unchanged', () => {
    useAuthoringStore.getState().setInputText('Original story')
    reachOutputClean()
    const before = useAuthoringStore.getState().storedInputs
    useAuthoringStore.getState().setInputText('Changed story')
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().storedInputs).toEqual(before)
  })

  it('clears outputJson', () => {
    reachOutputClean()
    expect(useAuthoringStore.getState().outputJson).toBe('{}')
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().outputJson).toBeNull()
  })

  it('resets outputIsDirty', () => {
    reachOutputClean()
    useAuthoringStore.getState()._markDirty()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })

  it('is a no-op from idle', () => {
    useAuthoringStore.getState().rerun()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('assigns a new runId each call', () => {
    reachOutputClean()
    useAuthoringStore.getState().rerun()
    const id1 = useAuthoringStore.getState().runId
    reachOutputClean()
    useAuthoringStore.getState().rerun()
    const id2 = useAuthoringStore.getState().runId
    expect(id1).not.toBe(id2)
  })
})

describe('authoringStore — _editOutputJson()', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('transitions output-clean → output-dirty and updates outputJson', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._editOutputJson('{"edited":true}')
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    expect(useAuthoringStore.getState().outputJson).toBe('{"edited":true}')
  })

  it('updates outputJson without changing phase when already output-dirty', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    useAuthoringStore.getState()._editOutputJson('{"second":"edit"}')
    expect(useAuthoringStore.getState().phase).toBe('output-dirty')
    expect(useAuthoringStore.getState().outputJson).toBe('{"second":"edit"}')
  })

  it('is a no-op from idle', () => {
    useAuthoringStore.getState()._editOutputJson('{"ignored":true}')
    expect(useAuthoringStore.getState().outputJson).toBeNull()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })
})

describe('authoringStore — generate() from error clears outputJson', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('clears outputJson when retrying from error phase', () => {
    useAuthoringStore.getState()._setOutputJson('{"old":true}')
    useAuthoringStore.getState()._setError('TIMEOUT', 'timed out')
    useAuthoringStore.getState().generate()
    expect(useAuthoringStore.getState().outputJson).toBeNull()
  })
})

describe('authoringStore — save()', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
    vi.mocked(validateStoryJson).mockReturnValue([])
    vi.mocked(downloadStoryFile).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('is a no-op from idle phase', () => {
    useAuthoringStore.getState().save()
    expect(validateStoryJson).not.toHaveBeenCalled()
    expect(useAuthoringStore.getState().phase).toBe('idle')
  })

  it('sets validationErrors when validation fails and stays in current phase', () => {
    vi.mocked(validateStoryJson).mockReturnValue([
      { rule: 'JSON_PARSE', message: 'bad json' },
    ])
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().validationErrors).toHaveLength(1)
    expect(useAuthoringStore.getState().validationErrors[0].rule).toBe('JSON_PARSE')
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
  })

  it('calls downloadStoryFile with story id when validation passes', () => {
    const json = JSON.stringify({ id: 'test-story', schema_version: '1' })
    useAuthoringStore.getState()._setOutputJson(json)
    useAuthoringStore.getState().save()
    expect(downloadStoryFile).toHaveBeenCalledWith('test-story', json)
  })

  it('sets downloadToastId to the story id on success', () => {
    const json = JSON.stringify({ id: 'my-story' })
    useAuthoringStore.getState()._setOutputJson(json)
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().downloadToastId).toBe('my-story')
  })

  it('resets to output-clean phase and clears outputIsDirty on success', () => {
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState()._markDirty()
    expect(useAuthoringStore.getState().outputIsDirty).toBe(true)
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().phase).toBe('output-clean')
    expect(useAuthoringStore.getState().outputIsDirty).toBe(false)
  })

  it('clears validationErrors on success', () => {
    // First save fails, leaving errors
    vi.mocked(validateStoryJson).mockReturnValueOnce([{ rule: 'MISSING_FIELD', message: 'x' }])
    useAuthoringStore.getState()._setOutputJson('{}')
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().validationErrors).toHaveLength(1)

    // Second save passes, errors are cleared
    vi.mocked(validateStoryJson).mockReturnValue([])
    useAuthoringStore.getState().save()
    expect(useAuthoringStore.getState().validationErrors).toHaveLength(0)
  })

  it('falls back to "story" as id if outputJson has no id field', () => {
    useAuthoringStore.getState()._setOutputJson('{"schema_version":"1"}')
    useAuthoringStore.getState().save()
    expect(downloadStoryFile).toHaveBeenCalledWith('story', expect.any(String))
  })
})

describe('authoringStore — _clearDownloadToast()', () => {
  beforeEach(() => {
    useAuthoringStore.getState()._reset()
  })

  it('sets downloadToastId to null', () => {
    useAuthoringStore.setState({ downloadToastId: 'some-id' })
    useAuthoringStore.getState()._clearDownloadToast()
    expect(useAuthoringStore.getState().downloadToastId).toBeNull()
  })
})
