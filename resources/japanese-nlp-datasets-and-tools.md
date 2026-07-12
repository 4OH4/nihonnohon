# Japanese NLP Datasets and Tools

Reference for open-source datasets and Python libraries for Japanese text processing. Covers dictionaries, kanji data, tokenizers, and reading annotation tools. Status as of mid-2025.

---

## Dictionaries

### JMdict (Japanese-Multilingual Dictionary)
- **URL:** https://www.edrdg.org/jmdict/j_jmdict.html
- **License:** CC BY-SA 4.0 (EDRDG)
- **Format:** XML (UTF-8, gzip), updated daily
- **Coverage:** ~214,000 entries (~314,000 unique headword-reading combinations)
- **Content:** Kanji forms, kana readings, POS tags, field/dialect markers, sense groupings, multilingual translations. The canonical Japanese dictionary dataset; supersedes the legacy EDICT plain-text format.
- **Python:** Use `jamdict` or parse the XML directly.

### JMnedict (Japanese Names Dictionary)
- **URL:** https://www.edrdg.org/enamdict/enamdict_doc.html
- **License:** CC BY-SA 4.0 (EDRDG)
- **Format:** XML (`JMnedict.xml.gz`)
- **Coverage:** ~488,000 entries — surnames, given names, place names, company names, station names
- **Python:** Included in `jamdict`.

### JmdictFurigana
- **URL:** https://github.com/Doublevil/JmdictFurigana
- **License:** CC BY-SA (mirrors JMdict)
- **Format:** JSON (gzip-compressed), auto-regenerated monthly via GitHub Actions
- **Coverage:** ~177,770 JMdict entries resolved; ~584,141 JMnedict entries resolved
- **Content:** Attaches kana readings to specific kanji spans within dictionary headwords. Fills a gap in JMdict, which does not annotate which kana reading applies to which kanji component. Useful as a lookup table for furigana generation: given a headword, find which kana maps to which kanji span.

### KANJIDIC2
- **URL:** https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
- **License:** CC BY-SA 4.0 (EDRDG)
- **Format:** XML (UTF-8)
- **Coverage:** 13,108 kanji (JIS X 0208, 0212, 0213)
- **Content:** Unicode code point, stroke count, school grade, JLPT level, frequency rank, on/kun readings, English meanings, cross-references to Heisig RTK frame numbers, Nelson index, and other dictionaries.
- **Python:** Included in `jamdict`.

### Wiktionary / kaikki.org
- **URL:** https://kaikki.org/dictionary/Japanese/index.html
- **Tool:** `wiktextract` — https://github.com/tatuylonen/wiktextract
- **License:** CC BY-SA / GFDL (Wiktionary source)
- **Format:** JSONL, ~351 MB uncompressed
- **Coverage:** ~170,783 Japanese word forms
- **Content:** Structured senses, etymology, pronunciation, forms. Broader coverage of loanwords and modern vocabulary than JMdict; POS tagging is less consistent.

---

## Kanji Datasets

### Jōyō Kanji (Official 2010 List)
- **Source:** Japanese Ministry of Education — 2,136 kanji mandated for general use
- **Machine-readable extraction:** `joyodb` — https://github.com/melissaboiko/joyodb (TSV/JSON/SQL/HTML; alpha-quality tool)
- **Also available from:** KANJIDIC2 (grade field), kanjiapi.dev (`/v1/kanji/joyo`), kanjium

### Kyōiku Kanji
- 1,026 kanji taught in elementary school (grades 1–6); a subset of the Jōyō list
- **Available from:** KANJIDIC2 (grade 1–6 entries), kanjiapi.dev (`/v1/kanji/grade-1` through `grade-6`)

### KanjiVG (Stroke Order SVGs)
- **URL:** https://kanjivg.tagaini.net/ / https://github.com/KanjiVG/kanjivg
- **License:** CC BY-SA 3.0
- **Format:** Individual SVG files; filename = lowercase hex Unicode code point (e.g. `04e2f.svg`); variants have suffixes
- **Content:** Stroke paths with direction, order, and stroke-type metadata. Components/radicals annotated as SVG groups. Covers 6,500+ kanji and variants.
- **Python:** `kanjivg` on PyPI

