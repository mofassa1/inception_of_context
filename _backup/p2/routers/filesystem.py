from fastapi import APIRouter, Query

from p2.deps import FileSystemServiceDep
from p2.schemas.filesystem import (
    CreateEntryRequestDTO,
    DirectoryEntryDTO,
    DirectoryListingResponseDTO,
    EntryResponseDTO,
    FileContentResponseDTO,
    OperationResultDTO,
    RenameEntryRequestDTO,
    WriteFileRequestDTO,
)

router = APIRouter(prefix="/api/fs", tags=["Filesystem"])


@router.get("/list", summary="List directory entries",
            response_model=DirectoryListingResponseDTO)
def list_dir(
    filesystem: FileSystemServiceDep,
    path: str = Query(min_length=1),
) -> DirectoryListingResponseDTO:
    target, entries = filesystem.list_directory(path)

    return DirectoryListingResponseDTO(
        path=str(target),
        entries=[
            DirectoryEntryDTO(
                name=entry.name, path=str(entry.path), is_dir=entry.is_dir
            )
            for entry in entries
        ],
    )


@router.get("/read", summary="Read a text file",
            response_model=FileContentResponseDTO)
def read_file(
    filesystem: FileSystemServiceDep,
    path: str = Query(min_length=1),
) -> FileContentResponseDTO:
    target, content = filesystem.read_file(path)
    return FileContentResponseDTO(path=str(target), content=content)


@router.put("/write", summary="Write content to a file",
            response_model=OperationResultDTO)
def write_file(
    request: WriteFileRequestDTO,
    filesystem: FileSystemServiceDep,
) -> OperationResultDTO:
    filesystem.write_file(request.path, request.content)
    return OperationResultDTO()


@router.post("/create", summary="Create a file or directory",
             response_model=EntryResponseDTO)
def create_entry(
    request: CreateEntryRequestDTO,
    filesystem: FileSystemServiceDep,
) -> EntryResponseDTO:
    target = filesystem.create_entry(request.path, request.is_dir)
    return EntryResponseDTO(path=str(target), is_dir=request.is_dir)


@router.delete("/delete", summary="Delete a file or directory",
               response_model=OperationResultDTO)
def delete_entry(
    filesystem: FileSystemServiceDep,
    path: str = Query(min_length=1),
) -> OperationResultDTO:
    filesystem.delete_entry(path)
    return OperationResultDTO()


@router.post("/rename", summary="Rename a file or directory",
             response_model=EntryResponseDTO)
def rename_entry(
    request: RenameEntryRequestDTO,
    filesystem: FileSystemServiceDep,
) -> EntryResponseDTO:
    destination = filesystem.rename_entry(request.path, request.new_path)
    return EntryResponseDTO(path=str(destination), is_dir=destination.is_dir())
