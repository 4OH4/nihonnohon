import { test, expect } from '@playwright/test'

// Runs on all 4 projects (chromium, firefox, webkit, mobile-safari / iPhone 14)
// via playwright.config.ts project configuration.

test.describe('Golden path', () => {
  test('library → reader → word lookup → back to library', async ({ page }) => {
    // 1. Library loads with the built-in story
    await page.goto('/')
    await expect(page.getByText('A Letter from Mary')).toBeVisible()

    // 2. Click story card → reader route loads
    await page.getByText('A Letter from Mary').click()
    await expect(page).toHaveURL(/\/read\/genki-i-ch6-tanaka-letter/)

    // 3. Story sentences are visible
    await expect(page.getByRole('button', { name: 'はじめまして' })).toBeVisible()

    // 4. Tap a word with a vocab entry — 起きます (vocab_key 176)
    await page.getByRole('button', { name: '起きます' }).click()

    // 5. InfoPanel has moved out of idle state — story title no longer fills the panel
    const infoPanel = page.getByLabel('Word lookup panel')
    await expect(infoPanel).toBeVisible()
    await expect(infoPanel).not.toContainText('A Letter from Mary')

    // 6. Tap a second word
    await page.getByRole('button', { name: 'はじめまして' }).click()
    await expect(infoPanel).toBeVisible()
    await expect(infoPanel).not.toContainText('起きます')

    // 7. Navigate back to library
    await page.getByRole('link', { name: 'Back to library' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('A Letter from Mary')).toBeVisible()
  })
})
