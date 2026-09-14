.PHONY: all dashboard install tests clean fclean

export UV_CACHE_DIR ?= $(if $(wildcard /goinfre/$(USER)),/goinfre/$(USER)/.cache/uv,$(HOME)/.cache/uv)
export UV_LINK_MODE := copy
unexport VIRTUAL_ENV

PYTHON := .venv/bin/python

export PYTHONPATH := $(CURDIR):$(CURDIR)/p1

FOLDER_PATH = $(abspath $(FOLDER))

AI_AGENT_URL := http://127.0.0.1:8000
MHRIMA_SERVER_URL := http://127.0.0.1:8001

DOCKER_PROJECT = com.docker.compose.project=inception_of_context

MODELS := $(shell grep -o 'model_name="[^"]*"' p2/llm_object.py | cut -d'"' -f2)

# Runs in the second terminal. When it fails, the terminal stays open so the error can be read.
DASHBOARD_COMMAND = cd "$(CURDIR)" && make --no-print-directory dashboard FOLDER="$(FOLDER_PATH)" \
	|| { echo; echo "press Enter to close this terminal"; read line; }

# Opens the second terminal with the first terminal program found.
OPEN_DASHBOARD_TERMINAL = \
	if command -v gnome-terminal >/dev/null; then \
		gnome-terminal --title="dashboard" -- bash -c '$(DASHBOARD_COMMAND)'; \
	elif command -v x-terminal-emulator >/dev/null; then \
		x-terminal-emulator -e bash -c '$(DASHBOARD_COMMAND)' & \
	elif command -v xterm >/dev/null; then \
		xterm -T dashboard -e bash -c '$(DASHBOARD_COMMAND)' & \
	else \
		echo "no terminal program found, run this in another terminal: make dashboard FOLDER=$(FOLDER_PATH)"; \
	fi

# make FOLDER=<folder>
#   this terminal:      the AI agent (server on :8000 + indexer), stop it with Ctrl+C
#   a second terminal:  mhrima-server on :8001 + the Electron dashboard
all:
	@test -n "$(FOLDER)" || { echo "usage: make FOLDER=<folder>"; exit 1; }
	@test -d "$(FOLDER_PATH)" || { echo "not a folder: $(FOLDER_PATH)"; exit 1; }
	cd p2/dashboard && npm run build
	@for model in $(MODELS); do \
		ollama show $$model >/dev/null 2>&1 || ollama pull $$model || { echo "could not pull $$model, is Ollama running?"; exit 1; }; \
	done
	@mkdir -p chroma_db
	@$(PYTHON) -m uvicorn p2.server:app --host 127.0.0.1 --port 8000 & ai_agent=$$!; \
	indexer_log=$$(mktemp); \
	trap 'kill $$ai_agent $$indexer $$indexer_output 2>/dev/null; rm -f "$$indexer_log"' EXIT INT TERM; \
	echo "waiting for the AI agent server on $(AI_AGENT_URL) ..."; \
	until $(PYTHON) -c "import urllib.request; urllib.request.urlopen('$(AI_AGENT_URL)/')" 2>/dev/null; do \
		kill -0 $$ai_agent 2>/dev/null || { echo "the AI agent server stopped before it started listening"; exit 1; }; \
		sleep 1; \
	done; \
	echo "the AI agent server is up"; \
	(cd p1 && PYTHONUNBUFFERED=1 exec $(CURDIR)/$(PYTHON) index.py "$(FOLDER_PATH)") > "$$indexer_log" 2>&1 & indexer=$$!; \
	tail -n +1 -f "$$indexer_log" & indexer_output=$$!; \
	echo "waiting for the AI agent indexer to load its model ..."; \
	until grep -q "^Collection:" "$$indexer_log"; do \
		kill -0 $$indexer 2>/dev/null || { echo "the AI agent indexer stopped before it was ready"; exit 1; }; \
		sleep 1; \
	done; \
	echo "the AI agent indexer is ready, opening the dashboard in a new terminal"; \
	$(OPEN_DASHBOARD_TERMINAL); \
	echo "the AI agent is running, press Ctrl+C to stop it"; \
	wait $$ai_agent

# make dashboard FOLDER=<folder>   (opened by make FOLDER=<folder>, needs the AI agent running)
dashboard:
	@test -n "$(FOLDER)" || { echo "usage: make dashboard FOLDER=<folder>"; exit 1; }
	@test -d "$(FOLDER_PATH)" || { echo "not a folder: $(FOLDER_PATH)"; exit 1; }
	@$(PYTHON) -c "import urllib.request; urllib.request.urlopen('$(AI_AGENT_URL)/')" 2>/dev/null \
		|| { echo "the AI agent server is not running on $(AI_AGENT_URL), start it with: make FOLDER=$(FOLDER)"; exit 1; }
	@$(PYTHON) mhrima-server.py & mhrima=$$!; \
	trap 'kill $$mhrima 2>/dev/null' EXIT INT TERM; \
	echo "waiting for mhrima-server on $(MHRIMA_SERVER_URL) ..."; \
	until $(PYTHON) -c "import urllib.request; urllib.request.urlopen('$(MHRIMA_SERVER_URL)/docs')" 2>/dev/null; do \
		kill -0 $$mhrima 2>/dev/null || { echo "mhrima-server stopped before it started listening"; exit 1; }; \
		sleep 1; \
	done; \
	echo "mhrima-server is up, starting the dashboard"; \
	cd p2/dashboard && env -u ELECTRON_RUN_AS_NODE npx electron . "$(FOLDER_PATH)"

install:
	test -x $(PYTHON) || uv venv --python 3.13 .venv
	uv pip install --python $(PYTHON) -r requirements.txt
	cd p2/dashboard && npm install --no-audit --no-fund

tests:
	@$(PYTHON) -m pytest tests -q; status=$$?; [ $$status -eq 0 ] || [ $$status -eq 5 ]

clean:
	rm -rf .venv .pytest_cache p2/dashboard/node_modules p2/dashboard/dist
	find . -path ./_backup -prune -o -name __pycache__ -type d -prune -exec rm -rf {} +

fclean: clean
	rm -rf chroma_db sessions.sqlite3
	@docker ps -aq --filter label=$(DOCKER_PROJECT) 2>/dev/null | xargs -r docker rm -f
	@docker volume ls -q --filter label=$(DOCKER_PROJECT) 2>/dev/null | xargs -r docker volume rm
