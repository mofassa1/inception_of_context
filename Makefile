.PHONY: all logs install install-models install-python install-dashboard tests clean fclean

SHELL := /bin/bash

export UV_CACHE_DIR ?= $(if $(wildcard /goinfre/$(USER)),/goinfre/$(USER)/.cache/uv,$(HOME)/.cache/uv)
export UV_LINK_MODE := copy
unexport VIRTUAL_ENV

PYTHON := .venv/bin/python

export PYTHONPATH := $(CURDIR):$(CURDIR)/p1

FOLDER_PATH = $(abspath $(FOLDER))

AI_AGENT_PORT := 8000
MHRIMA_SERVER_PORT := 8001
AI_AGENT_URL := http://127.0.0.1:$(AI_AGENT_PORT)
MHRIMA_SERVER_URL := http://127.0.0.1:$(MHRIMA_SERVER_PORT)

DOCKER_PROJECT = com.docker.compose.project=inception_of_context

# ASK_MODEL and CODE_MODEL, written by make install-models.
MODELS_FILE := models.mk
-include $(MODELS_FILE)

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

# One log file per run, .logs/latest.log points to the newest one.
# When FOLDER contains this repository, the log of the run goes outside it: the AI agent's watcher
# indexes every file that changes, so it would index the log, write that it did, and never stop
# (CHECK.md item 11). .logs/latest.log still points at it.
LOGS_FOLDER := $(CURDIR)/.logs
OUTSIDE_LOGS_FOLDER := $(if $(wildcard /goinfre/$(USER)),/goinfre/$(USER)/.ioc-logs,$(HOME)/.cache/ioc-logs)
REPO_IN_FOLDER = $(if $(FOLDER),$(filter $(FOLDER_PATH)/%,$(CURDIR)/))
RUN_LOG := $(if $(REPO_IN_FOLDER),$(OUTSIDE_LOGS_FOLDER),$(LOGS_FOLDER))/$(shell date +%Y-%m-%d_%H-%M-%S).log

# Every line of the log file:   <source>: <time> <LEVEL> <message>
# The level comes from the "LEVEL:" the line starts with, a traceback, or words like Error and
# Warning. Paths are relative to the project folder, a progress bar keeps its last state, and
# empty lines, the Hugging Face / Electron security warnings and the VAAPI notice of Chromium
# are dropped.
LOG_LINE = awk -v source="$$log_source:" -v project="$(FOLDER_PATH)/" -v repository="$(CURDIR)/" ' \
	function drop(prefix) { while (prefix != "/" && (at = index($$0, prefix)) > 0) $$0 = substr($$0, 1, at - 1) substr($$0, at + length(prefix)) } \
	{ sub(/.*\r/, ""); drop(project); drop(repository) } \
	$$0 == "" || /unauthenticated requests to the HF Hub|Electron Security Warning|Installed VAAPI version/ { next } \
	{ level = "INFO" } \
	/^(DEBUG|INFO|WARNING|ERROR|CRITICAL):/ { level = substr($$0, 1, index($$0, ":") - 1); $$0 = substr($$0, index($$0, ":") + 1); sub(/^ +/, "") } \
	in_traceback { level = "ERROR"; if ($$0 !~ /^[ \t]/) in_traceback = 0 } \
	/^Traceback/ { level = "ERROR"; in_traceback = 1 } \
	level == "INFO" && /Error|Exception|" 5[0-9][0-9] / { level = "ERROR" } \
	level == "INFO" && /[Ww]arning|" 4[0-9][0-9] / { level = "WARNING" } \
	{ printf "%-10s %s %-7s %s\n", source, strftime("%H:%M:%S"), level, $$0; fflush() }'

# The same lines in the terminal, with one color per source and per level.
TERMINAL_LOG_LINE = awk ' \
	BEGIN { \
		level_color["DEBUG"] = "90"; level_color["INFO"] = "32"; level_color["WARNING"] = "33"; \
		level_color["ERROR"] = "31"; level_color["CRITICAL"] = "31"; \
		source_color["make:"] = "35"; source_color["ai-agent:"] = "36"; source_color["indexer:"] = "34"; \
		source_color["server:"] = "96"; source_color["ui:"] = "94" \
	} \
	{ \
		source = $$1; time = $$2; level = $$3; message = substr($$0, 29); \
		if (level == "ERROR" || level == "CRITICAL") message = "\033[31m" message "\033[0m"; \
		printf "\033[%sm%-10s\033[0m \033[2m%s\033[0m \033[%sm%-7s\033[0m %s\n", \
			source_color[source], source, time, level_color[level], level, message; \
		fflush() \
	}'

# Shell functions for make FOLDER=<folder>:
#   log_line <LEVEL> <text>          writes a line of make itself
#   start_logged <source> <command>  starts the command in the background, its lines go to the log
#                                    file, and $$! is the PID of the command
#   show_logs                        shows the log file in this terminal, $$! is the PID to stop it
#   wait_for <name> <PID> <check>    waits until the check passes, or fails when the PID is gone
# The log readers ignore Ctrl+C, so the last lines of every part are still written and shown.
RUN_FUNCTIONS = \
	mkdir -p "$(LOGS_FOLDER)" "$(dir $(RUN_LOG))"; \
	: >> "$(RUN_LOG)"; \
	ln -sfn "$(RUN_LOG)" "$(LOGS_FOLDER)/latest.log"; \
	log_line() { \
		local level=$$1; shift; \
		printf '%-10s %s %-7s %s\n' "make:" "$$(date +%H:%M:%S)" "$$level" "$$*" >> "$(RUN_LOG)"; \
	}; \
	start_logged() { \
		local log_source=$$1; shift; \
		"$$@" > >(trap '' INT; $(LOG_LINE) >> "$(RUN_LOG)") 2>&1 & \
	}; \
	show_logs() { \
		(trap '' INT; exec tail -n +1 -F "$(RUN_LOG)" 2>/dev/null) > >(trap '' INT; $(TERMINAL_LOG_LINE)) & \
	}; \
	answers() { $(PYTHON) -c "import sys, urllib.request; urllib.request.urlopen(sys.argv[1])" "$$1" 2>/dev/null; }; \
	wait_for() { \
		local name=$$1 pid=$$2; shift 2; \
		log_line INFO "waiting for $$name ..."; \
		until "$$@"; do \
			kill -0 $$pid 2>/dev/null || { log_line ERROR "$$name stopped before it was ready"; return 1; }; \
			sleep 1; \
		done; \
		log_line INFO "$$name is ready"; \
	}

