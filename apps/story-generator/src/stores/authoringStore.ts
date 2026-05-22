// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'
import { validateStoryJson, type ValidationError } from '@/lib/validateStoryJson'
import { downloadStoryFile } from '@/lib/downloadStoryFile'

export type LicensePreset = 'cc-by-4' | 'cc-by-nc-4' | 'other'

/** Name and URL for each built-in license preset. */
export const LICENSE_PRESETS: Record<Exclude<LicensePreset, 'other'>, { name: string; url: string }> = {
  'cc-by-4':    { name: 'CC BY 4.0',    url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-nc-4': { name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
}

interface AttribSettings {
  attribAuthor: string
  attribSource: string
  attribLicense: LicensePreset
  attribCustomLicenseName: string
  attribCustomLicenseUrl: string
}

function injectAttribution(json: string, s: AttribSettings): string {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    if (s.attribAuthor) parsed.author = s.attribAuthor
    if (s.attribSource) parsed.source = s.attribSource
    if (s.attribLicense !== 'other') {
      parsed.license     = LICENSE_PRESETS[s.attribLicense].name
      parsed.license_url = LICENSE_PRESETS[s.attribLicense].url
    } else {
      if (s.attribCustomLicenseName) parsed.license     = s.attribCustomLicenseName
      if (s.attribCustomLicenseUrl)  parsed.license_url = s.attribCustomLicenseUrl
    }
    return JSON.stringify(parsed, null, 2)
  } catch {
    return json
  }
}

export type { ValidationError }

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

/** Story length preset — active only in Path B (Generate from topic). */
export type StoryLengthPreset = 'short' | 'medium' | 'long' | 'custom'

/** Hard upper limit on target word count. */
export const MAX_TARGET_WORD_COUNT = 1000

/** Word-count targets for each built-in preset. */
export const STORY_LENGTH_WORD_COUNTS: Record<Exclude<StoryLengthPreset, 'custom'>, number> = {
  short: 300,
  medium: 600,
  long: MAX_TARGET_WORD_COUNT,
}

/** Snapshot of inputs taken when generation starts; used by SSE URL and Re-run. */
interface StoredInputs {
  inputText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
  /** Path B phase 1: topic text snapshotted at generate() time. */
  topicText?: string
  /** Path B phase 2: English draft snapshotted at approve() time. */
  englishDraft?: string
  /** Path B: word count target snapshotted at generate() time (wired to SSE URL in Story 3.4). */
  targetWordCount?: number
}

interface AuthoringStore {
  phase: Phase
  inputText: string
  topicText: string
  chapterTarget: string
  steeringInstructions: string
  pathMode: 'A' | 'B'
  temperature: number
  grammarDist: 0 | 1 | 2
  storyLengthPreset: StoryLengthPreset
  targetWordCount: number
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
  /** Latest AGENT_STATUS message from the backend; null when not generating or cleared. */
  agentStatus: string | null

  // Public actions
  generate: () => void
  cancel: () => void
  approve: () => void
  rerun: () => void
  save: () => void
  clear: () => void
  setInputText: (v: string) => void
  setTopicText: (v: string) => void
  setChapterTarget: (v: string) => void
  setSteeringInstructions: (v: string) => void
  setPathMode: (v: 'A' | 'B') => void
  setTemperature: (v: number) => void
  setGrammarDist: (v: 0 | 1 | 2) => void
  setStoryLengthPreset: (preset: StoryLengthPreset) => void
  setTargetWordCount: (v: number) => void
  /** Update the English proposal text while in proposal phase. */
  setProposalText: (v: string) => void

  // Attribution settings — persisted per session; injected into output JSON on generation complete
  attribAuthor: string
  attribSource: string
  attribLicense: LicensePreset
  attribCustomLicenseName: string
  attribCustomLicenseUrl: string
  setAttribAuthor: (v: string) => void
  setAttribSource: (v: string) => void
  setAttribLicense: (v: LicensePreset) => void
  setAttribCustomLicenseName: (v: string) => void
  setAttribCustomLicenseUrl: (v: string) => void

