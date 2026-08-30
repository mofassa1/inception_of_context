from p2.server import app
from agent_index import router as index_router

app.include_router(index_router)
