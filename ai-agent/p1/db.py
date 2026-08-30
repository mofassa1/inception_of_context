
import chromadb
import os
import sys
import pathlib
from p1.general_infos_object import g_infos

os.environ["TOKENIZERS_PARALLELISM"] = "false" 
os.environ["HF_HUB_OFFLINE"] = "1"  

class VectorStore:
    def __init__(self, chroma_path: str, collection_name: str):
        absolute_path = pathlib.Path(chroma_path).resolve()
        self.chroma_path = str(absolute_path)
        self.collection_name = collection_name

        print(f"Chroma path: {absolute_path}")
        print(f"Collection: {collection_name}")

        self.client = chromadb.PersistentClient(
            path=absolute_path
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name
        )

        g_infos.set_chroma_path(self.chroma_path)
        g_infos.set_collection_name(self.collection_name)
        
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

    def get_chunks_by_ids(self, ids: list[str]) -> dict[str, list]:
        results = self.collection.get(
            ids=ids,
            include=["metadatas", "documents"],
        )

        return results

    def get_all_chunks_count(self) -> int:
        results = self.collection.count()

        return results

    def get_file_chunks(self, file_path: str) -> dict[str, list]:
       
        results = self.collection.get(
            where={"file": file_path},
            include=["metadatas"],
        )

        return results
    
    def get_files_with_chunks_count(self) -> dict[str, int]:
        results = self.collection.get(
            include=["metadatas"],
        )

        file_chunk_counts = {}
        for metadata in results["metadatas"]:
            file_path = metadata.get("file")
            if file_path:
                file_chunk_counts[file_path] = file_chunk_counts.get(file_path, 0) + 1

        return file_chunk_counts
    
    def get_all_files(self) -> list[str]:
        results = self.collection.get(
            include=["metadatas"],
        )

        files = set()
        for metadata in results["metadatas"]:
            file_path = metadata.get("file")
            if file_path:
                files.add(file_path)

        return list(files)
    
    def get_chunks_by_file(self, file_path: str) -> dict[str, list]:
        results = self.collection.get(
            where={"file": file_path},
            include=["metadatas", "documents"],
        )

        return results
    
    def update_chunk_content(self, chunk_id: str, new_content: str):
        # Retrieve the existing chunk data
        existing_chunk = self.collection.get(
            ids=[chunk_id],
            include=["metadatas", "documents"]
        )

        if not existing_chunk["documents"]:
            raise ValueError(f"Chunk with ID {chunk_id} not found.")

        # Update the content of the chunk
        self.collection.update(
            ids=[chunk_id],
            documents=[new_content]
        )

    def cosine_similarity_search(self, query_embedding: list[float], n_results: int = 5)-> list[str]:
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=n_results,
            include=["documents"],
        )

        return results["documents"][0] if results["documents"] else []
    
    def cosine_similarity_search_with_scores(
        self, query_embedding: list[float], n_results: int = 5
    ) -> list[dict]:
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=n_results,
            include=["metadatas", "distances"],
        )

        if not results["metadatas"] or not results["distances"]:
            return []

        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        sources = []
        for meta, dist in zip(metadatas, distances):
            sources.append({
                "file": meta.get("file", ""),
                "line": meta.get("start_line", 0),
                "score": round(dist, 2),
            })

        return sources[:n_results]
        
    def get_chroma_path(self) -> str:
        """Return the path to the Chroma database."""
        return self.chroma_path