// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { lookupVocab } from '@/services/vocabService'
import type { ParsedWord, VocabEntry } from '@nihonnohon/schema'

interface WordTokenProps {
  token: ParsedWord
  vocabKey: number | null
  sentenceId: string
  /** Supplement entry takes precedence over vocabKey lookup when provided and non-null. */
  supplementEntry?: VocabEntry | null
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
      lookup(token.surface, supplementEntry, sentenceId)
      return
    }
    if (vocabKey === null) return
    const entry = lookupVocab(vocabKey)
    if (entry === null) return
    lookup(token.surface, entry, sentenceId)
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
      {/* Render each segment: annotated segments get <ruby>, plain segments get <span> */}
      {token.segments.map((seg, i) =>
        seg.ruby !== null ? (
          <ruby key={i}>
            {seg.text}
            <rt className={cn(!rubyVisible && 'invisible')}>{seg.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}
