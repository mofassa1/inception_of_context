# syntax=docker/dockerfile:1
#
# The Architect API only. The dashboard is an Electron desktop app and runs on
# the host — a container has no display, and shipping it as a web page would
# make it a different product.

FROM python:3.13-slim AS api

# uv installs from the lockfile, so the image resolves the same versions the
# repository was tested with.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependencies first: this layer is cached until pyproject/uv.lock change, so
# torch is not re-downloaded on every source edit.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY fix ./fix
COPY p1 ./p1
COPY p2/routers ./p2/routers
COPY p2/schemas ./p2/schemas
COPY p2/*.py ./p2/
COPY p3 ./p3
COPY demo ./demo

# The embedding model is baked in so the container works with no network after
# build. fix/embedder.py downloads it where p1/embedder.py looks.
RUN uv run python -c "import fix; fix.prepare_embedding_cache()"

ENV IOC_DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "--factory", "fix:create_app", "--host", "0.0.0.0", "--port", "8000"]

