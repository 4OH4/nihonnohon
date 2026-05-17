"""Structural validator for nihonnohon story dicts."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ValidationError:
    """A single validation failure."""

    code: str  # MISSING_FIELD | PARALLEL_ARRAY_MISMATCH | ... (more added in Story 2.2)
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

    Story 1.2 scope: required-field presence check only.
    Parallel array parity, grammar index bounds, and vocab key resolution
    are added in Story 2.2 when the agent pipeline needs them.

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
        missing = _REQUIRED_FIELDS - set(story_dict.keys())
        for field_name in sorted(missing):
            errors.append(
                ValidationError(
                    code="MISSING_FIELD",
                    message=f"Required field '{field_name}' is absent.",
                    sentence_index=None,
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
