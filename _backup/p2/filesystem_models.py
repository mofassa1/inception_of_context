from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DirectoryEntry:
    """Internal representation of one filesystem entry, independent of the
    wire shape in schemas/filesystem.py."""

    name: str
    path: Path
    is_dir: bool

    @property
    def sort_key(self) -> tuple[bool, str]:
        return (not self.is_dir, self.name.lower())
