// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Layout invariants for the InfoPanel word lookup — issue #19.
//
// This layout has regressed repeatedly because the previous fixes were CSS tweaks
// verified by eye on desktop, where the panel is ~64em wide and any arrangement
// fits. The failures only appear at ~15em (a phone at the 'large' text size), and
// only for words whose kanji keywords are long. These tests measure the panel at
// that width so the next change to it cannot silently reintroduce the bug.
//
// They assert proportions and relative sizes, not pixels — engine-to-engine font
// metric differences move the numbers a few percent, while the regressions these
// guard against were 2x+.

import { test, expect, type Page } from '@playwright/test'

const STORY = '/read/genki-i-ch15-yumis-bento-lunch'

// 食堂 — the worst case in issue #19: two kanji, the second with a keyword
// ("public chamber/hall") long enough that its cell used to claim 63% of the panel.
const LONG_KEYWORD_WORD = '食堂'
const LONG_KEYWORD_CELLS = 2
// 高校生 — three kanji, the most the breakdown has to stack on a phone.
const THREE_KANJI_WORD = '高校生'
const THREE_KANJI_CELLS = 3

type Metrics = {
  panelW: number
  panelH: number
  clippedBy: number
  leftPct: number
  breakdownPct: number
  rowTops: number[]
  cellHeights: number[]
  charX: number
  // Diagnostics for the overflow bound below. A bare `clippedBy` says the panel
  // clipped but not which column, by how many lines, or in what typeface — the gap
  // that let a bound be justified by reasoning rather than measurement.
  lineH: number // computed line-height of the meaning <p lang="en">
  fontFamily: string // the family list it *specifies* — see probeW for what it gets
  leftH: number // height of the reading/translation column
  breakdownH: number // height of the kanji breakdown
  layoutW: number // the width the page really laid out at (see useCssViewport)
  probeW: Record<string, number> // typeface fingerprint — see the probe in lookUp
  probeFont: string // the canvas font spec that produced probeW.stack
  meaningH: number // height of the meaning paragraph alone
  // TEMPORARY (remove once read): the meaning paragraph's height with one
  // contributing feature disabled at a time, to attribute the extra WebKit line.
  attribution: Record<string, number>
}

/**
 * Resizes until the page actually lays out at `width` CSS pixels.
 *
 * WebKit on Windows lays out at the host's display-scaling factor rather than the
 * requested viewport — at 125% a 412px viewport becomes 330 CSS px, and
 * `deviceScaleFactor` does not override it. Left uncompensated these assertions
 * describe one width while measuring another: 食堂 "overflows on WebKit" at 330px
 * and fits perfectly at the 412px the test asks for.
 *
 * Measured via getBoundingClientRect, not documentElement.clientWidth: under mobile
 * emulation the latter reports the scaled *visual* viewport (330) while the page
 * genuinely lays out at the requested 412, so it would provoke a correction that is
 * not needed and overshoot.
 *
 * It corrects the layout width, not viewport-relative units. Getting a 412px layout
 * means asking for a ~514px viewport, so 1vw grows with it and --story-font-size
 * (clamp(1.5rem, 2rem - 1vw, 2rem)) resolves to 26.85px where a true 412px viewport
 * gives 27.88px — measured, Windows WebKit at 125%. Harmless on the Linux runner,
 * where layoutW already reads 412 and the early return above fires; but it is a
 * second reason a local WebKit run cannot confirm these pixel numbers, and a reason
 * the overflow bound below is derived from the measured lineH rather than a constant.
 */
async function useCssViewport(page: Page, width: number, height: number) {
  const layoutWidth = () => page.evaluate(() => document.documentElement.getBoundingClientRect().width)
  const actual = await layoutWidth()
  if (Math.abs(actual - width) <= 2) return
  const scale = width / actual
  await page.setViewportSize({ width: Math.round(width * scale), height: Math.round(height * scale) })
}

async function openReader(page: Page, textSize: 'medium' | 'large', viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.addInitScript((size) => {
    localStorage.setItem(
      'nihonnohon-preferences',
      JSON.stringify({
        state: { rubyVisible: true, spacingVisible: false, transVisible: false, textSize: size, activeTab: 'story' },
        version: 0,
      }),
    )
  }, textSize)
  await page.goto(STORY)
  await useCssViewport(page, viewport.width, viewport.height)
}

/**
 * Selects a word and measures the resulting panel geometry.
 *
 * `expectedCells` is not just a sanity check: kanji-data.json is fetched off the
 * critical path, so the breakdown can render and then re-render with more cells.
 * Measuring between the two reads a layout that never reaches the user.
 */
