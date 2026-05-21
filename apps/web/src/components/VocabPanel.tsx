// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { VocabItem } from '@/components/VocabItem'
import type { VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

/** Converts VocabSupplementEntry items to VocabEntry shape for lookup store compatibility. */
function toVocabEntries(items: VocabSupplementEntry[], idOffset: number): VocabEntry[] {
  return items.map((e, i) => ({
    id: -(idOffset + i + 1),
    word: e.word,
    reading: e.hiragana,
    meaning: e.translation,
    lesson: 'supplement',
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
  const keywordEntries = toVocabEntries(keywords ?? [], 0)
  const supplementEntries = toVocabEntries(vocabSupplement, keywordEntries.length)
  const combined = [...keywordEntries, ...supplementEntries]

  if (combined.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-muted text-center">No vocabulary defined for this story.</p>
      </div>
    )
  }

  return (
    <div style={{ fontSize: 'var(--story-font-size)' }}>
      {combined.map((entry) => (
        <VocabItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
