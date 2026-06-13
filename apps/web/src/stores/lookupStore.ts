// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'
import type { LookupState, VocabEntry } from '@nihonnohon/schema'

interface LookupStoreState {
  lookupState: LookupState
  selectedSentenceId: string | null
  /** Sentence whose full translation is revealed inline (quick per-sentence translation). */
  translatedSentenceId: string | null
  lookup: (word: string, entry: VocabEntry | null, sentenceId: string | null, pos?: string) => void
  selectSentence: (sentenceId: string) => void
  showSentenceTranslation: (sentenceId: string) => void
  reset: () => void
  _reset: () => void
}

const initialState = {
  lookupState: { status: 'idle' } as LookupState,
  selectedSentenceId: null as string | null,
  translatedSentenceId: null as string | null,
}

export const useLookupStore = create<LookupStoreState>()((set) => ({
  ...initialState,
  lookup: (word, entry, sentenceId, pos) =>
    set({
      lookupState: entry !== null
        ? { status: 'found', word, entry, ...(pos ? { pos } : {}) }
        : { status: 'not-found', word },
      selectedSentenceId: sentenceId,
      // Selecting a word dismisses any inline sentence translation.
      translatedSentenceId: null,
    }),
  selectSentence: (sentenceId) =>
    set({
      selectedSentenceId: sentenceId,
      lookupState: { status: 'idle' },
      // A plain sentence tap clears the previously revealed translation.
      translatedSentenceId: null,
    }),
  showSentenceTranslation: (sentenceId) =>
    set({
      selectedSentenceId: sentenceId,
      translatedSentenceId: sentenceId,
      lookupState: { status: 'idle' },
    }),
  reset: () => set(initialState),
  _reset: () => set(initialState),
}))
