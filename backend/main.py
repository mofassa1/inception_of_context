import shutil
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

IGNORED_NAMES = {"node_modules", ".git", "__pycache__"}


def _resolve(raw: str) -> Path:
    if not raw:
        raise HTTPException(400, "path is required")
    return Path(raw).expanduser().resolve()


@app.get("/")
def hello():
    return "hello"


@app.get("/api/fs/list")
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


@app.get("/api/fs/read")
def read_file(path: str):
    p = _resolve(path)
    if not p.is_file():
        raise HTTPException(404, f"not a file: {p}")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(422, "binary file, cannot display as text")
    return {"path": str(p), "content": content}


class WriteBody(BaseModel):
    path: str
    content: str


@app.put("/api/fs/write")
def write_file(body: WriteBody):
    p = _resolve(body.path)
    if not p.is_file():
        raise HTTPException(404, f"not a file: {p}")
    p.write_text(body.content, encoding="utf-8")
    return {"ok": True}


class CreateBody(BaseModel):
    path: str
    is_dir: bool = False


@app.post("/api/fs/create")
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


@app.delete("/api/fs/delete")
def delete_entry(path: str):
    p = _resolve(path)
    if not p.exists():
        raise HTTPException(404, f"not found: {p}")
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
    return {"ok": True}


class RenameBody(BaseModel):
    path: str
    new_path: str


@app.post("/api/fs/rename")
def rename_entry(body: RenameBody):
    src = _resolve(body.path)
    dst = _resolve(body.new_path)
    if not src.exists():
        raise HTTPException(404, f"not found: {src}")
    if dst.exists():
        raise HTTPException(409, f"already exists: {dst}")
    src.rename(dst)
    return {"path": str(dst), "is_dir": dst.is_dir()}
