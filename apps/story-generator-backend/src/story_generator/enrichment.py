"""SudachiPy-based tokenization and vocab enrichment for story generation."""
from __future__ import annotations

import csv
import re
from pathlib import Path

# ---------------------------------------------------------------------------
# Character utilities
# ---------------------------------------------------------------------------

_KANJI_RE = re.compile(
    "[一-鿿㐀-䶿豈-﫿々〻〃]"
)


def has_kanji(text: str) -> bool:
    """Return True if text contains at least one kanji character."""
    return bool(_KANJI_RE.search(text))


def _is_kana(c: str) -> bool:
    return "ぁ" <= c <= "ゟ" or "ァ" <= c <= "ヿ"


def kata_to_hira(text: str) -> str:
    """Convert katakana to hiragana (codepoint offset 0x60)."""
    return "".join(
        chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c
        for c in text
    )


def _annotate_morpheme(surface: str, reading_hira: str) -> str:
    """Return inline furigana annotation for a single morpheme, stripping okurigana.

    食べ + たべ → 食[た]べ
    勉強 + べんきょう → 勉強[べんきょう]
    帰っ + かえっ → 帰[かえ]っ
    朝ごはん + あさごはん → 朝[あさ]ごはん
    """
    if not has_kanji(surface):
        return surface

    # Count matching trailing kana present in both surface and reading (okurigana)
    i = 0
    while (
        i < len(surface)
        and i < len(reading_hira)
        and _is_kana(surface[-(i + 1)])
        and surface[-(i + 1)] == reading_hira[-(i + 1)]
    ):
        i += 1

    if i == 0:
        return f"{surface}[{reading_hira}]"
    kanji_part = surface[:-i]
    kanji_reading = reading_hira[:-i]
    okurigana = surface[-i:]
    return f"{kanji_part}[{kanji_reading}]{okurigana}"


# ---------------------------------------------------------------------------
# POS helpers
# ---------------------------------------------------------------------------

# SudachiPy major POS categories that are not content words
_AUXILIARY_POS = {"助動詞", "助詞", "補助記号", "空白"}

# Major POS categories worth looking up in a dictionary
_CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞", "副詞", "接続詞", "感動詞", "代名詞"}

# Compact POS codes used in build_enriched_story vocab key assignment
_CONTENT_POS_CODES = {"n", "v1", "v5", "v-irr", "adj-i", "adj-na", "adv", "pron", "conj"}

_POS_MAP = {
    "名詞": "n",
    "形容詞": "adj-i",
    "形状詞": "adj-na",
    "副詞": "adv",
    "代名詞": "pron",
    "接続詞": "conj",
    "接頭辞": "pref",
    "接尾辞": "suff",
    "助詞": "prt",
}


def _derive_dictionary_form(morphemes: list) -> str:
    """Return the most useful dictionary form for a (possibly multi-morpheme) word.

    Handles suru-verb compounds (名詞 + する) specially; falls back to the first
    content morpheme's dictionary form for verbs and adjectives.
    """
    if not morphemes:
        return ""

    content = [m for m in morphemes if m.part_of_speech()[0] not in _AUXILIARY_POS]
    if not content:
        return morphemes[0].dictionary_form()

    first = content[0]
    first_pos = first.part_of_speech()[0]

    # Suru-verb compound: 名詞 immediately followed by a する-verb morpheme
    if (
        first_pos == "名詞"
        and len(content) >= 2
        and content[1].dictionary_form() == "する"
    ):
        return first.surface() + "する"

    if first_pos in ("動詞", "形容詞"):
        return first.dictionary_form()

    return first.dictionary_form()


def _dominant_pos(morphemes: list) -> str:
    """Return the major POS of the first content morpheme, or the first morpheme's POS."""
    for m in morphemes:
        if m.part_of_speech()[0] not in _AUXILIARY_POS:
            return m.part_of_speech()[0]
    return morphemes[0].part_of_speech()[0] if morphemes else ""


def _pos_code(morphemes: list) -> str:
    """Return a compact POS code for the word.

    Verb conjugation type is read from the SudachiPy 活用型 field (index 4):
      五段-*  → v5 (godan)
      *一段-* → v1 (ichidan)
      サ行変格 / カ行変格 → v-irr (する / くる)
    Suru-verb compounds (名詞 + する) are detected and returned as v-irr.
    """
    content = [m for m in morphemes if m.part_of_speech()[0] not in _AUXILIARY_POS]
    if not content:
        return _POS_MAP.get(morphemes[0].part_of_speech()[0], "") if morphemes else ""

    first = content[0]
    major = first.part_of_speech()[0]

    # Suru-verb compound: 名詞 immediately followed by する-verb
    if major == "名詞" and len(content) >= 2 and content[1].dictionary_form() == "する":
        return "v-irr"

    if major == "動詞":
        conj_type = first.part_of_speech()[4]
        if "五段" in conj_type:
            return "v5"
        if conj_type in ("サ行変格", "カ行変格"):
            return "v-irr"
        return "v1"  # 上一段 / 下一段

    return _POS_MAP.get(major, "")


