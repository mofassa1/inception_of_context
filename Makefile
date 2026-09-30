.PHONY: all logs install install-models install-python install-dashboard tests clean fclean

export UV_CACHE_DIR ?= $(if $(wildcard /goinfre/$(USER)),/goinfre/$(USER)/.cache/uv,$(HOME)/.cache/uv)
export UV_LINK_MODE := copy
unexport VIRTUAL_ENV

PYTHON := .venv/bin/python
FOLDER_PATH = $(abspath $(FOLDER))
DOCKER_PROJECT = com.docker.compose.project=inception_of_context

# ASK_MODEL and CODE_MODEL, written by make install-models. setup/run.py reads this file too.
MODELS_FILE := models.mk

# Without an NVIDIA GPU, torch comes from the CPU index and the CUDA packages are left out.
HAS_NVIDIA_GPU := $(shell nvidia-smi -L >/dev/null 2>&1 && echo yes)
ifeq ($(HAS_NVIDIA_GPU),yes)
INSTALL_PYTHON_PACKAGES = uv pip install --python $(PYTHON) -r requirements.txt
else
INSTALL_PYTHON_PACKAGES = grep -v -E '^(nvidia-|cuda-|triton)' requirements.txt \
	| uv pip install --python $(PYTHON) --torch-backend cpu -r -
endif

# The dashboard is built again only when one of its sources changed.
DASHBOARD_BUILD := dashboard/ui/dist/index.html
DASHBOARD_SOURCES := $(shell find dashboard/ui/src -type f) dashboard/ui/index.html \
	dashboard/ui/vite.config.ts dashboard/ui/tsconfig.json dashboard/ui/package.json dashboard/ui/.env

# make FOLDER=<folder>
#   starts the AI agent server (:8000), mhrima-server (:8001) and the dashboard,
#   all their lines in this terminal and in .logs/latest.log;
#   closing the dashboard or Ctrl+C stops everything. setup/run.py does the work.
all:
	@test -n "$(FOLDER)" || { echo "usage: make FOLDER=<folder>"; exit 1; }
	@$(MAKE) --no-print-directory $(DASHBOARD_BUILD)
	@$(PYTHON) setup/run.py "$(FOLDER_PATH)"

$(DASHBOARD_BUILD): $(DASHBOARD_SOURCES)
	cd dashboard/ui && npm run build

# make logs: the latest run, with colors
logs:
	@$(PYTHON) setup/run.py --logs

# make install: pick and pull the models first, then install the packages
install: install-models install-python install-dashboard

install-models:
	uv run setup/pick_models.py

install-python:
	test -x $(PYTHON) || uv venv --python 3.13 .venv
	$(INSTALL_PYTHON_PACKAGES)

install-dashboard:
	cd dashboard/ui && npm install --no-audit --no-fund

tests:
	@$(PYTHON) -m pytest tests -q; status=$$?; [ $$status -eq 0 ] || [ $$status -eq 5 ]

clean:
	rm -rf .venv .pytest_cache dashboard/ui/node_modules dashboard/ui/dist
	find . -name __pycache__ -type d -prune -exec rm -rf {} +

fclean: clean
	rm -rf chroma_db sessions.sqlite3 $(MODELS_FILE) .logs
	@docker ps -aq --filter label=$(DOCKER_PROJECT) 2>/dev/null | xargs -r docker rm -f
	@docker volume ls -q --filter label=$(DOCKER_PROJECT) 2>/dev/null | xargs -r docker volume rm
