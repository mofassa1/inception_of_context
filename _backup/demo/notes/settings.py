import os


class Settings:
    """Where the notes are stored, read from the environment when set."""

    def __init__(self, store_path: str = "notes.json"):
        self._store_path = store_path

    @property
    def store_path(self) -> str:
        return self._store_path

    @store_path.setter
    def store_path(self, value: str) -> None:
        if not value.strip():
            raise ValueError("store path is required")
        self._store_path = value

    def load_from_env(self) -> "Settings":
        def read(name: str, default: str) -> str:
            return os.environ.get(name, default)

        self.store_path = read("NOTES_STORE", self._store_path)
        return self

    page_size = 20
