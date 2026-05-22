// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { lookupKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

interface KanjiBreakdownProps {
  word: string
}

/** Horizontal row of kanji character + Heisig keyword pairs for a looked-up word. Returns null when the word contains no recognised kanji. */
export function KanjiBreakdown({ word }: KanjiBreakdownProps) {
  const entries: { char: string; entry: KanjiEntry }[] = [...word]
    .map((char) => ({ char, entry: lookupKanji(char) }))
    .filter((x): x is { char: string; entry: KanjiEntry } => x.entry !== null)

  if (entries.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto" tabIndex={0} aria-label="Kanji breakdown">
      {entries.map(({ char, entry }, i) => (
        <div key={char + i} className="flex flex-col items-center shrink-0">
          <span className="font-ja text-xl" lang="ja">{char}</span>
          <span className="text-xs text-muted">{entry.kw ?? entry.m[0] ?? ''}</span>
        </div>
      ))}
    </div>
  )
}
