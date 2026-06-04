"""Structural validator for nihonnohon story dicts."""
import re
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


# Required top-level fields (shared by v1 and v2 schemas)
_REQUIRED_FIELDS = frozenset(
    {"schema_version", "id", "title", "title_ja", "language", "description", "sentences"}
)

# Kanji Unicode ranges: CJK Unified Ideographs, Extension A, Compatibility Ideographs, Extension B,
# plus ideographic iteration marks 々〻〃 (U+3005, U+303B, U+3003) — matches TypeScript isKanji().
_KANJI_RE = re.compile(r"[一-鿿㐀-䶿豈-﫿\U00020000-\U0002A6DF々〻〃]")


def _is_kanji(ch: str) -> bool:
    """Return True if ch is a kanji character."""
    return bool(_KANJI_RE.match(ch))


def _validate_word_annotation(word: str) -> str | None:
    """Return an error message if inline ruby annotation syntax is malformed, else None.

    Rules:
    - A '[' must be immediately preceded by a kanji character.
    - A '[' must be closed by a matching ']'.
    """
    if "[" not in word:
        return None
    for i, ch in enumerate(word):
        if ch == "[":
            if i == 0 or not _is_kanji(word[i - 1]):
                return f"word {word!r}: '[' at position {i} not preceded by a kanji character"
            if "]" not in word[i + 1:]:
                return f"word {word!r}: '[' at position {i} is not closed"
    return None


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

        # 2. Per-sentence validation: id presence, bracket syntax, vocab_keys parity
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
                vocab_keys = sentence.get("vocab_keys")
                n = len(words)

                # Inline annotation bracket syntax check (v2 format)
                for word_str in words:
                    if isinstance(word_str, str):
                        msg = _validate_word_annotation(word_str)
                        if msg:
                            errors.append(
                                ValidationError(
                                    code="VALIDATION_ERROR",
                                    message=(
                                        f"sentence[{i}] (id={sentence.get('id', '?')}): {msg}"
                                    ),
                                    sentence_index=i,
                                )
                            )

                # vocab_keys length parity
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
