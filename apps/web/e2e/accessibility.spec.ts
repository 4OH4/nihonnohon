// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { test, expect, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Scope axe to WCAG 2.0/2.1 A and AA rules — the standard for production accessibility compliance.
// Best-practice rules (e.g. page-has-heading-one, landmark-one-main) are excluded from this suite;
// they are addressed as structural improvements in later iterations.
const axe = (page: Parameters<typeof AxeBuilder>[0]['page']) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])

test.describe('Accessibility — axe-core WCAG 2.1 AA', () => {
  test('library view has no WCAG violations', async ({ page }) => {
    await page.goto('/')
    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })

  test('reader — idle InfoPanel has no WCAG violations', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })

  test('reader — found InfoPanel (after word tap) has no WCAG violations', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: '起きます' }).click()
    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })

  test('reader — vocabulary panel has no WCAG violations', async ({ page }) => {
    // Mobile viewport so the tab bar (lg:hidden) is visible and clickable
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('tab', { name: 'Vocabulary' }).click()
    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })

  test('reader — grammar panel has no WCAG violations', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('tab', { name: 'Grammar' }).click()
    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })
})

/**
 * Screenshots `target`, but only once webfonts have settled.
 *
 * Every baseline here is text and seven of the nine are Japanese, which is a
 * webfont. A capture taken mid-swap encodes a system fallback instead — and since
 * CI regenerates and commits baselines on mismatch, one slow font load could
 * otherwise rewrite a committed baseline to the wrong typeface, after which
 * nothing downstream can tell. Self-hosting the face made that unlikely; waiting
 * makes it impossible.
 */
/**
 * Seeds the ruby preference before first paint.
 *
 * These baselines used to rely on the store default, which silently made `ruby-on.png` a
 * picture of whatever the default happened to be — so changing the default (to 'supplement',
 * issue #33) would have quietly repointed the baseline instead of failing. Seeding pins each
 * snapshot to the mode it is named for.
 */
async function seedRubyMode(page: Page, rubyMode: 'all' | 'supplement' | 'none') {
  await page.addInitScript((mode) => {
    localStorage.setItem(
      'nihonnohon-preferences',
      JSON.stringify({
        state: { rubyMode: mode, spacingVisible: false, transVisible: false, textSize: 'medium', activeTab: 'story' },
        version: 0,
      }),
    )
  }, rubyMode)
}

async function snapshot(page: Page, target: Locator, name: string) {
  await page.evaluate(() => document.fonts.ready)
  expect(await target.screenshot({ animations: 'disabled' })).toMatchSnapshot(name)
}

test.describe('Visual regression snapshots', () => {
  // Baselines are generated and maintained on CI (ubuntu), and only linux ones are
  // committed. They cannot be reproduced faithfully elsewhere:
  //
  //  - WebKit on Windows lays the page out at the host's display-scaling factor
  //    rather than the requested viewport (a 412px viewport becomes 330 CSS px at
  //    125%, and deviceScaleFactor does not override it), so its captures encode the
  //    developer's monitor settings.
  //  - Font rasterisation and hinting differ per OS, well beyond the 2% diff ratio.
  //
  // Without this guard a Windows or macOS run does one of two unhelpful things:
  // fails against CI's baselines, or — for any name with no local baseline yet —
  // silently writes one and reports a first-run failure, leaving untracked PNGs that
  // get committed by accident. Skip instead; CI is where these assert anything.
  test.skip(process.platform !== 'linux', 'Pixel baselines are linux-only — these run on CI')

  test('Ruby off', async ({ page }) => {
    await seedRubyMode(page, 'none')
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await snapshot(page, page.getByRole('group', { name: 'Sentence 1', exact: true }), 'ruby-off.png')
  })

  test('Ruby on all words', async ({ page }) => {
    await seedRubyMode(page, 'all')
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await snapshot(page, page.getByRole('group', { name: 'Sentence 1', exact: true }), 'ruby-on.png')
  })

  test('Trans toggle on', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Trans.' }).click()
    await page.keyboard.press('Escape')
    await snapshot(page, page.getByRole('group', { name: 'Sentence 1', exact: true }), 'trans-on.png')
  })

  test('Trans toggle off', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Trans is off by default
    await snapshot(page, page.getByRole('group', { name: 'Sentence 1', exact: true }), 'trans-off.png')
  })

  test('SettingsMenu Spaces toggle on', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Spaces' }).click()
    await page.keyboard.press('Escape')
    await snapshot(page, page.getByRole('group', { name: 'Sentence 1', exact: true }), 'spaces-on.png')
  })

  test('SettingsMenu Spaces toggle off', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Spaces is off by default
    await page.getByRole('button', { name: 'Settings' }).click()
    await snapshot(page, page.locator('[data-radix-popper-content-wrapper]'), 'settings-spaces-off.png')
    await page.keyboard.press('Escape')
  })

  test('InfoPanel idle state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await snapshot(page, page.getByLabel('Word lookup panel'), 'infopanel-idle.png')
  })

  test('InfoPanel found state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: '起きます' }).click()
    // kanji-data.json loads off the critical path, so the breakdown can appear a
    // beat after the lookup — wait for it, or the snapshot races the fetch.
    await page.getByLabel('Kanji breakdown').waitFor()
    await snapshot(page, page.getByLabel('Word lookup panel'), 'infopanel-found.png')
  })

  test('InfoPanel not-found state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Tap a word with no vocab entry — punctuation has null vocabKey
    await page.getByRole('button', { name: '、' }).first().click()
    await snapshot(page, page.getByLabel('Word lookup panel'), 'infopanel-not-found.png')
  })
})
