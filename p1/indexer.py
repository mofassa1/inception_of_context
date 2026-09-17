# Turns the target folder into chunks in the store, then keeps it up to date.
# It runs in the API's process, so there is one ChromaDB client and one embedding model.

import os
import threading

from sentence_transformers import SentenceTransformer
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from p1.chunker import chunk_file

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_CACHE = os.path.expanduser("~/.cache/huggingface")
EXCLUDED_DIRS = {"node_modules", "dist", "build", "venv", "__pycache__"}
BINARY_SAMPLE_BYTES = 1024


class Embedder:
    def __init__(self, model_name=EMBEDDING_MODEL, cache_folder=EMBEDDING_CACHE):
        self.model_name = model_name
        self.cache_folder = cache_folder
        if self.is_downloaded():
            # Everything is local: never let the library call Hugging Face again.
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
        self.model = SentenceTransformer(model_name, cache_folder=cache_folder)
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

    def is_downloaded(self):
        folder = "models--" + self.model_name.replace("/", "--")
        return os.path.isdir(os.path.join(self.cache_folder, folder))

    def embed(self, texts):
        vectors = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [vector.tolist() for vector in vectors]


def is_binary(path):
    try:
        with open(path, "rb") as file:
            return b"\x00" in file.read(BINARY_SAMPLE_BYTES)
    except OSError:
        return True


class Indexer:
    def __init__(self, target_path, store, embedder, on_event=None):
        self.target_path = os.path.realpath(target_path)
        self.store = store
        self.embedder = embedder
        self.on_event = on_event
        self.watching = False

    def report(self, kind, path, chunk_count=0):
        if self.on_event is not None:
            self.on_event(kind, path, chunk_count)

    def is_indexable(self, path):
        full_path = os.path.realpath(path)
        if full_path.startswith(self.store.chroma_path + os.sep):
            return False
        if not full_path.startswith(self.target_path + os.sep):
            return False

        parts = os.path.relpath(full_path, self.target_path).split(os.sep)[:-1]
        for part in parts:
            if part in EXCLUDED_DIRS or part.startswith("."):
                return False
        return True

    def index_file(self, path):
        if not os.path.isfile(path) or is_binary(path):
            return 0
        try:
            with open(path, encoding="utf-8") as file:
                source = file.read()
        except (OSError, UnicodeDecodeError):
            return 0

        chunks = chunk_file(path, source)
        stored_ids = {chunk["id"] for chunk in self.store.chunks_of_file(path)}
        if chunks:
            self.store.add_chunks(chunks, self.embedder.embed([chunk.content for chunk in chunks]))
        gone_ids = stored_ids - {chunk.id for chunk in chunks}
        if gone_ids:
            self.store.delete_chunks(sorted(gone_ids))
        return len(chunks)

    def remove_file(self, path):
        self.store.delete_file(path)
        self.report("deleted", path)

    def index_everything(self):
        count = 0
        for folder, folders, files in os.walk(self.target_path):
            folders[:] = [
                name for name in folders if name not in EXCLUDED_DIRS and not name.startswith(".")
            ]
            if os.path.realpath(folder).startswith(self.store.chroma_path):
                folders[:] = []
                continue
            for name in files:
                count += self.index_file(os.path.join(folder, name))
        self.report("indexed", self.target_path, count)
        return count

    def watch(self):
        observer = Observer()
        observer.schedule(FolderWatcher(self), self.target_path, recursive=True)
        observer.start()
        self.watching = True
        return observer

    def start(self):
        thread = threading.Thread(target=self.index_everything_then_watch, daemon=True)
        thread.start()
        return thread

    def index_everything_then_watch(self):
        self.index_everything()
        self.watch()


class FolderWatcher(FileSystemEventHandler):
    def __init__(self, indexer):
        super().__init__()
        self.indexer = indexer

    def on_any_event(self, event):
        if event.is_directory:
            return

        path = event.dest_path if event.event_type == "moved" else event.src_path
        if event.event_type == "moved" and self.indexer.is_indexable(event.src_path):
            self.indexer.remove_file(event.src_path)
        if not self.indexer.is_indexable(path):
            return

        if event.event_type == "deleted":
            self.indexer.remove_file(path)
            return

        chunk_count = self.indexer.index_file(path)
        if chunk_count > 0:
            kind = "indexed" if event.event_type in ("created", "moved") else "modified"
            self.indexer.report(kind, path, chunk_count)
