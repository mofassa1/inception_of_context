"""Fixed versions of the p2/routers routes, served at the same paths."""

from fastapi import APIRouter

from fix.routers import file_detaid, rag, status

router = APIRouter()
for module in (file_detaid, rag, status):
    router.include_router(module.router)
