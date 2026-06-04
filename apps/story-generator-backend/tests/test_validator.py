from story_generator.validator import validate, ValidationResult


def _minimal_story(**overrides) -> dict:
    """Return a minimal valid v2 story dict, with optional field overrides."""
    base = {
        "schema_version": "2",
        "id": "test-story",
        "title": "Test",
        "title_ja": "テスト",
        "language": "ja",
        "description": "A test story.",
        "sentences": [
            {"id": "s01", "words": ["は"], "vocab_keys": [None]},
        ],
    }
    base.update(overrides)
    return base


def test_validate_missing_field_returns_invalid():
    """validate() returns valid=False with MISSING_FIELD error when title is absent."""
    result = validate(
        {
            "schema_version": "2",
            "id": "x",
            "title_ja": "x",
            "language": "ja",
            "description": "x",
            "sentences": [],
        }
    )
    assert isinstance(result, ValidationResult)
    assert result.valid is False
    assert any(e.code == "MISSING_FIELD" and e.message == "Required field 'title' is absent." for e in result.errors)


def test_validate_never_raises():
    """validate() must not raise under any input — including None, empty dict, garbage."""
    for bad in [None, {}, {"junk": 123}, [], "string", 42, object()]:
        result = validate(bad)  # type: ignore[arg-type]
        assert isinstance(result, ValidationResult)
        assert result.valid is False


# ---------------------------------------------------------------------------
# Inline annotation bracket validation (v2 format)
# ---------------------------------------------------------------------------


def test_validate_well_formed_annotation_passes():
    """A sentence word with a valid 漢字[よみ] annotation passes validation."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["学生[がくせい]"], "vocab_keys": [42]},
    ])
    result = validate(story)
    assert result.valid is True, [e.message for e in result.errors]


def test_validate_multiple_annotations_pass():
    """Words with multiple inline annotations (separate kanji) pass validation."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["付[つ]け加[くわ]える"], "vocab_keys": [None]},
    ])
    result = validate(story)
    assert result.valid is True, [e.message for e in result.errors]


def test_validate_plain_word_passes():
    """A plain hiragana/katakana word with no brackets passes validation."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["は", "の", "です"], "vocab_keys": [None, None, None]},
    ])
    result = validate(story)
    assert result.valid is True, [e.message for e in result.errors]


def test_validate_malformed_bracket_unclosed_fails():
    """A word with an unclosed '[' bracket fails with VALIDATION_ERROR and a clear message."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["食[た"], "vocab_keys": [None]},
    ])
    result = validate(story)
    assert result.valid is False
    assert any(
        e.code == "VALIDATION_ERROR" and "食[た" in e.message
        for e in result.errors
    ), [e.message for e in result.errors]


def test_validate_bracket_not_preceded_by_kanji_fails():
    """A '[' not immediately preceded by a kanji character fails with VALIDATION_ERROR."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["は[な]"], "vocab_keys": [None]},
    ])
    result = validate(story)
    assert result.valid is False
    assert any(
        e.code == "VALIDATION_ERROR" and "は[な]" in e.message
        for e in result.errors
    ), [e.message for e in result.errors]


def test_validate_iteration_mark_kanji_passes():
    """々 (ideographic iteration mark) is treated as kanji, so 時々[ときどき] is valid."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": ["時々[ときどき]"], "vocab_keys": [None]},
    ])
    result = validate(story)
    assert not any(
        e.code == "VALIDATION_ERROR" and "時々" in e.message
        for e in result.errors
    ), [e.message for e in result.errors]


def test_validate_empty_string_word_does_not_crash():
    """An empty string in words does not cause validate() to raise — no bracket error added."""
    story = _minimal_story(sentences=[
        {"id": "s01", "words": [""], "vocab_keys": [None]},
    ])
    result = validate(story)
    # Empty string has no '[', so no bracket error — other validators may still reject it
    assert isinstance(result, ValidationResult)
    assert not any(e.code == "VALIDATION_ERROR" and "''" in e.message for e in result.errors)
