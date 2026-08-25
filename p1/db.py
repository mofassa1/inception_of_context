
import chromadb
import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"  # avoid warning spam from HuggingFace tokenizers
os.environ["HF_HUB_OFFLINE"] = "1"  # lock offline mode for the rest of the process's lifetime

class VectorStore:
    def __init__(self, chroma_path: str, collection_name: str):
        self.client = chromadb.PersistentClient(
            path=chroma_path
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name
        )


    def add(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict]
    ):
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )



    def get_file_chunks(self, file_path: str) -> dict[str, list]:
       
        results = self.collection.get(
            where={"file": file_path},
            include=["metadatas"],
        )

        return results
