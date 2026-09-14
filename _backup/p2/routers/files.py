from pathlib import Path

from fastapi import APIRouter, Query

from p1.core.errors import NotTextFile, PathNotFound
from p2.deps import VectorStoreDep
from p2.schemas.files import (
    ChunkPageResponseDTO,
    CollectionChunkDTO,
    FileChunkDTO,
    FileChunksResponseDTO,
    FileSourceResponseDTO,
)

router = APIRouter(tags=["files"])


def _chunk_dtos(stored: dict[str, list]) -> list[FileChunkDTO]:
    chunks = [
        FileChunkDTO(
            id=chunk_id,
            content=document,
            kind=metadata.get("kind", ""),
            qualifiedName=metadata.get("qualified_name", ""),
            startLine=metadata.get("start_line", 0),
            endLine=metadata.get("end_line", 0),
            contentHash=metadata.get("content_hash", ""),
        )
        for chunk_id, document, metadata in zip(
            stored["ids"], stored["documents"], stored["metadatas"]
        )
    ]
    chunks.sort(key=lambda chunk: (chunk.startLine, -chunk.endLine))
    return chunks


@router.get("/file/chunks", response_model=FileChunksResponseDTO)
def get_file_chunks(
    store: VectorStoreDep,
    path: str = Query(min_length=1),
) -> FileChunksResponseDTO:
    resolved = str(Path(path).expanduser().resolve())
    stored = store.get_file_chunks_with_content(resolved)

    return FileChunksResponseDTO(path=resolved, chunks=_chunk_dtos(stored))


@router.get("/file", response_model=FileSourceResponseDTO)
def get_file_source(
    store: VectorStoreDep,
    path: str = Query(min_length=1),
) -> FileSourceResponseDTO:
    """Source of one indexed file, with its chunk boundaries.

    The Files tab draws the gutter markers from `chunks`, so the source and the
    boundaries have to come from one call — fetching them separately lets the
    watcher re-index in between and misalign the markers.
    """
    target = Path(path).expanduser().resolve()

    if not target.is_file():
        raise PathNotFound(f"not a file: {target}", path=str(target))

    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise NotTextFile(f"not a text file: {target}", path=str(target)) from error

    resolved = str(target)
    stored = store.get_file_chunks_with_content(resolved)

    return FileSourceResponseDTO(
        path=resolved,
        content=content,
        lines=content.count("\n") + 1,
        chunks=_chunk_dtos(stored),
    )


@router.get("/chunks", response_model=ChunkPageResponseDTO)
def browse_chunks(
    store: VectorStoreDep,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> ChunkPageResponseDTO:
    page = store.page_chunks(offset=offset, limit=limit)

    return ChunkPageResponseDTO(
        chunks=[
            CollectionChunkDTO(
                id=chunk_id,
                file=metadata.get("file", ""),
                content=document,
                kind=metadata.get("kind", ""),
                qualifiedName=metadata.get("qualified_name", ""),
                startLine=metadata.get("start_line", 0),
                endLine=metadata.get("end_line", 0),
            )
            for chunk_id, document, metadata in zip(
                page["ids"], page["documents"], page["metadatas"]
            )
        ],
        offset=offset,
        limit=limit,
        total=store.count_chunks(),
    )
