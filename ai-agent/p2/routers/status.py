        # try:
        #     resp = api.get("/status")
        #     resp.raise_for_status()
        #     data = resp.json()
        # except httpx.HTTPError as ex:
        #     print(f"[Overview] Failed to reach backend: {ex}")
        #     return
        
        # Expected shape:
        # data = {
        # "chunks_indexed": 35,                                 done
        # "target_project": "/workspace",
        # "chroma_path": "/workspace/.chroma",                  done
        # "ask_model": "qwen2.5:3b",                            done
        # "code_model": "qwen2.5-coder:3b",                     done
        # "ollama_backend": "http://ollama:11434",          
        # "files": [{"name": "README.md", "chunks": 1}, ...],   done
        # }

from fastapi import APIRouter, HTTPException
from p2.store import vector_store as store
from p2.llm_object import llm_manager

router = APIRouter(prefix="/status", tags=["status"])

@router.get("/")
def get_status():
    try:
        chunks_indexed = store.get_all_chunks_count()
        files_with_chunks = store.get_files_with_chunks_count()
        files = [{"name": file_path, "chunks": count} for file_path, count in files_with_chunks.items()]
        ask_model_name = llm_manager.get_model_name()
        code_model_name = llm_manager.get_code_model_name()
        chroma_path = store.get_chroma_path()  # Assuming you have a method to get the Chroma path
        status_data = {
            "chunks_indexed": chunks_indexed,
            "target_project": "/just_testing",  # You can modify this if needed
            "chroma_path": chroma_path,
            "ask_model": ask_model_name,
            "code_model": code_model_name,
            "ollama_backend": "http://ollama:11434/justTesting",  # You can modify this if needed
            "files": files,
            
            # Add other status information as needed
        }
        return status_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    