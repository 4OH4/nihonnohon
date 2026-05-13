import { create } from 'zustand'
import type { LookupState, VocabEntry } from '@nihonnohon/schema'

interface LookupStoreState {
  lookupState: LookupState
  selectedSentenceId: string | null
  lookup: (word: string, entry: VocabEntry | null, sentenceId: string | null) => void
  selectSentence: (sentenceId: string) => void
  reset: () => void
  _reset: () => void
}

const initialState = {
  lookupState: { status: 'idle' } as LookupState,
  selectedSentenceId: null as string | null,
}

export const useLookupStore = create<LookupStoreState>()((set) => ({
  ...initialState,
  lookup: (word, entry, sentenceId) =>
    set({
      lookupState: entry !== null
        ? { status: 'found', word, entry }
        : { status: 'not-found', word },
      selectedSentenceId: sentenceId,
    }),
  selectSentence: (sentenceId) =>
    set({
      selectedSentenceId: sentenceId,
      lookupState: { status: 'idle' },
    }),
  reset: () => set(initialState),
  _reset: () => set(initialState),
}))
