import type { VocabEntry } from '@nihonnohon/schema'

let vocabMap: Map<number, VocabEntry> | null = null
let initVocabPromise: Promise<void> | null = null

/** Fetches /vocab.json once and loads it into the in-memory map. Concurrent callers share a single in-flight fetch. */
export async function initVocab(): Promise<void> {
  if (vocabMap !== null) return
  if (initVocabPromise !== null) return initVocabPromise
  initVocabPromise = (async () => {
    const res = await fetch('/vocab.json')
    if (!res.ok) throw new Error(`Failed to load vocab data: ${res.status}`)
    const data: VocabEntry[] = await res.json()
    vocabMap = new Map(data.map(e => [e.id, e]))
  })()
  // Clear the in-flight promise on failure so the next call can retry
  initVocabPromise.catch(() => { initVocabPromise = null })
  return initVocabPromise
}

/** O(1) synchronous lookup. Returns null when id has no entry. */
export function lookupVocab(id: number): VocabEntry | null {
  if (vocabMap === null) {
    console.warn('lookupVocab called before initVocab — returning null')
    return null
  }
  return vocabMap.get(id) ?? null
}

/** Test-only — populate from data without fetching. Never call in production code. */
export function _initVocabFromData(data: VocabEntry[]): void {
  vocabMap = new Map(data.map(e => [e.id, e]))
  initVocabPromise = null
}

/** Test-only — reset to uninitialised state. Never call in production code. */
export function _resetVocab(): void {
  vocabMap = null
  initVocabPromise = null
}
