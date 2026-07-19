// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test'
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

test.describe('Visual regression snapshots', () => {
  test('Ruby toggle off', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Ruby' }).click()
    await page.keyboard.press('Escape')
    expect(await page.getByRole('group', { name: 'Sentence 1', exact: true }).screenshot({ animations: 'disabled' })).toMatchSnapshot('ruby-off.png')
  })

  test('Ruby toggle on', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Ruby is on by default
    expect(await page.getByRole('group', { name: 'Sentence 1', exact: true }).screenshot({ animations: 'disabled' })).toMatchSnapshot('ruby-on.png')
  })

  test('Trans toggle on', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Trans.' }).click()
    await page.keyboard.press('Escape')
    expect(await page.getByRole('group', { name: 'Sentence 1', exact: true }).screenshot({ animations: 'disabled' })).toMatchSnapshot('trans-on.png')
  })

  test('Trans toggle off', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Trans is off by default
    expect(await page.getByRole('group', { name: 'Sentence 1', exact: true }).screenshot({ animations: 'disabled' })).toMatchSnapshot('trans-off.png')
  })

  test('SettingsMenu Spaces toggle on', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Spaces' }).click()
    await page.keyboard.press('Escape')
    expect(await page.getByRole('group', { name: 'Sentence 1', exact: true }).screenshot({ animations: 'disabled' })).toMatchSnapshot('spaces-on.png')
  })

  test('SettingsMenu Spaces toggle off', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Spaces is off by default
    await page.getByRole('button', { name: 'Settings' }).click()
    expect(await page.locator('[data-radix-popper-content-wrapper]').screenshot({ animations: 'disabled' })).toMatchSnapshot('settings-spaces-off.png')
    await page.keyboard.press('Escape')
  })

  test('InfoPanel idle state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    expect(await page.getByLabel('Word lookup panel').screenshot({ animations: 'disabled' })).toMatchSnapshot('infopanel-idle.png')
  })

  test('InfoPanel found state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    await page.getByRole('button', { name: '起きます' }).click()
    expect(await page.getByLabel('Word lookup panel').screenshot({ animations: 'disabled' })).toMatchSnapshot('infopanel-found.png')
  })

  test('InfoPanel not-found state', async ({ page }) => {
    await page.goto('/read/genki-i-ch6-tanaka-letter')
    // Tap a word with no vocab entry — punctuation has null vocabKey
    await page.getByRole('button', { name: '、' }).first().click()
    expect(await page.getByLabel('Word lookup panel').screenshot({ animations: 'disabled' })).toMatchSnapshot('infopanel-not-found.png')
  })
})
