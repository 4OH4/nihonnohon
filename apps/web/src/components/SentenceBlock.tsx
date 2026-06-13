// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useLongPress } from '@/lib/useLongPress'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { WordToken } from '@/components/WordToken'
import type { SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

interface SentenceBlockProps {
  sentence: SentenceModel
  sentenceIndex: number
  /** Per-story supplement entries keyed by word string — supplement takes precedence over main vocab. */
  supplementMap?: Map<string, VocabSupplementEntry>
}

/** Renders a sentence as a row of WordTokens with optional spacing, highlight, and translation. */
export function SentenceBlock({ sentence, sentenceIndex, supplementMap }: SentenceBlockProps) {
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

  // Long-press reveals this sentence's translation inline. Long-pressing a word
  // is excluded — WordToken stops pointer propagation so word lookup wins there.
  const longPress = useLongPress(() => showSentenceTranslation(sentence.id))

  return (
    <div
      role="group"
      aria-label={`Sentence ${sentenceIndex + 1}`}
      onClick={() => selectSentence(sentence.id)}
      // Keyboard fallback for long-press: 't' translates the focused sentence.
      onKeyDown={(e) => {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault()
          showSentenceTranslation(sentence.id)
        }
      }}
      {...longPress}
      className={cn(
        'flex flex-wrap items-baseline py-2 px-1 rounded',
        'transition-[gap,background-color] duration-150',
        spacingVisible ? 'gap-x-2' : 'gap-x-0',
        isSelected && 'bg-accent-subtle',
      )}
    >
      {sentence.tokens.map((token, i) => (
        <WordToken
          key={i}
          token={token}
          vocabKey={sentence.vocabKeys[i] ?? null}
          sentenceId={sentence.id}
          supplementEntry={supplementMap?.get(token.surface) ?? null}
        />
      ))}
      {showTranslation && (
        <p className="w-full mt-1 italic text-translation text-[0.8em]">
          {sentence.translation}
        </p>
      )}
    </div>
  )
}
