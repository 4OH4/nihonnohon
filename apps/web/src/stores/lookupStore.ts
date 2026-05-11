import { create } from 'zustand'
import type { LookupState, VocabEntry } from '@nihonnohon/schema'

interface LookupStoreState {
  lookupState: LookupState
  selectedSentenceId: string | null
  lookup: (word: string, entry: VocabEntry | null, sentenceId: string) => void
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
  lookup: (_word, _entry, _sentenceId) => {
    // Full implementation in Story 2.2
  },
  selectSentence: (_sentenceId) => {
    // Full implementation in Story 2.2
  },
  reset: () => set(initialState),
  _reset: () => set(initialState),
}))