# make FOLDER=<folder>
#   starts the AI agent server (:8000), its indexer, mhrima-server (:8001) and the dashboard,
#   all their lines in this terminal and in .logs/latest.log;
#   closing the dashboard or Ctrl+C stops everything
all:
	@test -n "$(FOLDER)" || { echo "usage: make FOLDER=<folder>"; exit 1; }
	@test -d "$(FOLDER_PATH)" || { echo "not a folder: $(FOLDER_PATH)"; exit 1; }
	@test "$(FOLDER_PATH)" != "/" || { echo "FOLDER=/ would index the whole disk"; exit 1; }
	@test -n "$(ASK_MODEL)" && test -n "$(CODE_MODEL)" || { echo "no models picked yet, run: make install"; exit 1; }
	@for model in $(ASK_MODEL) $(CODE_MODEL); do \
		ollama show $$model >/dev/null 2>&1 || { echo "$$model is not pulled or Ollama is not running, run: make install-models"; exit 1; }; \
	done
	@for port in $(AI_AGENT_PORT) $(MHRIMA_SERVER_PORT); do \
		ss -lntH "sport = :$$port" | grep -q . || continue; \
		used_by=$$(ss -lntpH "sport = :$$port" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2); \
		echo "port $$port is already in use$${used_by:+ by PID $$used_by: $$(ps -o args= -p $$used_by | cut -c1-60)}"; \
		echo "stop the other run first: close its dashboard, or press Ctrl+C in its terminal"; exit 1; \
	done
	@$(MAKE) --no-print-directory $(DASHBOARD_BUILD)
	@mkdir -p chroma_db
	@$(RUN_FUNCTIONS); \
	show_logs; log_output=$$!; \
	stop_everything() { \
		[ -n "$$stopping" ] && return; stopping=yes; \
		kill $$ai_agent $$indexer $$mhrima $$dashboard 2>/dev/null; sleep 2; kill $$log_output 2>/dev/null; \
	}; \
	trap stop_everything EXIT; \
	trap 'log_line INFO "stop asked, stopping everything"; exit 130' INT TERM HUP; \
	log_line INFO "folder $(FOLDER_PATH)"; \
	log_line INFO "log file $(RUN_LOG)"; \
	test -z "$(REPO_IN_FOLDER)" || log_line WARNING "FOLDER contains this repository: the log is kept outside it (CHECK.md 11), and big files make answers slow (CHECK.md 13)"; \
	log_line INFO "models: $(ASK_MODEL) for Ask, $(CODE_MODEL) for the patch loop"; \
	log_line INFO "free RAM: $$(free -m | awk '/^Mem:/ { print $$7 " MiB of " $$2 " MiB" }')"; \
	log_line INFO "code: commit $$(git rev-parse --short HEAD 2>/dev/null)$$(git status --porcelain 2>/dev/null | grep -q . && echo ', with uncommitted changes')"; \
	start_logged ai-agent env TARGET_PATH="$(FOLDER_PATH)" ASK_MODEL="$(ASK_MODEL)" CODE_MODEL="$(CODE_MODEL)" \
		PYTHONUNBUFFERED=1 $(PYTHON) -m uvicorn p2.api:app --host 127.0.0.1 --port $(AI_AGENT_PORT); ai_agent=$$!; \
	wait_for "the AI agent server" $$ai_agent answers "$(AI_AGENT_URL)/status" || exit 1; \
	start_logged server env PYTHONUNBUFFERED=1 $(PYTHON) dashboard/server.py; mhrima=$$!; \
	wait_for "mhrima-server" $$mhrima answers "$(MHRIMA_SERVER_URL)/docs" || exit 1; \
	start_logged ui env -C dashboard/ui -u ELECTRON_RUN_AS_NODE npx electron . "$(FOLDER_PATH)"; dashboard=$$!; \
	log_line INFO "everything is running, close the dashboard or press Ctrl+C to stop"; \
	wait -n -p stopped_pid $$ai_agent $$mhrima $$dashboard; exit_code=$$?; \
	case $$stopped_pid in \
		$$dashboard) stopped="the dashboard";; \
		$$ai_agent) stopped="the AI agent server";; \
		*) stopped="mhrima-server";; \
	esac; \
	stop_level=INFO; [ $$exit_code -eq 0 ] || stop_level=ERROR; \
	log_line $$stop_level "$$stopped stopped (exit code $$exit_code), stopping everything"

$(DASHBOARD_BUILD): $(DASHBOARD_SOURCES)
	cd dashboard/ui && npm run build

# make logs: the latest run, with colors
logs:
	@test -e "$(LOGS_FOLDER)/latest.log" || { echo "no logs yet, start the project with: make FOLDER=<folder>"; exit 1; }
	@$(TERMINAL_LOG_LINE) "$(LOGS_FOLDER)/latest.log"

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
