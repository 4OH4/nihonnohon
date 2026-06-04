// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { WordSegment } from '@nihonnohon/schema'

/** A kanji segment paired with its optional trailing okurigana. */
export interface AnnotatedGroup {
  type: 'annotated'
  text: string
  ruby: string
  /** Trailing okurigana text to render inside the same ruby element, or null. */
  trailer: string | null
}

/** A plain unannotated text segment. */
export interface PlainGroup {
  type: 'plain'
  text: string
}

export type RubyGroup = AnnotatedGroup | PlainGroup

/**
 * Groups a flat WordSegment[] into RubyGroup[] for rendering.
 *
 * An annotated segment (ruby !== null) absorbs the immediately-following unannotated
 * segment as okurigana so the browser renders the reading over the full kanji+kana unit.
 */
export function groupRubySegments(segments: WordSegment[]): RubyGroup[] {
  const groups: RubyGroup[] = []
  let i = 0
  while (i < segments.length) {
    const seg = segments[i]
    if (seg.ruby !== null) {
      const next = segments[i + 1]
      const trailer = next?.ruby === null ? next.text : null
      groups.push({ type: 'annotated', text: seg.text, ruby: seg.ruby, trailer })
      i += trailer !== null ? 2 : 1
    } else {
      groups.push({ type: 'plain', text: seg.text })
      i++
    }
  }
  return groups
}
