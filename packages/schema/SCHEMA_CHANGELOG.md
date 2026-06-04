# Schema Changelog

## Version 2

Introduced inline furigana annotation. See ADR 005 (`docs/adr/005-inline-furigana-format.md`)
for full design rationale.

### Changes from Version 1

**Removed:** `ruby` field from sentence objects. This was a parallel array associating a
whole-word reading with each word. It is no longer valid in v2; including it causes
`additionalProperties: false` validation to fail.

**Changed:** `words` array entries may now contain inline `漢字[よみ]` annotations. The
`[reading]` bracket attaches to the contiguous kanji block immediately preceding it.
Unannotated characters are plain text. Words with no furigana are plain strings. This
is transparent to the schema — `words` remains `string[]`.

### Sentence-level fields (v2)

Required: `id`, `words`

Optional: `vocab_keys`, `translation`, `grammar`, `audio_url`

Removed: `ruby`

---

## Version 1

Initial schema version. Establishes the core story format contract.

### Root-level fields

Required: `schema_version`, `id`, `title`, `title_ja`, `language`, `description`, `sentences`

Optional: `difficulty`, `keywords`, `grammar`, `vocab_supplement`, `author`, `source`, `license`, `license_url`, `metadata`

### Sentence-level fields

Required: `id`, `words`

Optional: `ruby`, `vocab_keys`, `translation`, `grammar`, `audio_url`

### Vocab entry shape (used by `keywords` and `vocab_supplement`)

`word`, `hiragana`, `translation` (all required strings)

### Versioning policy

Breaking changes to the story format require a new `schema_version` string (e.g. `"2"`) and a corresponding new loader in `packages/story-loader/src/v2.ts`. The story-loader dispatches by version; old loaders remain for backward compatibility.
