// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Offline behaviour against a production build (se4-2 AC4, FR46, NFR6). Each test gets a
// fresh context, so it installs its own service worker, primes it online, then goes offline.
// Beyond "the page rendered", every test asserts that the data came from the service worker
// and that no same-origin request failed — `setOffline` alone cannot tell where a response
// came from, and a missing precache entry (a font, a chunk) would otherwise go unnoticed.

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UPLOAD_FIXTURE = join(APP_ROOT, 'e2e', 'fixtures', 'valid-optional-absent.json')

interface ManifestEntry {
  id: string
  title: string
}

const manifest = JSON.parse(
  readFileSync(join(APP_ROOT, 'public', 'stories', 'manifest.json'), 'utf-8'),
) as ManifestEntry[]

/** Story opened by scenario (b)/(c); scenario (d) must use a different one. */
const UNSEEN_STORY_ID = 'genki-i-ch1-classroom-introduction'
const DEEP_LINK_STORY_ID = 'genki-i-ch23-ramen-story'

/** Surface (ruby annotations stripped) of a story's first word that has a vocab entry. */
function firstWordSurface(storyId: string): string {
  const story = JSON.parse(
    readFileSync(join(APP_ROOT, 'public', 'stories', `${storyId}.json`), 'utf-8'),
  ) as { sentences: { words: string[]; vocab_keys: (number | null)[] }[] }
  const { words, vocab_keys } = story.sentences[0]!
  const index = vocab_keys.findIndex((k) => k !== null)
  return words[index]!.replace(/\[[^\]]*\]/g, '')
}

/** Loads `/` online, waits for the SW to activate (precache complete), then reloads so it controls the page. */
async function primeServiceWorker(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Prompt mode has no clientsClaim, so the first load is never controlled — only a reload is.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Let font loads settle first: a reload or navigation cancels in-flight ones (net::ERR_ABORTED),
  // which would read as an offline failure.
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/**
 * Goes offline and records same-origin request failures (other than /_vercel/*, which never
 * exists under `vite preview`) and data responses that bypassed the service worker.
 * Call `assertServedOffline()` at the end of the scenario.
 */
async function goOffline(page: Page, context: BrowserContext) {
  const origin = new URL(page.url()).origin
  const failed: string[] = []
  const notFromSw: string[] = []

  page.on('requestfailed', (req) => {
    const url = new URL(req.url())
    if (url.origin === origin && !url.pathname.startsWith('/_vercel/')) {
      failed.push(`${url.pathname} (${req.failure()?.errorText ?? 'unknown'})`)
    }
  })
  page.on('response', (res) => {
    const url = new URL(res.url())
    if (url.origin !== origin) return
    const isData =
      /^\/(vocab|kanji-data)\.json$|^\/stories\//.test(url.pathname) || res.request().isNavigationRequest()
    if (isData && !res.fromServiceWorker()) notFromSw.push(url.pathname)
  })

  await context.setOffline(true)

  return {
    assertServedOffline() {
      expect(failed, 'same-origin requests failed offline (missing from precache?)').toEqual([])
      expect(notFromSw, 'responses that bypassed the service worker').toEqual([])
    },
  }
}

/** Uploads a story file through the library's file chooser. */
async function uploadStory(page: Page, path: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Load a story from your device' }).click(),
  ])
  await chooser.setFiles(path)
}

test.describe('Offline (service worker)', () => {
  test.beforeEach(async ({ page }) => {
    await primeServiceWorker(page)
  })

  // (a) Reload with no network: the shell, fonts and story manifest come from the precache.
  test('reloading the library lists every story', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    await page.reload()

    await expect(page.locator('a[href^="/read/"]')).toHaveCount(manifest.length)
    await expect(page.getByText(manifest[0]!.title).first()).toBeVisible()
    offline.assertServedOffline()
  })

  // (b) + (c) A story never fetched in this context opens, and lookups work: the story file,
  // vocab.json and kanji-data.json all reach the page for the first time while offline.
  test('opens a never-opened story and looks up a word with kanji breakdown', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    const story = manifest.find((e) => e.id === UNSEEN_STORY_ID)!

    await page.getByText(story.title).click()
    await expect(page).toHaveURL(new RegExp(`/read/${UNSEEN_STORY_ID}`))
    await expect(page.getByRole('button', { name: '学生' }).first()).toBeVisible()

    await page.getByRole('button', { name: '学生' }).first().click()
    const infoPanel = page.getByLabel('Word lookup panel')
    await expect(infoPanel).toContainText('student')

    // Kanji data loads after first paint, so rely on auto-retrying assertions.
    const breakdown = page.getByLabel('Kanji breakdown')
    await expect(breakdown.locator('> div')).toHaveCount(2)
    await expect(breakdown).toContainText('study')
    await expect(breakdown).toContainText('life')
    offline.assertServedOffline()
  })

  // (d) A hard navigation to a deep link is answered by the navigation fallback (/index.html).
  test('a hard navigation to /read/<storyId> renders the reader', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    const story = manifest.find((e) => e.id === DEEP_LINK_STORY_ID)!

    await page.goto(`/read/${DEEP_LINK_STORY_ID}`)
    await expect(page.getByLabel('Word lookup panel')).toContainText(story.title)
    await expect(page.getByRole('button', { name: firstWordSurface(DEEP_LINK_STORY_ID) }).first()).toBeVisible()
    offline.assertServedOffline()
  })

  // (e) Uploaded stories live in IndexedDB, behind the manifest lookup in the reader loader.
  test('a story uploaded while online still opens offline', async ({ page, context }) => {
    await uploadStory(page, UPLOAD_FIXTURE)
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}$/)
    const uploadedUrl = page.url()

    const offline = await goOffline(page, context)
    await page.goto(uploadedUrl)
    await expect(page.getByRole('button', { name: 'こんにちは' })).toBeVisible()
    offline.assertServedOffline()
  })
})
