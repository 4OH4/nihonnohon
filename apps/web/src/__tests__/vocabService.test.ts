// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  lookupVocab,
  initVocab,
  _initVocabFromData,
  _resetVocab,
} from '@/services/vocabService'
import type { VocabEntry } from '@nihonnohon/schema'

const fixture: VocabEntry[] = [
  { id: 1, word: 'お早う', reading: 'おはよう', meaning: 'Good morning', lesson: 'Genki I Intro' },
  { id: 42, word: '食べる', reading: 'たべる', meaning: 'to eat', lesson: 'Genki I Ch.3' },
  { id: 100, word: '学生', reading: 'がくせい', meaning: 'student', lesson: 'Genki I Ch.1' },
]

describe('vocabService', () => {
  beforeEach(() => _initVocabFromData(fixture))
  afterEach(() => _resetVocab())

  it('returns the correct VocabEntry for a known id', () => {
    const entry = lookupVocab(42)
    expect(entry).not.toBeNull()
    expect(entry!.word).toBe('食べる')
    expect(entry!.reading).toBe('たべる')
    expect(entry!.meaning).toBe('to eat')
    expect(entry!.lesson).toBe('Genki I Ch.3')
  })

  it('returns null for an unknown id', () => {
    expect(lookupVocab(999)).toBeNull()
  })

  it('returns entries for all fixture ids', () => {
    expect(lookupVocab(1)?.word).toBe('お早う')
    expect(lookupVocab(100)?.word).toBe('学生')
  })

  it('does not fetch on repeat initVocab calls when already initialised', async () => {
    // Reset so initVocab will actually fetch
    _resetVocab()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async (): Promise<VocabEntry[]> => fixture,
    })
    vi.stubGlobal('fetch', mockFetch)

    try {
      await initVocab()
      await initVocab() // second call must be a no-op
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(lookupVocab(42)?.word).toBe('食べる')
    } finally {
      vi.unstubAllGlobals()
      _resetVocab() // clean up fetch-based init state
    }
  })
})
