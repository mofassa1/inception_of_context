from pydantic import BaseModel


class FileChunkDTO(BaseModel):
    id: str
    content: str
    kind: str
    qualifiedName: str
    startLine: int
    endLine: int
    contentHash: str


class FileChunksResponseDTO(BaseModel):
    path: str
    chunks: list[FileChunkDTO]


class IndexedFileDTO(BaseModel):
    name: str
    chunks: int


class FileSourceResponseDTO(BaseModel):
    path: str
    content: str
    lines: int
    chunks: list[FileChunkDTO]


class CollectionChunkDTO(BaseModel):
    id: str
    file: str
    content: str
    kind: str
    qualifiedName: str
    startLine: int
    endLine: int


class ChunkPageResponseDTO(BaseModel):
    chunks: list[CollectionChunkDTO]
    offset: int
    limit: int
    total: int
