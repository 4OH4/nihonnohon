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