# ---------------------------------------------------------------------------
# Genki CSV index
# ---------------------------------------------------------------------------


def load_genki_key_index(csv_path: Path) -> tuple[dict[str, int], dict[str, int]]:
    """Parse genki1vocab.csv into kanji and kana row-ID indexes.

    Returns (kanji_id_index, kana_id_index) mapping headword → integer row ID (1–1172).
    Used by build_enriched_story to assign Genki vocab_keys by construction.
    """
    kanji_id_index: dict[str, int] = {}
    kana_id_index: dict[str, int] = {}
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            row_id = int(row[0])
            kanji = row[2].strip().lstrip("〜")
            for reading in row[1].split(";"):
                reading = reading.strip().lstrip("〜")
                if reading and reading not in kana_id_index:
                    kana_id_index[reading] = row_id
            if kanji and kanji not in kanji_id_index:
                kanji_id_index[kanji] = row_id
    return kanji_id_index, kana_id_index


def load_genki_index(csv_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Parse genki1vocab.csv into kanji and kana lookup indexes.

    Returns (kanji_index, kana_index) mapping headword → English definition.
    Both indexes are checked on each lookup; kanji form is tried first.
    """
    kanji_index: dict[str, str] = {}
    kana_index: dict[str, str] = {}
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 4:
                continue
            kanji = row[2].strip().lstrip("〜")
            english = row[3].strip()
            if not english:
                continue
            for reading in row[1].split(";"):
                reading = reading.strip().lstrip("〜")
                if reading and reading not in kana_index:
                    kana_index[reading] = english
            if kanji and kanji not in kanji_index:
                kanji_index[kanji] = english
    return kanji_index, kana_index


def lookup_genki(
    dictionary_form: str,
    kanji_index: dict[str, str],
    kana_index: dict[str, str],
) -> str | None:
    """Return the Genki English definition for dictionary_form, or None."""
    return kanji_index.get(dictionary_form) or kana_index.get(dictionary_form)


# ---------------------------------------------------------------------------
# JMdict gloss lookup
# ---------------------------------------------------------------------------

_ALL_KANA_RE = re.compile(r"^[ぁ-ゟァ-ヿ]+$")


def lookup_gloss(dictionary_form: str, jam) -> str | None:
    """Return the first English gloss for dictionary_form from JMdict, or None.

    Skips short all-kana strings to avoid looking up particles and auxiliaries
    that slipped through POS filtering.
    """
    if not dictionary_form:
        return None
    if len(dictionary_form) <= 2 and _ALL_KANA_RE.match(dictionary_form):
        return None
    result = jam.lookup(dictionary_form)
    if not result.entries:
        return None
    senses = result.entries[0].senses
    if not senses:
        return None
    glosses = senses[0].gloss
    return str(glosses[0]) if glosses else None


# ---------------------------------------------------------------------------
# EnrichmentPipeline
# ---------------------------------------------------------------------------


class EnrichmentPipeline:
    """Deterministic morphological enrichment using SudachiPy, Genki CSV, and JMdict.

    Instantiate once at application startup — SudachiPy dictionary loading takes ~1–2 seconds.
    """

    def __init__(self, genki_csv_path: Path) -> None:
        """Initialise SudachiPy, load the Genki vocab index, and initialise Jamdict.

        Args:
            genki_csv_path: Absolute path to genki1vocab.csv.
        """
        import sudachipy
        from jamdict import Jamdict

        self._dictionary = sudachipy.Dictionary()
        self._tokenizer = self._dictionary.create()
        self._kanji_index, self._kana_index = load_genki_index(genki_csv_path)
        self._kanji_id_index, self._kana_id_index = load_genki_key_index(genki_csv_path)
        self._jam = Jamdict()

    def enrich_sentence(
        self,
        words: list[str],
        seen_dict_forms: set[str] | None = None,
    ) -> list[dict]:
        """Enrich a list of pre-segmented Japanese words with furigana, POS, and gloss.

        Args:
            words: Surface word strings from Gemini word segmentation.
            seen_dict_forms: Mutable set for first-occurrence furigana tracking; updated
                in-place so the same set can be passed across multiple calls for a full story.
                Pass None to annotate every kanji word on every occurrence.

        Returns:
            One dict per word with keys: ``annotated``, ``dictionary_form``, ``reading``,
            ``pos_code``, and optionally ``gloss`` + ``gloss_source`` when a definition is found.
        """
        import sudachipy

        results = []
        for word in words:
            morphemes = self._tokenizer.tokenize(word, sudachipy.SplitMode.C)

            reading_hira = kata_to_hira(
                "".join(m.reading_form() for m in morphemes)
            )
            dict_form = _derive_dictionary_form(morphemes)
            major_pos = _dominant_pos(morphemes)
            pos_code = _pos_code(morphemes)

            # Furigana annotation with optional first-occurrence suppression
            if seen_dict_forms is not None and dict_form in seen_dict_forms:
                annotated = word  # subsequent occurrence — no furigana
            else:
                annotated = "".join(
                    _annotate_morpheme(m.surface(), kata_to_hira(m.reading_form()))
                    for m in morphemes
                )
                if seen_dict_forms is not None and has_kanji(word):
                    seen_dict_forms.add(dict_form)

            entry: dict = {
                "annotated": annotated,
                "dictionary_form": dict_form,
                "reading": reading_hira,
                "pos_code": pos_code,
            }

            # Gloss lookup — content words only; absent entirely when not found
            if major_pos in _CONTENT_POS:
                genki_def = lookup_genki(dict_form, self._kanji_index, self._kana_index)
                if genki_def:
                    entry["gloss"] = genki_def
                    entry["gloss_source"] = "genki"
                else:
                    jmdict_gloss = lookup_gloss(dict_form, self._jam)
                    if jmdict_gloss:
                        entry["gloss"] = jmdict_gloss
                        entry["gloss_source"] = "jmdict"

            results.append(entry)

        return results

    def _lookup_genki_id(self, dictionary_form: str) -> int | None:
        """Return the Genki CSV row ID for dictionary_form, or None. IDs are 1–1172."""
        return self._kanji_id_index.get(dictionary_form) or self._kana_id_index.get(dictionary_form)

    def build_enriched_story(self, segments: list[dict], story_meta: dict) -> dict:
        """Build a complete story dict from pre-segmented sentences and story metadata.

        Assigns furigana, vocab_keys, and vocab_supplement deterministically without LLM input.

        Args:
            segments: List of sentence dicts from Gemini, each with ``english``, ``japanese``,
                ``words`` (surface strings), and optional ``grammar`` (index list).
            story_meta: Dict with ``id``, ``title``, ``title_ja``, ``description``,
                ``grammar`` (story-level pattern list), and ``difficulty``.

        Returns:
            Complete story dict in v2 wire format, ready for schema validation.

        Raises:
            ValueError: If a segment's joined words don't reconstruct its ``japanese`` string.
        """
        # Shared state across all sentences
        seen_dict_forms: set[str] = set()
        supp_key_counter = 10000
        supp_key_map: dict[str, int] = {}  # dictionary_form → assigned supplemental key
        vocab_supplement: list[dict] = []
        built_sentences: list[dict] = []

        for i, segment in enumerate(segments):
            # Word boundary validation — Gemini output must reconstruct the Japanese sentence
            words_raw: list[str] = segment.get("words") or []
            japanese = segment.get("japanese", "")
            joined = "".join(words_raw)
            expected = japanese.replace(" ", "")
            if joined != expected:
                raise ValueError(
                    f"Sentence {i + 1}: joined words {joined!r} != japanese {expected!r}"
                )

            # Morphological enrichment with shared furigana suppression set
            enriched_results = self.enrich_sentence(words_raw, seen_dict_forms)
            if len(enriched_results) != len(words_raw):
                raise ValueError(
                    f"Sentence {i + 1}: enrich_sentence returned {len(enriched_results)} results "
                    f"for {len(words_raw)} words — tokenisation mismatch"
                )

            # Assign vocab keys per word
            vocab_keys: list[int | None] = []
            annotated_words: list[str] = []
            for surface, enriched in zip(words_raw, enriched_results):
                annotated_words.append(enriched["annotated"])
                dict_form = enriched["dictionary_form"]
                pos_code = enriched["pos_code"]

                # 1. Try Genki lookup by dictionary form
                genki_id = self._lookup_genki_id(dict_form)
                if genki_id is not None:
                    vocab_keys.append(genki_id)
                    continue

                # 2. Particles and punctuation → null
                if pos_code in ("prt", ""):
                    vocab_keys.append(None)
                    continue

                # 3. Content words → supplemental key (reuse if same dict form seen before)
                if pos_code in _CONTENT_POS_CODES:
                    if dict_form in supp_key_map:
                        vocab_keys.append(supp_key_map[dict_form])
                    else:
                        key = supp_key_counter
                        supp_key_counter += 1
                        supp_key_map[dict_form] = key
                        vocab_supplement.append({
                            "key": key,
                            "word": surface,
                            "hiragana": enriched["reading"],
                            "translation": enriched.get("gloss", ""),
                            "pos": pos_code,
                            "dictionary_form": dict_form,
                        })
                        vocab_keys.append(key)
                    continue

                # 4. Suffixes, prefixes, and other non-content words not in Genki → null
                vocab_keys.append(None)

            built_sentences.append({
                "id": f"s{i + 1:02d}",
                "words": annotated_words,
                "vocab_keys": vocab_keys,
                "translation": segment.get("english", ""),
                "grammar": segment.get("grammar", []),
            })

        return {
            "schema_version": "2",
            "id": story_meta.get("id", ""),
            "title": story_meta.get("title", ""),
            "title_ja": story_meta.get("title_ja", ""),
            "language": "ja",
            "description": story_meta.get("description", ""),
            "difficulty": story_meta.get("difficulty", ""),
            "grammar": story_meta.get("grammar", []),
            "vocab_supplement": vocab_supplement,
            "sentences": built_sentences,
        }
