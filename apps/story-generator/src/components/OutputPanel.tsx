import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'
import { JsonOutput } from './JsonOutput'

const OUTPUT_PHASES = new Set(['output-clean', 'output-dirty'])

/**
 * Output section for the generated story JSON.
 *
 * Always mounted in the DOM; visibility controlled by height (no layout shift).
 * Contains the editable JsonOutput, dirty-state indicator, Re-run button, and
 * the inline RerunWarning confirmation strip.
 */
export function OutputPanel() {
  const phase         = useAuthoringStore(s => s.phase)
  const outputJson    = useAuthoringStore(s => s.outputJson)
  const outputIsDirty = useAuthoringStore(s => s.outputIsDirty)
  const rerun            = useAuthoringStore(s => s.rerun)
  const _editOutputJson  = useAuthoringStore(s => s._editOutputJson)

  const [editedValue, setEditedValue] = useState<string | null>(null)
  const [showRerunWarning, setShowRerunWarning] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const isVisible = OUTPUT_PHASES.has(phase)

  // Sync local value when a new generation completes (phase enters output-clean)
  useEffect(() => {
    if (phase === 'output-clean') {
      setEditedValue(outputJson)
      setShowRerunWarning(false)
    }
  }, [phase, outputJson])

  // Dismiss warning when leaving output phases
  useEffect(() => {
    if (!OUTPUT_PHASES.has(phase)) {
      setShowRerunWarning(false)
    }
  }, [phase])

  // Focus confirm button when warning appears
  useEffect(() => {
    if (showRerunWarning) {
      confirmRef.current?.focus()
    }
  }, [showRerunWarning])

  // Escape key dismisses the warning
  useEffect(() => {
    if (!showRerunWarning) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowRerunWarning(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showRerunWarning])

  const handleChange = (v: string) => {
    setEditedValue(v)
    _editOutputJson(v)
  }

  const handleRerun = () => {
    if (phase === 'output-dirty') {
      setShowRerunWarning(true)
    } else {
      rerun()
    }
  }

  const handleConfirmRerun = () => {
    setShowRerunWarning(false)
    rerun()
  }

  return (
    <section
      aria-label="Generated story output"
      className={cn('mt-4', !isVisible && 'h-0 overflow-hidden')}
    >
      {isVisible && (
        <>
          <JsonOutput value={editedValue ?? ''} onChange={handleChange} />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRerun}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                'bg-surface border border-border text-muted hover:text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none',
              )}
            >
              Re-run
            </button>
            {outputIsDirty && (
              <span className="text-xs text-muted">Unsaved edits</span>
            )}
          </div>

          {showRerunWarning && (
            <div
              role="alert"
              className="mt-2 flex flex-col gap-2 rounded-md border border-accent bg-accent-subtle p-3"
            >
              <p className="text-sm text-paper-text">Re-running will replace your edits.</p>
              <div className="flex gap-2">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={handleConfirmRerun}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                    'bg-surface border border-error text-error hover:bg-error/10',
                    'focus-visible:ring-2 ring-accent outline-none',
                  )}
                >
                  Discard my edits and Re-run
                </button>
                <button
                  type="button"
                  onClick={() => setShowRerunWarning(false)}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                    'bg-surface border border-border text-muted hover:text-paper-text',
                    'focus-visible:ring-2 ring-accent outline-none',
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
