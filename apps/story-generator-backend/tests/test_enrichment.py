"""Integration tests for EnrichmentPipeline.

Requires sudachipy, sudachidict-core, jamdict, and jamdict-data-fix to be installed.
The entire module is skipped gracefully when sudachipy is absent.
"""
from __future__ import annotations

import pytest

sudachipy = pytest.importorskip("sudachipy")

from pathlib import Path  # noqa: E402

from story_generator.enrichment import EnrichmentPipeline  # noqa: E402

GENKI_CSV = Path(__file__).parents[3] / "resources" / "genki1vocab.csv"


@pytest.fixture(scope="module")
def pipeline() -> EnrichmentPipeline:
    """One pipeline instance shared across all tests — pays the SudachiPy startup cost once."""
    return EnrichmentPipeline(genki_csv_path=GENKI_CSV)


# ---------------------------------------------------------------------------
# AC3 — Okurigana stripping
# ---------------------------------------------------------------------------


def test_okurigana_taberu(pipeline: EnrichmentPipeline) -> None:
    """食べます → 食[た]べます (only kanji 食 bracketed, べます bare)."""
    result = pipeline.enrich_sentence(["食べます"])
    assert result[0]["annotated"] == "食[た]べます"
    assert result[0]["pos_code"] == "v1"


def test_okurigana_okiru(pipeline: EnrichmentPipeline) -> None:
    """起きて → 起[お]きて."""
    result = pipeline.enrich_sentence(["起きて"])
    assert result[0]["annotated"] == "起[お]きて"


def test_okurigana_kaeru(pipeline: EnrichmentPipeline) -> None:
    """帰った → 帰[かえ]った (godan verb)."""
    result = pipeline.enrich_sentence(["帰った"])
    assert result[0]["annotated"] == "帰[かえ]った"
    assert result[0]["pos_code"] == "v5"


def test_all_kanji_benkyou(pipeline: EnrichmentPipeline) -> None:
    """勉強 → 勉強[べんきょう] (no okurigana to strip)."""
    result = pipeline.enrich_sentence(["勉強"])
    assert result[0]["annotated"] == "勉強[べんきょう]"
    assert result[0]["pos_code"] == "n"


def test_mixed_morpheme_asagohan(pipeline: EnrichmentPipeline) -> None:
    """朝ごはん → 朝[あさ]ごはん (only kanji morpheme gets bracket)."""
    result = pipeline.enrich_sentence(["朝ごはん"])
    assert result[0]["annotated"] == "朝[あさ]ごはん"
    assert result[0]["pos_code"] == "n"


def test_okurigana_benkyousuru(pipeline: EnrichmentPipeline) -> None:
    """勉強する → 勉強[べんきょう]する (kanji annotated, する bare)."""
    result = pipeline.enrich_sentence(["勉強する"])
    assert result[0]["annotated"] == "勉強[べんきょう]する"


def test_pure_kana_unchanged(pipeline: EnrichmentPipeline) -> None:
    """Pure-kana words are returned unchanged with no brackets."""
    result = pipeline.enrich_sentence(["は", "を", "です"])
    assert result[0]["annotated"] == "は"
    assert result[1]["annotated"] == "を"
    assert result[2]["annotated"] == "です"


# ---------------------------------------------------------------------------
# AC4 — First-occurrence furigana suppression
# ---------------------------------------------------------------------------


def test_first_occurrence_suppression_on(pipeline: EnrichmentPipeline) -> None:
    """With a shared seen set, second occurrence of 食べる gets no furigana."""
    seen: set[str] = set()
    results = pipeline.enrich_sentence(["食べます", "食べた"], seen_dict_forms=seen)
    assert "食[た]べ" in results[0]["annotated"]  # first occurrence — annotated
    assert results[1]["annotated"] == "食べた"     # second occurrence — plain


def test_first_occurrence_suppression_off(pipeline: EnrichmentPipeline) -> None:
    """With seen_dict_forms=None, all occurrences of 食べる get furigana."""
    results = pipeline.enrich_sentence(["食べます", "食べた"], seen_dict_forms=None)
    assert "食[た]べ" in results[0]["annotated"]
    assert "食[た]べ" in results[1]["annotated"]


