// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach } from 'vitest'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry } from '@nihonnohon/schema'

const entry: VocabEntry = {
  id: 42,
  word: '食べる',
  reading: 'たべる',
  meaning: 'to eat',
  lesson: 'Genki I Ch.3',
}

afterEach(() => useLookupStore.getState()._reset())

describe('useLookupStore', () => {
  it('starts in idle state with no selected sentence', () => {
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'idle' })
    expect(state.selectedSentenceId).toBeNull()
  })

  it('idle → found: lookup with a valid VocabEntry', () => {
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'found', word: '食べる', entry })
    expect(state.selectedSentenceId).toBe('sent-1')
  })

  it('idle → not-found: lookup with null entry still sets selectedSentenceId', () => {
    useLookupStore.getState().lookup('べ', null, 'sent-2')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'not-found', word: 'べ' })
    // Sentence is still selected even when no entry exists
    expect(state.selectedSentenceId).toBe('sent-2')
  })

  it('found → found: second lookup replaces first', () => {
    const second: VocabEntry = { id: 1, word: 'お早う', reading: 'おはよう', meaning: 'Good morning', lesson: 'Genki I Intro' }
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    useLookupStore.getState().lookup('お早う', second, 'sent-3')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'found', word: 'お早う', entry: second })
    expect(state.selectedSentenceId).toBe('sent-3')
  })

  it('found → idle: selectSentence resets lookupState', () => {
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    useLookupStore.getState().selectSentence('sent-4')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'idle' })
    expect(state.selectedSentenceId).toBe('sent-4')
  })

  it('not-found → idle: selectSentence resets lookupState', () => {
    useLookupStore.getState().lookup('べ', null, 'sent-2')
    useLookupStore.getState().selectSentence('sent-5')
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'idle' })
    expect(state.selectedSentenceId).toBe('sent-5')
  })

  it('_reset restores initial state', () => {
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    useLookupStore.getState()._reset()
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'idle' })
    expect(state.selectedSentenceId).toBeNull()
    expect(state.translatedSentenceId).toBeNull()
  })

  it('showSentenceTranslation reveals the sentence, selects it, and clears any word lookup', () => {
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    useLookupStore.getState().showSentenceTranslation('sent-1')
    const state = useLookupStore.getState()
    expect(state.translatedSentenceId).toBe('sent-1')
    expect(state.selectedSentenceId).toBe('sent-1')
    expect(state.lookupState).toEqual({ status: 'idle' })
  })

  it('selectSentence clears a revealed sentence translation', () => {
    useLookupStore.getState().showSentenceTranslation('sent-1')
    useLookupStore.getState().selectSentence('sent-1')
    expect(useLookupStore.getState().translatedSentenceId).toBeNull()
  })

  it('selecting a word clears a revealed sentence translation', () => {
    useLookupStore.getState().showSentenceTranslation('sent-1')
    useLookupStore.getState().lookup('食べる', entry, 'sent-1')
    expect(useLookupStore.getState().translatedSentenceId).toBeNull()
  })
})
