# The ChromaDB collection of one target folder.
# One client per process, as the subject asks: the API and the watcher share this object.

import hashlib
import pathlib
import threading

import chromadb

SIMILARITY_SPACE = "cosine"


def collection_name_for(target_path):
    resolved_path = str(pathlib.Path(target_path).resolve())
    return "codebase_" + hashlib.sha256(resolved_path.encode("utf-8")).hexdigest()[:16]


def chunk_metadata(chunk):
    return {
        "file": chunk.file,
        "kind": chunk.kind,
        "qualified_name": chunk.qualified_name,
        "start_line": chunk.start_line,
        "end_line": chunk.end_line,
        "content_hash": chunk.content_hash,
    }


class Store:
    def __init__(self, chroma_path, target_path):
        self.chroma_path = str(pathlib.Path(chroma_path).resolve())
        self.collection_name = collection_name_for(target_path)
        self.lock = threading.Lock()
        self.client = chromadb.PersistentClient(path=self.chroma_path)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": SIMILARITY_SPACE},
        )

    def add_chunks(self, chunks, embeddings):
        with self.lock:
            self.collection.upsert(
                ids=[chunk.id for chunk in chunks],
                documents=[chunk.content for chunk in chunks],
                embeddings=embeddings,
                metadatas=[chunk_metadata(chunk) for chunk in chunks],
            )

    def delete_file(self, path):
        with self.lock:
            self.collection.delete(where={"file": path})

    def delete_chunks(self, chunk_ids):
        with self.lock:
            self.collection.delete(ids=chunk_ids)

    def count(self):
        with self.lock:
            return self.collection.count()

    def files_with_counts(self):
        with self.lock:
            found = self.collection.get(include=["metadatas"])
        counts = {}
        for metadata in found["metadatas"]:
            counts[metadata["file"]] = counts.get(metadata["file"], 0) + 1
        return counts

    def chunks_of_file(self, path):
        with self.lock:
            found = self.collection.get(where={"file": path}, include=["documents", "metadatas"])
        return self.as_chunks(found)

    def page(self, offset, limit):
        with self.lock:
            found = self.collection.get(
                include=["documents", "metadatas"], limit=limit, offset=offset
            )
        return self.as_chunks(found)

    def search(self, embedding, count):
        with self.lock:
            found = self.collection.query(
                query_embeddings=[embedding],
                n_results=count,
                include=["documents", "metadatas", "distances"],
            )
        if not found["ids"] or not found["ids"][0]:
            return []

        results = []
        for position, chunk_id in enumerate(found["ids"][0]):
            metadata = found["metadatas"][0][position]
            distance = found["distances"][0][position]
            results.append(
                {
                    "id": chunk_id,
                    "content": found["documents"][0][position],
                    "metadata": metadata,
                    "score": round(1 - distance, 4),
                }
            )
        return results

    def as_chunks(self, found):
        chunks = []
        for position, chunk_id in enumerate(found["ids"]):
            chunks.append(
                {
                    "id": chunk_id,
                    "content": found["documents"][position],
                    "metadata": found["metadatas"][position],
                }
            )
        return chunks
