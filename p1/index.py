import os

from monitor import OnMyWatch


def is_binary(path: str, chunk_size: int = 1024) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(chunk_size)
        return b"\x00" in chunk
    except OSError:
        return True


EXCLUDED_DIRS = {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__"}

def walk_target(target_path: str, chroma_path: str):
    chroma_abs = os.path.abspath(chroma_path)
    for root, dirs, files in os.walk(target_path):
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDED_DIRS
            and not d.startswith(".")
            and os.path.abspath(os.path.join(root, d)) != chroma_abs
        ]
        for fname in files:
            fpath = os.path.join(root, fname)
            if is_binary(fpath):
                continue
            yield fpath

import sys
from pathlib import Path


def to_abs_path(target_path: str) -> str:
    directory = Path(target_path).resolve()

    if not directory.is_dir():
        raise ValueError(f"Directory does not exist: {target_path}")

    return str(directory)

from chunker import Chunker
from embedder import Embedder
from db import VectorStore

if __name__ == "__main__":
    argument_count = len(sys.argv)
    if argument_count != 3:
        print("invalid arguiment count ")
        print("usage : program <target_path> <chroma_path>")
        sys.exit(1)
    target_path : str = ""
    chroma_path : str = ""
    try:
        target_path = to_abs_path(sys.argv[1])
        chroma_path = to_abs_path(sys.argv[2])
    except ValueError as e:
        print(f"Error: {e}")
    
    chunker = Chunker()
    embedder = Embedder()

    store = VectorStore("../chroma_db", collection_name="codebase")

    for filepath in walk_target(target_path, chroma_path):

        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()
        chunks = chunker.chunk_python_file(filepath, source)
        vectors_list = [v for v in  embedder.create_embeddings([
            f"file path and name: {chunk.file}, kind: {chunk.kind}, qualified name: {chunk.qualified_name}, content: {chunk.content}" for chunk in chunks])]

        for chunk, vector in zip(chunks, vectors_list):

            store.add(
                ids=[chunk.id],
                documents=[chunk.content],
                embeddings=[vector],
                metadatas=[{
                    "file": chunk.file,
                    "kind": chunk.kind,
                    "qualified_name": chunk.qualified_name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content_hash": chunk.content_hash
                }]
            )
            print("*" * 20)
            print(f"Indexed chunk: {chunk.id}")
            print("chunk stored in db with metadata:")
            print(store.get_chunks_by_ids([chunk.id]))


    # for filepath in walk_target(target_path, chroma_path):
    #     stored_chunks: dict = store.get_file_chunks(filepath)

    #     for chunk_id, metadata in zip((stored_chunks.get("ids", [])), stored_chunks.get('metadatas', [])):

            # embedding = store.collection.get(ids=[chunk_id], include=["embeddings"])["embeddings"][0]
    print(f"Total chunks indexed: {store.get_all_chunks_count()}")

    watch = OnMyWatch(watchDirectory=target_path)
    watch.run(store=store, chunker=chunker, embedder=embedder)
