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
        // Wrapping row: the word column grows to fill, the kanji breakdown holds its
        // size beside it. Because the column's min size is the reading width, the kana
        // reading wraps below the word *before* the breakdown is pushed to its own line.
        <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
          {/* Word + reading inline; reading wraps as a whole below the kanji when tight. Meaning beneath. */}
          <div className="flex-1">
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
          {/* Kanji breakdown — holds its width beside the word column; only a wide,
              multi-kanji word pushes it onto its own line below the English meaning. */}
          <div className="shrink-0">
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