def test_seen_set_updated_in_place(pipeline: EnrichmentPipeline) -> None:
    """seen_dict_forms set is mutated by enrich_sentence (caller can reuse it)."""
    seen: set[str] = set()
    pipeline.enrich_sentence(["食べます"], seen_dict_forms=seen)
    assert "食べる" in seen


def test_seen_set_cross_call(pipeline: EnrichmentPipeline) -> None:
    """seen_dict_forms shared across two separate calls suppresses furigana on second call."""
    seen: set[str] = set()
    pipeline.enrich_sentence(["食べます"], seen_dict_forms=seen)
    result2 = pipeline.enrich_sentence(["食べた"], seen_dict_forms=seen)
    assert result2[0]["annotated"] == "食べた"  # no furigana — already seen across calls


# ---------------------------------------------------------------------------
# AC5 — POS codes
# ---------------------------------------------------------------------------


def test_pos_suru_verb_compound(pipeline: EnrichmentPipeline) -> None:
    """勉強します → pos_code=v-irr, dictionary_form=勉強する."""
    result = pipeline.enrich_sentence(["勉強します"])
    assert result[0]["pos_code"] == "v-irr"
    assert result[0]["dictionary_form"] == "勉強する"


def test_pos_godan_verb(pipeline: EnrichmentPipeline) -> None:
    """飲みます (飲む) → pos_code=v5."""
    result = pipeline.enrich_sentence(["飲みます"])
    assert result[0]["pos_code"] == "v5"


def test_pos_ichidan_verb(pipeline: EnrichmentPipeline) -> None:
    """食べます (食べる) → pos_code=v1."""
    result = pipeline.enrich_sentence(["食べます"])
    assert result[0]["pos_code"] == "v1"


def test_pos_i_adjective(pipeline: EnrichmentPipeline) -> None:
    """おいしい → pos_code=adj-i."""
    result = pipeline.enrich_sentence(["おいしい"])
    assert result[0]["pos_code"] == "adj-i"


def test_pos_na_adjective(pipeline: EnrichmentPipeline) -> None:
    """好きです → pos_code=adj-na (形状詞)."""
    result = pipeline.enrich_sentence(["好きです"])
    assert result[0]["pos_code"] == "adj-na"


def test_pos_particle(pipeline: EnrichmentPipeline) -> None:
    """は → pos_code=prt."""
    result = pipeline.enrich_sentence(["は"])
    assert result[0]["pos_code"] == "prt"


def test_pos_noun(pipeline: EnrichmentPipeline) -> None:
    """大学 → pos_code=n."""
    result = pipeline.enrich_sentence(["大学"])
    assert result[0]["pos_code"] == "n"


# ---------------------------------------------------------------------------
# AC6 — Gloss lookup
# ---------------------------------------------------------------------------


def test_gloss_genki_hit(pipeline: EnrichmentPipeline) -> None:
    """食べる is in Genki I — gloss_source should be 'genki'."""
    result = pipeline.enrich_sentence(["食べます"])
    assert result[0].get("gloss_source") == "genki"
    assert result[0].get("gloss")


def test_gloss_jmdict_fallback(pipeline: EnrichmentPipeline) -> None:
    """眠る is not in Genki I — should fall back to JMdict."""
    result = pipeline.enrich_sentence(["眠る"])
    assert result[0].get("gloss_source") == "jmdict"
    assert result[0].get("gloss")


def test_gloss_short_kana_skip(pipeline: EnrichmentPipeline) -> None:
    """Short kana particle に gets no gloss lookup."""
    result = pipeline.enrich_sentence(["に"])
    assert "gloss" not in result[0]
    assert "gloss_source" not in result[0]


def test_gloss_absent_for_particle(pipeline: EnrichmentPipeline) -> None:
    """Particles (not in _CONTENT_POS) never have a gloss key in the result."""
    result = pipeline.enrich_sentence(["は", "を", "で"])
    for entry in result:
        assert "gloss" not in entry
        assert "gloss_source" not in entry


def test_lookup_gloss_short_kana_guard(pipeline: EnrichmentPipeline) -> None:
    """lookup_gloss returns None for short all-kana strings (≤2 chars) without querying JMdict."""
    from story_generator.enrichment import lookup_gloss

    assert lookup_gloss("め", pipeline._jam) is None   # 1-char kana — guard fires
    assert lookup_gloss("いい", pipeline._jam) is None  # 2-char kana — guard fires regardless of JMdict entry
