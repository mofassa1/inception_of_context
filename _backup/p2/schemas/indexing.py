from pydantic import BaseModel, Field


class IndexRequestDTO(BaseModel):
    path: str = Field(min_length=1)
    ignoreNames: list[str] | None = None
    ignorePaths: list[str] | None = None


class ForgetRequestDTO(BaseModel):
    path: str = Field(min_length=1)


class IndexResponseDTO(BaseModel):
    path: str
    filesIndexed: int
    chunksIndexed: int
    totalChunks: int | None = None


class ForgetResponseDTO(BaseModel):
    path: str
    filesRemoved: int