### kanjiapi.dev
- **URL:** https://kanjiapi.dev/ / https://github.com/onlyskin/kanjiapi.dev
- **License:** MIT (code); data from KANJIDIC (CC BY-SA), JMdict (CC BY-SA), Unicode Unihan
- **Format:** REST API returning JSON
- **Coverage:** 13,000+ kanji
- **Key endpoints:**
  - `/v1/kanji/{character}` — readings, stroke count, grade, JLPT, meanings
  - `/v1/kanji/joyo`, `/v1/kanji/jinmeiyo`, `/v1/kanji/heisig`
  - `/v1/kanji/grade-{1–8}` — by school grade
  - `/v1/reading/{reading}` — all kanji sharing a reading
  - `/v1/words/{character}` — words containing the kanji
- **Note:** HTTP requests only; no Python library. Mirrors KANJIDIC2 content.

### kanjium
- **URL:** https://github.com/mifunetoshiro/kanjium
- **License:** CC BY-SA 4.0
- **Format:** SQLite + supplementary files
- **Coverage:** 6,355+ kanji (jouyou, jinmeiyou, hyougaiji)
- **Content:** Readings, meanings, frequency (from 5,000+ novels + Wikipedia), stroke order images (~6,400), pitch accent, JLPT, example sentences, Chinese variants. Comprehensive all-in-one dataset; actively maintained.

### Kanji Frequency Lists (`kanji-frequency`)
- **URL:** https://github.com/scriptin/kanji-frequency
- **License:** CC BY 4.0
- **Format:** CSV per corpus (Aozora Bunko, Wikipedia, Wikinews)
- **Content:** Kanji ranked by frequency in each corpus.

### Heisig RTK Data
- The RTK frame numbers and keywords are copyrighted by James Heisig and not freely licensed.
- **KANJIDIC2** includes cross-references to Heisig frame numbers as metadata.
- Community datasets (GPL-3.0 / CSV) exist but the legal status of redistributing Heisig content is unclear — use with caution.

---

## Tokenizers and Morphological Analyzers

