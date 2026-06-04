// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { VocabItem } from '@/components/VocabItem'
import type { VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

/** Converts VocabSupplementEntry items to display-ready pairs preserving the original pos. */
function toVocabItems(
  items: VocabSupplementEntry[],
  idOffset: number,
): Array<{ entry: VocabEntry; pos?: string }> {
  return items.map((e, i) => ({
    entry: {
      id: -(idOffset + i + 1),
      word: e.word,
      reading: e.hiragana,
      meaning: e.translation,
      lesson: 'supplement',
    },
    pos: e.pos,
  }))
}

interface VocabPanelProps {
  /** Story keyword vocabulary list — shown first, before supplement entries. */
  keywords: VocabSupplementEntry[] | undefined
  /** Story vocabulary supplement entries. */
  vocabSupplement: VocabSupplementEntry[]
}

/** Unified vocabulary panel — keywords first, then supplement; empty state when both absent. */
export function VocabPanel({ keywords, vocabSupplement }: VocabPanelProps) {
  const keywordItems = toVocabItems(keywords ?? [], 0)
  const supplementItems = toVocabItems(vocabSupplement, keywordItems.length)
  const combined = [...keywordItems, ...supplementItems]

  if (combined.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-muted text-center">No vocabulary defined for this story.</p>
      </div>
    )
  }

  return (
    <div style={{ fontSize: 'var(--story-font-size)' }}>
      {combined.map(({ entry, pos }) => (
        <VocabItem key={entry.id} entry={entry} pos={pos} />
      ))}
    </div>
  )
}
