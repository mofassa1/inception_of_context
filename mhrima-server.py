import json
import shutil
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Literal
from urllib.parse import quote

import httpx
import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, RootModel, ValidationError

PORT = 8001
AI_AGENT_URL = "http://127.0.0.1:8000"
DATABASE_PATH = Path(__file__).parent / "sessions.sqlite3"
HIDDEN_NAMES = ["node_modules", ".git", "__pycache__"]
HISTORY_SIZE = 5
HISTORY_CHAT_MAX_CHARS = 500
NEW_CONVERSATION_TITLE = "New conversation"
DEFAULT_IGNORED_NAMES = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "venv",
    ".venv",
    "__pycache__",
    "chroma_db",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".next",
    ".cache",
    "coverage",
]


# ---------------------------------------------------------------------------
# Database
#
#   conversations  one folder has many conversations
#   chats          one conversation has many chats (role, content, mode)
#   ignore_rules   one conversation has many ignore rules (pattern, is_ignored)
# ---------------------------------------------------------------------------


def open_database():
    database = sqlite3.connect(DATABASE_PATH)
    database.row_factory = sqlite3.Row
    database.execute("PRAGMA foreign_keys = ON")
    return database


def create_tables():
    database = open_database()
    database.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id         TEXT PRIMARY KEY,
            directory  TEXT NOT NULL,
            title      TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    database.execute(
        """
        CREATE TABLE IF NOT EXISTS chats (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role            TEXT NOT NULL,
            content         TEXT NOT NULL,
            mode            TEXT NOT NULL,
            sources         TEXT,
            created_at      REAL NOT NULL
        )
        """
    )
    database.execute(
        """
        CREATE TABLE IF NOT EXISTS ignore_rules (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            pattern         TEXT NOT NULL,
            is_ignored      INTEGER NOT NULL,
            UNIQUE (conversation_id, pattern)
        )
        """
    )
    database.commit()
    database.close()


# ---------------------------------------------------------------------------
# AI agent
#
# The AI agent server does the indexing, retrieval, answers and patches.
# Every AI route below has its DTOs on top of it: the answer of the AI agent
# is checked against them, so a route works as soon as the AI agent returns
# that shape (see CHECK.md).
# ---------------------------------------------------------------------------


async def call_ai_agent(method, path, output_dto, params=None, body=None):
    try:
        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            response = await client.request(method, AI_AGENT_URL + path, params=params, json=body)
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"AI agent is not running on {AI_AGENT_URL}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"AI agent {method} {path} answered {response.status_code}: {response.text}",
        )

    try:
        return output_dto.model_validate(response.json())
    except ValueError as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI agent {method} {path} did not answer the shape in CHECK.md: {error}",
        )


async def stream_from_ai_agent(method, path, body=None):
    client = httpx.AsyncClient(timeout=None, follow_redirects=True)
    request = client.build_request(method, AI_AGENT_URL + path, json=body)

    try:
        response = await client.send(request, stream=True)
    except httpx.ConnectError:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"AI agent is not running on {AI_AGENT_URL}")

    if response.status_code != 200:
        error_text = (await response.aread()).decode()
        await response.aclose()
        await client.aclose()
        raise HTTPException(
            status_code=response.status_code,
            detail=f"AI agent {method} {path} answered {response.status_code}: {error_text}",
        )

    return client, response


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="mhrima-server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Files: /api/fs/...
# ---------------------------------------------------------------------------


class ListFolderInputDTO(BaseModel):
    path: str


class FolderEntryDTO(BaseModel):
    name: str
    path: str
    is_dir: bool


class ListFolderOutputDTO(BaseModel):
    path: str
    entries: list[FolderEntryDTO]


@app.get("/api/fs/list", response_model=ListFolderOutputDTO)
def list_folder(params: ListFolderInputDTO = Depends()):
    folder = Path(params.path)
    if not folder.is_dir():
        raise HTTPException(status_code=404, detail=f"not a folder: {params.path}")

    folders = []
    files = []
    for child in folder.iterdir():
        if child.name in HIDDEN_NAMES:
            continue
        entry = FolderEntryDTO(name=child.name, path=str(child), is_dir=child.is_dir())
        if child.is_dir():
            folders.append(entry)
        else:
            files.append(entry)

    folders.sort(key=lambda entry: entry.name.lower())
    files.sort(key=lambda entry: entry.name.lower())

    return ListFolderOutputDTO(path=str(folder), entries=folders + files)


