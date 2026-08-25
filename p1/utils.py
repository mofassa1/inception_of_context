
def is_binary(path: str, chunk_size: int = 1024) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(chunk_size)
        return b"\x00" in chunk
    except OSError:
        return True