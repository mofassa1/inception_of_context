
from fastapi import APIRouter, HTTPException
from p2.store import vector_store as store
from p2.llm_object import llm_manager
from p1.general_infos_object import g_infos

router = APIRouter(prefix="/status", tags=["status"])

@router.get("/")
def get_status():
    try:
        chunks_indexed = store.get_all_chunks_count()
        files_with_chunks = store.get_files_with_chunks_count()
        files = [{"name": file_path, "chunks": count} for file_path, count in files_with_chunks.items()]
        ask_model_name = llm_manager.get_model_name()
        code_model_name = llm_manager.get_code_model_name()
        chroma_path = store.get_chroma_path()
        embedder_name  = g_infos.get_embedder_name()
        target_project = g_infos.get_target_path()
        ollama_backend = g_infos.get_ollama_backend()
        status_data = {
            "chunks_indexed": chunks_indexed ,
            "target_project": target_project ,
            "chroma_path": chroma_path ,
            "ask_model": ask_model_name ,
            "code_model": code_model_name ,
            "ollama_backend": ollama_backend ,
            "embed_model": embedder_name ,
            "watching": True,
            "files": files,
        }
        return status_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    