  // Internal actions — called by useAgUiRun or OutputPanel, not part of the public API
  _setOutputJson: (v: string) => void
  _setProposalText: (v: string) => void
  _markDirty: () => void
  /** Update outputJson with user edits; latches dirty state on first call from output-clean. */
  _editOutputJson: (v: string) => void
  _setError: (code: string, message: string) => void
  _resolveCancel: () => void
  _markRunStarted: () => void
  _setAgentStatus: (msg: string | null) => void

  /** Errors from the last save() validation run; empty when valid. */
  validationErrors: ValidationError[]
  /** Set to the story id on a successful download; triggers toast display. */
  downloadToastId: string | null
  /** Elapsed seconds for the most recently completed generation phase; null until first completion. */
  lastGenerationElapsedS: number | null
  /** True after useSession restores a non-empty session; cleared on first input edit or clear(). */
  sessionRestored: boolean

  // Internal actions — called by useAgUiRun or OutputPanel, not part of the public API
  _clearDownloadToast: () => void
  _setSessionRestored: (v: boolean) => void
  _setLastGenerationElapsed: (s: number) => void

  // Test teardown helper
  _reset: () => void
}

const defaultState = {
  phase: 'idle' as Phase,
  inputText: '',
  topicText: '',
  chapterTarget: '',
  steeringInstructions: '',
  pathMode: 'A' as const,
  temperature: 1.0,
  grammarDist: 1 as const,
  storyLengthPreset: 'medium' as StoryLengthPreset,
  targetWordCount: STORY_LENGTH_WORD_COUNTS.medium,
  outputJson: null,
  outputIsDirty: false,
  proposalText: null,
  proposalApproved: false,
  errorCode: null,
  errorMessage: null,
  runId: null,
  storedInputs: null,
  agentRunStarted: false,
  agentStatus: null,
  validationErrors: [],
  downloadToastId: null,
  sessionRestored: false,
  lastGenerationElapsedS: null,
  attribAuthor: '',
  attribSource: 'Generated using the 日本の本 AI Story Authoring Tool',
  attribLicense: 'cc-by-4' as LicensePreset,
  attribCustomLicenseName: '',
  attribCustomLicenseUrl: '',
}

