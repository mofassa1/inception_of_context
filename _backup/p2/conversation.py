import time
import uuid
from dataclasses import dataclass, field

TITLE_MAX_CHARS = 60


@dataclass
class ConversationTurn:
    role: str
    content: str
    mode: str = "ask"
    at: float = field(default_factory=time.time)
    sources: list[dict] | None = None

    def to_dict(self) -> dict:
        return {
            "role": self.role,
            "content": self.content,
            "mode": self.mode,
            "at": self.at,
            "sources": self.sources,
        }

    @classmethod
    def from_dict(cls, raw: dict) -> "ConversationTurn":
        return cls(
            role=raw.get("role", "user"),
            content=raw.get("content", ""),
            mode=raw.get("mode", "ask"),
            at=raw.get("at", 0.0),
            sources=raw.get("sources"),
        )


@dataclass
class Conversation:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str = "New conversation"
    turns: list[ConversationTurn] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def append(self, turn: ConversationTurn) -> None:
        self.turns.append(turn)
        self.updated_at = time.time()

        if self.title == "New conversation" and turn.role == "user":
            self.title = derive_title(turn.content)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "turns": [turn.to_dict() for turn in self.turns],
        }

    @classmethod
    def from_dict(cls, raw: dict) -> "Conversation":
        return cls(
            id=raw.get("id", uuid.uuid4().hex[:12]),
            title=raw.get("title", "New conversation"),
            turns=[ConversationTurn.from_dict(t) for t in raw.get("turns", [])],
            created_at=raw.get("createdAt", 0.0),
            updated_at=raw.get("updatedAt", 0.0),
        )


def derive_title(text: str) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= TITLE_MAX_CHARS:
        return cleaned or "New conversation"
    return cleaned[: TITLE_MAX_CHARS - 1].rstrip() + "…"
