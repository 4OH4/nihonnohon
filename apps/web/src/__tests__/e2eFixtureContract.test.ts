// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Contract tests for the story fixtures used by e2e/golden-path.spec.ts and
// e2e/accessibility.spec.ts. If any of these fail, the E2E tests will fail on
// CI too — update the E2E spec to match the new story data, then re-run.

import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

// ─── helpers ─────────────────────────────────────────────────────────────────

function readJson(relPath: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, relPath), 'utf-8'))
}

/** Strip inline furigana annotations (e.g. 起[お]きます → 起きます). */
function surface(word: string): string {
  return word.replace(/\[[^\]]*\]/g, '')
}

// ─── data ────────────────────────────────────────────────────────────────────

const STORY_ID = 'genki-i-ch6-tanaka-letter'

const manifest = readJson('../../public/stories/manifest.json') as Array<Record<string, unknown>>

const story = readJson(`../../public/stories/${STORY_ID}.json`) as {
  sentences: Array<{ words: string[] }>
}

const allSurfaces = story.sentences.flatMap((s) => s.words.map(surface))

// ─── manifest contract ────────────────────────────────────────────────────────

describe(`E2E fixture contract — ${STORY_ID}`, () => {
  it('story exists in manifest', () => {
    const entry = manifest.find((e) => e.id === STORY_ID)
    expect(
      entry,
      `Story '${STORY_ID}' was removed from manifest.json. ` +
        `Update e2e/golden-path.spec.ts and e2e/accessibility.spec.ts to use a different story.`,
    ).toBeDefined()
  })

  // This title is searched for directly in e2e/golden-path.spec.ts.
  // If the title changes, update the getByText() calls in that file.
  it('manifest title matches golden-path expectation', () => {
    const entry = manifest.find((e) => e.id === STORY_ID)
    expect(entry?.title).toBe("Mary's Letter to Tanaka-san")
  })

  // ─── word contract ──────────────────────────────────────────────────────────
  // Each word below is used as getByRole('button', { name: '...' }) in E2E tests.
  // If a word disappears from the story (e.g. after re-generation), update both
  // the test expectation here and the corresponding E2E spec.

  it("story contains '起きます' (used for word lookup in golden-path and accessibility tests)", () => {
    expect(allSurfaces).toContain('起きます')
  })

  it("story contains 'はじめまして' (used for navigation in golden-path test)", () => {
    expect(allSurfaces).toContain('はじめまして')
  })

  it("story contains '、' punctuation (used for not-found InfoPanel test)", () => {
    expect(allSurfaces).toContain('、')
  })
})
