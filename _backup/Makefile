.PHONY: up down install build app api index test demo-test clean docker-compose.host.yml

# uv caches in $HOME by default, and /home is nearly full here.
export UV_CACHE_DIR ?= $(if $(wildcard /goinfre/$(USER)),/goinfre/$(USER)/.cache/uv,$(HOME)/.cache/uv)
export UV_LINK_MODE := copy
unexport VIRTUAL_ENV

# The project the agent works on: make up TARGET_PROJECT=/path/to/project
export TARGET_PROJECT ?= $(CURDIR)/demo

# Host directories the API container can see: the top-level ones holding $HOME,
# its symlink targets and TARGET_PROJECT (on 42 machines: /goinfre /home).
SYSTEM_DIRECTORIES := / /bin /boot /dev /etc /lib /lib32 /lib64 /proc /run /sbin /sys /usr /var
HOST_PATHS := $(HOME) $(TARGET_PROJECT) $(shell find $(HOME) -maxdepth 1 -type l 2>/dev/null)
export HOST_ROOTS := $(sort $(filter-out $(SYSTEM_DIRECTORIES),$(foreach path,$(HOST_PATHS),/$(firstword $(subst /, ,$(realpath $(path)))))))

COMPOSE := docker compose -f docker-compose.yml -f docker-compose.host.yml

# Models, read from p2/llm_object.py: qwen2.5:3b and qwen2.5-coder:3b.
MODELS := $(shell grep -o 'model_name="[^"]*"' p2/llm_object.py | cut -d'"' -f2)

# API and Ollama in Docker, then the desktop app on the host.
up: docker-compose.host.yml build
	$(COMPOSE) up --build -d
	@for model in $(MODELS); do $(COMPOSE) exec -T ollama ollama pull $$model; done
	@echo "API on http://127.0.0.1:8000, project $(TARGET_PROJECT)"
	cd p2/dashboard && npx electron . "$(TARGET_PROJECT)"

down: docker-compose.host.yml
	$(COMPOSE) down

# Mounts HOST_ROOTS at their own paths; regenerated every run, gitignored.
docker-compose.host.yml:
	@printf 'services:\n  api:\n    volumes:\n' > $@
	@for root in $(HOST_ROOTS); do printf '      - %s:%s\n' "$$root" "$$root" >> $@; done

install:
	uv sync
	cd p2/dashboard && npm install --no-audit --no-fund

build:
	cd p2/dashboard && npm install --no-audit --no-fund && npm run build

# API on the host, started and stopped with the desktop window.
app: build
	./ioc $(TARGET_PROJECT)

api:
	uv run uvicorn --factory fix:create_app --host 127.0.0.1 --port 8000

index:
	uv run python -m fix index $(TARGET_PROJECT)

test:
	uv run python -m pytest tests -q

demo-test:
	uv run python -m pytest demo -q

clean:
	rm -rf p2/dashboard/dist p2/dashboard/node_modules .venv
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
