// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils'
import { groupRubySegments } from '@/lib/rubyUtils'
import { supplementToVocabEntry } from '@/lib/vocabAdapter'
import { useLookupStore } from '@/stores/lookupStore'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { lookupVocab } from '@/services/vocabService'
import type { ParsedWord, VocabSupplementEntry } from '@nihonnohon/schema'

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
      lookup(token.surface, supplementToVocabEntry(supplementEntry), sentenceId, supplementEntry.pos)
      return
    }
    if (vocabKey === null) return
    const entry = lookupVocab(vocabKey)
    if (entry === null) return
    lookup(token.surface, entry, sentenceId)
  }

  const renderedSegments = groupRubySegments(token.segments).map((group, i) =>
    group.type === 'annotated'
      ? (
        <ruby key={i}>
          {group.text}
          <rt className={cn('select-none [-webkit-touch-callout:none]', !rubyVisible && 'invisible')}>{group.ruby}</rt>
          {group.trailer}
        </ruby>
      )
      : <span key={i}>{group.text}</span>
  )

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
      // Keep the sentence-level long-press / double-tap from firing on a word: a
      // press or double-tap on a word is always a word lookup, never a quick
      // sentence translation.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleActivate(e)
      }}
    >
      {renderedSegments}
    </span>
  )
}
