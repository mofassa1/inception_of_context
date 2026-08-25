from p1.db import VectorStore


vector_store = VectorStore(
    "./chroma_db",
    collection_name="codebase"
)