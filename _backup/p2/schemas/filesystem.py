from pydantic import BaseModel, Field


class WriteFileRequestDTO(BaseModel):
    path: str = Field(min_length=1)
    content: str


class CreateEntryRequestDTO(BaseModel):
    path: str = Field(min_length=1)
    is_dir: bool = False


class RenameEntryRequestDTO(BaseModel):
    path: str = Field(min_length=1)
    new_path: str = Field(min_length=1)


class DirectoryEntryDTO(BaseModel):
    name: str
    path: str
    is_dir: bool


class DirectoryListingResponseDTO(BaseModel):
    path: str
    entries: list[DirectoryEntryDTO]


class FileContentResponseDTO(BaseModel):
    path: str
    content: str


class EntryResponseDTO(BaseModel):
    path: str
    is_dir: bool


class OperationResultDTO(BaseModel):
    ok: bool = True


class HealthResponseDTO(BaseModel):
    ok: bool
