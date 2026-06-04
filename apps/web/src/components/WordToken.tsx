// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { lookupVocab } from '@/services/vocabService'
import type { ParsedWord, VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

interface WordTokenProps {
  token: ParsedWord
  vocabKey: number | null
  sentenceId: string
  /** Raw supplement entry; takes precedence over vocabKey lookup when provided and non-null. */
  supplementEntry?: VocabSupplementEntry | null
}

/** Single Japanese word token with per-segment ruby annotation and vocabulary lookup. */
export function WordToken({ token, vocabKey, sentenceId, supplementEntry }: WordTokenProps) {
  const lookup = useLookupStore((s) => s.lookup)
  const lookupStatus = useLookupStore((s) => s.lookupState.status)
  const activeWord = useLookupStore((s) =>
    s.lookupState.status === 'found' ? s.lookupState.word : null
  )
  const rubyVisible = usePreferenceStore((s) => s.rubyVisible)

  const isActive = lookupStatus === 'found' && activeWord === token.surface

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Stop propagation always — prevents SentenceBlock container from calling
    // selectSentence and immediately resetting the lookupState we're about to set.
    e.stopPropagation()
    // Supplement entry takes precedence over the main vocab dictionary
    if (supplementEntry != null) {
      const adapted: VocabEntry = {
        id: -(supplementEntry.key),
        word: supplementEntry.word,
        reading: supplementEntry.hiragana,
        meaning: supplementEntry.translation,
        lesson: 'supplement',
      }
      lookup(token.surface, adapted, sentenceId, supplementEntry.pos)
      return
    }
    if (vocabKey === null) return
    const entry = lookupVocab(vocabKey)
    if (entry === null) return
    lookup(token.surface, entry, sentenceId)
  }

  // Group each annotated segment with its immediately-following unannotated segment (okurigana)
  // inside one <ruby> element, so the browser distributes the annotation over the full word unit.
  const renderedSegments: JSX.Element[] = []
  let i = 0
  while (i < token.segments.length) {
    const seg = token.segments[i]
    if (seg.ruby !== null) {
      const next = token.segments[i + 1]
      const trailer = next?.ruby === null ? next.text : null
      renderedSegments.push(
        <ruby key={i}>
          {seg.text}
          <rt className={cn(!rubyVisible && 'invisible')}>{seg.ruby}</rt>
          {trailer}
        </ruby>
      )
      i += trailer !== null ? 2 : 1
    } else {
      renderedSegments.push(<span key={i}>{seg.text}</span>)
      i++
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={token.surface}
      lang="ja"
      className={cn(
        'font-ja cursor-pointer rounded word-token',
        isActive
          ? 'bg-accent-subtle border-b-2 border-accent'
          : 'hover:bg-accent-subtle',
      )}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleActivate(e)
      }}
    >
      {renderedSegments}
    </span>
  )
}
