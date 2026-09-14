# from p1.db import VectorStore
from fastapi import APIRouter, HTTPException
from p2.store import vector_store as store

router = APIRouter(prefix="/chunks", tags=["chunks"])

@router.get("/sum_chunks_count")
async def get_sum_chunks_count():
    try:
        count = store.get_all_chunks_count()
        return {"total_chunks": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/each_file_chunks")
async def get_each_file_chunks():
    try:
        file_chunk_counts = store.get_files_with_chunks_count()
        return {"file_chunk_counts": file_chunk_counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


