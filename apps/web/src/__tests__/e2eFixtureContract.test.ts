// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Contract tests for the story fixtures used by e2e/golden-path.spec.ts,
// e2e/accessibility.spec.ts and e2e/infopanel-layout.spec.ts. If any of these
// fail, the E2E tests will fail on CI too — update the E2E spec to match the new
// story data, then re-run.

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

// ─── infopanel-layout fixture contract ────────────────────────────────────────
// e2e/infopanel-layout.spec.ts measures the panel with specific words: it needs a
// two-kanji word whose second keyword is long enough to overflow, and a
// three-kanji word. Substituting arbitrary words would silently stop exercising
// the condition behind issue #19.

const LAYOUT_STORY_ID = 'genki-i-ch15-yumis-bento-lunch'

const layoutStory = readJson(`../../public/stories/${LAYOUT_STORY_ID}.json`) as {
  sentences: Array<{ words: string[] }>
}

const layoutSurfaces = layoutStory.sentences.flatMap((s) => s.words.map(surface))

const kanjiData = readJson('../../public/kanji-data.json') as Record<string, { kw: string | null; m: string[] }>

describe(`E2E fixture contract — ${LAYOUT_STORY_ID}`, () => {
  it('story exists in manifest', () => {
    expect(manifest.find((e) => e.id === LAYOUT_STORY_ID)).toBeDefined()
  })

  it.each(['食堂', '高校生'])("story contains '%s' (used by infopanel-layout.spec.ts)", (word) => {
    expect(layoutSurfaces).toContain(word)
  })

  it('堂 still has a keyword long enough to force a wrap in a narrow cell', () => {
    const entry = kanjiData['堂']
    const keyword = entry?.kw ?? entry?.m[0] ?? ''
    // "public chamber/hall" — the wrapping assertion needs a keyword that cannot
    // fit a ~6em cell on one line.
    expect(keyword.length).toBeGreaterThan(12)
  })

  it.each(['食堂', '高校生'])("every kanji in '%s' has a breakdown cell", (word) => {
    for (const char of word) expect(kanjiData[char]).toBeDefined()
  })
})
