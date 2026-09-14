import json
import os
from pathlib import Path

from p1.core.errors import PathNotFound
from p1.core.logging import get_logger
from p2.conversation import Conversation, ConversationTurn

logger = get_logger(__name__)


class ConversationStore:
    """One JSON file per conversation, beside the index it belongs to."""

    def __init__(self, directory: str):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    def _path(self, conversation_id: str) -> Path:
        return self.directory / f"{conversation_id}.json"

    def list_summaries(self) -> list[dict]:
        summaries = []

        for entry in self.directory.glob("*.json"):
            try:
                raw = json.loads(entry.read_text(encoding="utf-8"))
            except (OSError, ValueError) as error:
                logger.warning("skipping unreadable conversation %s: %s", entry, error)
                continue

            summaries.append(
                {
                    "id": raw.get("id", entry.stem),
                    "title": raw.get("title", "Untitled"),
                    "updatedAt": raw.get("updatedAt", 0.0),
                    "messageCount": len(raw.get("turns", [])),
                }
            )

        summaries.sort(key=lambda item: item["updatedAt"], reverse=True)
        return summaries

    def get(self, conversation_id: str) -> Conversation:
        path = self._path(conversation_id)

        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise PathNotFound(
                f"conversation not found: {conversation_id}", id=conversation_id
            ) from error

        return Conversation.from_dict(raw)

    def save(self, conversation: Conversation) -> Conversation:
        path = self._path(conversation.id)
        temporary = path.with_suffix(".json.tmp")

        temporary.write_text(
            json.dumps(conversation.to_dict(), indent=2), encoding="utf-8"
        )
        os.replace(temporary, path)

        return conversation

    def create(self) -> Conversation:
        return self.save(Conversation())

    def append(self, conversation_id: str, turns: list[ConversationTurn]) -> Conversation:
        conversation = self.get(conversation_id)

        for turn in turns:
            conversation.append(turn)

        return self.save(conversation)

    def history(self, conversation_id: str | None) -> list[tuple[str, str]]:
        if not conversation_id:
            return []
        return [(turn.role, turn.content) for turn in self.get(conversation_id).turns]

    def delete(self, conversation_id: str) -> None:
        path = self._path(conversation_id)

        if not path.exists():
            raise PathNotFound(
                f"conversation not found: {conversation_id}", id=conversation_id
            )

        path.unlink()
        logger.info("deleted conversation %s", conversation_id)
