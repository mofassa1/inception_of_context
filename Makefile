.PHONY: install install-frontend install-backend install-agent app all frontend backend agent build clean

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && uv sync

install-agent:
	cd ai-agent && uv venv
	cd ai-agent && uv pip install -r requirements.txt

build:
	cd frontend && npm run build

app: install-frontend install-backend build
	-fuser -k 8000/tcp
	cd backend && uv run python main.py &
	cd frontend && npx electron .
	-fuser -k 8000/tcp

all: install-frontend install-backend install-agent build
	-fuser -k 8000/tcp
	-fuser -k 8001/tcp
	cd ai-agent && . .venv/bin/activate && uvicorn serve:app --host 127.0.0.1 --port 8001 &
	cd backend && uv run python main.py &
	cd frontend && npx electron .
	-fuser -k 8000/tcp
	-fuser -k 8001/tcp

frontend: install-frontend build
	cd frontend && npx electron .

backend: install-backend
	-fuser -k 8000/tcp
	cd backend && uv run python main.py

agent: install-agent
	-fuser -k 8001/tcp
	cd ai-agent && . .venv/bin/activate && uvicorn serve:app --host 127.0.0.1 --port 8001

clean:
	rm -rf frontend/dist frontend/node_modules backend/.venv backend/__pycache__
