// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useSyncExternalStore } from 'react'
import { getKanjiVersion, lookupKanji, subscribeKanji } from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

interface KanjiBreakdownProps {
  word: string
}

type Cell = { char: string; entry: KanjiEntry }

/** Kanji character + Heisig keyword cells for a looked-up word. Characters with no
 *  entry in kanji-data.json — kana, and kanji outside the jouyou set it covers — get
 *  no cell, since a character with no keyword only repeats what the word already
 *  shows. Returns null when that leaves nothing to render. */
export function KanjiBreakdown({ word }: KanjiBreakdownProps) {
  // kanji-data.json loads off the critical path, so a word can be tapped before it
  // arrives — every lookup returns null until then. Subscribing re-runs them once
  // the data lands, turning an empty breakdown into a populated one.
  useSyncExternalStore(subscribeKanji, getKanjiVersion)

  const entries: Cell[] = [...word]
    .map((char) => ({ char, entry: lookupKanji(char) }))
    .filter((x): x is Cell => x.entry !== null)

  if (entries.length === 0) return null

  return (
    // The breakdown's width is an *input*, not an output of its keyword text: a fixed
    // 45% of the panel on mobile, so the reading/translation column always keeps the
    // rest. Sizing to content instead lets a cell take its keyword's max-content
    // ("public chamber/hall" on one unbreakable line), which both crowds out that
    // column and stops the keyword ever wrapping — the cell's width came from the very
    // text it was meant to wrap. See issue #19.
    //
    // Fixed rather than merely capped so the characters keep the same screen position
    // between lookups. Under a cap the column is as wide as its widest keyword, so the
    // characters jump ~80px sideways when you tap a word whose keywords are shorter.
    // The cost is real and deliberate: a word with short keywords leaves whitespace to
    // the right of them, and the translation column, now a fixed 55%, wraps sooner.
    //
    // Mobile stacks one kanji per row, char *beside* keyword: a compact form that fits
    // several kanji in the panel's ~5em without scrolling, where the desktop
    // char-above-keyword cell would need ~3em per kanji. Desktop keeps that taller cell
    // in a single horizontal row — the full-width panel there has room for it.
    <div
      className="flex w-[45%] shrink-0 flex-col gap-y-1 lg:w-auto lg:flex-row lg:gap-x-2"
      aria-label="Kanji breakdown"
    >
      {entries.map(({ char, entry }, i) => (
        <div
          key={char + i}
          // gap in em, not a rem step: everything else in the cell scales with the
          // story font size, so a fixed gap would visually close up at 'large'.
          // items-center reads as centring the keyword against the character on
          // mobile and the keyword under it on desktop — same class, both axes.
          className="flex items-center gap-x-[0.4em] lg:min-w-[2.5em] lg:flex-col lg:gap-x-0 lg:text-center"
        >
          {/* leading-none: at 1.4em the character's line box, not its keyword, sets the
              row height — so any spare leading here is height the panel cannot spare.
              1.4em is sized against that row height: three rows plus their two gaps fill
              94-98% of the panel's usable height at every text size, so the mobile stack
              reads as exactly three kanji (1.25em left a stranded half-row). It does not
              go higher because the gap and padding are rem, not em: at 'small' they are a
              larger share of the panel, and 1.5em there overflows enough to raise the
              scroll fade on a lookup that fits today. Keyword unchanged at 0.75em. */}
          <span className="font-ja shrink-0 text-[1.4em] leading-none" lang="ja">{char}</span>
          {/* min-w-0 lets the keyword shrink below its longest word and wrap inside the
              capped row, rather than forcing the row wider. */}
          <span lang="en" className="min-w-0 text-[0.75em] leading-tight text-muted hyphens-auto break-words lg:w-full">
            {entry.kw ?? entry.m[0] ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}
