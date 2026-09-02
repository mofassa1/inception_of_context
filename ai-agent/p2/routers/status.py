import os
from fastapi import APIRouter, HTTPException
from p2.store import vector_store as store
from p2.llm_object import llm_manager
from p1.general_infos_object import g_infos
router = APIRouter(prefix="/status", tags=["status"])

@router.get("/")
def get_status():
    print("=" * 20)
    print("/status called, returning status data:")
    print("=" * 20)
    try:
        chunks_indexed = store.get_all_chunks_count()
        files_with_chunks = store.get_files_with_chunks_count()
        files = [{"name": file_path, "chunks": count} for file_path, count in files_with_chunks.items()]
        ask_model_name = llm_manager.get_model_name()
        code_model_name = llm_manager.get_code_model_name()
        chroma_path = store.get_chroma_path() 
        status_data = {
            "status": {
                "chunksIndexed": chunks_indexed,
                "targetProject": g_infos.get_target_path(),
                "chromaPath": chroma_path,
                "askModel": ask_model_name,
                "codeModel": code_model_name,
                "ollamaBackend": os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
            },
            "files": files,
            "activity": []
        }
        
        #     "chunksIndexed": chunks_indexed,
        #     "targetProject": g_infos.get_target_path(),  
        #     "chromaPath": chroma_path,
        #     "askModel": ask_model_name,
        #     "codeModel": code_model_name,
        #     "ollamaBackend": os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"),
        #     "files": files,
        # }

        return status_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    

# {
#         "status": {
#             "chunksIndexed": store.get_all_chunks_count(),
#             "targetProject": root,
#             "chromaPath": str(chroma_path),
#             "askModel": ask_model,
#             "codeModel": code_model,
#             "ollamaBackend": ollama_backend,
#         },
#         "files": get_files(root),
#         "activity": [],
#     }