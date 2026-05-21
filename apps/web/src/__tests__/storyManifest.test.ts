// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isManifestEntry,
  fetchManifest,
  parseDifficultySource,
  parseDifficultyChapter,
  type ManifestEntry,
} from '@/utils/storyManifest'

// ─── isManifestEntry ──────────────────────────────────────────────────────────

describe('isManifestEntry', () => {
  const valid: ManifestEntry = {
    id: 'test-story',
    filename: 'test-story.json',
    title: 'Test',
    titleJa: 'テスト',
    language: 'Japanese',
    description: 'A test story.',
  }

  it('returns true for a valid entry without difficulty', () => {
    expect(isManifestEntry(valid)).toBe(true)
  })

  it('returns true when difficulty is a string', () => {
    expect(isManifestEntry({ ...valid, difficulty: 'Genki I Ch.6' })).toBe(true)
  })

  it('returns true when difficulty is null', () => {
    expect(isManifestEntry({ ...valid, difficulty: null })).toBe(true)
  })

  it('returns false when difficulty is a number', () => {
    expect(isManifestEntry({ ...valid, difficulty: 42 })).toBe(false)
  })

  it('returns false when difficulty is a boolean', () => {
    expect(isManifestEntry({ ...valid, difficulty: true })).toBe(false)
  })

  it('returns false when id is empty string', () => {
    expect(isManifestEntry({ ...valid, id: '' })).toBe(false)
  })

  it('returns false when description is missing', () => {
    const { description: _d, ...noDesc } = valid
    expect(isManifestEntry(noDesc)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(isManifestEntry(null)).toBe(false)
  })

  it('returns false for a string input', () => {
    expect(isManifestEntry('not-an-object')).toBe(false)
  })

  it('returns false for a number input', () => {
    expect(isManifestEntry(42)).toBe(false)
  })
})

// ─── parseDifficultySource ────────────────────────────────────────────────────

describe('parseDifficultySource', () => {
  it('returns "Genki I" for Genki I difficulty', () => {
    expect(parseDifficultySource('Genki I Ch.6')).toBe('Genki I')
  })

  it('returns "Genki II" for Genki II difficulty', () => {
    expect(parseDifficultySource('Genki II Ch.3')).toBe('Genki II')
  })

  it('returns "JLPT" for JLPT difficulty', () => {
    expect(parseDifficultySource('JLPT N4')).toBe('JLPT')
  })

  it('returns null for unrecognised difficulty', () => {
    expect(parseDifficultySource('N3')).toBe(null)
    expect(parseDifficultySource('')).toBe(null)
    expect(parseDifficultySource('Custom Level 1')).toBe(null)
  })

  it('does not confuse Genki II with Genki I', () => {
    expect(parseDifficultySource('Genki II Ch.12')).toBe('Genki II')
  })
})

// ─── parseDifficultyChapter ───────────────────────────────────────────────────

describe('parseDifficultyChapter', () => {
  it('extracts chapter from Genki I difficulty', () => {
    expect(parseDifficultyChapter('Genki I Ch.6', 'Genki I')).toBe('Ch.6')
  })

  it('extracts chapter from Genki II difficulty', () => {
    expect(parseDifficultyChapter('Genki II Ch.12', 'Genki II')).toBe('Ch.12')
  })

  it('extracts level from JLPT difficulty', () => {
    expect(parseDifficultyChapter('JLPT N4', 'JLPT')).toBe('N4')
    expect(parseDifficultyChapter('JLPT N2', 'JLPT')).toBe('N2')
  })
})

// ─── fetchManifest ────────────────────────────────────────────────────────────

describe('fetchManifest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns validated entries from a successful fetch', async () => {
    const data = [
      { id: 'a', filename: 'a.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    const entries = await fetchManifest()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('a')
  })

  it('filters out invalid entries silently', async () => {
    const data = [
      { id: 'valid', filename: 'a.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' },
      { id: '', filename: 'bad.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' }, // empty id
      { filename: 'no-id.json', title: 'T', titleJa: 'T', language: 'ja', description: 'd' }, // missing id
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    const entries = await fetchManifest()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('valid')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchManifest()).rejects.toThrow('404')
  })

  it('throws when the response body is not a JSON array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [] }) }))
    await expect(fetchManifest()).rejects.toThrow('not a JSON array')
  })
})
