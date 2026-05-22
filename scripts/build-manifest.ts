#!/usr/bin/env tsx
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
/**
 * Regenerate apps/web/public/stories/manifest.json.
 *
 * Reads every .json file in the stories directory, validates each with
 * loadStory(), and writes a fresh manifest.json containing metadata for
 * all valid stories sorted by chapter then id. Invalid files are skipped
 * with a warning.
 *
 * Usage:
 *   pnpm build-manifest
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStory, LoaderError } from '../packages/story-loader/src/index.ts'

const STORIES_DIR = 'apps/web/public/stories'
const MANIFEST    = join(STORIES_DIR, 'manifest.json')

interface ManifestEntry {
  id: string
  filename: string
  title: string
  titleJa: string
  difficulty?: string | null
  language: string
  description: string
}

/** Extract the chapter number from "Genki I Ch.5" → 5, or Infinity if absent. */
function chapterOrdinal(difficulty: string | null | undefined): number {
  if (!difficulty) return Infinity
  const m = difficulty.match(/Ch\.(\d+)$/)
  return m ? parseInt(m[1], 10) : Infinity
}

const files = readdirSync(STORIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort()

let valid = 0
let skipped = 0
const entries: ManifestEntry[] = []

for (const filename of files) {
  try {
    const raw = readFileSync(join(STORIES_DIR, filename), 'utf8')
    const story = loadStory(raw)
    entries.push({
      id:         story.id,
      filename,
      title:      story.title,
      titleJa:    story.titleJa,
      difficulty: story.difficulty ?? null,
      language:   story.language,
      description: story.description,
    })
    console.log(`  ✓ ${filename}`)
    valid++
  } catch (e) {
    const msg = e instanceof LoaderError ? e.message : String(e)
    console.warn(`  ✗ ${filename}: ${msg}`)
    skipped++
  }
}

entries.sort((a, b) => {
  const ch = chapterOrdinal(a.difficulty) - chapterOrdinal(b.difficulty)
  return ch !== 0 ? ch : a.id.localeCompare(b.id)
})

writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + '\n', 'utf8')

console.log(`\nWrote ${valid} entr${valid === 1 ? 'y' : 'ies'} to ${MANIFEST}`)
if (skipped > 0) console.warn(`Skipped ${skipped} invalid file${skipped === 1 ? '' : 's'}.`)
