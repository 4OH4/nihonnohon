// @vitest-environment node
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Enforces ADR 007: src/lib/pwa.ts is the app's only touch-point with the service
// worker. Any other module that reaches for navigator.serviceWorker or the
// vite-plugin-pwa virtual module breaks the "transparent cache" contract and the
// single guard a native wrapper or test relies on to disable registration.

import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { describe, it, expect } from 'vitest'

const SRC = join(__dirname, '..')
const ALLOWED = join(SRC, 'lib', 'pwa.ts')
const FORBIDDEN = ['navigator.serviceWorker', 'virtual:pwa-register']

/** All .ts/.tsx source files under src/, excluding the tests themselves. */
function sourceFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((p) => /\.tsx?$/.test(p) && !p.startsWith(`__tests__${sep}`))
    .map((p) => join(SRC, p))
}

describe('service worker boundary', () => {
  it('scans a non-trivial set of source files', () => {
    expect(sourceFiles().length).toBeGreaterThan(10)
    expect(sourceFiles()).toContain(ALLOWED)
  })

  it('only src/lib/pwa.ts references the service worker or virtual:pwa-register', () => {
    const offenders = sourceFiles()
      .filter((file) => file !== ALLOWED)
      .flatMap((file) => {
        const text = readFileSync(file, 'utf-8')
        return FORBIDDEN.filter((token) => text.includes(token)).map(
          (token) => `${relative(SRC, file)}: ${token}`,
        )
      })
    expect(offenders).toEqual([])
  })
})
