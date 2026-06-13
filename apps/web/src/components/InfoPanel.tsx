// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import React, { useEffect } from 'react'
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
      className="flex-1 min-h-[90px] max-h-[160px] overflow-y-auto bg-surface px-4 py-2"
      style={{ fontSize: 'var(--story-font-size)' } as React.CSSProperties}
      aria-live="polite"
      aria-label="Word lookup panel"
    >
      {lookupState.status === 'idle' && (
        <div>
          <p className="font-semibold text-paper-text">{story.title}</p>
          {story.author && (
            <p className="text-[0.875em] text-muted">{story.author}</p>
          )}
          {story.difficulty !== null && (
            <p className="text-[0.875em] text-muted">{story.difficulty}</p>
          )}
        </div>
      )}

      {lookupState.status === 'found' && (
        // Wrapping row: word block and kanji breakdown sit side by side when there's
        // room, and the breakdown flows below the word block for long words / tight widths.
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {/* Word + reading inline; reading wraps as a whole below the kanji when tight. Meaning beneath. */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-ja font-semibold text-paper-text whitespace-nowrap" lang="ja">{lookupState.word}</span>
              <span className="text-[0.875em] font-ja text-muted whitespace-nowrap" lang="ja">{lookupState.entry.reading}</span>
              {lookupState.pos && (
                <span className="text-xs text-muted rounded px-1 py-0.5 bg-surface-subtle border border-border">
                  {lookupState.pos}
                </span>
              )}
            </div>
            <p className="text-paper-text">{lookupState.entry.meaning}</p>
          </div>
          {/* Kanji breakdown — wrappable sibling, no shrink-0 so it never squeezes the word block. */}
          <KanjiBreakdown word={lookupState.word} />
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <p className="text-muted">No entry for <span lang="ja">{lookupState.word}</span></p>
      )}
    </div>
  )
}
