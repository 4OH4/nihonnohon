// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// A real service worker update (se4-3 AC2/AC3, FR47). Playwright cannot route requests for an
// updated service worker main script (microsoft/playwright#14711), so this spec serves its own
// copy of the production build on port 4175 and publishes an "update" by changing that copy's
// sw.js. The 4173 preview the other e2e-pwa specs use is never touched.

import { test, expect, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** Built by the config's webServer (`vite build`) before any spec runs. */
const DIST = join(APP_ROOT, 'dist')
const PORT = 4175
const ORIGIN = `http://localhost:${PORT}`

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

// The tests share one server and one copy of the build.
test.describe.configure({ mode: 'serial' })

let root: string
let server: Server

// ─── static server over a disposable copy of dist/ ───────────────────────────

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'nihonnohon-update-'))
  cpSync(DIST, root, { recursive: true })

  server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', ORIGIN).pathname)
    const file = normalize(join(root, pathname === '/' ? 'index.html' : pathname))
    // Only `/` is ever navigated, so there is no SPA fallback: anything missing is a 404.
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    const headers: Record<string, string> = {
      'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    }
    // As vercel.json does in production: the browser must revalidate sw.js on every check.
    if (pathname === '/sw.js') headers['Cache-Control'] = 'no-cache'
    res.writeHead(200, headers).end(readFileSync(file))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, 'localhost', resolve)
  })
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  if (root) rmSync(root, { recursive: true, force: true })
})

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Loads `/`, waits for the worker to activate, then reloads so it controls the page. */
async function primeServiceWorker(page: Page) {
  await page.goto(`${ORIGIN}/`)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Prompt mode has no clientsClaim, so the first load is never controlled — only a reload is.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Let the cards and their font loads settle so a later reload does not abort them.
  await expect(page.locator('a[href^="/read/"]').first()).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/** Publishes a new service worker: different bytes, identical precache revisions. */
function publishUpdate() {
  appendFileSync(join(root, 'sw.js'), `\n// update ${Date.now()}\n`)
}

/** Whether the page's registration has a worker waiting to activate. */
function hasWaitingWorker(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return !!registration?.waiting
  })
}

// ─── tests ───────────────────────────────────────────────────────────────────

test('a new service worker shows the toast; Reload activates it with exactly one reload', async ({ page }) => {
  await primeServiceWorker(page)
  const status = page.getByRole('status')
  // No update yet: the toast must not be showing.
  await expect(status).toBeEmpty()
  expect(await hasWaitingWorker(page)).toBe(false)

  // A navigation makes the browser check sw.js, find the new bytes and install the new worker.
  publishUpdate()
  await page.reload()
  await expect(status).toContainText('New version available', { timeout: 15_000 })
  expect(await hasWaitingWorker(page)).toBe(true)

  // Reload → SKIP_WAITING → the new worker takes control → vite-plugin-pwa reloads once.
  let loads = 0
  page.on('load', () => loads++)
  const loaded = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Reload' }).click()
  await loaded
  // Give a second (unwanted) reload time to happen before counting.
  await page.waitForTimeout(2_000)
  expect(loads).toBe(1)

  await expect(status).toBeEmpty()
  expect(await hasWaitingWorker(page)).toBe(false)
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated')
})

test('a dismissed toast returns on the next launch while the worker is still waiting', async ({ page }) => {
  await primeServiceWorker(page)
  const status = page.getByRole('status')
  await expect(status).toBeEmpty()

  publishUpdate()
  await page.reload()
  await expect(status).toContainText('New version available', { timeout: 15_000 })

  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(status).toBeEmpty()

  // The dismiss lives in memory only; the still-waiting worker brings the toast back.
  await page.reload()
  await expect(status).toContainText('New version available', { timeout: 15_000 })
  expect(await hasWaitingWorker(page)).toBe(true)
})
