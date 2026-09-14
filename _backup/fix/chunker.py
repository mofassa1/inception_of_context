"""Wraps p1/chunker.py."""

from p1.chunker import Chunk, Chunker, hash_chunk

PREAMBLE_NAME = "__preamble__"


class FixChunker(Chunker):
    def chunk_python_file(self, filepath: str, source: str):
        chunks = super().chunk_python_file(filepath, source)
        chunks = with_preamble(filepath, source, chunks)
        return with_unique_ids(chunks)


def with_preamble(filepath: str, source: str, chunks: list) -> list:
    if not chunks or any(chunk.kind != "function_regex" for chunk in chunks):
        return chunks

    first_start = min(chunk.start_line for chunk in chunks)
    if first_start <= 1:
        return chunks

    preamble = "".join(source.splitlines(keepends=True)[: first_start - 1])
    if not preamble.strip():
        return chunks

    return [
        Chunk(
            id=f"{filepath}::{PREAMBLE_NAME}",
            file=filepath,
            kind="preamble",
            qualified_name=PREAMBLE_NAME,
            content=preamble,
            start_line=1,
            end_line=first_start - 1,
            content_hash=hash_chunk(preamble),
        ),
        *chunks,
    ]


def with_unique_ids(chunks: list) -> list:
    occurrences: dict[str, int] = {}

    for chunk in chunks:
        count = occurrences.get(chunk.id, 0) + 1
        occurrences[chunk.id] = count
        if count > 1:
            chunk.id = f"{chunk.id}#{count}"

    return chunks
