import os
from p1.general_infos_object import g_infos

target_path = os.environ["TARGET_PATH"]

g_infos.set_target_path(target_path)

from fastapi import FastAPI

from .routers.chunker import router as chunks_router

from .routers.file_detaid import router as file_details_router

from .routers.rag import router as rag_router

from .routers.status import router as status_router
from .routers.patch_loop import router as patch_loop_router
app = FastAPI()




from .embidder_object import embedder





print(f"!!!!!!!!!!!!!!!!!!!!! TARGET_PATH: {target_path} !!!!!!!!!!!!!!!!!!!!")

g_infos.set_embedder_name(embedder.get_model_name())

app.include_router(file_details_router)

app.include_router(rag_router)

app.include_router(status_router)

app.include_router(patch_loop_router)

@app.get("/")
async def root():
    return {"message": "Hello World"}