export const useAuthoringStore = create<AuthoringStore>()((set, get) => ({
  ...defaultState,

  generate() {
    const { phase, inputText, topicText, chapterTarget, steeringInstructions, pathMode,
            temperature, grammarDist, targetWordCount } = get()
    // Valid from idle, error (implicit retry), and proposal (Regenerate — restarts phase 1)
    if (phase !== 'idle' && phase !== 'error' && phase !== 'proposal') return
    set({
      phase: 'generating',
      runId: crypto.randomUUID(),
      outputJson: null,          // clear stale output so OutputPanel collapses on retry
      outputIsDirty: false,
      errorCode: null,
      errorMessage: null,
      agentRunStarted: false,
      agentStatus: null,
      proposalApproved: false,    // reset so _setError won't restore to proposal on a new flow
      proposalText: null,         // clear stale draft; new proposal set by _setProposalText
      lastGenerationElapsedS: null, // clear stale elapsed; new time set on RUN_FINISHED
      storedInputs: {
        inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist,
        topicText,       // Path B phase 1 SSE param
        targetWordCount, // Path B word count (wired to SSE URL in Story 3.4)
      },
    })
  },

  cancel() {
    const { phase } = get()
    if (phase !== 'generating' && phase !== 'cancelling') return
    set({ phase: 'cancelling' })
  },

  approve() {
    // M3 Path B: approves the English proposal and triggers Japanese generation
    const { phase, inputText, topicText, chapterTarget, steeringInstructions, pathMode,
            temperature, grammarDist, targetWordCount, proposalText } = get()
    if (phase !== 'proposal') return
    set({
      proposalApproved: true,
      phase: 'generating',
      runId: crypto.randomUUID(),
      outputIsDirty: false,
      errorCode: null,
      errorMessage: null,
      agentRunStarted: false,
      agentStatus: null,
      storedInputs: {
        inputText, chapterTarget, steeringInstructions, pathMode, temperature, grammarDist,
        topicText,
        targetWordCount,
        englishDraft: proposalText ?? '', // Path B phase 2 SSE param
      },
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
      agentStatus: null,
      // storedInputs preserved — same snapshot reused for SSE URL params
    })
  },

  save() {
    const { phase, outputJson } = get()
    if (phase !== 'output-clean' && phase !== 'output-dirty') return
    if (!outputJson) return

    // Run client-side validation pipeline
    const errors = validateStoryJson(outputJson)
    if (errors.length > 0) {
      set({ validationErrors: errors })
      return
    }

    // Extract story id for the download filename
    let storyId = 'story'
    try {
      const parsed = JSON.parse(outputJson) as { id?: string }
      if (parsed.id) storyId = parsed.id
    } catch { /* outputJson already parsed successfully above */ }

    // Trigger download and update state; recover to error phase if Blob/URL API fails
    set({ validationErrors: [], phase: 'downloading' })
    try {
      downloadStoryFile(storyId, outputJson)
    } catch (e) {
      set({ phase: 'error', errorCode: 'DOWNLOAD_FAILED', errorMessage: 'Download failed — your output is preserved. Try again.' })
      return
    }
    set({ phase: 'output-clean', outputIsDirty: false, downloadToastId: storyId })
  },

  clear() {
    set({ ...defaultState })
  },

  setInputText: (v) => set({ inputText: v }),
  setTopicText: (v) => set({ topicText: v }),
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
  setAttribAuthor: (v) => set({ attribAuthor: v }),
  setAttribSource: (v) => set({ attribSource: v }),
  setAttribLicense: (v) => set({ attribLicense: v }),
  setAttribCustomLicenseName: (v) => set({ attribCustomLicenseName: v }),
  setAttribCustomLicenseUrl: (v) => set({ attribCustomLicenseUrl: v }),
  setProposalText: (v) => set({ proposalText: v }),
  setStoryLengthPreset(preset) {
    if (preset === 'custom') {
      set({ storyLengthPreset: 'custom' })
    } else {
      set({ storyLengthPreset: preset, targetWordCount: STORY_LENGTH_WORD_COUNTS[preset] })
    }
  },
  setTargetWordCount: (v) => set({ storyLengthPreset: 'custom', targetWordCount: Math.min(v, MAX_TARGET_WORD_COUNT) }),

  _setOutputJson(v) {
    const withAttrib = injectAttribution(v, get())
    // Reset proposalApproved so _setError on any subsequent generation goes to 'error', not 'proposal'
    set({ outputJson: withAttrib, phase: 'output-clean', runId: null, outputIsDirty: false, proposalApproved: false, agentStatus: null })
  },

  _setProposalText(v) {
    set({ proposalText: v, phase: 'proposal', runId: null, agentStatus: null })
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
    const { proposalApproved } = get()
    if (proposalApproved) {
      // Error during Japanese conversion — restore to proposal so the draft is preserved
      set({ phase: 'proposal', errorCode: code, errorMessage: message, runId: null, agentStatus: null })
    } else {
      set({ phase: 'error', errorCode: code, errorMessage: message, runId: null, agentStatus: null })
    }
  },

  _resolveCancel() {
    set({ phase: 'idle', runId: null, agentStatus: null })
  },

  _markRunStarted() {
    set({ agentRunStarted: true })
  },

  _setAgentStatus(msg) {
    set({ agentStatus: msg })
  },

  _clearDownloadToast() {
    set({ downloadToastId: null })
  },

  _setLastGenerationElapsed(s) {
    set({ lastGenerationElapsedS: s })
  },

  _setSessionRestored(v) {
    set({ sessionRestored: v })
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
