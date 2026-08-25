from p2.store import vector_store as store
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/file_details", tags=["file_details"])

@router.get("/file_chunks/{file_path:path}")
async def get_chunks_for_file(file_path: str):
    try:
        chunks = store.get_chunks_by_file(file_path)
        return {"file_path": file_path, "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

