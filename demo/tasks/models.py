"""The one record of the app: a task on the board."""

import time
from dataclasses import dataclass, field

PRIORITIES = ("low", "normal", "high")


@dataclass
class Task:
    id: int
    title: str
    priority: str = "normal"
    done: bool = False
    created_at: float = field(default_factory=time.time)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "priority": self.priority,
            "done": self.done,
            "created_at": self.created_at,
        }
