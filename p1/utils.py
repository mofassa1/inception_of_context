
def is_binary(path: str, chunk_size: int = 1024) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(chunk_size)
        return b"\x00" in chunk
    except OSError:
        return True
    
import hashlib
from pathlib import Path


def collection_name_from_path(target_path: str) -> str:
    normalized_path = str(Path(target_path).resolve())

    path_hash = hashlib.sha256(
        normalized_path.encode("utf-8")
    ).hexdigest()[:16]

    return f"codebase_{path_hash}"
