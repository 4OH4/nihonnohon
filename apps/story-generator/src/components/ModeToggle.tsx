import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'

const MODES = [
  { value: 'A' as const, label: 'Convert a story' },
  { value: 'B' as const, label: 'Generate from topic' },
]

/** Segmented pill control for switching between Path A and Path B generation modes. */
export function ModeToggle() {
  const pathMode    = useAuthoringStore(s => s.pathMode)
  const setPathMode = useAuthoringStore(s => s.setPathMode)
  const buttonRefs  = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      const nextIdx = (idx + 1) % MODES.length
      setPathMode(MODES[nextIdx].value)
      buttonRefs.current[nextIdx]?.focus()
    } else if (e.key === 'ArrowLeft') {
      const prevIdx = (idx - 1 + MODES.length) % MODES.length
      setPathMode(MODES[prevIdx].value)
      buttonRefs.current[prevIdx]?.focus()
    }
  }

  return (
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
          onClick={() => setPathMode(mode.value)}
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
  )
}
