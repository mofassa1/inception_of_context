from p2.store import vector_store as store
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["files"])

# @router.get("files/{file_path:path}")
# async def get_chunks_for_file(file_path: str):
#     try:
#         chunks = store.get_chunks_by_file(file_path)
#         print(f"[File Details] Retrieved {len(chunks['metadatas'])} chunks for file: {file_path}")
#         return {"file_path": file_path, "chunks": chunks}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

        # >>> FASTAPI HOOK <<<
        # resp = api.get(f"/files/{file_name}")
        # resp.raise_for_status()
        # data = resp.json()
        # Expected shape:
        # data = {
        #   "path": "notes/service.py",
        #   "lines": 38,
        #   "bytes": 1291,
        #   "chunks": [
        #       {"index": 1, "start_line": 1, "label": "chunk #1 — starts at line 1",
        #        "lines": ['"""High-level operations on top of Storage..."""', "from __future__ import annotations", ...]},
        #       ...
        #   ],
        # }

# @router.get("/files/{file_path:path}")

def get_chunks_by_file(self, file_path: str) -> dict[str, list]: 
    results = self.collection.get( where={"file": file_path}, 
                                  include=["metadatas", "documents"]) 
    return results 

@router.get("/files/{file_path:path}")
async def get_chunks_for_file(file_path: str):
    try:
        chunks = store.get_chunks_by_file(file_path)
        print(f"[File Details] Retrieved {len(chunks['metadatas'])} chunks for file: {file_path}")
        return {"file_path": file_path, "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# >>> FASTAPI HOOK <<<
# resp = api.get("/files")
# resp.raise_for_status()
# files = resp.json()["files"]   # [{"name": "...", "chunks": N}, ...]
        # data = {
        #     "path": file_name,
        #     "lines": 6,
        #     "bytes": 120,
        #     "chunks": [
        #         {
        #             "index": 1,
        #             "start_line": 1,
        #             "label": "chunk #1 — starts at line 1",
        #             "lines": [f"# content of {file_name} would appear here", "..."],
        #         }
        #     ],
        # }
# {
#   "file_path": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#   "chunks": {
#     "ids": [
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::__module__",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::is_binary",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::__module__1",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::walk_target",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::__module__2",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::to_abs_path",
#       "/home/afadouac/Desktop/inception_of_context/p1/index.py::__module__3"
#     ],
#     "embeddings": null,
#     "documents": [
#       "import os\n\nfrom monitor import OnMyWatch\n\n\n",
#       "def is_binary(path: str, chunk_size: int = 1024) -> bool:\n    try:\n        with open(path, \"rb\") as f:\n            chunk = f.read(chunk_size)\n        return b\"\\x00\" in chunk\n    except OSError:\n        return True\n",
#       "\n\nEXCLUDED_DIRS = {\"node_modules\", \".git\", \"dist\", \"build\", \"venv\", \".venv\", \"__pycache__\"}\n\n",
#       "def walk_target(target_path: str, chroma_path: str):\n    chroma_abs = os.path.abspath(chroma_path)\n    for root, dirs, files in os.walk(target_path):\n        dirs[:] = [\n            d for d in dirs\n            if d not in EXCLUDED_DIRS\n            and not d.startswith(\".\")\n            and os.path.abspath(os.path.join(root, d)) != chroma_abs\n        ]\n        for fname in files:\n            fpath = os.path.join(root, fname)\n            if is_binary(fpath):\n                continue\n            yield fpath\n",
#       "\nimport sys\nfrom pathlib import Path\n\n\n",
#       "def to_abs_path(target_path: str) -> str:\n    directory = Path(target_path).resolve()\n\n    if not directory.is_dir():\n        raise ValueError(f\"Directory does not exist: {target_path}\")\n\n    return str(directory)\n",
#       "\nfrom chunker import Chunker\nfrom embedder import Embedder\nfrom db import VectorStore\n\nif __name__ == \"__main__\":\n    argument_count = len(sys.argv)\n    if argument_count != 3:\n        print(\"invalid arguiment count \")\n        print(\"usage : program <target_path> <chroma_path>\")\n        sys.exit(1)\n    target_path : str = \"\"\n    chroma_path : str = \"\"\n    try:\n        target_path = to_abs_path(sys.argv[1])\n        chroma_path = to_abs_path(sys.argv[2])\n    except ValueError as e:\n        print(f\"Error: {e}\")\n    \n    chunker = Chunker()\n    embedder = Embedder()\n\n    store = VectorStore(\"../chroma_db\", collection_name=\"codebase\")\n\n    for filepath in walk_target(target_path, chroma_path):\n\n        with open(filepath, \"r\", encoding=\"utf-8\") as f:\n            source = f.read()\n        chunks = chunker.chunk_python_file(filepath, source)\n        vectors_list = [v for v in  embedder.create_embeddings([chunk.content for chunk in chunks])]\n\n        for chunk, vector in zip(chunks, vectors_list):\n\n            store.add(\n                ids=[chunk.id],\n                documents=[chunk.content],\n                embeddings=[vector],\n                metadatas=[{\n                    \"file\": chunk.file,\n                    \"kind\": chunk.kind,\n                    \"qualified_name\": chunk.qualified_name,\n                    \"start_line\": chunk.start_line,\n                    \"end_line\": chunk.end_line,\n                    \"content_hash\": chunk.content_hash\n                }]\n            )\n            print(\"*\" * 20)\n            print(f\"Indexed chunk: {chunk.id}\")\n            print(\"chunk stored in db with metadata:\")\n            print(store.get_chunks_by_ids([chunk.id]))\n\n\n    # for filepath in walk_target(target_path, chroma_path):\n    #     stored_chunks: dict = store.get_file_chunks(filepath)\n\n    #     for chunk_id, metadata in zip((stored_chunks.get(\"ids\", [])), stored_chunks.get('metadatas', [])):\n\n            # embedding = store.collection.get(ids=[chunk_id], include=[\"embeddings\"])[\"embeddings\"][0]\n    print(f\"Total chunks indexed: {store.get_all_chunks_count()}\")\n\n    watch = OnMyWatch(watchDirectory=target_path)\n    watch.run(store=store, chunker=chunker, embedder=embedder)\n"
#     ],
#     "uris": null,
#     "included": [
#       "metadatas",
#       "documents"
#     ],
#     "data": null,
#     "metadatas": [
#       {
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "qualified_name": "__module__",
#         "content_hash": "9a058496cc1e9632b4f041360fd69ac04d4b569deaada95e694e48203cd54978",
#         "end_line": 5,
#         "start_line": 1,
#         "kind": "module"
#       },
#       {
#         "qualified_name": "is_binary",
#         "kind": "function",
#         "end_line": 12,
#         "content_hash": "91d16a58db07555ab4bc135900c9beccd49214c5dd4ac51ea25216ccbe3e1c66",
#         "start_line": 6,
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py"
#       },
#       {
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "kind": "module",
#         "end_line": 16,
#         "start_line": 13,
#         "qualified_name": "__module__1",
#         "content_hash": "7c5c36407e4137067fac044522c5da85caac756c328f9fa9698cdd9ec4c221bf"
#       },
#       {
#         "start_line": 17,
#         "end_line": 30,
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "content_hash": "733f36aef1944eb8493e7e488a5b4db13ae2072c8c18a58195139d012dbdf5f9",
#         "kind": "function",
#         "qualified_name": "walk_target"
#       },
#       {
#         "kind": "module",
#         "content_hash": "ba14378a8d06d3e643d4f3908942f0f1b5ec9f567a5274a6f8bc5bbbf02297e4",
#         "end_line": 35,
#         "qualified_name": "__module__2",
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "start_line": 31
#       },
#       {
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "start_line": 36,
#         "content_hash": "27fa35510335425610222db30eb616603982d331f3d31c0a2d1e2b0c1e7e7660",
#         "qualified_name": "to_abs_path",
#         "kind": "function",
#         "end_line": 42
#       },
#       {
#         "content_hash": "184947647ac675bbadc20776f6011bbc58ffd5d4d0f43a78774fbdd4c8415f8b",
#         "start_line": 43,
#         "kind": "module",
#         "end_line": 104,
#         "file": "/home/afadouac/Desktop/inception_of_context/p1/index.py",
#         "qualified_name": "__module__3"
#       }
#     ]
#   }
# }
# Placeholder list matching the screenshot:

@router.get("/files")
async def get_all_files():
    try:
        files_with_chunks = store.get_files_with_chunks_count()
        files = [{"name": file_path, "chunks": count} for file_path, count in files_with_chunks.items()]
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))