// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Guards the self-hosted Japanese webfont.
//
// Noto Sans JP used to be fetched from Google Fonts at runtime. Two things can go
// wrong quietly once it is served from our own origin, and neither announces itself:
//
//  - The face fails to load and the app renders Japanese in a system fallback. It
//    looks merely "a bit off" to a reader, and the pixel-snapshot suite will happily
//    regenerate its baselines against that fallback and commit them, after which
//    nothing downstream can tell the difference.
//  - The third-party <link> comes back, reintroducing the CDN dependency, the
//    offline failure mode and the IP disclosure that removing it addressed.
//
// These assert the font is really loaded, really ours, and really applied.

import { test, expect } from '@playwright/test'

const STORY = '/read/genki-i-ch6-tanaka-letter'
const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

// The weights the app renders Japanese at: 400 throughout, 600 for the looked-up
// word in InfoPanel. Kept in step with the imports in main.tsx.
const JA_WEIGHTS = [400, 600] as const

test.describe('Japanese webfont', () => {
  test('serves Noto Sans JP from our own origin, not a third party', async ({ page }) => {
    const thirdParty: string[] = []
    page.on('request', (r) => {
      if (GOOGLE_FONTS.test(r.url())) thirdParty.push(r.url())
    })

    await page.goto(STORY)
    await expect(page.locator('[lang="ja"]').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    expect(thirdParty).toEqual([])
  })

  test('renders the story in the webfont, not a fallback', async ({ page }) => {
    await page.goto(STORY)
    await expect(page.locator('[lang="ja"]').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    // No explicit load() here on purpose: this asserts the weight the story body
    // renders at was fetched and used just by visiting the page. If the face were
    // missing this is false while the page still looks plausible — which is the
    // state that would otherwise get baked into regenerated pixel baselines.
    //
    // The sample text is not optional either. The face is split by unicode-range,
    // so check() without it can be satisfied by the latin subset alone and pass
    // while every kanji on the page is in a fallback.
    const inUse = await page.evaluate(() => document.fonts.check('400 16px "Noto Sans JP"', '食堂'))
    expect(inUse, 'story body should be rendering in Noto Sans JP').toBe(true)
  })

  test('serves every weight the app declares', async ({ page }) => {
    await page.goto(STORY)
    await expect(page.locator('[lang="ja"]').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    // 600 is only rendered once a word is looked up, and unicode-range faces are
    // fetched on demand, so it is legitimately absent on first paint. load() asks
    // for it explicitly: it resolves to the matching faces if they are served and
    // to nothing if they are not, which is the availability question that matters.
    for (const weight of JA_WEIGHTS) {
      const matched = await page.evaluate(
        (w) => document.fonts.load(`${w} 16px "Noto Sans JP"`, '食堂').then((f) => f.length),
        weight,
      )
      expect(matched, `Noto Sans JP ${weight} should be served for kanji`).toBeGreaterThan(0)

      const loaded = await page.evaluate(
        (w) => document.fonts.check(`${w} 16px "Noto Sans JP"`, '食堂'),
        weight,
      )
      expect(loaded, `Noto Sans JP ${weight} should be usable after loading`).toBe(true)
    }
  })

  test('applies the font-ja stack to Japanese text', async ({ page }) => {
    await page.goto(STORY)
    const ja = page.locator('[lang="ja"]').first()
    await expect(ja).toBeVisible()

    // getComputedStyle reports the *declared* family list, not the face the engine
    // resolved — so this checks that the font-ja class and the Tailwind `ja` stack
    // are wired up, and the test above checks that the face behind it exists. The
    // two together are what make "the text is in Noto Sans JP" a real assertion.
    const family = await ja.evaluate((el) => getComputedStyle(el).fontFamily)
    expect(family).toMatch(/^["']?Noto Sans JP["']?,/)
  })
})
