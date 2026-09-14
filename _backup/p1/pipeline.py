import os
from pathlib import Path

from p1.core.logging import get_logger
from p1.chunker import Chunk
from p1.ignore import IgnoreRules

logger = get_logger(__name__)

BINARY_PROBE_BYTES = 1024


def is_text_file(path: str) -> bool:
    try:
        with open(path, "rb") as handle:
            return b"\x00" not in handle.read(BINARY_PROBE_BYTES)
    except OSError as error:
        logger.debug("skipping unreadable file %s: %s", path, error)
        return False


def read_source(path: str) -> str | None:
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        logger.debug("skipping file %s: %s", path, error)
        return None


def walk_source_files(root: str, rules: IgnoreRules):
    for directory, subdirectories, filenames in os.walk(root):
        subdirectories[:] = [
            name
            for name in subdirectories
            if not rules.ignores_name(name)
            and not rules.ignores_path(os.path.join(directory, name))
        ]

        for filename in filenames:
            path = os.path.join(directory, filename)
            if rules.ignores_name(filename) or rules.ignores_within(root, path):
                continue
            if is_text_file(path):
                yield path


def embed_text(chunk: Chunk) -> str:
    return (
        f"file path and name: {chunk.file}, kind: {chunk.kind}, "
        f"qualified name: {chunk.qualified_name}, content: {chunk.content}"
    )


def chunk_metadata(chunk: Chunk) -> dict:
    return {
        "file": chunk.file,
        "kind": chunk.kind,
        "qualified_name": chunk.qualified_name,
        "start_line": chunk.start_line,
        "end_line": chunk.end_line,
        "content_hash": chunk.content_hash,
    }


def sync_file(store, chunker, embedder, path: str) -> int:
    source = read_source(path)
    if source is None:
        return 0

    chunks = chunker.chunk_python_file(path, source)
    stored = store.get_file_chunks(path)

    stored_hashes: dict[str, str] = {}
    stored_ranges: dict[str, tuple[int, int]] = {}

    for chunk_id, metadata in zip(stored["ids"], stored["metadatas"]):
        stored_hashes[chunk_id] = metadata.get("content_hash", "")
        stored_ranges[chunk_id] = (
            metadata.get("start_line", 0),
            metadata.get("end_line", 0),
        )

    current_ids = {chunk.id for chunk in chunks}
    removed_ids = [chunk_id for chunk_id in stored_hashes if chunk_id not in current_ids]

    needs_embedding: list[Chunk] = []
    metadata_only: list[Chunk] = []

    for chunk in chunks:
        if stored_hashes.get(chunk.id) != chunk.content_hash:
            needs_embedding.append(chunk)
        elif stored_ranges.get(chunk.id) != (chunk.start_line, chunk.end_line):
            metadata_only.append(chunk)

    store.delete_ids(removed_ids)

    if needs_embedding:
        vectors = embedder.embed_in_batches(
            [embed_text(chunk) for chunk in needs_embedding]
        )
        store.upsert(
            ids=[chunk.id for chunk in needs_embedding],
            documents=[chunk.content for chunk in needs_embedding],
            embeddings=vectors,
            metadatas=[chunk_metadata(chunk) for chunk in needs_embedding],
        )

    if metadata_only:
        store.update_metadatas(
            ids=[chunk.id for chunk in metadata_only],
            metadatas=[chunk_metadata(chunk) for chunk in metadata_only],
        )

    store.set_file_chunk_count(path, len(chunks))
    return len(chunks)


def forget_path(store, path: str) -> list[str]:
    prefix = path.rstrip("/") + "/"

    targets = [
        stored_path
        for stored_path in store.file_chunk_counts()
        if stored_path == path or stored_path.startswith(prefix)
    ]

    for target in targets:
        stored = store.get_file_chunks(target)
        store.delete_ids(stored["ids"])
        store.set_file_chunk_count(target, 0)

    return targets
