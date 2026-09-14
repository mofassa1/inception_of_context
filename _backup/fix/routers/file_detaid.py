"""Fixed versions of the p2/routers/file_detaid.py routes."""

import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from p1.chunker import hash_chunk
from p1.core.errors import PathNotFound, ServiceError
from p1.pipeline import sync_file
from p2.deps import ChunkerDep, EmbedderDep, VectorStoreDep

router = APIRouter(tags=["fixed"])


class ChunkOutOfDate(ServiceError):
    code = "CHUNK_OUT_OF_DATE"
    status = 409


class ChunkEditRequestDTO(BaseModel):
    content: str
    chunk_id: str


class ChunkEditResponseDTO(BaseModel):
    message: str


class FileChunksOfIndexDTO(BaseModel):
    file_path: str
    chunks: dict


def replace_chunk_lines(
    source: str, start_line: int, end_line: int, expected_hash: str, new_content: str
) -> str:
    lines = source.splitlines(keepends=True)
    current = "".join(lines[start_line - 1 : end_line])

    if hash_chunk(current) != expected_hash:
        raise ChunkOutOfDate(
            "the file changed since this chunk was indexed; reload it and try again"
        )

    replacement = new_content if not new_content or new_content.endswith("\n") else new_content + "\n"
    return "".join(lines[: start_line - 1]) + replacement + "".join(lines[end_line:])


@router.patch("/chunks_modify", response_model=ChunkEditResponseDTO)
def update_chunk_content(
    request: ChunkEditRequestDTO,
    store: VectorStoreDep,
    chunker: ChunkerDep,
    embedder: EmbedderDep,
) -> ChunkEditResponseDTO:
    found = store.vector_store.get_chunks_by_ids([request.chunk_id])
    if not found["ids"]:
        raise PathNotFound(f"chunk not found: {request.chunk_id}", path=request.chunk_id)

    metadata = found["metadatas"][0]
    file_path = metadata["file"]
    if not Path(file_path).is_file():
        raise PathNotFound(f"not a file: {file_path}", path=file_path)

    updated = replace_chunk_lines(
        Path(file_path).read_text(encoding="utf-8"),
        metadata["start_line"],
        metadata["end_line"],
        metadata["content_hash"],
        request.content,
    )

    temporary = file_path + ".ioc.tmp"
    Path(temporary).write_text(updated, encoding="utf-8")
    os.replace(temporary, file_path)
    sync_file(store, chunker, embedder, file_path)

    return ChunkEditResponseDTO(
        message=f"Chunk {request.chunk_id} and file updated successfully."
    )


@router.get("/files/{file_path:path}", response_model=FileChunksOfIndexDTO)
def get_chunks_for_file(file_path: str, store: VectorStoreDep) -> FileChunksOfIndexDTO:
    absolute_path = "/" + file_path.lstrip("/")
    return FileChunksOfIndexDTO(
        file_path=absolute_path,
        chunks=store.get_file_chunks_with_content(absolute_path),
    )
