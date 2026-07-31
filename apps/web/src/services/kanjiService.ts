// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { KanjiEntry } from '@nihonnohon/schema'

let kanjiMap: Map<string, KanjiEntry> | null = null
let initKanjiPromise: Promise<void> | null = null

// ─── Availability signal ──────────────────────────────────────────────────────
// The data file is fetched off the critical path (see ReaderRoute's loader), so a
// word can be tapped before it lands. Components look up synchronously and
// subscribe here to re-render once the map is populated.

const listeners = new Set<() => void>()
let version = 0

function publish(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

/** Subscribes to kanji-data availability. Returns an unsubscribe function. */
export function subscribeKanji(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Snapshot for `useSyncExternalStore` — changes whenever the map is replaced. */
export function getKanjiVersion(): number {
  return version
}

/** Fetches /kanji-data.json once and loads it into the in-memory map. Concurrent callers share a single in-flight fetch. */
export async function initKanji(): Promise<void> {
  if (kanjiMap !== null) return
  if (initKanjiPromise !== null) return initKanjiPromise
  initKanjiPromise = (async () => {
    const res = await fetch('/kanji-data.json')
    if (!res.ok) throw new Error(`Failed to load kanji data: ${res.status}`)
    const data: Record<string, KanjiEntry> = await res.json()
    kanjiMap = new Map(Object.entries(data))
    publish()
  })()
  // Clear the in-flight promise on failure so the next call can retry
  initKanjiPromise.catch(() => { initKanjiPromise = null })
  return initKanjiPromise
}

/**
 * O(1) synchronous lookup by literal kanji character.
 * Returns null for hiragana, katakana, a character not in the data file, and for
 * any character while the data is still loading — callers subscribe via
 * `subscribeKanji` to re-render when it arrives.
 */
export function lookupKanji(char: string): KanjiEntry | null {
  if (kanjiMap === null) return null
  return kanjiMap.get(char) ?? null
}

/** Test-only — populate from data without fetching. Never call in production code. */
export function _initKanjiFromData(data: Record<string, KanjiEntry>): void {
  kanjiMap = new Map(Object.entries(data))
  initKanjiPromise = null
  publish()
}

/** Test-only — reset to uninitialised state. Never call in production code. */
export function _resetKanji(): void {
  kanjiMap = null
  initKanjiPromise = null
  publish()
}
