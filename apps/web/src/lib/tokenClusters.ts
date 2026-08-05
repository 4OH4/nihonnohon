// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { ParsedWord } from '@nihonnohon/schema'

/**
 * Characters that must not begin a line (行頭禁則).
 *
 * The reader lays a sentence out as flex items, one per token, and punctuation is a
 * token of its own — so the browser's native Japanese line-breaking rules never get
 * to run and a sentence-final 。 is free to wrap onto a line by itself (issue #23).
 */
const NO_LINE_START = new Set(
  '。、，．・：；？！)]}）］｝〉》」』】〕…‥―～ー々ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ'
)

/**
 * Groups token indices into runs that must be rendered on a single line.
 *
 * A token beginning with a character that cannot start a line joins the preceding
 * run. Returned runs are contiguous, non-empty, and cover every index in order.
 *
 * Only this backward bind is applied. The mirror rule — an opening 「 must not end a
 * line — is deliberately left alone: honouring it means binding a quote to the word
 * *after* it, which chains 「 + word + 。 into a run wide enough to push text off the
 * side of a 320px screen. A quote at the end of a line reads perfectly well, so the
 * trade is not worth making.
 */
export function clusterTokens(tokens: ParsedWord[]): number[][] {
  const clusters: number[][] = []

  for (let i = 0; i < tokens.length; i++) {
    const previous = clusters.at(-1)
    const joinPrevious = NO_LINE_START.has(tokens[i].surface.at(0) ?? '')

    if (previous !== undefined && joinPrevious) previous.push(i)
    else clusters.push([i])
  }

  return clusters
}
