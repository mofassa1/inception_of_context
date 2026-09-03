# ai-agent

RAG + coding-agent service (vendored from the `main` branch).

## Layout

- `p1/` — codebase indexer: AST chunker, HF embeddings, ChromaDB store, file watcher
- `p2/` — FastAPI service over Ollama (`/query`, `/retrieve`, `/ask/stream`, `/status`, `/files`)
- `p3_beta/` — structured `CodePatch` generation, sanity checks, atomic apply, test loop
- `serve.py` — uvicorn entry point: `p2.server.app` + `POST /index` (from `agent_index.py`)
- `agent_index.py` — `POST /index {path}`, reuses `p1` classes; leaves `p1/ p2/ p3_beta/` untouched

## Prerequisites

- [Ollama](https://ollama.com) running, with the models pulled:
  ```
  ollama pull qwen2.5:3b
  ollama pull qwen2.5-coder:3b
  ```
- Python 3.13

## Setup

```
uv sync
```

Dependencies are declared in `pyproject.toml`; `uv sync` creates `.venv/` and
locks them in `uv.lock`. `torch` is pinned to the CPU wheel index on Linux to
avoid pulling the CUDA runtime.

`.env` is committed with working defaults; edit it if your Ollama host, models,
cache dir, or Chroma path differ.

## Run

All commands run from this directory (`ai-agent/`), which puts `p1` / `p2` /
`p3_beta` on the import path.

Serve the API (`make agent` does this):

```
uv run uvicorn serve:app --host 127.0.0.1 --port 8001
```

The IDE backend proxies this service at `/api/agent/*` (see `backend/main.py`),
so the desktop app only talks to `:8000`.

Index a project (also starts a watcher for incremental re-index):

```
uv run python -m p1.index /path/to/project
```

## Config

All tunables are in `.env`: `OLLAMA_HOST`, `ASK_MODEL`, `CODE_MODEL`,
`EMBED_MODEL`, `HF_CACHE`, `CHROMA_PATH`, `CHROMA_COLLECTION`.

## Known issues (not yet addressed)

- `GET /query` returns a raw generator — use `POST /ask/stream` instead.
- `PATCH /chunks_modify` ignores its payload and rewrites files from stored
  chunks; it can corrupt files. Do not use.
- `p3_beta/patch_loop.py` has hard-coded absolute paths and an
  `UnboundLocalError` on `feedback`.
- Single global Chroma collection — no per-workspace isolation.
- No auth or path sandboxing on the file / patch endpoints.
