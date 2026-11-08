// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Build-output checks for the Workbox precache (se4-2 AC2). No `page` fixture is used,
// so no browser launches: these read dist/sw.js, which the config's webServer has just
// built. Every bundled story must be offline after the first visit (FR46, NFR6), and the
// default precache — which every visitor downloads — must stay within its 10 MB budget.

import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative, sep } from 'path'
import { fileURLToPath } from 'url'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(APP_ROOT, 'dist')
const PUBLIC_STORIES = join(APP_ROOT, 'public', 'stories')

/** Default-precache budget from ADR 007, in bytes (10 MB, decimal). */
const PRECACHE_BUDGET_BYTES = 10_000_000

/** Extensions matched by `workbox.globPatterns` in vite.config.ts — keep the two in step. */
const PRECACHE_EXTENSIONS = /\.(js|css|html|woff2|png|svg|ico|webmanifest|json)$/

/** Build outputs the plugin keeps out of the precache on purpose (the worker and its runtime). */
const NOT_PRECACHED = /^(sw\.js|workbox-[\w-]+\.js)$/

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

/** Every file under `dir`, as a URL-style path relative to it. */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(dir, join(d.parentPath, d.name)).split(sep).join('/'))
}

let cache: { sw: string; entries: PrecacheEntry[]; urls: Set<string> } | undefined

/**
 * Reads dist/sw.js on first use rather than at import, so `--list` and IDE test discovery
 * work on a fresh clone with no build.
 */
function precache() {
  if (!cache) {
    const swPath = join(DIST, 'sw.js')
    if (!existsSync(swPath)) {
      throw new Error(`${swPath} not found: the webServer build did not run (try \`pnpm build\` from the root)`)
    }
    const sw = readFileSync(swPath, 'utf-8')
    const entries = readPrecacheEntries(sw)
    cache = { sw, entries, urls: new Set(entries.map((e) => e.url)) }
  }
  return cache
}

/** Build outputs that the globs match, i.e. everything Workbox should have precached. */
function globbedDistFiles(): string[] {
  return listFiles(DIST).filter((f) => PRECACHE_EXTENSIONS.test(f) && !NOT_PRECACHED.test(f))
}

test.describe('Workbox precache', () => {
  test('parses a non-trivial precache manifest from sw.js', () => {
    // Fails loudly if the plugin's output format changes and the parser silently finds nothing.
    expect(precache().entries.length).toBeGreaterThan(40)
  })

  test('precaches every build output the globs match', () => {
    // Catches anything Workbox dropped, including files over its 2 MiB per-file limit,
    // which only produce a build-log warning. Covers all JS and CSS chunks too.
    const { urls } = precache()
    const missing = globbedDistFiles().filter((f) => !urls.has(f))
    expect(missing, 'build outputs missing from precache (over 2 MiB, or excluded by a glob?)').toEqual([])
  })

  test('includes the app shell, dictionary data and story manifest', () => {
    const { urls } = precache()
    for (const url of ['index.html', 'vocab.json', 'kanji-data.json', 'stories/manifest.json']) {
      expect(urls, `${url} missing from precache`).toContain(url)
    }
  })

  test('includes every bundled story file', () => {
    const { urls } = precache()
    const stories = listFiles(PUBLIC_STORIES).filter((f) => /\.json$/i.test(f))
    expect(stories.length).toBeGreaterThan(1)
    const missing = stories.map((f) => `stories/${f}`).filter((url) => !urls.has(url))
    expect(missing, 'story files missing from precache').toEqual([])
  })

  test('precaches the exact file the reader fetches for each manifest entry', () => {
    // The reader requests /stories/<filename>; a case or path mismatch with the file on disk
    // would 404 online and miss the precache offline.
    const { urls } = precache()
    const manifest = JSON.parse(readFileSync(join(PUBLIC_STORIES, 'manifest.json'), 'utf-8')) as {
      filename: string
    }[]
    const missing = manifest.map((e) => `stories/${e.filename}`).filter((url) => !urls.has(url))
    expect(missing, 'manifest filenames missing from precache').toEqual([])
  })

  test('includes the four Noto Sans JP woff2 files and no legacy woff', () => {
    const urls = [...precache().urls]
    const faces = urls
      .map((u) => /^assets\/noto-sans-jp-(japanese|latin)-(400|600)-normal-.+\.woff2$/.exec(u))
      .filter((m) => m !== null)
      .map((m) => `${m[1]}-${m[2]}`)
      .sort()
    expect(faces).toEqual(['japanese-400', 'japanese-600', 'latin-400', 'latin-600'])
    expect(urls.filter((u) => u.endsWith('.woff2'))).toHaveLength(4)
    expect(urls.filter((u) => u.endsWith('.woff'))).toEqual([])
  })

  test('includes the favicons, icons and web manifest', () => {
    const { urls } = precache()
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
    for (const { url, revision } of precache().entries) {
      revisions.set(url, (revisions.get(url) ?? new Set()).add(revision))
    }
    const conflicts = [...revisions].filter(([, r]) => r.size > 1).map(([url]) => url)
    expect(conflicts).toEqual([])
  })

  test(`stays within the ${PRECACHE_BUDGET_BYTES.toLocaleString('en')} byte budget`, () => {
    // Sized from disk over everything the globs match, so a file Workbox dropped still counts.
    const files = new Set([...precache().urls, ...globbedDistFiles()])
    const total = [...files].reduce((sum, url) => sum + statSync(join(DIST, url)).size, 0)
    expect(total, `precache is ${total.toLocaleString('en')} bytes`).toBeLessThanOrEqual(PRECACHE_BUDGET_BYTES)
  })

  test('falls back to /index.html for navigations, except /_vercel/*', () => {
    const { sw } = precache()
    expect(sw).toMatch(/createHandlerBoundToURL\(\s*"\/index\.html"\s*\)/)
    expect(sw).toMatch(/denylist:\s*\[\s*\/\^\\\/_vercel\\\/\/\s*\]/)
  })
})
