// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Update toast and install link (se4-3, FR45/FR47) on the `vite` dev server. There is no
// service worker here, so the toast is forced through the dev-only window.__PWA_STORE__
// hook, and the install link through a synthetic beforeinstallprompt event, which reaches
// the real listener registered by initInstallPrompt(). The real update flow is covered by
// e2e-pwa/update.spec.ts.

import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const STORY = '/read/genki-i-ch6-tanaka-letter'
const UPLOAD = { name: 'Load a story from your device' }

const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])

/** The store's surface as seen from the page (typed locally: e2e/ is outside the app's tsconfig). */
interface PwaStoreHook {
  getState(): {
    setNeedRefresh(v: boolean): void
    setUpdateServiceWorker(fn: () => Promise<void>): void
  }
}
type HookWindow = Window & { __PWA_STORE__?: PwaStoreHook; __updateCalls?: number; __prompted?: boolean }

/** Shows the update toast by driving the store, as a waiting service worker would. */
async function forceUpdateToast(page: Page) {
  await page.evaluate(() => (window as HookWindow).__PWA_STORE__!.getState().setNeedRefresh(true))
}

/** Dispatches a Chromium-style beforeinstallprompt that records when prompt() is called. */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        ;(window as HookWindow).__prompted = true
      },
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
    })
    window.dispatchEvent(event)
  })
}

/** Opens the library and waits for the story cards (the manifest fetch has landed). */
async function openLibrary(page: Page) {
  await page.goto('/')
  await expect(page.locator('a[href^="/read/"]').first()).toBeVisible()
}

// ─── update toast ────────────────────────────────────────────────────────────

test.describe('Update toast', () => {
  test('appears when an update is waiting, passes axe, and Dismiss hides it', async ({ page }) => {
    await page.goto(STORY)
    const status = page.getByRole('status')
    await expect(status).toBeEmpty()

    await forceUpdateToast(page)
    await expect(status).toContainText('New version available')
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()

    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])

    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(status).toBeEmpty()
  })

  test('sits above the mobile tab bar at 412px and is keyboard operable', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto(STORY)
    await forceUpdateToast(page)

    const reload = page.getByRole('button', { name: 'Reload' })
    const dismiss = page.getByRole('button', { name: 'Dismiss' })
    await expect(reload).toBeVisible()

    // The toast never takes focus on its own.
    expect(await reload.evaluate((el) => el === document.activeElement)).toBe(false)

    // Both boxes come from the same layout, so display scaling cannot skew the comparison.
    const toast = page.getByRole('status').locator('> div')
    const toastBox = (await toast.boundingBox())!
    const tabBarBox = (await page.getByRole('tablist', { name: 'Content tabs' }).boundingBox())!
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(tabBarBox.y)

    // Story text beside the toast still takes the tap: the full-width layer is click-through.
    const layer = page.getByRole('status').locator('..')
    expect(await layer.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')

    // Keyboard: the toast follows the tab bar in tab order.
    await page.getByRole('tab').last().focus()
    await page.keyboard.press('Tab')
    await expect(reload).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dismiss).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toBeEmpty()
  })

  test('a double tap on Reload calls the update handle once and disables the button', async ({ page }) => {
    await page.goto(STORY)
    // No worker in dev: inject a stub handle that counts calls instead of reloading.
    await page.evaluate(() => {
      const w = window as HookWindow
      w.__PWA_STORE__!.getState().setUpdateServiceWorker(async () => {
        w.__updateCalls = (w.__updateCalls ?? 0) + 1
      })
    })
    await forceUpdateToast(page)

    const reload = page.getByRole('button', { name: 'Reload' })
    await reload.dblclick()

    await expect(reload).toBeDisabled()
    expect(await page.evaluate(() => (window as HookWindow).__updateCalls)).toBe(1)
  })
})

// ─── install link ────────────────────────────────────────────────────────────

test.describe('Install link', () => {
  test('a deferred install prompt shows "Install app" above the upload link; it prompts and hides', async ({ page }) => {
    await openLibrary(page)
    await offerInstall(page)

    const install = page.getByRole('button', { name: 'Install app' })
    await expect(install).toBeVisible()
    // In mobile-safari the deferred event replaces the iOS link (selectInstallOption).
    await expect(page.getByRole('button', { name: 'Add to Home Screen' })).toHaveCount(0)

    const installBox = (await install.boundingBox())!
    const uploadBox = (await page.getByRole('button', UPLOAD).boundingBox())!
    expect(installBox.y + installBox.height).toBeLessThanOrEqual(uploadBox.y)

    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])

    await install.click()
    await expect.poll(() => page.evaluate(() => (window as HookWindow).__prompted)).toBe(true)
    await expect(install).toHaveCount(0)
    await expect(page.getByRole('button', UPLOAD)).toBeVisible()
  })

  test('iOS: "Add to Home Screen" reveals the instruction', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-safari', 'iPhone user agent only')
    await openLibrary(page)

    const link = page.getByRole('button', { name: 'Add to Home Screen' })
    await expect(link).toBeVisible()
    const linkBox = (await link.boundingBox())!
    const uploadBox = (await page.getByRole('button', UPLOAD).boundingBox())!
    expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(uploadBox.y)

    await expect(link).toHaveAttribute('aria-expanded', 'false')
    await link.click()
    await expect(link).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Tap Share, then Add to Home Screen')).toBeVisible()

    const results = await axe(page).analyze()
    expect(results.violations).toEqual([])
  })

  test('desktop Chromium without an install prompt: no install link, and none in the reader settings', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'non-iOS browser with no synthetic event')
    await openLibrary(page)
    await expect(page.getByRole('button', UPLOAD)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add to Home Screen' })).toHaveCount(0)

    // RT decision: the reading interface carries no install item, even when install is offered.
    await page.goto(STORY)
    await offerInstall(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()
    await expect(menu).not.toContainText('Install')
    await expect(menu).not.toContainText('Home Screen')
  })
})
