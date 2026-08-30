# mini IDE

A small desktop IDE that lets you open a folder, browse its file tree, edit
files in a CodeMirror editor, and autosave changes back to disk.

## Architecture

- `frontend/` — Electron + React + Vite + TypeScript desktop app.
  - CodeMirror 6 editor with a custom dark theme and syntax highlighting.
  - React Query for filesystem requests and cache invalidation.
  - Debounced autosave (280 ms) with saved / saving / error status.
- `backend/` — FastAPI backend that exposes a local filesystem API on
  `127.0.0.1:8000`.
  - List, read, write, create, delete, and rename files/directories.
- `Makefile` — Convenience targets for install, build, and run.

## Requirements

- Node.js and npm
- Python 3.13 and [uv](https://docs.astral.sh/uv/)

## Setup

```bash
make install
```

This runs `npm install` in `frontend/` and `uv sync` in `backend/`.

## Usage

Run the backend only:

```bash
make backend
```

Build the frontend and launch the Electron desktop app (it also starts the
backend automatically):

```bash
make frontend
```

The Electron main process spawns the FastAPI backend and loads the Vite build
from `frontend/dist/index.html`.

## Filesystem API

The backend exposes the following endpoints:

| Method | Endpoint         | Description                 |
| ------ | ---------------- | --------------------------- |
| GET    | `/api/fs/list`   | List entries in a directory |
| GET    | `/api/fs/read`   | Read a text file            |
| PUT    | `/api/fs/write`  | Write content to a file     |
| POST   | `/api/fs/create` | Create a file or directory  |
| POST   | `/api/fs/rename` | Rename a file or directory  |
| DELETE | `/api/fs/delete` | Delete a file or directory  |

## Cleanup

```bash
make clean
```

Removes `frontend/dist`, `frontend/node_modules`, `backend/.venv`, and
`backend/__pycache__`.
