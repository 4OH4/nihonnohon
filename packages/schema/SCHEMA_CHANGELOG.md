# Schema Changelog

## Version 1

Initial schema version. Establishes the core story format contract.

### Root-level fields

Required: `schema_version`, `id`, `title`, `title_ja`, `language`, `description`, `sentences`

Optional: `difficulty`, `keywords`, `grammar`, `vocab_supplement`, `author`, `license`, `license_url`, `metadata`

### Sentence-level fields

Required: `id`, `words`

Optional: `ruby`, `vocab_keys`, `translation`, `grammar`, `audio_url`

### Vocab entry shape (used by `keywords` and `vocab_supplement`)

`word`, `hiragana`, `translation` (all required strings)

### Versioning policy

Breaking changes to the story format require a new `schema_version` string (e.g. `"2"`) and a corresponding new loader in `packages/story-loader/src/v2.ts`. The story-loader dispatches by version; old loaders remain for backward compatibility.
