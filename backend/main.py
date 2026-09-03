import os
import shutil
from pathlib import Path
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import sys
from pathlib import Path
from pydantic import BaseModel
load_dotenv()

AGENT_URL = os.getenv("AGENT_URL", "http://127.0.0.1:8001").rstrip("/")

app = FastAPI(
    title="Mini IDE Backend",
    description="Local filesystem API for the mini IDE desktop app.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "Health", "description": "Service health checks."},
        {"name": "Filesystem", "description": "Operations on the local filesystem."},
        {"name": "Agent", "description": "Proxied calls to the AI agent service."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

IGNORED_NAMES = set(
    os.getenv("IGNORED_NAMES", "node_modules,.git,__pycache__").split(",")
)


class WriteBody(BaseModel):
    path: str
    content: str

class RenameBody(BaseModel):
    path: str
    new_path: str

class AgentIndexBody(BaseModel):
    path: str


class AgentAskBody(BaseModel):
    query: str
    k: int = 5

class CreateBody(BaseModel):
    path: str
    is_dir: bool = False


class IndexManager:
    def __init__(self):
        self.process: subprocess.Popen | None = None

    def start(self, target_dir: str) -> None:
        if self.is_running():
            raise RuntimeError("Indexer is already running")

        project_root = Path(__file__).resolve().parents[1]

        ai_agent_dir = project_root / "ai-agent"
        python = ai_agent_dir / ".venv" / "bin" / "python"

        print("*" * 50)
        print(f"Python: {python}")
        print(f"Working directory: {ai_agent_dir}")
        print(f"Target directory: {target_dir}")
        print("*" * 50)

        self.process = subprocess.Popen(
            [
                str(python),
                "-m",
                "p1.index",
                target_dir,
            ],
            cwd=str(ai_agent_dir),
        )

    def stop(self) -> None:
        if self.process is None:
            return

        if self.is_running():
            self.process.terminate()
            self.process.wait()

        self.process = None

    def is_running(self) -> bool:
        return (
            self.process is not None
            and self.process.poll() is None
        )
index_manager = IndexManager()

def launch_indexer(target_dir: str) -> None:
    index_manager.start(target_dir)

def _resolve(raw: str) -> Path:
    if not raw:
        raise HTTPException(400, "path is required")
    return Path(raw).expanduser().resolve()



@app.get("/", tags=["Health"], summary="Health check")
def hello():
    return "hello"

@app.get("/indexer/start", tags=["Agent"], summary="Start the indexer")
def start_indexer(body: str):
    try:
        launch_indexer(body)
        return {"ok": True}
    except Exception as e:
        return {"ok": False}

@app.get("/api/fs/list", tags=["Filesystem"], summary="List directory entries")
def list_dir(path: str):
    p = _resolve(path)
    if not p.is_dir():
        raise HTTPException(404, f"not a directory: {p}")
    entries = [
        {"name": child.name, "path": str(child), "is_dir": child.is_dir()}
        for child in p.iterdir()
        if not child.name.startswith(".") and child.name not in IGNORED_NAMES
    ]
    entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
    return {"path": str(p), "entries": entries}


@app.get("/api/fs/read", tags=["Filesystem"], summary="Read a text file")
def read_file(path: str):
    p = _resolve(path)
    if not p.is_file():
        raise HTTPException(404, f"not a file: {p}")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(422, "binary file, cannot display as text")
    return {"path": str(p), "content": content}





@app.put("/api/fs/write", tags=["Filesystem"], summary="Write content to a file")
def write_file(body: WriteBody):
    p = _resolve(body.path)
    if not p.is_file():
        raise HTTPException(404, f"not a file: {p}")
    p.write_text(body.content, encoding="utf-8")
    return {"ok": True}




@app.post("/api/fs/create", tags=["Filesystem"], summary="Create a file or directory")
def create_entry(body: CreateBody):
    p = _resolve(body.path)
    if p.exists():
        raise HTTPException(409, f"already exists: {p}")
    if not p.parent.is_dir():
        raise HTTPException(404, f"parent directory does not exist: {p.parent}")
    if body.is_dir:
        p.mkdir()
    else:
        p.touch()
    return {"path": str(p), "is_dir": body.is_dir}


@app.delete("/api/fs/delete", tags=["Filesystem"], summary="Delete a file or directory")
def delete_entry(path: str):
    p = _resolve(path)
    if not p.exists():
        raise HTTPException(404, f"not found: {p}")
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
    return {"ok": True}



@app.post("/api/fs/rename", tags=["Filesystem"], summary="Rename a file or directory")
def rename_entry(body: RenameBody):
    src = _resolve(body.path)
    dst = _resolve(body.new_path)
    if not src.exists():
        raise HTTPException(404, f"not found: {src}")
    if dst.exists():
        raise HTTPException(409, f"already exists: {dst}")
    src.rename(dst)
    return {"path": str(dst), "is_dir": dst.is_dir()}




async def _agent_request(method: str, path: str, json: dict | None = None):
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            res = await client.request(method, f"{AGENT_URL}{path}", json=json)
    except httpx.RequestError as exc:
        raise HTTPException(502, f"agent service unavailable: {exc}") from exc
    if res.status_code >= 400:
        raise HTTPException(res.status_code, res.text)
    print("+" * 20)
    print("Agent request called:", method, path, json)
    print("+" * 20)
    return res.json()


@app.get("/api/agent/health", tags=["Agent"], summary="Agent liveness")
async def agent_health():
    return await _agent_request("GET", "/")


@app.get("/api/agent/status", tags=["Agent"], summary="Agent index / model status")
async def agent_status():
    return await _agent_request("GET", "/status/")


@app.post("/api/agent/index", tags=["Agent"], summary="Index a folder into the agent")
async def agent_index(body: AgentIndexBody):
    return await _agent_request("POST", "/index", {"path": body.path})


@app.post("/api/agent/retrieve", tags=["Agent"], summary="Nearest chunks (no LLM)")
async def agent_retrieve(body: AgentAskBody):
    return await _agent_request(
        "POST", "/retrieve", {"query": body.query, "k": body.k}
    )


@app.post("/api/agent/ask", tags=["Agent"], summary="Ask the agent (streamed)")
async def agent_ask(body: AgentAskBody):
    async def stream():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{AGENT_URL}/ask/stream",
                    json={"query": body.query, "k": body.k},
                ) as res:
                    if res.status_code >= 400:
                        await res.aread()
                        yield f"[agent error {res.status_code}] {res.text}".encode()
                        return
                    async for chunk in res.aiter_bytes():
                        yield chunk
        except httpx.RequestError as exc:
            yield f"[agent service unavailable] {exc}".encode()

    return StreamingResponse(stream(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
    )
