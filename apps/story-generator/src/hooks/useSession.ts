// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useEffect, useRef } from 'react'
import { useAuthoringStore, STORY_LENGTH_WORD_COUNTS } from '@/stores/authoringStore'
import type { Phase, StoryLengthPreset } from '@/stores/authoringStore'

/** localStorage key for the authoring session. */
export const SESSION_KEY = 'nihonnohon-sg-session'

/** Phases treated as crashed when found in a restored session — remapped on restore. */
const STALE_PHASES = new Set<Phase>(['generating', 'cancelling', 'downloading'])

/** Shape of the persisted session object. */
interface SessionState {
  version: 1
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
  outputIsDirty: boolean
  /** Path B English draft; present when phase was 'proposal'. */
  proposalText: string | null
}

/** Map a restored phase: stale generation/cancel phases are treated as crashed. */
function mapRestoredPhase(session: SessionState): Phase {
  if (STALE_PHASES.has(session.phase)) {
    return session.outputJson !== null ? 'output-clean' : 'idle'
  }
  return session.phase
}

/**
 * Manages localStorage session persistence for the authoring tool.
 *
 * On mount: reads and hydrates the store from the last saved session.
 * On store changes: writes the session to localStorage (debounced 300ms for
 * input-only changes; immediate on phase transitions).
 * On clear: removes the session when the store returns to its default state.
 */
export function useSession(): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // — Mount: hydrate from localStorage (runs once) —
  useEffect(() => {
    let session: SessionState | null = null
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as Record<string, unknown>).version !== 1
      ) return
      session = parsed as SessionState
    } catch {
      return
    }

    const restoredPhase = mapRestoredPhase(session)

    // Guard: proposal phase requires proposalText — without it, degrade gracefully
    const proposalText: string | null = session.proposalText ?? null
    const safePhase: Phase =
      restoredPhase === 'proposal' && !proposalText
        ? session.outputJson !== null ? 'output-clean' : 'idle'
        : restoredPhase

    // Sanitize: outputIsDirty is meaningless without outputJson (one-way latch requires content)
    const restoredOutputIsDirty = session.outputJson !== null ? session.outputIsDirty : false

    // Guard against stale sessions missing the length fields (added after v1 was deployed)
    const storyLengthPreset: StoryLengthPreset =
      session.storyLengthPreset ?? 'medium'
    const targetWordCount: number =
      session.targetWordCount ??
      (storyLengthPreset !== 'custom' ? STORY_LENGTH_WORD_COUNTS[storyLengthPreset] : STORY_LENGTH_WORD_COUNTS.medium)

    // Guard against stale sessions missing topicText (added in Story 3.2)
    const topicText: string = session.topicText ?? ''

    // Batch-set the store in one atomic write
    useAuthoringStore.setState({
      phase: safePhase,
      inputText: session.inputText,
      topicText,
      chapterTarget: session.chapterTarget,
      steeringInstructions: session.steeringInstructions,
      pathMode: session.pathMode,
      temperature: session.temperature,
      grammarDist: session.grammarDist,
      storyLengthPreset,
      targetWordCount,
      outputJson: session.outputJson,
      outputIsDirty: restoredOutputIsDirty,
      proposalText,
    })

    // Show the restore banner when meaningful content was recovered
    const hasContent =
      session.outputJson !== null ||
      session.inputText !== '' ||
      topicText !== '' ||
      session.chapterTarget !== '' ||
      session.steeringInstructions !== '' ||
      proposalText !== null
    if (hasContent) {
      useAuthoringStore.getState()._setSessionRestored(true)
    }
  }, [])

  // — Subscription: persist store changes to localStorage —
  useEffect(() => {
    /** Write or remove the session based on current store state. */
    const write = (state: ReturnType<typeof useAuthoringStore.getState>) => {
      // When fully cleared, remove the session rather than writing an empty one
      const isClearedState =
        state.phase === 'idle' &&
        state.outputJson === null &&
        state.inputText === '' &&
        state.chapterTarget === '' &&
        state.steeringInstructions === '' &&
        !state.outputIsDirty
      if (isClearedState) {
        try { localStorage.removeItem(SESSION_KEY) } catch { /* storage unavailable */ }
        return
      }
      const sessionState: SessionState = {
        version: 1,
        phase: state.phase,
        inputText: state.inputText,
        topicText: state.topicText,
        chapterTarget: state.chapterTarget,
        steeringInstructions: state.steeringInstructions,
        pathMode: state.pathMode,
        temperature: state.temperature,
        grammarDist: state.grammarDist,
        storyLengthPreset: state.storyLengthPreset,
        targetWordCount: state.targetWordCount,
        outputJson: state.outputJson,
        outputIsDirty: state.outputIsDirty,
        proposalText: state.proposalText,
      }
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessionState)) } catch { /* quota or storage unavailable */ }
    }

    let prevPhase = useAuthoringStore.getState().phase

    const unsub = useAuthoringStore.subscribe((state) => {
      const phaseChanged = state.phase !== prevPhase
      prevPhase = state.phase

      if (phaseChanged) {
        // Phase transitions are written immediately
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        write(state)
      } else {
        // Input-only changes are debounced to avoid per-keystroke writes
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => write(state), 300)
      }
    })

    return () => {
      unsub()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
        // Flush the pending write synchronously so the last input change is not lost on unmount
        write(useAuthoringStore.getState())
      }
    }
  }, [])
}
