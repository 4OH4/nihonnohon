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
  words: string[]
  ruby: (string | null)[]
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
  sentences: SentenceModel[]
  metadata: Record<string, unknown>
}

export type LookupState =
  | { status: 'idle' }
  | { status: 'found'; word: string; entry: VocabEntry }
  | { status: 'not-found'; word: string }