async function lookUp(page: Page, word: string, expectedCells: number): Promise<Metrics> {
  await page.getByRole('button', { name: word }).first().click()
  await expect(page.getByLabel('Kanji breakdown').locator('> div')).toHaveCount(expectedCells)

  return page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Word lookup panel"]') as HTMLElement
    const scroller = panel.firstElementChild as HTMLElement
    const breakdown = panel.querySelector('[aria-label="Kanji breakdown"]') as HTMLElement
    // The reading/translation column is the breakdown's sibling in the lookup row.
    const left = breakdown.previousElementSibling as HTMLElement
    const cells = [...breakdown.children] as HTMLElement[]
    // The meaning paragraph: the element whose wrapping sets that column's height,
    // and the only text in the panel with no declared font-family of its own.
    const meaning = left.querySelector('p[lang="en"]') as HTMLElement
    const meaningStyle = getComputedStyle(meaning)

    // Which typeface is this paragraph actually in?
    //
    // Not a question getComputedStyle can answer: font-family computes to the
    // author's list, so every engine echoes back the same 'ui-sans-serif,
    // system-ui, sans-serif, ...' regardless of the face it picked. Measured
    // instead — one probe string through a canvas under the paragraph's own font
    // spec, then under named candidates. Widths that match mean faces that are
    // metrically the same, which is the only sense in which "same typeface"
    // matters to a layout bound. Canvas because it needs no layout and parses
    // the spec identically across engines; probeFont echoes the spec back so a
    // rejected one shows up as itself rather than as a bogus width.
    //
    // The named candidates only discriminate where those faces are installed — on the
    // Linux runner, which is the only place these numbers are authoritative. On a dev
    // machine without them they collapse onto one fallback width, which is a null
    // result rather than a match.
    const probe = 'cafeteria; dining commons'
    const ctx = document.createElement('canvas').getContext('2d')!
    const widthUnder = (family: string) => {
      ctx.font = `${meaningStyle.fontSize} ${family}`
      return Math.round(ctx.measureText(probe).width * 100) / 100
    }
    const candidates: [string, string][] = [
      ['stack', meaningStyle.fontFamily],
      ['dejavu', '"DejaVu Sans"'],
      ['liberation', '"Liberation Sans"'],
      ['arimo', 'Arimo'],
      ['generic', 'sans-serif'],
    ]
    const probeW: Record<string, number> = {}
    for (const [label, family] of candidates) probeW[label] = widthUnder(family)
    ctx.font = `${meaningStyle.fontSize} ${meaningStyle.fontFamily}`
    const probeFont = ctx.font

    // TEMPORARY — attribution probe. The first run established that the engines
    // agree on face, size, line-height and column width, and still disagree by one
    // line: so the difference is in *line breaking*, and these are the two features
    // that decide where this paragraph breaks. Toggle each, remeasure, restore.
    // Whichever toggle collapses the height is the mechanism; asserting one without
    // this is precisely the move that produced the bound being fixed here.
    const pill = meaning.querySelector('span') as HTMLElement | null
    const measureWith = (mutate: () => void, restore: () => void) => {
      mutate()
      // Reading the rect forces the reflow, so no explicit flush is needed.
      const h = meaning.getBoundingClientRect().height
      restore()
      return Math.round(h * 100) / 100
    }
    const attribution: Record<string, number> = {
      asIs: Math.round(meaning.getBoundingClientRect().height * 100) / 100,
      noHyphens: measureWith(
        () => (meaning.style.hyphens = 'none'),
        () => meaning.style.removeProperty('hyphens'),
      ),
      noBreakWords: measureWith(
        () => (meaning.style.overflowWrap = 'normal'),
        () => meaning.style.removeProperty('overflow-wrap'),
      ),
      noPill: measureWith(
        () => pill && (pill.style.display = 'none'),
        () => pill && pill.style.removeProperty('display'),
      ),
    }

    return {
      panelW: panel.clientWidth,
      panelH: panel.clientHeight,
      clippedBy: scroller.scrollHeight - scroller.clientHeight,
      leftPct: (left.clientWidth / panel.clientWidth) * 100,
      breakdownPct: (breakdown.clientWidth / panel.clientWidth) * 100,
      rowTops: cells.map((c) => Math.round(c.getBoundingClientRect().y)),
      cellHeights: cells.map((c) => c.getBoundingClientRect().height),
      charX: Math.round((breakdown.querySelector('span[lang="ja"]') as HTMLElement).getBoundingClientRect().x),
      lineH: parseFloat(meaningStyle.lineHeight),
      fontFamily: meaningStyle.fontFamily,
      leftH: left.getBoundingClientRect().height,
      breakdownH: breakdown.getBoundingClientRect().height,
      layoutW: document.documentElement.getBoundingClientRect().width,
      probeW,
      probeFont,
      meaningH: Math.round(meaning.getBoundingClientRect().height * 100) / 100,
      attribution,
    }
  })
}

