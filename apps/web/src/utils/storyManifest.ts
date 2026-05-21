// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

/** A single entry in the story manifest. */
export interface ManifestEntry {
  id: string
  filename: string
  title: string
  titleJa: string
  difficulty?: string | null
  language: string
  description: string
}

/** Type guard — returns true when obj has all required ManifestEntry fields. */
export function isManifestEntry(obj: unknown): obj is ManifestEntry {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.filename === 'string' &&
    typeof e.title === 'string' &&
    typeof e.titleJa === 'string' &&
    typeof e.language === 'string' &&
    typeof e.description === 'string' &&
    (!('difficulty' in e) || e.difficulty === null || typeof e.difficulty === 'string')
  )
}

/** The learning source extracted from a difficulty string. */
export type DifficultySource = 'Genki I' | 'Genki II' | 'JLPT'

/** Extracts the learning source from a difficulty string, or null if unrecognised. */
export function parseDifficultySource(difficulty: string): DifficultySource | null {
  // Check "Genki II" before "Genki I" — "Genki II...".startsWith("Genki I") is true
  if (difficulty.startsWith('Genki II')) return 'Genki II'
  if (difficulty.startsWith('Genki I')) return 'Genki I'
  if (difficulty.startsWith('JLPT')) return 'JLPT'
  return null
}

/** Extracts the chapter or level portion from a difficulty string for a known source. */
export function parseDifficultyChapter(difficulty: string, source: DifficultySource): string {
  if (source === 'Genki I') return difficulty.slice('Genki I '.length)
  if (source === 'Genki II') return difficulty.slice('Genki II '.length)
  return difficulty.slice('JLPT '.length)
}

/** Fetches and validates the story manifest. Invalid entries are filtered out silently. */
export async function fetchManifest(): Promise<ManifestEntry[]> {
  const res = await fetch('/stories/manifest.json')
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`)
  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Manifest is not a JSON array')
  return data.filter(isManifestEntry)
}
