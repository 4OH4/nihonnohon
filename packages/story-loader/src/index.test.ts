import { describe, expect, it } from 'vitest'
import { loadStory, LoaderError } from './index'
import validV1 from './__fixtures__/valid-v1.json'
import validMinimal from './__fixtures__/valid-v1-minimal.json'
import invalidSchema from './__fixtures__/invalid-schema.json'
import invalidEmptySentences from './__fixtures__/invalid-empty-sentences.json'
import invalidSentenceMissingId from './__fixtures__/invalid-sentence-missing-id.json'
import unsupportedVersion from './__fixtures__/unsupported-schema-version.json'

// invalid-malformed.json contains `{ this is not valid json` — not importable as JSON
const malformedContent = '{ this is not valid json'

describe('loadStory', () => {
  describe('valid stories', () => {
    it('transforms valid-v1.json to StoryModel with correct camelCase fields', () => {
      const result = loadStory(validV1)
      expect(result.schemaVersion).toBe('1')
      expect(result.id).toBe('test-story-complete')
      expect(result.titleJa).toBe('完全なテストストーリー')
      expect(result.difficulty).toBe('Genki I Ch.6')
      expect(result.grammar).toEqual(['て-form for connecting actions'])
      expect(result.keywords).toEqual([{ key: 1000, word: '田中', hiragana: 'たなか', translation: 'Tanaka (name)' }])
      expect(result.vocabSupplement).toEqual([{ key: 1, word: '先生', hiragana: 'せんせい', translation: 'teacher' }])
    })

    it('correctly transforms all sentence snake_case fields to camelCase', () => {
      const result = loadStory(validV1)
      const s = result.sentences[0]
      expect(s.id).toBe('s1')
      expect(s.words).toEqual(['田中', 'さん', 'は', '先生', 'です'])
      expect(s.ruby).toEqual(['たなか', null, null, 'せんせい', null])
      expect(s.vocabKeys).toEqual([null, null, null, 1, null])
      expect(s.translation).toBe('Mr. Tanaka is a teacher.')
      expect(s.grammar).toEqual([0])
      expect(s.audioUrl).toBe('https://example.com/s1.mp3')
    })

    it('loads valid-v1-minimal.json and fills defaults for absent optional story fields', () => {
      const result = loadStory(validMinimal)
      expect(result.difficulty).toBeNull()
      expect(result.keywords).toEqual([])
      expect(result.grammar).toEqual([])
      expect(result.vocabSupplement).toEqual([])
      expect(result.metadata).toEqual({})
    })

    it('fills absent sentence arrays with parallel nulls matching words length', () => {
      const result = loadStory(validMinimal)
      const s = result.sentences[0]
      expect(s.words).toEqual(['こんにちは'])
      expect(s.ruby).toEqual([null])
      expect(s.vocabKeys).toEqual([null])
      expect(s.translation).toBeNull()
      expect(s.grammar).toEqual([])
      expect(s.audioUrl).toBeUndefined()
    })
  })

  describe('SCHEMA_INVALID errors', () => {
    it('throws SCHEMA_INVALID for unknown root field (additionalProperties violation)', () => {
      let thrown: unknown
      try { loadStory(invalidSchema) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('SCHEMA_INVALID')
    })

    it('throws SCHEMA_INVALID for empty sentences array (minItems violation)', () => {
      let thrown: unknown
      try { loadStory(invalidEmptySentences) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('SCHEMA_INVALID')
    })

    it('throws SCHEMA_INVALID for sentence missing required id field', () => {
      let thrown: unknown
      try { loadStory(invalidSentenceMissingId) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('SCHEMA_INVALID')
    })

    it('throws SCHEMA_INVALID for mismatched ruby array length and names the sentence id', () => {
      const mismatch = {
        ...validV1,
        sentences: [{
          id: 's1',
          words: ['a', 'b', 'c'],
          ruby: ['x', 'y'],
        }],
      }
      let thrown: unknown
      try { loadStory(mismatch) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('SCHEMA_INVALID')
      expect((thrown as LoaderError).message).toContain('s1')
    })

    it('throws SCHEMA_INVALID for mismatched vocab_keys array length and names the sentence id', () => {
      const mismatch = {
        ...validV1,
        sentences: [{
          id: 's2',
          words: ['a', 'b'],
          vocab_keys: [1],
        }],
      }
      let thrown: unknown
      try { loadStory(mismatch) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('SCHEMA_INVALID')
      expect((thrown as LoaderError).message).toContain('s2')
    })
  })

  describe('PARSE_FAILED errors', () => {
    it('throws PARSE_FAILED for malformed JSON string', () => {
      let thrown: unknown
      try { loadStory(malformedContent) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('PARSE_FAILED')
    })

    it('throws PARSE_FAILED for arbitrary non-JSON string', () => {
      let thrown: unknown
      try { loadStory('not json at all') } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('PARSE_FAILED')
    })
  })

  describe('UNSUPPORTED_VERSION errors', () => {
    it('throws UNSUPPORTED_VERSION for unknown schema_version and names it in the message', () => {
      let thrown: unknown
      try { loadStory(unsupportedVersion) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(LoaderError)
      expect((thrown as LoaderError).code).toBe('UNSUPPORTED_VERSION')
      expect((thrown as LoaderError).message).toContain('99')
    })
  })

  describe('LoaderError type guarantees', () => {
    it('LoaderError is instanceof Error', () => {
      let thrown: unknown
      try { loadStory(malformedContent) } catch (e) { thrown = e }
      expect(thrown).toBeInstanceOf(Error)
      expect(thrown).toBeInstanceOf(LoaderError)
    })

    it('LoaderError.name is "LoaderError"', () => {
      let thrown: unknown
      try { loadStory(malformedContent) } catch (e) { thrown = e }
      expect((thrown as LoaderError).name).toBe('LoaderError')
    })
  })
})
