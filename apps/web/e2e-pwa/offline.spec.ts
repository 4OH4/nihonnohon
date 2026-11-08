// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Offline behaviour against a production build (se4-2 AC4, FR46, NFR6). Each test gets a
// fresh context, so it installs its own service worker, primes it online, then goes offline.
// Beyond "the page rendered", every test asserts that the data it depends on was served by
// the service worker and that no same-origin request failed or bypassed the worker —
// `setOffline` alone cannot tell where a response came from, and a missing precache entry
// (a font, a chunk) would otherwise go unnoticed.

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UPLOAD_FIXTURE = join(APP_ROOT, 'e2e', 'fixtures', 'valid-optional-absent.json')

interface ManifestEntry {
  id: string
  filename: string
  title: string
}

const manifest = JSON.parse(
  readFileSync(join(APP_ROOT, 'public', 'stories', 'manifest.json'), 'utf-8'),
) as ManifestEntry[]

/** Story opened by scenario (b)/(c); scenario (d) must use a different one. */
const UNSEEN_STORY_ID = 'genki-i-ch1-classroom-introduction'
const DEEP_LINK_STORY_ID = 'genki-i-ch23-ramen-story'

/** The manifest entry for `storyId`, or a clear error if the story was renamed or removed. */
function manifestEntry(storyId: string): ManifestEntry {
  const entry = manifest.find((e) => e.id === storyId)
  if (!entry) throw new Error(`"${storyId}" is not in public/stories/manifest.json; update the offline spec`)
  return entry
}

/** Surface (ruby annotations stripped) of a story's first word that has a vocab entry. */
function firstWordSurface(storyId: string): string {
  const story = JSON.parse(
    readFileSync(join(APP_ROOT, 'public', 'stories', manifestEntry(storyId).filename), 'utf-8'),
  ) as { sentences: { words: string[]; vocab_keys: (number | null)[] }[] }
  const { words, vocab_keys } = story.sentences[0]!
  const index = vocab_keys.findIndex((k) => k !== null)
  if (index === -1) throw new Error(`"${storyId}" has no vocab-keyed word in its first sentence; pick another story`)
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
  // The story cards (with their Japanese titles) render only once the manifest fetch lands, and
  // their font loads start only then. Wait for both: a later reload or navigation would cancel
  // an in-flight font load (net::ERR_ABORTED), which would read as an offline failure.
  await expect(page.locator('a[href^="/read/"]').first()).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/**
 * Goes offline and records, for same-origin requests other than /_vercel/* (which never
 * exists under `vite preview`): failures, error statuses, responses that bypassed the
 * service worker, and the paths the worker did serve. Call `assertServedOffline()` at the
 * end of the scenario.
 */
async function goOffline(page: Page, context: BrowserContext) {
  const origin = new URL(page.url()).origin
  const failed: string[] = []
  const errorStatus: string[] = []
  const notFromSw: string[] = []
  const servedBySw = new Set<string>()

  /** Same-origin pathname of `url`, or null for other origins and /_vercel/*. */
  const trackedPath = (url: string): string | null => {
    const { origin: o, pathname } = new URL(url)
    return o === origin && !pathname.startsWith('/_vercel/') ? pathname : null
  }

  page.on('requestfailed', (req) => {
    const path = trackedPath(req.url())
    if (path) failed.push(`${path} (${req.failure()?.errorText ?? 'unknown'})`)
  })
  page.on('response', (res) => {
    const path = trackedPath(res.url())
    if (!path) return
    if (res.status() >= 400) errorStatus.push(`${path} (${res.status()})`)
    if (res.fromServiceWorker()) servedBySw.add(path)
    else notFromSw.push(path)
  })

  await context.setOffline(true)

  return {
    /**
     * Waits until every path in `expected` has been served by the worker (so late requests,
     * like kanji-data.json after first paint, fall inside the window), then asserts nothing
     * failed, errored or bypassed the worker.
     */
    async assertServedOffline(expected: string[]) {
      await expect
        .poll(() => expected.filter((p) => !servedBySw.has(p)), {
          message: 'expected requests were not served by the service worker',
        })
        .toEqual([])
      expect(failed, 'same-origin requests failed offline (missing from precache?)').toEqual([])
      expect(errorStatus, 'same-origin responses with an error status').toEqual([])
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
    await offline.assertServedOffline(['/', '/stories/manifest.json'])
  })

  // (b) + (c) A story never fetched in this context opens, and lookups work: the story file,
  // vocab.json and kanji-data.json all reach the page for the first time while offline.
  test('opens a never-opened story and looks up a word with kanji breakdown', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    const story = manifestEntry(UNSEEN_STORY_ID)

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
    await offline.assertServedOffline(['/vocab.json', '/kanji-data.json', `/stories/${story.filename}`])
  })

  // (d) A hard navigation to a deep link is answered by the navigation fallback (/index.html).
  test('a hard navigation to /read/<storyId> renders the reader', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    const story = manifestEntry(DEEP_LINK_STORY_ID)

    await page.goto(`/read/${DEEP_LINK_STORY_ID}`)
    await expect(page.getByLabel('Word lookup panel')).toContainText(story.title)
    await expect(page.getByRole('button', { name: firstWordSurface(DEEP_LINK_STORY_ID) }).first()).toBeVisible()
    await offline.assertServedOffline([
      `/read/${DEEP_LINK_STORY_ID}`,
      '/vocab.json',
      '/kanji-data.json',
      '/stories/manifest.json',
      `/stories/${story.filename}`,
    ])
  })

  // (e) Uploaded stories live in IndexedDB, behind the manifest lookup in the reader loader.
  test('a story uploaded while online still opens offline', async ({ page, context }) => {
    // The reader loader starts the kanji-data.json fetch without awaiting it; let it land
    // before navigating, or the navigation cancels it (net::ERR_ABORTED).
    const kanjiLoaded = page.waitForResponse((res) => new URL(res.url()).pathname === '/kanji-data.json')
    await uploadStory(page, UPLOAD_FIXTURE)
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('button', { name: 'こんにちは' })).toBeVisible()
    await kanjiLoaded
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const uploadedUrl = page.url()

    const offline = await goOffline(page, context)
    await page.goto(uploadedUrl)
    await expect(page.getByRole('button', { name: 'こんにちは' })).toBeVisible()
    await offline.assertServedOffline([
      new URL(uploadedUrl).pathname,
      '/vocab.json',
      '/kanji-data.json',
      '/stories/manifest.json',
    ])
  })

  // (f) Opening a precached data file directly returns the file, not the SPA shell: the
  // precache route is registered before the navigation fallback (se4-1 deferred item).
  test('a hard navigation to a precached JSON file returns the file', async ({ page, context }) => {
    const offline = await goOffline(page, context)
    const storyPath = `/stories/${manifestEntry(DEEP_LINK_STORY_ID).filename}`

    for (const path of ['/vocab.json', storyPath]) {
      const res = await page.goto(path)
      expect(res, `no response for ${path}`).not.toBeNull()
      const text = await res!.text()
      expect(res!.headers()['content-type'], `${path} content type`).toContain('application/json')
      // The shell would be HTML; the file parses as JSON.
      expect(() => JSON.parse(text), `${path} body is not JSON`).not.toThrow()
    }
    await offline.assertServedOffline(['/vocab.json', storyPath])
  })
})
