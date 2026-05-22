// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  lookupKanji,
  initKanji,
  _initKanjiFromData,
  _resetKanji,
} from '@/services/kanjiService'
import type { KanjiEntry } from '@nihonnohon/schema'

const fixture: Record<string, KanjiEntry> = {
  '食': { char: '食', kw: 'eat', m: ['eat', 'food'], onY: ['ショク', 'ジキ'], kunY: ['た.べる', 'く.う'] },
  '学': { char: '学', kw: 'study', m: ['study', 'learning'], onY: ['ガク'], kunY: ['まな.ぶ'] },
  '日': { char: '日', kw: 'day', m: ['day', 'sun'], onY: ['ニチ', 'ジツ'], kunY: ['ひ', 'か'] },
  // null kw — valid per KanjiEntry type; used when no Heisig keyword is assigned
  '乙': { char: '乙', kw: null, m: ['the latter', 'strange', 'witty'], onY: ['オツ', 'イツ'], kunY: ['おと', 'きのと'] },
}

describe('kanjiService', () => {
  beforeEach(() => _initKanjiFromData(fixture))
  afterEach(() => _resetKanji())

  it('returns the correct KanjiEntry for a known kanji character', () => {
    const entry = lookupKanji('食')
    expect(entry).not.toBeNull()
    expect(entry!.char).toBe('食')
    expect(entry!.kw).toBe('eat')
    expect(entry!.m).toContain('food')
    expect(entry!.onY).toContain('ショク')
    expect(entry!.kunY).toContain('た.べる')
  })

  it('returns entries for all fixture kanji', () => {
    expect(lookupKanji('学')?.kw).toBe('study')
    expect(lookupKanji('日')?.kw).toBe('day')
  })

  it('returns a KanjiEntry with null kw when kw is null in the data', () => {
    const entry = lookupKanji('乙')
    expect(entry).not.toBeNull()
    expect(entry!.kw).toBeNull()
    expect(entry!.m).toContain('the latter')
  })

  it('returns null for an unknown kanji character', () => {
    expect(lookupKanji('猫')).toBeNull()
  })

  it('returns null for a hiragana character (graceful degradation)', () => {
    // e.g. in 食べる — べ and る are hiragana and have no kanji entry
    expect(lookupKanji('べ')).toBeNull()
    expect(lookupKanji('る')).toBeNull()
  })

  it('returns null for a katakana character (graceful degradation)', () => {
    expect(lookupKanji('ア')).toBeNull()
  })

  it('returns null for punctuation characters', () => {
    expect(lookupKanji('。')).toBeNull()
    expect(lookupKanji('、')).toBeNull()
  })

  it('does not fetch on repeat initKanji calls when already initialised', async () => {
    _resetKanji()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async (): Promise<Record<string, KanjiEntry>> => fixture,
    })
    vi.stubGlobal('fetch', mockFetch)

    try {
      await initKanji()
      await initKanji() // second call must be a no-op
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(lookupKanji('食')?.kw).toBe('eat')
    } finally {
      vi.unstubAllGlobals()
      _resetKanji()
    }
  })
})
