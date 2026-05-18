import { validateStoryJson } from '@/lib/validateStoryJson'
import { loadStory } from '@nihonnohon/story-loader'
import validStory from './fixtures/valid-story.json'
import parallelMismatch from './fixtures/parallel-array-mismatch.json'
import grammarOob from './fixtures/grammar-index-out-of-bounds.json'

describe('validateStoryJson', () => {
  describe('valid fixture', () => {
    it('returns [] for a complete valid story', () => {
      expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
    })

    it('valid fixture also passes loadStory()', () => {
      expect(() => loadStory(JSON.stringify(validStory))).not.toThrow()
    })
  })

  describe('Stage 1 — JSON parse', () => {
    it('returns JSON_PARSE error for invalid JSON', () => {
      const errors = validateStoryJson('{ not valid json }')
      expect(errors).toHaveLength(1)
      expect(errors[0].rule).toBe('JSON_PARSE')
    })

    it('returns JSON_PARSE error for a JSON array (not an object)', () => {
      const errors = validateStoryJson('[]')
      expect(errors).toHaveLength(1)
      expect(errors[0].rule).toBe('JSON_PARSE')
    })
  })

  describe('Stage 2 — schema_version', () => {
    it('returns SCHEMA_VERSION error when schema_version is not "1"', () => {
      const story = { ...validStory, schema_version: '2' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'SCHEMA_VERSION')).toBe(true)
    })
  })

  describe('Stage 3 — required fields', () => {
    it('detects missing id field', () => {
      const story = { ...validStory, id: undefined }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'MISSING_FIELD' && e.path === '$.id')).toBe(true)
    })

    it('detects missing title field', () => {
      const story = { ...validStory, title: undefined }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'MISSING_FIELD' && e.path === '$.title')).toBe(true)
    })

    it('detects missing description field', () => {
      const story = { ...validStory, description: undefined }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'MISSING_FIELD' && e.path === '$.description')).toBe(true)
    })
  })

  describe('Stage 4 — parallel array parity', () => {
    it('detects ruby array length mismatch at sentenceIndex 0', () => {
      const errors = validateStoryJson(JSON.stringify(parallelMismatch))
      const match = errors.find(
        e => e.rule === 'PARALLEL_ARRAY_MISMATCH' && e.sentenceIndex === 0
      )
      expect(match).toBeDefined()
      expect(match?.path).toContain('ruby')
    })

    it('detects vocab_keys length mismatch', () => {
      const story = {
        ...validStory,
        sentences: [{
          ...validStory.sentences[0],
          vocab_keys: [null],   // words has 4 tokens, vocab_keys has 1
        }],
      }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(
        e => e.rule === 'PARALLEL_ARRAY_MISMATCH' && e.path?.includes('vocab_keys')
      )).toBe(true)
    })
  })

  describe('Stage 5 — grammar index bounds', () => {
    it('detects grammar index out of bounds at sentenceIndex 0', () => {
      const errors = validateStoryJson(JSON.stringify(grammarOob))
      const match = errors.find(
        e => e.rule === 'GRAMMAR_INDEX_OUT_OF_BOUNDS' && e.sentenceIndex === 0
      )
      expect(match).toBeDefined()
    })

    it('accepts valid grammar index within bounds', () => {
      // validStory has grammar: ["〜です", "〜ます"] and sentence grammar: [0]
      expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
    })
  })

  describe('Stage 6 — vocab key resolution', () => {
    it('accepts supplemental vocab key', () => {
      // validStory uses key 9001 which is in vocab_supplement
      expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
    })

    it('accepts positive integer not in supplement (assumed Genki vocab)', () => {
      const story = {
        ...validStory,
        vocab_supplement: [],
        sentences: [{
          ...validStory.sentences[0],
          vocab_keys: [1, null, null, null],  // 1 is a valid Genki ID (≥1)
        }],
      }
      expect(validateStoryJson(JSON.stringify(story))).toEqual([])
    })

    it('flags zero as an unresolved vocab key', () => {
      const story = {
        ...validStory,
        vocab_supplement: [],
        sentences: [{
          ...validStory.sentences[0],
          vocab_keys: [0, null, null, null],  // 0 is not ≥1 and not in supplement
        }],
      }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'VOCAB_KEY_UNRESOLVED')).toBe(true)
    })
  })

  describe('Stage 7 — difficulty format', () => {
    it('accepts null difficulty', () => {
      const story = { ...validStory, difficulty: null }
      expect(validateStoryJson(JSON.stringify(story))).toEqual([])
    })

    it('accepts valid "Genki I Ch.N" format', () => {
      expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
    })

    it('accepts valid "Genki II Ch.N" format', () => {
      const story = { ...validStory, difficulty: 'Genki II Ch.12' }
      expect(validateStoryJson(JSON.stringify(story))).toEqual([])
    })

    it('detects invalid difficulty format', () => {
      const story = { ...validStory, difficulty: 'Chapter 5' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'DIFFICULTY_FORMAT')).toBe(true)
    })

    it('detects difficulty without chapter number', () => {
      const story = { ...validStory, difficulty: 'Genki I' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'DIFFICULTY_FORMAT')).toBe(true)
    })
  })

  describe('Stage 8 — id filename legality', () => {
    it('detects slash in id', () => {
      const story = { ...validStory, id: 'path/to/story' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'ID_FILENAME_ILLEGAL')).toBe(true)
    })

    it('detects backslash in id', () => {
      const story = { ...validStory, id: 'bad\\id' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'ID_FILENAME_ILLEGAL')).toBe(true)
    })

    it('detects colon in id', () => {
      const story = { ...validStory, id: 'bad:id' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'ID_FILENAME_ILLEGAL')).toBe(true)
    })

    it('detects leading space in id', () => {
      const story = { ...validStory, id: ' leading-space' }
      const errors = validateStoryJson(JSON.stringify(story))
      expect(errors.some(e => e.rule === 'ID_FILENAME_ILLEGAL')).toBe(true)
    })

    it('accepts valid hyphenated id', () => {
      expect(validateStoryJson(JSON.stringify(validStory))).toEqual([])
    })
  })
})
