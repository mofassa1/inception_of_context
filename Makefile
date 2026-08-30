.PHONY: install install-frontend install-backend frontend backend build clean

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && uv sync

build:
	cd frontend && npm run build

frontend: install-frontend build
	-fuser -k 8000/tcp
	cd frontend && npx electron .

backend: install-backend
	-fuser -k 8000/tcp
	cd backend && uv run uvicorn main:app --host 127.0.0.1 --port 8000

clean:
	rm -rf frontend/dist frontend/node_modules backend/.venv backend/__pycache__
