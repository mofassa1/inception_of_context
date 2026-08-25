"""
Manual visual test for the AST chunker.
Run: python p1/test_chunker_manual.py
Prints each detected chunk with a clear separator, its kind, qualified name,
line range, and the exact content that will be embedded.
"""

# from chunker import chunk_python_file  # adjust import to your actual module path


SAMPLE_SOURCE = '''\
"""High-level operations on top of Storage with input validation."""
from __future__ import annotations
from .storage import Note, Storage


class NoteService:
    """Public API of the notes app.

    Validates user input, exposes search and tag-filter helpers. Wraps
    a Storage instance so the in-memory state stays trivially swappable.
    """

    def __init__(self, storage: Storage | None = None) -> None:
        self.storage = storage or Storage()

    def create(self, title: str, body: str = "") -> None:
        title = (title or "").strip()
        if not title:
            raise ValueError("title must not be empty")
        return self.storage.add(Note(title=title, body=body))

    def find(self, note_id: int) -> Note | None:
        return self.storage.get(note_id)

    @staticmethod
    def helper(x: int) -> int:
        return x * 2

    async def async_search(self, term: str) -> list[Note]:
        term = (term or "").lower()
        if not term:
            return []
        return [n for n in self.storage.list_all() if term in n.body.lower()]
    class HelperService:
        def __init__(self):
            pass
        def sum(self, a, b):
            return a+b

def standalone_function(x, y):
    return x + y
'''


def print_chunk(chunk, index: int):
    separator = "=" * 70
    print(separator)
    print(f"CHUNK #{index}")
    print(f"  id:              {chunk.id}")
    print(f"  file:            {chunk.file}")
    print(f"  kind:            {chunk.kind}")
    print(f"  qualified_name:  {chunk.qualified_name}")
    print(f"  lines:           {chunk.start_line}-{chunk.end_line}")
    print(f"  hashed_contant:  {chunk.hashed_contant}")
    print(separator)

    content_lines = chunk.content.splitlines()
    width = len(str(chunk.start_line + len(content_lines)))
    for offset, line in enumerate(content_lines):
        actual_line_no = chunk.start_line + offset
        print(f"  {str(actual_line_no).rjust(width)} | {line}")
    print()

from chunker import Chunker

def main():
    ch = Chunker()
    try:
        chunks = ch.chunk_python_file("notes/service.py", SAMPLE_SOURCE)
        print(f"\nTotal chunks found: {len(chunks)}\n")
        for i, chunk in enumerate(chunks, start=1):
            print_chunk(chunk, i)
    except SyntaxError as e:
        print(f"syntax error: {e}")

if __name__ == "__main__":
    main()