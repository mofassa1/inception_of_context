"""Wraps p1/embedder.py and the p2/embidder_object.py instance."""

from pathlib import Path

from p1.core.logging import get_logger

logger = get_logger(__name__)

EMBED_BATCH_SIZE = 64


def prepare_embedding_cache() -> None:
    import inspect

    from p1.embedder import Embedder

    defaults = inspect.signature(Embedder.__init__).parameters
    model_name = defaults["model_name"].default
    cache_folder = Path(defaults["cache_folder"].default)

    directory_name = "models--" + model_name.replace("/", "--")
    hub_copy = cache_folder / "hub" / directory_name
    root_copy = cache_folder / directory_name

    if not hub_copy.exists() and not root_copy.exists():
        from huggingface_hub import constants, snapshot_download

        was_offline = constants.HF_HUB_OFFLINE
        constants.HF_HUB_OFFLINE = False
        try:
            logger.info("downloading embedding model %s once", model_name)
            snapshot_download(model_name, cache_dir=str(cache_folder / "hub"))
        finally:
            constants.HF_HUB_OFFLINE = was_offline

    if hub_copy.exists() and not root_copy.exists():
        root_copy.symlink_to(Path("hub") / directory_name, target_is_directory=True)
    elif root_copy.exists() and not hub_copy.exists():
        hub_copy.parent.mkdir(parents=True, exist_ok=True)
        hub_copy.symlink_to(Path("..") / directory_name, target_is_directory=True)


class EmbedderAdapter:
    def __init__(self, embedder):
        self.embedder = embedder
        self.model_name = embedder.model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self.embedder.create_embeddings(texts)

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]

    def embed_in_batches(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []

        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            vectors.extend(self.embed(texts[start : start + EMBED_BATCH_SIZE]))

        return vectors


def shared_embedder() -> EmbedderAdapter:
    from p2.embidder_object import embedder

    return EmbedderAdapter(embedder)
