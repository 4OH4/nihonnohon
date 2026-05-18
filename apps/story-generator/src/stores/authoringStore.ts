import { create } from 'zustand'

/** All phases of the authoring workflow. */
export type Phase =
  | 'idle'
  | 'generating'
  | 'cancelling'
  | 'output-clean'
  | 'output-dirty'
  | 'downloading'
  | 'error'
  | 'proposal'

/** Snapshot of inputs taken when generation starts; used by SSE URL and Re-run. */
interface StoredInputs {
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
}

interface AuthoringStore {
  phase: Phase
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
  outputJson: string | null
  /** One-way latch: true from first edit after output-clean; resets only via clear() or completed generate(). */
  outputIsDirty: boolean
  proposalText: string | null
  proposalApproved: boolean
  errorCode: string | null
  errorMessage: string | null
  runId: string | null
  /** Snapshot of all generation inputs taken at generate() time; used for SSE URL and Re-run. */
  storedInputs: StoredInputs | null
  /** True once the backend emits RUN_STARTED; reset on each new generate(). */
  agentRunStarted: boolean

  // Public actions
  generate: () => void
  cancel: () => void
  approve: () => void
  rerun: () => void
  save: () => void
  clear: () => void
  setInputText: (v: string) => void
  setChapterTarget: (v: string) => void
  setSteeringInstructions: (v: string) => void
  setPathMode: (v: 'A' | 'B') => void
  setTemperature: (v: number) => void
  setGrammarDist: (v: 0 | 1 | 2) => void

  // Internal actions — called by useAgUiRun or OutputPanel, not part of the public API
  _setOutputJson: (v: string) => void
  _setProposalText: (v: string) => void
  _markDirty: () => void
  /** Update outputJson with user edits; latches dirty state on first call from output-clean. */
  _editOutputJson: (v: string) => void
  _setError: (code: string, message: string) => void
  _resolveCancel: () => void
  _markRunStarted: () => void

  // Test teardown helper
  _reset: () => void
}

const defaultState = {
  phase: 'idle' as Phase,
  inputText: '',
  chapterTarget: '',
  steeringInstructions: '',
  pathMode: 'A' as const,
  temperature: 1.0,
  grammarDist: 1 as const,
  outputJson: null,
  outputIsDirty: false,
  proposalText: null,
  proposalApproved: false,
  errorCode: null,
  errorMessage: null,
  runId: null,
  storedInputs: null,
  agentRunStarted: false,
}

export const useAuthoringStore = create<AuthoringStore>()((set, get) => ({
  ...defaultState,

  generate() {
    const { phase, inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist } = get()
    // Valid from idle and error (implicit retry from error clears error state)
    if (phase !== 'idle' && phase !== 'error') return
    set({
      phase: 'generating',
      runId: crypto.randomUUID(),
      outputJson: null,          // clear stale output so OutputPanel collapses on retry
      outputIsDirty: false,
      errorCode: null,
      errorMessage: null,
      agentRunStarted: false,
      storedInputs: { inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist },
    })
  },

  cancel() {
    const { phase } = get()
    if (phase !== 'generating' && phase !== 'cancelling') return
    set({ phase: 'cancelling' })
  },

  approve() {
    // M3 Path B: approves the English proposal and triggers Japanese generation
    const { phase, inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist } = get()
    if (phase !== 'proposal') return
    set({
      proposalApproved: true,
      phase: 'generating',
      runId: crypto.randomUUID(),
      outputIsDirty: false,
      errorCode: null,
      errorMessage: null,
      agentRunStarted: false,
      storedInputs: { inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist },
    })
  },

  rerun() {
    const { phase, storedInputs } = get()
    if (phase !== 'output-clean' && phase !== 'output-dirty') return
    if (!storedInputs) return
    set({
      phase: 'generating',
      runId: crypto.randomUUID(),
      outputJson: null,
      outputIsDirty: false,
      errorCode: null,
      errorMessage: null,
      agentRunStarted: false,
      // storedInputs preserved — same snapshot reused for SSE URL params
    })
  },

  save() {
    // Validation and download logic implemented in Story 2.8
    const { phase } = get()
    if (phase !== 'output-clean' && phase !== 'output-dirty') return
    set({ phase: 'downloading' })
  },

  clear() {
    set({ ...defaultState })
  },

  setInputText: (v) => set({ inputText: v }),
  setChapterTarget: (v) => set({ chapterTarget: v }),
  setSteeringInstructions: (v) => set({ steeringInstructions: v }),

  setPathMode(v) {
    const { pathMode, phase } = get()
    if (pathMode === v) return
    if (phase === 'generating') get().cancel()
    const isActive = phase === 'generating' || phase === 'cancelling'
    set({
      pathMode: v,
      outputJson: null,
      outputIsDirty: false,
      ...(isActive ? {} : { phase: 'idle' }),
    })
  },
  setTemperature: (v) => set({ temperature: v }),
  setGrammarDist: (v) => set({ grammarDist: v }),

  _setOutputJson(v) {
    set({ outputJson: v, phase: 'output-clean', runId: null, outputIsDirty: false })
  },

  _setProposalText(v) {
    set({ proposalText: v, phase: 'proposal', runId: null })
  },

  _markDirty() {
    const { phase } = get()
    if (phase === 'output-clean') {
      set({ phase: 'output-dirty', outputIsDirty: true })
    }
  },

  _editOutputJson(v) {
    const { phase } = get()
    if (phase === 'output-clean') {
      set({ phase: 'output-dirty', outputIsDirty: true, outputJson: v })
    } else if (phase === 'output-dirty') {
      set({ outputJson: v })
    }
  },

  _setError(code, message) {
    set({ phase: 'error', errorCode: code, errorMessage: message, runId: null })
  },

  _resolveCancel() {
    set({ phase: 'idle', runId: null })
  },

  _markRunStarted() {
    set({ agentRunStarted: true })
  },

  _reset() {
    set({ ...defaultState })
  },
}))

// Exported selectors — use these in components instead of deriving inline
export const selectIsGenerating = (s: AuthoringStore) => s.phase === 'generating'
export const selectCanGenerate  = (s: AuthoringStore) => s.phase === 'idle' || s.phase === 'error'
export const selectCanSave      = (s: AuthoringStore) =>
  s.outputJson !== null && (s.phase === 'output-clean' || s.phase === 'output-dirty')
export const selectCanCancel    = (s: AuthoringStore) =>
  s.phase === 'generating' || s.phase === 'cancelling'