class ReadFileInputDTO(BaseModel):
    path: str


class ReadFileOutputDTO(BaseModel):
    path: str
    content: str


@app.get("/api/fs/read", response_model=ReadFileOutputDTO)
def read_file(params: ReadFileInputDTO = Depends()):
    file = Path(params.path)
    if not file.is_file():
        raise HTTPException(status_code=404, detail=f"not a file: {params.path}")

    try:
        content = file.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=415, detail=f"binary file, cannot show it as text: {params.path}"
        )

    return ReadFileOutputDTO(path=str(file), content=content)


class WriteFileInputDTO(BaseModel):
    path: str
    content: str


class WriteFileOutputDTO(BaseModel):
    ok: bool


@app.put("/api/fs/write", response_model=WriteFileOutputDTO)
def write_file(body: WriteFileInputDTO):
    file = Path(body.path)
    if not file.is_file():
        raise HTTPException(status_code=404, detail=f"not a file: {body.path}")

    file.write_text(body.content, encoding="utf-8")
    return WriteFileOutputDTO(ok=True)


class CreateEntryInputDTO(BaseModel):
    path: str
    is_dir: bool = False


class CreateEntryOutputDTO(BaseModel):
    path: str
    is_dir: bool


@app.post("/api/fs/create", response_model=CreateEntryOutputDTO)
def create_entry(body: CreateEntryInputDTO):
    entry = Path(body.path)
    if entry.exists():
        raise HTTPException(status_code=409, detail=f"already exists: {body.path}")
    if not entry.parent.is_dir():
        raise HTTPException(status_code=404, detail=f"parent folder does not exist: {entry.parent}")

    if body.is_dir:
        entry.mkdir()
    else:
        entry.touch()

    return CreateEntryOutputDTO(path=str(entry), is_dir=body.is_dir)


class RenameEntryInputDTO(BaseModel):
    path: str
    new_path: str


class RenameEntryOutputDTO(BaseModel):
    path: str
    is_dir: bool


@app.post("/api/fs/rename", response_model=RenameEntryOutputDTO)
def rename_entry(body: RenameEntryInputDTO):
    source = Path(body.path)
    destination = Path(body.new_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"not found: {body.path}")
    if destination.exists():
        raise HTTPException(status_code=409, detail=f"already exists: {body.new_path}")

    source.rename(destination)
    return RenameEntryOutputDTO(path=str(destination), is_dir=destination.is_dir())


class DeleteEntryInputDTO(BaseModel):
    path: str


class DeleteEntryOutputDTO(BaseModel):
    ok: bool


@app.delete("/api/fs/delete", response_model=DeleteEntryOutputDTO)
def delete_entry(params: DeleteEntryInputDTO = Depends()):
    entry = Path(params.path)
    if not entry.exists():
        raise HTTPException(status_code=404, detail=f"not found: {params.path}")

    if entry.is_dir():
        shutil.rmtree(entry)
    else:
        entry.unlink()

    return DeleteEntryOutputDTO(ok=True)


# ---------------------------------------------------------------------------
# Conversations: /conversations...
# ---------------------------------------------------------------------------


class AnswerSourceDTO(BaseModel):
    rank: int
    id: str
    file: str
    start_line: int
    end_line: int
    kind: str
    qualified_name: str
    score: float
    content: str


class ChatDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    mode: Literal["ask", "agent"]
    sources: list[AnswerSourceDTO] | None
    createdAt: float


class ConversationDTO(BaseModel):
    id: str
    directory: str
    title: str
    createdAt: float
    updatedAt: float
    chats: list[ChatDTO]


