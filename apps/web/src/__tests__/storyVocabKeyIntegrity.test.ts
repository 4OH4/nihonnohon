// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Data-integrity tests for the shipped story library (issue #14).
//
// Every token in a story carries a vocab_keys entry that must resolve to *something*
// at runtime: keys below SUPPLEMENT_KEY_MIN come from the shared vocab.json, keys at
// or above it come from that story's own vocab_supplement. A key that resolves to
// neither renders a word that silently does nothing when tapped.

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

// ─── constants ────────────────────────────────────────────────────────────────

/** Supplement keys start here; main vocab.json ids sit below it. See lib/vocabAdapter.ts. */
const SUPPLEMENT_KEY_MIN = 10000

const STORIES_DIR = join(__dirname, '../../public/stories')

// ─── types ────────────────────────────────────────────────────────────────────

interface WireSupplementEntry {
  key: number
  word: string
}

interface WireStory {
  id: string
  vocab_supplement?: WireSupplementEntry[]
  keywords?: WireSupplementEntry[]
  sentences: Array<{ id: string; words: string[]; vocab_keys: (number | null)[] }>
}

// ─── data ─────────────────────────────────────────────────────────────────────

const storyFiles = readdirSync(STORIES_DIR).filter(
  (f) => f.endsWith('.json') && f !== 'manifest.json',
)

const stories: WireStory[] = storyFiles.map(
  (f) => JSON.parse(readFileSync(join(STORIES_DIR, f), 'utf-8')) as WireStory,
)

const vocab = JSON.parse(
  readFileSync(join(__dirname, '../../public/vocab.json'), 'utf-8'),
) as Array<{ id: number }>

const vocabIds = new Set(vocab.map((e) => e.id))

/** Strip inline furigana annotations (e.g. 考[かんが]えました → 考えました). */
function surface(word: string): string {
  return word.replace(/\[[^\]]*\]/g, '')
}

/** Every key a story can resolve locally — its supplement plus its keywords. */
function localKeys(story: WireStory): Set<number> {
  return new Set([
    ...(story.vocab_supplement ?? []).map((e) => e.key),
    ...(story.keywords ?? []).map((e) => e.key),
  ])
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('story vocab key integrity', () => {
  it('finds story files to check', () => {
    expect(storyFiles.length).toBeGreaterThan(0)
  })

  it('every supplement-range vocab key resolves within its own story', () => {
    const unresolved: string[] = []
    stories.forEach((story) => {
      const keys = localKeys(story)
      story.sentences.forEach((s) => {
        s.words.forEach((word, i) => {
          const key = s.vocab_keys[i]
          if (key === null || key === undefined || key < SUPPLEMENT_KEY_MIN) return
          if (!keys.has(key)) unresolved.push(`${story.id} ${s.id} ${surface(word)} → key ${key}`)
        })
      })
    })
    expect(
      unresolved,
      `Tokens reference a supplement key absent from their story's vocab_supplement, so ` +
        `they render as unresponsive words:\n${unresolved.join('\n')}`,
    ).toEqual([])
  })

  it('every main-range vocab key exists in vocab.json', () => {
    const unresolved: string[] = []
    stories.forEach((story) => {
      story.sentences.forEach((s) => {
        s.words.forEach((word, i) => {
          const key = s.vocab_keys[i]
          if (key === null || key === undefined || key >= SUPPLEMENT_KEY_MIN) return
          if (!vocabIds.has(key)) unresolved.push(`${story.id} ${s.id} ${surface(word)} → id ${key}`)
        })
      })
    })
    expect(
      unresolved,
      `Tokens reference a vocab.json id that does not exist:\n${unresolved.join('\n')}`,
    ).toEqual([])
  })

  it('vocab_keys is parallel to words in every sentence', () => {
    const mismatched: string[] = []
    stories.forEach((story) => {
      story.sentences.forEach((s) => {
        if (s.words.length !== s.vocab_keys.length) {
          mismatched.push(`${story.id} ${s.id}: ${s.words.length} words, ${s.vocab_keys.length} keys`)
        }
      })
    })
    expect(mismatched, `vocab_keys must be parallel to words:\n${mismatched.join('\n')}`).toEqual([])
  })

  it('supplement keys are unique within a story', () => {
    const dupes: string[] = []
    stories.forEach((story) => {
      const seen = new Set<number>()
      ;[...(story.vocab_supplement ?? []), ...(story.keywords ?? [])].forEach((e) => {
        if (seen.has(e.key)) dupes.push(`${story.id}: duplicate key ${e.key} (${e.word})`)
        seen.add(e.key)
      })
    })
    expect(dupes, `Duplicate supplement keys shadow each other:\n${dupes.join('\n')}`).toEqual([])
  })

  it('supplement keys never collide with the main vocab.json id range', () => {
    const collisions: string[] = []
    stories.forEach((story) => {
      localKeys(story).forEach((key) => {
        if (key < SUPPLEMENT_KEY_MIN) collisions.push(`${story.id}: supplement key ${key}`)
      })
    })
    expect(
      collisions,
      `Supplement keys must be >= ${SUPPLEMENT_KEY_MIN} so they cannot be confused with ` +
        `vocab.json ids:\n${collisions.join('\n')}`,
    ).toEqual([])
  })
})
