from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from fix import (
    ChunkStore,
    EmbedderAdapter,
    FixChunker,
    FixWatcher,
    model_names,
    shared_embedder,
    shared_store,
)
from p1.core.config import Settings
from p1.core.events import EventBus
from p1.runtime import RuntimeInfo
from p1.service import IndexingService
from p2.conversations import ConversationStore
from p2.filesystem import FileSystemService
from p2.llm import OllamaModelManager
from p2.retrieval import RetrievalService
from p3.loop import PatchLoop
from p3.patching import PatchingService


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_runtime_info() -> RuntimeInfo:
    return RuntimeInfo()


@lru_cache(maxsize=1)
def get_event_bus() -> EventBus:
    return EventBus()


@lru_cache(maxsize=1)
def get_chunker() -> FixChunker:
    return FixChunker()


@lru_cache(maxsize=1)
def get_watcher() -> FixWatcher:
    return FixWatcher()


@lru_cache(maxsize=1)
def get_vector_store() -> ChunkStore:
    return shared_store(get_runtime_info())


@lru_cache(maxsize=1)
def get_embedder() -> EmbedderAdapter:
    return shared_embedder()


@lru_cache(maxsize=1)
def get_llm_manager() -> OllamaModelManager:
    ask_model, code_model = model_names()

    return OllamaModelManager(
        ask_model=ask_model,
        code_model=code_model,
        ollama_host=get_settings().ollama_host,
        auto_pull=get_settings().auto_pull_models,
    )


@lru_cache(maxsize=1)
def get_indexing_service() -> IndexingService:
    return IndexingService(
        store=get_vector_store(),
        embedder=get_embedder(),
        chunker=get_chunker(),
        watcher=get_watcher(),
        event_bus=get_event_bus(),
        runtime=get_runtime_info(),
        visible_roots=get_settings().host_roots,
    )


@lru_cache(maxsize=1)
def get_retrieval_service() -> RetrievalService:
    return RetrievalService(
        store=get_vector_store(),
        embedder=get_embedder(),
        runtime=get_runtime_info(),
    )


@lru_cache(maxsize=1)
def get_conversation_store() -> ConversationStore:
    return ConversationStore(get_settings().conversations_path)


@lru_cache(maxsize=1)
def get_filesystem_service() -> FileSystemService:
    settings = get_settings()
    return FileSystemService(settings.ignored_names, settings.host_roots)


@lru_cache(maxsize=1)
def get_patching_service() -> PatchingService:
    return PatchingService(
        store=get_vector_store(),
        retrieval=get_retrieval_service(),
        llm=get_llm_manager(),
    )


@lru_cache(maxsize=1)
def get_patch_loop() -> PatchLoop:
    return PatchLoop(patching=get_patching_service())


def warm_up() -> None:
    """Build the expensive singletons at startup so the first request does not
    pay for loading the embedding model."""
    get_vector_store()
    get_embedder()
    get_indexing_service()
    get_retrieval_service()
    get_patching_service()
    get_conversation_store()


SettingsDep = Annotated[Settings, Depends(get_settings)]
RuntimeInfoDep = Annotated[RuntimeInfo, Depends(get_runtime_info)]
ChunkerDep = Annotated[FixChunker, Depends(get_chunker)]
EventBusDep = Annotated[EventBus, Depends(get_event_bus)]
VectorStoreDep = Annotated[ChunkStore, Depends(get_vector_store)]
EmbedderDep = Annotated[EmbedderAdapter, Depends(get_embedder)]
LLMManagerDep = Annotated[OllamaModelManager, Depends(get_llm_manager)]
WatcherDep = Annotated[FixWatcher, Depends(get_watcher)]
IndexingServiceDep = Annotated[IndexingService, Depends(get_indexing_service)]
RetrievalServiceDep = Annotated[RetrievalService, Depends(get_retrieval_service)]
PatchingServiceDep = Annotated[PatchingService, Depends(get_patching_service)]
PatchLoopDep = Annotated[PatchLoop, Depends(get_patch_loop)]
ConversationStoreDep = Annotated[ConversationStore, Depends(get_conversation_store)]
FileSystemServiceDep = Annotated[FileSystemService, Depends(get_filesystem_service)]
