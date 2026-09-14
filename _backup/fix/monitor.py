"""Wraps p1/monitor.py."""

import os
import threading
from types import SimpleNamespace

from p1.core.logging import get_logger
from p1.monitor import Handler
from p1.pipeline import forget_path, sync_file
from watchdog.observers import Observer

from fix.embedder import EmbedderAdapter
from fix.db import ChunkStore

logger = get_logger(__name__)

DEBOUNCE_SECONDS = 0.3
STOP_TIMEOUT_SECONDS = 2.0


class FixHandler(Handler):
    def __init__(self, root: str, store: ChunkStore, chunker, embedder: EmbedderAdapter, rules, event_bus):
        super().__init__(
            target_dir=root,
            store=store.vector_store,
            chunker=chunker,
            embedder=embedder.embedder,
        )
        self.chunk_store = store
        self.embedder_adapter = embedder
        self.rules = rules
        self.event_bus = event_bus

        self._lock = threading.Lock()
        self._timers: dict[str, threading.Timer] = {}

    def on_any_event(self, event):
        if event.event_type == "moved":
            self._schedule(event.src_path, removed=True, is_directory=event.is_directory)
            if not event.is_directory:
                self._schedule(event.dest_path, removed=False)
        elif event.event_type == "deleted":
            self._schedule(event.src_path, removed=True, is_directory=event.is_directory)
        elif event.event_type in ("created", "modified") and not event.is_directory:
            self._schedule(event.src_path, removed=False)

    def _schedule(self, path: str, removed: bool, is_directory: bool = False) -> None:
        if self.rules.ignores_within(self.target_dir, path):
            return

        # Editors save in bursts (truncate, write, chmod); one re-index per file.
        with self._lock:
            pending = self._timers.pop(path, None)
            if pending:
                pending.cancel()

            timer = threading.Timer(
                DEBOUNCE_SECONDS, self._apply, args=(path, removed, is_directory)
            )
            timer.daemon = True
            self._timers[path] = timer
            timer.start()

    def _apply(self, path: str, removed: bool, is_directory: bool) -> None:
        with self._lock:
            self._timers.pop(path, None)

        try:
            if removed:
                self._remove(path, is_directory)
                self.event_bus.publish("deleted", path, 0)
                return

            if not os.path.isfile(path):
                return

            chunk_count = sync_file(
                self.chunk_store, self.chunker, self.embedder_adapter, path
            )
            self.chunk_store.invalidate_counts()
            self.event_bus.publish("modified", path, chunk_count)
        except Exception:
            logger.exception("failed to re-index %s", path)
            self.event_bus.publish("error", path, 0)

    def _remove(self, path: str, is_directory: bool) -> None:
        if is_directory:
            forget_path(self.chunk_store, path)
        else:
            self._handle_file_deleted(SimpleNamespace(src_path=path))
        self.chunk_store.invalidate_counts()


class FixWatcher:
    def __init__(self) -> None:
        self._observer: Observer | None = None
        self._root: str | None = None

    def start(self, root: str, store: ChunkStore, chunker, embedder: EmbedderAdapter, rules, event_bus) -> None:
        self.stop()

        observer = Observer()
        observer.daemon = True
        observer.schedule(
            FixHandler(root, store, chunker, embedder, rules, event_bus),
            root,
            recursive=True,
        )
        observer.start()

        self._observer = observer
        self._root = root
        logger.info("watching %s", root)

    def stop(self) -> None:
        if self._observer is None:
            return

        self._observer.stop()
        self._observer.join(timeout=STOP_TIMEOUT_SECONDS)
        self._observer = None
        self._root = None

    @property
    def root(self) -> str | None:
        return self._root

    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()