def insert_conversation(directory):
    conversation_id = uuid.uuid4().hex[:12]
    now = time.time()

    database = open_database()
    database.execute(
        """
        INSERT INTO conversations (id, directory, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (conversation_id, directory, NEW_CONVERSATION_TITLE, now, now),
    )
    database.commit()
    database.close()

    return conversation_id


def find_conversation(conversation_id):
    database = open_database()
    conversation = database.execute(
        "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
    ).fetchone()
    chat_rows = database.execute(
        "SELECT * FROM chats WHERE conversation_id = ? ORDER BY id", (conversation_id,)
    ).fetchall()
    database.close()

    if conversation is None:
        raise HTTPException(status_code=404, detail=f"conversation not found: {conversation_id}")

    chats = []
    for row in chat_rows:
        sources = None
        if row["sources"] is not None:
            sources = json.loads(row["sources"])

        chats.append(
            ChatDTO(
                role=row["role"],
                content=row["content"],
                mode=row["mode"],
                sources=sources,
                createdAt=row["created_at"],
            )
        )

    return ConversationDTO(
        id=conversation["id"],
        directory=conversation["directory"],
        title=conversation["title"],
        createdAt=conversation["created_at"],
        updatedAt=conversation["updated_at"],
        chats=chats,
    )


def insert_chat(conversation_id, role, content, mode, sources=None):
    conversation = find_conversation(conversation_id)
    now = time.time()

    sources_text = None
    if sources is not None:
        sources_text = json.dumps(sources)

    # The first question becomes the title of the conversation.
    title = conversation.title
    if title == NEW_CONVERSATION_TITLE and role == "user":
        title = content[:60]

    database = open_database()
    database.execute(
        """
        INSERT INTO chats (conversation_id, role, content, mode, sources, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (conversation_id, role, content, mode, sources_text, now),
    )
    database.execute(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        (title, now, conversation_id),
    )
    database.commit()
    database.close()


class ListConversationsInputDTO(BaseModel):
    directory: str


class ConversationSummaryDTO(BaseModel):
    id: str
    title: str
    updatedAt: float
    chatCount: int


class ListConversationsOutputDTO(BaseModel):
    conversations: list[ConversationSummaryDTO]


@app.get("/conversations", response_model=ListConversationsOutputDTO)
def list_conversations(params: ListConversationsInputDTO = Depends()):
    directory = str(Path(params.directory).resolve())

    database = open_database()
    rows = database.execute(
        """
        SELECT conversations.id, conversations.title, conversations.updated_at,
               COUNT(chats.id) AS chat_count
        FROM conversations
        LEFT JOIN chats ON chats.conversation_id = conversations.id
        WHERE conversations.directory = ?
        GROUP BY conversations.id
        ORDER BY conversations.updated_at DESC
        """,
        (directory,),
    ).fetchall()
    database.close()

    conversations = []
    for row in rows:
        conversations.append(
            ConversationSummaryDTO(
                id=row["id"],
                title=row["title"],
                updatedAt=row["updated_at"],
                chatCount=row["chat_count"],
            )
        )

    return ListConversationsOutputDTO(conversations=conversations)


class CreateConversationInputDTO(BaseModel):
    directory: str


@app.post("/conversations", response_model=ConversationDTO)
def create_conversation(body: CreateConversationInputDTO):
    directory = Path(body.directory).resolve()
    if not directory.is_dir():
        raise HTTPException(status_code=404, detail=f"not a folder: {body.directory}")

    conversation_id = insert_conversation(str(directory))
    return find_conversation(conversation_id)


@app.get("/conversations/{conversation_id}", response_model=ConversationDTO)
def get_conversation(conversation_id: str):
    return find_conversation(conversation_id)


class NewChatDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    mode: Literal["ask", "agent"]
    sources: list[AnswerSourceDTO] | None = None


class AddChatsInputDTO(BaseModel):
    chats: list[NewChatDTO]


@app.patch("/conversations/{conversation_id}", response_model=ConversationDTO)
def add_chats(conversation_id: str, body: AddChatsInputDTO):
    for chat in body.chats:
        insert_chat(
            conversation_id, chat.role, chat.content, chat.mode, chat.model_dump()["sources"]
        )
    return find_conversation(conversation_id)


class DeleteConversationOutputDTO(BaseModel):
    ok: bool


@app.delete("/conversations/{conversation_id}", response_model=DeleteConversationOutputDTO)
def delete_conversation(conversation_id: str):
    find_conversation(conversation_id)

    database = open_database()
    database.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    database.commit()
    database.close()

    return DeleteConversationOutputDTO(ok=True)


# ---------------------------------------------------------------------------
# Ignore rules: /conversations/{conversation_id}/ignore-rules
#
# A rule pattern is a name ("node_modules", matches at any depth) or an
# absolute path ("/project/dist"). To know if a path is ignored, walk from the
# path up to the conversation folder: the first rule found wins, and at the
# same level a path rule wins over a name rule. Ignored files never reach the
# AI agent.
# ---------------------------------------------------------------------------


class IgnoreRuleDTO(BaseModel):
    pattern: str
    isIgnored: bool


def find_ignore_rules(conversation_id):
    database = open_database()
    rows = database.execute(
        "SELECT pattern, is_ignored FROM ignore_rules WHERE conversation_id = ? ORDER BY id",
        (conversation_id,),
    ).fetchall()

    # A conversation starts with the default names ignored.
    if len(rows) == 0:
        for name in DEFAULT_IGNORED_NAMES:
            database.execute(
                "INSERT INTO ignore_rules (conversation_id, pattern, is_ignored) VALUES (?, ?, 1)",
                (conversation_id, name),
            )
        database.commit()
        rows = database.execute(
            "SELECT pattern, is_ignored FROM ignore_rules WHERE conversation_id = ? ORDER BY id",
            (conversation_id,),
        ).fetchall()
    database.close()

    rules = []
    for row in rows:
        rules.append(IgnoreRuleDTO(pattern=row["pattern"], isIgnored=bool(row["is_ignored"])))
    return rules


def is_path_ignored(path, directory, rules):
    path_rules = {}
    name_rules = {}
    for rule in rules:
        if rule.pattern.startswith("/"):
            path_rules[rule.pattern] = rule.isIgnored
        else:
            name_rules[rule.pattern] = rule.isIgnored

    current = Path(path)
    folder = Path(directory)
    while folder in current.parents:
        if str(current) in path_rules:
            return path_rules[str(current)]
        if current.name in name_rules:
            return name_rules[current.name]
        current = current.parent

    return False


def find_ignored_paths(directory, rules):
    # The ignored files and folders of the conversation folder. Inside an
    # ignored folder nothing is listed: the whole folder is ignored.
    ignored_paths = []
    folders_to_visit = [Path(directory)]

    while len(folders_to_visit) > 0:
        folder = folders_to_visit.pop()
        try:
            children = sorted(folder.iterdir())
        except OSError:
            continue

        for child in children:
            if is_path_ignored(str(child), directory, rules):
                ignored_paths.append(str(child))
            elif child.is_dir() and not child.is_symlink():
                folders_to_visit.append(child)

    ignored_paths.sort()
    return ignored_paths


class ListIgnoreRulesOutputDTO(BaseModel):
    rules: list[IgnoreRuleDTO]


@app.get("/conversations/{conversation_id}/ignore-rules", response_model=ListIgnoreRulesOutputDTO)
def list_ignore_rules(conversation_id: str):
    find_conversation(conversation_id)
    return ListIgnoreRulesOutputDTO(rules=find_ignore_rules(conversation_id))


class SetIgnoreRuleInputDTO(BaseModel):
    pattern: str
    isIgnored: bool


@app.put("/conversations/{conversation_id}/ignore-rules", response_model=ListIgnoreRulesOutputDTO)
def set_ignore_rule(conversation_id: str, body: SetIgnoreRuleInputDTO):
    find_conversation(conversation_id)
    find_ignore_rules(conversation_id)

    database = open_database()
    database.execute(
        """
        INSERT INTO ignore_rules (conversation_id, pattern, is_ignored)
        VALUES (?, ?, ?)
        ON CONFLICT (conversation_id, pattern) DO UPDATE SET is_ignored = excluded.is_ignored
        """,
        (conversation_id, body.pattern, int(body.isIgnored)),
    )
    database.commit()
    database.close()

    return ListIgnoreRulesOutputDTO(rules=find_ignore_rules(conversation_id))


# ---------------------------------------------------------------------------
# AI agent routes
#
# The DTOs below use the names of the AI agent code (snake_case), and follow
# the objects it already returns wherever it has one.
# ---------------------------------------------------------------------------


class IndexedFileDTO(BaseModel):
    name: str
    chunks: int


class ChunkMetadataDTO(BaseModel):
    file: str
    kind: str
    qualified_name: str
    start_line: int
    end_line: int
    content_hash: str


class StoredChunksDTO(BaseModel):
    ids: list[str]
    documents: list[str]
    metadatas: list[ChunkMetadataDTO]


# GET /status ---------------------------------------------------------------
#
# The AI agent answers GET /status/ with this object. embed_model and watching
# are not in it yet (see CHECK.md).


class StatusOutputDTO(BaseModel):
    chunks_indexed: int
    target_project: str
    chroma_path: str
    ask_model: str
    code_model: str
    ollama_backend: str
    files: list[IndexedFileDTO]
    embed_model: str | None = None
    watching: bool | None = None


@app.get("/status", response_model=StatusOutputDTO)
async def get_status():
    return await call_ai_agent("GET", "/status/", StatusOutputDTO)


# GET /files ----------------------------------------------------------------


class FilesOutputDTO(BaseModel):
    files: list[IndexedFileDTO]


@app.get("/files", response_model=FilesOutputDTO)
async def get_all_files():
    return await call_ai_agent("GET", "/files", FilesOutputDTO)


# GET /files/{file_path} ----------------------------------------------------
#
# The AI agent loses the leading "/" of an absolute path sent as it is, so the
# path is sent encoded.


class ChunksForFileOutputDTO(BaseModel):
    file_path: str
    chunks: StoredChunksDTO


@app.get("/files/{file_path:path}", response_model=ChunksForFileOutputDTO)
async def get_chunks_for_file(file_path: str):
    encoded_path = quote(file_path, safe="")
    return await call_ai_agent("GET", "/files/" + encoded_path, ChunksForFileOutputDTO)


# GET /chunks?offset=&limit= ------------------------------------------------


class ChunksInputDTO(BaseModel):
    offset: int = 0
    limit: int = 25


class ChunksOutputDTO(BaseModel):
    chunks: StoredChunksDTO
    offset: int
    limit: int
    total: int


@app.get("/chunks", response_model=ChunksOutputDTO)
async def get_chunks(params: ChunksInputDTO = Depends()):
    return await call_ai_agent("GET", "/chunks", ChunksOutputDTO, params=params.model_dump())


# POST /retrieve ------------------------------------------------------------


class RetrieveInputDTO(BaseModel):
    query: str
    k: int = 5


class RetrievedSourceDTO(BaseModel):
    file: str
    line: int
    score: float


class RetrieveOutputDTO(RootModel[list[RetrievedSourceDTO]]):
    pass


@app.post("/retrieve", response_model=RetrieveOutputDTO)
async def retrieve_sources(body: RetrieveInputDTO):
    return await call_ai_agent("POST", "/retrieve", RetrieveOutputDTO, body=body.model_dump())


# POST /patch/loop ----------------------------------------------------------


class PatchLoopInputDTO(BaseModel):
    query: str
    k: int = 8
    targetPath: str | None = None
    conversationId: str | None = None


class AiAgentPatchLoopInputDTO(BaseModel):
    query: str
    k: int
    target_path: str | None
    ignored_paths: list[str]


class PatchFileDTO(BaseModel):
    path: str
    op: Literal["create", "modify", "delete"]
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


class PatchLoopOutputDTO(BaseModel):
    succeeded: bool
    attempts: list[PatchAttemptDTO]
    rolled_back: bool
    files_touched: list[str]
    summary: str


@app.post("/patch/loop", response_model=PatchLoopOutputDTO)
async def run_patch_loop(body: PatchLoopInputDTO):
    ignored_paths = []
    if body.conversationId is not None:
        conversation = find_conversation(body.conversationId)
        rules = find_ignore_rules(body.conversationId)
        ignored_paths = find_ignored_paths(conversation.directory, rules)

    ai_agent_body = AiAgentPatchLoopInputDTO(
        query=body.query,
        k=body.k,
        target_path=body.targetPath,
        ignored_paths=ignored_paths,
    )

    return await call_ai_agent(
        "POST", "/patch/loop", PatchLoopOutputDTO, body=ai_agent_body.model_dump()
    )


# GET /events ---------------------------------------------------------------
#
# A Server-Sent Events stream: each "data:" line holds one IndexEventDTO.


class IndexEventDTO(BaseModel):
    id: str
    kind: Literal["indexed", "modified", "deleted", "ignored", "patched", "error"]
    path: str
    chunk_count: int
    at: float


@app.get("/events")
async def stream_events():
    client, ai_agent_response = await stream_from_ai_agent("GET", "/events")

    async def events():
        async for line in ai_agent_response.aiter_lines():
            if not line.startswith("data:"):
                continue

            try:
                event = IndexEventDTO.model_validate_json(line[len("data:") :])
            except ValidationError:
                continue

            yield "data: " + event.model_dump_json() + "\n\n"

        await ai_agent_response.aclose()
        await client.aclose()

    return StreamingResponse(events(), media_type="text/event-stream")


# POST /ask -----------------------------------------------------------------
#
# The dashboard sends AskInputDTO. The AI agent gets its own AskRequest
# (AiAgentAskInputDTO): the question, followed by the last chats of the
# conversation, and the ignored paths. It answers with plain text, or with
# lines of JSON (application/x-ndjson): first one AskSourcesLineDTO, then
# AskTokenLineDTO pieces. Each line goes to the dashboard as it arrives,
# without sources from ignored files. When a conversation is given, the
# question and the full answer are stored in it.


class AskInputDTO(BaseModel):
    query: str
    k: int = 5
    conversationId: str | None = None


class AiAgentAskInputDTO(BaseModel):
    query: str
    k: int
    session_id: str
    ignored_paths: list[str]


class AskSourcesLineDTO(BaseModel):
    type: Literal["sources"]
    sources: list[AnswerSourceDTO]


class AskTokenLineDTO(BaseModel):
    type: Literal["token"]
    text: str


def question_with_history(question, chats):
    # The question comes first: the AI agent searches the chunks with this text.
    if len(chats) == 0:
        return question

    lines = [question, "", "Earlier in this conversation:"]
    for chat in chats:
        lines.append(chat.role + ": " + chat.content[:HISTORY_CHAT_MAX_CHARS])
    return "\n".join(lines)


@app.post("/ask")
async def ask(body: AskInputDTO):
    last_chats = []
    directory = ""
    rules = []
    ignored_paths = []
    if body.conversationId is not None:
        conversation = find_conversation(body.conversationId)
        last_chats = conversation.chats[-HISTORY_SIZE:]
        directory = conversation.directory
        rules = find_ignore_rules(body.conversationId)
        ignored_paths = find_ignored_paths(directory, rules)

    ai_agent_body = AiAgentAskInputDTO(
        query=question_with_history(body.query, last_chats),
        k=body.k,
        session_id=body.conversationId or "",
        ignored_paths=ignored_paths,
    )

    client, ai_agent_response = await stream_from_ai_agent(
        "POST", "/ask/stream", ai_agent_body.model_dump()
    )

    if body.conversationId is not None:
        insert_chat(body.conversationId, "user", body.query, "ask")

    content_type = ai_agent_response.headers.get("content-type", "")
    answers_with_json_lines = content_type.startswith("application/x-ndjson")

    async def answer_lines():
        answer = ""
        sources = None

        # The AI agent answers with plain text today: every piece of text it
        # streams becomes a token line, and there are no sources.
        if not answers_with_json_lines:
            async for text in ai_agent_response.aiter_text():
                if text == "":
                    continue
                answer = answer + text
                yield AskTokenLineDTO(type="token", text=text).model_dump_json() + "\n"
        else:
            async for line in ai_agent_response.aiter_lines():
                if line.strip() == "":
                    continue

                try:
                    line_data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                try:
                    if line_data.get("type") == "sources":
                        sources_line = AskSourcesLineDTO.model_validate(line_data)

                        kept_sources = []
                        for source in sources_line.sources:
                            if not is_path_ignored(source.file, directory, rules):
                                kept_sources.append(source)

                        sources_line = AskSourcesLineDTO(type="sources", sources=kept_sources)
                        sources = sources_line.model_dump()["sources"]
                        yield sources_line.model_dump_json() + "\n"

                    if line_data.get("type") == "token":
                        token_line = AskTokenLineDTO.model_validate(line_data)
                        answer = answer + token_line.text
                        yield token_line.model_dump_json() + "\n"
                except ValidationError:
                    continue

        await ai_agent_response.aclose()
        await client.aclose()

        if body.conversationId is not None and answer != "":
            insert_chat(body.conversationId, "assistant", answer, "ask", sources)

    return StreamingResponse(answer_lines(), media_type="application/x-ndjson")


if __name__ == "__main__":
    create_tables()
    uvicorn.run(app, host="127.0.0.1", port=PORT)
