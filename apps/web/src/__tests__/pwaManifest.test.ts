// @vitest-environment node
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// The web manifest description (APP_DESCRIPTION in vite.config.ts) must match the
// index.html meta description character for character (se4-1 AC1).

import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..')

describe('web manifest description', () => {
  it('matches the index.html meta description verbatim', () => {
    const html = readFileSync(join(APP_ROOT, 'index.html'), 'utf-8')
    const config = readFileSync(join(APP_ROOT, 'vite.config.ts'), 'utf-8')

    const htmlDescription = html.match(/<meta name="description" content="([^"]+)"/)?.[1]
    const manifestDescription = config.match(/const APP_DESCRIPTION =\s*'([^']+)'/)?.[1]

    expect(htmlDescription).toBeTruthy()
    expect(manifestDescription).toBe(htmlDescription)
  })
})

// Android paints the status and navigation bars in the theme colour. They border the
// AppBar and the mobile tab bar, which are `surface`, so all three must use that token.
describe('theme colour', () => {
  it('uses the surface token in index.html and the web manifest', () => {
    const html = readFileSync(join(APP_ROOT, 'index.html'), 'utf-8')
    const config = readFileSync(join(APP_ROOT, 'vite.config.ts'), 'utf-8')
    const tailwind = readFileSync(join(APP_ROOT, 'tailwind.config.ts'), 'utf-8')

    const surface = tailwind.match(/\bsurface: '(#[0-9A-Fa-f]{6})'/)?.[1]
    expect(surface).toBeTruthy()
    expect(html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1]).toBe(surface)
    expect(config.match(/theme_color: '([^']+)'/)?.[1]).toBe(surface)
    expect(config.match(/background_color: '([^']+)'/)?.[1]).toBe(surface)
  })
})
