import { useEffect } from 'react'
import { useLookupStore } from '@/stores/lookupStore'
import { KanjiBreakdown } from '@/components/KanjiBreakdown'
import type { StoryModel } from '@nihonnohon/schema'

interface InfoPanelProps {
  story: StoryModel
}

/** Persistent lookup panel: shows story metadata at rest, word lookup results when a word is selected. */
export function InfoPanel({ story }: InfoPanelProps) {
  const lookupState = useLookupStore((s) => s.lookupState)
  const reset = useLookupStore((s) => s.reset)

  // Escape key dismisses the lookup and returns to idle state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [reset])

  return (
    <div
      className="min-h-[110px] max-h-[140px] overflow-y-auto bg-surface px-4 py-3"
      aria-live="polite"
      aria-label="Word lookup panel"
    >
      {lookupState.status === 'idle' && (
        <div>
          <p className="font-semibold text-paper-text">{story.title}</p>
          {story.difficulty !== null && (
            <p className="text-sm text-muted">{story.difficulty}</p>
          )}
          <p className="text-sm text-muted">{story.language}</p>
        </div>
      )}

      {lookupState.status === 'found' && (
        <div>
          <p className="font-ja font-semibold" lang="ja">{lookupState.word}</p>
          <p className="text-[1.125rem] text-paper-text">{lookupState.entry.meaning}</p>
          <p className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</p>
          <KanjiBreakdown word={lookupState.word} />
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <p className="text-muted">No entry for <span lang="ja">{lookupState.word}</span></p>
      )}
    </div>
  )
}
