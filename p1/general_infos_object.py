from pydantic import BaseModel

class GeneralInfos():

    def __init__(self, 
                 target_path: str = "", 
                 chroma_path: str = "",
                 collection_name: str = "codebase/test",
                 embedder_name: str = "all-MiniLM-L6-v2/test",
                 set_code_llm_name: str = "qwen2.5-coder:3b/test",
                 set_llm_name: str = "qwen2.5:3b/test",
                 ollama_backend: str = "default_backend",
                 target_project: str = "/hello_world"):
        self.target_path: str = target_path
        self.chroma_path: str = chroma_path
        self.collection_name: str = collection_name
        self.embedder_name: str = embedder_name
        self.code_llm_name: str = set_code_llm_name
        self.llm_name: str = set_llm_name
        self.ollama_backend: str = ollama_backend
        self.target_project: str = target_project

    def set_target_path(self, target_path: str):
        self.target_path = target_path
    
    def get_target_path(self) -> str:
        return self.target_path

    def set_chroma_path(self, chroma_path: str):
        self.chroma_path = chroma_path
    
    def get_chroma_path(self) -> str:
        return self.chroma_path

    def get_collection_name(self) -> str:
        return self.collection_name

    def set_collection_name(self, collection_name: str):
        self.collection_name = collection_name
    
    def get_embedder_name(self) -> str:
        return self.embedder_name
    
    def set_embedder_name(self, embedder_name: str):
        self.embedder_name = embedder_name

    def set_code_llm_name(self, set_code_llm_name: str):
        self.code_llm_name = set_code_llm_name
    
    def set_llm_name(self, set_llm_name: str):
        self.llm_name = set_llm_name

    def get_code_llm_name(self) -> str:
        return self.code_llm_name
    
    def get_llm_name(self) -> str:
        return self.llm_name

    def get_ollama_backend(self) -> str:
        return self.ollama_backend

    def set_ollama_backend(self, ollama_backend: str):
        self.ollama_backend = ollama_backend

    def get_target_project(self) -> str:
        return self.target_project

    def set_target_project(self, target_project: str):
        self.target_project = target_project

g_infos = GeneralInfos(
)