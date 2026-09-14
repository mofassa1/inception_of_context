"""Wraps the p1/index.py flow: index a folder, then watch it."""

import signal
import threading
from pathlib import Path

from p1.core.logging import configure_logging, get_logger

from fix.chunker import FixChunker
from fix.embedder import EmbedderAdapter, prepare_embedding_cache
from fix.db import ChunkStore
from fix.monitor import FixWatcher

logger = get_logger(__name__)

REPOSITORY = Path(__file__).resolve().parent.parent


def index_folder(folder: str, chroma_path: str | None = None, embedder=None, watch: bool = True) -> dict:
    from p1.core.events import EventBus
    from p1.db import VectorStore
    from p1.ignore import IgnoreRules
    from p1.runtime import RuntimeInfo
    from p1.service import IndexingService

    configure_logging()

    if embedder is None:
        prepare_embedding_cache()
        from p1.embedder import Embedder

        embedder = Embedder()

    runtime = RuntimeInfo()
    event_bus = EventBus()
    store = ChunkStore(
        VectorStore(chroma_path or str(REPOSITORY / "chroma_db"), collection_name="codebase"),
        runtime,
    )
    service = IndexingService(
        store=store,
        embedder=EmbedderAdapter(embedder),
        chunker=FixChunker(),
        watcher=FixWatcher(),
        event_bus=event_bus,
        runtime=runtime,
    )

    result = service.index_workspace(folder, IgnoreRules.build())
    logger.info(
        "indexed %s: %d files, %d chunks, %d in the collection",
        result["path"], result["filesIndexed"], result["chunksIndexed"], result["totalChunks"],
    )

    if not watch:
        service.watcher.stop()
        return result

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())

    def log_events() -> None:
        for event in event_bus.subscribe():
            if stop.is_set():
                return
            if event:
                logger.info("%s %s (%d chunks)", event["kind"], event["path"], event["chunkCount"])

    threading.Thread(target=log_events, daemon=True).start()
    logger.info("watching for changes, Ctrl-C to stop")
    stop.wait()

    service.watcher.stop()
    return result
