// @vitest-environment node
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Enforces ADR 007: src/lib/pwa.ts is the app's only touch-point with the service
// worker. Any other module that reaches for navigator.serviceWorker, workbox-window
// or the vite-plugin-pwa virtual module breaks the "transparent cache" contract and
// the single guard a native wrapper or test relies on to disable registration.

import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { describe, it, expect } from 'vitest'

const SRC = join(__dirname, '..')
const ALLOWED = join(SRC, 'lib', 'pwa.ts')

/**
 * Any `serviceWorker` identifier catches every access form — `navigator.serviceWorker`,
 * `'serviceWorker' in navigator`, `navigator['serviceWorker']`, destructuring. Case-sensitive
 * and word-bounded, so names like `registerServiceWorker` do not match.
 */
const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'serviceWorker', pattern: /\bserviceWorker\b/ },
  { label: 'virtual:pwa-register', pattern: /virtual:pwa-register/ },
  { label: 'workbox-window', pattern: /workbox-window/ },
]

const SOURCE_EXT = /\.[cm]?[jt]sx?$/
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

/** All script source files under src/, excluding any __tests__ folder and *.test / *.spec files. */
function sourceFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((p) => SOURCE_EXT.test(p) && !TEST_FILE.test(p) && !p.split(sep).includes('__tests__'))
    .map((p) => join(SRC, p))
}

describe('service worker boundary', () => {
  it('scans a non-trivial set of source files', () => {
    expect(sourceFiles().length).toBeGreaterThan(10)
    expect(sourceFiles()).toContain(ALLOWED)
  })

  it('only src/lib/pwa.ts references the service worker, workbox-window or virtual:pwa-register', () => {
    const offenders = sourceFiles()
      .filter((file) => file !== ALLOWED)
      .flatMap((file) => {
        const text = readFileSync(file, 'utf-8')
        return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(
          ({ label }) => `${relative(SRC, file)}: ${label}`,
        )
      })
    expect(offenders).toEqual([])
  })
})
