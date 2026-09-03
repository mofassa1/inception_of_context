import time
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from .utils import is_binary
import sys

class OnMyWatch:

    def __init__(self, watchDirectory=""):
        self.observer = Observer()
        self.watchDirectory = watchDirectory


    def run(self, store, chunker, embedder):
        handler = Handler(target_dir=self.watchDirectory, store=store, chunker=chunker, embedder=embedder)
        self.observer.schedule(handler, self.watchDirectory, recursive=True)
        self.observer.start()

        try:

            while True:
                time.sleep(5)
        except KeyboardInterrupt:
            self.observer.stop()

        self.observer.join()


class Handler(FileSystemEventHandler):

    def __init__(self, target_dir, store, chunker, embedder):
        super().__init__()
        self.target_dir = target_dir
        self.store = store
        self.chunker = chunker
        self.embedder = embedder

    def on_any_event(self, event):
        if event.is_directory:
            return
        if event.event_type == "modified":
            self._handle_file_modified(event)
        elif event.event_type == "created":
            self._handle_file_created(event)
        elif event.event_type == "deleted":
            self._handle_file_deleted(event)
        elif event.event_type == "moved":
            self._handle_file_deleted(event)
            self._handle_file_created(event)
    
    def _handle_chunk_created(self, event, chunk_ids, new_chunks):
        embeddings = self.embedder.create_embeddings([chunk.content for chunk in new_chunks])
        for chunk, embedding in zip(new_chunks, embeddings):
            self.store.add(
                ids=[chunk.id],
                documents=[chunk.content],
                embeddings=[embedding],
                metadatas=[{
                    "file": chunk.file,
                    "kind": chunk.kind,
                    "qualified_name": chunk.qualified_name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content_hash": chunk.content_hash
                }]
            )
        print(f"Added new chunks: {chunk_ids} for file: {event.src_path}")

    def _handle_chunk_deleted(self, event, chunk_ids):
        for chunk_id in chunk_ids:
            self.store.collection.delete(where={"id": chunk_id})
        print(f"Deleted chunks: {chunk_ids} for file: {event.src_path}")

    def _get_coresponding_stored_data(self, chunk_id: str, stored_chunks: dict) -> dict:
        for id in stored_chunks.get("ids", []):
            if id == chunk_id:
                index = stored_chunks["ids"].index(id)
                return {
                    "content_hash": stored_chunks["metadatas"][index].get("content_hash"),
                    "start_line": stored_chunks["metadatas"][index].get("start_line"),
                    "end_line": stored_chunks["metadatas"][index].get("end_line")
                }
        return dict()

    def _handle_chunk_modified(self, chunk_ids, new_chunks: list, stored_chunks: dict):
        for new_chunk in new_chunks:
            coresponding_stored_data = self._get_coresponding_stored_data(new_chunk.id, stored_chunks)
            if not coresponding_stored_data:
                print(f"No corresponding stored data found for chunk: {new_chunk.id}. Skipping update.")
                continue
            if new_chunk.content_hash != coresponding_stored_data.get("content_hash"):
                embedding = self.embedder.create_embeddings([new_chunk.content])[0]
                self.store.collection.update(
                    ids=[new_chunk.id],
                    documents=[new_chunk.content],
                    embeddings=[embedding],
                    metadatas=[{
                        "file": new_chunk.file,
                        "kind": new_chunk.kind,
                        "qualified_name": new_chunk.qualified_name,
                        "start_line": new_chunk.start_line,
                        "end_line": new_chunk.end_line,
                        "content_hash": new_chunk.content_hash
                    }]
                )
                print(f"Updated chunk: {new_chunk.id} for file: {new_chunk.file}")
            elif new_chunk.start_line != coresponding_stored_data.get("start_line") or new_chunk.end_line != coresponding_stored_data.get("end_line"):
                self.store.collection.update(
                    ids=[new_chunk.id],
                    metadatas=[{
                        "file": new_chunk.file,
                        "kind": new_chunk.kind,
                        "qualified_name": new_chunk.qualified_name,
                        "start_line": new_chunk.start_line,
                        "end_line": new_chunk.end_line,
                        "content_hash": new_chunk.content_hash
                    }]
                )
                print(f"Updated metadata for chunk: {new_chunk.id} for file: {new_chunk.file}")

    def _handle_file_modified(self, event):
        if is_binary(event.src_path):
            print(f"Skipping binary file: {event.src_path}")
            return
        with open(event.src_path, 'r') as f:
            source = f.read()
        


        chunks: list = self.chunker.chunk_python_file(event.src_path, source)
        file_chunks: dict = self.store.get_file_chunks(event.src_path)


        current_ids = {chunk.id for chunk in chunks}
        last_stored_ids = set(file_chunks.get("ids", []))

        new_ids = current_ids - last_stored_ids
        removed_ids = last_stored_ids - current_ids
        unchanged_ids = current_ids & last_stored_ids


        if new_ids:
            new_chunks = [chunk for chunk in chunks if chunk.id in new_ids]
            self._handle_chunk_created(event, new_ids, new_chunks)
        if removed_ids:
            self._handle_chunk_deleted(event, removed_ids)
        if unchanged_ids:
            self._handle_chunk_modified(unchanged_ids, [chunk for chunk in chunks if chunk.id in unchanged_ids], file_chunks)

    def _handle_file_created(self, event):
        if is_binary(event.src_path):
            print(f"Skipping binary file: {event.src_path}")
            return
        with open(event.src_path, 'r') as f:
            source = f.read()
        
        chunks = self.chunker.chunk_python_file(event.src_path, source)
        embeddings = self.embedder.create_embeddings([chunk.content for chunk in chunks])
        for chunk, embedding in zip(chunks, embeddings):
            self.store.add(
                ids=[chunk.id],
                documents=[chunk.content],
                embeddings=[embedding],
                metadatas=[{
                    "file": chunk.file,
                    "kind": chunk.kind,
                    "qualified_name": chunk.qualified_name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content_hash": chunk.content_hash
                }]
            )
    def _handle_file_deleted(self, event):
        stored_chunks = self.store.get_file_chunks(event.src_path)

        ids = stored_chunks["ids"]

        if ids:
            self.store.collection.delete(ids=ids)
            print("*" * 20)
            print(f"Deleted chunks: {ids} for file: {event.src_path}")
            print("*" * 20)









import sys
if __name__ == "__main__":
    watch_directory = sys.argv[1] if len(sys.argv) > 1 else "."
    watch = OnMyWatch(watchDirectory=watch_directory)
    # watch.run(store, chunker, embedder)  # Pass the required instances to run