"""Wraps the p2/server.py app."""

import os
import threading
from pathlib import Path

from p1.core.logging import get_logger

logger = get_logger(__name__)


def index_target_in_background(target: str) -> None:
    from p1.ignore import IgnoreRules
    from p2.deps import get_indexing_service

    def run() -> None:
        try:
            get_indexing_service().index_workspace(target, IgnoreRules.build())
        except Exception:
            logger.exception("indexing %s at startup failed", target)

    threading.Thread(target=run, name="startup-index", daemon=True).start()


def create_app():
    from contextlib import asynccontextmanager

    from fastapi.middleware.cors import CORSMiddleware

    from fix.embedder import prepare_embedding_cache
    from p1.core.config import Settings
    from p1.core.errors import register_error_handlers
    from p1.core.logging import configure_logging

    prepare_embedding_cache()

    from fix.routers import router as fixed_router
    from p2 import deps
    from p2.routers import (
        chat,
        conversations,
        events,
        files,
        filesystem,
        indexing,
        overview,
    )
    from p2.server import app
    from p3.router import router as patch_router

    settings = Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_):
        deps.warm_up()

        target = os.getenv("TARGET_PROJECT", "")
        if target and Path(target).is_dir():
            index_target_in_background(target)

        logger.info("architect api ready")
        yield

        deps.get_watcher().stop()

    app.router.lifespan_context = lifespan

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    app.include_router(fixed_router)
    app.router.routes.insert(0, app.router.routes.pop())

    for router in (
        overview.router,
        files.router,
        events.router,
        indexing.router,
        chat.router,
        patch_router,
        conversations.router,
        filesystem.router,
    ):
        app.include_router(router)

    return app
