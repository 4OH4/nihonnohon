// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { Fragment, type ReactNode } from 'react'

const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9'
const isWhitespace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch)

/**
 * Whether the "/" at `i` should become a line-break opportunity.
 *
 * Deliberately a character scan rather than a lookbehind regex: `/(?<!\d)\/(?!\d)/` is a
 * *parse-time* SyntaxError on Safari below 16.4 — a blank page, not a degraded one — and
 * esbuild cannot transpile lookbehind while Vite's default build target includes safari14.
 * Playwright's WebKit is new enough to pass CI, so the crash would only surface on real
 * older iOS devices.
 */
function isBreakableSlash(text: string, i: number): boolean {
  const prev = text[i - 1]
  const next = text[i + 1]
  // Nothing to keep the slash with, or a break already exists beside it.
  if (prev === undefined || next === undefined) return false
  if (isWhitespace(prev) || isWhitespace(next)) return false
  // Fractions ("1/10 bu", "8 1/3lbs", "shaku/100", "division (x/3)") read as one token.
  // Defensive rather than currently reachable: these live in kanji-data.json's `m[]`, and
  // KanjiBreakdown only falls back to m[0] when `kw` is null, which no entry is today —
  // but `kw` is `string | null` and the file is regenerated from kanjiapi.dev.
  if (isDigit(prev) || isDigit(next)) return false
  return true
}

/** Splits text after each breakable "/", keeping the slash on the preceding segment. */
function splitAtSlashBreaks(text: string): string[] {
  const segments: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '/' && isBreakableSlash(text, i)) {
      segments.push(text.slice(start, i + 1))
      start = i + 1
    }
  }
  segments.push(text.slice(start))
  return segments
}

/**
 * Inserts a `<wbr>` break opportunity after each "/" in English gloss text, so
 * "cold (thing/people)" can wrap as "cold (thing/" + "people)".
 *
 * CSS cannot express this: "/" is not a break opportunity under any `word-break` value,
 * and `overflow-wrap: break-word` only breaks a word that *alone* overflows its line — so
 * without this the browser breaks mid-word instead ("public chamber/hall" wrapped as
 * "chamber/h" + "all"). See issue #27.
 *
 * `<wbr>` is a break *opportunity*, not a forced break: line breaking stays greedy, so a
 * width that fits "thing/peo-" but not "thing/people" can still hyphenate instead. The
 * slash wins whenever the text after it does not fit, which is the case this addresses.
 *
 * Returns the input string unchanged when no slash qualifies, so glosses without one
 * render an identical DOM.
 */
export function withSlashBreaks(text: string): ReactNode {
  const segments = splitAtSlashBreaks(text)
  if (segments.length === 1) return text

  // The segments must stay *direct* text children of the caller's element: Testing
  // Library's getNodeText joins only direct child text nodes, so wrapping one in a
  // <span> would silently break every getByText() on a slashed gloss. Fragments add no
  // DOM node, so they preserve that.
  return segments.map((segment, i) => (
    <Fragment key={i}>
      {segment}
      {i < segments.length - 1 && <wbr />}
    </Fragment>
  ))
}
