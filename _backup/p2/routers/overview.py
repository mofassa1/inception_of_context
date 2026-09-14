from fastapi import APIRouter

from p2.deps import (
    EmbedderDep,
    EventBusDep,
    LLMManagerDep,
    RuntimeInfoDep,
    VectorStoreDep,
    WatcherDep,
)
from p2.schemas.files import IndexedFileDTO
from p2.schemas.status import (
    AgentStatusDTO,
    EventBusStatsDTO,
    StatusResponseDTO,
)

router = APIRouter(tags=["status"])


@router.get("/status", response_model=StatusResponseDTO)
def get_status(
    store: VectorStoreDep,
    embedder: EmbedderDep,
    llm: LLMManagerDep,
    runtime: RuntimeInfoDep,
    watcher: WatcherDep,
    event_bus: EventBusDep,
) -> StatusResponseDTO:
    counts = store.file_chunk_counts()

    return StatusResponseDTO(
        status=AgentStatusDTO(
            chunksIndexed=store.count_chunks(),
            targetProject=runtime.target_project,
            chromaPath=runtime.chroma_path,
            askModel=llm.ask_model,
            codeModel=llm.code_model,
            embedModel=embedder.model_name,
            ollamaBackend=llm.ollama_host,
            watching=watcher.is_running(),
            events=EventBusStatsDTO(**event_bus.stats()),
        ),
        files=[
            IndexedFileDTO(name=path, chunks=count)
            for path, count in sorted(counts.items())
        ],
        filesIndexed=len(counts),
    )
