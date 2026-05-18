/** A single validation error produced by the client-side validation pipeline. */
export interface ValidationError {
  rule: string
  message: string
  sentenceIndex?: number
  path?: string
}

/**
 * Run the 8-stage client-side validation pipeline on a raw JSON string.
 *
 * Stages: JSON parse → schema_version → required fields → parallel array
 * parity → grammar index bounds → vocab key resolution → difficulty format →
 * id filename legality.
 *
 * Bails immediately after a JSON parse failure.
 * Returns an empty array if the story is valid.
 */
export function validateStoryJson(json: string): ValidationError[] {
  // Stage 1: JSON parse — bail immediately on failure
  let story: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [{ rule: 'JSON_PARSE', message: 'Story must be a JSON object.', path: '$' }]
    }
    story = parsed as Record<string, unknown>
  } catch (e) {
    return [{ rule: 'JSON_PARSE', message: `Invalid JSON: ${(e as Error).message}`, path: '$' }]
  }

  const errors: ValidationError[] = []

  // Stage 2: schema_version — only run if field is present (absent is already caught by Stage 3)
  if ('schema_version' in story && story.schema_version !== null && story.schema_version !== '1') {
    errors.push({
      rule: 'SCHEMA_VERSION',
      message: `schema_version must be "1", got ${JSON.stringify(story.schema_version)}.`,
      path: '$.schema_version',
    })
  }

  // Stage 3: required fields
  const REQUIRED_FIELDS = [
    'schema_version', 'id', 'title', 'title_ja', 'language', 'description', 'sentences',
  ]
  for (const field of REQUIRED_FIELDS) {
    if (!(field in story) || story[field] === null || story[field] === undefined) {
      errors.push({
        rule: 'MISSING_FIELD',
        message: `Required field "${field}" is missing or null.`,
        path: `$.${field}`,
      })
    }
  }

  // Early return if sentences is not usable
  if (!Array.isArray(story.sentences)) {
    return errors
  }

  const sentences = story.sentences as Record<string, unknown>[]
  const grammarList: unknown[] = Array.isArray(story.grammar) ? story.grammar : []
  const supplementalKeys = new Set<number>(
    Array.isArray(story.vocab_supplement)
      ? (story.vocab_supplement as Record<string, unknown>[]).map(v => v.key as number)
      : []
  )

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const wordCount = Array.isArray(sentence.words) ? (sentence.words as unknown[]).length : 0

    // Stage 4: parallel array parity
    if (Array.isArray(sentence.ruby) && (sentence.ruby as unknown[]).length !== wordCount) {
      errors.push({
        rule: 'PARALLEL_ARRAY_MISMATCH',
        message: `Sentence ${i}: ruby length (${(sentence.ruby as unknown[]).length}) ≠ words length (${wordCount}).`,
        sentenceIndex: i,
        path: `$.sentences[${i}].ruby`,
      })
    }
    if (Array.isArray(sentence.vocab_keys) && (sentence.vocab_keys as unknown[]).length !== wordCount) {
      errors.push({
        rule: 'PARALLEL_ARRAY_MISMATCH',
        message: `Sentence ${i}: vocab_keys length (${(sentence.vocab_keys as unknown[]).length}) ≠ words length (${wordCount}).`,
        sentenceIndex: i,
        path: `$.sentences[${i}].vocab_keys`,
      })
    }

    // Stage 5: grammar index bounds
    if (Array.isArray(sentence.grammar)) {
      for (const idx of sentence.grammar as number[]) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= grammarList.length) {
          errors.push({
            rule: 'GRAMMAR_INDEX_OUT_OF_BOUNDS',
            message: `Sentence ${i}: grammar index ${idx} out of bounds (story has ${grammarList.length} grammar item${grammarList.length === 1 ? '' : 's'}).`,
            sentenceIndex: i,
            path: `$.sentences[${i}].grammar`,
          })
        }
      }
    }

    // Stage 6: vocab key resolution
    // Non-null vocab_keys must be in the supplemental vocab OR be positive integers (≥1)
    // assumed to be valid Genki vocab IDs (backend-validated; we can't verify IDs client-side).
    if (Array.isArray(sentence.vocab_keys)) {
      for (const key of sentence.vocab_keys as (number | null)[]) {
        if (key !== null) {
          const isInSupplemental = supplementalKeys.has(key)
          const isPositiveInt = Number.isInteger(key) && key >= 1
          if (!isInSupplemental && !isPositiveInt) {
            errors.push({
              rule: 'VOCAB_KEY_UNRESOLVED',
              message: `Sentence ${i}: vocab_key ${key} is not a valid Genki vocab ID (≥1) or supplemental vocab key.`,
              sentenceIndex: i,
              path: `$.sentences[${i}].vocab_keys`,
            })
          }
        }
      }
    }
  }

  // Stage 7: difficulty format (must be null/absent or "Genki I Ch.N" / "Genki II Ch.N")
  const diff = story.difficulty
  if (diff !== null && diff !== undefined && diff !== '') {
    if (typeof diff !== 'string') {
      errors.push({
        rule: 'DIFFICULTY_FORMAT',
        message: 'difficulty must be a string or null.',
        path: '$.difficulty',
      })
    } else if (!/^Genki (I|II) Ch\.\d+$/.test(diff)) {
      errors.push({
        rule: 'DIFFICULTY_FORMAT',
        message: `difficulty "${diff}" must match format "Genki I Ch.N" or "Genki II Ch.N".`,
        path: '$.difficulty',
      })
    }
  }

  // Stage 8: id filename legality (no path separators or reserved filename characters)
  const id = story.id
  if (typeof id === 'string' && id.length > 0) {
    if (/[/\\:*?"<>|]/.test(id) || id !== id.trim() || id === '.' || id === '..') {
      errors.push({
        rule: 'ID_FILENAME_ILLEGAL',
        message: `Story id "${id}" contains characters not valid in a filename.`,
        path: '$.id',
      })
    }
  }

  return errors
}
