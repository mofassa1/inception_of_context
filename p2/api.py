# The AI agent API of the subject: the index state, retrieval, retrieve-then-generate,
# a file events stream, and the patch loop of p3.
# The indexer and its watcher run in this process, so there is one ChromaDB client
# and one embedding model in memory.

import asyncio
import contextlib
import json
import logging
import os
import queue
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from p1.indexer import EMBEDDING_MODEL, Embedder, Indexer
from p1.store import Store
from p2 import models
from p3.patch_loop import loop

TARGET_PATH = os.path.realpath(os.environ["TARGET_PATH"])
CHROMA_PATH = os.environ.get("CHROMA_PATH", "chroma_db")
EVENT_POLL_SECONDS = 0.3

log = logging.getLogger("uvicorn.error")

store = Store(CHROMA_PATH, TARGET_PATH)
embedder = Embedder()
event_subscribers = []


# ---------------------------------------------------------------------------
# Events: the watcher pushes here, GET /events streams to the dashboard
# ---------------------------------------------------------------------------


def publish_event(kind, path, chunk_count):
    event = {
        "id": uuid.uuid4().hex[:12],
        "kind": kind,
        "path": path,
        "chunk_count": chunk_count,
        "at": time.time(),
    }
    log.info(f"{kind} {path} ({chunk_count} chunks)")
    for subscriber in list(event_subscribers):
        subscriber.put(event)


indexer = Indexer(TARGET_PATH, store, embedder, on_event=publish_event)


@contextlib.asynccontextmanager
async def lifespan(api):
    log.info(f"target {TARGET_PATH}, models {models.ASK_MODEL} and {models.CODE_MODEL}")
    missing = models.missing_models()
    if missing:
        log.warning(f"models not pulled: {', '.join(missing)} (run make install)")
    indexer.start()
    yield


app = FastAPI(title="AI agent", lifespan=lifespan)


# ---------------------------------------------------------------------------
# GET /status, GET /files, GET /file, GET /chunks: what is in the index
# ---------------------------------------------------------------------------


class IndexedFileDTO(BaseModel):
    name: str
    chunks: int


class StatusDTO(BaseModel):
    chunks_indexed: int
    target_project: str
    chroma_path: str
    embed_model: str
    ask_model: str
    code_model: str
    ollama_backend: str
    watching: bool
    files: list[IndexedFileDTO]


class ChunkDTO(BaseModel):
    id: str
    content: str
    file: str
    kind: str
    qualified_name: str
    start_line: int
    end_line: int
    content_hash: str


class FilesDTO(BaseModel):
    files: list[IndexedFileDTO]


class FileChunksDTO(BaseModel):
    file: str
    chunks: list[ChunkDTO]


class ChunksPageDTO(BaseModel):
    chunks: list[ChunkDTO]
    offset: int
    limit: int
    total: int


def as_chunk_dto(chunk):
    metadata = chunk["metadata"]
    return ChunkDTO(id=chunk["id"], content=chunk["content"], **metadata)


def as_file_list(counts):
    files = []
    for name in sorted(counts):
        files.append(IndexedFileDTO(name=name, chunks=counts[name]))
    return files


@app.get("/status", response_model=StatusDTO)
def get_status():
    counts = store.files_with_counts()
    return StatusDTO(
        chunks_indexed=store.count(),
        target_project=TARGET_PATH,
        chroma_path=store.chroma_path,
        embed_model=EMBEDDING_MODEL,
        ask_model=models.ASK_MODEL,
        code_model=models.CODE_MODEL,
        ollama_backend=models.OLLAMA_URL,
        watching=indexer.watching,
        files=as_file_list(counts),
    )


@app.get("/files", response_model=FilesDTO)
def get_files():
    return FilesDTO(files=as_file_list(store.files_with_counts()))


@app.get("/file", response_model=FileChunksDTO)
def get_file(path: str):
    chunks = store.chunks_of_file(path)
    if not chunks:
        raise HTTPException(status_code=404, detail=f"no chunk indexed for {path}")
    return FileChunksDTO(file=path, chunks=[as_chunk_dto(chunk) for chunk in chunks])


@app.get("/chunks", response_model=ChunksPageDTO)
def get_chunks(offset: int = 0, limit: int = 50):
    chunks = store.page(offset, limit)
    return ChunksPageDTO(
        chunks=[as_chunk_dto(chunk) for chunk in chunks],
        offset=offset,
        limit=limit,
        total=store.count(),
    )


