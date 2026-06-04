#!/usr/bin/env tsx
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
/**
 * One-time migration: convert all committed story JSON files from v1 to v2 format.
 *
 * v1 sentences carry parallel `words[]` + `ruby[]` arrays. v2 embeds furigana
 * inline: `漢字[よみ]`. This script merges each ruby value into its paired word
 * and removes the `ruby` field from every sentence.
 *
 * Usage:
 *   pnpm migrate-to-v2
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadStory, LoaderError } from '../packages/story-loader/src/index.ts'

const STORIES_DIR = 'apps/web/public/stories'

// --- kanji detection (copied from packages/story-loader/src/parseInlineRuby.ts) ---

function isKanji(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    code === 0x3005 ||  // 々
    code === 0x303b ||  // 〻
    code === 0x3003     // 〃
  )
}

// --- migration helpers ---

/**
 * Converts a v1 word + ruby pair to a v2 inline-annotated string.
 * Bracket is placed immediately after the first contiguous kanji run so that
 * parseInlineRuby can recover the annotation. Null ruby returns the plain word.
 */
function migrateWord(word: string, ruby: string | null): string {
  // Coerce the "null" string emitted by some LLM outputs (same as v1 loader).
  const r = ruby === 'null' ? null : ruby
  if (r === null) return word

  // Find the end of the first contiguous kanji run.
  let kanjiRunEnd = 0
  while (kanjiRunEnd < word.length && isKanji(word[kanjiRunEnd])) {
    kanjiRunEnd++
  }

  // No leading kanji — cannot anchor a bracket; drop the annotation.
  if (kanjiRunEnd === 0) return word

  return word.slice(0, kanjiRunEnd) + '[' + r + ']' + word.slice(kanjiRunEnd)
}

// --- main ---

const files = readdirSync(STORIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort()

let migrated = 0
let skipped = 0
let failed = 0

for (const filename of files) {
  const filepath = join(STORIES_DIR, filename)

  let data: Record<string, unknown>
  try {
    data = JSON.parse(readFileSync(filepath, 'utf8')) as Record<string, unknown>
  } catch (e) {
    console.error(`  ✗ ${filename}: failed to parse — ${String(e)}`)
    failed++
    continue
  }

  // Skip files already on v2.
  if (data['schema_version'] === '2') {
    console.log(`  – ${filename}: already v2, skipped`)
    skipped++
    continue
  }

  if (data['schema_version'] !== '1') {
    console.warn(`  ? ${filename}: unexpected schema_version ${JSON.stringify(data['schema_version'])}, skipped`)
    skipped++
    continue
  }

  // Convert each sentence.
  const sentences = data['sentences'] as Array<Record<string, unknown>>
  for (const sentence of sentences) {
    const words = sentence['words'] as string[]
    const ruby = sentence['ruby'] as (string | null)[] | undefined
    const rubyArr: (string | null)[] = ruby ?? Array<null>(words.length).fill(null)

    sentence['words'] = words.map((w, i) => migrateWord(w, rubyArr[i]))
    delete sentence['ruby']
  }

  data['schema_version'] = '2'

  const output = JSON.stringify(data, null, 2) + '\n'
  writeFileSync(filepath, output, 'utf8')

  // Verify the migrated file loads without error.
  try {
    loadStory(output)
    console.log(`  ✓ ${filename}`)
    migrated++
  } catch (e) {
    const msg = e instanceof LoaderError ? e.message : String(e)
    console.error(`  ✗ ${filename}: migrated but loadStory() failed — ${msg}`)
    failed++
  }
}

console.log(`\nMigrated: ${migrated}  Skipped: ${skipped}  Failed: ${failed}`)
if (failed > 0) process.exit(1)