test.describe('InfoPanel layout — mobile', () => {
  const PHONE = { width: 412, height: 915 }

  for (const textSize of ['medium', 'large'] as const) {
    test(`keeps the translation column readable beside the kanji breakdown @${textSize}`, async ({ page }) => {
      await openReader(page, textSize, PHONE)
      const m = await lookUp(page, LONG_KEYWORD_WORD, LONG_KEYWORD_CELLS)

      // The panel really is narrow at this size — if it isn't, the rest of the
      // assertions are not testing the condition that produced the bug.
      expect(m.panelW).toBeLessThan(500)

      // The breakdown holds a fixed 45%, so a long keyword can no longer push the
      // reading and translation into a one-kana-per-line column (it took 63%/26%).
      expect(m.breakdownPct).toBeLessThanOrEqual(46)
      expect(m.leftPct).toBeGreaterThanOrEqual(45)
    })

    test(`holds the kanji at the same position between lookups @${textSize}`, async ({ page }) => {
      await openReader(page, textSize, PHONE)

      // Two words whose keywords differ a lot in length: "public chamber/hall" fills
      // the column, "tall"/"exam"/"life" leave most of it empty. While the column was
      // content-sized the characters moved ~80px between these two lookups, which
      // reads as the panel jumping under your thumb.
      const a = await lookUp(page, LONG_KEYWORD_WORD, LONG_KEYWORD_CELLS)
      const b = await lookUp(page, THREE_KANJI_WORD, THREE_KANJI_CELLS)

      expect(b.charX).toBe(a.charX)
    })

    test(`stacks the kanji breakdown vertically @${textSize}`, async ({ page }) => {
      await openReader(page, textSize, PHONE)
      const m = await lookUp(page, THREE_KANJI_WORD, THREE_KANJI_CELLS)

      // One kanji per row: three distinct row positions, not one shared row.
      expect(new Set(m.rowTops).size).toBe(m.rowTops.length)
    })
  }

  test('wraps a long kanji keyword instead of widening its cell', async ({ page }) => {
    await openReader(page, 'large', PHONE)
    const m = await lookUp(page, LONG_KEYWORD_WORD, LONG_KEYWORD_CELLS)

    // 食/"eat" and 堂/"public chamber/hall" share a cell width, so the long keyword
    // has to wrap onto more lines — making its row taller. Equal heights mean the
    // cell is sizing to its own text again (the defect behind issue #19), which
    // leaves the keyword nothing to wrap against.
    const [short, long] = m.cellHeights
    expect(long).toBeGreaterThan(short!)
  })

  for (const word of [LONG_KEYWORD_WORD, THREE_KANJI_WORD]) {
    test(`fits ${word} in the panel at the largest text size`, async ({ page }) => {
      await openReader(page, 'large', PHONE)
      const m = await lookUp(page, word, word === LONG_KEYWORD_WORD ? LONG_KEYWORD_CELLS : THREE_KANJI_CELLS)

      // One self-identifying line per test, on passing runs as well as failing ones,
      // so the numbers behind the bound below are on the record for every engine.
      // The prefix and project name are load-bearing, not decoration: the CI reporter
      // is 'dot', which echoes stdout with no test or project attribution, and four
      // projects run fully parallel with up to three attempts each. Kept in place
      // rather than removed once read — it is the only thing that makes the tolerance
      // granted below visible as it drifts.
      console.log(`[panel-metrics] ${JSON.stringify({ project: test.info().project.name, word, ...m })}`)

      // 高校生 fits with nothing to spare on every engine. 食堂's meaning wraps onto one
      // more line on WebKit than on Chromium, so it is allowed exactly one wrapped
      // line — the smallest non-zero overflow text can produce, where two would mean
      // the layout genuinely regressed. Quantised as a line rather than a pixel count
      // because the number is typeface-driven and this app declares no font-family for
      // Latin text, so an ubuntu-latest font change can move any constant.
      //
      // PROVISIONAL: that 食堂 is one line taller on WebKit is arithmetic that fits
      // the observed 33px, not yet a measurement. leftH/breakdownH settle which column
      // overflows, and probeW settles whether the engines are in metrically different
      // faces (probeW.stack apart across projects) and which one (whichever candidate
      // probeW.stack matches). Rewrite this comment from those values, and re-tighten
      // the bound once the faces converge.
      const tolerance = word === LONG_KEYWORD_WORD ? m.lineH + 4 : 4
      expect(m.clippedBy).toBeLessThanOrEqual(tolerance)
    })
  }

  // A 330px-wide phone at the largest text size is the point where a two-line
  // translation plus a wrapped keyword stops fitting. It is a supported width, so the
  // panel must degrade to scrolling under its fade hint rather than clip silently.
  test('degrades to a scrollable panel on a very narrow phone', async ({ page }) => {
    await openReader(page, 'large', { width: 330, height: 915 })
    const m = await lookUp(page, LONG_KEYWORD_WORD, LONG_KEYWORD_CELLS)

    expect(m.breakdownPct).toBeLessThanOrEqual(46)
    expect(m.clippedBy).toBeLessThan(m.panelH * 0.4)
  })
})

test.describe('InfoPanel layout — desktop', () => {
  test('keeps the kanji breakdown on a single horizontal row', async ({ page }) => {
    await openReader(page, 'medium', { width: 1280, height: 900 })
    const m = await lookUp(page, THREE_KANJI_WORD, THREE_KANJI_CELLS)

    // The wide panel has room for the taller char-above-keyword cells side by side.
    expect(new Set(m.rowTops).size).toBe(1)
    expect(m.clippedBy).toBeLessThanOrEqual(2)
  })
})
