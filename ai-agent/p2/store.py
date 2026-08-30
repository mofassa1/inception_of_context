import os

from p1.db import VectorStore

vector_store = VectorStore(
    os.getenv("CHROMA_PATH", "./chroma_db"),
    collection_name=os.getenv("CHROMA_COLLECTION", "codebase"),
)
