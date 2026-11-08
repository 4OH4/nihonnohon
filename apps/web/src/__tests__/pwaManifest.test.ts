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
