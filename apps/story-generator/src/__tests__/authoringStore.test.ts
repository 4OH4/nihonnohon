import { useAuthoringStore } from '../stores/authoringStore'

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
