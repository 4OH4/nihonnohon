// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils'
import { withSlashBreaks } from '@/lib/slashBreaks'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry } from '@nihonnohon/schema'

/** Single row in the vocabulary panel — shows word, reading, and translation with lookup on tap. */
export function VocabItem({ entry, pos }: { entry: VocabEntry; pos?: string }) {
  const lookup = useLookupStore((s) => s.lookup)
  const lookupState = useLookupStore((s) => s.lookupState)
  const isActive = lookupState.status === 'found' && lookupState.word === entry.word

  const handleActivate = () => {
    // sentenceId is null — vocab panel taps do not select or highlight a sentence
    lookup(entry.word, entry, null, pos)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleActivate()
        }
      }}
      className={cn(
        'grid grid-cols-[1fr_1fr_1fr] items-center gap-x-2 px-3 py-2 cursor-pointer rounded',
        isActive ? 'bg-accent-subtle' : 'hover:bg-accent-subtle',
      )}
    >
      <span className="font-ja text-paper-text" lang="ja">{entry.word}</span>
      <span className="font-ja text-muted text-[0.85em]" lang="ja">{entry.reading}</span>
      {/* withSlashBreaks: this column is a third of the row with no break utilities, so a
          slashed gloss ("to cook/grill") needs the break opportunity most — #27. */}
      <span className="text-paper-text text-[0.8em]">{withSlashBreaks(entry.meaning)}</span>
    </div>
  )
}
