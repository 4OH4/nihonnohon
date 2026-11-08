// @vitest-environment node
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// vercel.json pins `Cache-Control: no-cache` on the service worker script so an
// installed app always revalidates sw.js and sees new deploys (ADR 007, se4-2 AC3).
// The SPA rewrite and build settings must stay exactly as they were.

import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

interface VercelHeader {
  key: string
  value: string
}

interface VercelConfig {
  buildCommand?: string
  outputDirectory?: string
  rewrites?: { source: string; destination: string }[]
  headers?: { source: string; headers: VercelHeader[] }[]
}

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const config = JSON.parse(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf-8')) as VercelConfig

describe('vercel.json', () => {
  it('serves /sw.js with Cache-Control: no-cache', () => {
    const rule = config.headers?.find((h) => h.source === '/sw.js')
    expect(rule, 'no headers rule for /sw.js').toBeDefined()
    expect(rule?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache' })
  })

  it('keeps the SPA rewrite unchanged', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('keeps the monorepo build settings unchanged', () => {
    expect(config.buildCommand).toBe('turbo build --filter=@nihonnohon/web')
    expect(config.outputDirectory).toBe('apps/web/dist')
  })
})
