from pydantic import BaseModel
from p2.store import vector_store as store
from fastapi import APIRouter, HTTPException, Path

router = APIRouter(tags=["files"])



def get_chunks_by_file(self, file_path: str) -> dict[str, list]: 
    results = self.collection.get( where={"file": file_path}, 
                                  include=["metadatas", "documents"]) 
    return results 

@router.get("/files/{file_path:path}")
async def get_chunks_for_file(file_path: str):
    try:
        chunks = store.get_chunks_by_file(file_path)
        print(f"[File Details] Retrieved {len(chunks['metadatas'])} chunks for file: {file_path}")
        return {"file_path": file_path, "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files")
async def get_all_files():
    try:
        files_with_chunks = store.get_files_with_chunks_count()
        files = [{"name": file_path, "chunks": count} for file_path, count in files_with_chunks.items()]
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# resp = api.patch(f"/chunks/{chunk_id}", json={"content": new_content})

class UpdateChunkRequest(BaseModel):
    content: str
    chunk_id: str

from pathlib import Path


@router.patch("/chunks_modify")
async def update_chunk_content(request: UpdateChunkRequest):

    chunk_id = request.chunk_id


    chunk = store.get_chunks_by_ids([chunk_id])

    old_content = chunk["documents"][0]
    file_path = chunk["metadatas"][0]["file"]

    print(f"[Update Chunk] Old content for {chunk_id}: {old_content}")


    file_chunks = store.get_chunks_by_file(file_path)

    chunks = list(zip(
        file_chunks["documents"],
        file_chunks["metadatas"],
    ))

    chunks.sort(
        key=lambda chunk: chunk[1].get("start_line", 0)
    )

    file_content = "\n".join(
        document
        for document, metadata in chunks
    )

    Path(file_path).write_text(
        file_content,
        encoding="utf-8",
    )

    print(f"[Update Chunk] Updated content for {chunk_id}: {request.content}")
    print(f"[Update File] File written: {file_path}")

    return {
        "message": f"Chunk {chunk_id} and file updated successfully."
    }