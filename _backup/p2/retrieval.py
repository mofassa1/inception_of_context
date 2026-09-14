import os

from p1.core.logging import get_logger
from p1.runtime import RuntimeInfo

logger = get_logger(__name__)


def dedupe_overlapping(chunks: list[dict]) -> list[dict]:
    """Drop chunks whose content is fully contained in one already kept.

    Chunks overlap by construction, so top-k can otherwise be two copies of the
    same code — a method on its own and again inside its class chunk. This runs
    on raw content, before rendering, because headers would break containment.
    """
    kept: list[dict] = []

    for chunk in chunks:
        content = chunk["content"]
        if any(content in existing["content"] for existing in kept):
            continue
        kept = [existing for existing in kept if existing["content"] not in content]
        kept.append(chunk)

    return kept


class RetrievalService:
    """Top-k semantic search over the indexed chunks.

    Every chunk is labelled with its path, line range and symbol so the model
    can say which file an answer came from, and so it cannot pass off a symbol
    that is not in the index as one that is.
    """

    def __init__(self, store, embedder, runtime: RuntimeInfo):
        self.store = store
        self.embedder = embedder
        self.runtime = runtime

    def display_path(self, file_path: str) -> str:
        root = self.runtime.target_project
        if root and file_path.startswith(root):
            return os.path.relpath(file_path, root)
        return file_path

    def render(self, chunk: dict) -> str:
        parts = [self.display_path(chunk["file"])]

        start, end = chunk.get("startLine", 0), chunk.get("endLine", 0)
        if start and end:
            parts.append(f"lines {start}-{end}")

        symbol = " ".join(
            value for value in (chunk.get("kind"), chunk.get("qualifiedName")) if value
        )
        if symbol:
            parts.append(symbol)

        header = " · ".join(parts)
        if chunk.get("rank"):
            header = f"[{chunk['rank']}] ─── {header}"
        else:
            header = f"─── {header}"

        return header + "\n" + chunk["content"].rstrip()

    def collect(self, query: str, k: int = 5) -> list[dict]:
        query_embedding = self.embedder.embed_one(query)
        chunks = dedupe_overlapping(self.store.search_chunks(query_embedding, k))

        for rank, chunk in enumerate(chunks, start=1):
            chunk["rank"] = rank

        logger.debug("context for %r: %d chunks", query[:40], len(chunks))
        return chunks

    def render_context(self, chunks: list[dict]) -> list[str]:
        """Least relevant first: small models weight the end of the context."""
        return [self.render(chunk) for chunk in reversed(chunks)]

    def build_context(self, query: str, k: int = 5) -> list[str]:
        return self.render_context(self.collect(query, k))
