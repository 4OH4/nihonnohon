// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore, type PathMode } from '@/stores/authoringStore'

const MODES = [
  { value: 'A' as const, label: 'Convert a story' },
  { value: 'B' as const, label: 'Generate from topic' },
  { value: 'C' as const, label: 'Japanese story' },
]

/**
 * Segmented pill control for switching between Path A, B, and C generation modes.
 * Shows an inline confirmation strip when switching with unsaved edits (outputIsDirty).
 */
export function ModeToggle() {
  const pathMode      = useAuthoringStore(s => s.pathMode)
  const outputIsDirty = useAuthoringStore(s => s.outputIsDirty)
  const setPathMode   = useAuthoringStore(s => s.setPathMode)
  const buttonRefs    = useRef<(HTMLButtonElement | null)[]>([])

  // Pending target mode — set when dirty-warning confirmation is needed
  const [pendingMode, setPendingMode] = useState<PathMode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Focus [Switch anyway] when the warning strip appears
  useEffect(() => {
    if (pendingMode !== null) confirmRef.current?.focus()
  }, [pendingMode])

  const handleModeClick = (mode: PathMode) => {
    if (mode === pathMode) return
    if (outputIsDirty) {
      setPendingMode(mode)
    } else {
      setPathMode(mode)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      const nextIdx = (idx + 1) % MODES.length
      handleModeClick(MODES[nextIdx].value)
      buttonRefs.current[nextIdx]?.focus()
    } else if (e.key === 'ArrowLeft') {
      const prevIdx = (idx - 1 + MODES.length) % MODES.length
      handleModeClick(MODES[prevIdx].value)
      buttonRefs.current[prevIdx]?.focus()
    }
  }

  const handleConfirmSwitch = () => {
    if (pendingMode) setPathMode(pendingMode)
    setPendingMode(null)
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Generation mode"
        className="inline-flex rounded-full border border-border bg-surface-subtle p-1 gap-1"
      >
        {MODES.map((mode, idx) => (
          <button
            key={mode.value}
            ref={el => { buttonRefs.current[idx] = el }}
            role="tab"
            aria-selected={pathMode === mode.value}
            tabIndex={pathMode === mode.value ? 0 : -1}
            onClick={() => handleModeClick(mode.value)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              'focus-visible:ring-2 ring-accent outline-none',
              pathMode === mode.value
                ? 'bg-accent text-white'
                : 'text-muted hover:text-paper-text',
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Dirty-output warning strip — shown below tabs when switching with unsaved edits */}
      {pendingMode !== null && (
        <div
          role="alert"
          className={cn(
            'mt-2 flex items-center gap-2 flex-wrap',
            'rounded-md border border-accent bg-accent-subtle px-3 py-2 text-sm',
          )}
        >
          <span className="flex-1 text-paper-text">Switching mode will discard your edited output.</span>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirmSwitch}
            className={cn(
              'font-medium text-accent hover:text-accent/80',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Switch anyway
          </button>
          <button
            type="button"
            onClick={() => setPendingMode(null)}
            className={cn(
              'text-muted hover:text-paper-text',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
