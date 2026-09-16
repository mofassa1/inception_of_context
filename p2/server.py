from fastapi import FastAPI
from .routers.chunker import router as chunks_router
from .routers.file_detaid import router as file_details_router
from .routers.rag import router as rag_router
from .routers.status import router as status_router
app = FastAPI()
from p1.general_infos_object import g_infos
import os
target_path = os.environ["TARGET_PATH"]
# g_infos.set_target_path(target_path)
# print(f"!!!!!!!!!!!!!!!!!!!!! TARGET_PATH: {target_path} !!!!!!!!!!!!!!!!!!!!")

app.include_router(file_details_router)
app.include_router(rag_router)
app.include_router(status_router)
@app.get("/")
async def root():
    return {"message": "Hello World"}