# ---------------------------------------------------------------------------
# POST /context: the chunks closest to an intent, ignored paths dropped
# ---------------------------------------------------------------------------


class ContextInputDTO(BaseModel):
    query: str
    k: int = 5
    ignored_paths: list[str] = []


class SourceDTO(BaseModel):
    id: str
    file: str
    start_line: int
    end_line: int
    kind: str
    qualified_name: str
    score: float
    content: str


class ContextDTO(BaseModel):
    sources: list[SourceDTO]


def is_ignored(path, ignored_paths):
    for ignored_path in ignored_paths:
        ignored = os.path.realpath(ignored_path)
        if path == ignored or path.startswith(ignored + os.sep):
            return True
    return False


def find_sources(query, k, ignored_paths):
    embedding = embedder.embed([query])[0]
    sources = []
    for result in store.search(embedding, k + len(ignored_paths) * 2 + 5):
        metadata = result["metadata"]
        if is_ignored(os.path.realpath(metadata["file"]), ignored_paths):
            continue
        sources.append(
            SourceDTO(
                id=result["id"],
                score=result["score"],
                content=result["content"],
                file=metadata["file"],
                start_line=metadata["start_line"],
                end_line=metadata["end_line"],
                kind=metadata["kind"],
                qualified_name=metadata["qualified_name"],
            )
        )
        if len(sources) == k:
            break
    return sources


@app.post("/context", response_model=ContextDTO)
def post_context(body: ContextInputDTO):
    return ContextDTO(sources=find_sources(body.query, body.k, body.ignored_paths))


# ---------------------------------------------------------------------------
# POST /ask: retrieve, then generate. One JSON line per piece:
# first the sources, then the text as it comes.
# ---------------------------------------------------------------------------


class ChatDTO(BaseModel):
    role: str
    content: str


class AskInputDTO(BaseModel):
    query: str
    k: int = 5
    ignored_paths: list[str] = []
    history: list[ChatDTO] = []


@app.post("/ask")
def post_ask(body: AskInputDTO):
    sources = find_sources(body.query, body.k, body.ignored_paths)
    context = "\n\n".join(
        f"{source.file}:{source.start_line}\n{source.content}" for source in sources
    )
    history = [(chat.role, chat.content) for chat in body.history]

    def answer_lines():
        yield (
            json.dumps({"type": "sources", "sources": [source.model_dump() for source in sources]})
            + "\n"
        )
        for text in models.stream_answer(body.query, context, history):
            yield json.dumps({"type": "token", "text": text}) + "\n"

    return StreamingResponse(answer_lines(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# GET /events: what the watcher did, as Server-Sent Events
# ---------------------------------------------------------------------------


@app.get("/events")
async def get_events():
    subscriber = queue.SimpleQueue()
    event_subscribers.append(subscriber)

    async def event_lines():
        try:
            while True:
                while not subscriber.empty():
                    yield "data: " + json.dumps(subscriber.get()) + "\n\n"
                await asyncio.sleep(EVENT_POLL_SECONDS)
        finally:
            event_subscribers.remove(subscriber)

    return StreamingResponse(event_lines(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# POST /patch/loop: the loop of p3. A normal def, so it runs in a thread
# and the other routes keep answering while a patch is being written.
# ---------------------------------------------------------------------------


class PatchLoopInputDTO(BaseModel):
    query: str
    k: int = 5
    target_path: str | None = None
    ignored_paths: list[str] = []


class PatchFileDTO(BaseModel):
    path: str
    op: str
    content: str


class SanityDTO(BaseModel):
    code: int
    message: str


class PatchAttemptDTO(BaseModel):
    number: int
    summary: str
    files: list[PatchFileDTO]
    sanity: SanityDTO
    applied: bool
    validation_passed: bool
    validation_output: str


class PatchLoopDTO(BaseModel):
    succeeded: bool
    attempts: list[PatchAttemptDTO]
    rolled_back: bool
    files_touched: list[str]
    summary: str


def search_for_patch(query, k, ignored_paths):
    return [source.model_dump() for source in find_sources(query, k, ignored_paths)]


@app.post("/patch/loop", response_model=PatchLoopDTO)
def post_patch_loop(body: PatchLoopInputDTO):
    try:
        return loop(
            query=body.query,
            k=body.k,
            project_root=TARGET_PATH,
            target_path=body.target_path,
            ignored_paths=body.ignored_paths,
            search=search_for_patch,
            generate=models.generate_patch,
            report=publish_event,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error))
