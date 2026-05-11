// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vocabPath = resolve(__dirname, '../../public/vocab.json')
const entries = JSON.parse(readFileSync(vocabPath, 'utf-8')) as unknown[]

describe('vocab.json (build-vocab output)', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('every entry has the VocabEntry shape', () => {
    for (const entry of entries as Record<string, unknown>[]) {
      expect(typeof entry.id).toBe('number')
      expect(typeof entry.word).toBe('string')
      expect(typeof entry.reading).toBe('string')
      expect(typeof entry.meaning).toBe('string')
      expect(typeof entry.lesson).toBe('string')
    }
  })

  it('ids are sequential starting at 1', () => {
    const ids = (entries as { id: number }[]).map(e => e.id)
    expect(ids[0]).toBe(1)
    expect(ids[ids.length - 1]).toBe(entries.length)
  })

  it('contains a known Genki I Ch.1 vocabulary entry', () => {
    const student = (entries as { word: string; reading: string; meaning: string; lesson: string }[])
      .find(e => e.reading === 'がくせい')
    expect(student).toBeDefined()
    expect(student!.word).toBe('学生')
    expect(student!.meaning).toContain('student')
    expect(student!.lesson).toBe('Genki I Ch.1')
  })

  it('lesson field uses correct Genki prefix', () => {
    const lessons = new Set((entries as { lesson: string }[]).map(e => e.lesson))
    const hasGenkiI = [...lessons].some(l => l === 'Genki I Intro' || l.startsWith('Genki I Ch.'))
    expect(hasGenkiI).toBe(true)
  })
})
