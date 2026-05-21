// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

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
      className="flex-1 min-h-[90px] max-h-[120px] overflow-y-auto bg-surface px-4 py-2"
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
        <div className="flex gap-8">
          {/* Left: word + reading inline, meaning beneath */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-ja font-semibold text-paper-text" lang="ja">{lookupState.word}</span>
              <span className="text-[0.875rem] font-ja text-muted" lang="ja">{lookupState.entry.reading}</span>
            </div>
            <p className="text-[1.125rem] text-paper-text">{lookupState.entry.meaning}</p>
          </div>
          {/* Dictionary detail column — vertical stack, ready for additional sections */}
          <div className="flex flex-col gap-3 shrink-0">
            <KanjiBreakdown word={lookupState.word} />
          </div>
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <p className="text-muted">No entry for <span lang="ja">{lookupState.word}</span></p>
      )}
    </div>
  )
}
