"""CSV data loaders for curriculum reference data. Called once at backend startup."""
import csv
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class VocabEntry:
    """A single vocabulary entry from genki1vocab.csv."""

    id: int
    hiragana: str
    kanji: str
    translation: str
    chapter: int


@dataclass(frozen=True)
class GrammarPoint:
    """A single grammar point from Genki_grammar_for_AI_generation.csv."""

    chapter: int
    point: str    # e.g. "1.1"
    title: str
    summary: str


@dataclass(frozen=True)
class VocabData:
    """Vocab keyed by numeric id; also grouped by chapter for cumulative ceilings."""

    by_id: dict[int, VocabEntry]             # O(1) lookup by id
    by_chapter: dict[int, list[VocabEntry]]  # chapter → entries in that chapter


@dataclass(frozen=True)
class GrammarData:
    """Grammar points grouped by chapter."""

    by_chapter: dict[int, list[GrammarPoint]]


def load_vocab_data(path: str | Path) -> VocabData:
    """Load genki1vocab.csv into VocabData.

    CSV has no header row. Columns (0-indexed):
    [0] id (int), [1] hiragana, [2] kanji, [3] translation, [4] chapter (int)
    """
    by_id: dict[int, VocabEntry] = {}
    by_chapter: dict[int, list[VocabEntry]] = {}

    with open(path, encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        for row in reader:
            if not row:
                continue
            entry = VocabEntry(
                id=int(row[0]),
                hiragana=row[1],
                kanji=row[2] if len(row) > 2 else "",
                translation=row[3] if len(row) > 3 else "",
                chapter=int(row[4]) if len(row) > 4 else 0,
            )
            by_id[entry.id] = entry
            by_chapter.setdefault(entry.chapter, []).append(entry)

    return VocabData(by_id=by_id, by_chapter=by_chapter)


def load_grammar_data(path: str | Path) -> GrammarData:
    """Load Genki_grammar_for_AI_generation.csv into GrammarData.

    CSV has a header row. Columns:
    Chapter, Grammar Point, Descriptive Title, Detailed Summary and Scope
    """
    by_chapter: dict[int, list[GrammarPoint]] = {}

    with open(path, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            point = GrammarPoint(
                chapter=int(row["Chapter"]),
                point=row["Grammar Point"],
                title=row["Descriptive Title"],
                summary=row["Detailed Summary and Scope"],
            )
            by_chapter.setdefault(point.chapter, []).append(point)

    return GrammarData(by_chapter=by_chapter)
