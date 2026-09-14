"""Fixed version of the p2/routers/status.py route."""

from fastapi import APIRouter
from pydantic import BaseModel

from p2.deps import LLMManagerDep, RuntimeInfoDep, VectorStoreDep

router = APIRouter(tags=["fixed"])


class IndexedFileCountDTO(BaseModel):
    name: str
    chunks: int


class StatusOfIndexDTO(BaseModel):
    chunks_indexed: int
    target_project: str
    chroma_path: str
    ask_model: str
    code_model: str
    ollama_backend: str
    files: list[IndexedFileCountDTO]


@router.get("/status/", response_model=StatusOfIndexDTO)
def get_status(
    store: VectorStoreDep,
    llm: LLMManagerDep,
    runtime: RuntimeInfoDep,
) -> StatusOfIndexDTO:
    return StatusOfIndexDTO(
        chunks_indexed=store.count_chunks(),
        target_project=runtime.target_project,
        chroma_path=runtime.chroma_path,
        ask_model=llm.ask_model,
        code_model=llm.code_model,
        ollama_backend=llm.ollama_host,
        files=[
            IndexedFileCountDTO(name=path, chunks=count)
            for path, count in sorted(store.file_chunk_counts().items())
        ],
    )
