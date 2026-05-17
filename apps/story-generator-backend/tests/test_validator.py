from story_generator.validator import validate, ValidationResult


def test_validate_missing_field_returns_invalid():
    """validate() returns valid=False with MISSING_FIELD error when title is absent."""
    result = validate(
        {
            "schema_version": "1",
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
