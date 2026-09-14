import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _expand(value: str) -> str:
    """Absolute, so a relative IOC_DATA_DIR cannot mean two places.

    The ignore rules compare the vector-store path against absolute paths from
    the walker. Leaving this relative made that comparison silently never match,
    which let the indexer walk its own Chroma directory.
    """
    return str(Path(value).expanduser().resolve())


def _host_roots() -> list[str]:
    """Host directories mounted into the API container, set by `make up`.

    Empty when the API runs on the host, where every path is already visible.
    """
    return [root for root in os.getenv("HOST_ROOTS", "").split() if root]


def _ignored_names() -> set[str]:
    raw = os.getenv("IGNORED_NAMES", "node_modules,.git,__pycache__")
    return {name.strip() for name in raw.split(",") if name.strip()}


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "*").split(",")
    )
    ignored_names: set[str] = field(default_factory=_ignored_names)
    host_roots: list[str] = field(default_factory=_host_roots)

    ollama_host: str = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    auto_pull_models: bool = os.getenv("IOC_AUTO_PULL") == "1"

    data_dir: str = field(
        default_factory=lambda: _expand(os.getenv("IOC_DATA_DIR", "./.data"))
    )

    @property
    def chroma_path(self) -> str:
        return _expand("./chroma_db")

    @property
    def conversations_path(self) -> str:
        return str(Path(self.data_dir) / "conversations")

    @property
    def snapshots_path(self) -> str:
        return str(Path(self.data_dir) / "snapshots")

    log_level: str = os.getenv("LOG_LEVEL", "INFO")
