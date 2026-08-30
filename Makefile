.PHONY: install install-frontend install-backend app frontend backend build clean

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && uv sync

build:
	cd frontend && npm run build

app: install-frontend install-backend build
	-fuser -k 8000/tcp
	cd backend && uv run python main.py &
	cd frontend && npx electron .
	-fuser -k 8000/tcp

frontend: install-frontend build
	cd frontend && npx electron .

backend: install-backend
	-fuser -k 8000/tcp
	cd backend && uv run python main.py

clean:
	rm -rf frontend/dist frontend/node_modules backend/.venv backend/__pycache__
