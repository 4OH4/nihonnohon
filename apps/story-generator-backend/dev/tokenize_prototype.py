#!/usr/bin/env python3
"""
Prototype: Gemini translation + word segmentation, SudachiPy dictionary lookup.

Gemini translates each English sentence to Japanese and breaks it into
pedagogically meaningful words (verb stems + endings kept together, etc.).
SudachiPy is then used as a dictionary: given each word, look up its
kana reading and dictionary (base) form.

Usage:
    python tokenize_prototype.py

Requirements (beyond requirements.txt):
    pip install sudachipy sudachidict-core
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------

# When False (default), furigana is added only on the first occurrence of each
# word (keyed on dictionary form).  Set True to annotate every occurrence.
FURIGANA_ALL_OCCURRENCES: bool = False

# ---------------------------------------------------------------------------
# Story -- Genki Chapter 10 level
# ---------------------------------------------------------------------------

ENGLISH_STORY = [
    "Every morning, Kenji wakes up at seven o'clock and eats breakfast with his family.",
    "He usually has rice, miso soup, and a glass of orange juice.",
    "After eating breakfast, he gets ready and leaves for university.",
    "Kenji studies Japanese and history at university.",
    "He likes history better than Japanese, but both classes are interesting.",
    "In the afternoon, he goes to the library and studies for about two hours.",
    "His friend Yuki is also studying at the library today.",
    "They study together for a while, then drink coffee at a nearby cafe.",
    "The cafe is small but very comfortable, and the coffee is delicious.",
    "In the evening, Kenji returns home, takes a bath, and reads a book before sleeping.",
]

# ---------------------------------------------------------------------------
# Character utilities
# ---------------------------------------------------------------------------

_KANJI_RE = re.compile(
    "[一-鿿㐀-䶿豈-﫿々〻〃]"
)


def has_kanji(text: str) -> bool:
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
    """Return furigana annotation for a single morpheme.

    Strips matching trailing okurigana so only the kanji span is annotated:
      食べ  + たべ  → 食[た]べ
      勉強  + べんきょう → 勉強[べんきょう]
      帰っ  + かえっ → 帰[かえ]っ
      朝ごはん + あさごはん → 朝[あさ]ごはん
    """
    if not has_kanji(surface):
        return surface

    # Count matching trailing kana (okurigana) present in both surface and reading
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
# Gemini: translate + segment
# ---------------------------------------------------------------------------

_EXAMPLE = json.dumps(
    [
        {
            "english": "Kenji studies Japanese at university.",
            "japanese": "健二さんは大学で日本語を勉強しています。",
            "words": [
                "健二さん",
                "は",
                "大学",
                "で",
                "日本語",
                "を",
                "勉強しています",
                "。",
            ],
        }
    ],
    ensure_ascii=False,
    indent=2,
)


def translate_and_segment(sentences: list[str]) -> list[dict]:
    """Call Gemini to translate each sentence and segment the Japanese into words.

    Returns a list of {"english", "japanese", "words"} dicts.
    """
    from google import genai
    from google.genai import types as genai_types

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set")

    client = genai.Client(api_key=api_key)

    numbered = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(sentences))

    prompt = (
        "You are a Japanese language teacher helping to prepare graded reader content "
        "for Genki I Chapter 10 learners.\n\n"
        "For each English sentence below:\n"
        "1. Translate it into natural Japanese.\n"
        "2. Break the Japanese into a list of words as a learner would study them. "
        "Follow these segmentation rules:\n"
        "   - Keep verb stems attached to their polite endings: "
        "write 食べます not 食べ + ます, "
        "勉強しています not 勉強 + し + て + い + ます\n"
        "   - Keep particles (は, を, に, で, と, の, へ, から, まで, etc.) as separate words\n"
        "   - Include punctuation (、。) as separate tokens\n"
        "   - Keep さん / くん attached to names\n\n"
        f"Example output for one sentence:\n{_EXAMPLE}\n\n"
        "Return a JSON array with one object per sentence, each with keys "
        "\"english\", \"japanese\", and \"words\". "
        "Return only valid JSON, no markdown fences, no explanation.\n\n"
        f"Sentences:\n{numbered}"
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=0.2,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=4096),
        ),
    )

    raw = response.text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```\s*$", "", raw, flags=re.MULTILINE)
    return json.loads(raw.strip())


# ---------------------------------------------------------------------------
# SudachiPy + JMdict enrichment
# ---------------------------------------------------------------------------

# POS categories that are not content words; skip them for dictionary_form logic
_AUXILIARY_POS = {"助動詞", "助詞", "補助記号", "空白"}

# POS categories worth looking up in JMdict for an English gloss
_CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞", "副詞", "接続詞", "感動詞", "代名詞"}

_GENKI_CSV = Path(__file__).parent / "../../../resources/genki1vocab.csv"


def load_genki_index(csv_path: Path = _GENKI_CSV) -> tuple[dict[str, str], dict[str, str]]:
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
            kanji = row[2].strip().lstrip("〜")   # strip leading 〜
            english = row[3].strip()
            if not english:
                continue
            # Column 1 may contain multiple readings separated by ;
            # Keep first occurrence — later entries for the same headword are
            # typically less common meanings (e.g. 本 as book before 本 as counter)
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


def _derive_dictionary_form(morphemes: list) -> str:
    """Return the most useful dictionary form for a (possibly multi-morpheme) word.

    - For a plain verb or adjective: the first verb/adjective morpheme's dict form.
    - For a suru-verb compound (noun + suru): surface-of-noun + "する".
    - Otherwise: first morpheme's dict form.
    """
    if not morphemes:
        return ""

    content = [m for m in morphemes if m.part_of_speech()[0] not in _AUXILIARY_POS]
    if not content:
        return morphemes[0].dictionary_form()

    first = content[0]
    first_pos = first.part_of_speech()[0]

    # Suru-verb compound: 名詞 followed by a する-verb morpheme
    if (
        first_pos == "名詞"  # 名詞
        and len(content) >= 2
        and content[1].dictionary_form() == "する"  # する
    ):
        return first.surface() + "する"

    # Verb stem: return the verb's dictionary form
    if first_pos == "動詞":  # 動詞
        return first.dictionary_form()

    # Adjective
    if first_pos in ("形容詞",):  # 形容詞
        return first.dictionary_form()

    return first.dictionary_form()


def _dominant_pos(morphemes: list) -> str:
    """Return the major POS of the first content morpheme, or the first morpheme's POS."""
    for m in morphemes:
        if m.part_of_speech()[0] not in _AUXILIARY_POS:
            return m.part_of_speech()[0]
    return morphemes[0].part_of_speech()[0] if morphemes else ""


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


