from datetime import datetime, timezone

from notes.storage import NoteStorage


class NoteNotFound(Exception):
    """Raised when a note id does not exist."""


class NoteService:
    """Create, list, search and delete notes."""

    def __init__(self, storage: NoteStorage):
        self.storage = storage

    def create(self, title: str, body: str) -> dict:
        if not title.strip():
            raise ValueError("title is required")

        notes = self.storage.load()
        note = {
            "id": self.next_id(notes),
            "title": title.strip(),
            "body": body,
            "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

        notes.append(note)
        self.storage.save(notes)
        return note

    def next_id(self, notes: list[dict]) -> int:
        return max((note["id"] for note in notes), default=0) + 1

    def list_notes(self) -> list[dict]:
        return self.storage.load()

    def get(self, note_id: int) -> dict:
        for note in self.storage.load():
            if note["id"] == note_id:
                return note

        raise NoteNotFound(f"no note with id {note_id}")

    def search(self, term: str) -> list[dict]:
        needle = term.lower()

        return [
            note
            for note in self.storage.load()
            if needle in note["title"].lower() or needle in note["body"].lower()
        ]

    def delete(self, note_id: int) -> None:
        notes = self.storage.load()
        remaining = [note for note in notes if note["id"] != note_id]

        if len(remaining) == len(notes):
            raise NoteNotFound(f"no note with id {note_id}")

        self.storage.save(remaining)
