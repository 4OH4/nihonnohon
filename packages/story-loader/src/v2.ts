// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import Ajv from 'ajv'
import schema from '@nihonnohon/schema/schemas/story.v2.json'
import { LoaderError } from './errors'
import { parseInlineRuby } from './parseInlineRuby'
import type { StoryModel, SentenceModel, VocabSupplementEntry } from '@nihonnohon/schema'

const ajv = new Ajv()
const validate = ajv.compile(schema)

interface WireVocabEntry {
  key: number
  word: string
  hiragana: string
  translation: string
  pos?: string
  dictionary_form?: string
}

interface WireSentence {
  id: string
  words: string[]
  vocab_keys?: (number | null)[]
  translation?: string
  grammar?: number[]
  audio_url?: string
}

interface WireStory {
  schema_version: string
  id: string
  title: string
  title_ja: string
  language: string
  description: string
  difficulty?: string | null
  keywords?: WireVocabEntry[]
  grammar?: string[]
  vocab_supplement?: WireVocabEntry[]
  author?: string
  source?: string
  license?: string
  license_url?: string
  metadata?: Record<string, unknown>
  sentences: WireSentence[]
}

/** Loads and validates a v2 story JSON object, returning a StoryModel with parsed tokens. */
export function loadV2(raw: unknown): StoryModel {
  // 1. AJV validates snake_case wire format FIRST — before any transformation
  if (!validate(raw)) {
    throw new LoaderError(
      'SCHEMA_INVALID',
      `Story JSON failed schema validation: ${ajv.errorsText(validate.errors)}`
    )
  }

  const wire = raw as unknown as WireStory

  // 2. Parallel array length check (JSON Schema Draft-07 cannot enforce cross-field equality)
  for (const sentence of wire.sentences) {
    const wordCount = sentence.words.length
    if (sentence.vocab_keys !== undefined && sentence.vocab_keys.length !== wordCount) {
      throw new LoaderError(
        'SCHEMA_INVALID',
        `Sentence "${sentence.id}": vocab_keys array length (${sentence.vocab_keys.length}) must match words length (${wordCount}).`
      )
    }
  }

  // 3. Transform snake_case → camelCase to produce StoryModel
  return {
    schemaVersion: wire.schema_version,
    id: wire.id,
    title: wire.title,
    titleJa: wire.title_ja,
    language: wire.language,
    difficulty: wire.difficulty ?? null,
    description: wire.description,
    keywords: (wire.keywords ?? []).map(mapVocabEntry),
    grammar: wire.grammar ?? [],
    vocabSupplement: (wire.vocab_supplement ?? []).map(mapVocabEntry),
    author: wire.author,
    source: wire.source,
    license: wire.license,
    licenseUrl: wire.license_url,
    sentences: wire.sentences.map(mapSentence),
    metadata: wire.metadata ?? {},
  }
}

function mapVocabEntry(e: WireVocabEntry): VocabSupplementEntry {
  return {
    key: e.key!,
    word: e.word,
    hiragana: e.hiragana,
    translation: e.translation,
    ...(e.pos !== undefined && { pos: e.pos }),
    ...(e.dictionary_form !== undefined && { dictionaryForm: e.dictionary_form }),
  }
}

function mapSentence(s: WireSentence): SentenceModel {
  const wordCount = s.words.length
  return {
    id: s.id,
    tokens: s.words.map(word => parseInlineRuby(word)),
    vocabKeys: (s.vocab_keys ?? Array<number | null>(wordCount).fill(null))
      .map(v => (v === ('null' as unknown) ? null : v)),
    translation: s.translation ?? null,
    grammar: s.grammar ?? [],
    audioUrl: s.audio_url,
  }
}
