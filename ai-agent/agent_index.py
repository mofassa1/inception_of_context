import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from p1.chunker import Chunker
from p2.embidder_object import embedder
from p2.store import vector_store as store

router = APIRouter(tags=["index"])

EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "venv",
    ".venv",
    "__pycache__",
    "chroma_db",
}

_chunker = Chunker()


class IndexRequest(BaseModel):
    path: str


def _walk(root: str):
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [
            d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".")
        ]
        for name in files:
            yield os.path.join(dirpath, name)


def _is_text(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            return b"\x00" not in f.read(1024)
    except OSError:
        return False


def _embed_text(chunk) -> str:
    return (
        f"file path and name: {chunk.file}, kind: {chunk.kind}, "
        f"qualified name: {chunk.qualified_name}, content: {chunk.content}"
    )


@router.post("/index")
def index_path(request: IndexRequest):
    root = Path(request.path).expanduser().resolve()
    if not root.is_dir():
        raise HTTPException(status_code=404, detail=f"not a directory: {root}")

    files_indexed = 0
    for filepath in _walk(str(root)):
        if not _is_text(filepath):
            continue
        try:
            source = Path(filepath).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        chunks = _chunker.chunk_python_file(filepath, source)
        if not chunks:
            continue

        vectors = embedder.create_embeddings([_embed_text(c) for c in chunks])
        store.collection.upsert(
            ids=[c.id for c in chunks],
            documents=[c.content for c in chunks],
            embeddings=vectors,
            metadatas=[
                {
                    "file": c.file,
                    "kind": c.kind,
                    "qualified_name": c.qualified_name,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "content_hash": c.content_hash,
                }
                for c in chunks
            ],
        )
        files_indexed += 1

    return {
        "path": str(root),
        "files_indexed": files_indexed,
        "chunks_indexed": store.get_all_chunks_count(),
    }
