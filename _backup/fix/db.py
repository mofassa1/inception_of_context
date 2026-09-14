"""Wraps p1/db.py and the p2/store.py instance."""

import threading


class ChunkStore:
    def __init__(self, vector_store, runtime):
        self.vector_store = vector_store
        self.collection = vector_store.collection
        self.runtime = runtime

        self._counts_lock = threading.Lock()
        self._file_chunk_counts: dict[str, int] | None = None

        space = (self.collection.metadata or {}).get("hnsw:space", "l2")
        self._distance_scale = 0.5 if space == "l2" else 1.0

        runtime.chroma_path = vector_store.get_chroma_path()
        runtime.collection_name = vector_store.collection_name

    def upsert(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        if not ids:
            return

        self.collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        self.invalidate_counts()

    def update_metadatas(self, ids: list[str], metadatas: list[dict]) -> None:
        if not ids:
            return
        self.collection.update(ids=ids, metadatas=metadatas)

    def delete_ids(self, ids: list[str]) -> None:
        if not ids:
            return
        self.collection.delete(ids=list(ids))
        self.invalidate_counts()

    def count_chunks(self) -> int:
        return self.vector_store.get_all_chunks_count()

    def get_file_chunks(self, file_path: str) -> dict[str, list]:
        return self.vector_store.get_file_chunks(file_path)

    def get_file_chunks_with_content(self, file_path: str) -> dict[str, list]:
        return self.vector_store.get_chunks_by_file(file_path)

    def page_chunks(self, offset: int, limit: int) -> dict[str, list]:
        return self.collection.get(
            include=["metadatas", "documents"],
            offset=offset,
            limit=limit,
        )

    def invalidate_counts(self) -> None:
        with self._counts_lock:
            self._file_chunk_counts = None

    def file_chunk_counts(self) -> dict[str, int]:
        with self._counts_lock:
            if self._file_chunk_counts is not None:
                return dict(self._file_chunk_counts)

        counts = self.vector_store.get_files_with_chunks_count()

        with self._counts_lock:
            self._file_chunk_counts = counts

        return dict(counts)

    def set_file_chunk_count(self, file_path: str, count: int) -> None:
        with self._counts_lock:
            if self._file_chunk_counts is None:
                return
            if count <= 0:
                self._file_chunk_counts.pop(file_path, None)
            else:
                self._file_chunk_counts[file_path] = count

    def indexed_files(self) -> list[str]:
        return list(self.file_chunk_counts().keys())

    def cosine_distance(self, raw_distance: float) -> float:
        return raw_distance * self._distance_scale

    def files_within(self, root: str) -> list[str]:
        prefix = root.rstrip("/") + "/"
        return [path for path in self.file_chunk_counts() if path == root or path.startswith(prefix)]

    def search_chunks(self, query_embedding: list[float], n_results: int = 5) -> list[dict]:
        if n_results <= 0 or self.count_chunks() == 0:
            return []

        where = None
        if self.runtime.target_project:
            files = self.files_within(self.runtime.target_project)
            if not files:
                return []
            where = {"file": files[0]} if len(files) == 1 else {"file": {"$in": files}}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        if not results["ids"] or not results["ids"][0]:
            return []

        return [
            {
                "id": chunk_id,
                "content": document,
                "file": metadata.get("file", ""),
                "kind": metadata.get("kind", ""),
                "qualifiedName": metadata.get("qualified_name", ""),
                "startLine": metadata.get("start_line", 0),
                "endLine": metadata.get("end_line", 0),
                "distance": self.cosine_distance(distance),
                "rawDistance": distance,
            }
            for chunk_id, document, metadata, distance in zip(
                results["ids"][0],
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            )
        ]

    def search_with_scores(self, query_embedding: list[float], n_results: int = 5) -> list[dict]:
        return [
            {
                "file": chunk["file"],
                "line": chunk["startLine"],
                "kind": chunk["kind"],
                "qualifiedName": chunk["qualifiedName"],
                "distance": round(chunk["distance"], 4),
            }
            for chunk in self.search_chunks(query_embedding, n_results)
        ]


def shared_store(runtime) -> ChunkStore:
    from p2.store import vector_store

    return ChunkStore(vector_store, runtime)
