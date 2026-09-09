// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Line-breaking invariants for the reader — issue #23.
//
// Punctuation is a separate token in the story data, and the reader lays a sentence
// out as flex items (one per token), so the browser's Japanese line-breaking rules
// (禁則処理) never apply: a sentence-final 。 was free to wrap onto a line by itself.
// SentenceBlock groups tokens that must not be split into a single flex item.
//
// This is measured, not snapshotted: the failure is purely geometric (which line a
// token lands on) and only appears at phone widths, where a jsdom unit test has no
// layout at all and a desktop pixel baseline never wraps in the first place.

import { test, expect, type Page } from '@playwright/test'
import { useCssViewport } from './cssViewport'

// The dialogue-heavy story — the widest variety of punctuation tokens in the corpus:
// bare 。 and 、, closing 。」, and the combined 。「 that both closes and opens.
const STORY = '/read/genki-i-ch23-ramen-story'

/** Characters that may never begin a line (行頭禁則). */
const NO_LINE_START = '。、，．・：；？！)]}）］｝〉》」』】〕…～ー'

interface Break {
  sentence: string
  previous: string
  token: string
}

/**
 * Returns every line the reader started with a character that may not begin one.
 *
 * Line membership is read from each token's box *bottom*, not its top: tokens are
 * baseline-aligned and a ruby annotation adds height above the text, so two tokens
 * on the same line have tops that differ by the height of a reading.
 */
async function findOrphans(page: Page): Promise<Break[]> {
  return page.evaluate((noStart) => {
    const orphans: Break[] = []
    for (const group of document.querySelectorAll('[role="group"]')) {
      const boxes = [...group.querySelectorAll('[role="button"]')].map((el) => ({
        label: el.getAttribute('aria-label') ?? '',
        rect: el.getBoundingClientRect(),
      }))
      for (let i = 1; i < boxes.length; i++) {
        if (Math.abs(boxes[i].rect.bottom - boxes[i - 1].rect.bottom) <= 1) continue
        if (!noStart.includes(boxes[i].label[0] ?? '')) continue
        orphans.push({
          sentence: group.getAttribute('aria-label') ?? '',
          previous: boxes[i - 1].label,
          token: boxes[i].label,
        })
      }
    }
    return orphans
  }, NO_LINE_START) as Promise<Break[]>
}

test.describe('Reader line breaking', () => {
  // 320px is the narrowest phone the app targets — the most wrap opportunities, and
  // the width at which a group that is too wide to fit would overflow the page.
  for (const width of [320, 412]) {
    test(`never strands punctuation on its own line at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(STORY)
      await page.getByRole('group').first().waitFor()
      await useCssViewport(page, width, 900)

      expect(await findOrphans(page)).toEqual([])
    })
  }

  // Grouping makes a flex item as wide as every token it binds together, so an
  // over-eager rule can build a run too wide for the screen — an earlier draft
  // chained word + 。「 + word and pushed 54px off the side of a 320px phone.
  //
  // The invariant is not "nothing ever overflows": a single token can be longer than
  // the line on its own (掃除しなければいけませんでした does at 320px) and no grouping
  // rule can help that. What must hold is that grouping never *causes* the overflow.
  for (const story of ['/read/genki-i-ch23-ramen-story', '/read/genki-i-ch14-first-part-time-job']) {
    test(`only overflows where a single token already does — ${story.split('-').slice(-2).join('-')}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 })
      await page.goto(story)
      await page.getByRole('group').first().waitFor()
      await useCssViewport(page, 320, 900)

      const caused = await page.evaluate(() => {
        const bad: string[] = []
        for (const group of document.querySelectorAll('[role="group"]')) {
          const style = getComputedStyle(group)
          const content =
            group.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          // Only the wrappers this fix adds — a lone token is itself a direct child
          // span, and carries role="button".
          for (const run of group.querySelectorAll(':scope > span:not([role="button"])')) {
            if (run.getBoundingClientRect().width <= content + 1) continue
            const widest = Math.max(
              ...[...run.querySelectorAll('[role="button"]')].map(
                (t) => t.getBoundingClientRect().width
              )
            )
            if (widest <= content + 1) bad.push(`${group.getAttribute('aria-label')}: ${run.textContent}`)
          }
        }
        return bad
      })
      expect(caused).toEqual([])
    })
  }

  test('holds punctuation together with word spacing turned on', async ({ page }) => {
    // Spacing mode widens the gap between every token, changing where each line
    // breaks. Seeded through the persisted preference rather than the settings menu:
    // this test is about the resulting layout, and driving the menu here would make
    // it fail for reasons that have nothing to do with line breaking.
    await page.addInitScript(() => {
      localStorage.setItem(
        'nihonnohon-preferences',
        JSON.stringify({ state: { spacingVisible: true }, version: 0 })
      )
    })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(STORY)
    await page.getByRole('group').first().waitFor()
    await useCssViewport(page, 320, 900)

    // Guard the seed: if the persisted shape ever changes this must fail loudly
    // rather than silently re-run the spacing-off case.
    const gap = await page
      .getByRole('group')
      .first()
      .evaluate((el) => getComputedStyle(el).columnGap)
    expect(gap).not.toBe('0px')

    expect(await findOrphans(page)).toEqual([])
  })
})
