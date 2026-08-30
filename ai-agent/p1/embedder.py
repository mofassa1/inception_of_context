import os
from langchain_huggingface import HuggingFaceEmbeddings
from general_infos_object import g_infos

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

class Embedder:
    def __init__(
        self,
        model_name: str = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        cache_folder: str = os.path.expanduser(os.getenv("HF_CACHE", "~/.cache/huggingface")),
    ):
        self.model_name = model_name
        self.cache_folder = cache_folder
        self.embeddings = self._init_embeddings()
        g_infos.set_embedder_name(self.model_name)

    def _is_cached(self) -> bool:
        # crude but effective: check if the model's folder already exists in the cache
        safe_name = self.model_name.replace("/", "--")
        expected = os.path.join(self.cache_folder, "hub", f"models--{safe_name}")
        return os.path.isdir(expected)

    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        if self._is_cached():
            # already downloaded -> lock offline, never touch network again
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
        else:
            # first run -> allow network just long enough to download
            os.environ.pop("HF_HUB_OFFLINE", None)
            os.environ.pop("TRANSFORMERS_OFFLINE", None)
            print(f"[embedder] '{self.model_name}' not cached yet — downloading once...")

        embeddings = HuggingFaceEmbeddings(
            model_name=self.model_name,
            cache_folder=self.cache_folder,
            encode_kwargs={"normalize_embeddings": True},
        )

        # after loading (download-if-needed happens inside the constructor above),
        # re-lock offline for the rest of the process's lifetime
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

        return embeddings

    def create_embeddings(self, texts: list[str]) -> list[list[float]]:
        return self.embeddings.embed_documents(texts)