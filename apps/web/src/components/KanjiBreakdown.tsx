// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { lookupKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

interface KanjiBreakdownProps {
  word: string
}

type Cell = { char: string; entry: KanjiEntry }

/** Splits cells into balanced rows of at most 3, so a 4+ kanji word flows onto
 *  further rows (4→2+2, 5→3+2, 6→3+3, 7→3+2+2) rather than overflowing one row. */
function splitIntoRows(cells: Cell[]): Cell[][] {
  const rowCount = Math.ceil(cells.length / 3)
  const rows: Cell[][] = []
  let start = 0
  for (let r = 0; r < rowCount; r++) {
    const size = Math.ceil((cells.length - start) / (rowCount - r))
    rows.push(cells.slice(start, start + size))
    start += size
  }
  return rows
}

/** Kanji character + Heisig keyword cells for a looked-up word, in rows of at most
 *  three. Returns null when the word contains no recognised kanji. */
export function KanjiBreakdown({ word }: KanjiBreakdownProps) {
  const entries: Cell[] = [...word]
    .map((char) => ({ char, entry: lookupKanji(char) }))
    .filter((x): x is Cell => x.entry !== null)

  if (entries.length === 0) return null

  return (
    // Char-above-keyword cells in rows of at most three (each cell sizes to its
    // keyword when there's room and shrinks toward the 2.5em floor when tight). On
    // desktop the rows collapse (lg:contents) into a single horizontal row, since
    // the wider panel has room for all the kanji at once.
    <div className="flex flex-col gap-y-1 lg:flex-row lg:gap-x-2" aria-label="Kanji breakdown">
      {splitIntoRows(entries).map((row, ri) => (
        <div key={ri} className="flex gap-x-2 lg:contents">
          {row.map(({ char, entry }, i) => (
            <div key={char + i} className="flex min-w-[2.5em] flex-col items-center text-center">
              <span className="font-ja text-[1.25em]" lang="ja">{char}</span>
              <span lang="en" className="w-full text-[0.75em] leading-tight text-muted hyphens-auto break-words">{entry.kw ?? entry.m[0] ?? ''}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
