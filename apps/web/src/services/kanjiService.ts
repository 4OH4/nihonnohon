import type { KanjiEntry } from '@nihonnohon/schema'

let kanjiMap: Map<string, KanjiEntry> | null = null
let initKanjiPromise: Promise<void> | null = null

/** Fetches /kanji-data.json once and loads it into the in-memory map. Concurrent callers share a single in-flight fetch. */
export async function initKanji(): Promise<void> {
  if (kanjiMap !== null) return
  if (initKanjiPromise !== null) return initKanjiPromise
  initKanjiPromise = (async () => {
    const res = await fetch('/kanji-data.json')
    if (!res.ok) throw new Error(`Failed to load kanji data: ${res.status}`)
    const data: Record<string, KanjiEntry> = await res.json()
    kanjiMap = new Map(Object.entries(data))
  })()
  // Clear the in-flight promise on failure so the next call can retry
  initKanjiPromise.catch(() => { initKanjiPromise = null })
  return initKanjiPromise
}

/**
 * O(1) synchronous lookup by literal kanji character.
 * Returns null for hiragana, katakana, or any character not in the data file.
 */
export function lookupKanji(char: string): KanjiEntry | null {
  if (kanjiMap === null) {
    console.warn('lookupKanji called before initKanji — returning null')
    return null
  }
  return kanjiMap.get(char) ?? null
}

/** Test-only — populate from data without fetching. Never call in production code. */
export function _initKanjiFromData(data: Record<string, KanjiEntry>): void {
  kanjiMap = new Map(Object.entries(data))
  initKanjiPromise = null
}

/** Test-only — reset to uninitialised state. Never call in production code. */
export function _resetKanji(): void {
  kanjiMap = null
  initKanjiPromise = null
}
