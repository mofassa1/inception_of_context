from fastapi import FastAPI
from .routers.chunker import router as chunks_router
from .routers.file_detaid import router as file_details_router
from .routers.rag import router as rag_router
app = FastAPI()

app.include_router(chunks_router)
app.include_router(file_details_router)
app.include_router(rag_router)
@app.get("/")
async def root():
    return {"message": "Hello World"}