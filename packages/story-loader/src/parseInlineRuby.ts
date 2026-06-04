// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { WordSegment, ParsedWord } from '@nihonnohon/schema'

/** Returns true if the character is kanji: CJK Unified Ideographs or iteration marks 々〻〃. */
function isKanji(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    code === 0x3005 || // 々 ideographic iteration mark
    code === 0x303b || // 〻 vertical ideographic iteration mark
    code === 0x3003    // 〃 ditto mark
  )
}

/**
 * Parses a word string that may contain inline furigana annotations in 漢字[よみ] format.
 * Each contiguous kanji run followed by [reading] becomes an annotated segment; all other
 * characters form unannotated segments. Malformed brackets do not throw.
 */
export function parseInlineRuby(input: string): ParsedWord {
  if (input.length === 0) {
    return { surface: '', segments: [] }
  }

  const segments: WordSegment[] = []
  let pos = 0

  while (pos < input.length) {
    const char = input[pos]

    if (isKanji(char)) {
      // Collect a contiguous run of kanji characters
      let kanjiEnd = pos + 1
      while (kanjiEnd < input.length && isKanji(input[kanjiEnd])) {
        kanjiEnd++
      }
      const kanjiRun = input.slice(pos, kanjiEnd)

      if (input[kanjiEnd] === '[') {
        // Look for the closing bracket
        const closeIdx = input.indexOf(']', kanjiEnd + 1)
        if (closeIdx === -1) {
          // Malformed: no closing bracket — treat kanji run + rest as unannotated
          segments.push({ text: input.slice(pos), ruby: null })
          pos = input.length
        } else {
          const reading = input.slice(kanjiEnd + 1, closeIdx)
          segments.push({ text: kanjiRun, ruby: reading.length > 0 ? reading : null })
          pos = closeIdx + 1
        }
      } else {
        segments.push({ text: kanjiRun, ruby: null })
        pos = kanjiEnd
      }
    } else if (char === '[') {
      // Orphan '[' outside kanji context — consume and discard to matching ']' or end
      const closeIdx = input.indexOf(']', pos + 1)
      pos = closeIdx === -1 ? input.length : closeIdx + 1
    } else {
      // Collect a run of non-kanji, non-'[' characters
      let runEnd = pos + 1
      while (runEnd < input.length && !isKanji(input[runEnd]) && input[runEnd] !== '[') {
        runEnd++
      }
      segments.push({ text: input.slice(pos, runEnd), ruby: null })
      pos = runEnd
    }
  }

  const surface = segments.map(s => s.text).join('')
  return { surface, segments }
}
