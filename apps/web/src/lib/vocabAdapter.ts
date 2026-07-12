// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

/**
 * Adapts a VocabSupplementEntry to the VocabEntry shape used by the lookup store.
 *
 * The id is negated from the supplement key so it is distinct from main vocab ids (which are
 * positive integers). Supplement keys start at 10000, so adapted ids start at -10000.
 */
export function supplementToVocabEntry(e: VocabSupplementEntry): VocabEntry {
  return {
    id: -(e.key),
    word: e.word,
    reading: e.hiragana,
    meaning: e.translation,
    lesson: 'supplement',
  }
}
