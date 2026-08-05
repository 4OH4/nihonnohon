// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest'
import { clusterTokens } from '@/lib/tokenClusters'
import type { ParsedWord } from '@nihonnohon/schema'

/** Builds tokens from surfaces — clustering only reads `surface`, never the segments. */
function tokens(...surfaces: string[]): ParsedWord[] {
  return surfaces.map((surface) => ({ surface, segments: [{ text: surface, ruby: null }] }))
}

describe('clusterTokens', () => {
  it('leaves a sentence with no punctuation as one cluster per token', () => {
    expect(clusterTokens(tokens('私', 'は', '学生', 'です'))).toEqual([[0], [1], [2], [3]])
  })

  it('binds a sentence-final 。 to the preceding token', () => {
    expect(clusterTokens(tokens('学校', 'へ', '行きます', '。'))).toEqual([[0], [1], [2, 3]])
  })

  it('binds a mid-sentence 、 to the preceding token', () => {
    expect(clusterTokens(tokens('毎日', '、', '朝', '、', '私'))).toEqual([[0, 1], [2, 3], [4]])
  })

  it('binds a closing quote and combined punctuation backwards', () => {
    expect(clusterTokens(tokens('です', '。」', 'と'))).toEqual([[0, 1], [2]])
    expect(clusterTokens(tokens('おいしい', '！」'))).toEqual([[0, 1]])
  })

  // An opening quote is deliberately left free to sit at the end of a line: binding
  // it forwards chains 「 + word + 。 into a run too wide for a 320px screen.
  it('leaves an opening quote unbound', () => {
    expect(clusterTokens(tokens('彼', 'は', '「', 'こんにちは'))).toEqual([[0], [1], [2], [3]])
    expect(clusterTokens(tokens('は', '「', '心配しないでください', '。'))).toEqual([
      [0], [1], [2, 3],
    ])
  })

  it('binds backwards only for a token that both closes and opens (。「)', () => {
    expect(clusterTokens(tokens('わらいました', '。「', 'もう', 'おなか'))).toEqual([
      [0, 1], [2], [3],
    ])
  })

  it('binds a run of consecutive closing marks to the same word', () => {
    expect(clusterTokens(tokens('見ました', '。', '」', 'と'))).toEqual([[0, 1, 2], [3]])
  })

  it('binds punctuation carrying trailing text (。今日)', () => {
    expect(clusterTokens(tokens('でした', '。今日', 'は'))).toEqual([[0, 1], [2]])
  })

  it('has nothing to bind to when a sentence opens with punctuation', () => {
    expect(clusterTokens(tokens('。', 'そして'))).toEqual([[0], [1]])
  })

  it('does not join an empty surface to its neighbour', () => {
    expect(clusterTokens(tokens('です', '', 'と'))).toEqual([[0], [1], [2]])
  })

  it('returns no clusters for an empty sentence', () => {
    expect(clusterTokens([])).toEqual([])
  })

  it('covers every token index exactly once, in order', () => {
    const input = tokens('私', 'は', '「', 'はい', '。」', 'と', '言いました', '。')
    const flat = clusterTokens(input).flat()
    expect(flat).toEqual(input.map((_, i) => i))
  })
})
