// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import React, { useEffect } from 'react'
import { useLookupStore } from '@/stores/lookupStore'
import { KanjiBreakdown } from '@/components/KanjiBreakdown'
import type { StoryModel } from '@nihonnohon/schema'

interface InfoPanelProps {
  story: StoryModel
}

/** Small pill styling shared by the difficulty and part-of-speech labels. */
const TAG_CLASS = 'text-xs text-muted rounded px-1 py-0.5 bg-surface-subtle border border-border'

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
      // Fixed height so the panel never resizes and pushes the story text;
      // expressed in em (relative to --story-font-size) so it scales with the
      // chosen font size. Deeper on mobile, where content wraps onto more lines.
      className="flex-1 min-w-0 h-[5.5em] lg:h-[4.5em] overflow-y-auto overflow-x-hidden bg-surface px-4 py-2"
      style={{ fontSize: 'var(--story-font-size)' } as React.CSSProperties}
      aria-live="polite"
      aria-label="Word lookup panel"
    >
      {lookupState.status === 'idle' && (
        <div>
          <p className="font-semibold text-paper-text">{story.title}</p>
          {/* Author and difficulty share a wrapping row: side by side when there's
              room, difficulty dropping to its own line when there isn't. */}
          {(story.author || story.difficulty !== null) && (
            <div className="flex flex-wrap items-baseline gap-x-2 text-[0.875em] text-muted">
              {story.author && <span>{story.author}</span>}
              {story.difficulty !== null && <span className={TAG_CLASS}>{story.difficulty}</span>}
            </div>
          )}
        </div>
      )}

      {lookupState.status === 'found' && (
        // Wrapping row: the word column grows to fill, the kanji breakdown holds its
        // size beside it. Because the column's min size is the reading width, the kana
        // reading wraps below the word *before* the breakdown is pushed to its own line.
        <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
          {/* On desktop the word column sizes to its content (lg:flex-initial) so the
              kanji breakdown stays attached beside it rather than being pushed to the
              far edge; on mobile it grows so the reading wraps before the breakdown does. */}
          <div className="flex-1 lg:flex-initial">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-ja font-semibold text-paper-text whitespace-nowrap" lang="ja">{lookupState.word}</span>
              {/* Skip the reading when it's identical to the surface (a kana-only word). */}
              {lookupState.entry.reading !== lookupState.word && (
                <span className="text-[0.875em] font-ja text-muted whitespace-nowrap" lang="ja">{lookupState.entry.reading}</span>
              )}
            </div>
            {/* Meaning, with the part-of-speech tag trailing it. */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-paper-text">{lookupState.entry.meaning}</p>
              {lookupState.pos && (
                <span className={TAG_CLASS}>{lookupState.pos}</span>
              )}
            </div>
          </div>
          {/* Kanji breakdown — sits beside the word column; a wide, multi-kanji word
              drops it onto its own line below the English meaning, where its own
              flex-wrap lets the kanji flow over rows rather than scroll horizontally. */}
          <KanjiBreakdown word={lookupState.word} />
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <p className="text-muted">No entry for <span lang="ja">{lookupState.word}</span></p>
      )}
    </div>
  )
}
