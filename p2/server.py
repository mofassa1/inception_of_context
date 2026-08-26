from fastapi import FastAPI
from .routers.chunker import router as chunks_router
from .routers.file_detaid import router as file_details_router
from .routers.rag import router as rag_router
from .routers.status import router as status_router
app = FastAPI()

# app.include_router(chunks_router)
app.include_router(file_details_router)
app.include_router(rag_router)
app.include_router(status_router)
@app.get("/")
async def root():
    return {"message": "Hello World"}

        # try:
        #     resp = api.get("/status")
        #     resp.raise_for_status()
        #     data = resp.json()
        # except httpx.HTTPError as ex:
        #     print(f"[Overview] Failed to reach backend: {ex}")
        #     return
        
        # # Expected shape:
        # # data = {
        # # "chunks_indexed": 35,
        # # "target_project": "/workspace",
        # # "chroma_path": "/workspace/.chroma",
        # # "ask_model": "qwen2.5:3b",
        # # "code_model": "qwen2.5-coder:3b",
        # # "ollama_backend": "http://ollama:11434",
        # # "files": [{"name": "README.md", "chunks": 1}, ...],
        # # }