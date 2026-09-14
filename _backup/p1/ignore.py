from dataclasses import dataclass, field
from pathlib import Path

from p1.core.config import Settings

FALLBACK_IGNORE_NAMES = frozenset(
    {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__", "chroma_db"}
)


def protected_paths() -> frozenset[str]:
    """Paths the indexer must never walk, whatever the client asks for.

    The vector store is the important one: indexing the Chroma directory feeds
    the index its own embeddings, which grows without bound and pollutes every
    retrieval. The subject calls this out explicitly.
    """
    settings = Settings()

    return frozenset(
        str(Path(entry).expanduser().resolve())
        for entry in (settings.data_dir, settings.chroma_path)
    )


@dataclass(frozen=True)
class IgnoreRules:
    names: frozenset[str] = field(default_factory=lambda: FALLBACK_IGNORE_NAMES)
    paths: frozenset[str] = field(default_factory=frozenset)
    skip_hidden: bool = True

    @classmethod
    def build(
        cls,
        names: list[str] | None = None,
        paths: list[str] | None = None,
        skip_hidden: bool = True,
    ) -> "IgnoreRules":
        resolved_names = (
            frozenset(names) if names is not None else FALLBACK_IGNORE_NAMES
        )
        resolved_paths = frozenset(
            str(Path(entry).expanduser().resolve()) for entry in (paths or [])
        )
        return cls(
            names=resolved_names,
            paths=resolved_paths | protected_paths(),
            skip_hidden=skip_hidden,
        )

    def ignores_name(self, name: str) -> bool:
        return name in self.names or (self.skip_hidden and self._is_hidden(name))

    @staticmethod
    def _is_hidden(name: str) -> bool:
        return name.startswith(".") and name not in (".", "..")

    def ignores_path(self, path: str) -> bool:
        candidate = Path(path)

        for part in candidate.parts:
            if part in self.names:
                return True

        for ancestor in (candidate, *candidate.parents):
            if str(ancestor) in self.paths:
                return True

        return False

    def ignores_within(self, root: str, path: str) -> bool:
        """Ignore rules for `path`, judged relative to the indexed root.

        Hidden segments are only checked below the root, so indexing a project
        that itself lives under a dot directory still works — otherwise every
        file under `~/.config/thing` would be skipped.
        """
        if self.ignores_path(path):
            return True

        if not self.skip_hidden:
            return False

        try:
            relative = Path(path).resolve().relative_to(Path(root).resolve())
        except ValueError:
            return False

        return any(self._is_hidden(part) for part in relative.parts)
