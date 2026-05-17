"""Structural validator for nihonnohon story dicts."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ValidationError:
    """A single validation failure."""

    code: str  # MISSING_FIELD | PARALLEL_ARRAY_MISMATCH | VALIDATION_ERROR
    message: str
    sentence_index: int | None  # None when error is not sentence-specific


@dataclass(frozen=True)
class ValidationResult:
    """Outcome of a validate() call. Always returned, never raised."""

    valid: bool
    errors: list[ValidationError] = field(default_factory=list)


# Required top-level fields per story.v1.json
_REQUIRED_FIELDS = frozenset(
    {"schema_version", "id", "title", "title_ja", "language", "description", "sentences"}
)


def validate(story_dict: dict) -> ValidationResult:
    """Validate structural invariants of a story dict.

    Checks (in order):
    1. Required top-level field presence
    2. Parallel array parity per sentence (words / ruby / vocab_keys must be equal length)

    Never raises under any input.
    """
    try:
        if not isinstance(story_dict, dict):
            return ValidationResult(
                valid=False,
                errors=[
                    ValidationError(
                        code="VALIDATION_ERROR",
                        message=f"Expected a dict, got {type(story_dict).__name__}.",
                        sentence_index=None,
                    )
                ],
            )

        errors: list[ValidationError] = []

        # 1. Required fields
        missing = _REQUIRED_FIELDS - set(story_dict.keys())
        for field_name in sorted(missing):
            errors.append(
                ValidationError(
                    code="MISSING_FIELD",
                    message=f"Required field '{field_name}' is absent.",
                    sentence_index=None,
                )
            )

        # 2. Parallel array parity per sentence + sentence.id presence
        sentences = story_dict.get("sentences")
        # P5: sentences: null must not pass as valid (key present but null value)
        if sentences is None:
            errors.append(
                ValidationError(
                    code="MISSING_FIELD",
                    message="Required field 'sentences' is null; expected a list.",
                    sentence_index=None,
                )
            )
            sentences = []
        if isinstance(sentences, list):
            for i, sentence in enumerate(sentences):
                if not isinstance(sentence, dict):
                    continue
                # P6: every sentence must have a non-empty id (AC2: stable sentence.id)
                if not sentence.get("id"):
                    errors.append(
                        ValidationError(
                            code="MISSING_FIELD",
                            message=f"sentence[{i}]: missing required 'id' field",
                            sentence_index=i,
                        )
                    )
                words = sentence.get("words") or []
                ruby = sentence.get("ruby")
                vocab_keys = sentence.get("vocab_keys")
                n = len(words)
                if ruby is not None and len(ruby) != n:
                    errors.append(
                        ValidationError(
                            code="PARALLEL_ARRAY_MISMATCH",
                            message=(
                                f"sentence[{i}] (id={sentence.get('id', '?')}): "
                                f"words={n} but ruby={len(ruby)}"
                            ),
                            sentence_index=i,
                        )
                    )
                if vocab_keys is not None and len(vocab_keys) != n:
                    errors.append(
                        ValidationError(
                            code="PARALLEL_ARRAY_MISMATCH",
                            message=(
                                f"sentence[{i}] (id={sentence.get('id', '?')}): "
                                f"words={n} but vocab_keys={len(vocab_keys)}"
                            ),
                            sentence_index=i,
                        )
                    )

        return ValidationResult(valid=not errors, errors=errors)

    except Exception as exc:  # noqa: BLE001
        return ValidationResult(
            valid=False,
            errors=[
                ValidationError(
                    code="VALIDATION_ERROR",
                    message=str(exc),
                    sentence_index=None,
                )
            ],
        )
