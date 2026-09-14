import json
from pathlib import Path


class NoteStorage:
    """Persists notes as a JSON list on disk."""

    def __init__(self, path: str):
        self.path = Path(path)

    def load(self) -> list[dict]:
        if not self.path.is_file():
            return []

        with self.path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def save(self, notes: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)

        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(notes, handle, indent=2)

    def clear(self) -> None:
        if self.path.is_file():
            self.path.unlink()
