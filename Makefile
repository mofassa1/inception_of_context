.PHONY: install install-frontend install-backend install-agent \
        build app all frontend backend agent clean

SHELL := /bin/bash

# uv hardlinks from its cache by default; fall back to copy when the cache and
# the target venv live on different filesystems. Override UV_CACHE_DIR in your
# environment to move the cache onto a disk with room (the home partition is small).
export UV_LINK_MODE := copy

install: install-frontend install-backend install-agent

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && uv sync

install-agent:
	cd ai-agent && uv sync

build: install-frontend
	cd frontend && npm run build

# Electron runs in the foreground; when it exits the trap tears down the agent
# and backend. `set -m` puts each background job in its own process group and
# `exec` makes uv the group leader, so `kill -- -$pid` reaches uvicorn/python too.
app all: install build
	@set -m; \
	fuser -k 8000/tcp 8001/tcp 2>/dev/null || true; \
	( cd ai-agent && exec uv run uvicorn serve:app --host 127.0.0.1 --port 8001 ) & agent_pid=$$!; \
	( cd backend && exec uv run python main.py ) & backend_pid=$$!; \
	trap 'kill -- -$$agent_pid -$$backend_pid 2>/dev/null; fuser -k 8000/tcp 8001/tcp 2>/dev/null' EXIT INT TERM; \
	cd frontend && npx electron .

frontend: build
	cd frontend && npx electron .

backend: install-backend
	-fuser -k 8000/tcp
	cd backend && uv run python main.py

agent: install-agent
	-fuser -k 8001/tcp
	cd ai-agent && uv run uvicorn serve:app --host 127.0.0.1 --port 8001

clean:
	rm -rf frontend/dist frontend/node_modules \
	       backend/.venv backend/__pycache__ \
	       ai-agent/.venv ai-agent/__pycache__
