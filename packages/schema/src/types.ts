// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

/** A single text+ruby segment within a parsed word. ruby is null for unannotated text. */
export interface WordSegment {
  text: string
  ruby: string | null
}

/** A word parsed from an inline-annotated string. surface is always the clean plain text. */
export interface ParsedWord {
  surface: string
  segments: WordSegment[]
}

export interface VocabEntry {
  id: number
  word: string
  reading: string
  meaning: string
  lesson: string
  notes?: string
}

export interface KanjiEntry {
  char: string
  kw: string | null // heisig_en: short Heisig keyword shown as the label in KanjiBreakdown
  m: string[]       // full dictionary meanings shown in kanji detail view
  onY: string[]
  kunY: string[]
}

export interface VocabSupplementEntry {
  key: number
  word: string
  hiragana: string
  translation: string
}

export interface SentenceModel {
  id: string
  tokens: ParsedWord[]
  /** Parallel to tokens[] — one entry per token. */
  vocabKeys: (number | null)[]
  translation: string | null
  grammar: number[] // indices into StoryModel.grammar (string[])
  audioUrl?: string // stored only; not played in v1; wire format: audio_url
}

export interface StoryModel {
  schemaVersion: string
  id: string
  title: string
  titleJa: string
  language: string
  difficulty: string | null
  description: string
  keywords: VocabSupplementEntry[]
  grammar: string[] // story-level grammar point descriptions — NOT SentenceModel.grammar (number[])
  vocabSupplement: VocabSupplementEntry[]
  author?: string
  source?: string
  license?: string
  licenseUrl?: string
  sentences: SentenceModel[]
  metadata: Record<string, unknown>
}

export type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
