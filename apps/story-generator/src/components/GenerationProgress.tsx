import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'

/** Phases where GenerationProgress is visible. */
const ACTIVE_PHASES = new Set(['generating', 'cancelling', 'error'])

/** Returns the human-readable error message for a given error code. */
function getErrorMessage(code: string | null): string {
  switch (code) {
    case 'TIMEOUT':
      return 'This took longer than expected — your inputs are preserved. Try again.'
    case 'BACKEND_UNAVAILABLE':
      return 'Connection lost — your inputs are preserved. Check the backend and retry.'
    default:
      return 'The AI service returned an error — your inputs are preserved. Try again.'
  }
}

/**
 * Generation progress surface — always mounted; height:0 when idle to prevent layout shift.
 *
 * States:
 *   generating (not started) → "Connecting…"
 *   generating (run started) → shimmer + elapsed timer + "Generating story…"
 *   cancelling               → shimmer + frozen elapsed + "Stopping…"
 *   error                    → error message + Retry button
 *   all other phases         → height:0 (hidden)
 */
export function GenerationProgress() {
  const phase           = useAuthoringStore(s => s.phase)
  const agentRunStarted = useAuthoringStore(s => s.agentRunStarted)
  const errorCode       = useAuthoringStore(s => s.errorCode)
  const runId           = useAuthoringStore(s => s.runId)
  const generate                   = useAuthoringStore(s => s.generate)
  const inputText                  = useAuthoringStore(s => s.inputText)
  const chapterTarget              = useAuthoringStore(s => s.chapterTarget)
  const _setLastGenerationElapsed  = useAuthoringStore(s => s._setLastGenerationElapsed)

  // Elapsed time counter — increments each second once RUN_STARTED is received; freezes on cancelling
  const [elapsed, setElapsed] = useState(0)
  // Ref keeps elapsed current for the phase-transition effect without making it a dependency
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed

  // Reset elapsed when a new run starts (new runId)
  useEffect(() => {
    setElapsed(0)
  }, [runId])

  // Count up only after RUN_STARTED is received (agentRunStarted = true) and while still generating
  useEffect(() => {
    if (phase !== 'generating' || !agentRunStarted) return
    const id = setInterval(() => setElapsed(e => e + 1), 1_000)
    return () => clearInterval(id)
  }, [phase, agentRunStarted])

  // Persist elapsed to store when a successful phase completes (not on cancel or error)
  useEffect(() => {
    if ((phase === 'output-clean' || phase === 'proposal') && elapsedRef.current > 0) {
      _setLastGenerationElapsed(elapsedRef.current)
    }
  }, [phase, _setLastGenerationElapsed])

  const isActive = ACTIVE_PHASES.has(phase)
  const showShimmer = (phase === 'generating' && agentRunStarted) || phase === 'cancelling'
  const canRetry = inputText.trim() !== '' && chapterTarget !== ''

  // Status label for non-error phases
  let statusLabel: string
  if (phase === 'generating') {
    statusLabel = agentRunStarted ? 'Generating story…' : 'Connecting…'
  } else if (phase === 'cancelling') {
    statusLabel = 'Stopping…'
  } else {
    statusLabel = ''
  }

  return (
    <section
      aria-label="Generation progress"
      className={cn('overflow-hidden transition-all', !isActive && 'h-0')}
    >
      {isActive && (
        <div className="py-3 space-y-2">
          {/* Shimmer bar — P3: backgroundImage + backgroundSize avoids background shorthand resetting backgroundPosition */}
          {showShimmer && (
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-accent-subtle">
              <div
                className="h-full w-full animate-shimmer"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #F5EDD6 0%, #C8A85A 40%, #F5EDD6 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          )}

          {/* P4: Single persistent aria-live region — avoids spurious blank announcement on phase transition */}
          <div className="flex items-center justify-between">
            <span
              aria-live="polite"
              className={cn('text-sm', phase === 'error' ? 'text-error' : 'text-muted')}
            >
              {phase === 'error' ? getErrorMessage(errorCode) : statusLabel}
            </span>
            {agentRunStarted && phase !== 'error' && (
              <span className="text-xs text-muted tabular-nums">{elapsed}s</span>
            )}
          </div>

          {/* Retry button — only in error phase */}
          {phase === 'error' && (
            <button
              type="button"
              onClick={generate}
              disabled={!canRetry}
              aria-disabled={!canRetry}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium',
                'bg-surface border border-border text-paper-text',
                'hover:bg-surface-subtle transition-colors',
                'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
                !canRetry && 'opacity-[0.45] cursor-not-allowed pointer-events-none',
              )}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </section>
  )
}
