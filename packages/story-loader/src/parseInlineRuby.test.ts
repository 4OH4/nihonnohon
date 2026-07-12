// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { parseInlineRuby } from './parseInlineRuby'

describe('parseInlineRuby', () => {
  // AC2: whole-word jukujikun
  describe('whole-word annotation', () => {
    it('parses 大人[おとな] — single annotated segment', () => {
      const result = parseInlineRuby('大人[おとな]')
      expect(result.surface).toBe('大人')
      expect(result.segments).toEqual([{ text: '大人', ruby: 'おとな' }])
    })

    it('parses 私[わたし] — single kanji annotated segment', () => {
      const result = parseInlineRuby('私[わたし]')
      expect(result.surface).toBe('私')
      expect(result.segments).toEqual([{ text: '私', ruby: 'わたし' }])
    })
  })

  // AC3: kanji block + okurigana
  describe('kanji block with trailing okurigana', () => {
    it('parses 肌寒[はだざむ]い — annotated block followed by plain kana', () => {
      const result = parseInlineRuby('肌寒[はだざむ]い')
      expect(result.surface).toBe('肌寒い')
      expect(result.segments.length).toBe(2)
      expect(result.segments).toEqual([
        { text: '肌寒', ruby: 'はだざむ' },
        { text: 'い', ruby: null },
      ])
    })
  })

  // AC4: separate kanji interleaved with kana
  describe('interleaved kanji and kana', () => {
    it('parses 付[つ]け加[くわ]える — 4 segments', () => {
      const result = parseInlineRuby('付[つ]け加[くわ]える')
      expect(result.surface).toBe('付け加える')
      expect(result.segments.length).toBe(4)
      expect(result.segments).toEqual([
        { text: '付', ruby: 'つ' },
        { text: 'け', ruby: null },
        { text: '加', ruby: 'くわ' },
        { text: 'える', ruby: null },
      ])
    })
  })

  // AC6: unannotated plain string
  describe('plain unannotated string', () => {
    it('parses は — single plain segment with no ruby', () => {
      const result = parseInlineRuby('は')
      expect(result.surface).toBe('は')
      expect(result.segments.length).toBe(1)
      expect(result.segments[0]).toEqual({ text: 'は', ruby: null })
    })
  })

  // AC7: adjacent annotated kanji blocks
  describe('adjacent annotated kanji blocks', () => {
    it('parses 全国[ぜんこく]大会[たいかい] — 2 annotated segments', () => {
      const result = parseInlineRuby('全国[ぜんこく]大会[たいかい]')
      expect(result.surface).toBe('全国大会')
      expect(result.segments.length).toBe(2)
      expect(result.segments).toEqual([
        { text: '全国', ruby: 'ぜんこく' },
        { text: '大会', ruby: 'たいかい' },
      ])
    })
  })

  // AC8: malformed input
  describe('iteration marks treated as kanji', () => {
    it('parses 時々[ときどき] — 々 (U+3005) joins the kanji run', () => {
      const result = parseInlineRuby('時々[ときどき]')
      expect(result.surface).toBe('時々')
      expect(result.segments).toEqual([{ text: '時々', ruby: 'ときどき' }])
    })

    it('parses 〻 (U+303B vertical iteration mark) as part of kanji run', () => {
      const result = parseInlineRuby('時〻[ときどき]')
      expect(result.surface).toBe('時〻')
      expect(result.segments).toEqual([{ text: '時〻', ruby: 'ときどき' }])
    })

    it('parses 〃 (U+3003 ditto mark) as part of kanji run', () => {
      const result = parseInlineRuby('時〃[ときどき]')
      expect(result.surface).toBe('時〃')
      expect(result.segments).toEqual([{ text: '時〃', ruby: 'ときどき' }])
    })
  })

  describe('empty bracket annotation', () => {
    it('treats 食[] as unannotated — ruby: null not ruby: empty string', () => {
      const result = parseInlineRuby('食[]')
      expect(result.surface).toBe('食')
      expect(result.segments.length).toBe(1)
      expect(result.segments[0]).toEqual({ text: '食', ruby: null })
    })
  })

  describe('malformed bracket input', () => {
    it('handles 食[た (unclosed bracket) without throwing', () => {
      expect(() => parseInlineRuby('食[た')).not.toThrow()
      const result = parseInlineRuby('食[た')
      expect(result.surface).toBe('食[た')
      expect(result.segments.every(s => s.ruby === null)).toBe(true)
    })
  })

  // AC9 coverage: additional patterns
  describe('kanji followed by unannotated kana', () => {
    it('parses 食べる — kanji run then plain kana (2 segments)', () => {
      const result = parseInlineRuby('食べる')
      expect(result.surface).toBe('食べる')
      expect(result.segments.length).toBe(2)
      expect(result.segments[0]).toEqual({ text: '食', ruby: null })
      expect(result.segments[1]).toEqual({ text: 'べる', ruby: null })
    })
  })

  describe('katakana-only string', () => {
    it('parses テスト — single plain segment', () => {
      const result = parseInlineRuby('テスト')
      expect(result.surface).toBe('テスト')
      expect(result.segments.length).toBe(1)
      expect(result.segments[0]).toEqual({ text: 'テスト', ruby: null })
    })
  })

  describe('empty string', () => {
    it('returns empty surface and no segments for empty input', () => {
      const result = parseInlineRuby('')
      expect(result.surface).toBe('')
      expect(result.segments).toEqual([])
    })
  })

  describe('bracket after kana (not after kanji)', () => {
    it('discards orphan bracket content — surface is clean, brackets do not appear', () => {
      const result = parseInlineRuby('食べる[たべる]')
      expect(result.surface).toBe('食べる')
      expect(result.segments.length).toBe(2)
      expect(result.segments).toEqual([
        { text: '食', ruby: null },
        { text: 'べる', ruby: null },
      ])
    })

    it('discards orphan bracket at start of string', () => {
      const result = parseInlineRuby('[あ]食[た]')
      expect(result.surface).toBe('食')
      expect(result.segments).toEqual([{ text: '食', ruby: 'た' }])
    })
  })
})
