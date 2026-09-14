from fastapi import APIRouter

from p2.deps import IndexingServiceDep
from p1.ignore import IgnoreRules
from p2.schemas.indexing import (
    ForgetRequestDTO,
    ForgetResponseDTO,
    IndexRequestDTO,
    IndexResponseDTO,
)

router = APIRouter(prefix="/index", tags=["index"])


def _rules(request: IndexRequestDTO) -> IgnoreRules:
    return IgnoreRules.build(request.ignoreNames, request.ignorePaths)


@router.post("", response_model=IndexResponseDTO)
def index_workspace(
    request: IndexRequestDTO,
    indexing: IndexingServiceDep,
) -> IndexResponseDTO:
    return IndexResponseDTO(**indexing.index_workspace(request.path, _rules(request)))


@router.post("/path", response_model=IndexResponseDTO)
def index_path(
    request: IndexRequestDTO,
    indexing: IndexingServiceDep,
) -> IndexResponseDTO:
    return IndexResponseDTO(**indexing.index_path(request.path, _rules(request)))


@router.post("/forget", response_model=ForgetResponseDTO)
def forget_path(
    request: ForgetRequestDTO,
    indexing: IndexingServiceDep,
) -> ForgetResponseDTO:
    return ForgetResponseDTO(**indexing.forget(request.path))
