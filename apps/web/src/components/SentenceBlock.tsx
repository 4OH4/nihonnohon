// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useLongPress } from '@/lib/useLongPress'
import { clusterTokens } from '@/lib/tokenClusters'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { WordToken } from '@/components/WordToken'
import type { SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
  /** Per-story supplement entries keyed by vocab key — supplement takes precedence over main vocab. */
  supplementMap?: Map<number, VocabSupplementEntry>
  /** Scroll container used to keep this sentence visually fixed when an earlier translation collapses. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

/** Renders a sentence as a row of WordTokens with optional spacing, highlight, and translation. */
export function SentenceBlock({ sentence, sentenceIndex, supplementMap, scrollContainerRef }: SentenceBlockProps) {
  const { selectSentence, showSentenceTranslation, selectedSentenceId, translatedSentenceId } = useLookupStore(
    useShallow((s) => ({
      selectSentence: s.selectSentence,
      showSentenceTranslation: s.showSentenceTranslation,
      selectedSentenceId: s.selectedSentenceId,
      translatedSentenceId: s.translatedSentenceId,
    }))
  )
  const { spacingVisible, transVisible } = usePreferenceStore(
    useShallow((s) => ({ spacingVisible: s.spacingVisible, transVisible: s.transVisible }))
  )

  const isSelected = selectedSentenceId === sentence.id
  // Show the translation when globally enabled, or when this sentence's quick
  // translation has been revealed via long-press / keyboard fallback.
  const showTranslation =
    (transVisible || translatedSentenceId === sentence.id) && sentence.translation !== null

  // Scroll anchoring: when interacting with this sentence collapses *another*
  // sentence's open translation above it, the page would otherwise jump. We
  // record this sentence's viewport position just before the state change, then
  // restore it after the DOM updates so the sentence stays under the pointer.
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorTopRef = useRef<number | null>(null)

  const captureAnchor = useCallback(() => {
    // Only an open translation belonging to a *different* sentence can shift us.
    if (translatedSentenceId === null || translatedSentenceId === sentence.id) return
    if (rootRef.current) anchorTopRef.current = rootRef.current.getBoundingClientRect().top
  }, [translatedSentenceId, sentence.id])

  useLayoutEffect(() => {
    const anchorTop = anchorTopRef.current
    anchorTopRef.current = null
    if (anchorTop === null || selectedSentenceId !== sentence.id) return
    const el = rootRef.current
    const container = scrollContainerRef?.current
    if (!el || !container) return
    const delta = el.getBoundingClientRect().top - anchorTop
    if (delta !== 0) container.scrollTop += delta
  }, [selectedSentenceId, translatedSentenceId, sentence.id, scrollContainerRef])

  // Select this sentence, anchoring first — a plain tap also collapses any open
  // translation (the first click of a double-tap included), so it must anchor too.
  const selectThisSentence = useCallback(() => {
    captureAnchor()
    selectSentence(sentence.id)
  }, [captureAnchor, selectSentence, sentence.id])

  // Reveal this sentence's translation, anchoring our scroll position first.
  const reveal = useCallback(() => {
    captureAnchor()
    showSentenceTranslation(sentence.id)
  }, [captureAnchor, showSentenceTranslation, sentence.id])

  // Long-press reveals this sentence's translation inline. Long-pressing a word
  // is excluded — WordToken stops pointer propagation so word lookup wins there.
  const longPress = useLongPress(reveal)

  // Tokens are individual flex items, so the browser's Japanese line-breaking rules
  // never get to run and a trailing 。 can wrap onto a line by itself. Grouping the
  // tokens that must not be split into a single flex item restores those rules.
  const clusters = useMemo(() => clusterTokens(sentence.tokens), [sentence.tokens])

  // One gap value for both the sentence row and the nested clusters, so grouping
  // never changes the spacing between two adjacent tokens.
  const gapClass = spacingVisible ? 'gap-x-2' : 'gap-x-0'

  const renderToken = (i: number) => {
    // Resolve the supplement by vocab key, not by surface: the token carries its
    // inflected form (考えました) while the supplement is keyed on the headword (考える).
    const vocabKey = sentence.vocabKeys[i] ?? null
    return (
      <WordToken
        key={i}
        token={sentence.tokens[i]}
        vocabKey={vocabKey}
        sentenceId={sentence.id}
        supplementEntry={vocabKey === null ? null : supplementMap?.get(vocabKey) ?? null}
        onBeforeActivate={captureAnchor}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Sentence ${sentenceIndex + 1}`}
      onClick={selectThisSentence}
      // Double-tap / double-click the whitespace is an alternative to the
      // long-press for revealing this sentence's translation.
      onDoubleClick={reveal}
      // Keyboard fallback for long-press: 't' translates the focused sentence.
      onKeyDown={(e) => {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault()
          reveal()
        }
      }}
      {...longPress}
      className={cn(
        // Full-width highlight; px-5 keeps the text inset (matching the padding
        // that previously lived on the scroll container) away from the edges.
        'flex flex-wrap items-baseline py-2 px-5',
        'transition-[gap,background-color] duration-150',
        gapClass,
        isSelected && 'bg-accent-subtle',
      )}
    >
      {clusters.map((cluster) =>
        // A lone token stays a direct flex item — only a group that must hold
        // together needs the extra wrapper.
        cluster.length === 1 ? (
          renderToken(cluster[0])
        ) : (
          <span
            key={cluster[0]}
            className={cn('flex items-baseline transition-[gap] duration-150', gapClass)}
          >
            {cluster.map(renderToken)}
          </span>
        )
      )}
      {showTranslation && (
        <p className="w-full mt-1 italic text-translation text-[0.8em] select-none [-webkit-touch-callout:none]">
          {sentence.translation}
        </p>
      )}
    </div>
  )
}
