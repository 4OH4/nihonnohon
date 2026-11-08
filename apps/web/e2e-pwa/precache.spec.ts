// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Build-output checks for the Workbox precache (se4-2 AC2). No `page` fixture is used,
// so no browser launches: these read dist/sw.js, which the config's webServer has just
// built. Every bundled story must be offline after the first visit (FR46, NFR6), and the
// default precache — which every visitor downloads — must stay within its 10 MB budget.

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(APP_ROOT, 'dist')
const PUBLIC_STORIES = join(APP_ROOT, 'public', 'stories')

/** Default-precache budget from ADR 007, in bytes (10 MB, decimal). */
const PRECACHE_BUDGET_BYTES = 10_000_000

interface PrecacheEntry {
  url: string
  revision: string | null
}

/** Extracts the `precacheAndRoute([...])` entries from the minified sw.js (unquoted keys, so not JSON). */
function readPrecacheEntries(sw: string): PrecacheEntry[] {
  const start = sw.indexOf('precacheAndRoute([')
  if (start === -1) return []
  const end = sw.indexOf('}]', start)
  const list = sw.slice(start, end + 2)
  return [...list.matchAll(/url:"([^"]+)",revision:(?:"([^"]+)"|null)/g)].map((m) => ({
    url: m[1]!,
    revision: m[2] ?? null,
  }))
}

const sw = readFileSync(join(DIST, 'sw.js'), 'utf-8')
const entries = readPrecacheEntries(sw)
const urls = new Set(entries.map((e) => e.url))

test.describe('Workbox precache', () => {
  test('parses a non-trivial precache manifest from sw.js', () => {
    // Fails loudly if the plugin's output format changes and the parser silently finds nothing.
    expect(entries.length).toBeGreaterThan(40)
  })

  test('includes the app shell, dictionary data and story manifest', () => {
    for (const url of ['index.html', 'vocab.json', 'kanji-data.json', 'stories/manifest.json']) {
      expect(urls, `${url} missing from precache`).toContain(url)
    }
  })

  test('includes every bundled story file', () => {
    const stories = readdirSync(PUBLIC_STORIES).filter((f) => f.endsWith('.json'))
    expect(stories.length).toBeGreaterThan(1)
    const missing = stories.map((f) => `stories/${f}`).filter((url) => !urls.has(url))
    expect(missing, 'story files missing from precache').toEqual([])
  })

  test('includes the four Noto Sans JP woff2 files and no legacy woff', () => {
    const woff2 = [...urls].filter((u) => /^assets\/noto-sans-jp-.*\.woff2$/.test(u))
    expect(woff2).toHaveLength(4)
    expect([...urls].filter((u) => u.endsWith('.woff'))).toEqual([])
  })

  test('includes the favicons, icons and web manifest', () => {
    for (const url of [
      'favicon.ico',
      'favicon.svg',
      'apple-touch-icon-180x180.png',
      'pwa-64x64.png',
      'pwa-192x192.png',
      'pwa-512x512.png',
      'maskable-icon-512x512.png',
      'manifest.webmanifest',
    ]) {
      expect(urls, `${url} missing from precache`).toContain(url)
    }
  })

  test('has no URL listed with conflicting revisions', () => {
    // Workbox aborts the install (add-to-cache-list-conflicting-entries) on these.
    const revisions = new Map<string, Set<string | null>>()
    for (const { url, revision } of entries) {
      revisions.set(url, (revisions.get(url) ?? new Set()).add(revision))
    }
    const conflicts = [...revisions].filter(([, r]) => r.size > 1).map(([url]) => url)
    expect(conflicts).toEqual([])
  })

  test(`stays within the ${PRECACHE_BUDGET_BYTES.toLocaleString('en')} byte budget`, () => {
    const total = [...urls].reduce((sum, url) => sum + statSync(join(DIST, url)).size, 0)
    expect(total, `precache is ${total.toLocaleString('en')} bytes`).toBeLessThanOrEqual(PRECACHE_BUDGET_BYTES)
  })

  test('falls back to /index.html for navigations, except /_vercel/*', () => {
    expect(sw).toMatch(/createHandlerBoundToURL\(\s*"\/index\.html"\s*\)/)
    expect(sw).toMatch(/denylist:\s*\[\s*\/\^\\\/_vercel\\\/\/\s*\]/)
  })
})
