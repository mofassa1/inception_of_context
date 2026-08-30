# Backend

FastAPI backend for the mini IDE. It exposes a local filesystem API on
`127.0.0.1:8000` that the Electron frontend uses to list, read, write, create,
rename, and delete files and directories.

## Run

```bash
cd backend
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Or from the repo root:

```bash
make backend
```

## API documentation

FastAPI automatically generates interactive API docs:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

## Endpoints

| Method | Endpoint          | Description                 |
| ------ | ----------------- | --------------------------- |
| GET    | `/`               | Health check                |
| GET    | `/api/fs/list`    | List entries in a directory |
| GET    | `/api/fs/read`    | Read a text file            |
| PUT    | `/api/fs/write`   | Write content to a file     |
| POST   | `/api/fs/create`  | Create a file or directory  |
| POST   | `/api/fs/rename`  | Rename a file or directory  |
| DELETE | `/api/fs/delete`  | Delete a file or directory  |

## Notes

- Paths are resolved with `Path.expanduser().resolve()`, so both relative and
  absolute paths work.
- Hidden files/folders (dotfiles) and `node_modules`, `.git`, and `__pycache__`
  are filtered out of directory listings.
- Binary files cannot be read as text (returns `422`).

