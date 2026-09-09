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
import { useCssViewport } from './cssViewport'

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

    return {
      panelW: panel.clientWidth,
      panelH: panel.clientHeight,
      clippedBy: scroller.scrollHeight - scroller.clientHeight,
      leftPct: (left.clientWidth / panel.clientWidth) * 100,
      breakdownPct: (breakdown.clientWidth / panel.clientWidth) * 100,
      rowTops: cells.map((c) => Math.round(c.getBoundingClientRect().y)),
      cellHeights: cells.map((c) => c.getBoundingClientRect().height),
      charX: Math.round((breakdown.querySelector('span[lang="ja"]') as HTMLElement).getBoundingClientRect().x),
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

      // Both words fit exactly, on every engine, once the viewport really is 412px
      // wide — before the fix this same lookup overflowed by ~190px, more than the
      // panel's own height. A few pixels of slack absorbs sub-pixel line rounding.
      expect(m.clippedBy).toBeLessThanOrEqual(4)
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
