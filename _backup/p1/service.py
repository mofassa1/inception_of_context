from pathlib import Path
from typing import Iterable

from p1.core.errors import missing_path
from p1.core.events import EventBus
from p1.core.logging import get_logger
from p1.ignore import IgnoreRules
from p1.runtime import RuntimeInfo
from p1.pipeline import forget_path, sync_file, walk_source_files

logger = get_logger(__name__)


class IndexingService:
    def __init__(
        self,
        store,
        embedder,
        chunker,
        watcher,
        event_bus: EventBus,
        runtime: RuntimeInfo,
        visible_roots: list[str] | None = None,
    ):
        self.store = store
        self.embedder = embedder
        self.chunker = chunker
        self.watcher = watcher
        self.event_bus = event_bus
        self.runtime = runtime
        self.visible_roots = visible_roots or []

    @staticmethod
    def _resolve(path: str) -> str:
        return str(Path(path).expanduser().resolve())

    def _index_files(self, paths: Iterable[str]) -> tuple[int, int]:
        files_indexed = 0
        chunks_indexed = 0

        for path in paths:
            try:
                chunk_count = sync_file(self.store, self.chunker, self.embedder, path)
            except Exception:
                # One unreadable or unchunkable file must not abort a whole tree.
                logger.exception("skipped %s while indexing", path)
                self.event_bus.publish("error", path, 0)
                continue

            if chunk_count:
                files_indexed += 1
                chunks_indexed += chunk_count

        return files_indexed, chunks_indexed

    def index_workspace(self, root: str, rules: IgnoreRules) -> dict:
        resolved = self._resolve(root)
        if not Path(resolved).is_dir():
            raise missing_path(resolved, "directory", self.visible_roots)

        logger.info("indexing workspace %s", resolved)

        self.runtime.target_project = resolved

        files_indexed, chunks_indexed = self._index_files(
            walk_source_files(resolved, rules)
        )

        self.watcher.start(
            resolved,
            self.store,
            self.chunker,
            self.embedder,
            rules,
            self.event_bus,
        )
        self.event_bus.publish("indexed", resolved, chunks_indexed)

        logger.info(
            "indexed %s: %d files, %d chunks", resolved, files_indexed, chunks_indexed
        )

        return {
            "path": resolved,
            "filesIndexed": files_indexed,
            "chunksIndexed": chunks_indexed,
            "totalChunks": self.store.count_chunks(),
        }

    def index_path(self, path: str, rules: IgnoreRules) -> dict:
        resolved = self._resolve(path)

        if Path(resolved).is_dir():
            files_indexed, chunks_indexed = self._index_files(
                walk_source_files(resolved, rules)
            )
        else:
            chunks_indexed = sync_file(
                self.store, self.chunker, self.embedder, resolved
            )
            files_indexed = 1 if chunks_indexed else 0

        self.event_bus.publish("indexed", resolved, chunks_indexed)

        return {
            "path": resolved,
            "filesIndexed": files_indexed,
            "chunksIndexed": chunks_indexed,
        }

    def forget(self, path: str) -> dict:
        resolved = self._resolve(path)
        removed = forget_path(self.store, resolved)

        self.event_bus.publish("ignored", resolved, 0)
        logger.info("forgot %s (%d files removed)", resolved, len(removed))

        return {"path": resolved, "filesRemoved": len(removed)}
