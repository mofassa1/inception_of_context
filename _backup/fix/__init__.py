"""Adaptations of the p1/ and p2/ modules, which stay unchanged.

Each module wraps or subclasses the module of the same name:

    chunker.py      p1/chunker.py        db.py          p1/db.py
    embedder.py     p1/embedder.py       monitor.py     p1/monitor.py
    index.py        p1/index.py          llm_object.py  p2/llm_object.py
    server.py       p2/server.py         routers/       p2/routers/*.py

API:  uvicorn --factory fix:create_app
CLI:  python -m fix index <folder>
"""

import sys
from pathlib import Path

P1_DIRECTORY = str(Path(__file__).resolve().parent.parent / "p1")

if P1_DIRECTORY not in sys.path:
    sys.path.append(P1_DIRECTORY)

from fix.server import create_app  # noqa: E402
from fix.chunker import FixChunker  # noqa: E402
from fix.embedder import EmbedderAdapter, prepare_embedding_cache, shared_embedder  # noqa: E402
from fix.llm_object import model_names  # noqa: E402
from fix.db import ChunkStore, shared_store  # noqa: E402
from fix.monitor import FixHandler, FixWatcher  # noqa: E402

__all__ = [
    "ChunkStore",
    "EmbedderAdapter",
    "FixChunker",
    "FixHandler",
    "FixWatcher",
    "create_app",
    "model_names",
    "prepare_embedding_cache",
    "shared_embedder",
    "shared_store",
]