def _pos_code(morphemes: list) -> str:
    """Return a compact POS code for the word.

    Verb conjugation type is read from the SudachiPy 活用型 field:
      五段-*  → v5  (godan)
      *一段-* → v1  (ichidan)
      サ行変格 / カ行変格 → v-irr  (する / くる)
    Suru-verb compounds (名詞 + する) are detected and returned as v-irr.
    """
    content = [m for m in morphemes if m.part_of_speech()[0] not in _AUXILIARY_POS]
    if not content:
        # Word is entirely particles/auxiliaries — return the first morpheme's POS code
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


_ALL_KANA_RE = re.compile(r"^[ぁ-ゟァ-ヿ]+$")


def lookup_gloss(dictionary_form: str, jam) -> list[str]:
    """Return English glosses for dictionary_form from JMdict (first sense of first entry).

    Skips short all-kana strings (particles, auxiliaries that slipped through POS filtering).
    """
    if not dictionary_form:
        return []
    if len(dictionary_form) <= 2 and _ALL_KANA_RE.match(dictionary_form):
        return []
    result = jam.lookup(dictionary_form)
    if not result.entries:
        return []
    return [str(g) for g in result.entries[0].senses[0].gloss]


def enrich_word(
    word: str,
    tokenizer,
    seen_dict_forms: set[str] | None = None,
) -> dict:
    """Look up a single word in SudachiPy to get its reading, dictionary form, and POS.

    Args:
        seen_dict_forms: Pass a set to enable first-occurrence furigana mode.
            Words whose dictionary form is already in the set are returned with
            plain surface text (no furigana brackets).  The set is updated in
            place as new kanji words are encountered.
            Pass None to annotate every occurrence regardless.

    Returns {"annotated", "dictionary_form", "reading", "pos", "pos_code"}.
    """
    import sudachipy

    morphemes = tokenizer.tokenize(word, sudachipy.SplitMode.C)

    reading_hira = kata_to_hira(
        "".join(m.reading_form() for m in morphemes)
    )

    dict_form = _derive_dictionary_form(morphemes)
    pos = _dominant_pos(morphemes)
    pos_code = _pos_code(morphemes)

    # Build annotation morpheme-by-morpheme, stripping okurigana so only the
    # kanji span is bracketed: 食べます → 食[た]べます, 起きて → 起[お]きて
    if seen_dict_forms is not None and dict_form in seen_dict_forms:
        annotated = word  # subsequent occurrence — no furigana
    else:
        annotated = "".join(
            _annotate_morpheme(m.surface(), kata_to_hira(m.reading_form()))
            for m in morphemes
        )
        # Register as seen only if the word actually contains kanji
        if seen_dict_forms is not None and has_kanji(word):
            seen_dict_forms.add(dict_form)

    return {
        "annotated": annotated,
        "dictionary_form": dict_form,
        "reading": reading_hira,
        "pos": pos,
        "pos_code": pos_code,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    # Step 1 -- translate and segment via Gemini
    print("Step 1: Translating and segmenting via Gemini...", flush=True)
    sentences = translate_and_segment(ENGLISH_STORY)
    print(f"  Received {len(sentences)} sentences.\n", flush=True)

    # Step 2 -- initialise SudachiPy
    print("Step 2: Initialising SudachiPy...", flush=True)
    import sudachipy

    dictionary = sudachipy.Dictionary()
    tokenizer = dictionary.create()
    print("  Ready.\n", flush=True)

    # Step 3 -- load Genki vocab index
    print("Step 3: Loading Genki vocab index...", flush=True)
    kanji_index, kana_index = load_genki_index()
    print(f"  {len(kanji_index)} kanji entries, {len(kana_index)} kana entries.\n", flush=True)

    # Step 4 -- initialise jamdict (fallback for words not in Genki)
    print("Step 4: Initialising jamdict...", flush=True)
    from jamdict import Jamdict
    jam = Jamdict()
    print("  Ready.\n", flush=True)

    # Step 5 -- enrich each word with reading, dictionary form, and English gloss
    print("Step 5: Enriching words...\n", flush=True)
    # None → annotate every occurrence; set() → annotate first occurrence only
    seen_dict_forms: set[str] | None = None if FURIGANA_ALL_OCCURRENCES else set()
    results = []
    for s in sentences:
        enriched_words = [enrich_word(w, tokenizer, seen_dict_forms) for w in s.get("words", [])]
        vocab = []
        for i, w in enumerate(enriched_words):
            entry: dict = {
                "surface": s["words"][i],
                "dictionary_form": w["dictionary_form"],
                "reading": w["reading"],
                "pos": w["pos_code"],
            }
            if w["pos"] in _CONTENT_POS:
                genki_def = lookup_genki(w["dictionary_form"], kanji_index, kana_index)
                if genki_def:
                    entry["gloss"] = genki_def
                    entry["gloss_source"] = "genki"
                else:
                    jmdict_gloss = lookup_gloss(w["dictionary_form"], jam)
                    if jmdict_gloss:
                        entry["gloss"] = jmdict_gloss
                        entry["gloss_source"] = "jmdict"
            vocab.append(entry)
        results.append({
            "english": s.get("english", ""),
            "japanese": s.get("japanese", ""),
            "words": [w["annotated"] for w in enriched_words],
            "vocab": vocab,
        })

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
