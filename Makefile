.PHONY: install install-frontend install-backend install-agent \
        build app all frontend backend agent clean

install: install-frontend install-backend install-agent

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && uv sync

install-agent:
	cd ai-agent && uv venv && uv pip install -r requirements.txt

build: install-frontend
	cd frontend && npm run build

app all: install build
	-fuser -k 8000/tcp 8001/tcp
	@trap 'fuser -k 8000/tcp 8001/tcp 2>/dev/null' EXIT INT TERM; \
	( cd ai-agent && . .venv/bin/activate && uvicorn serve:app --host 127.0.0.1 --port 8001 ) & \
	( cd backend && uv run python main.py ) & \
	( cd frontend && npx electron . )

frontend: build
	cd frontend && npx electron .

backend: install-backend
	-fuser -k 8000/tcp
	cd backend && uv run python main.py

agent: install-agent
	-fuser -k 8001/tcp
	cd ai-agent && . .venv/bin/activate && uvicorn serve:app --host 127.0.0.1 --port 8001

clean:
	rm -rf frontend/dist frontend/node_modules \
	       backend/.venv backend/__pycache__ \
	       ai-agent/.venv ai-agent/__pycache__
