import { test, expect } from '@playwright/test'

test.describe('Error states', () => {
  test('manifest fetch failure — LibraryError with retry button', async ({ page }) => {
    await page.route('**/manifest.json', route => route.abort())
    await page.goto('/')
    await expect(page.getByText("Couldn't load the story library.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('story ID not in manifest and not in IndexedDB — error message with library link', async ({ page }) => {
    // The loader tries manifest then IndexedDB; if both miss it throws 410.
    // ReaderError maps 410 → "not available on this device" (same path as UUID miss).
    await page.goto('/read/this-story-does-not-exist')
    await expect(page.getByText('not available on this device', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: '← Back to library' })).toBeVisible()
  })

  test('UUID not in IndexedDB — "not available on this device"', async ({ page }) => {
    await page.goto('/read/00000000-0000-0000-0000-000000000000')
    await expect(page.getByText('not available on this device', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: '← Back to library' })).toBeVisible()
  })
})
