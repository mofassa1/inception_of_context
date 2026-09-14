from dataclasses import dataclass


@dataclass
class RuntimeInfo:
    """Mutable per-process state: what this instance has learned at runtime."""

    target_project: str = ""
    chroma_path: str = ""
    collection_name: str = ""
