# Turns the target folder into chunks in the store, then keeps it up to date.
# It runs in the API's process, so there is one ChromaDB client and one embedding model.

import os
import threading

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_CACHE = os.path.expanduser("~/.cache/huggingface")

# huggingface_hub reads these when it is imported, so they have to be set first:
# with the model already on disk, loading it must not call Hugging Face at all.
if os.path.isdir(os.path.join(EMBEDDING_CACHE, "models--" + EMBEDDING_MODEL.replace("/", "--"))):
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from sentence_transformers import SentenceTransformer  # noqa: E402
from watchdog.events import FileSystemEventHandler  # noqa: E402
from watchdog.observers import Observer  # noqa: E402

from p1.chunker import chunk_file  # noqa: E402

EXCLUDED_DIRS = {"node_modules", "dist", "build", "venv", "__pycache__"}
BINARY_SAMPLE_BYTES = 1024
EMBED_BATCH = 256
# Only real changes. Reading a file to index it also emits "opened" and "closed",
# which would send the indexer straight back to the same file, forever.
WATCHED_EVENTS = ("created", "modified", "moved", "deleted")


class Embedder:
    def __init__(self, model_name=EMBEDDING_MODEL, cache_folder=EMBEDDING_CACHE):
        self.model_name = model_name
        self.cache_folder = cache_folder
        self.model = SentenceTransformer(model_name, cache_folder=cache_folder)

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

    def read_chunks(self, path):
        if not os.path.isfile(path) or is_binary(path):
            return []
        try:
            with open(path, encoding="utf-8") as file:
                source = file.read()
        except (OSError, UnicodeDecodeError):
            return []
        return chunk_file(path, source)

    def store_chunks(self, chunks):
        # One call for many chunks: the model and ChromaDB are both far cheaper in batches.
        if chunks:
            self.store.add_chunks(chunks, self.embedder.embed([chunk.content for chunk in chunks]))

    def index_file(self, path):
        chunks = self.read_chunks(path)
        stored_ids = {chunk["id"] for chunk in self.store.chunks_of_file(path)}
        self.store_chunks(chunks)
        gone_ids = stored_ids - {chunk.id for chunk in chunks}
        if gone_ids:
            self.store.delete_chunks(sorted(gone_ids))
        return len(chunks)

    def remove_file(self, path):
        self.store.delete_file(path)
        self.report("deleted", path)

    def index_everything(self):
        # The first walk goes through every file, so it embeds and writes by batch,
        # not once per file. The watcher keeps using index_file for a single change.
        count = 0
        batch = []
        for folder, folders, files in os.walk(self.target_path):
            folders[:] = [
                name for name in folders if name not in EXCLUDED_DIRS and not name.startswith(".")
            ]
            if os.path.realpath(folder).startswith(self.store.chroma_path):
                folders[:] = []
                continue

            for name in files:
                batch.extend(self.read_chunks(os.path.join(folder, name)))
                if len(batch) >= EMBED_BATCH:
                    self.store_chunks(batch)
                    count += len(batch)
                    batch = []

        self.store_chunks(batch)
        count += len(batch)
        self.forget_gone_files()
        self.report("indexed", self.target_path, count)
        return count

    def forget_gone_files(self):
        # A file deleted or renamed while the project was closed left chunks behind:
        # nobody saw the event, so the first walk is the only chance to drop them.
        for path in self.store.files_with_counts():
            if not os.path.isfile(path):
                self.store.delete_file(path)
                self.report("deleted", path)

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
        if event.is_directory or event.event_type not in WATCHED_EVENTS:
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
