// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  // Show a soft fade at the bottom edge while there's more content below the fold,
  // hinting that the panel scrolls.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  // Recompute when the looked-up content changes (its height changes).
  useLayoutEffect(() => { updateScroll() }, [lookupState, updateScroll])

  // Recompute when the panel resizes (e.g. a font-size change alters its em height).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateScroll)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateScroll])

  return (
    <div
      // Fixed height so the panel never resizes and pushes the story text;
      // expressed in em (relative to --story-font-size) so it scales with the
      // chosen font size. Deeper on mobile, where content wraps onto more lines.
      className="relative flex-1 min-w-0 h-[5.5em] lg:h-[4.5em] bg-surface"
      style={{ fontSize: 'var(--story-font-size)' } as React.CSSProperties}
      aria-live="polite"
      aria-label="Word lookup panel"
    >
    <div ref={scrollRef} onScroll={updateScroll} className="h-full overflow-y-auto overflow-x-hidden px-4 py-2">
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
        // The word column sizes to its content, keeping the kanji breakdown attached
        // beside it. On mobile the word and reading stack (narrow column → the
        // breakdown has room to stay horizontal); on desktop they sit inline.
        <div className="flex items-start gap-x-3">
          {/* min-w-0 lets this column shrink (and its reading/translation wrap)
              when the breakdown needs room, rather than growing to max-content
              and pushing the breakdown off the clipped right edge. */}
          <div className="flex-initial min-w-0">
            <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-2">
              <span className="font-ja font-semibold text-paper-text whitespace-nowrap" lang="ja">{lookupState.word}</span>
              {/* Skip the reading when it's identical to the surface (a kana-only word).
                  Allowed to wrap (between kana) so a long reading doesn't crowd out the breakdown. */}
              {lookupState.entry.reading !== lookupState.word && (
                <span className="text-[0.875em] font-ja text-muted break-words" lang="ja">{lookupState.entry.reading}</span>
              )}
            </div>
            {/* Meaning, with the part-of-speech tag as inline content trailing the
                text — so it flows right after the last word (and wraps onto a new
                line only when there's no room), rather than dropping below the
                whole paragraph. Hyphenates on wrap. */}
            <p lang="en" className="text-paper-text hyphens-auto break-words">
              {lookupState.entry.meaning}
              {lookupState.pos && (
                <span className={`${TAG_CLASS} ml-2 inline-block whitespace-nowrap align-baseline`}>{lookupState.pos}</span>
              )}
            </p>
          </div>
          {/* Kanji breakdown — beside the word column; wraps onto further rows for a
              wide multi-kanji word, after the reading has wrapped. */}
          <KanjiBreakdown word={lookupState.word} />
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <p className="text-muted">No entry for <span lang="ja">{lookupState.word}</span></p>
      )}
    </div>
      {canScrollDown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface to-transparent" />
      )}
    </div>
  )
}