### MeCab
- **URL:** https://taku910.github.io/mecab/
- **License:** GPL-2.0 / LGPL-2.1 / BSD-3-Clause (tri-license, user's choice)
- **Language:** C++ with Python bindings
- **What it does:** Lattice-based morphological analysis (Viterbi). Segments Japanese text into tokens with POS tags, readings, and lemma forms. Accuracy depends on the dictionary used.
- **Python:** Use `fugashi` (preferred) or `mecab-python3`; both require a separate dictionary package.

#### MeCab Dictionaries

| Dictionary | License | Notes |
|---|---|---|
| **IPAdic** | BSD-style | ~400K entries; stable but not updated since ~2007. Widely compatible. |
| **UniDic** | GPL/LGPL/BSD | Modern standard for Universal Dependencies work. `unidic` on PyPI: ~770 MB. `unidic-lite`: ~250 MB (2013 snapshot). |
| **mecab-ipadic-NEologd** | Apache-2.0 | IPAdic extended with web neologisms. Last release August 2020; no longer actively maintained. Install via shell script only (no pip). |

### fugashi
- **URL:** https://github.com/polm/fugashi
- **PyPI:** `pip install fugashi`
- **License:** MIT + BSD-3-Clause
- **Version:** 1.5.2 (Oct 2025) — actively maintained
- **What it does:** Cython-based MeCab wrapper. Ships pre-built wheels for Linux, macOS, and Windows — no separate MeCab C library needed.
- **What it returns:** Token objects with `.surface`, `.feature` (named tuple with UniDic), `.pos`, `.lemma`. With UniDic, `.feature.reading` gives the kana reading for furigana construction.
- **Note:** Recommended Python MeCab interface. Used internally by `cutlet`.

### SudachiPy
- **URL:** https://github.com/WorksApplications/SudachiPy / https://worksapplications.github.io/sudachi.rs/python/
- **PyPI:** `pip install sudachipy sudachidict-core`
- **License:** Apache-2.0
- **Version:** 0.6.11 (April 2026) — most actively maintained tokenizer as of 2025
- **What it does:** Python bindings for the Rust `sudachi.rs` implementation. Three segmentation modes: A (shortest), B (middle), C (named-entity-aware).
- **What it returns:** Tokens with surface form, 7-level POS hierarchy, normalized form, dictionary form, reading form.
- **Dictionary packages:**
  - `sudachidict_small` (~50 MB) — basic vocabulary
  - `sudachidict_core` (~70 MB, default)
  - `sudachidict_full` (~1.5 GB) — full vocabulary
- **Note:** Backend tokenizer for spaCy Japanese models. Best choice for new projects.

### Janome
- **URL:** https://github.com/mocobeta/janome
- **PyPI:** `pip install janome`
- **License:** Apache-2.0
- **Version:** 0.5.0 (July 2023)
- **What it does:** Pure-Python morphological analyzer. Bundles mecab-ipadic (2007) as its dictionary — no external dependencies or compiled extensions.
- **Limitation:** 500–600 MB RAM at startup; slower than C/Rust tools. Last release July 2023.
- **Strength:** Easy cross-platform install with no compilation. Good for simple projects or constrained environments.

### Vaporetto
- **URL:** https://github.com/daac-tools/python-vaporetto
- **PyPI:** `pip install vaporetto`
- **License:** MIT or Apache-2.0
- **Version:** 0.3.3 (May 2026)
- **What it does:** Python wrapper for the Rust Vaporetto tokenizer. Uses pointwise prediction instead of lattice/CRF — claimed 5.7× faster than MeCab with equivalent accuracy.
- **Limitation:** Does not include pre-trained models; must be downloaded separately from the Vaporetto repository. Also accepts KyTea models.

### spaCy Japanese Models / GiNZA
- **spaCy models:** https://spacy.io/models/ja (`pip install spacy && python -m spacy download ja_core_news_sm`)
- **GiNZA:** https://github.com/megagonlabs/ginza (MIT)
- **Models:** `ja_core_news_sm/md/lg` (CC BY-SA 4.0); `ja_core_news_trf` (transformer-based)
- **What they do:** spaCy pipelines with SudachiPy tokenization, POS tagging, dependency parsing, NER, and (for md/lg) word vectors.

### Kuromoji
- **URL:** https://github.com/atilika/kuromoji
- **License:** Apache-2.0
- **Language:** Java only — no Python bindings
- **Note:** Powers Japanese in Apache Lucene/Solr/Elasticsearch. Not relevant for Python backends.

---

## Furigana and Reading Annotation

### pykakasi
- **URL:** https://github.com/miurahr/pykakasi
- **PyPI:** `pip install pykakasi`
- **License:** GPL-3.0 — copyleft propagates to derivative works
- **Version:** 2.3.0 (April 2026) — actively maintained
- **What it does:** Converts Japanese text (kanji + kana) to kana and/or romaji. Self-contained; uses an internal dictionary derived from kakasi and UniDic. No external dependencies.
- **What it returns:** Per-segment dicts with `orig`, `hira`, `kana`, `hepburn`, `passport`, `kunrei`. The `hira` field gives the hiragana reading, usable as furigana.
- **Note:** Not a morphological analyzer; uses simpler segmentation. GPL license is a constraint for MIT/Apache-licensed projects.

### fugashi + UniDic (for furigana)
- `token.feature.reading` on a fugashi/UniDic token gives the kana reading.
- No dedicated furigana-formatting helper is bundled — the application must pair the surface form with its reading and produce the annotation format (e.g. `漢字[よみ]`).

### JmdictFurigana (data resource)
- See Dictionaries section. Provides pre-computed furigana for JMdict dictionary entries — useful for looking up how a known headword should be annotated, not for arbitrary sentence annotation.

### cutlet
- **URL:** https://github.com/polm/cutlet
- **PyPI:** `pip install cutlet`
- **License:** MIT
- **Version:** 0.5.0 (January 2025)
- **What it does:** Japanese → romaji (not furigana). Internally uses fugashi + UniDic. Capitalizes proper nouns, handles loanword spellings, supports custom mappings.
- **Note:** Romaji output only — not suitable for kana furigana annotation.

---

## Corpus Data

### Aozora Bunko
- **URL:** https://www.aozora.gr.jp/ / GitHub mirror: https://github.com/aozorabunko/aozorabunko
- **License:** Public domain texts; metadata CC BY 2.1 JP
- **Size:** 17,700+ texts
- **Content:** Public-domain Japanese literature (pre-1970s). Plain text with ruby/furigana markup in a custom format. Freely downloadable in full (~4 GB).
- **Note:** Literary Japanese (classical and early modern); not representative of modern colloquial text.

### BCCWJ (Balanced Corpus of Contemporary Written Japanese)
- **URL:** https://clrd.ninjal.ac.jp/bccwj/en/
- **License:** Tiered access. Free web search (Shonagon/Chunagon); offline data download requires paid subscription.
- **Size:** 104.3 million words; books, magazines, newspapers, blogs, forums, laws, parliamentary minutes
- **Note:** The most comprehensive annotated Japanese corpus. The `UD Japanese-BCCWJ` subset (57,109 sentences) is available via the Universal Dependencies project.

---

## Python Utility Libraries

### jamdict
- **PyPI:** `pip install jamdict jamdict-data`
- **License:** MIT
- **Version:** 0.1a11.post2 (June 2021) — functional but last released 2021; underlying data may lag recent JMdict updates
- **Wraps:** JMdict, KANJIDIC2, JMnedict, KRADFILE/RADKFILE (kanji-radical mappings)
- **What it returns:** `jam.lookup('食べる')` returns `.entries` (JMdict), `.chars` (KANJIDIC2), `.names` (JMnedict). Supports `%` wildcards, reading queries, and radical lookups.
- **Note:** Most convenient all-in-one Python library for dictionary lookups.

### jaconv
- **PyPI:** `pip install jaconv`
- **License:** MIT
- **Version:** 0.5.0 (Feb 2026)
- **What it does:** Converts between hiragana ↔ katakana, full-width ↔ half-width. Unicode normalization for Japanese text. Not a tokenizer — a preprocessing utility.

### BudouX
- **URL:** https://github.com/google/budoux
- **PyPI:** `pip install budoux`
- **License:** Apache-2.0
- **What it does:** Segments Japanese text into natural phrase units for CSS line-break hints. Uses a small AdaBoost model (~15 KB). Not a morphological analyzer — no dictionary or POS tagging. Intended for web rendering (`<wbr>` injection), not reading annotation.

---

## Quick Comparison: Tokenizers

| Library | Language | License | Accuracy | Install complexity | Reading output | Last release |
|---|---|---|---|---|---|---|
| `fugashi` + UniDic | C++/Cython | MIT + BSD | High | Medium (dict download ~770 MB) | Yes | Oct 2025 |
| `sudachipy` + core dict | Rust/Python | Apache-2.0 | High | Easy (pip) | Yes | Apr 2026 |
| `janome` | Pure Python | Apache-2.0 | Medium | Easy (pip) | Yes | Jul 2023 |
| `vaporetto` | Rust/Python | MIT/Apache | High | Medium (model download) | Yes | May 2026 |
| spaCy `ja_core_news_sm` | Python | CC BY-SA | High | Easy (pip + download) | Via SudachiPy | Active |
| `pykakasi` | Pure Python | GPL-3.0 | Medium | Easy (pip) | Yes (hira) | Apr 2026 |
